'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Inbox, Undo2 } from 'lucide-react';

import {
  completeThought,
  getByCategory,
  getCompleted,
  initDoitStore,
  loadThoughts,
  reopenThought,
  saveThoughts,
  todayIso,
  unclassifyThought,
  updateThoughtMeta,
} from '../../lib/doit_store';
import DateChip from './DateChip';
import TimeChip from './TimeChip';

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function bucketByDate(items) {
  const today = todayIso();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const buckets = { overdue: [], today: [], tomorrow: [], upcoming: [], unscheduled: [] };
  for (const t of items) {
    if (!t.scheduledDate) {
      buckets.unscheduled.push(t);
    } else if (t.scheduledDate < today) {
      buckets.overdue.push(t);
    } else if (t.scheduledDate === today) {
      buckets.today.push(t);
    } else if (t.scheduledDate === tomorrow) {
      buckets.tomorrow.push(t);
    } else {
      buckets.upcoming.push(t);
    }
  }
  // 날짜 오름차순 정렬 (overdue·upcoming)
  buckets.overdue.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  buckets.upcoming.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return buckets;
}

export default function CategoryListView({
  categoryId,
  categoryTone,
  title,
  subtitle,
  icon: Icon,
  showDate = false,
  hideHeader = false,
  dateRange = null,
}) {
  const [thoughts, setThoughts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    initDoitStore().then(() => {
      setThoughts(loadThoughts());
      setHydrated(true);
    });
    const onUpdate = () => setThoughts(loadThoughts());
    window.addEventListener('doit-store-update', onUpdate);
    return () => window.removeEventListener('doit-store-update', onUpdate);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveThoughts(thoughts);
  }, [thoughts, hydrated]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showCheckbox = categoryId === 'todo' || categoryId === 'schedule';
  const rawActiveItems = getByCategory(thoughts, categoryId);
  const rawCompletedItems = showCheckbox ? getCompleted(thoughts, categoryId) : [];

  // 날짜 범위 필터 적용 (dateRange.start 가 null 이면 '전체' → 필터 해제)
  const applyDateRange = (list) => {
    if (!dateRange || !dateRange.start) return list;
    return list.filter((t) => {
      if (!t.scheduledDate) return false; // 날짜 미정은 필터 적용 시 제외
      return t.scheduledDate >= dateRange.start && t.scheduledDate <= dateRange.end;
    });
  };

  const activeItems = applyDateRange(rawActiveItems);
  const completedItems = applyDateRange(rawCompletedItems);
  const items = activeItems;

  const handleUnclassify = (id) => {
    const prev = loadThoughts();
    const target = prev.find((t) => t.id === id);
    const next = unclassifyThought(prev, id);
    saveThoughts(next);
    setThoughts(next);
    setToast({
      id,
      prev,
      text: target?.text?.slice(0, 20) ?? '',
    });
  };

  const handleUndo = () => {
    if (!toast?.prev) return;
    saveThoughts(toast.prev);
    setThoughts(toast.prev);
    setToast(null);
  };
  // 같은 페이지에 여러 인스턴스가 공존할 때 stale state 로 덮어쓰기 방지: 변경 직전 loadThoughts.
  const handleDateChange = (id, date) => {
    const latest = loadThoughts();
    const next = updateThoughtMeta(latest, id, { scheduledDate: date || null });
    saveThoughts(next);
    setThoughts(next);
  };
  const handleTimeChange = (id, time) => {
    const latest = loadThoughts();
    const next = updateThoughtMeta(latest, id, { scheduledTime: time || null });
    saveThoughts(next);
    setThoughts(next);
  };
  const handleToggleComplete = (id, currentlyCompleted) => {
    const latest = loadThoughts();
    const next = currentlyCompleted ? reopenThought(latest, id) : completeThought(latest, id);
    saveThoughts(next);
    setThoughts(next);
  };

  const CATEGORIES_WITH_DETAIL = new Set(['project', 'note']);

  const renderItem = (t) => {
    const hasDetail = CATEGORIES_WITH_DETAIL.has(categoryId);
    const detailHref = hasDetail ? `/app/do-it-os/${categoryId}/${t.id}` : null;
    const isDone = categoryId === 'project' && t.projectStatus === 'done';
    const isCompleted = !!t.completedAt;

    const body = (
      <>
        <div className="flex items-start gap-2">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={() => handleToggleComplete(t.id, isCompleted)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`${t.text.slice(0, 20)} 완료 체크`}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
            />
          )}
          <p
            className={`flex-1 text-[14px] leading-[1.55] whitespace-pre-wrap break-words ${
              isDone
                ? 'text-[var(--color-text-hint)] line-through'
                : 'text-[var(--color-text)]'
            }`}
          >
            {t.text}
            {isCompleted && (
              <span className="ml-2 text-[11.5px] text-[var(--color-text-hint)]">
                완료 · {formatRelative(t.completedAt)}
              </span>
            )}
          </p>
          {hasDetail && (
            <ChevronRight
              size={14}
              className="mt-1 shrink-0 text-[var(--color-text-hint)] transition-transform group-hover:translate-x-0.5"
            />
          )}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleUnclassify(t.id);
            }}
            title="미분류로 되돌림 · 날짜·시간·완료 기록이 함께 삭제돼요"
            aria-label="이 항목을 분류 해제하고 미분류로 되돌리기"
            className="flex h-7 items-center gap-1 rounded-full px-2 text-[11.5px] text-[var(--color-text-hint)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
          >
            <Undo2 size={12} />
            분류 해제
          </button>
        </div>
        {categoryId === 'project' && t.description && (
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {t.description}
          </p>
        )}
        {categoryId === 'schedule' && t.scheduleNote && (
          <p
            data-testid="schedule-note-display"
            className="mt-1.5 line-clamp-1 text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)]"
          >
            💬 {t.scheduleNote}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11.5px] text-[var(--color-text-hint)]">
          <span>쏟은 시각 · {formatTime(t.createdAt)}</span>
          {t.plannedDate && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--doit-cat-violet-bg)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--doit-cat-violet-fg)]">
              🌙 내일 하기로
            </span>
          )}
          {categoryId === 'project' && t.projectStatus && t.projectStatus !== 'active' && (
            <span className="rounded-full bg-[var(--color-card-surface-subtle)] px-2 py-0.5 text-[11px]">
              {t.projectStatus === 'onhold' ? '잠시 중단' : '완료'}
            </span>
          )}
          {showDate && (
            <div
              className="ml-auto flex items-center gap-1.5"
              onClick={(event) => event.preventDefault()}
            >
              <DateChip
                date={t.scheduledDate}
                onChange={(value) => handleDateChange(t.id, value)}
              />
              {t.scheduledDate && (
                <TimeChip
                  time={t.scheduledTime}
                  onChange={(value) => handleTimeChange(t.id, value)}
                  size="sm"
                  placeholder="시간"
                />
              )}
            </div>
          )}
        </div>
      </>
    );

    const itemClass = isCompleted ? 'doit-item-completed' : '';

    return (
      <li key={t.id} className={itemClass}>
        {hasDetail ? (
          <Link
            href={detailHref}
            prefetch={false}
            className="group block cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)]"
          >
            {body}
          </Link>
        ) : (
          <div className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            {body}
          </div>
        )}
      </li>
    );
  };

  const empty = (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-6 py-12 text-center">
      <p className="text-[14px] text-[var(--color-text-secondary)]">
        아직 <strong>{title}</strong>로 정리한 메모가 없어요.
      </p>
      <p className="mt-1 text-[13px] text-[var(--color-text-hint)]">
        <Link href="/app/do-it-os/classify" className="underline hover:no-underline">
          정리 명료화
        </Link>
        {' '}페이지에서 <strong>{title}</strong>로 분류해 보세요.
      </p>
    </div>
  );

  const renderBuckets = () => {
    const buckets = bucketByDate(items);
    const sections = [
      { key: 'overdue', label: '기한 지남', items: buckets.overdue, hint: '빠르게 확인해 주세요' },
      { key: 'today', label: '오늘', items: buckets.today },
      { key: 'tomorrow', label: '내일', items: buckets.tomorrow },
      { key: 'upcoming', label: '앞으로', items: buckets.upcoming },
      { key: 'unscheduled', label: '날짜 미정', items: buckets.unscheduled, hint: '날짜를 설정하면 위로 이동해요' },
    ];

    return (
      <div className="space-y-6">
        {sections.map((sec) => sec.items.length > 0 && (
          <div key={sec.key}>
            <div className="mb-2 flex items-baseline gap-2">
              {/* hideHeader=true: 외부에 이미 h1/h2 가 있는 통합 페이지 → 버킷은 h3 로 한 단계 낮춤. */}
              {hideHeader ? (
                <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                  {sec.label}
                </h3>
              ) : (
                <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                  {sec.label}
                </h2>
              )}
              <span className="text-[12px] text-[var(--color-text-hint)]">
                {sec.items.length}개{sec.hint ? ` · ${sec.hint}` : ''}
              </span>
            </div>
            <ul className="space-y-2">
              {sec.items.map(renderItem)}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={hideHeader ? '' : 'flex-1 overflow-y-auto'}>
      <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        {!hideHeader && (
          <header className="mb-6">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={18} className="text-[var(--color-text-secondary)]" />}
              <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">
                {title}
              </h1>
              <span
                className={`doit-cat-chip doit-cat-${categoryTone} ml-2 rounded-full border px-2 py-0.5 text-[11px] font-medium`}
              >
                {items.length}개
              </span>
            </div>
            {subtitle && (
              <p className="mt-1 text-[13.5px] text-[var(--color-text-secondary)]">
                {subtitle}
              </p>
            )}
          </header>
        )}

        <section>
          {items.length === 0 ? empty : showDate ? renderBuckets() : (
            <ul className="space-y-2">{items.map(renderItem)}</ul>
          )}
        </section>

        {showCheckbox && completedItems.length > 0 && (
          <details className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)]">
            <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-[var(--color-text-secondary)]">
              완료된 일 {completedItems.length}개
            </summary>
            <ul className="space-y-2 px-3 pb-3 pt-1">
              {completedItems.map(renderItem)}
            </ul>
          </details>
        )}

        <div className="mt-8 flex items-center gap-2 text-[12px] text-[var(--color-text-hint)]">
          <Inbox size={12} />
          <Link href="/app/do-it-os/classify" className="hover:underline">
            미분류 Inbox로 이동
          </Link>
        </div>
      </div>

      {toast && (
        <div className="doit-toast fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-[var(--color-surface-dark)] px-4 py-2.5 text-[13px] text-[var(--color-text-inv)] shadow-float">
          <span>&quot;{toast.text}&quot; 분류를 해제했어요</span>
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
