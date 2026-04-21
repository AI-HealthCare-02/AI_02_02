'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';

const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDateOnly(dateStr) {
  try {
    return startOfDay(new Date(`${dateStr}T00:00:00`));
  } catch {
    return null;
  }
}

export function formatFriendlyDate(dateStr) {
  if (!dateStr) return null;
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  const today = startOfDay(new Date());
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '내일';
  if (diffDays === -1) return '어제';
  if (diffDays > 1 && diffDays <= 7) {
    return `이번 주 ${KOREAN_WEEKDAYS[d.getDay()]}요일`;
  }
  if (diffDays < -1) return `${-diffDays}일 지남`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * DateChip — 클릭하면 브라우저 date picker 여는 칩 버튼.
 *
 * variant:
 *  - "light" (기본): 카드 내부 표시용. 점선/실선 border, 다나아 토큰 사용.
 *  - "dark": 토스트 등 어두운 배경용.
 */
export default function DateChip({
  date,
  onChange,
  onOpenStart,
  onOpenEnd,
  variant = 'light',
  size = 'md',
  placeholder = '날짜 지정',
}) {
  const ref = useRef(null);
  const friendly = formatFriendlyDate(date);
  const today = startOfDay(new Date());
  const parsed = date ? parseDateOnly(date) : null;
  const isOverdue = parsed && parsed < today;

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

  const paddingClass = size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1';
  const iconSize = size === 'sm' ? 11 : 12;
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  let stateClass;
  if (variant === 'dark') {
    stateClass = !date
      ? 'border-dashed border-white/30 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      : 'border-white/20 bg-white/10 text-white hover:bg-white/15';
  } else if (!date) {
    stateClass =
      'border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-hint)] hover:text-[var(--color-text-secondary)]';
  } else if (isOverdue) {
    stateClass =
      'border-[rgba(224,120,0,0.4)] bg-[rgba(224,120,0,0.08)] text-[var(--color-text)]';
  } else {
    stateClass =
      'border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] text-[var(--color-text)]';
  }

  const handleBlur = () => {
    if (typeof onOpenEnd === 'function') onOpenEnd();
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        aria-label={date ? `날짜 ${friendly} · 바꾸기` : placeholder}
        className={`doit-date-chip inline-flex items-center gap-1.5 rounded-full border ${paddingClass} ${textSize} font-medium transition-colors ${stateClass}`}
      >
        <Calendar size={iconSize} />
        <span>{friendly || placeholder}</span>
      </button>
      <input
        ref={ref}
        type="date"
        value={date || ''}
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
