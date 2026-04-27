'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, LayoutList } from 'lucide-react';

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

export default function TasksPage() {
  const [scheduleView, setScheduleView] = useState('list');
  const [dateFilter, setDateFilter] = useState('today');

  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);

  // SPA navigation 시 hash 변경만으로는 브라우저 native anchor 스크롤이 발동하지 않음.
  // CategoryListView/CalendarView 가 dynamic import 로 늦게 마운트되므로
  // 여러 시점에 시도하여 (rAF + 200ms + 600ms) layout 안정 후 정확히 스크롤.
  useEffect(() => {
    const performScroll = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return false;
      const el = document.getElementById(hash);
      if (!el) return false;
      const scroller = el.closest('.overflow-y-auto');
      if (scroller) {
        const elRect = el.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const offset = elRect.top - scrollerRect.top + scroller.scrollTop - 24;
        scroller.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return true;
    };
    const runRetries = () => {
      // dynamic import 컴포넌트 mount 타이밍이 불확실 → 단계별 재시도
      requestAnimationFrame(performScroll);
      setTimeout(performScroll, 200);
      setTimeout(performScroll, 600);
    };
    runRetries();
    window.addEventListener('hashchange', runRetries);
    return () => window.removeEventListener('hashchange', runRetries);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 페이지 헤더 */}
      <div className="mx-auto w-full max-w-[1100px] px-6 pt-8 pb-2 md:px-10">
        <header className="mb-6">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={18} className="text-[var(--color-text-secondary)]" />
            <Calendar size={18} className="text-[var(--color-text-secondary)]" />
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              할일 · 일정
            </h1>
          </div>
          <p className="mt-1 text-[13.5px] text-[var(--color-text-secondary)]">
            처리할 일들을 한 페이지에서 확인해요. 위쪽은 할 일, 아래쪽은 일정이에요.
          </p>
        </header>
      </div>

      {/* 할 일 섹션 */}
      <section
        id="todo-section"
        aria-labelledby="todo-section-heading"
        className="scroll-mt-6"
      >
        <div className="mx-auto w-full max-w-[1100px] px-6 md:px-10">
          <header className="mb-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={18} className="text-[var(--color-text-secondary)]" />
              <h2
                id="todo-section-heading"
                className="text-[18px] font-semibold tracking-tight text-[var(--color-text)]"
              >
                할 일
              </h2>
            </div>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              체크박스로 완료 처리하면 &lsquo;완료된 일&rsquo; 섹션으로 이동해요.
            </p>
          </header>
        </div>
        <CategoryListView
          categoryId="todo"
          categoryTone="blue"
          title="할 일"
          subtitle=""
          icon={CheckCircle2}
          showDate={false}
          hideHeader
        />
      </section>

      {/* 두 섹션 시각 분리 */}
      <div
        className="mx-auto w-full max-w-[1100px] px-6 md:px-10"
        aria-hidden="true"
      >
        <div className="my-2 border-t border-[var(--color-border)]" />
      </div>

      {/* 일정 섹션 — 외부 헤더로 리스트/달력 토글, CategoryListView 는 hideHeader */}
      <section
        id="schedule-section"
        aria-labelledby="schedule-section-heading"
        className="scroll-mt-6"
      >
        <div className="mx-auto w-full max-w-[1100px] px-6 md:px-10">
          <header className="mb-3 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Calendar size={18} className="text-[var(--color-text-secondary)]" />
                <h2
                  id="schedule-section-heading"
                  className="text-[18px] font-semibold tracking-tight text-[var(--color-text)]"
                >
                  일정
                </h2>
              </div>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                날짜를 설정하면 오늘·내일·앞으로로 자동 정렬돼요. 리스트 또는 달력 뷰로 확인해요.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scheduleView === 'calendar' && (
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
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                        dateFilter === f.id
                          ? 'bg-[var(--color-primary)] text-[var(--color-cta-text)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              <div
                role="tablist"
                aria-label="일정 보기 방식"
                className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={scheduleView === 'list'}
                  onClick={() => setScheduleView('list')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    scheduleView === 'list'
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
                  aria-selected={scheduleView === 'calendar'}
                  onClick={() => setScheduleView('calendar')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    scheduleView === 'calendar'
                      ? 'bg-[var(--color-card-surface-subtle)] text-[var(--color-text)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Calendar size={12} />
                  달력
                </button>
              </div>
            </div>
          </header>
        </div>

        {scheduleView === 'list' ? (
          <CategoryListView
            categoryId="schedule"
            categoryTone="yellow"
            title="일정"
            subtitle=""
            icon={Calendar}
            showDate
            hideHeader
          />
        ) : (
          <CalendarView categoryId="schedule" dateRange={dateRange} />
        )}
      </section>
    </div>
  );
}
