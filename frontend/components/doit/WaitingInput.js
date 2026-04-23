'use client';

import { forwardRef } from 'react';
import { Hourglass } from 'lucide-react';

/**
 * WaitingInput — "누구에게 맡겼나요?" 단일 라인 텍스트 입력.
 * DateChip/TimeChip 스타일과 결이 같은 pill-ish 컨테이너.
 *
 * Props:
 *  - value: string
 *  - onChange(value: string)
 *  - autoFocus?: boolean
 *  - placeholder?: string
 */
const WaitingInput = forwardRef(function WaitingInput(
  { value = '', onChange, autoFocus = false, placeholder = '누구에게 맡겼나요? (예: 김코치)' },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] text-[var(--color-text)] focus-within:border-[var(--color-border-focus)]">
        <Hourglass size={12} className="text-[var(--color-text-hint)]" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:outline-none"
        />
      </label>
      <span className="text-[11px] text-[var(--color-text-hint)]">선택 사항이에요.</span>
    </div>
  );
});

export default WaitingInput;
