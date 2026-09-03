import type {
  AlertCode,
  AlertRules,
  Evaluation,
  Reading,
  Severity,
  TankStatus,
} from './types';

/**
 * Mesin evaluasi status tanki.
 *
 * File ini sengaja bebas dependensi dan bebas DOM supaya bisa dipakai
 * dua-duanya: di browser (untuk warna kartu) dan di worker VPS (untuk push).
 * Kalau logika di sini berubah, layar dan notifikasi ikut berubah bersamaan.
 */

// ---------------------------------------------------------------- util waktu

/** "06:00" -> menit sejak tengah malam */
export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** Selisih melingkar: berapa menit sejak `startMin` hari ini (0..1439) */
function minutesSince(nowMin: number, startMin: number): number {
  const diff = nowMin - startMin;
  return diff < 0 ? diff + 1440 : diff;
}

export function inQuietHours(ts: number, quiet: AlertRules['quietHours']): boolean {
  if (!quiet) return false;
  const now = minutesOfDay(ts);
  const from = parseClock(quiet.from);
  const to = parseClock(quiet.to);
  return from <= to ? now >= from && now < to : now >= from || now < to;
}

// ------------------------------------------------------------ fase pengisian

export type FillPhase =
  | { phase: 'idle' }
  | { phase: 'filling'; windowStart: string; endsInMinutes: number }
  | { phase: 'cooling'; windowStart: string; elapsedMinutes: number; graceLeftMinutes: number };

/**
 * Menentukan apakah `now` berada di dalam jendela pengisian atau masa
 * pendinginan setelahnya. Inilah yang membuat kenaikan suhu jam 6 pagi dan
 * jam 5 sore tidak dianggap kerusakan.
 */
export function resolveFillPhase(now: number, rules: AlertRules): FillPhase {
  const nowMin = minutesOfDay(now);
  for (const w of rules.fillWindows) {
    const startMin = parseClock(w.start);
    const since = minutesSince(nowMin, startMin);
    if (since < w.durationMinutes) {
      return {
        phase: 'filling',
        windowStart: w.start,
        endsInMinutes: Math.round(w.durationMinutes - since),
      };
    }
    if (since < w.durationMinutes + w.graceMinutes) {
      return {
        phase: 'cooling',
        windowStart: w.start,
        elapsedMinutes: Math.round(since - w.durationMinutes),
        graceLeftMinutes: Math.round(w.durationMinutes + w.graceMinutes - since),
      };
    }
  }
  return { phase: 'idle' };
}

// ------------------------------------------------------------------ statistik

/** Regresi linier sederhana -> laju perubahan suhu dalam °C per jam. */
export function slopePerHour(readings: Reading[]): number | null {
  if (readings.length < 3) return null;
  const t0 = readings[0].ts;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const n = readings.length;
  for (const r of readings) {
    const x = (r.ts - t0) / 3_600_000; // jam
    sx += x; sy += r.temp; sxx += x * x; sxy += x * r.temp;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  return (n * sxy - sx * sy) / denom;
}

function within(readings: Reading[], now: number, ms: number): Reading[] {
  return readings.filter((r) => now - r.ts <= ms);
}

/**
 * True kalau `predicate` benar untuk SEMUA pembacaan dalam `sustainSeconds`
 * terakhir, dan rentang datanya memang cukup panjang. Ini yang menyaring
 * lonjakan sesaat akibat noise thermocouple atau pengaduk yang menyala.
 */
function sustained(
  readings: Reading[],
  now: number,
  sustainSeconds: number,
  predicate: (temp: number) => boolean,
): boolean {
  const win = within(readings, now, sustainSeconds * 1000);
  if (win.length === 0) return false;
  const span = win[win.length - 1].ts - win[0].ts;
  // Kalau device baru mulai kirim, jangan langsung teriak.
  if (span < sustainSeconds * 1000 * 0.6) return false;
  return win.every((r) => predicate(r.temp));
}

// ------------------------------------------------------------------ evaluasi

const MESSAGES: Record<AlertCode, (t: number | null, extra?: string) => string> = {
  above_target: (t) => `Suhu ${fmt(t)} di atas batas target dan tidak turun.`,
  high_temp: (t) => `Suhu ${fmt(t)} melewati ambang peringatan.`,
  critical_temp: (t) => `Suhu ${fmt(t)} sudah di zona kritis. Susu berisiko rusak.`,
  freezing: (t) => `Suhu ${fmt(t)} terlalu dingin. Risiko susu membeku di dinding tanki.`,
  cooling_stalled: (_t, extra) => `Suhu tidak turun setelah pengisian${extra ? ` (${extra})` : ''}. Periksa unit pendingin.`,
  cooling_timeout: (t) => `Batas waktu pendinginan habis, suhu masih ${fmt(t)}.`,
  unscheduled_rise: (_t, extra) => `Suhu naik mendadak di luar jadwal pengisian${extra ? ` (${extra})` : ''}.`,
  offline: (_t, extra) => `Tidak ada data masuk${extra ? ` selama ${extra}` : ''}. Periksa daya dan sinyal perangkat.`,
};

function fmt(t: number | null) {
  return t === null ? '—' : `${t.toFixed(1)} °C`;
}

const SEVERITY_OF: Record<AlertCode, Severity> = {
  above_target: 'warning',
  high_temp: 'warning',
  critical_temp: 'critical',
  freezing: 'critical',
  cooling_stalled: 'critical',
  cooling_timeout: 'critical',
  unscheduled_rise: 'warning',
  offline: 'critical',
};

export interface EvaluateInput {
  rules: AlertRules;
  /** Diurutkan menaik berdasarkan ts. Cukup 60–90 menit terakhir. */
  readings: Reading[];
  now: number;
  /** Status hasil evaluasi sebelumnya, untuk histeresis pemulihan. */
  previousStatus?: TankStatus | null;
}

export function evaluate({ rules, readings, now, previousStatus }: EvaluateInput): Evaluation {
  const last = readings.length ? readings[readings.length - 1] : null;
  const temp = last ? last.temp : null;

  const recent = within(readings, now, 30 * 60_000);
  const trend = slopePerHour(recent);

  // 1. Perangkat hilang -> selalu menang atas kondisi lain.
  if (!last || now - last.ts > rules.offlineAfterMinutes * 60_000) {
    const mins = last ? Math.round((now - last.ts) / 60_000) : null;
    return {
      status: 'offline',
      code: 'offline',
      severity: 'critical',
      message: MESSAGES.offline(null, mins ? `${mins} menit` : undefined),
      trendPerHour: trend,
      etaToTarget: null,
    };
  }

  const t = temp as number;
  const phase = resolveFillPhase(now, rules);
  const eta = estimateEta(t, trend, rules.targetMax, now);

  // 2. Terlalu dingin selalu diperiksa, bahkan saat sedang mengisi.
  if (sustained(readings, now, rules.sustainSeconds, (x) => x <= rules.criticalLow)) {
    return done('critical', 'freezing', t, trend, eta);
  }

  // 3. Sedang diisi: kenaikan suhu adalah hal normal, jangan diganggu.
  if (phase.phase === 'filling') {
    return {
      status: 'filling',
      code: null,
      severity: null,
      message: `Pengisian ${phase.windowStart}, selesai sekitar ${phase.endsInMinutes} menit lagi.`,
      trendPerHour: trend,
      etaToTarget: eta,
    };
  }

  // 4. Masa pendinginan setelah pengisian.
  if (phase.phase === 'cooling') {
    if (t <= rules.targetMax) {
      return ok(t, trend, eta, `Sudah kembali ke pita target setelah pengisian ${phase.windowStart}.`);
    }
    // Selama suhu memang sedang turun secepat yang diharapkan, angka tinggi
    // adalah hal wajar setelah susu hangat masuk — jangan dijadikan alarm.
    const cooling = trend !== null && trend <= -rules.minCoolingRatePerHour;
    if (!cooling) {
      // Beri 20 menit pertama untuk pengaduk merata sebelum laju dinilai.
      if (phase.elapsedMinutes >= 20) {
        const rate = trend === null ? undefined : `${trend.toFixed(1)} °C/jam`;
        return {
          status: 'critical',
          code: 'cooling_stalled',
          severity: 'critical',
          message: MESSAGES.cooling_stalled(t, rate),
          trendPerHour: trend,
          etaToTarget: eta,
        };
      }
      // Masih di menit-menit awal, tapi suhu ekstrem dan tidak turun sama sekali.
      if (
        (trend === null || trend >= 0) &&
        sustained(readings, now, rules.sustainSeconds, (x) => x >= rules.criticalHigh)
      ) {
        return done('critical', 'critical_temp', t, trend, eta);
      }
    }
    // Sisa waktu toleransi tidak cukup untuk sampai target -> peringatkan lebih awal.
    // Ditahan sampai menit ke-30 karena laju di awal masih naik-turun saat
    // susu hangat baru bercampur dengan isi lama.
    if (phase.elapsedMinutes >= 30 && eta !== null && eta > now + phase.graceLeftMinutes * 60_000) {
      return {
        status: 'warning',
        code: 'cooling_timeout',
        severity: 'warning',
        message: `Perkiraan pendinginan melewati batas toleransi. Sisa ${phase.graceLeftMinutes} menit.`,
        trendPerHour: trend,
        etaToTarget: eta,
      };
    }
    return {
      status: 'cooling',
      code: null,
      severity: null,
      message: `Mendinginkan setelah pengisian ${phase.windowStart}. Sisa toleransi ${phase.graceLeftMinutes} menit.`,
      trendPerHour: trend,
      etaToTarget: eta,
    };
  }

  // 5. Operasi normal di luar jadwal pengisian.
  if (sustained(readings, now, rules.sustainSeconds, (x) => x >= rules.criticalHigh)) {
    return done('critical', 'critical_temp', t, trend, eta);
  }
  if (sustained(readings, now, rules.sustainSeconds, (x) => x <= rules.warnLow)) {
    return done('warning', 'freezing', t, trend, eta);
  }

  // Kenaikan mendadak tanpa jadwal: tutup tanki terbuka, atau susu masuk di luar jam.
  const q = within(readings, now, 15 * 60_000);
  if (q.length >= 3) {
    const rise = q[q.length - 1].temp - Math.min(...q.map((r) => r.temp));
    // Kenaikannya harus bertahan minimal lima menit, supaya satu pembacaan
    // meleset akibat sambungan thermocouple longgar tidak membangunkan siapa pun.
    const persisted = sustained(readings, now, 300, (x) => x > rules.targetMax);
    if (rise >= rules.unscheduledRiseDelta && t > rules.targetMax && persisted) {
      return {
        status: 'warning',
        code: 'unscheduled_rise',
        severity: 'warning',
        message: MESSAGES.unscheduled_rise(t, `+${rise.toFixed(1)} °C dalam 15 menit`),
        trendPerHour: trend,
        etaToTarget: eta,
      };
    }
  }

  if (sustained(readings, now, rules.sustainSeconds, (x) => x >= rules.warnHigh)) {
    return done('warning', 'high_temp', t, trend, eta);
  }
  // Melenceng dari pita target tapi belum ekstrem: butuh bertahan lebih lama.
  if (sustained(readings, now, Math.max(rules.sustainSeconds, 900), (x) => x > rules.targetMax)) {
    return done('warning', 'above_target', t, trend, eta);
  }

  // Histeresis: dari kondisi alert, wajib turun melewati ambang - histeresis.
  const wasAlerting = previousStatus === 'warning' || previousStatus === 'critical';
  if (wasAlerting && t > rules.targetMax - rules.recoverHysteresis) {
    return {
      status: 'warning',
      code: 'above_target',
      severity: 'warning',
      message: `Sedang pulih, menunggu suhu stabil di bawah ${(rules.targetMax - rules.recoverHysteresis).toFixed(1)} °C.`,
      trendPerHour: trend,
      etaToTarget: eta,
    };
  }

  return ok(t, trend, eta);
}

function done(
  status: TankStatus, code: AlertCode, t: number,
  trend: number | null, eta: number | null,
): Evaluation {
  return {
    status, code,
    severity: SEVERITY_OF[code],
    message: MESSAGES[code](t),
    trendPerHour: trend,
    etaToTarget: eta,
  };
}

function ok(t: number, trend: number | null, eta: number | null, message?: string): Evaluation {
  return {
    status: 'normal',
    code: null,
    severity: null,
    message: message ?? `Suhu ${fmt(t)}, dalam pita target.`,
    trendPerHour: trend,
    etaToTarget: eta,
  };
}

/** Perkiraan kapan suhu menyentuh target, berdasarkan tren saat ini. */
export function estimateEta(
  temp: number | null, trendPerHour: number | null, targetMax: number, now: number,
): number | null {
  if (temp === null || trendPerHour === null) return null;
  if (temp <= targetMax) return null;
  if (trendPerHour >= -0.1) return null; // praktis tidak turun
  const hours = (temp - targetMax) / -trendPerHour;
  if (hours > 12) return null;
  return now + hours * 3_600_000;
}

// --------------------------------------------------- pengendali pengiriman

export interface NotifyGateState {
  code: AlertCode;
  severity: Severity;
  notifiedAt: number;
}

/**
 * Menentukan apakah sebuah evaluasi layak jadi notifikasi push.
 * Mencegah banjir notifikasi: kirim saat kondisi baru, saat naik tingkat,
 * atau setelah `renotifyMinutes` berlalu.
 */
export function shouldNotify(
  evaluation: Evaluation,
  previous: NotifyGateState | null,
  rules: AlertRules,
  now: number,
): boolean {
  if (!rules.enabled) return false;
  if (!evaluation.code || !evaluation.severity) return false;
  if (inQuietHours(now, rules.quietHours) && evaluation.severity !== 'critical') return false;
  if (!previous) return true;
  if (previous.code !== evaluation.code) return true;
  if (previous.severity === 'warning' && evaluation.severity === 'critical') return true;
  return now - previous.notifiedAt >= rules.renotifyMinutes * 60_000;
}
