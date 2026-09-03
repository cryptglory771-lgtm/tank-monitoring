'use client';

import { useAlertHistory } from '@/hooks/useTankData';
import { relativeTime } from '@/lib/format';

export default function AlertHistoryList({ tankId }: { tankId: string }) {
  const alerts = useAlertHistory(tankId, 5);
  if (!alerts.length) return null;

  return (
    <div className="mt-3 max-h-[150px] overflow-y-auto">
      <p className="mb-1.5 text-[11px] tracking-wide" style={{ color: 'var(--muted-2)' }}>RIWAYAT ALERT</p>
      <div className="flex flex-col gap-1.5">
        {alerts.map((a) => {
          const color = `var(--s-${a.severity})`;
          return (
            <div
              key={a.id}
              className="flex items-start gap-2.5 rounded-xl px-3 py-2"
              style={{ background: 'var(--ink)', border: '0.5px solid var(--line-soft)' }}
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] leading-snug" style={{ color: 'var(--cream)' }}>{a.message}</p>
                <p className="mt-0.5 text-[10.5px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>
                  {relativeTime(a.startedAt)}{a.resolvedAt ? ' · selesai' : ' · aktif'}
                </p>
              </div>
              {a.temp !== null && (
                <span className="reading shrink-0 text-[12.5px]" style={{ color }}>{a.temp.toFixed(1)}°</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
