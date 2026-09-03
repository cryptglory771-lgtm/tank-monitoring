'use client';

import CircularGauge from './CircularGauge';
import { useEvaluation, useReadings } from '@/hooks/useTankData';
import { STATUS_LABEL, lastFillTime } from '@/lib/format';
import type { Tank } from '@/lib/types';

export default function TankListRow({ tank }: { tank: Tank }) {
  const trail = useReadings(tank.id, 90 * 60_000);
  const view = useEvaluation(tank, trail);
  const temp = trail.length ? trail[trail.length - 1].temp : null;
  const color = `var(--s-${view.status})`;
  const gaugeMin = Math.min(tank.rules.criticalLow - 1, tank.rules.targetMin - 2);
  const gaugeMax = tank.rules.criticalHigh + 6;
  const fill = lastFillTime(tank.rules.fillWindows);

  return (
    <div className="flex items-center gap-3 rounded-2xl border px-4 py-3.5" style={{ background: 'var(--steel)', borderColor: 'var(--line-soft)' }}>
      <div className="h-11 w-11 shrink-0">
        <CircularGauge temp={temp} color={color} min={gaugeMin} max={gaugeMax} size={44} stroke={5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium">{tank.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          {tank.id}{fill ? ` · isi ${fill}` : ''}
        </div>
      </div>
      <div className="text-right">
        <div className="reading text-[19px]">{temp !== null ? `${temp.toFixed(1)}°` : '—'}</div>
        <div className="mt-0.5 text-[10px]" style={{ color }}>{STATUS_LABEL[view.status]}</div>
      </div>
    </div>
  );
}
