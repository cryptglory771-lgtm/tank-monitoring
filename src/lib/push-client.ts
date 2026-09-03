'use client';

/** Registrasi service worker dan langganan Web Push. */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export type PushSetupResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function enablePush(): Promise<PushSetupResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'Peramban ini tidak mendukung notifikasi latar belakang.' };
  }
  // iOS hanya mengizinkan push setelah PWA dipasang ke layar utama.
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && !standalone) {
    return { ok: false, reason: 'Di iPhone, tambahkan dulu aplikasi ini ke Layar Utama lewat menu Bagikan.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Izin notifikasi ditolak. Ubah lewat pengaturan situs di peramban.' };
  }

  const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { ok: false, reason: 'Kunci VAPID belum dikonfigurasi di server.' };

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) return { ok: false, reason: 'Server menolak langganan notifikasi.' };
  return { ok: true };
}

export async function pushEnabled(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub) && Notification.permission === 'granted';
}
