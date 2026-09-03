import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Tank } from './types';

/**
 * Penyimpanan sisi server yang sengaja dibuat sederhana: satu berkas JSON.
 * Isinya hanya konfigurasi tanki dan langganan notifikasi — data telemetri
 * tetap tinggal di IndexedDB ponsel. Kalau nanti tanki bertambah banyak,
 * ganti modul ini dengan Postgres tanpa menyentuh bagian lain.
 */

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
  userAgent?: string;
}

interface StoreShape {
  tanks: Tank[];
  subscriptions: PushSubscriptionRecord[];
}

const FILE = path.join(process.cwd(), 'data', 'store.json');
const EMPTY: StoreShape = { tanks: [], subscriptions: [] };

async function read(): Promise<StoreShape> {
  try {
    return { ...EMPTY, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch {
    return { ...EMPTY };
  }
}

async function write(data: StoreShape) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

export async function getStore() {
  return read();
}

export async function saveTanks(tanks: Tank[]) {
  const s = await read();
  s.tanks = tanks;
  await write(s);
}

export async function saveSubscription(sub: PushSubscriptionRecord) {
  const s = await read();
  s.subscriptions = s.subscriptions.filter((x) => x.endpoint !== sub.endpoint);
  s.subscriptions.push(sub);
  await write(s);
}

export async function removeSubscriptions(endpoints: string[]) {
  if (!endpoints.length) return;
  const s = await read();
  s.subscriptions = s.subscriptions.filter((x) => !endpoints.includes(x.endpoint));
  await write(s);
}
