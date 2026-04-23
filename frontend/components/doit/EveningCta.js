'use client';

import Link from 'next/link';
import { ArrowRight, Moon } from 'lucide-react';

export default function EveningCta({
  unclassified = 0,
  todayUnfinished = 0,
  nowHourOverride,
}) {
  const hour =
    typeof nowHourOverride === 'number'
      ? nowHourOverride
      : new Date().getHours();

  if (hour < 21) return null;
  if (unclassified + todayUnfinished === 0) return null;

  return (
    <section className="doit-evening-cta">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-card-surface-subtle)] text-[var(--color-text-secondary)]"
          aria-hidden="true"
        >
          <Moon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-semibold text-[var(--color-text)]">
            자기 전 정리
          </h3>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)]">
            미분류 {unclassified}개 · 오늘 남은 일정 {todayUnfinished}개
          </p>
        </div>
      </div>
      <Link
        href="/app/do-it-os/end-of-day"
        className="mt-3 inline-flex items-center gap-1 self-end rounded-full bg-[var(--color-text)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-surface)] hover:opacity-90"
      >
        시작하기
        <ArrowRight size={12} />
      </Link>
    </section>
  );
}
