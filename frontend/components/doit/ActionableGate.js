'use client';

import { forwardRef } from 'react';

/**
 * ActionableGate — 인라인 명료화의 step-0.
 * "실행할 수 있는 일인가요?" 2버튼. Yes → category_input, No → not_actionable_choice.
 *
 * Props:
 *  - onAnswer(actionable: boolean)
 *  - compact?: boolean  (자기 전 리츄얼용 작은 배치)
 *  - firstFocusRef?    (부모가 mount 시 포커스 잡을 수 있게)
 */
const ActionableGate = forwardRef(function ActionableGate(
  { onAnswer, compact = false },
  ref,
) {
  const wrapCls = compact
    ? 'rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2'
    : 'rounded-xl border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-4 py-3';

  return (
    <div
      className={wrapCls}
      role="group"
      aria-label="실행 가능 여부 선택"
    >
      <p className={`font-semibold text-[var(--color-text)] ${compact ? 'text-[13px]' : 'text-[13.5px]'}`}>
        실행할 수 있는 일인가요?
      </p>
      <p className="mt-0.5 text-[11.5px] leading-[1.5] text-[var(--color-text-hint)]">
        예: 지금 할 수 있다·일정에 올릴 수 있다 · 아니오: 알고만 있고 싶다
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          ref={ref}
          type="button"
          onClick={() => onAnswer?.(true)}
          className="inline-flex items-center rounded-full bg-[var(--color-cta-bg)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-cta-text)] transition-opacity hover:opacity-90"
        >
          예, 실행할 수 있어요
        </button>
        <button
          type="button"
          onClick={() => onAnswer?.(false)}
          className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          아니오, 참고 정보로만 저장
        </button>
      </div>
    </div>
  );
});

export default ActionableGate;
