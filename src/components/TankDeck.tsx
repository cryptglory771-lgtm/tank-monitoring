'use client';

import { useEffect, useRef, useState } from 'react';
import TankCard from './TankCard';
import type { Tank } from '@/lib/types';

/**
 * Kartu digeser lewat transform, bukan scroll-snap penuh layar — cocok
 * dengan tampilan kartu tunggal yang dipusatkan di dalam cangkang ponsel.
 */
export default function TankDeck({ tanks, initialId }: { tanks: Tank[]; initialId?: string }) {
  const [idx, setIdx] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);

  useEffect(() => {
    if (!initialId) return;
    const i = tanks.findIndex((t) => t.id === initialId);
    if (i >= 0) setIdx(i);
  }, [initialId, tanks]);

  useEffect(() => {
    if (idx > tanks.length - 1) setIdx(Math.max(0, tanks.length - 1));
  }, [tanks.length, idx]);

  function setClamped(i: number) {
    setIdx(Math.max(0, Math.min(tanks.length - 1, i)));
  }

  function onStart(x: number) { startX.current = x; dragging.current = true; }
  function onEnd(x: number) {
    if (!dragging.current) return;
    const dx = x - startX.current;
    if (dx > 40) setClamped(idx - 1);
    else if (dx < -40) setClamped(idx + 1);
    dragging.current = false;
  }

  return (
    <>
      <div className="tank-stage deck-wrap">
        <div className="deck" style={{ transform: `translateX(-${idx * 100}%)` }}
          onTouchStart={(e) => onStart(e.touches[0].clientX)}
          onTouchEnd={(e) => onEnd(e.changedTouches[0].clientX)}
          onMouseDown={(e) => onStart(e.clientX)}
          onMouseUp={(e) => onEnd(e.clientX)}
        >
          {tanks.map((t) => (
            <TankCard key={t.id} tank={t} />
          ))}
        </div>
      </div>

      {tanks.length > 1 && (
        <>
          <div className="mt-1.5 flex justify-center gap-1.5">
            {tanks.map((t, i) => (
              <span
                key={t.id}
                className="block h-[5px] rounded-full transition-all"
                style={{ width: i === idx ? 14 : 5, background: i === idx ? 'var(--ice)' : 'var(--line)' }}
              />
            ))}
          </div>
          <p className="mt-2.5 pb-2 text-center text-[10.5px] tracking-wide" style={{ color: 'var(--muted-2)' }}>
            Geser untuk tanki lain
          </p>
        </>
      )}
    </>
  );
}
