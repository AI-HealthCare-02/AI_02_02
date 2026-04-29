'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { nextNonOverlappingPosition, relayoutZeroCards, clampToCanvas, randInt } from '../../lib/doit_canvas_layout';
import { loadThoughts, saveThoughts } from '../../lib/doit_store';

const COLOR_KEYS = ['cream', 'stone', 'mint', 'lavender', 'blush'];
const MAX_THOUGHTS = 5000;

function measureSize(text) {
  const len = text.length;
  if (len < 28) return { width: 200, height: 120 };
  if (len < 70) return { width: 240, height: 140 };
  return { width: 280, height: 160 };
}

function createThought(text, canvas, existingThoughts = [], excludeColor = null) {
  const size = measureSize(text);
  const cardSize = { width: size.width, height: size.height };
  const pos = nextNonOverlappingPosition({ canvas, existingCards: existingThoughts, cardSize });
  const pool = excludeColor
    ? COLOR_KEYS.filter((k) => k !== excludeColor)
    : COLOR_KEYS;

  return {
    id: `t-${Date.now()}-${randInt(1000, 9999)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    x: pos.x,
    y: pos.y,
    rotation: randInt(-4, 4),
    color: pool[randInt(0, pool.length - 1)],
    width: cardSize.width,
    height: cardSize.height,
  };
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
  const [canvasSize, setCanvasSize] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState(null);
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

  // canvasSize 확정 후 stuck (0,0·null·NaN) 카드 자동 재배치.
  // 자기 전 정리 등에서 새로 추가된 null 좌표 카드도 매번 메인 캔버스 진입 시 정리.
  useEffect(() => {
    if (!canvasSize) return;
    const all = loadThoughts();
    const stuck = all.filter((t) =>
      t.x === null || t.y === null ||
      typeof t.x !== 'number' || typeof t.y !== 'number' ||
      Number.isNaN(t.x) || Number.isNaN(t.y) ||
      (t.x === 0 && t.y === 0 && all.length > 1)
    );
    if (stuck.length === 0) return;
    const fixed = relayoutZeroCards(all, canvasSize);
    saveThoughts(fixed);
    setThoughts(fixed);
    // 토스트는 처음 발견 시 1회만
    const TOAST_SHOWN = 'danaa_doit_layout_toast_shown_v1';
    if (localStorage.getItem(TOAST_SHOWN) !== '1') {
      setMigrationNotice(`겹쳐 있던 메모 ${stuck.length}개를 캔버스에 정리했어요.`);
      localStorage.setItem(TOAST_SHOWN, '1');
      const timer = setTimeout(() => setMigrationNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [canvasSize]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize((prev) => {
          const next = { width, height };
          // viewport 크기가 50px 이상 변하면 viewport 밖 카드 clamp
          if (
            prev &&
            (Math.abs(prev.width - width) > 50 || Math.abs(prev.height - height) > 50)
          ) {
            // race condition 방지: 다음 프레임에서 clamp 실행
            requestAnimationFrame(() => {
              setThoughts((currentThoughts) => {
                const clamped = currentThoughts.map((t) => {
                  if (typeof t.x !== 'number' || typeof t.y !== 'number') return t;
                  const cardW = t.width || 240;
                  const cardH = t.height || 140;
                  const isOutside =
                    t.x + cardW > width - 12 || t.y + cardH > height - 12;
                  if (!isOutside) return t;
                  const pos = clampToCanvas({
                    x: t.x,
                    y: t.y,
                    width: cardW,
                    height: cardH,
                    canvas: next,
                  });
                  return { ...t, x: pos.x, y: pos.y };
                });
                // 변경된 카드가 있으면 localStorage 에도 반영
                if (
                  clamped.some(
                    (t, i) =>
                      t.x !== currentThoughts[i].x || t.y !== currentThoughts[i].y,
                  )
                ) {
                  saveThoughts(clamped);
                }
                return clamped;
              });
            });
          }
          return next;
        });
      }
    });
    // 초기 측정
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setCanvasSize({ width: rect.width, height: rect.height });
    }
    observer.observe(el);
    return () => observer.disconnect();
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
    if (!canvasSize) return;
    if (thoughts.length >= MAX_THOUGHTS) return;
    // 빠른 연속 입력 시 ResizeObserver 콜백 전에 canvasSize 가 stale 일 수 있으므로
    // getBoundingClientRect() 로 직접 측정한 liveCanvas 를 우선 사용
    let liveCanvas = canvasSize;
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        liveCanvas = { width: rect.width, height: rect.height };
      }
    }
    const lastVisible = visibleThoughts[visibleThoughts.length - 1];
    const lastColor = lastVisible ? lastVisible.color : null;
    const next = createThought(text, liveCanvas, visibleThoughts, lastColor);
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
        {migrationNotice && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(57,198,179,0.95)', color: 'white',
            padding: '12px 20px', borderRadius: 8,
            fontSize: 14, fontWeight: 600, zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
          }}>
            {migrationNotice}
          </div>
        )}
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
            disabled={!canvasSize}
            placeholder="머릿속에 떠오른 것을 적어보세요. Enter 누르면 위로 쏟아져요 (줄바꿈은 Shift+Enter)"
            className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--color-text)] placeholder:text-[var(--color-text-hint)] focus:border-[var(--color-border-focus)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addThought}
            disabled={!draft.trim() || !canvasSize}
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
