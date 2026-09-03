'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import ConnectionBanner from '@/components/ConnectionBanner';
import IOSInstallHint from '@/components/IOSInstallHint';
import TabBar from './TabBar';

/**
 * Chrome yang tampil di setiap layar: bilah atas dengan ringkasan status,
 * area konten yang bisa digulir, dan navigasi bawah. Dipasang sekali di
 * root layout supaya tiap rute tidak perlu membangun ulang cangkangnya.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const tanks = useLiveQuery(() => db.tanks.filter((t) => !t.archived).toArray(), []) ?? [];
  const runtime = useLiveQuery(() => db.runtime.toArray(), []) ?? [];
  const criticalCount = runtime.filter((r) => r.status === 'critical').length;

  return (
    <div className="app-shell">
      <div className="app-scroll">
        <header
          className="flex items-center justify-between gap-3 px-5 pb-3"
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative h-[26px] w-[26px] shrink-0 rounded-[7px]" style={{ background: 'var(--ice)' }}>
              <span
                className="absolute rounded-[3px]"
                style={{ inset: 6, background: 'var(--ink)' }}
              />
            </div>
            <span className="text-[16px] font-semibold tracking-tight">Cooling Tank</span>
          </div>
          {tanks.length > 0 && (
            <span
              className="rounded-full border px-2.5 py-[5px] text-[11px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', background: 'var(--steel)', borderColor: 'var(--line-soft)' }}
            >
              {tanks.length} tanki
              {criticalCount > 0 && (
                <>
                  {' '}· <b className="font-medium" style={{ color: 'var(--ember)' }}>{criticalCount} kritis</b>
                </>
              )}
            </span>
          )}
        </header>

        <IOSInstallHint />
        <ConnectionBanner />

        {children}
      </div>

      <TabBar />
    </div>
  );
}
