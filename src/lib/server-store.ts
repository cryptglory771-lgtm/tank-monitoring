import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Tank } from './types';

/**
 * Penyimpanan sisi server untuk konfigurasi tanki dan langganan notifikasi.
 * Data telemetri tetap tinggal di IndexedDB ponsel — ini cuma metadata kecil.
 *
 * Dua mode, dipilih otomatis dari env var:
 * - **Vercel KV / Upstash Redis** (kalau `KV_REST_API_URL`+`KV_REST_API_TOKEN`
 *   atau `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN` ada). WAJIB dipakai
 *   di Vercel — filesystem-nya read-only di produksi, `fs.writeFile` akan gagal
 *   dan /api/push/subscribe akan selalu menolak ("Server menolak langganan
 *   notifikasi."). Tinggal tambah integrasi "KV"/"Upstash" dari tab Storage
 *   di dashboard Vercel, env var-nya otomatis terisi, lalu redeploy.
 * - **Berkas JSON lokal** (`data/store.json`) — dipakai kalau env var di atas
 *   tidak ada, cocok untuk VPS yang punya disk persisten sungguhan.
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

const EMPTY: StoreShape = { tanks: [], subscriptions: [] };
const KV_KEY = 'tank-monitoring:store';

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// ------------------------------------------------------------------- backend KV

async function kvRead(): Promise<StoreShape> {
  const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV GET gagal: HTTP ${res.status}`);
  const { result } = (await res.json()) as { result: string | null };
  if (!result) return { ...EMPTY };
  try {
    return { ...EMPTY, ...JSON.parse(result) };
  } catch {
    return { ...EMPTY };
  }
}

async function kvWrite(data: StoreShape) {
  const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`KV SET gagal: HTTP ${res.status}`);
}

// --------------------------------------------------------------- backend berkas

const FILE = path.join(process.cwd(), 'data', 'store.json');

async function fileRead(): Promise<StoreShape> {
  try {
    return { ...EMPTY, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch {
    return { ...EMPTY };
  }
}

async function fileWrite(data: StoreShape) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

// ------------------------------------------------------------------------ API

const useKv = Boolean(KV_URL && KV_TOKEN);

async function read(): Promise<StoreShape> {
  return useKv ? kvRead() : fileRead();
}

async function write(data: StoreShape) {
  return useKv ? kvWrite(data) : fileWrite(data);
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
