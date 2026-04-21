'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, PenLine, Sparkles, StickyNote, Trash2 } from 'lucide-react';

import {
  STORAGE_KEY,
  getNoteById,
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

export default function NoteDetailView({ noteId }) {
  const router = useRouter();
  const [thoughts, setThoughts] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const list = loadThoughts();
    setThoughts(list);
    const note = getNoteById(list, noteId);
    if (note) {
      setTitle(note.text || '');
      setBody(note.noteBody || '');
    }
  }, [noteId]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setThoughts(loadThoughts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const note = thoughts ? getNoteById(thoughts, noteId) : null;

  const queueSave = useCallback(
    (patch) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        setThoughts((prev) => {
          if (!prev) return prev;
          const next = updateThoughtMeta(prev, noteId, patch);
          saveThoughts(next);
          return next;
        });
        setSavedAt(new Date());
      }, DEBOUNCE_MS);
    },
    [noteId],
  );

  useEffect(() => () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
  }, []);

  const handleTitleChange = (event) => {
    const value = event.target.value;
    setTitle(value);
    queueSave({ text: value });
  };

  const handleBodyChange = (event) => {
    const value = event.target.value;
    setBody(value);
    queueSave({ noteBody: value });
  };

  const handleUnclassify = () => {
    if (!window.confirm('이 노트를 Inbox로 되돌릴까요? 본문 내용도 함께 초기화돼요.')) return;
    setThoughts((prev) => {
      const next = unclassifyThought(prev, noteId);
      saveThoughts(next);
      return next;
    });
    router.push('/app/do-it-os/note');
  };

  if (thoughts === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[13px] text-[var(--color-text-hint)]">불러오는 중…</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-3 flex justify-center text-[var(--color-text-hint)]">
            <Sparkles size={22} />
          </div>
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-text)]">
            이 노트를 찾을 수 없어요
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--color-text-secondary)]">
            분류가 해제되었거나 URL이 잘못되었을 수 있어요.
          </p>
          <Link
            href="/app/do-it-os/note"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <ArrowLeft size={13} />
            노트 목록
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="doit-note-detail mx-auto w-full max-w-[760px] px-6 py-8 md:px-8">
        <Link
          href="/app/do-it-os/note"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft size={13} />
          노트 목록
        </Link>

        <header className="mt-4 flex items-start gap-3">
          <StickyNote size={22} className="mt-1 shrink-0 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="노트 제목"
            aria-label="노트 제목"
            className="flex-1 border-0 bg-transparent text-[22px] font-bold tracking-tight text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:outline-none"
          />
          {savedAt && (
            <span className="mt-2 shrink-0 text-[11px] text-[var(--color-text-hint)]">
              저장됨 · {savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </header>

        <section className="mt-6">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text)]">
            <PenLine size={13} className="text-[var(--color-text-secondary)]" />
            내용
          </div>
          <textarea
            value={body}
            onChange={handleBodyChange}
            placeholder="오래 참고할 생각·자료·건강 단서를 자유롭게 적어두세요"
            rows={12}
            className="min-h-[240px] w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] leading-[1.65] text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:border-[var(--color-border-focus)] focus:outline-none"
          />
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-[11.5px] text-[var(--color-text-hint)]">
          <div>
            쏟은 날 · {formatTime(note.createdAt)}
            {note.classifiedAt && (
              <>
                {' '}
                · 노트 분류 · {formatTime(note.classifiedAt)}
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
