'use client';

import { useRef } from 'react';
import { Clock } from 'lucide-react';

export default function TimeChip({
  time,
  onChange,
  onOpenStart,
  onOpenEnd,
  variant = 'light',
  size = 'md',
  placeholder = '시간 지정',
}) {
  const ref = useRef(null);

  const openPicker = () => {
    const el = ref.current;
    if (!el) return;
    if (typeof onOpenStart === 'function') onOpenStart();
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // fallback
      }
    }
    el.focus();
    el.click();
  };

  const handleBlur = () => {
    if (typeof onOpenEnd === 'function') onOpenEnd();
  };

  const paddingClass = size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1';
  const iconSize = size === 'sm' ? 11 : 12;
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  let stateClass;
  if (variant === 'dark') {
    stateClass = !time
      ? 'border-dashed border-white/30 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      : 'border-white/20 bg-white/10 text-white hover:bg-white/15';
  } else if (!time) {
    stateClass =
      'border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-hint)] hover:text-[var(--color-text-secondary)]';
  } else {
    stateClass =
      'border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] text-[var(--color-text)]';
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        aria-label={time ? `시간 ${time} · 바꾸기` : placeholder}
        className={`doit-time-chip inline-flex items-center gap-1.5 rounded-full border ${paddingClass} ${textSize} font-medium transition-colors ${stateClass}`}
      >
        <Clock size={iconSize} />
        <span>{time || placeholder}</span>
      </button>
      <input
        ref={ref}
        type="time"
        value={time || ''}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onOpenStart}
        onBlur={handleBlur}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-full h-0 w-0 overflow-hidden opacity-0"
      />
    </div>
  );
}
