'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import { db } from '@/lib/db';
import { evaluate } from '@/lib/alert-engine';
import type { AlertRecord, Evaluation, Reading, Tank, TankStatus } from '@/lib/types';

/** Detak jam bersama, agar status tetap berubah walau data berhenti masuk. */
function useTick(ms = 15_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useTanks(): Tank[] | undefined {
  return useLiveQuery(
    () => db.tanks.filter((t) => !t.archived).toArray().then((r) => r.sort((a, b) => a.createdAt - b.createdAt)),
    [],
  );
}

export function useReadings(tankId: string, windowMs: number): Reading[] {
  useTick(20_000);
  const rows = useLiveQuery(async () => {
    const from = Date.now() - windowMs;
    return db.readings
      .where('[tankId+ts]')
      .between([tankId, from], [tankId, Dexie.maxKey])
      .toArray();
  }, [tankId, windowMs]);
  return useMemo(() => (rows ?? []).sort((a, b) => a.ts - b.ts), [rows]);
}

/** Riwayat alert terbaru untuk satu tanki, terbaru lebih dulu. */
export function useAlertHistory(tankId: string, limit = 5): AlertRecord[] {
  return useLiveQuery(
    () => db.alerts.where('tankId').equals(tankId).reverse().sortBy('startedAt').then((r) => r.slice(0, limit)),
    [tankId, limit],
  ) ?? [];
}

/**
 * Menilai satu tanki dengan mesin yang sama dengan worker di server, lalu
 * mencatat status terakhir agar histeresis pemulihan punya acuan.
 */
export function useEvaluation(tank: Tank, readings: Reading[]): Evaluation {
  const previous = useRef<TankStatus | null>(null);
  const result = useMemo(
    () => evaluate({ rules: tank.rules, readings, now: Date.now(), previousStatus: previous.current }),
    [tank.rules, readings],
  );
  useEffect(() => {
    previous.current = result.status;
    db.runtime.put({
      tankId: tank.id,
      status: result.status,
      code: result.code,
      since: Date.now(),
      lastTemp: readings.length ? readings[readings.length - 1].temp : null,
      lastSeen: readings.length ? readings[readings.length - 1].ts : null,
      trendPerHour: result.trendPerHour,
      etaToTarget: result.etaToTarget,
    }).catch(() => {});
  }, [result, tank.id, readings]);
  return result;
}
