'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Undo2 } from 'lucide-react';

import {
  getThoughtsStorageKey,
  getByCategory,
  loadThoughts,
  saveThoughts,
  todayIso,
  unclassifyThought,
  updateThoughtMeta,
} from '../../lib/doit_store';
import DateChip, { formatFriendlyDate } from './DateChip';
import TimeChip from './TimeChip';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 주어진 month(0-indexed)의 첫 일요일부터 마지막 토요일까지 42셀(7×6) 생성.
 * 이전/다음 달은 `inMonth: false`.
 */
export function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDayWeekday = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(year, month, 1 - firstDayWeekday);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      iso: formatIsoDate(d),
      day: d.getDate(),
      weekday: d.getDay(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export default function CalendarView({ categoryId = 'schedule', dateRange = null }) {
  const [thoughts, setThoughts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState(null);
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setThoughts(loadThoughts());
    setHydrated(true);
    const onStorage = (event) => {
      if (event.key === getThoughtsStorageKey()) setThoughts(loadThoughts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveThoughts(thoughts);
  }, [thoughts, hydrated]);

  const items = useMemo(() => {
    const base = getByCategory(thoughts, categoryId);
    if (!dateRange || !dateRange.start) return base;
    return base.filter((t) => {
      if (!t.scheduledDate) return false;
      return t.scheduledDate >= dateRange.start && t.scheduledDate <= dateRange.end;
    });
  }, [thoughts, categoryId, dateRange]);

  const countsByDate = useMemo(() => {
    const map = {};
    for (const t of items) {
      if (!t.scheduledDate) continue;
      map[t.scheduledDate] = (map[t.scheduledDate] || 0) + 1;
    }
    return map;
  }, [items]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const selectedItems = useMemo(
    () =>
      items
        .filter((t) => t.scheduledDate === selected)
        .sort((a, b) =>
          (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99'),
        ),
    [items, selected],
  );

  const goPrev = useCallback(() => {
    setCursor((prev) => {
      const m = prev.month - 1;
      if (m < 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: m };
    });
  }, []);

  const goNext = useCallback(() => {
    setCursor((prev) => {
      const m = prev.month + 1;
      if (m > 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: m };
    });
  }, []);

  const goToday = useCallback(() => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(formatIsoDate(d));
  }, []);

  const handleDateChange = (id, date) => {
    setThoughts((prev) => updateThoughtMeta(prev, id, { scheduledDate: date || null }));
  };

  const handleTimeChange = (id, time) => {
    setThoughts((prev) => updateThoughtMeta(prev, id, { scheduledTime: time || null }));
  };

  const handleUnclassify = (id) => {
    const prev = loadThoughts();
    const target = prev.find((t) => t.id === id);
    const next = unclassifyThought(prev, id);
    saveThoughts(next);
    setThoughts(next);
    setToast({ id, prev, text: target?.text?.slice(0, 20) ?? '' });
  };

  const handleUndo = () => {
    if (!toast?.prev) return;
    saveThoughts(toast.prev);
    setThoughts(toast.prev);
    setToast(null);
  };

  const selectedFriendly =
    formatFriendlyDate(selected) ||
    (selected ? `${selected.slice(5, 7)}/${selected.slice(8, 10)}` : '');

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 sm:py-6 md:px-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="이전 달"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="text-[15px] font-semibold text-[var(--color-text)]">
            {cursor.year}년 {cursor.month + 1}월
          </div>
          <button
            type="button"
            onClick={goNext}
            aria-label="다음 달"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          오늘
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--color-text-hint)]">
            {WEEKDAYS.map((w, idx) => (
              <div key={w} className={idx === 0 ? 'text-[rgba(224,80,80,0.8)]' : idx === 6 ? 'text-[rgba(74,127,181,0.8)]' : ''}>
                {w}
              </div>
            ))}
          </div>
          <div className="doit-calendar-grid">
            {cells.map((cell) => {
              const count = countsByDate[cell.iso] || 0;
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selected;
              const classes = [
                'doit-calendar-cell',
                !cell.inMonth ? 'out-of-month' : '',
                isToday ? 'doit-calendar-today' : '',
                isSelected ? 'doit-calendar-selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelected(cell.iso)}
                  className={classes}
                  aria-label={`${cell.iso}${count > 0 ? ` · 일정 ${count}건` : ''}`}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <span className="doit-calendar-num">{cell.day}</span>
                  {count > 0 && (
                    <span className="doit-calendar-dots">
                      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <span key={i} className="doit-calendar-dot" />
                      ))}
                      {count > 3 && <span className="doit-calendar-more">+</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
              {selectedFriendly}
            </h2>
            <span className="text-[11.5px] text-[var(--color-text-hint)]">
              {selectedItems.length > 0 ? `${selectedItems.length}개` : '비어 있음'}
            </span>
          </div>

          {selectedItems.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-[var(--color-text-hint)]">
              이 날짜엔 일정이 없어요.
            </p>
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((t) => (
                <li
                  key={t.id}
                  className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] p-3"
                >
                  <p className="text-[13px] leading-[1.5] text-[var(--color-text)] whitespace-pre-wrap">
                    {t.text}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-hint)]">
                    {t.scheduledTime && (
                      <span className="font-semibold text-[var(--color-text)]">
                        {t.scheduledTime}
                      </span>
                    )}
                    <span>쏟은 시각 {formatTime(t.createdAt)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <DateChip
                        date={t.scheduledDate}
                        onChange={(value) => handleDateChange(t.id, value)}
                        size="sm"
                      />
                      <TimeChip
                        time={t.scheduledTime}
                        onChange={(value) => handleTimeChange(t.id, value)}
                        size="sm"
                        placeholder="시간"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnclassify(t.id)}
                    title="미분류로 되돌림 · 날짜·시간·완료 기록이 함께 삭제돼요"
                    aria-label="이 항목을 분류 해제하고 미분류로 되돌리기"
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[var(--color-text-hint)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
                  >
                    <Undo2 size={11} />
                    분류 해제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div className="mt-6 flex items-center gap-2 text-[12px] text-[var(--color-text-hint)]">
        <Inbox size={12} />
        <Link href="/app/do-it-os/classify" className="hover:underline">
          미분류 Inbox로 이동
        </Link>
      </div>

      {toast && (
        <div className="doit-toast fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[var(--color-surface-dark)] px-4 py-2.5 text-[13px] text-[var(--color-text-inv)] shadow-lg">
          <span>&ldquo;{toast.text}&rdquo; 분류를 해제했어요</span>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium hover:bg-white/20"
          >
            <Undo2 size={11} />
            되돌리기
          </button>
        </div>
      )}
    </div>
  );
}
