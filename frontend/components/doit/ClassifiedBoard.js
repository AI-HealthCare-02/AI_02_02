'use client';

import { X } from 'lucide-react';

import { CATEGORIES, getByCategory } from '../../lib/doit_store';

export default function ClassifiedBoard({
  thoughts,
  onUnclassify,
  emptyHint = '아직 정리된 메모가 없어요',
  compact = false,
}) {
  const total = thoughts.filter((t) => t.category).length;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-6 py-8 text-center">
        <p className="text-[13px] text-[var(--color-text-hint)]">{emptyHint}</p>
      </div>
    );
  }

  const gridCols = compact
    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5';

  return (
    <div className={`grid gap-3 ${gridCols}`}>
      {CATEGORIES.map((cat) => {
        const list = getByCategory(thoughts, cat.id);
        return (
          <div
            key={cat.id}
            className={`doit-cat-board doit-cat-${cat.tone} rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`doit-cat-chip doit-cat-${cat.tone} rounded-full border px-2 py-0.5 text-[11.5px] font-medium`}
              >
                {cat.label}
              </span>
              <span className="text-[11.5px] text-[var(--color-text-hint)]">
                {list.length}개
              </span>
            </div>

            {list.length === 0 ? (
              <p className="py-3 text-center text-[11.5px] text-[var(--color-text-hint)]">
                비어 있음
              </p>
            ) : (
              <ul className="space-y-1.5">
                {list.slice(0, compact ? 3 : 10).map((t) => (
                  <li
                    key={t.id}
                    className="group flex items-start gap-1.5 rounded-lg bg-[var(--color-card-surface-subtle)] px-2.5 py-1.5"
                  >
                    <p className="flex-1 text-[12.5px] leading-[1.5] text-[var(--color-text)] line-clamp-2">
                      {t.text}
                    </p>
                    {onUnclassify && (
                      <button
                        type="button"
                        onClick={() => onUnclassify(t.id)}
                        aria-label="분류 해제"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </li>
                ))}
                {compact && list.length > 3 && (
                  <li className="text-center text-[11px] text-[var(--color-text-hint)]">
                    + {list.length - 3}개 더
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
