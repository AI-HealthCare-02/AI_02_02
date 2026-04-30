'use client';

import { useEffect, useState } from 'react';

/**
 * ProjectPickerInline — 프로젝트 카테고리 분류 시 "기존 연결 / 새로 만들기" 토글.
 *
 * Props:
 *  - projects: Array<{ id, text, classifiedAt?, createdAt? }>  (getProjectsList 결과 — 최근순)
 *  - value: { mode: 'new' | 'existing', projectId: string|null }
 *  - onChange(value)
 *
 * 동작:
 *  - projects.length === 0 → "새 프로젝트로 만들어요" 안내만, 토글 미노출
 *  - projects.length 1~5 → 라디오 형태로 전부 노출
 *  - projects.length > 5 → 최근 5개 + "더 보기" 버튼
 */
const PREVIEW_COUNT = 5;

export default function ProjectPickerInline({
  projects = [],
  value = { mode: 'new', projectId: null },
  onChange,
}) {
  const [showAll, setShowAll] = useState(false);
  const hasProjects = projects.length > 0;

  // projects 가 0개로 바뀌면 mode 를 자동으로 'new' 로 reset
  useEffect(() => {
    if (!hasProjects && value.mode !== 'new') {
      onChange?.({ mode: 'new', projectId: null });
    }
  }, [hasProjects, value.mode, onChange]);

  const visible =
    showAll || projects.length <= PREVIEW_COUNT
      ? projects
      : projects.slice(0, PREVIEW_COUNT);
  const hiddenCount = projects.length - visible.length;

  if (!hasProjects) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
        <p className="text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">
          첫 프로젝트가 됩니다. 저장 후 상세 페이지에서 설명·다음 행동을 이어 적어주세요.
        </p>
      </div>
    );
  }

  const handleModeChange = (mode) => {
    if (mode === 'new') {
      onChange?.({ mode: 'new', projectId: null });
    } else {
      onChange?.({ mode: 'existing', projectId: value.projectId ?? projects[0]?.id ?? null });
    }
  };

  const handlePickProject = (projectId) => {
    onChange?.({ mode: 'existing', projectId });
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <p className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
        어디에 둘까요?
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--color-text)]">
          <input
            type="radio"
            name="project-picker-mode"
            value="new"
            checked={value.mode === 'new'}
            onChange={() => handleModeChange('new')}
            className="h-3.5 w-3.5 accent-[var(--color-text-secondary)]"
            data-testid="project-picker-mode-new"
          />
          새 프로젝트로 만들기
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--color-text)]">
          <input
            type="radio"
            name="project-picker-mode"
            value="existing"
            checked={value.mode === 'existing'}
            onChange={() => handleModeChange('existing')}
            className="h-3.5 w-3.5 accent-[var(--color-text-secondary)]"
            data-testid="project-picker-mode-existing"
          />
          기존 프로젝트에 연결
        </label>
      </div>

      {value.mode === 'existing' && (
        <ul
          role="radiogroup"
          aria-label="기존 프로젝트 선택"
          className="mt-2 flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-2 py-1.5"
        >
          {visible.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
                <input
                  type="radio"
                  name="project-picker-existing"
                  value={p.id}
                  checked={value.projectId === p.id}
                  onChange={() => handlePickProject(p.id)}
                  className="h-3.5 w-3.5 accent-[var(--color-text-secondary)]"
                  data-testid={`project-picker-option-${p.id}`}
                />
                <span className="line-clamp-1">{p.text || '제목 없음'}</span>
              </label>
            </li>
          ))}

          {hiddenCount > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-1 w-full rounded-full border border-dashed border-[var(--color-border)] px-2 py-1 text-[11.5px] text-[var(--color-text-hint)] hover:bg-[var(--color-surface-hover)]"
              >
                + 더 보기 ({hiddenCount}개)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
