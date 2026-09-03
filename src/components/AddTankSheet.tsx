'use client';

import { useState } from 'react';
import { db } from '@/lib/db';
import { createTank } from '@/lib/tank-service';
import { seedDemoTank } from '@/lib/simulator';

export default function AddTankSheet({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const clean = id.trim();
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(clean)) {
      setError('ID perangkat hanya boleh huruf, angka, tanda hubung, dan garis bawah.');
      return;
    }
    if (await db.tanks.get(clean)) {
      setError('ID perangkat itu sudah dipakai tanki lain.');
      return;
    }
    await createTank({ id: clean, name: name.trim() || clean, location: location.trim() || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-[430px] rounded-t-[24px] border-t px-5 pb-8 pt-4"
        style={{ background: 'var(--steel)', borderColor: 'var(--line-soft)', paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--line)' }} />
        <h2 className="text-[16px] font-semibold">Tambah tanki / perangkat</h2>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--muted)' }}>
          ID perangkat harus sama dengan yang dipakai ESP32 di topik MQTT-nya.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="ID perangkat" value={id} onChange={setId} placeholder="tank-a" />
          <Field label="Nama tanki" value={name} onChange={setName} placeholder="Cooling Tank A" />
          <Field label="Lokasi" value={location} onChange={setLocation} placeholder="Kandang utara" />
        </div>

        {error && <p className="mt-3 text-[13px]" style={{ color: 'var(--ember)' }}>{error}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={save} className="flex-1 rounded-xl py-3 text-[15px] font-semibold" style={{ background: 'var(--ice)', color: 'var(--ink)' }}>
            Simpan tanki
          </button>
          <button
            onClick={() => { seedDemoTank(); onClose(); }}
            className="rounded-xl border px-3 text-[13px]"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
            title="Membuat satu tanki berisi 3 hari data buatan untuk mencoba aplikasi tanpa perangkat."
          >
            Data contoh
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px]" style={{ color: 'var(--muted)' }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2.5 text-[15px]"
        style={{ borderColor: 'var(--line)', background: 'var(--ink)', color: 'var(--cream)' }}
      />
    </label>
  );
}
