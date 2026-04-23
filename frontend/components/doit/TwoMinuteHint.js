'use client';

/**
 * TwoMinuteHint — todo 분류 시 "2분 안에 끝낼 것이면 지금 바로" 힌트.
 * GTD 2분 룰. 인라인 명료화 카드 내부에서 1줄.
 */
export default function TwoMinuteHint() {
  return (
    <p
      className="mt-2 rounded-lg bg-[var(--color-card-surface-subtle)] px-3 py-2 text-[11.5px] leading-[1.55] text-[var(--color-text-hint)]"
      role="note"
    >
      💡 2분 안에 끝날 것 같으면 지금 바로 해보세요. 저장하지 않아도 돼요.
    </p>
  );
}
