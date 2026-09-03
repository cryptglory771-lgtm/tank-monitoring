'use client';

import mqtt, { type MqttClient } from 'mqtt';

/**
 * Satu koneksi MQTT dipakai bersama seluruh halaman. Next.js App Router
 * akan me-mount ulang komponen cukup sering; membuat koneksi per komponen
 * akan menghabiskan kuota sesi HiveMQ Cloud.
 */

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface Telemetry {
  tankId: string;
  temp: number;
  ts: number;
  rssi?: number;
}

type TelemetryHandler = (t: Telemetry) => void;
type StateHandler = (s: ConnectionState, detail?: string) => void;

const PREFIX = process.env.NEXT_PUBLIC_MQTT_TOPIC_PREFIX || 'susu';

let client: MqttClient | null = null;
let state: ConnectionState = 'idle';
const telemetryHandlers = new Set<TelemetryHandler>();
const stateHandlers = new Set<StateHandler>();

function setState(s: ConnectionState, detail?: string) {
  state = s;
  stateHandlers.forEach((h) => h(s, detail));
}

/** Terima ISO string, epoch detik, atau epoch milidetik; kosong -> waktu terima. */
function parseTs(raw: unknown): number {
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const n = Number(raw ?? 0);
  if (n > 1e12) return n;
  if (n > 0) return n * 1000;
  return Date.now();
}

/**
 * Payload yang diharapkan dari perangkat:
 *   topic:   susu/{tankId}/suhu
 *   payload: {"suhu": 4.5, "ts": "2026-09-01T10:30:00Z"}
 * `ts` opsional (ISO string atau epoch detik/milidetik); kalau kosong dipakai waktu terima.
 */
function parse(topic: string, payload: Buffer): Telemetry | null {
  const parts = topic.split('/');
  const tankId = parts[parts.length - 2];
  if (!tankId) return null;
  try {
    const raw = JSON.parse(payload.toString());
    const temp = Number(raw.suhu ?? raw.t ?? raw.temp ?? raw.temperature);
    if (!Number.isFinite(temp)) return null;
    const ts = parseTs(raw.ts);
    return { tankId, temp, ts, rssi: raw.rssi };
  } catch {
    // Firmware sederhana kadang mengirim angka polos, bukan JSON.
    const temp = Number(payload.toString());
    return Number.isFinite(temp) ? { tankId, temp, ts: Date.now() } : null;
  }
}

export function connectMqtt(): MqttClient | null {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_MQTT_URL;
  if (!url) {
    setState('error', 'NEXT_PUBLIC_MQTT_URL belum diisi.');
    return null;
  }

  setState('connecting');
  client = mqtt.connect(url, {
    username: process.env.NEXT_PUBLIC_MQTT_USERNAME,
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
    clientId: `pwa-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 4000,
    connectTimeout: 15_000,
    protocolVersion: 5,
  });

  client.on('connect', () => {
    setState('connected');
    client?.subscribe(`${PREFIX}/+/suhu`, { qos: 1 });
  });
  client.on('reconnect', () => setState('reconnecting'));
  client.on('close', () => { if (state === 'connected') setState('reconnecting'); });
  client.on('error', (err) => setState('error', err.message));
  client.on('message', (topic, payload) => {
    const t = parse(topic, payload as Buffer);
    if (t) telemetryHandlers.forEach((h) => h(t));
  });

  return client;
}

export function onTelemetry(h: TelemetryHandler): () => void {
  telemetryHandlers.add(h);
  return () => { telemetryHandlers.delete(h); };
}

export function onConnectionState(h: StateHandler): () => void {
  stateHandlers.add(h);
  h(state);
  return () => { stateHandlers.delete(h); };
}

export function getConnectionState() {
  return state;
}
