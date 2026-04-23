'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';

import { CATEGORY_LABELS, todayIso } from '../../lib/doit_store';
import DateChip from './DateChip';
import TimeChip from './TimeChip';

/**
 * 카테고리별 질문 시퀀스 정의.
 * - schedule: 날짜 → 시간 (2단계, 시간은 스킵 기본)
 * - project/note/health/todo: 질문 없음 ("저장" 버튼만). 상세 링크는 패널 내부에서 안내.
 */
const STEP_CONFIG = {
  schedule: [
    { key: 'scheduledDate', kind: 'date', label: '언제 할 일인가요?', hint: '오늘로 기본 저장돼요. 필요하면 바꿔주세요.' },
    { key: 'scheduledTime', kind: 'time', label: '시간도 정할까요?', hint: '비워두면 하루 종일 일정으로 저장돼요.' },
  ],
  project: [],
  note: [],
  health: [],
  todo: [],
};

const DETAIL_LINK = {
  project: '/app/do-it-os/project',
  note: '/app/do-it-os/note',
};

export default function ClassifySlidePanel({
  open,
  thought,
  category,
  onCommit,
  onCancel,
}) {
  const steps = category ? STEP_CONFIG[category] || [] : [];
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState({});
  const panelRef = useRef(null);
  const firstFocusRef = useRef(null);

  // open/category 바뀔 때 초기화 + schedule 기본값(오늘)
  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    const initial = {};
    if (category === 'schedule') {
      initial.scheduledDate = todayIso();
    }
    setDraft(initial);
  }, [open, category]);

  // ESC 키로 취소
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  // 열릴 때 포커스
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (firstFocusRef.current) firstFocusRef.current.focus();
    });
  }, [open, stepIndex]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1 || steps.length === 0;

  const handleDraftChange = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value || null }));
  }, []);

  const handleSkip = useCallback(() => {
    if (!currentStep) return;
    // skip은 현재 단계 값을 null로 유지하고 다음으로
    setDraft((prev) => ({ ...prev, [currentStep.key]: null }));
    if (isLastStep) {
      onCommit?.(draft);
    } else {
      setStepIndex((prev) => prev + 1);
    }
  }, [currentStep, isLastStep, draft, onCommit]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onCommit?.(draft);
    } else {
      setStepIndex((prev) => prev + 1);
    }
  }, [isLastStep, draft, onCommit]);

  const handleSaveImmediate = useCallback(() => {
    onCommit?.(draft);
  }, [draft, onCommit]);

  if (!open || !thought || !category) return null;

  const categoryLabel = CATEGORY_LABELS[category] || category;
  const detailHref = DETAIL_LINK[category]
    ? `${DETAIL_LINK[category]}/${thought.id}`
    : null;

  const renderStepInput = () => {
    if (!currentStep) return null;
    if (currentStep.kind === 'date') {
      return (
        <DateChip
          date={draft.scheduledDate || null}
          onChange={(value) => handleDraftChange('scheduledDate', value)}
        />
      );
    }
    if (currentStep.kind === 'time') {
      return (
        <TimeChip
          time={draft.scheduledTime || null}
          onChange={(value) => handleDraftChange('scheduledTime', value)}
        />
      );
    }
    return null;
  };

  return (
    <>
      <div
        className="doit-panel-backdrop"
        onClick={onCancel}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${categoryLabel}으로 분류`}
        className="doit-classify-panel"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-text-hint)]">
              분류
            </div>
            <h2 className="mt-0.5 text-[16px] font-bold tracking-tight text-[var(--color-text)]">
              {categoryLabel}으로 저장할까요?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="닫기"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-text-hint)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="line-clamp-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--color-text)]">
            {thought.text}
          </p>

          {steps.length > 0 && currentStep ? (
            <section className="mt-5">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[11px] font-medium text-[var(--color-text-hint)]">
                  {stepIndex + 1} / {steps.length}
                </span>
                <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                  {currentStep.label}
                </h3>
              </div>
              {currentStep.hint && (
                <p className="mb-3 text-[12px] text-[var(--color-text-hint)]">
                  {currentStep.hint}
                </p>
              )}
              <div ref={firstFocusRef} tabIndex={-1}>
                {renderStepInput()}
              </div>
            </section>
          ) : (
            <section className="mt-5 space-y-3">
              <p className="text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                이 생각을 <strong>{categoryLabel}</strong>으로 저장해요.
                {detailHref && ' 저장 후 더 자세히 적고 싶으면 상세 페이지에서 계속 편집할 수 있어요.'}
              </p>
              {detailHref && (
                <p className="text-[12px] text-[var(--color-text-hint)]">
                  저장 후 상세 페이지가 준비되어 있어요.
                </p>
              )}
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            취소
          </button>
          <div className="flex items-center gap-2">
            {steps.length > 0 && currentStep && (
              <button
                type="button"
                onClick={handleSkip}
                className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                건너뛰기
              </button>
            )}
            {steps.length === 0 ? (
              <button
                type="button"
                onClick={handleSaveImmediate}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-cta-bg)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-cta-text)] transition-opacity hover:opacity-90"
              >
                <Check size={12} />
                저장
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-cta-bg)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-cta-text)] transition-opacity hover:opacity-90"
              >
                {isLastStep ? (
                  <>
                    <Check size={12} />
                    저장
                  </>
                ) : (
                  <>
                    다음
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            )}
          </div>
        </footer>

        {detailHref && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-5 py-3">
            <Link
              href={detailHref}
              onClick={handleSaveImmediate}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              저장하고 상세 페이지에서 더 자세히 적기
              <ArrowRight size={11} />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
