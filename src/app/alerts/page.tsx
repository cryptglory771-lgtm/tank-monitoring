'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateTank } from '@/lib/tank-service';
import type { AlertRules } from '@/lib/types';

export default function AlertsPage() {
  const tanks = useLiveQuery(() => db.tanks.filter((t) => !t.archived).toArray(), []) ?? [];
  const [tankId, setTankId] = useState<string | null>(null);

  useEffect(() => {
    if (!tankId && tanks.length) setTankId(tanks[0].id);
  }, [tanks, tankId]);

  const tank = tanks.find((t) => t.id === tankId);

  return (
    <div className="pb-8">
      <div className="px-5 pb-2.5 pt-4 text-[11px] tracking-wide" style={{ color: 'var(--muted-2)' }}>
        KONFIGURASI ALERT
      </div>

      {tanks.length === 0 ? (
        <p className="px-5 text-[14px]" style={{ color: 'var(--muted)' }}>
          Belum ada tanki. Tambahkan tanki dulu di tab Tanki.
        </p>
      ) : (
        <div className="px-5">
          <label className="mb-4 block">
            <span className="mb-2 block text-[12px]" style={{ color: 'var(--muted)' }}>Tanki</span>
            <div className="relative">
              <select
                value={tankId ?? ''}
                onChange={(e) => setTankId(e.target.value)}
                className="w-full appearance-none rounded-xl border px-3.5 py-2.5 text-[14px]"
                style={{ borderColor: 'var(--line-soft)', background: 'var(--steel)', color: 'var(--cream)' }}
              >
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.id}</option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-4 top-1/2 h-[7px] w-[7px] -translate-y-[70%] rotate-45 border-r-[1.5px] border-b-[1.5px]"
                style={{ borderColor: 'var(--muted)' }}
              />
            </div>
          </label>

          {tank && <AlertFields key={tank.id} tank={tank} />}
        </div>
      )}
    </div>
  );
}

function AlertFields({ tank }: { tank: { id: string; name: string; rules: AlertRules } }) {
  const [rules, setRules] = useState(structuredClone(tank.rules));
  const [saved, setSaved] = useState(false);
  const graceMinutes = rules.fillWindows[0]?.graceMinutes ?? 0;
  const quietOn = Boolean(rules.quietHours);

  function set<K extends keyof AlertRules>(k: K, v: AlertRules[K]) {
    setRules((r) => ({ ...r, [k]: v }));
    setSaved(false);
  }

  function setGrace(v: number) {
    set('fillWindows', rules.fillWindows.map((w) => ({ ...w, graceMinutes: v })));
  }

  async function save() {
    await updateTank(tank.id, { rules });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const scheduleText = rules.fillWindows.length
    ? `${rules.fillWindows.map((w) => w.start).join(' dan ')} setiap hari`
    : 'Belum ada jadwal';

  return (
    <div>
      <Slider label="Ambang peringatan" value={rules.warnHigh} min={0} max={15} step={0.5}
        unit="°C" color="var(--amber)" onChange={(v) => set('warnHigh', v)} />
      <Slider label="Ambang kritis" value={rules.criticalHigh} min={0} max={15} step={0.5}
        unit="°C" color="var(--ember)" onChange={(v) => set('criticalHigh', v)} />
      <Slider label="Toleransi mendingin setelah isi" value={graceMinutes} min={0} max={240} step={5}
        unit=" mnt" color="var(--ice)" onChange={setGrace} decimals={0} />

      <div className="mb-[18px]">
        <span className="mb-2 block text-[12px]" style={{ color: 'var(--muted)' }}>Jadwal pengisian</span>
        <div
          className="rounded-xl border px-3.5 py-2.5 text-[13px]"
          style={{ fontFamily: 'var(--font-mono)', borderColor: 'var(--line-soft)', background: 'var(--steel)', color: 'var(--muted)' }}
        >
          {scheduleText}
        </div>
      </div>

      <div className="mb-[18px] flex items-center justify-between gap-3">
        <span className="text-[14px] leading-snug">
          Jam tenang
          <span className="block text-[12px]" style={{ color: 'var(--muted)' }}>Peringatan kritis tetap dikirim.</span>
        </span>
        <input
          type="checkbox"
          checked={quietOn}
          onChange={(e) => set('quietHours', e.target.checked ? { from: '22:00', to: '05:00' } : null)}
          className="h-6 w-6"
          style={{ accentColor: 'var(--ice)' }}
        />
      </div>
      {quietOn && rules.quietHours && (
        <div className="mb-[18px] flex gap-2.5">
          <input
            type="time"
            value={rules.quietHours.from}
            onChange={(e) => set('quietHours', { ...rules.quietHours!, from: e.target.value })}
            className="flex-1 rounded-xl border px-3 py-2.5 text-[13px]"
            style={{ fontFamily: 'var(--font-mono)', borderColor: 'var(--line-soft)', background: 'var(--steel)', color: 'var(--cream)' }}
          />
          <input
            type="time"
            value={rules.quietHours.to}
            onChange={(e) => set('quietHours', { ...rules.quietHours!, to: e.target.value })}
            className="flex-1 rounded-xl border px-3 py-2.5 text-[13px]"
            style={{ fontFamily: 'var(--font-mono)', borderColor: 'var(--line-soft)', background: 'var(--steel)', color: 'var(--cream)' }}
          />
        </div>
      )}

      <button onClick={save} className="w-full rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: 'var(--ice)', color: '#04191C' }}>
        Simpan pengaturan alert
      </button>
      <p className="mt-2.5 text-center text-[12px] transition-opacity" style={{ color: 'var(--ok)', opacity: saved ? 1 : 0 }}>
        Pengaturan tersimpan
      </p>

      <Link href={`/devices/${tank.id}`} className="mt-1 block text-center text-[12px]" style={{ color: 'var(--muted-2)' }}>
        Pengaturan lanjutan
      </Link>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, color, onChange, decimals = 1 }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; color: string;
  onChange: (v: number) => void; decimals?: number;
}) {
  return (
    <div className="mb-[18px]">
      <span className="mb-2 block text-[12px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: 'var(--ice)' }}
        />
        <span className="min-w-[52px] text-right text-[13px]" style={{ fontFamily: 'var(--font-mono)', color }}>
          {value.toFixed(decimals)}{unit}
        </span>
      </div>
    </div>
  );
}
