'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAllAlertHistory } from '@/hooks/useTankData';
import { relativeTime } from '@/lib/format';
import type { AlertRecord } from '@/lib/types';

export default function AlertsPage() {
  const alerts = useAllAlertHistory(150);
  const tanks = useLiveQuery(() => db.tanks.toArray(), []) ?? [];
  const tankName = (id: string) => tanks.find((t) => t.id === id)?.name ?? id;

  const active = alerts.filter((a) => !a.resolvedAt);
  const past = alerts.filter((a) => a.resolvedAt);

  return (
    <div className="pb-8">
      <div className="px-5 pb-2.5 pt-4 text-[11px] tracking-wide" style={{ color: 'var(--muted-2)' }}>
        RIWAYAT ALERT
      </div>

      {alerts.length === 0 ? (
        <p className="px-5 text-[14px]" style={{ color: 'var(--muted)' }}>
          Belum ada alert warning atau critical dari tanki manapun.
        </p>
      ) : (
        <div className="flex flex-col gap-5 px-5">
          {active.length > 0 && (
            <Section title={`Aktif (${active.length})`}>
              {active.map((a) => (
                <AlertRow key={a.id} alert={a} tankName={tankName(a.tankId)} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Selesai">
              {past.map((a) => (
                <AlertRow key={a.id} alert={a} tankName={tankName(a.tankId)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] tracking-wide" style={{ color: 'var(--muted-2)' }}>{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function AlertRow({ alert, tankName }: { alert: AlertRecord; tankName: string }) {
  const color = `var(--s-${alert.severity})`;
  const dim = `var(--s-${alert.severity}-dim)`;

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border px-4 py-3.5"
      style={{ background: 'var(--steel)', borderColor: 'var(--line-soft)' }}
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13.5px] font-medium">{tankName}</span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: dim, color }}
          >
            {alert.severity === 'critical' ? 'Kritis' : 'Peringatan'}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--cream)' }}>{alert.message}</p>
        <p className="mt-1 text-[10.5px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>
          {relativeTime(alert.startedAt)}
          {alert.resolvedAt ? ` · selesai ${relativeTime(alert.resolvedAt)}` : ' · masih aktif'}
        </p>
      </div>
      {alert.temp !== null && (
        <span className="reading mt-0.5 shrink-0 text-[13px]" style={{ color }}>{alert.temp.toFixed(1)}°</span>
      )}
    </div>
  );
}
