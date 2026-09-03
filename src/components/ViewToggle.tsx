'use client';

export type DashView = 'card' | 'list';

export default function ViewToggle({ value, onChange }: { value: DashView; onChange: (v: DashView) => void }) {
  return (
    <div className="flex justify-end px-5 pb-1">
      <div className="flex gap-0.5 rounded-[11px] border p-[3px]" style={{ background: 'var(--steel)', borderColor: 'var(--line-soft)' }}>
        <ToggleBtn active={value === 'card'} onClick={() => onChange('card')} label="Tampilan kartu">
          <rect x="7" y="3" width="13" height="18" rx="2.5" />
          <path d="M3 8v8" opacity="0.5" />
        </ToggleBtn>
        <ToggleBtn active={value === 'list'} onClick={() => onChange('list')} label="Tampilan daftar">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </ToggleBtn>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, label, children }: {
  active: boolean; onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex h-[30px] w-[34px] items-center justify-center rounded-[8px]"
      style={{ background: active ? 'var(--steel-2)' : 'none', color: active ? 'var(--ice)' : 'var(--muted-2)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {children}
      </svg>
    </button>
  );
}
