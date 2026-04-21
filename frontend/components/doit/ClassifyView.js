'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Inbox, ListChecks, Undo2 } from 'lucide-react';

import {
  CATEGORIES,
  CATEGORY_LABELS,
  STORAGE_KEY,
  classifyThought,
  getSummary,
  getUnclassified,
  loadThoughts,
  saveThoughts,
  todayIso,
  unclassifyThought,
  updateThoughtMeta,
} from '../../lib/doit_store';
import ClassifiedBoard from './ClassifiedBoard';
import DateChip from './DateChip';

const TOAST_MS = 3200;

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
}

export default function ClassifyView() {
  const [thoughts, setThoughts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    setThoughts(loadThoughts());
    setHydrated(true);
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setThoughts(loadThoughts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveThoughts(thoughts);
  }, [thoughts, hydrated]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const unclassified = getUnclassified(thoughts);
  const summary = getSummary(thoughts);

  const clearToastTimer = () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const scheduleToastDismiss = useCallback((ms = TOAST_MS) => {
    clearToastTimer();
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  const handleClassify = useCallback((id, category) => {
    setLeaving({ id, category });

    // 일정(schedule) 분류 시 기본 날짜를 오늘로 자동 설정 → 원클릭 만족
    const meta = category === 'schedule' ? { scheduledDate: todayIso() } : {};

    window.setTimeout(() => {
      setThoughts((prev) => classifyThought(prev, id, category, meta));
      setLeaving(null);
    }, 220);

    setToast({
      id,
      category,
      label: CATEGORY_LABELS[category],
      scheduledDate: meta.scheduledDate || null,
    });
    scheduleToastDismiss();
  }, [scheduleToastDismiss]);

  const handleToastDateChange = useCallback(
    (nextDate) => {
      if (!toast) return;
      setThoughts((prev) =>
        updateThoughtMeta(prev, toast.id, { scheduledDate: nextDate || null }),
      );
      setToast((prev) => (prev ? { ...prev, scheduledDate: nextDate || null } : prev));
      scheduleToastDismiss();
    },
    [toast, scheduleToastDismiss],
  );

  const handleUndo = useCallback(() => {
    if (!toast) return;
    setThoughts((prev) => unclassifyThought(prev, toast.id));
    clearToastTimer();
    setToast(null);
  }, [toast]);

  // Escape 키로 토스트 닫기
  useEffect(() => {
    if (!toast) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        clearToastTimer();
        setToast(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toast]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] px-6 py-8 md:px-10">
        <header className="mb-6">
          <div className="flex items-center gap-1.5">
            <ListChecks size={18} className="text-[var(--color-text-secondary)]" />
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              정리 명료화
            </h1>
          </div>
          <p className="mt-1 text-[13.5px] text-[var(--color-text-secondary)]">
            쏟아놓은 생각을 한 개씩 카테고리로 골라주세요. 저장은 사용자 확인 후에만 돼요.
          </p>
        </header>

        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Inbox size={14} className="text-[var(--color-text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--color-text)]">
              미분류 {unclassified.length}개
            </span>
            <span className="text-[12px] text-[var(--color-text-hint)]">
              · 정리됨 {summary.total - summary.unclassified}개
            </span>
          </div>

          {unclassified.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-6 py-10 text-center">
              {summary.total === 0 ? (
                <>
                  <p className="text-[14px] text-[var(--color-text-secondary)]">
                    정리할 메모가 없어요.
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--color-text-hint)]">
                    먼저 떠오르는 걸 쏟아볼까요?
                  </p>
                  <Link
                    href="/app/do-it-os/thinking"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-cta-bg)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-cta-text)] transition-opacity hover:opacity-90"
                  >
                    쏟으러 가기
                    <ArrowRight size={13} />
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[14px] text-[var(--color-text-secondary)]">
                    모두 정리되었어요! 🎉
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--color-text-hint)]">
                    지금까지 {summary.total}개 중 전부 카테고리에 담았어요. 새 생각이 떠오르면 또 쏟아보세요.
                  </p>
                  <Link
                    href="/app/do-it-os/thinking"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
                  >
                    쏟으러 가기
                    <ArrowRight size={13} />
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {unclassified.map((t) => {
                const isLeaving = leaving?.id === t.id;
                return (
                  <li
                    key={t.id}
                    className={`doit-classify-row rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-opacity ${
                      isLeaving ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <p className="text-[14px] leading-[1.55] text-[var(--color-text)] whitespace-pre-wrap break-words">
                      {t.text}
                    </p>
                    <div className="mt-1 text-[11.5px] text-[var(--color-text-hint)]">
                      {formatTime(t.createdAt)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleClassify(t.id, cat.id)}
                          disabled={isLeaving}
                          className={`doit-cat-chip doit-cat-${cat.tone} rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-40`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--color-text)]">정리된 생각</span>
            <span className="text-[12px] text-[var(--color-text-hint)]">
              · 카테고리별로 모여요
            </span>
          </div>
          <ClassifiedBoard thoughts={thoughts} emptyHint="아직 정리된 메모가 없어요" />
        </section>
      </div>

      {toast && (
        <div
          className="doit-toast"
          role="status"
          aria-live="polite"
          onMouseEnter={clearToastTimer}
          onMouseLeave={() => scheduleToastDismiss()}
        >
          <span className="text-[13px]">
            <strong className="font-semibold">{toast.label}</strong>에 저장됐어요
          </span>
          {toast.category === 'schedule' && (
            <DateChip
              date={toast.scheduledDate}
              onChange={handleToastDateChange}
              onOpenStart={clearToastTimer}
              onOpenEnd={() => scheduleToastDismiss()}
              variant="dark"
              size="sm"
              placeholder="날짜"
            />
          )}
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-white/20"
          >
            <Undo2 size={12} />
            되돌리기
          </button>
        </div>
      )}
    </div>
  );
}
