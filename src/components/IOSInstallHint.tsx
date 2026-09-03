'use client';

import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '@/lib/push-client';

const DISMISS_KEY = 'ios-install-hint-dismissed';

/**
 * Safari iOS tidak pernah menyediakan prompt instal otomatis (event
 * `beforeinstallprompt` cuma ada di Chromium) — satu-satunya jalan pasang
 * PWA di iPhone selalu manual lewat menu Bagikan. Banner ini menutup celah
 * itu: tanpa ini, user iOS tidak akan pernah tahu app-nya bisa dipasang.
 */
export default function IOSInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="mx-5 mb-1 flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--ice-dim)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ice)" strokeWidth="1.8" className="mt-0.5 shrink-0">
        <path d="M12 3v13" strokeLinecap="round" />
        <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="flex-1 text-[12.5px] leading-snug" style={{ color: 'var(--cream)' }}>
        Pasang aplikasi ini di iPhone: ketuk <b>Bagikan</b>, lalu pilih{' '}
        <b>&quot;Tambahkan ke Layar Utama&quot;</b>. Notifikasi alert baru bisa aktif setelah dipasang.
      </p>
      <button
        onClick={dismiss}
        aria-label="Tutup"
        className="shrink-0 text-[16px] leading-none"
        style={{ color: 'var(--muted-2)' }}
      >
        ×
      </button>
    </div>
  );
}
