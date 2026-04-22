'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

import { CATEGORIES, CATEGORY_LABELS, todayIso } from '../../lib/doit_store';
import ActionableGate from './ActionableGate';
import DateChip from './DateChip';
import TimeChip from './TimeChip';
import TwoMinuteHint from './TwoMinuteHint';
import WaitingInput from './WaitingInput';

/**
 * ClassifyInlinePanel — 카드 내부(인라인) 명료화 패널.
 *
 * 흐름:
 *  - gate: "실행 가능한가?" 2버튼 (todo/schedule/project/waiting 에만 노출)
 *    · note/health/someday 는 스킵하고 바로 category_input
 *  - category_input: 카테고리별 추가 입력 + 저장/취소 (같은 카드 내부)
 *  - not_actionable_choice: 게이트 "아니오" → 3버튼 [노트 보관][언젠가][버리기]
 *
 * Props:
 *  - thought
 *  - initialCategory
 *  - onCommit(patch) — patch = { category, meta, clarification }
 *  - onCancel()
 *  - onDiscard(id)
 */

// 게이트를 거치는 카테고리 (나머지는 category_input 바로 진입)
const GATED_CATEGORIES = new Set(['todo', 'schedule', 'project', 'waiting']);

// Phase 7.1 — 헤더 chip 색상 조회 (label 은 CATEGORY_LABELS 재사용)
const toneOf = (catId) => CATEGORIES.find((c) => c.id === catId)?.tone ?? 'gray';

export default function ClassifyInlinePanel({
  thought,
  initialCategory,
  onCommit,
  onCancel,
  onDiscard,
}) {
  const initialPhase = GATED_CATEGORIES.has(initialCategory)
    ? 'gate'
    : 'category_input';

  const [phase, setPhase] = useState(initialPhase);
  const [actionable, setActionable] = useState(null);
  const [category, setCategory] = useState(initialCategory);
  const [draft, setDraft] = useState(() => ({
    scheduledDate:
      initialCategory === 'schedule' ? todayIso() : null,
    scheduledTime: null,
    waitingFor: '',
  }));

  const firstFocusRef = useRef(null);
  const rootRef = useRef(null);

  // Phase 7.1 Bug 1 — initialCategory prop 변경을 반영 (useState(initialCategory) antipattern 수정)
  useEffect(() => {
    setCategory(initialCategory);
    setPhase(GATED_CATEGORIES.has(initialCategory) ? 'gate' : 'category_input');
    setActionable(null);
    setDraft({
      scheduledDate: initialCategory === 'schedule' ? todayIso() : null,
      scheduledTime: null,
      waitingFor: '',
    });
  }, [initialCategory]);

  // ESC → 닫기 (데이터 변경 0)
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  // 마운트/단계 전환 시 첫 요소 포커스
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (firstFocusRef.current) firstFocusRef.current.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, category]);

  const categoryLabel = CATEGORY_LABELS[category] || category;

  const handleGateAnswer = useCallback((yes) => {
    setActionable(yes);
    if (yes) {
      setPhase('category_input');
    } else {
      setPhase('not_actionable_choice');
    }
  }, []);

  // not_actionable_choice → 선택한 분류로 다시 category_input 진입 (노트/언젠가)
  const handleNotActionableChoice = useCallback(
    (nextCategory) => {
      setCategory(nextCategory);
      setActionable(false);
      setPhase('category_input');
    },
    [],
  );

  const handleCommit = useCallback(() => {
    const meta = {};
    if (category === 'schedule') {
      meta.scheduledDate = draft.scheduledDate || todayIso();
      meta.scheduledTime = draft.scheduledTime || null;
    }
    if (category === 'waiting') {
      meta.waitingFor = (draft.waitingFor || '').trim() || null;
    }
    onCommit?.({
      category,
      meta,
      clarification: {
        actionable,
        decision: 'classify',
        source: 'classify',
      },
    });
  }, [category, draft, actionable, onCommit]);

  const handleDiscardClick = useCallback(() => {
    if (thought?.id) onDiscard?.(thought.id);
  }, [thought, onDiscard]);

  const setDraftField = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 카테고리별 입력 영역
  const renderCategoryInput = () => {
    if (category === 'todo') {
      return <TwoMinuteHint />;
    }
    if (category === 'schedule') {
      return (
        <div className="flex flex-col gap-2">
          <div ref={firstFocusRef} tabIndex={-1}>
            <DateChip
              date={draft.scheduledDate || null}
              onChange={(value) => setDraftField('scheduledDate', value || null)}
            />
          </div>
          <TimeChip
            time={draft.scheduledTime || null}
            onChange={(value) => setDraftField('scheduledTime', value || null)}
          />
        </div>
      );
    }
    if (category === 'waiting') {
      return (
        <WaitingInput
          ref={firstFocusRef}
          value={draft.waitingFor || ''}
          onChange={(value) => setDraftField('waitingFor', value)}
        />
      );
    }
    if (category === 'project') {
      return (
        <p className="text-[12px] leading-[1.55] text-[var(--color-text-hint)]">
          프로젝트로 저장한 뒤 상세에서 이어서 적을 수 있어요.
        </p>
      );
    }
    // note, health, someday — 추가 입력 없음
    return (
      <p className="text-[12px] leading-[1.55] text-[var(--color-text-hint)]">
        <strong className="font-semibold text-[var(--color-text-secondary)]">{categoryLabel}</strong>으로 저장돼요.
      </p>
    );
  };

  // 단계 헤더 문구
  const phaseHeader = useMemo(() => {
    if (phase === 'gate') return '이 생각, 실행할 수 있을까요?';
    if (phase === 'not_actionable_choice') return '그렇다면 어떻게 보관할까요?';
    return `${categoryLabel}으로 저장`;
  }, [phase, categoryLabel]);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-expanded="true"
      aria-label="생각 명료화"
      className="rounded-xl border border-[var(--color-border-focus)] bg-[var(--color-card-surface-subtle)] p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`doit-cat-chip doit-cat-${toneOf(category)} inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium`}
          >
            {CATEGORY_LABELS[category] || category}
          </span>
          <span className="text-[11.5px] text-[var(--color-text-secondary)]">
            {phase === 'gate' ? '실행 가능 여부부터 확인해요' : phaseHeader}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="명료화 닫기"
          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-hint)] transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          <X size={12} />
        </button>
      </div>

      {phase === 'gate' && (
        <ActionableGate
          ref={firstFocusRef}
          onAnswer={handleGateAnswer}
          compact
        />
      )}

      {phase === 'not_actionable_choice' && (
        <div
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
          role="group"
          aria-label="참고 정보 보관 방식"
        >
          <p className="text-[12px] leading-[1.55] text-[var(--color-text-secondary)]">
            실행하지 않을 생각이에요. 어디에 둘까요?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              ref={firstFocusRef}
              type="button"
              onClick={() => handleNotActionableChoice('note')}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              노트로 보관
            </button>
            <button
              type="button"
              onClick={() => handleNotActionableChoice('someday')}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              언젠가
            </button>
            <button
              type="button"
              onClick={handleDiscardClick}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-hint)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
            >
              버리기
            </button>
          </div>
        </div>
      )}

      {phase === 'category_input' && (
        <div className="flex flex-col gap-3">
          {renderCategoryInput()}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCommit}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-cta-bg)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-cta-text)] transition-opacity hover:opacity-90"
            >
              <Check size={12} />
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
