'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import AddTankSheet from '@/components/AddTankSheet';
import { STATUS_LABEL, relativeTime } from '@/lib/format';

export default function DevicesPage() {
  const tanks = useLiveQuery(() => db.tanks.filter((t) => !t.archived).toArray(), []) ?? [];
  const runtime = useLiveQuery(() => db.runtime.toArray(), []) ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="pb-6">
      <div className="px-5 pb-2.5 pt-4 text-[11px] tracking-wide" style={{ color: 'var(--muted-2)' }}>
        TANKI &amp; PERANGKAT
      </div>

      <div className="flex flex-col gap-2 px-5">
        {tanks.map((t) => {
          const rt = runtime.find((r) => r.tankId === t.id);
          const status = rt?.status ?? 'offline';
          const color = `var(--s-${status})`;
          const online = status !== 'offline';
          return (
            <Link
              key={t.id}
              href={`/devices/${t.id}`}
              className="flex items-center gap-3 rounded-2xl border px-3.5 py-3.5"
              style={{ background: 'var(--steel)', borderColor: 'var(--line-soft)' }}
            >
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
                style={{ background: `var(--s-${status}-dim)` }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{t.name}</span>
                <span className="mt-0.5 block text-[10.5px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)' }}>
                  {t.id}
                </span>
              </span>
              <span className="text-right">
                <span className="reading block text-[15px]">
                  {rt?.lastTemp != null ? `${rt.lastTemp.toFixed(1)}°` : '—'}
                </span>
                <span className="mt-0.5 block text-[10px]" style={{ color: online ? 'var(--ok)' : 'var(--muted-2)' }}>
                  {STATUS_LABEL[status]} · {relativeTime(rt?.lastSeen ?? null)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => setSheetOpen(true)}
        className="mx-5 mt-3.5 flex items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-[13px]"
        style={{ borderColor: 'var(--line)', color: 'var(--muted)', width: 'calc(100% - 40px)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Tambah tanki / perangkat
      </button>

      {sheetOpen && <AddTankSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
