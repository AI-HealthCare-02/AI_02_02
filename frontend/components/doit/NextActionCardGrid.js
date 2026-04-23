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
  STORAGE_KEY,
  loadThoughts,
  removeThought,
  saveThoughts,
  todayIso,
} from '../../lib/doit_store';

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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeThought({ preset, projectTitle, projectId }) {
  const now = new Date().toISOString();
  const extraMeta = preset.category === 'schedule' ? { scheduledDate: todayIso() } : {};
  return {
    id: `t-${Date.now()}-${randInt(1000, 9999)}`,
    text: projectTitle
      ? `${preset.label} — ${projectTitle}`
      : preset.label,
    createdAt: now,
    category: preset.category,
    classifiedAt: now,
    projectLinkId: projectId || null,
    x: randInt(40, 400),
    y: randInt(40, 260),
    rotation: randInt(-3, 3),
    color: MEMO_COLORS[randInt(0, MEMO_COLORS.length - 1)],
    width: 220,
    height: 120,
    ...extraMeta,
  };
}

export default function NextActionCardGrid({ projectId, projectTitle }) {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
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
  // 한 번의 함수형 업데이트 블록에서 읽고 쓰되, 즉시 localStorage 반영.
  const handlePick = useCallback(
    (preset) => {
      const thought = makeThought({ preset, projectTitle, projectId });
      const current = loadThoughts();
      const next = [...current, thought];
      saveThoughts(next);
      setToast({ id: thought.id, preset });
      scheduleDismiss();
    },
    [projectTitle, projectId, scheduleDismiss],
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
    <div className="doit-next-action-grid">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
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
