import mqtt from 'mqtt';

/**
 * Simulator command-line: publish suhu ke HiveMQ untuk beberapa tanki
 * sekaligus, supaya PWA & worker bisa didemo tanpa perangkat ESP32 asli.
 *
 * Secara default tiap tanki bersiklus melewati tiga pita suhu (normal,
 * peringatan, kritis) dan bertahan cukup lama di tiap pita (>sustainSeconds
 * tanki, default 20s untuk tanki baru) supaya alert-engine benar-benar
 * memicu status, bukan cuma numpang lewat.
 *
 * Pakai:
 *   npm run demo
 *   npm run demo -- --tanks=tank-a,tank-b --interval=2000
 *   npm run demo -- --stable=tank-a          (tank-a tetap di pita normal saja)
 *   npm run demo -- --hold=tank-b:critical   (tank-b dipaku di pita kritis)
 *   npm run demo -- --spike=tank-a           (satu kali breach instan 9.8°C lalu lanjut siklus)
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
const stableTanks = new Set((args.get('stable') ?? '').split(',').filter(Boolean));

// tank-b:critical,tank-c:warning -> paksa pita tetap, tidak ikut siklus.
const pinnedBand = new Map<string, Band>();
for (const pair of (args.get('hold') ?? '').split(',').filter(Boolean)) {
  const [id, band] = pair.split(':');
  if (id && isBand(band)) pinnedBand.set(id, band);
}

type Band = 'normal' | 'warning' | 'critical';
function isBand(v: string): v is Band {
  return v === 'normal' || v === 'warning' || v === 'critical';
}

// Rentang mengikuti DEFAULT_RULES di src/lib/types.ts (warnHigh 4, criticalHigh 6).
const RANGES: Record<Band, [number, number]> = {
  normal: [0.6, 2.2],
  warning: [4.4, 5.6],
  critical: [6.8, 8.5],
};
const ORDER: Band[] = ['normal', 'warning', 'critical'];

interface TankSim {
  temp: number;
  target: number;
  band: Band;
  holdTicksLeft: number;
}

// alert-engine baru mengubah status setelah suhu bertahan di atas ambang
// sELAMA sustainSeconds tanki itu (default tanki baru: 20 detik). Ditambah
// waktu transisi mendekati target, tiap pita perlu bertahan jauh lebih lama
// dari sustainSeconds supaya alert sempat "matang" dan kelihatan jelas
// sebelum pindah ke pita berikutnya.
function holdTicks(): number {
  const holdSeconds = 60 + Math.random() * 40; // 60-100 detik
  return Math.max(3, Math.round((holdSeconds * 1000) / intervalMs));
}

function pickTarget(band: Band): number {
  const [lo, hi] = RANGES[band];
  return lo + Math.random() * (hi - lo);
}

const sims = new Map<string, TankSim>(
  tankIds.map((id) => {
    const band = pinnedBand.get(id) ?? 'normal';
    const target = pickTarget(band);
    return [id, { temp: target, target, band, holdTicksLeft: holdTicks() }];
  }),
);

let spikeSent = false;

const client = mqtt.connect(url, {
  username,
  password,
  clientId: `demo-${Math.random().toString(16).slice(2, 10)}`,
  protocolVersion: 5,
});

client.on('connect', () => {
  console.log(`[demo] tersambung. mengirim ${tankIds.join(', ')} tiap ${intervalMs}ms ke prefix "${NEXT_PUBLIC_MQTT_TOPIC_PREFIX}"`);
  for (const [id, sim] of sims) console.log(`[demo] ${id} mulai di pita "${sim.band}"`);
  setInterval(tick, intervalMs);
});

client.on('error', (err) => {
  console.error('[demo] mqtt:', err.message);
});

function advanceBand(id: string, sim: TankSim) {
  if (pinnedBand.has(id) || stableTanks.has(id)) {
    sim.holdTicksLeft = holdTicks();
    return;
  }
  const next = ORDER[(ORDER.indexOf(sim.band) + 1) % ORDER.length];
  sim.band = next;
  sim.target = pickTarget(next);
  sim.holdTicksLeft = holdTicks();
  console.log(`[demo] ${id} pindah ke pita "${next}" (~${sim.target.toFixed(1)}°C)`);
}

function tick() {
  for (const tankId of tankIds) {
    const sim = sims.get(tankId)!;

    if (spikeTank === tankId && !spikeSent) {
      sim.temp = 9.8; // contoh breach critical dari brief (ambang critical demo: 0-8°C)
      spikeSent = true;
    } else {
      if (--sim.holdTicksLeft <= 0) advanceBand(tankId, sim);
      // Bergerak menuju target pita saat ini (cukup cepat supaya ambang
      // terlewati lebih awal, menyisakan waktu lebih banyak untuk sustain),
      // bukan lompat langsung, supaya kurvanya tetap natural di sparkline.
      sim.temp += (sim.target - sim.temp) * 0.35 + (Math.random() - 0.5) * 0.15;
    }

    const temp = Math.round(sim.temp * 10) / 10;
    const payload = JSON.stringify({ suhu: temp, ts: new Date().toISOString() });
    const topic = `${NEXT_PUBLIC_MQTT_TOPIC_PREFIX}/${tankId}/suhu`;
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) console.error(`[demo] gagal publish ${topic}:`, err.message);
    });
    console.log(`[demo] ${topic} -> ${payload}`);
  }
}

process.on('SIGINT', () => client.end(true, () => process.exit(0)));
