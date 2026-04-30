'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  FolderKanban,
  PenLine,
  Sparkles,
  Trash2,
} from 'lucide-react';
import NextActionCardGrid from './NextActionCardGrid';
import ProjectLinkedNextActions from './ProjectLinkedNextActions';

import {
  PROJECT_STATUS_OPTIONS,
  getThoughtsStorageKey,
  getProjectById,
  loadThoughts,
  saveThoughts,
  unclassifyThought,
  updateThoughtMeta,
} from '../../lib/doit_store';

const DEBOUNCE_MS = 700;

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export default function ProjectDetailView({ projectId }) {
  const router = useRouter();
  const [thoughts, setThoughts] = useState(null); // null = hydration 대기
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [status, setStatus] = useState('active');
  const [savedAt, setSavedAt] = useState(null);
  const debounceRef = useRef(null);

  // 초기 로드
  useEffect(() => {
    const list = loadThoughts();
    setThoughts(list);
    const project = getProjectById(list, projectId);
    if (project) {
      setTitle(project.text || '');
      setDescription(project.description || '');
      setNextAction(project.nextAction || '');
      setStatus(project.projectStatus || 'active');
    }
  }, [projectId]);

  // storage 동기화 (다른 탭 등)
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === getThoughtsStorageKey()) setThoughts(loadThoughts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const project = thoughts ? getProjectById(thoughts, projectId) : null;

  // debounce 저장
  const queueSave = useCallback(
    (patch) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        setThoughts((prev) => {
          if (!prev) return prev;
          const next = updateThoughtMeta(prev, projectId, patch);
          saveThoughts(next);
          return next;
        });
        setSavedAt(new Date());
      }, DEBOUNCE_MS);
    },
    [projectId],
  );

  useEffect(() => () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
  }, []);

  // 즉시 저장 (상태 토글 등)
  const commitNow = (patch) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setThoughts((prev) => {
      if (!prev) return prev;
      const next = updateThoughtMeta(prev, projectId, patch);
      saveThoughts(next);
      return next;
    });
    setSavedAt(new Date());
  };

  const handleTitleChange = (event) => {
    const value = event.target.value;
    setTitle(value);
    queueSave({ text: value });
  };

  const handleDescriptionChange = (event) => {
    const value = event.target.value;
    setDescription(value);
    queueSave({ description: value });
  };

  const handleNextActionChange = (event) => {
    const value = event.target.value;
    setNextAction(value);
    queueSave({ nextAction: value });
  };

  const handleStatusChange = (next) => {
    setStatus(next);
    commitNow({ projectStatus: next });
  };

  const handleUnclassify = () => {
    if (!window.confirm('이 프로젝트를 Inbox로 되돌릴까요? 설명과 다음 행동도 함께 초기화돼요.')) return;
    setThoughts((prev) => {
      const next = unclassifyThought(prev, projectId);
      saveThoughts(next);
      return next;
    });
    router.push('/app/do-it-os/project');
  };

  // 초기 hydration 중
  if (thoughts === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[13px] text-[var(--color-text-hint)]">불러오는 중…</p>
      </div>
    );
  }

  // 프로젝트가 없거나 해제됨
  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-3 flex justify-center text-[var(--color-text-hint)]">
            <Sparkles size={22} />
          </div>
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-text)]">
            이 프로젝트를 찾을 수 없어요
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--color-text-secondary)]">
            분류가 해제되었거나 URL이 잘못되었을 수 있어요.
          </p>
          <Link
            href="/app/do-it-os/project"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <ArrowLeft size={13} />
            프로젝트 목록
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="doit-project-detail mx-auto w-full max-w-[760px] px-6 py-8 md:px-8">
        <Link
          href="/app/do-it-os/project"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft size={13} />
          프로젝트 목록
        </Link>

        <header className="mt-4 flex items-start gap-3">
          <FolderKanban size={22} className="mt-1 shrink-0 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="프로젝트 제목"
            aria-label="프로젝트 제목"
            className="flex-1 border-0 bg-transparent text-[22px] font-bold tracking-tight text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:outline-none"
          />
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PROJECT_STATUS_OPTIONS.map((opt) => {
            const active = status === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleStatusChange(opt.id)}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  active
                    ? 'doit-project-status-pill doit-project-status-pill-' + opt.id
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
          {savedAt && (
            <span className="ml-auto text-[11px] text-[var(--color-text-hint)]">
              저장됨 · {savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <section className="mt-6">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text)]">
            <PenLine size={13} className="text-[var(--color-text-secondary)]" />
            설명
          </div>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            placeholder="이 프로젝트가 뭔지, 왜 시작했는지 짧게 적어두세요"
            rows={4}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:border-[var(--color-border-focus)] focus:outline-none"
          />
        </section>

        <section className="mt-6">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text)]">
            <Sparkles size={13} className="text-[var(--color-text-secondary)]" />
            다음 행동
          </div>
          <p className="mb-3 text-[12px] text-[var(--color-text-hint)]">
            카드 하나를 고르면 그 자리에서 새 메모가 생성돼요. 생성된 항목은 해당 카테고리에 바로 쌓여요.
          </p>
          <NextActionCardGrid projectId={projectId} projectTitle={title || project.text} />

          <details className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2">
            <summary className="cursor-pointer text-[12px] text-[var(--color-text-secondary)] select-none">
              직접 한 줄로 적기 (선택)
            </summary>
            <input
              type="text"
              value={nextAction}
              onChange={handleNextActionChange}
              placeholder="다음으로 할 일 한 가지 (작고 구체적으로)"
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:border-[var(--color-border-focus)] focus:outline-none"
            />
          </details>

          <ProjectLinkedNextActions projectId={projectId} />
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-[11.5px] text-[var(--color-text-hint)]">
          <div>
            쏟은 날 · {formatTime(project.createdAt)}
            {project.classifiedAt && (
              <>
                {' '}
                · 프로젝트 분류 · {formatTime(project.classifiedAt)}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleUnclassify}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] text-[var(--color-text-hint)] transition-colors hover:bg-[rgba(196,60,60,0.08)] hover:text-[rgba(196,60,60,0.9)]"
          >
            <Trash2 size={12} />
            분류 해제
          </button>
        </footer>
      </div>
    </div>
  );
}
