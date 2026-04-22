'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Calendar, LayoutList } from 'lucide-react';

const CategoryListView = dynamic(
  () => import('../../../../components/doit/CategoryListView'),
  { ssr: false },
);
const CalendarView = dynamic(
  () => import('../../../../components/doit/CalendarView'),
  { ssr: false },
);

const DATE_FILTERS = [
  { id: 'today', label: '오늘' },
  { id: 'thisWeek', label: '이번 주' },
  { id: 'thisMonth', label: '이번 달' },
  { id: 'all', label: '전체' },
];

function fmtIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDateRange(filter) {
  const today = new Date();
  const todayStr = fmtIso(today);

  if (filter === 'today') {
    return { start: todayStr, end: todayStr };
  }

  if (filter === 'thisWeek') {
    // 월요일(Mon) 시작, 일요일(Sun) 종료 — KST 기준 (로컬 시간)
    const dayOfWeek = today.getDay(); // 0=일 ~ 6=토
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: fmtIso(monday), end: fmtIso(sunday) };
  }

  if (filter === 'thisMonth') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: fmtIso(first), end: fmtIso(last) };
  }

  return { start: null, end: null }; // 'all'
}

export default function SchedulePage() {
  const [view, setView] = useState('list');
  const [dateFilter, setDateFilter] = useState('thisMonth');

  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-6 pt-8 pb-2 md:px-10">
        <header className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <Calendar size={18} className="text-[var(--color-text-secondary)]" />
              <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">
                일정
              </h1>
            </div>
            <p className="mt-1 text-[13.5px] text-[var(--color-text-secondary)]">
              날짜가 있는 생각이에요. 리스트 또는 달력 뷰로 확인해요.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="일정 보기 방식"
            className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                view === 'list'
                  ? 'bg-[var(--color-card-surface-subtle)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              <LayoutList size={12} />
              리스트
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'calendar'}
              onClick={() => setView('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-[var(--color-card-surface-subtle)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              <Calendar size={12} />
              달력
            </button>
          </div>
        </header>

        <div className="mb-4 flex items-center gap-2">
          <div
            role="tablist"
            aria-label="일정 날짜 범위 필터"
            className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
          >
            {DATE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={dateFilter === f.id}
                onClick={() => setDateFilter(f.id)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  dateFilter === f.id
                    ? 'bg-[var(--color-primary)] text-[var(--color-cta-text)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <CategoryListView
          categoryId="schedule"
          categoryTone="yellow"
          title="일정"
          subtitle="날짜를 설정하면 오늘·내일·앞으로로 자동 정렬돼요."
          icon={Calendar}
          showDate
          hideHeader
          dateRange={dateRange}
        />
      ) : (
        <CalendarView categoryId="schedule" dateRange={dateRange} />
      )}
    </div>
  );
}
