'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Cloud, Hourglass, Inbox, ListChecks, Undo2, X } from 'lucide-react';

import {
  CATEGORIES,
  CATEGORY_LABELS,
  getThoughtsStorageKey,
  classifyThought,
  discardThought,
  getByCategory,
  getSummary,
  getUnclassified,
  loadThoughts,
  restoreDiscarded,
  saveThoughts,
  todayIso,
  unclassifyThought,
  updateThoughtMeta,
} from '../../lib/doit_store';
import ClassifiedBoard from './ClassifiedBoard';
import ClassifyInlinePanel from './ClassifyInlinePanel';
import DateChip from './DateChip';

const TOAST_MS = 3200;
const DISCARD_TOAST_MS = 5000;

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

// 카드에서 노출할 primary 칩만 (waiting/someday 제외 — 게이트 '아니오' 경로로만 진입)
const PRIMARY_CATEGORIES = CATEGORIES.filter((c) => c.primary);

export default function ClassifyView() {
  const [thoughts, setThoughts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [toast, setToast] = useState(null);
  // Phase 7: 인라인 명료화 활성 카드. 단일 state로 자동 언마운트 보장.
  const [activeClarify, setActiveClarify] = useState(null); // { id, category } | null
  const toastTimerRef = useRef(null);

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

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const unclassified = getUnclassified(thoughts);
  const summary = getSummary(thoughts);
  const waitingList = getByCategory(thoughts, 'waiting');
  const somedayList = getByCategory(thoughts, 'someday');

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

  // 칩 클릭 → 같은 카드에 인라인 열기 (즉시 저장 아님)
  const handleChipClick = useCallback((id, category) => {
    setActiveClarify({ id, category });
  }, []);

  const handleInlineCancel = useCallback(() => {
    setActiveClarify(null);
  }, []);

  // 인라인 커밋 — category + meta + clarification 한번에 반영
  const handleInlineCommit = useCallback(
    (id, patch) => {
      const { category, meta, clarification } = patch;
      const fullMeta = { ...(meta ?? {}), clarification };
      setLeaving({ id, category });
      window.setTimeout(() => {
        setThoughts((prev) => classifyThought(prev, id, category, fullMeta));
        setLeaving(null);
      }, 220);

      setToast({
        kind: 'classify',
        id,
        category,
        label: CATEGORY_LABELS[category],
        scheduledDate: meta?.scheduledDate || null,
      });
      scheduleToastDismiss();
      setActiveClarify(null);
    },
    [scheduleToastDismiss],
  );

  // 인라인에서 "버리기" — discardThought (노트에 섞이지 않음)
  const handleInlineDiscard = useCallback(
    (id) => {
      setLeaving({ id, category: null });
      window.setTimeout(() => {
        setThoughts((prev) => discardThought(prev, id, 'classify'));
        setLeaving(null);
      }, 220);

      setToast({ kind: 'discard', id });
      scheduleToastDismiss(DISCARD_TOAST_MS);
      setActiveClarify(null);
    },
    [scheduleToastDismiss],
  );

  const handleToastDateChange = useCallback(
    (nextDate) => {
      if (!toast || toast.kind !== 'classify') return;
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
    if (toast.kind === 'classify') {
      setThoughts((prev) => unclassifyThought(prev, toast.id));
    } else if (toast.kind === 'discard') {
      setThoughts((prev) => restoreDiscarded(prev, toast.id));
    }
    clearToastTimer();
    setToast(null);
  }, [toast]);

  const handleUnclassifyAux = useCallback((id) => {
    setThoughts((prev) => unclassifyThought(prev, id));
  }, []);

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
                const inlineOpen = activeClarify?.id === t.id;
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
                    {t.plannedDate && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--doit-cat-violet-bg)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--doit-cat-violet-fg)]">
                          🌙 내일 하기로
                        </span>
                      </div>
                    )}
                    <div className="mt-1 text-[11.5px] text-[var(--color-text-hint)]">
                      {formatTime(t.createdAt)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {PRIMARY_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleChipClick(t.id, cat.id)}
                          disabled={isLeaving}
                          aria-pressed={inlineOpen && activeClarify?.category === cat.id}
                          className={`doit-cat-chip doit-cat-${cat.tone} rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-40`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <div
                      className={`doit-inline-panel ${inlineOpen ? 'is-open' : ''}`}
                      aria-hidden={!inlineOpen}
                    >
                      {inlineOpen && (
                        <ClassifyInlinePanel
                          thought={t}
                          initialCategory={activeClarify.category}
                          onCommit={(patch) => handleInlineCommit(t.id, patch)}
                          onCancel={handleInlineCancel}
                          onDiscard={handleInlineDiscard}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {(waitingList.length > 0 || somedayList.length > 0) && (
          <section className="mt-6 border-t border-[var(--color-border)] pt-4">
            <h4 className="mb-2 text-[12px] uppercase tracking-wide text-[var(--color-text-hint)]">
              보조 분류
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <AuxColumn
                icon={<Hourglass size={12} />}
                label="대기 중"
                tone="violet"
                items={waitingList}
                onUnclassify={handleUnclassifyAux}
                renderMeta={(t) =>
                  t.waitingFor ? `· ${t.waitingFor}` : null
                }
              />
              <AuxColumn
                icon={<Cloud size={12} />}
                label="언젠가"
                tone="mist"
                items={somedayList}
                onUnclassify={handleUnclassifyAux}
              />
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--color-text)]">정리된 생각</span>
            <span className="text-[12px] text-[var(--color-text-hint)]">
              · 카테고리별로 모여요
            </span>
          </div>
          <ClassifiedBoard thoughts={thoughts} emptyHint="아직 정리된 메모가 없어요" />
        </section>
      </div>

      {toast && toast.kind === 'classify' && (
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
          {toast.category === 'project' && (
            <Link
              href={`/app/do-it-os/project/${toast.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-white/20"
              onClick={() => {
                clearToastTimer();
                setToast(null);
              }}
            >
              상세에서 이어쓰기
              <ArrowRight size={11} />
            </Link>
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

      {toast && toast.kind === 'discard' && (
        <div
          className="doit-toast"
          role="status"
          aria-live="polite"
          onMouseEnter={clearToastTimer}
          onMouseLeave={() => scheduleToastDismiss(DISCARD_TOAST_MS)}
        >
          <span className="text-[13px]">버렸어요</span>
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

function AuxColumn({ icon, label, tone, items, onUnclassify, renderMeta }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-3">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-hint)]">
          <span className={`doit-cat-chip doit-cat-${tone} inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium`}>
            {icon}
            {label}
          </span>
          <span>· 비어 있음</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className={`doit-cat-chip doit-cat-${tone} inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium`}>
          {icon}
          {label}
        </span>
        <span className="text-[11.5px] text-[var(--color-text-hint)]">{items.length}개</span>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 6).map((t) => (
          <li
            key={t.id}
            className="group/item flex items-start gap-1.5 rounded-lg bg-[var(--color-card-surface-subtle)] px-2.5 py-1.5"
          >
            <p className="flex-1 text-[12.5px] leading-[1.5] text-[var(--color-text)] line-clamp-2">
              {t.text}
              {renderMeta && renderMeta(t) && (
                <span className="ml-1 text-[11.5px] text-[var(--color-text-hint)]">
                  {renderMeta(t)}
                </span>
              )}
            </p>
            {onUnclassify && (
              <button
                type="button"
                onClick={() => onUnclassify(t.id)}
                aria-label="분류 해제"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/item:opacity-60 hover:opacity-100"
              >
                <X size={10} />
              </button>
            )}
          </li>
        ))}
        {items.length > 6 && (
          <li className="text-center text-[11px] text-[var(--color-text-hint)]">
            + {items.length - 6}개 더
          </li>
        )}
      </ul>
    </div>
  );
}
