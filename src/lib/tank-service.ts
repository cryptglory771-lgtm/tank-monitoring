'use client';

import { db } from './db';
import { DEFAULT_RULES, type Tank } from './types';

/** Kirim seluruh konfigurasi ke server agar worker memakai aturan yang sama. */
export async function syncTanksToServer() {
  const tanks = await db.tanks.toArray();
  try {
    await fetch('/api/tanks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tanks }),
    });
  } catch {
    // Offline. Sinkronisasi akan terjadi lagi pada penyimpanan berikutnya.
  }
}

export async function createTank(input: { id: string; name: string; location?: string; capacityLiters?: number }) {
  const tank: Tank = {
    ...input,
    rules: structuredClone(DEFAULT_RULES),
    createdAt: Date.now(),
  };
  await db.tanks.add(tank);
  await syncTanksToServer();
  return tank;
}

export async function updateTank(id: string, patch: Partial<Tank>) {
  await db.tanks.update(id, patch);
  await syncTanksToServer();
}

export async function archiveTank(id: string) {
  await db.tanks.update(id, { archived: true });
  await syncTanksToServer();
}
