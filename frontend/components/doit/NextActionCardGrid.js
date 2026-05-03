'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  Clock,
  Eye,
  MessageCircle,
  Phone,
  Scale,
  StickyNote,
  Undo2,
  Users,
} from 'lucide-react';

import {
  loadThoughts,
  removeThought,
  saveThoughts,
  todayIso,
} from '../../lib/doit_store';
import { nextNonOverlappingPosition, randInt, clampToCanvas } from '../../lib/doit_canvas_layout';

const PRESETS = [
  { id: 'todo',      label: '할 일 추가',   category: 'todo',     icon: Check,          href: '/app/do-it-os' },
  { id: 'schedule',  label: '일정 잡기',    category: 'schedule', icon: Calendar,       href: '/app/do-it-os/schedule' },
  { id: 'note',      label: '노트 작성',    category: 'note',     icon: StickyNote,     href: '/app/do-it-os/note' },
  { id: 'meeting',   label: '회의 준비',    category: 'note',     icon: Users,          href: '/app/do-it-os/note' },
  { id: 'contact',   label: '연락하기',     category: 'todo',     icon: Phone,          href: '/app/do-it-os' },
  { id: 'research',  label: '조사·학습',    category: 'note',     icon: BookOpen,       href: '/app/do-it-os/note' },
  { id: 'decide',    label: '결정하기',     category: 'todo',     icon: Scale,          href: '/app/do-it-os' },
  { id: 'feedback',  label: '피드백 받기',  category: 'todo',     icon: MessageCircle,  href: '/app/do-it-os' },
  { id: 'review',    label: '리뷰·확인',   category: 'todo',     icon: Eye,            href: '/app/do-it-os' },
  { id: 'extend',    label: '마감 연장',    category: 'schedule', icon: Clock,          href: '/app/do-it-os/schedule' },
];

const MEMO_COLORS = ['cream', 'stone', 'mint', 'lavender', 'blush'];

const CARD_SIZE = { width: 280, height: 160 };

function makeThought({ preset, projectTitle, projectId, canvasSize, existingCards }) {
  const now = new Date().toISOString();
  const extraMeta = preset.category === 'schedule' ? { scheduledDate: todayIso() } : {};
  const pos = nextNonOverlappingPosition({
    canvas: canvasSize,
    existingCards: existingCards,
    cardSize: CARD_SIZE,
  });
  return {
    id: `t-${Date.now()}-${randInt(1000, 9999)}`,
    text: projectTitle
      ? `${preset.label} — ${projectTitle}`
      : preset.label,
    createdAt: now,
    category: preset.category,
    classifiedAt: now,
    projectLinkId: projectId || null,
    x: pos.x,
    y: pos.y,
    rotation: randInt(-3, 3),
    color: MEMO_COLORS[randInt(0, MEMO_COLORS.length - 1)],
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    ...extraMeta,
  };
}

export default function NextActionCardGrid({ projectId, projectTitle }) {
  const [toast, setToast] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const toastTimerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  // 캔버스 컨테이너 크기 측정 + viewport 리사이즈 시 이탈 카드 clamp
  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!(width > 0 && height > 0)) continue;
        setCanvasSize((prev) => {
          const next = { width, height };
          // viewport 크기가 50px 이상 변하면 카드 좌표 clamp
          if (
            prev &&
            (Math.abs(prev.width - width) > 50 || Math.abs(prev.height - height) > 50)
          ) {
            requestAnimationFrame(() => {
              const current = loadThoughts();
              const clamped = current.map((t) => {
                if (typeof t.x !== 'number' || typeof t.y !== 'number') return t;
                const cardW = t.width || CARD_SIZE.width;
                const cardH = t.height || CARD_SIZE.height;
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
              if (
                clamped.some(
                  (t, i) =>
                    t.x !== current[i].x || t.y !== current[i].y,
                )
              ) {
                saveThoughts(clamped);
              }
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

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const scheduleDismiss = useCallback(() => {
    clearToast();
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3600);
  }, [clearToast]);

  // race condition 회피: load→write 사이 다른 탭 쓰기 보호를 위해
  // 한 번의 함수형 업데이트 블록에서 읽고 쓴다.
  const handlePick = useCallback(
    (preset) => {
      const current = loadThoughts();
      // 빠른 연속 입력 시 stale canvasSize 방지: getBoundingClientRect() 로 live 측정
      let liveCanvas = canvasSize;
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          liveCanvas = { width: rect.width, height: rect.height };
        }
      }
      // 이미 분류된 카드들을 existingCards 로 전달 — 겹침 방지
      const thought = makeThought({
        preset,
        projectTitle,
        projectId,
        canvasSize: liveCanvas,
        existingCards: current,
      });
      const next = [...current, thought];
      saveThoughts(next);
      setToast({ id: thought.id, preset });
      scheduleDismiss();
    },
    [projectTitle, projectId, canvasSize, scheduleDismiss],
  );

  const handleUndo = useCallback(() => {
    if (!toast) return;
    // 한 번에 load→filter→save. 사이에 끼어드는 쓰기가 있어도
    // 제거 대상 id가 없으면 noop, 있으면 안전하게 제거.
    const current = loadThoughts();
    const next = removeThought(current, toast.id);
    saveThoughts(next);
    clearToast();
    setToast(null);
  }, [toast, clearToast]);

  return (
    <div ref={canvasRef} className="doit-next-action-grid">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-5">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePick(preset)}
              className="group inline-flex flex-col items-start gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)]"
            >
              <Icon size={14} className="text-[var(--color-text-secondary)]" />
              <span className="text-[12.5px] font-medium text-[var(--color-text)]">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="doit-toast" role="status" aria-live="polite">
          <span className="text-[13px]">
            <strong className="font-semibold">{toast.preset.label}</strong> 생성됐어요
          </span>
          <Link
            href={toast.preset.href}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-white/20"
          >
            보기
          </Link>
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
    </div>
  );
}
