'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

// 음각(deboss) 효과 — globals.css L891 의 saju-entry-card 패턴 준용. 다크/라이트 양쪽 안전.
const DEBOSS_STYLE = {
  opacity: 0.55,
  textShadow: '0 1px 0 rgba(255,255,255,0.04), 0 -1px 0 rgba(0,0,0,0.25)',
};

export default function TomorrowReleaseInline({
  originalText,
  onComplete,
  onSkip,
  testId,
}) {
  // 음각 ghost 텍스트 — 시각 가이드 전용. textarea value 와 분리되어 "텍스트로 인식되지 않는다."
  // 사용자가 한 글자 입력할 때마다 ghost 의 prefix 가 invisible 처리되어 "차례로 사라지는" 효과.
  const ghost = `${originalText}, 이거는 내일 하자`;
  const [draft, setDraft] = useState('');

  const handleConfirm = () => {
    if (typeof onComplete === 'function') onComplete(draft);
  };

  const handleSkip = () => {
    if (typeof onSkip === 'function') onSkip();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div
      role="region"
      aria-label="내일로 넘기기 — 한 줄 적기"
      data-testid={testId ?? 'tomorrow-release-inline'}
      className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-3"
    >
      <p
        role="note"
        className="rounded-md bg-[var(--color-surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--color-text-hint)]"
      >
        💬 말하면서 따라 타이핑해 보세요
      </p>

      {/* Ghost overlay + 사용자 입력 input. 두 layer 의 padding·font·line-height 가 동일해야 글자 위치 정렬됨. */}
      <div className="relative mt-2 rounded-md bg-[var(--color-surface)] ring-1 ring-transparent focus-within:ring-[var(--color-text-secondary)]">
        <p
          aria-hidden="true"
          data-testid="tomorrow-release-ghost"
          className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-keep px-3 py-2 text-[13px] italic leading-[1.6] text-[var(--color-text-hint)]"
          style={DEBOSS_STYLE}
        >
          <span className="invisible">{ghost.slice(0, draft.length)}</span>
          <span>{ghost.slice(draft.length)}</span>
        </p>
        <input
          type="text"
          data-testid="tomorrow-release-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="음각을 따라 한 줄 입력"
          className="relative block w-full border-0 bg-transparent px-3 py-2 text-[13px] italic leading-[1.6] text-[var(--color-text)] outline-none"
        />
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[12px] text-[var(--color-text-hint)] hover:bg-[var(--color-card-surface-subtle)]"
        >
          건너뛰기
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-text)] px-3 py-1 text-[12px] font-medium text-[var(--color-surface)] hover:opacity-90"
        >
          <Check size={12} />
          완료
        </button>
      </div>
    </div>
  );
}
