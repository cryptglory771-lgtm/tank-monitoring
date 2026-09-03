import mqtt from 'mqtt';
import webpush from 'web-push';
import { evaluate, shouldNotify, type NotifyGateState } from '../src/lib/alert-engine';
import type { Evaluation, Reading, Tank } from '../src/lib/types';

/**
 * Penjaga latar belakang.
 *
 * Service worker di ponsel tidak boleh menahan koneksi MQTT saat aplikasi
 * ditutup — sistem operasi akan mematikannya dalam hitungan detik. Jadi
 * proses inilah yang berlangganan ke broker sepanjang waktu, menilai kondisi
 * dengan mesin yang sama persis dengan yang dipakai layar, lalu mengirim
 * Web Push. Tanpa proses ini, poin "alert tanpa membuka aplikasi" tidak
 * mungkin dipenuhi.
 */

const {
  MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD,
  NEXT_PUBLIC_MQTT_TOPIC_PREFIX = 'susu',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:ops@example.com',
  APP_BASE_URL = 'http://127.0.0.1:3000', WORKER_TOKEN,
} = process.env;

for (const [k, v] of Object.entries({ MQTT_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WORKER_TOKEN })) {
  if (!v) { console.error(`[worker] ${k} belum diisi di .env`); process.exit(1); }
}

webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

const WINDOW_MS = 90 * 60_000;
const buffers = new Map<string, Reading[]>();
const gates = new Map<string, NotifyGateState>();
const lastStatus = new Map<string, Evaluation['status']>();

let tanks: Tank[] = [];
let subscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = [];

// ------------------------------------------------------------------- konfigurasi

async function refreshConfig() {
  try {
    const res = await fetch(`${APP_BASE_URL}/api/worker/config`, {
      headers: { 'x-worker-token': WORKER_TOKEN! },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    tanks = (data.tanks ?? []).filter((t: Tank) => !t.archived);
    subscriptions = data.subscriptions ?? [];
  } catch (err) {
    console.error('[worker] gagal memuat konfigurasi:', (err as Error).message);
  }
}

async function dropDeadSubscriptions(endpoints: string[]) {
  if (!endpoints.length) return;
  subscriptions = subscriptions.filter((s) => !endpoints.includes(s.endpoint));
  await fetch(`${APP_BASE_URL}/api/worker/config`, {
    method: 'DELETE',
    headers: { 'x-worker-token': WORKER_TOKEN!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoints }),
  }).catch(() => {});
}

// -------------------------------------------------------------------------- MQTT

const client = mqtt.connect(MQTT_URL!, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: `worker-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 5000,
  protocolVersion: 5,
});

client.on('connect', () => {
  console.log('[worker] tersambung ke broker');
  client.subscribe(`${NEXT_PUBLIC_MQTT_TOPIC_PREFIX}/+/suhu`, { qos: 1 });
});
client.on('error', (e) => console.error('[worker] mqtt:', e.message));

client.on('message', (topic, payload) => {
  const parts = topic.split('/');
  const tankId = parts[parts.length - 2];
  let temp: number;
  let ts = Date.now();
  try {
    const raw = JSON.parse(payload.toString());
    temp = Number(raw.suhu ?? raw.t ?? raw.temp ?? raw.temperature);
    if (typeof raw.ts === 'string') {
      const parsed = Date.parse(raw.ts);
      if (Number.isFinite(parsed)) ts = parsed;
    } else {
      const tsRaw = Number(raw.ts ?? 0);
      if (tsRaw > 0) ts = tsRaw > 1e12 ? tsRaw : tsRaw * 1000;
    }
  } catch {
    temp = Number(payload.toString());
  }
  if (!Number.isFinite(temp)) return;

  const buf = buffers.get(tankId) ?? [];
  buf.push({ tankId, temp, ts });
  const cutoff = Date.now() - WINDOW_MS;
  buffers.set(tankId, buf.filter((r) => r.ts >= cutoff));
});

// ---------------------------------------------------------------------- evaluasi

async function tick() {
  const now = Date.now();
  for (const tank of tanks) {
    const readings = (buffers.get(tank.id) ?? []).sort((a, b) => a.ts - b.ts);

    // Jangan kirim "tidak terhubung" hanya karena worker baru dinyalakan.
    if (readings.length === 0 && now - startedAt < tank.rules.offlineAfterMinutes * 60_000) continue;

    const result = evaluate({
      rules: tank.rules,
      readings,
      now,
      previousStatus: lastStatus.get(tank.id) ?? null,
    });
    lastStatus.set(tank.id, result.status);

    if (!result.code || !result.severity) {
      gates.delete(tank.id); // kondisi pulih, izinkan notifikasi berikutnya langsung terkirim
      continue;
    }

    const gate = gates.get(tank.id) ?? null;
    if (!shouldNotify(result, gate, tank.rules, now)) continue;

    gates.set(tank.id, { code: result.code, severity: result.severity, notifiedAt: now });
    await broadcast(tank, result, now);
  }
}

async function broadcast(tank: Tank, result: Evaluation, now: number) {
  const payload = JSON.stringify({
    title: `${tank.name} — ${result.severity === 'critical' ? 'Kritis' : 'Perlu dicek'}`,
    body: result.message,
    severity: result.severity,
    tankId: tank.id,
    tag: `tank-${tank.id}`,
    ts: now,
    url: `/?tank=${tank.id}`,
  });

  const dead: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 900, urgency: result.severity === 'critical' ? 'high' : 'normal' });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.endpoint);
        else console.error('[worker] push gagal:', status ?? (err as Error).message);
      }
    }),
  );
  await dropDeadSubscriptions(dead);
  console.log(`[worker] ${tank.id} -> ${result.code} (${result.severity}) ke ${subscriptions.length} perangkat`);
}

// ------------------------------------------------------------------------- mulai

const startedAt = Date.now();

// Dibungkus fungsi async (bukan top-level await) supaya tetap jalan lewat
// `tsx` dalam mode CommonJS default project ini, tanpa perlu "type": "module".
async function main() {
  await refreshConfig();
  setInterval(refreshConfig, 60_000);
  setInterval(() => { tick().catch((e) => console.error('[worker] tick:', e)); }, 30_000);

  console.log(`[worker] berjalan — ${tanks.length} tanki, ${subscriptions.length} perangkat terdaftar`);
}

main().catch((err) => {
  console.error('[worker] gagal memulai:', err);
  process.exit(1);
});

// Jangan biarkan error tak tertangkap mematikan proses secara diam-diam —
// log dulu supaya kelihatan di pm2/systemd, baru keluar dengan kode non-nol
// supaya process manager tahu harus restart, bukan menganggapnya berhenti normal.
process.on('unhandledRejection', (err) => {
  console.error('[worker] unhandledRejection:', err);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[worker] uncaughtException:', err);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { client.end(true, () => process.exit(0)); });
}
