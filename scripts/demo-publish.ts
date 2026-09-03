import mqtt from 'mqtt';

/**
 * Simulator command-line: publish suhu acak ke HiveMQ untuk beberapa tanki
 * sekaligus, supaya PWA & worker bisa didemo tanpa perangkat ESP32 asli.
 *
 * Pakai:
 *   npm run demo
 *   npm run demo -- --tanks=tank-a,tank-b --interval=2000
 *   npm run demo -- --spike=tank-a   (paksa satu kali breach critical lalu lanjut normal)
 */

const {
  MQTT_URL,
  MQTT_USERNAME,
  NEXT_PUBLIC_MQTT_USERNAME,
  MQTT_PASSWORD,
  NEXT_PUBLIC_MQTT_PASSWORD,
  NEXT_PUBLIC_MQTT_TOPIC_PREFIX = 'susu',
} = process.env;

const url = MQTT_URL;
const username = MQTT_USERNAME ?? NEXT_PUBLIC_MQTT_USERNAME;
const password = MQTT_PASSWORD ?? NEXT_PUBLIC_MQTT_PASSWORD;

if (!url) {
  console.error('[demo] MQTT_URL belum diisi di .env.local');
  process.exit(1);
}

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

const tankIds = (args.get('tanks') ?? 'tank-a,tank-b,tank-c,tank-d,tank-e').split(',');
const intervalMs = Number(args.get('interval') ?? 3000);
const spikeTank = args.get('spike');

// Setiap tanki punya "suhu berjalan" sendiri supaya pergerakannya realistis,
// bukan angka acak lepas tiap kirim.
const state = new Map<string, number>(tankIds.map((id) => [id, 1.2 + Math.random() * 0.8]));
let spikeSent = false;

const client = mqtt.connect(url, {
  username,
  password,
  clientId: `demo-${Math.random().toString(16).slice(2, 10)}`,
  protocolVersion: 5,
});

client.on('connect', () => {
  console.log(`[demo] tersambung. mengirim ${tankIds.join(', ')} tiap ${intervalMs}ms ke prefix "${NEXT_PUBLIC_MQTT_TOPIC_PREFIX}"`);
  setInterval(tick, intervalMs);
});

client.on('error', (err) => {
  console.error('[demo] mqtt:', err.message);
});

function tick() {
  for (const tankId of tankIds) {
    let temp = state.get(tankId)!;

    if (spikeTank === tankId && !spikeSent) {
      temp = 9.8; // contoh breach critical dari brief (ambang critical demo: 0-8°C)
      spikeSent = true;
    } else {
      // random walk lembut di sekitar 0.5-2.5°C, sesekali kembali ke tengah
      temp += (1.4 - temp) * 0.05 + (Math.random() - 0.5) * 0.3;
    }

    state.set(tankId, temp);

    const payload = JSON.stringify({
      suhu: Math.round(temp * 10) / 10,
      ts: new Date().toISOString(),
    });
    const topic = `${NEXT_PUBLIC_MQTT_TOPIC_PREFIX}/${tankId}/suhu`;
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) console.error(`[demo] gagal publish ${topic}:`, err.message);
    });
    console.log(`[demo] ${topic} -> ${payload}`);
  }
}

process.on('SIGINT', () => client.end(true, () => process.exit(0)));
