'use client';

import { parseClock } from '@/lib/alert-engine';
import type { AlertRules, Reading } from '@/lib/types';

/**
 * Riwayat 12 jam terakhir. Jendela pengisian diarsir supaya dua gundukan
 * harian terbaca sebagai kejadian terjadwal, bukan anomali.
 */
export default function Sparkline({
  readings, rules, hours = 12, height = 76, color = 'var(--cream)',
}: {
  readings: Reading[];
  rules: AlertRules;
  hours?: number;
  height?: number;
  color?: string;
}) {
  const w = 320;
  const h = height;
  const now = Date.now();
  const from = now - hours * 3600_000;
  const pts = readings.filter((r) => r.ts >= from).sort((a, b) => a.ts - b.ts);

  const lo = Math.min(rules.targetMin - 1, ...pts.map((p) => p.temp), 0);
  const hi = Math.max(rules.criticalHigh + 1, ...pts.map((p) => p.temp));
  const x = (ts: number) => ((ts - from) / (now - from)) * w;
  const y = (t: number) => h - ((t - lo) / Math.max(0.5, hi - lo)) * h;

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ts).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ');
  const area = pts.length ? `M${x(pts[0].ts).toFixed(1)},${h} ${line.slice(1)} L${x(pts[pts.length - 1].ts).toFixed(1)},${h} Z` : '';

  // Arsir tiap jendela pengisian yang jatuh di dalam rentang 12 jam ini.
  const bands: Array<{ x: number; w: number }> = [];
  for (const win of rules.fillWindows) {
    const startMin = parseClock(win.start);
    for (let d = -1; d <= 0; d++) {
      const base = new Date(now);
      base.setDate(base.getDate() + d);
      base.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
      const s = base.getTime();
      const e = s + win.durationMinutes * 60_000;
      if (e < from || s > now) continue;
      const xs = Math.max(0, x(s));
      bands.push({ x: xs, w: Math.min(w, x(e)) - xs });
    }
  }

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {bands.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={Math.max(2, b.w)} height={h} fill="var(--dusk)" opacity="0.16" />
      ))}
      <rect x="0" y={y(rules.targetMax)} width={w} height={Math.max(1.5, y(rules.targetMin) - y(rules.targetMax))}
            fill="var(--ice)" opacity="0.14" />
      <line x1="0" x2={w} y1={y(rules.warnHigh)} y2={y(rules.warnHigh)}
            stroke="var(--amber)" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
      {area && <path d={area} fill={color} opacity="0.08" />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />}
    </svg>
  );
}
