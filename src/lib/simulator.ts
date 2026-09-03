'use client';

import { db } from './db';
import { parseClock } from './alert-engine';
import { DEFAULT_RULES, type Reading, type Tank } from './types';

/**
 * Membuat tanki contoh berisi tiga hari data buatan, lengkap dengan dua
 * siklus pengisian harian. Berguna untuk menguji tampilan dan ambang alert
 * sebelum perangkat terpasang di kandang.
 */
export async function seedDemoTank(id = 'demo-tank') {
  const existing = await db.tanks.get(id);
  if (!existing) {
    const tank: Tank = {
      id,
      name: 'Tanki Contoh',
      location: 'Data buatan',
      capacityLiters: 2000,
      rules: structuredClone(DEFAULT_RULES),
      createdAt: Date.now(),
    };
    await db.tanks.add(tank);
  }
  await db.readings.where('tankId').equals(id).delete();

  const rules = DEFAULT_RULES;
  const now = Date.now();
  const start = now - 3 * 86_400_000;
  const step = 60_000;
  const rows: Reading[] = [];

  let temp = 1.6;
  for (let ts = start; ts <= now; ts += step) {
    const d = new Date(ts);
    const minuteOfDay = d.getHours() * 60 + d.getMinutes();

    let filling = false;
    for (const w of rules.fillWindows) {
      const s = parseClock(w.start);
      if (minuteOfDay >= s && minuteOfDay < s + w.durationMinutes) filling = true;
    }

    if (filling) {
      // Susu segar masuk pada suhu tubuh, menarik suhu tanki naik.
      temp += (34 - temp) * 0.02;
    } else if (temp > rules.targetMin + 0.6) {
      // Pendinginan mendekati eksponensial menuju batas bawah target.
      temp += (rules.targetMin + 0.4 - temp) * 0.018;
    } else {
      temp += (1.4 - temp) * 0.01;
    }
    temp += (Math.random() - 0.5) * 0.08; // derau thermocouple

    rows.push({ tankId: id, ts, temp: Math.round(temp * 100) / 100, bucket: 1 });
  }

  await db.readings.bulkAdd(rows);
  return id;
}
