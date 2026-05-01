'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Cloud, Hourglass, X } from 'lucide-react';

import { CATEGORIES, getByCategory, getSummary } from '../../lib/doit_store';

// todo/schedule 은 통합 페이지(/schedule, 두 섹션) 진입. health 는 노트 폴백 (Phase 8+ 분리 예정).
const CATEGORY_HREF = {
  todo: '/app/do-it-os/schedule',
  schedule: '/app/do-it-os/schedule',
  project: '/app/do-it-os/project',
  note: '/app/do-it-os/note',
  health: '/app/do-it-os/note',
};

// 통합 페이지 내 섹션으로 직접 스크롤하기 위한 anchor 매핑. 빈 문자열은 anchor 없음.
const CATEGORY_ANCHOR = {
  todo: '#todo-section',
  schedule: '#schedule-section',
};

// 상세 페이지가 실제로 존재하는 카테고리. 나머지는 인라인 확장 토글로 대체.
const DETAIL_ROUTES = new Set(['todo', 'project', 'note', 'schedule']);

export default function ClassifiedBoard({
  thoughts,
  onUnclassify,
  emptyHint = '아직 정리된 메모가 없어요',
  compact = false,
}) {
  const [expandedCategories, setExpandedCategories] = useState(() => new Set());

  const toggleExpand = (catId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const total = thoughts.filter((t) => t.category && !t.discardedAt).length;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-6 py-8 text-center">
        <p className="text-[13px] text-[var(--color-text-hint)]">{emptyHint}</p>
      </div>
    );
  }

  const gridCols = compact
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5';

  // 메인 보드는 primary 카테고리만 (waiting/someday는 하단 보조 행)
  const primary = CATEGORIES.filter((c) => c.primary);
  const summary = getSummary(thoughts);

  return (
    <div className="flex flex-col gap-4">
    <div className={`grid gap-3 ${gridCols}`}>
      {primary.map((cat) => {
        const list = getByCategory(thoughts, cat.id);
        const baseHref = CATEGORY_HREF[cat.id] || '/app/do-it-os';
        const href = baseHref + (CATEGORY_ANCHOR[cat.id] || '');
        const hasDetail = DETAIL_ROUTES.has(cat.id);
        const expanded = expandedCategories.has(cat.id);
        const previewLimit = compact ? 3 : 10;
        const visible = expanded ? list : list.slice(0, previewLimit);
        const overflow = list.length - previewLimit;

        const cardClassName = `doit-cat-board doit-cat-${cat.tone} group block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-focus)]`;

        const cardBody = (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`doit-cat-chip doit-cat-${cat.tone} rounded-full border px-2 py-0.5 text-[11.5px] font-medium`}
              >
                {cat.label}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11.5px] text-[var(--color-text-hint)]">
                {list.length}개
                {hasDetail && (
                  <ArrowRight
                    size={10}
                    className="opacity-0 transition-opacity group-hover:opacity-70"
                  />
                )}
              </span>
            </div>

            {list.length === 0 ? (
              <p className="py-3 text-center text-[11.5px] text-[var(--color-text-hint)]">
                비어 있음
              </p>
            ) : (
              <ul className="space-y-1.5">
                {visible.map((t) => (
                  <li
                    key={t.id}
                    className="group/item flex items-start gap-1.5 rounded-lg bg-[var(--color-card-surface-subtle)] px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-[1.5] text-[var(--color-text)] line-clamp-2">
                        {t.text}
                      </p>
                      {t.plannedDate && (
                        <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--doit-cat-violet-bg)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--doit-cat-violet-fg)]">
                          🌙 내일 하기로
                        </span>
                      )}
                    </div>
                    {onUnclassify && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onUnclassify(t.id);
                        }}
                        aria-label="분류 해제"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/item:opacity-60 hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </li>
                ))}
                {overflow > 0 && !hasDetail && (
                  <li>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleExpand(cat.id);
                      }}
                      className="doit-expand-toggle w-full rounded-lg border border-dashed border-[var(--color-border)] px-2 py-1 text-center text-[11.5px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      {expanded ? '접기 ▴' : `+ ${overflow}개 더 ▾`}
                    </button>
                  </li>
                )}
                {overflow > 0 && hasDetail && (
                  <li className="text-center text-[11px] text-[var(--color-text-hint)]">
                    + {overflow}개 더
                  </li>
                )}
              </ul>
            )}
          </>
        );

        return hasDetail ? (
          <Link
            key={cat.id}
            href={href}
            aria-label={`${cat.label} 카테고리 ${list.length}개 보기`}
            className={cardClassName}
          >
            {cardBody}
          </Link>
        ) : (
          <div
            key={cat.id}
            role="region"
            aria-label={`${cat.label} ${list.length}개`}
            className={cardClassName}
          >
            {cardBody}
          </div>
        );
      })}
    </div>
      <div className="rounded-lg bg-[var(--color-card-surface-subtle)] p-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <Hourglass size={12} className="text-[var(--color-text-hint)]" />
            대기 중 {summary.byCategory.waiting || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Cloud size={12} className="text-[var(--color-text-hint)]" />
            언젠가 {summary.byCategory.someday || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
