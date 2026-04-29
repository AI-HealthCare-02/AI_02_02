'use client';

import { useEffect, useState } from 'react';
import { Feather } from 'lucide-react';

import {
  getUnclassified,
  loadThoughts,
  saveThoughts,
} from '../../lib/doit_store';

function makeId() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `t-${Date.now()}-${rand}`;
}

export default function RitualThoughtInput({ onCount }) {
  const [thoughts, setThoughts] = useState([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setThoughts(getUnclassified(loadThoughts()));
  }, []);

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    const newThought = {
      id: makeId(),
      text,
      createdAt: new Date().toISOString(),
      category: null,
      x: null,
      y: null,
      width: null,
      height: null,
      rotation: 0,
      color: null,
    };
    const next = [...loadThoughts(), newThought];
    saveThoughts(next);
    const unclassified = getUnclassified(next);
    setThoughts(unclassified);
    setDraft('');
    if (typeof onCount === 'function') {
      onCount(unclassified.length);
    }
  };

  const handleKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleAdd();
    }
  };

  const recent = thoughts.slice(-5).reverse();

  return (
    <div className="doit-ritual-step">
      <label className="block text-[13px] font-medium text-[var(--color-text-secondary)]">
        머릿속에 남은 것
      </label>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="머릿속에 남은 것을 적어주세요"
        rows={3}
        className="mt-2 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2.5 text-[14px] leading-[1.55] text-[var(--color-text)] outline-none focus:border-[var(--color-text-secondary)]"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11.5px] text-[var(--color-text-hint)]">
          Ctrl/⌘ + Enter 로 빠르게 쏟기
        </span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-text)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Feather size={13} />
          쏟기
        </button>
      </div>

      {recent.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {recent.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--color-text)]"
            >
              <p className="line-clamp-2">{t.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
