'use client';

import { useEffect, useState } from 'react';
import { onConnectionState, type ConnectionState } from '@/lib/mqtt-client';
import { enablePush, pushEnabled } from '@/lib/push-client';

const COPY: Partial<Record<ConnectionState, string>> = {
  connecting: 'Menyambung ke broker…',
  reconnecting: 'Sambungan terputus. Mencoba menyambung ulang.',
  error: 'Gagal menyambung ke broker.',
};

/**
 * Satu baris tipis di atas layar. Hanya muncul kalau ada yang perlu
 * dikerjakan operator — sambungan putus, atau notifikasi belum dinyalakan.
 */
export default function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>('idle');
  const [detail, setDetail] = useState<string>();
  const [needsPush, setNeedsPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => onConnectionState((s, d) => { setState(s); setDetail(d); }), []);
  useEffect(() => { pushEnabled().then((on) => setNeedsPush(!on)); }, []);

  async function turnOn() {
    const res = await enablePush();
    if (res.ok) { setNeedsPush(false); setPushError(null); }
    else setPushError(res.reason);
  }

  const message = COPY[state];

  if (!message && !needsPush) return null;

  return (
    <div className="px-5 pb-1">
      {message && (
        <p className="rounded-lg bg-[var(--steel-2)] px-3 py-2 text-[13px] text-[var(--cream)]">
          {message}{detail ? ` ${detail}` : ''}
        </p>
      )}
      {needsPush && (
        <div className="mt-1.5 flex items-center gap-3 rounded-lg bg-[var(--steel-2)] px-3 py-2">
          <p className="flex-1 text-[13px] leading-snug text-[var(--cream)]">
            {pushError ?? 'Nyalakan notifikasi agar peringatan tetap sampai saat aplikasi ditutup.'}
          </p>
          {!pushError && (
            <button onClick={turnOn} className="shrink-0 rounded-full bg-[var(--ice)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink)]">
              Nyalakan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
