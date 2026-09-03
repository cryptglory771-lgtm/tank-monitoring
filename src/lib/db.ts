import Dexie, { type Table } from 'dexie';
import type { AlertRecord, Reading, Tank, TankRuntime } from './types';

/**
 * Penyimpanan lokal. Semua yang tampil di layar dibaca dari sini, bukan
 * langsung dari MQTT, sehingga aplikasi tetap berguna saat sinyal hilang.
 */
class TankDB extends Dexie {
  tanks!: Table<Tank, string>;
  readings!: Table<Reading, number>;
  alerts!: Table<AlertRecord, number>;
  runtime!: Table<TankRuntime, string>;

  constructor() {
    super('tank-monitoring');
    this.version(1).stores({
      tanks: 'id, name, archived',
      readings: '++id, ts, [tankId+ts], [tankId+bucket]',
      alerts: '++id, tankId, startedAt, resolvedAt, [tankId+startedAt]',
      runtime: 'tankId, status',
    });
  }
}

export const db = new TankDB();

export const RAW_RETENTION_MS = 48 * 3600_000;      // data mentah 48 jam
export const HISTORY_RETENTION_MS = 31 * 86_400_000; // riwayat ringkas 31 hari

export async function addReading(r: Reading) {
  await db.readings.add({ ...r, bucket: 1 });
}

export async function recentReadings(tankId: string, sinceMs: number): Promise<Reading[]> {
  const from = Date.now() - sinceMs;
  return db.readings
    .where('[tankId+ts]')
    .between([tankId, from], [tankId, Dexie.maxKey])
    .toArray();
}

/**
 * Meringkas data mentah lebih tua dari 48 jam menjadi satu titik per 5 menit,
 * lalu membuang yang lewat 31 hari.
 *
 * Tanpa ini, 5 tanki dengan interval 30 detik menghasilkan sekitar 430.000
 * baris per bulan. Setelah diringkas tinggal sekitar 43.000 — nyaman untuk
 * IndexedDB di ponsel dan cukup detail untuk grafik satu bulan.
 */
export async function compactHistory(now = Date.now()) {
  const rawCutoff = now - RAW_RETENTION_MS;
  const oldRaw = await db.readings
    .where('ts').below(rawCutoff)
    .and((r) => (r.bucket ?? 1) === 1)
    .toArray();

  if (oldRaw.length) {
    const buckets = new Map<string, Reading[]>();
    for (const r of oldRaw) {
      const slot = Math.floor(r.ts / 300_000) * 300_000;
      const key = `${r.tankId}|${slot}`;
      const arr = buckets.get(key);
      if (arr) arr.push(r); else buckets.set(key, [r]);
    }

    const summarised: Reading[] = [];
    for (const [key, group] of buckets) {
      const [tankId, slot] = key.split('|');
      // Simpan nilai maksimum di tiap slot. Untuk rantai dingin, puncak suhu
      // adalah angka yang menentukan mutu — rata-rata justru menyembunyikannya.
      const temp = Math.max(...group.map((g) => g.temp));
      summarised.push({ tankId, ts: Number(slot), temp, bucket: 5 });
    }

    await db.transaction('rw', db.readings, async () => {
      await db.readings.bulkDelete(oldRaw.map((r) => r.id!).filter(Boolean));
      await db.readings.bulkAdd(summarised);
    });
  }

  await db.readings.where('ts').below(now - HISTORY_RETENTION_MS).delete();
  await db.alerts.where('startedAt').below(now - HISTORY_RETENTION_MS).delete();
}

export async function openAlert(rec: Omit<AlertRecord, 'id'>) {
  const existing = await db.alerts
    .where('tankId').equals(rec.tankId)
    .and((a) => !a.resolvedAt && a.code === rec.code)
    .first();
  if (existing) return existing.id!;
  return db.alerts.add(rec as AlertRecord);
}

export async function resolveOpenAlerts(tankId: string, at = Date.now()) {
  const open = await db.alerts
    .where('tankId').equals(tankId)
    .and((a) => !a.resolvedAt)
    .toArray();
  await Promise.all(open.map((a) => db.alerts.update(a.id!, { resolvedAt: at })));
}
