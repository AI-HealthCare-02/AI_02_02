'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'danaa_doit_thoughts_v1';
const COLOR_KEYS = ['cream', 'stone', 'mint', 'lavender', 'blush'];
const MAX_THOUGHTS = 5000;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function measureSize(text) {
  const len = text.length;
  if (len < 28) return { width: 200, height: 120 };
  if (len < 70) return { width: 240, height: 140 };
  return { width: 280, height: 160 };
}

function createThought(text, canvas, excludeColor = null) {
  const size = measureSize(text);
  const padding = 12;
  const maxX = Math.max(canvas.width - size.width - padding, padding);
  const maxY = Math.max(canvas.height - size.height - padding, padding);
  const pool = excludeColor
    ? COLOR_KEYS.filter((k) => k !== excludeColor)
    : COLOR_KEYS;

  return {
    id: `t-${Date.now()}-${randInt(1000, 9999)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    x: randInt(padding, maxX),
    y: randInt(padding, maxY),
    rotation: randInt(-4, 4),
    color: pool[randInt(0, pool.length - 1)],
    width: size.width,
    height: size.height,
  };
}

function loadThoughts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveThoughts(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 용량 초과 등 — 조용히 실패 (사용자 경험 우선, 경고는 상위에서)
  }
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
}

export default function ThoughtCanvas() {
  const [thoughts, setThoughts] = useState([]);
  const [draft, setDraft] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 });
  const [hydrated, setHydrated] = useState(false);
  const canvasRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setThoughts(loadThoughts());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveThoughts(thoughts);
  }, [thoughts, hydrated]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => resize.disconnect();
  }, []);

  // 생각 쏟기 캔버스는 "미분류 메모"만 보여준다.
  // 분류된 메모는 정리 명료화·투영 뷰(프로젝트/일정/노트)에서 관리.
  const visibleThoughts = useMemo(
    () => thoughts.filter((t) => !t.category),
    [thoughts],
  );

  const addThought = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (thoughts.length >= MAX_THOUGHTS) return;
    const lastVisible = visibleThoughts[visibleThoughts.length - 1];
    const lastColor = lastVisible ? lastVisible.color : null;
    const next = createThought(text, canvasSize, lastColor);
    setThoughts((prev) => [...prev, next]);
    setDraft('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [draft, thoughts.length, visibleThoughts, canvasSize]);

  const removeThought = useCallback((id) => {
    setThoughts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addThought();
    }
  };

  const isEmpty = visibleThoughts.length === 0;

  const capacityWarning = useMemo(() => {
    if (thoughts.length >= MAX_THOUGHTS * 0.9) {
      return `메모가 ${thoughts.length}개예요. 오래된 항목을 정리해 주세요.`;
    }
    return null;
  }, [thoughts.length]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex items-stretch justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex flex-col">
          <h1 className="flex items-center gap-1.5 text-[20px] font-bold tracking-tight text-[var(--color-text)]">
            <Sparkles size={16} className="text-[var(--color-text-secondary)]" />
            생각 쏟기
          </h1>
          <p className="mt-auto text-[13px] text-[var(--color-text-hint)]">
            떠오르는 걸 그대로 적어 주세요. 정리는 나중에 해요.
          </p>
        </div>
        <Link
          href="/app/do-it-os/classify"
          className="mt-10 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          생각 정리하러 가기
          <ArrowRight size={13} />
        </Link>
      </header>

      {capacityWarning && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-6 py-2 text-[12px] text-[var(--color-text-secondary)]">
          {capacityWarning}
        </div>
      )}

      <div
        ref={canvasRef}
        className="doit-canvas relative flex-1 overflow-hidden bg-[var(--color-bg)]"
      >
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="max-w-sm px-6 text-center text-[14px] leading-[1.6] text-[var(--color-text-hint)]">
              {thoughts.length === 0
                ? '아직 아무것도 없어요.'
                : '미분류 메모가 없어요. 모두 정리되었네요!'}
              <br />
              {thoughts.length === 0 ? '떠오르는 것부터 적어보세요.' : '또 떠오르는 것을 적어보세요.'}
            </p>
          </div>
        ) : (
          visibleThoughts.map((t) => (
            <div
              key={t.id}
              className="doit-memo group"
              style={{
                left: `${t.x}px`,
                top: `${t.y}px`,
                width: `${t.width}px`,
                height: `${t.height}px`,
                transform: `rotate(${t.rotation}deg)`,
                background: `var(--doit-memo-${t.color})`,
              }}
            >
              <button
                type="button"
                onClick={() => removeThought(t.id)}
                aria-label="메모 삭제"
                className="doit-memo-close"
              >
                <X size={12} />
              </button>
              <p className="doit-memo-text">{t.text}</p>
              <span className="doit-memo-meta">{formatTime(t.createdAt)}</span>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <div className="mx-auto flex max-w-[860px] items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="머릿속에 떠오른 것을 적어보세요. Enter 누르면 위로 쏟아져요 (줄바꿈은 Shift+Enter)"
            className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:border-[var(--color-border-focus)] focus:outline-none"
          />
          <button
            type="button"
            onClick={addThought}
            disabled={!draft.trim()}
            className="h-12 shrink-0 rounded-xl bg-[var(--color-cta-bg)] px-5 text-[14px] font-medium text-[var(--color-cta-text)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            쏟아내기
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-[860px] text-[11.5px] text-[var(--color-text-hint)]">
          {visibleThoughts.length > 0
            ? `지금 캔버스에 ${visibleThoughts.length}개의 생각이 있어요 · 정리되면 사라져요`
            : 'AI는 스스로 기록하지 않아요. 사용자가 확인한 것만 저장해요.'}
        </p>
      </div>
    </div>
  );
}
