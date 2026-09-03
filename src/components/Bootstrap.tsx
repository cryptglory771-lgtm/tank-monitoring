'use client';

import { useEffect } from 'react';
import { connectMqtt, onTelemetry } from '@/lib/mqtt-client';
import { addReading, compactHistory, db } from '@/lib/db';
import { registerServiceWorker } from '@/lib/push-client';

/**
 * Dipasang sekali di layout. Menyalakan koneksi MQTT, menyimpan tiap
 * pembacaan ke IndexedDB, dan menjalankan pemadatan riwayat berkala.
 * Komponen ini tidak menggambar apa pun.
 */
export default function Bootstrap() {
  useEffect(() => {
    registerServiceWorker();
    connectMqtt();

    const off = onTelemetry(async (t) => {
      // Abaikan telemetri dari tanki yang belum terdaftar, supaya perangkat
      // uji coba di jaringan yang sama tidak mengotori riwayat.
      const known = await db.tanks.get(t.tankId);
      if (!known || known.archived) return;
      await addReading({ tankId: t.tankId, ts: t.ts, temp: t.temp, rssi: t.rssi });
    });

    compactHistory().catch(() => {});
    const timer = setInterval(() => compactHistory().catch(() => {}), 30 * 60_000);

    return () => { off(); clearInterval(timer); };
  }, []);

  return null;
}
