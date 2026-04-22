'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Moon, Trash2, Undo2 } from 'lucide-react';

import {
  CATEGORIES,
  classifyThought,
  completeThought,
  discardThought,
  getTodayUnfinishedSchedule,
  getUnclassified,
  keepInInbox,
  loadThoughts,
  moveToWaiting,
  planForTomorrow,
  saveThoughts,
} from '../../lib/doit_store';
import RitualThoughtInput from './RitualThoughtInput';

const STEPS = [
  { id: 1, label: '쏟기 (선택)', hint: '아직 덜 꺼낸 생각이 있으면 여기에 마저 적어도 돼요. 이미 낮에 쏟아놨다면 바로 다음 단계로 가요.' },
  { id: 2, label: '내일 고르기', hint: '욕심내지 말고 내일 꼭 할 것 1~3개만 골라주세요.' },
  { id: 3, label: '버리기/보관', hint: '지금 결정 안 해도 되는 건 가볍게 버려도 돼요.' },
];

const DASHBOARD_HREF = '/app/do-it-os';

export default function EndOfDayRitual() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [thoughts, setThoughts] = useState([]);
  const [selectedTomorrow, setSelectedTomorrow] = useState(() => new Set());
  const [spilledCount, setSpilledCount] = useState(0);
  const [tomorrowCount, setTomorrowCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [handledIds, setHandledIds] = useState(() => new Set());
  const [step3Snapshot, setStep3Snapshot] = useState([]);

  const addHandled = (id) =>
    setHandledIds((prev) => new Set(prev).add(id));
  const removeHandled = (id) =>
    setHandledIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // 초기 로딩
  useEffect(() => {
    const loaded = loadThoughts();
    setThoughts(loaded);
    setSpilledCount(getUnclassified(loaded).length);
  }, []);

  // ESC → 대시보드 복귀
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        router.push(DASHBOARD_HREF);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  // 토스트 자동 닫힘
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const unclassified = useMemo(() => getUnclassified(thoughts), [thoughts]);
  const todayUnfinished = useMemo(
    () => getTodayUnfinishedSchedule(thoughts),
    [thoughts],
  );

  const leftoverUnclassified = useMemo(
    () => unclassified.filter((t) => !selectedTomorrow.has(t.id)),
    [unclassified, selectedTomorrow],
  );

  // Step 3 진입 시 처리 대상 스냅샷 (moveToWaiting 등으로 category 변해도 리스트 유지)
  useEffect(() => {
    if (step === 3 && step3Snapshot.length === 0) {
      setStep3Snapshot(leftoverUnclassified.map((t) => t.id));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const step3Items = useMemo(
    () =>
      step3Snapshot
        .map((id) => thoughts.find((t) => t.id === id))
        .filter(Boolean),
    [step3Snapshot, thoughts],
  );

  const refreshThoughts = () => {
    setThoughts(loadThoughts());
  };

  const toggleSelect = (id) => {
    setSelectedTomorrow((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Step 2 미분류 인라인 분류 — 분류되면 해당 섹션에서 자동으로 사라짐 (useMemo 재계산)
  const handleQuickClassify = (id, category) => {
    const prev = loadThoughts();
    const next = classifyThought(prev, id, category, {
      clarification: { actionable: true, decision: category, source: 'end_of_day' },
    });
    saveThoughts(next);
    setThoughts(next);
  };

  // Step 2 오늘 일정 완료 체크 — completeThought는 isCompletable로 schedule/todo만 통과
  const handleCompleteToday = (id, currentlyCompleted) => {
    const prev = loadThoughts();
    const next = currentlyCompleted
      ? prev.map((t) => (t.id === id ? { ...t, completedAt: null } : t))
      : completeThought(prev, id);
    saveThoughts(next);
    setThoughts(next);
  };

  const handlePlanForTomorrow = () => {
    if (isSaving || selectedTomorrow.size === 0) return;
    setIsSaving(true);
    try {
      const ids = Array.from(selectedTomorrow);
      const next = planForTomorrow(loadThoughts(), ids);
      saveThoughts(next);
      setThoughts(next);
      setTomorrowCount(ids.length);
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipTomorrow = () => {
    setTomorrowCount(selectedTomorrow.size);
    setStep(3);
  };

  const handleDiscard = (id) => {
    const prev = loadThoughts();
    const next = discardThought(prev, id, 'end_of_day');
    saveThoughts(next);
    setThoughts(next);
    setDiscardedCount((n) => n + 1);
    addHandled(id);
    setToast({
      type: 'discard',
      id,
      prev,
      message: '버렸어요',
    });
  };

  const handleKeepInInbox = (id) => {
    const prev = loadThoughts();
    const next = keepInInbox(prev, id);
    saveThoughts(next);
    setThoughts(next);
    addHandled(id);
    setToast({
      type: 'keep',
      id,
      prev,
      message: '내일 다시 생각해볼게요',
    });
  };

  const handleMoveToWaiting = (id) => {
    const prev = loadThoughts();
    const next = moveToWaiting(prev, id);
    saveThoughts(next);
    setThoughts(next);
    addHandled(id);
    setToast({
      type: 'waiting',
      id,
      prev,
      message: '대기 중으로 옮겼어요',
    });
  };

  // Step 3 row-level 취소 — 각 action의 역연산
  const handleCancelHandled = (id) => {
    const prev = loadThoughts();
    const next = prev.map((t) => {
      if (t.id !== id) return t;
      const action = t.endOfDay?.action;
      const base = {
        ...t,
        endOfDay: { ...(t.endOfDay ?? {}), action: null },
      };
      if (action === 'waiting') {
        // moveToWaiting → waiting 분류 해제 (미분류로 복귀)
        return {
          ...base,
          category: null,
          classifiedAt: null,
          clarification: {
            ...(t.clarification ?? {}),
            decision: null,
            source: null,
          },
        };
      }
      if (action === 'discard') {
        // discardThought → discardedAt 해제 (미분류로 복귀)
        return {
          ...base,
          discardedAt: null,
          clarification: {
            ...(t.clarification ?? {}),
            decision: null,
            source: null,
          },
        };
      }
      // 'keep' 또는 'plan_tomorrow' — endOfDay.action만 클리어
      return base;
    });
    saveThoughts(next);
    setThoughts(next);
    removeHandled(id);
  };

  const handleUndo = () => {
    if (!toast?.prev) return;
    saveThoughts(toast.prev);
    setThoughts(toast.prev);
    if (toast.type === 'discard') {
      setDiscardedCount((n) => Math.max(0, n - 1));
    }
    if (toast.id != null) {
      removeHandled(toast.id);
    }
    setToast(null);
  };

  const goToDashboard = () => router.push(DASHBOARD_HREF);

  // isComplete: Step 3 스냅샷 기준. 비어있으면 Step 2에서 건너뛰기한 것 → 바로 완료.
  // 스냅샷에 항목이 있으면 모두 처리됐을 때 완료.
  const isComplete =
    step === 3 &&
    (step3Snapshot.length === 0
      ? leftoverUnclassified.length === 0
      : step3Snapshot.every((id) => handledIds.has(id)));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[720px] px-6 py-10 md:px-8">
        {/* 헤더 */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-[13px] text-[var(--color-text-hint)]">
            <Moon size={14} />
            <span>자기 전 정리</span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--color-text)]">
            오늘 머릿속의 것들을 내려놓아요
          </h1>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
            {STEPS[step - 1]?.hint}
          </p>
        </header>

        {/* 스텝 인디케이터 */}
        <div className="mb-6 flex items-center gap-2" aria-label="리츄얼 단계">
          {STEPS.map((s, idx) => {
            const active = s.id === step;
            const done = s.id < step;
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-surface)]'
                      : done
                      ? 'border-[var(--color-text-secondary)] bg-[var(--color-text-secondary)] text-[var(--color-surface)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-hint)]'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  {s.id}
                </span>
                <span
                  className={`text-[12px] ${
                    active
                      ? 'font-semibold text-[var(--color-text)]'
                      : 'text-[var(--color-text-hint)]'
                  }`}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <span className="mx-1 h-px flex-1 bg-[var(--color-border)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <section className="doit-card">
          {step === 1 && (
            <div>
              <RitualThoughtInput onCount={setSpilledCount} />
              <p className="mb-3 mt-6 text-[11.5px] text-[var(--color-text-hint)]">
                낮에 쏟아놓은 생각은 다음 단계에서 전부 한 번에 봐요.
              </p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToDashboard}
                  className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-hint)] hover:text-[var(--color-text-secondary)]"
                >
                  <ArrowLeft size={13} />
                  그만하기
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-text)] px-4 py-2 text-[13px] font-medium text-[var(--color-surface)] hover:opacity-90"
                >
                  다음 · 내일 고르기
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                내일 다시 볼 것을 골라요
              </h2>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-text-hint)]">
                미분류 {unclassified.length}개 · 오늘 남은 일정 {todayUnfinished.length}개
              </p>

              {unclassified.length === 0 && todayUnfinished.length === 0 ? (
                <p className="mt-6 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-8 text-center text-[13px] text-[var(--color-text-hint)]">
                  오늘 처리할 게 없네요! 바로 다음 단계로.
                </p>
              ) : (
                <div className="mt-4">
                  {/* 섹션 1: 미분류 — 인라인 분류 + 내일 하기 체크 */}
                  {unclassified.length > 0 && (
                    <section className="mb-5">
                      <h3 className="mb-2 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                        📥 미분류 ({unclassified.length}개)
                        <span className="ml-1 text-[11.5px] font-normal text-[var(--color-text-hint)]">
                          먼저 분류해주세요
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {unclassified.map((t) => (
                          <li
                            key={t.id}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[13.5px] leading-[1.5] text-[var(--color-text)]">
                                  {t.text}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {CATEGORIES.filter((c) => c.primary).map((cat) => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      onClick={() => handleQuickClassify(t.id, cat.id)}
                                      className={`doit-cat-chip doit-cat-${cat.tone} rounded-full border px-2 py-0.5 text-[11px] hover:opacity-80`}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
                                <input
                                  type="checkbox"
                                  checked={selectedTomorrow.has(t.id)}
                                  onChange={() => toggleSelect(t.id)}
                                  className="h-4 w-4 accent-[var(--color-text-secondary)]"
                                />
                                내일 하기
                              </label>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* 섹션 2: 오늘 남은 일정 — 완료 체크 + 내일로 미루기 */}
                  {todayUnfinished.length > 0 && (
                    <section className="mb-5">
                      <h3 className="mb-2 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                        📅 오늘 남은 일정 ({todayUnfinished.length}개)
                        <span className="ml-1 text-[11.5px] font-normal text-[var(--color-text-hint)]">
                          끝냈으면 체크
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {todayUnfinished.map((t) => (
                          <li
                            key={t.id}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!t.completedAt}
                                  onChange={() => handleCompleteToday(t.id, !!t.completedAt)}
                                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-text-secondary)]"
                                  aria-label={`${t.text.slice(0, 20)} 완료 체크`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13.5px] leading-[1.5] text-[var(--color-text)]">
                                    {t.text}
                                  </p>
                                  {t.scheduledTime && (
                                    <span className="mt-1 inline-block text-[11px] text-[var(--color-text-hint)]">
                                      🕐 {t.scheduledTime}
                                    </span>
                                  )}
                                </div>
                              </label>
                              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
                                <input
                                  type="checkbox"
                                  checked={selectedTomorrow.has(t.id)}
                                  onChange={() => toggleSelect(t.id)}
                                  className="h-4 w-4 accent-[var(--color-text-secondary)]"
                                />
                                내일로
                              </label>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-hint)] hover:text-[var(--color-text-secondary)]"
                >
                  <ArrowLeft size={13} />
                  쏟기로
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSkipTomorrow}
                    className="rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-surface-subtle)]"
                  >
                    건너뛰기
                  </button>
                  <button
                    type="button"
                    onClick={handlePlanForTomorrow}
                    disabled={isSaving || selectedTomorrow.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-text)] px-4 py-2 text-[13px] font-medium text-[var(--color-surface)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    다음 · 버리기/보관 ({selectedTomorrow.size})
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && !isComplete && (
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                남은 생각을 정리해요
              </h2>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-text-hint)]">
                각 항목을 버릴지, 내일 다시 생각할지, 대기 중으로 옮길지 선택해요.
              </p>

              <ul className="mt-4 space-y-2">
                {step3Items.map((t) => {
                  const isHandled = handledIds.has(t.id);
                  const action = t.endOfDay?.action;
                  const badge =
                    action === 'plan_tomorrow'
                      ? '내일 하기로'
                      : action === 'keep'
                      ? '내일 결정 예정'
                      : action === 'waiting'
                      ? '대기 중으로 옮김'
                      : action === 'discard'
                      ? '버림'
                      : null;
                  return (
                    <li
                      key={t.id}
                      className={`rounded-lg border px-3 py-3 ${
                        isHandled
                          ? 'doit-item-handled border-[var(--color-border)] bg-[var(--color-card-surface-subtle)]/40'
                          : 'border-[var(--color-border)] bg-[var(--color-card-surface-subtle)]'
                      }`}
                    >
                      <p
                        className={`line-clamp-2 text-[13.5px] leading-[1.5] ${
                          isHandled
                            ? 'text-[var(--color-text-hint)] line-through'
                            : 'text-[var(--color-text)]'
                        }`}
                      >
                        {t.text}
                      </p>
                      {isHandled && badge ? (
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="rounded-full bg-[var(--color-card-surface-subtle)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--color-text-secondary)]">
                            {badge}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelHandled(t.id)}
                            className="text-[11.5px] text-[var(--color-text-hint)] underline-offset-2 hover:underline"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDiscard(t.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                          >
                            <Trash2 size={11} />
                            버리기
                          </button>
                          <button
                            type="button"
                            onClick={() => handleKeepInInbox(t.id)}
                            className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                          >
                            내일도 고민
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveToWaiting(t.id)}
                            className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                          >
                            대기중
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-hint)] hover:text-[var(--color-text-secondary)]"
                >
                  <ArrowLeft size={13} />
                  내일 고르기로
                </button>
                <button
                  type="button"
                  onClick={goToDashboard}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-text)] px-4 py-2 text-[13px] font-medium text-[var(--color-surface)] hover:opacity-90"
                >
                  마치기
                  {step3Snapshot.length > 0 &&
                    ` (${handledIds.size}/${step3Snapshot.length} 처리됨)`}
                </button>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="py-6 text-center">
              <h2 className="text-[18px] font-bold text-[var(--color-text)]">
                오늘도 수고하셨어요
              </h2>
              <ul className="mx-auto mt-4 max-w-[260px] space-y-1 text-[13.5px] text-[var(--color-text-secondary)]">
                <li>쏟은 {spilledCount}개</li>
                <li>내일 고른 {tomorrowCount}개</li>
                <li>버린 {discardedCount}개</li>
              </ul>
              <button
                type="button"
                onClick={goToDashboard}
                className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-text)] px-4 py-2 text-[13px] font-medium text-[var(--color-surface)] hover:opacity-90"
              >
                대시보드로
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-[11.5px] text-[var(--color-text-hint)]">
          Esc 를 누르면 대시보드로 돌아가요. 각 단계는 자동으로 저장돼요.
        </p>
      </div>

      {toast && (
        <div className="doit-toast" role="status" aria-live="polite">
          <span className="text-[13px]">{toast.message}</span>
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
