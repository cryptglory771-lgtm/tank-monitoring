'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { archiveTank, updateTank } from '@/lib/tank-service';
import type { AlertRules, FillWindow } from '@/lib/types';

export default function TankSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const tank = useLiveQuery(() => db.tanks.get(id), [id]);
  const [rules, setRules] = useState<AlertRules | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (tank && !rules) setRules(structuredClone(tank.rules)); }, [tank, rules]);

  if (!tank || !rules) return null;

  const set = <K extends keyof AlertRules>(k: K, v: AlertRules[K]) => {
    setRules({ ...rules, [k]: v });
    setSaved(false);
  };

  const setWindow = (i: number, patch: Partial<FillWindow>) => {
    const next = rules.fillWindows.map((w, j) => (j === i ? { ...w, ...patch } : w));
    set('fillWindows', next);
  };

  async function save() {
    await updateTank(id, { rules: rules! });
    setSaved(true);
  }

  return (
    <main className="px-5 pt-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-semibold">{tank.name}</h1>
        <Link href="/devices" className="text-[14px] text-[var(--ice)]">Daftar tanki</Link>
      </div>
      <p className="mt-1 text-[13px] text-[var(--muted)]">ID perangkat {tank.id}</p>

      <Group
        title="Pita suhu target"
        note="Rentang yang dianggap aman untuk susu segar. Standar umum 0–2 °C."
      >
        <Num label="Batas bawah" unit="°C" value={rules.targetMin} step={0.5} onChange={(v) => set('targetMin', v)} />
        <Num label="Batas atas" unit="°C" value={rules.targetMax} step={0.5} onChange={(v) => set('targetMax', v)} />
      </Group>

      <Group title="Ambang peringatan" note="Kritis akan menembus jam tenang dan menuntut sentuhan sebelum hilang.">
        <Num label="Peringatan di atas" unit="°C" value={rules.warnHigh} step={0.5} onChange={(v) => set('warnHigh', v)} />
        <Num label="Kritis di atas" unit="°C" value={rules.criticalHigh} step={0.5} onChange={(v) => set('criticalHigh', v)} />
        <Num label="Kritis di bawah" unit="°C" value={rules.criticalLow} step={0.5} onChange={(v) => set('criticalLow', v)} />
      </Group>

      <Group
        title="Jadwal pengisian"
        note="Pada jam ini suhu wajar naik, jadi peringatan suhu tinggi ditahan sampai masa toleransi habis."
      >
        {rules.fillWindows.map((w, i) => (
          <div key={i} className="rounded-lg border border-[var(--line)] p-3">
            <label className="block">
              <span className="mb-1 block text-[13px] text-[var(--muted)]">Mulai isi</span>
              <input
                type="time"
                value={w.start}
                onChange={(e) => setWindow(i, { start: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-[15px]"
              />
            </label>
            <div className="mt-3 space-y-3">
              <Num label="Lama pengisian" unit="menit" value={w.durationMinutes} step={5}
                   onChange={(v) => setWindow(i, { durationMinutes: v })} />
              <Num label="Waktu toleransi mendingin" unit="menit" value={w.graceMinutes} step={15}
                   onChange={(v) => setWindow(i, { graceMinutes: v })} />
            </div>
          </div>
        ))}
        <button
          onClick={() => set('fillWindows', [...rules.fillWindows, { start: '12:00', durationMinutes: 45, graceMinutes: 150 }])}
          className="rounded-lg border border-[var(--line)] py-2 text-[14px] text-[var(--muted)]"
        >
          Tambah jadwal
        </button>
      </Group>

      <Group
        title="Deteksi kegagalan pendingin"
        note="Kalau setelah 20 menit suhu tidak turun secepat ini, aplikasi menganggap unit pendingin bermasalah dan langsung mengirim peringatan kritis."
      >
        <Num label="Laju turun minimum" unit="°C/jam" value={rules.minCoolingRatePerHour} step={0.5}
             onChange={(v) => set('minCoolingRatePerHour', v)} />
        <Num label="Kenaikan mendadak dianggap ganjil" unit="°C / 15 menit" value={rules.unscheduledRiseDelta} step={0.5}
             onChange={(v) => set('unscheduledRiseDelta', v)} />
      </Group>

      <Group title="Pengiriman notifikasi">
        <Num label="Tahan alert sampai bertahan" unit="detik" value={rules.sustainSeconds} step={30}
             onChange={(v) => set('sustainSeconds', v)} />
        <Num label="Jeda sebelum diulang" unit="menit" value={rules.renotifyMinutes} step={5}
             onChange={(v) => set('renotifyMinutes', v)} />
        <Num label="Anggap terputus setelah" unit="menit" value={rules.offlineAfterMinutes} step={1}
             onChange={(v) => set('offlineAfterMinutes', v)} />
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[15px]">Kirim notifikasi untuk tanki ini</span>
          <input
            type="checkbox"
            checked={rules.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="h-6 w-6 accent-[var(--ice)]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[15px] leading-snug">
            Jam tenang 22:00–05:00
            <span className="block text-[13px] text-[var(--muted)]">Peringatan kritis tetap dikirim.</span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(rules.quietHours)}
            onChange={(e) => set('quietHours', e.target.checked ? { from: '22:00', to: '05:00' } : null)}
            className="h-6 w-6 accent-[var(--ice)]"
          />
        </label>
      </Group>

      <div className="mt-6 flex gap-2">
        <button onClick={save} className="flex-1 rounded-lg bg-[var(--ice)] py-3 text-[15px] font-semibold text-[var(--ink)]">
          {saved ? 'Tersimpan' : 'Simpan pengaturan'}
        </button>
        <button
          onClick={async () => { await archiveTank(id); router.push('/devices'); }}
          className="rounded-lg border border-[var(--ember)] px-4 text-[14px] text-[var(--ember)]"
        >
          Hapus
        </button>
      </div>
    </main>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl bg-[var(--steel)] p-4">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {note && <p className="mt-1 text-[13px] leading-snug text-[var(--muted)]">{note}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Num({ label, unit, value, step, onChange }: {
  label: string; unit: string; value: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[15px] leading-snug">
        {label}
        <span className="block text-[13px] text-[var(--muted)]">{unit}</span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-right text-[15px] text-[var(--cream)]"
      />
    </label>
  );
}
