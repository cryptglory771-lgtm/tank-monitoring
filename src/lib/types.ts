export type TankStatus =
  | 'normal'    // suhu di dalam pita target
  | 'filling'   // sedang jadwal pengisian susu
  | 'cooling'   // pasca pengisian, masih dalam masa toleransi turun suhu
  | 'warning'
  | 'critical'
  | 'offline';  // tidak ada data masuk

export type AlertCode =
  | 'above_target'      // di atas batas atas target di luar jam isi
  | 'high_temp'         // lewat ambang warning atas
  | 'critical_temp'     // lewat ambang kritis atas
  | 'freezing'          // terlalu dingin, risiko beku
  | 'cooling_stalled'   // pasca isi tapi suhu tidak turun -> dugaan kompresor mati
  | 'cooling_timeout'   // masa toleransi habis, belum sampai target
  | 'unscheduled_rise'  // suhu naik tajam di luar jadwal isi
  | 'offline';          // device berhenti kirim data

export type Severity = 'warning' | 'critical';

/** Jadwal pengisian susu. Suhu wajar naik di jendela ini. */
export interface FillWindow {
  /** "06:00" waktu lokal perangkat */
  start: string;
  /** Berapa lama proses isi berlangsung (menit) */
  durationMinutes: number;
  /** Waktu yang diberikan setelah isi selesai untuk kembali ke targetMax */
  graceMinutes: number;
}

export interface AlertRules {
  targetMin: number;          // 0
  targetMax: number;          // 2 (standar susu segar 0–2 °C)
  warnHigh: number;           // 4
  criticalHigh: number;       // 6
  warnLow: number;            // -0.5
  criticalLow: number;        // -1.5
  fillWindows: FillWindow[];
  /** Laju pendinginan minimum yang dianggap sehat, °C per jam */
  minCoolingRatePerHour: number;
  /** Kenaikan mendadak di luar jadwal isi yang dianggap mencurigakan, °C */
  unscheduledRiseDelta: number;
  /** Pelanggaran harus bertahan selama ini sebelum jadi alert (detik) */
  sustainSeconds: number;
  /** Selisih yang harus dilewati untuk dinyatakan pulih, mencegah alert kedap-kedip */
  recoverHysteresis: number;
  /** Tidak ada data selama ini -> offline (menit) */
  offlineAfterMinutes: number;
  /** Jeda minimal sebelum notifikasi yang sama dikirim ulang (menit) */
  renotifyMinutes: number;
  /** Jam tenang: hanya alert critical yang menembus */
  quietHours: { from: string; to: string } | null;
  enabled: boolean;
}

export interface Tank {
  id: string;              // dipakai di topic MQTT: dairy/tank/{id}/telemetry
  name: string;            // "Cooling Tank A"
  location?: string;
  capacityLiters?: number;
  rules: AlertRules;
  createdAt: number;
  archived?: boolean;
}

export interface Reading {
  id?: number;
  tankId: string;
  ts: number;              // epoch ms
  temp: number;            // °C
  rssi?: number;
  /** 1 = data mentah, 5 = hasil ringkas 5 menit */
  bucket?: number;
}

export interface AlertRecord {
  id?: number;
  tankId: string;
  code: AlertCode;
  severity: Severity;
  message: string;
  temp: number | null;
  startedAt: number;
  resolvedAt?: number | null;
  acknowledgedAt?: number | null;
}

export interface TankRuntime {
  tankId: string;
  status: TankStatus;
  code: AlertCode | null;
  since: number;
  lastTemp: number | null;
  lastSeen: number | null;
  /** °C per jam, negatif = sedang mendingin */
  trendPerHour: number | null;
  /** Perkiraan waktu sampai targetMax, epoch ms */
  etaToTarget: number | null;
}

export interface Evaluation {
  status: TankStatus;
  code: AlertCode | null;
  severity: Severity | null;
  message: string;
  trendPerHour: number | null;
  etaToTarget: number | null;
}

export const DEFAULT_RULES: AlertRules = {
  targetMin: 0,
  targetMax: 2,
  warnHigh: 4,
  criticalHigh: 6,
  warnLow: -0.5,
  criticalLow: -1.5,
  fillWindows: [
    { start: '06:00', durationMinutes: 45, graceMinutes: 150 },
    { start: '17:00', durationMinutes: 45, graceMinutes: 150 },
  ],
  minCoolingRatePerHour: 1.0,
  unscheduledRiseDelta: 1.5,
  sustainSeconds: 180,
  recoverHysteresis: 0.4,
  offlineAfterMinutes: 10,
  renotifyMinutes: 30,
  quietHours: null,
  enabled: true,
};
