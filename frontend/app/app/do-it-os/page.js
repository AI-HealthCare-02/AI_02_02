'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calendar,
  FolderKanban,
  HeartPulse,
  Inbox,
  ListChecks,
  Moon,
  Shield,
  StickyNote,
  X,
} from 'lucide-react';

import {
  STORAGE_KEY,
  getOverdueScheduled,
  getSummary,
  getTodayScheduled,
  loadThoughts,
} from '../../../lib/doit_store';
import ClassifiedBoard from '../../../components/doit/ClassifiedBoard';
import EveningCta from '../../../components/doit/EveningCta';
import { formatFriendlyDate } from '../../../components/doit/DateChip';

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function DoItOsDashboard() {
  const [thoughts, setThoughts] = useState([]);
  const [guideSeen, setGuideSeen] = useState(true);

  useEffect(() => {
    setThoughts(loadThoughts());
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setThoughts(loadThoughts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    try {
      setGuideSeen(localStorage.getItem('danaa_doit_guide_seen_v1') === '1');
    } catch {
      setGuideSeen(true);
    }
  }, []);

  const markGuideSeen = () => {
    try {
      localStorage.setItem('danaa_doit_guide_seen_v1', '1');
    } catch {}
    setGuideSeen(true);
  };

  const recent = useMemo(
    () => thoughts.filter((t) => !t.category).slice(-5).reverse(),
    [thoughts],
  );

  const todaySchedules = useMemo(() => getTodayScheduled(thoughts), [thoughts]);
  const todayPreview = todaySchedules.slice(0, 3);
  const todayOverflow = todaySchedules.length - todayPreview.length;
  const overdueCount = useMemo(
    () => getOverdueScheduled(thoughts).length,
    [thoughts],
  );
  const summary = useMemo(() => getSummary(thoughts), [thoughts]);
  const waitingCount = summary.byCategory?.waiting ?? 0;
  const somedayCount = summary.byCategory?.someday ?? 0;
  const todayUnfinishedCount = todaySchedules.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-10">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-text)]">
            Do it OS
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
            오늘 머릿속을 꺼내서 정리해요.
          </p>
        </header>

        {!guideSeen && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-primary-light)] bg-[var(--color-primary-light)]/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[16px]" aria-hidden="true">📖</span>
              <span className="text-[13.5px] text-[var(--color-text)]">
                Do it OS가 처음이에요? 3분 가이드로 전체 흐름을 먼저 익혀보세요.
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href="/do-it-os-guide.html"
                target="_blank"
                rel="noopener noreferrer"
                onClick={markGuideSeen}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-cta-text)] hover:opacity-90"
              >
                가이드 보기 →
              </a>
              <button
                type="button"
                onClick={markGuideSeen}
                aria-label="배너 닫기"
                className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-hint)] hover:bg-[var(--color-surface-hover)]"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <div className="mb-3 flex gap-3 text-[12px] text-[var(--color-text-hint)]">
          <span>미분류 {summary.unclassified}</span>
          <span>·</span>
          <span>대기 중 {waitingCount}</span>
          <span>·</span>
          <span>언젠가 {somedayCount}</span>
        </div>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="doit-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox size={16} className="text-[var(--color-text-secondary)]" />
                <h2 className="text-[15px] font-semibold">생각 Inbox</h2>
              </div>
              <span className="text-[12px] text-[var(--color-text-hint)]">
                미분류 최근 {recent.length}개
              </span>
            </div>

            {recent.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--color-text-hint)]">
                아직 적은 메모가 없어요
              </p>
            ) : (
              <ul className="space-y-2">
                {recent.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2 text-[13px] leading-[1.5]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[var(--color-text)]">{t.text}</p>
                        {t.plannedDate && (
                          <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--doit-cat-violet-bg)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--doit-cat-violet-fg)]">
                            🌙 내일 하기로
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--color-text-hint)]">
                        {formatRelative(t.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/app/do-it-os/thinking"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <Brain size={13} />
              더 적으러 가기
            </Link>
          </div>

          <div className="doit-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[var(--color-text-secondary)]" />
                <h2 className="text-[15px] font-semibold">오늘 일정</h2>
                {todaySchedules.length > 0 && (
                  <span className="text-[12px] text-[var(--color-text-hint)]">
                    {todaySchedules.length}개
                  </span>
                )}
              </div>
              {overdueCount > 0 && (
                <Link
                  href="/app/do-it-os/schedule"
                  className="inline-flex items-center gap-1 rounded-full bg-[rgba(224,120,0,0.22)] px-2.5 py-0.5 text-[11px] font-semibold text-[#8E5400] hover:bg-[rgba(224,120,0,0.32)] dark:text-[#E0A856]"
                >
                  <AlertTriangle size={11} />
                  기한 지남 {overdueCount}
                </Link>
              )}
            </div>

            {todayPreview.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                <p className="text-[13px] text-[var(--color-text-hint)]">
                  오늘 예정된 일정이 없어요
                </p>
                <Link
                  href="/app/do-it-os/classify"
                  className="mt-2 text-[12px] text-[var(--color-text-secondary)] hover:underline"
                >
                  일정으로 정리하러 가기 →
                </Link>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {todayPreview.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-surface-subtle)] px-3 py-2"
                    >
                      <p className="line-clamp-2 text-[13px] leading-[1.5] text-[var(--color-text)]">
                        {t.text}
                      </p>
                    </li>
                  ))}
                </ul>
                {todayOverflow > 0 && (
                  <p className="mt-2 text-[11.5px] text-[var(--color-text-hint)]">
                    +{todayOverflow}개 더
                  </p>
                )}
                <Link
                  href="/app/do-it-os/schedule"
                  className="mt-3 inline-flex items-center gap-1 text-[12px] text-[var(--color-text-secondary)] hover:underline"
                >
                  일정 전체 보기
                  <ArrowRight size={11} />
                </Link>
              </>
            )}
          </div>
        </section>

        <EveningCta
          unclassified={summary.unclassified}
          todayUnfinished={todayUnfinishedCount}
        />

        <section className="mt-5 doit-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-[var(--color-text-secondary)]" />
              <h2 className="text-[15px] font-semibold">정리 결과 보드</h2>
            </div>
            <Link
              href="/app/do-it-os/classify"
              className="text-[12px] text-[var(--color-text-secondary)] hover:underline"
            >
              정리하러 가기 →
            </Link>
          </div>
          <ClassifiedBoard
            thoughts={thoughts}
            compact
            emptyHint="생각을 정리하면 여기에 모여요"
          />
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { icon: FolderKanban, label: '프로젝트', href: '/app/do-it-os/project', desc: '큰 흐름을 묶어요' },
            { icon: StickyNote, label: '노트', href: '/app/do-it-os/note', desc: '참고할 생각을 보관' },
            { icon: HeartPulse, label: '건강 단서', href: '/app/do-it-os/note', desc: '몸과 마음 메모' },
            { icon: Moon, label: '자기 전 정리', href: '/app/do-it-os/end-of-day', desc: '오늘의 생각을 내려놓아요' },
            { icon: Shield, label: '저장 원칙', href: '/app/do-it-os', desc: 'AI가 임의 저장 안 해요' },
          ].map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="doit-card-strip"
            >
              <card.icon size={15} className="text-[var(--color-text-secondary)]" />
              <div className="mt-1.5 text-[13px] font-medium text-[var(--color-text)]">
                {card.label}
              </div>
              <div className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--color-text-hint)]">
                {card.desc}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
