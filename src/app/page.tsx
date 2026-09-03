'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import TankDeck from '@/components/TankDeck';
import TankListRow from '@/components/TankListRow';
import ViewToggle, { type DashView } from '@/components/ViewToggle';
import { useTanks } from '@/hooks/useTankData';

function Dashboard() {
  const tanks = useTanks();
  const params = useSearchParams();
  const [view, setView] = useState<DashView>('card');

  if (!tanks) return null;

  if (tanks.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 pt-16 text-center">
        <h1 className="text-[22px] font-semibold">Belum ada tanki terdaftar</h1>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          Tambahkan tanki dan cocokkan namanya dengan ID yang dikirim perangkat ESP32.
        </p>
        <Link
          href="/devices"
          className="mt-6 rounded-full px-6 py-3 text-[15px] font-semibold"
          style={{ background: 'var(--ice)', color: 'var(--ink)' }}
        >
          Tambah tanki
        </Link>
      </div>
    );
  }

  return (
    <div className={view === 'card' ? 'flex min-h-0 flex-1 flex-col' : ''}>
      <ViewToggle value={view} onChange={setView} />
      {view === 'card' ? (
        <TankDeck tanks={tanks} initialId={params.get('tank') ?? undefined} />
      ) : (
        <div className="flex flex-col gap-2 px-5 pt-1 pb-4">
          {tanks.map((t) => (
            <Link key={t.id} href={`/?tank=${t.id}`} onClick={() => setView('card')}>
              <TankListRow tank={t} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
