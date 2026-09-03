export function relativeTime(ts: number | null, now = Date.now()): string {
  if (!ts) return 'belum ada data';
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'baru saja';
  if (s < 3600) return `${Math.round(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  return `${Math.round(s / 86400)} hari lalu`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function trendLabel(perHour: number | null): string {
  if (perHour === null) return 'tren belum terbaca';
  if (Math.abs(perHour) < 0.15) return 'suhu stabil';
  const arrow = perHour < 0 ? 'turun' : 'naik';
  return `${arrow} ${Math.abs(perHour).toFixed(1)} °C per jam`;
}

/** Jadwal pengisian yang paling baru terlewati, relatif ke sekarang. */
export function lastFillTime(fillWindows: { start: string }[], now = new Date()): string | null {
  if (!fillWindows.length) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const starts = fillWindows.map((w) => {
    const [h, m] = w.start.split(':').map(Number);
    return h * 60 + m;
  });
  const past = starts.filter((s) => s <= nowMin);
  const minute = past.length ? Math.max(...past) : Math.max(...starts);
  const h = Math.floor(minute / 60).toString().padStart(2, '0');
  const m = (minute % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export const STATUS_LABEL: Record<string, string> = {
  normal: 'Aman',
  filling: 'Pengisian',
  cooling: 'Mendinginkan',
  warning: 'Perlu dicek',
  critical: 'Kritis',
  offline: 'Tidak terhubung',
};
