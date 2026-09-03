'use client';

import Link from 'next/link';
import AlertHistoryList from './AlertHistoryList';
import CircularGauge from './CircularGauge';
import Sparkline from './Sparkline';
import { useEvaluation, useReadings } from '@/hooks/useTankData';
import { STATUS_LABEL, lastFillTime, relativeTime } from '@/lib/format';
import type { Tank } from '@/lib/types';

export default function TankCard({ tank }: { tank: Tank }) {
  const trail = useReadings(tank.id, 90 * 60_000);
  const day = useReadings(tank.id, 12 * 3600_000);
  const view = useEvaluation(tank, trail);

  const last = trail.length ? trail[trail.length - 1] : null;
  const temp = last?.temp ?? null;
  const color = `var(--s-${view.status})`;
  const dim = `var(--s-${view.status}-dim)`;
  const gaugeMin = Math.min(tank.rules.criticalLow - 1, tank.rules.targetMin - 2);
  const gaugeMax = tank.rules.criticalHigh + 6;

  return (
    <div className="h-full px-5">
      <div
        className="flex h-full flex-col rounded-[20px] border px-5 pb-5 pt-[22px]"
        style={{ background: 'var(--steel)', borderColor: 'var(--line-soft)' }}
      >
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-semibold leading-tight">{tank.name}</h2>
            <p className="mt-0.5 text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>{tank.id}</p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-[5px] rounded-full px-2.5 py-[5px] text-[11px] font-medium"
            style={{ background: dim, color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {STATUS_LABEL[view.status]}
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <CircularGauge temp={temp} color={color} min={gaugeMin} max={gaugeMax} size={200} stroke={12} />
          <div className="absolute text-center">
            <div className="reading text-[52px]" style={{ color: 'var(--cream)' }}>
              {temp === null ? '—' : temp.toFixed(1)}
            </div>
            <div className="mt-1.5 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>
              {temp === null ? 'tidak ada sinyal' : '°C'}
            </div>
          </div>
        </div>

        <div className="mb-3.5 flex justify-between px-1.5 text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>
          <span>Peringatan <b className="font-medium" style={{ color: 'var(--muted)' }}>{tank.rules.warnHigh}°C</b></span>
          <span>Kritis <b className="font-medium" style={{ color: 'var(--muted)' }}>{tank.rules.criticalHigh}°C</b></span>
        </div>

        <Sparkline readings={day} rules={tank.rules} color={color} height={52} />

        <AlertHistoryList tankId={tank.id} />

        <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11.5px]" style={{ borderColor: 'var(--line-soft)', color: 'var(--muted)' }}>
          <span>{tank.id} · {relativeTime(last?.ts ?? null)}</span>
          {lastFillTime(tank.rules.fillWindows) && <span>Isi terakhir {lastFillTime(tank.rules.fillWindows)}</span>}
        </div>

        {(view.status === 'filling' || view.status === 'cooling') && (
          <div
            className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px]"
            style={{ background: 'var(--ice-dim)', color: 'var(--ice)' }}
          >
            {view.message}
          </div>
        )}

        <Link
          href={`/devices/${tank.id}`}
          className="mt-3 block text-center text-[12px]"
          style={{ color: 'var(--muted-2)' }}
        >
          Atur ambang &amp; jadwal
        </Link>
      </div>
    </div>
  );
}
