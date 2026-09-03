'use client';

/**
 * Cincin gauge 270°, dipakai di kartu tanki dan baris daftar. Rentang skala
 * mengikuti ambang tanki itu sendiri, jadi posisi busur tetap bermakna
 * walau tiap tanki punya ambang yang berbeda.
 */
export default function CircularGauge({
  temp, color, min, max, size = 132, stroke = 8,
}: {
  temp: number | null;
  color: string;
  min: number;
  max: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;

  if (temp === null) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={stroke} />
      </svg>
    );
  }

  const pct = Math.max(0, Math.min(1, (temp - min) / (max - min)));
  const offset = arc * (1 - pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-210deg)' }}>
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={stroke}
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(.22,.61,.36,1)' }}
      />
    </svg>
  );
}
