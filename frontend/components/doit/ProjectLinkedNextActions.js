'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2Off, Undo2 } from 'lucide-react';
import {
  CATEGORIES,
  getLinkedNextActions,
  loadThoughts,
  saveThoughts,
  updateThoughtMeta,
} from '../../lib/doit_store';

const UNDO_MS = 5000;
const TRUNCATE = 80;

function truncate(text, n = TRUNCATE) {
  if (!text) return '';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function toneOf(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId)?.tone || 'gray';
}

function labelOf(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

export default function ProjectLinkedNextActions({ projectId, onChange }) {
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null); // { id, prevProjectLinkId }
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const list = loadThoughts();
    setItems(getLinkedNextActions(list, projectId));
  }, [projectId]);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const scheduleToastDismiss = useCallback(() => {
    clearToastTimer();
    toastTimerRef.current = window.setTimeout(() => setToast(null), UNDO_MS);
  }, [clearToastTimer]);

  useEffect(() => () => clearToastTimer(), [clearToastTimer]);

  const handleUnlink = (id) => {
    const list = loadThoughts();
    const target = list.find((t) => t.id === id);
    const prevProjectLinkId = target?.projectLinkId ?? null;
    const next = updateThoughtMeta(list, id, { projectLinkId: null });
    saveThoughts(next);
    setItems(getLinkedNextActions(next, projectId));
    onChange?.();
    setToast({ id, prevProjectLinkId });
    scheduleToastDismiss();
  };

  const handleUndo = () => {
    if (!toast) return;
    const list = loadThoughts();
    const next = updateThoughtMeta(list, toast.id, {
      projectLinkId: toast.prevProjectLinkId,
    });
    saveThoughts(next);
    setItems(getLinkedNextActions(next, projectId));
    onChange?.();
    clearToastTimer();
    setToast(null);
  };

  return (
    <section className="doit-card mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
      <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]">
        연결된 다음 행동
      </h3>

      {items.length === 0 ? (
        <div className="mt-2 text-[12.5px] text-[var(--color-text-hint)]">
          아직 연결된 다음 행동이 없어요.{' '}
          <Link
            href="/app/do-it-os/classify"
            className="underline-offset-2 hover:underline"
          >
            정리 명료화에서 추가하기 →
          </Link>
        </div>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {items.map((t) => {
            const tone = toneOf(t.category);
            const catLabel = labelOf(t.category);
            return (
              <li
                key={t.id}
                className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2"
              >
                <span className="flex-1 text-[13px] leading-[1.5] text-[var(--color-text)]">
                  {truncate(t.text)}
                </span>
                <span
                  className={`doit-cat-chip doit-cat-${tone} inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium`}
                >
                  {catLabel}
                </span>
                <button
                  type="button"
                  onClick={() => handleUnlink(t.id)}
                  aria-label={`${t.text.slice(0, 20)} 연결 해제`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] text-[var(--color-text-hint)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
                >
                  <Link2Off size={11} />
                  연결 해제
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {toast && (
        <div
          className="doit-toast"
          role="status"
          aria-live="polite"
          onMouseEnter={clearToastTimer}
          onMouseLeave={scheduleToastDismiss}
        >
          <span className="text-[13px]">연결을 해제했어요</span>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-white/20"
          >
            <Undo2 size={12} />
            되돌리기
          </button>
        </div>
      )}
    </section>
  );
}
