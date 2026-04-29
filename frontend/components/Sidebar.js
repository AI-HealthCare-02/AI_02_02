'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Droplet,
  FolderKanban,
  Heart,
  HeartPulse,
  HelpCircle,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Moon,
  Scale,
  StickyNote,
  Target,
  X,
  Zap,
} from 'lucide-react';

import AppGuideModal from './AppGuideModal';
import useConversations from '../hooks/useConversations';
import { api } from '../hooks/useApi';
import { formatUserGroupDisplay } from '../lib/userGroupLabels';

const CHAT_PATH = '/app/chat';
const CHAT_NEW_QUERY_KEY = 'new';
const CHAT_NEW_QUERY_VALUE = '1';
const DOIT_HREF = '/app/do-it-os';

const navItems = [
  {
    icon: Zap,
    label: 'Do it OS',
    href: DOIT_HREF,
    subitems: [
      { icon: LayoutGrid, label: '대시보드', href: DOIT_HREF },
      { icon: Brain, label: '생각 쏟기', href: `${DOIT_HREF}/thinking` },
      { icon: ListChecks, label: '정리 명료화', href: `${DOIT_HREF}/classify` },
      { icon: CheckCircle2, label: '할일·일정', href: `${DOIT_HREF}/schedule` },
      { icon: FolderKanban, label: '프로젝트', href: `${DOIT_HREF}/project` },
      { icon: StickyNote, label: '노트', href: `${DOIT_HREF}/note` },
      { icon: Moon, label: '자기 전 정리', href: `${DOIT_HREF}/end-of-day` },
    ],
  },
  { icon: MessageSquare, label: 'AI 채팅', href: CHAT_PATH },
  { icon: BarChart3, label: '리포트', href: '/app/report' },
  { icon: Target, label: '챌린지', href: '/app/challenge' },
];

const categories = [
  { icon: Droplet, name: '당뇨', desc: '혈당과 위험도 추적', active: true },
  { icon: Heart, name: '고혈압', desc: '혈압과 생활습관 관리', active: false },
  { icon: Scale, name: '비만', desc: '체중과 운동 관리', active: false },
  { icon: HeartPulse, name: '심혈관', desc: '심장 건강 관리', active: false },
];

function formatTime(isoString) {
  try {
    const date = new Date(isoString);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function buildChatHref({ sessionId = null, isNew = false } = {}) {
  if (sessionId) {
    return `${CHAT_PATH}?session_id=${sessionId}`;
  }

  if (isNew) {
    return `${CHAT_PATH}?${CHAT_NEW_QUERY_KEY}=${CHAT_NEW_QUERY_VALUE}`;
  }

  return CHAT_PATH;
}

export default function Sidebar({ productGuide = null }) {
  const [open, setOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState(0);
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeIsNew, setActiveIsNew] = useState(false);
  const [userName, setUserName] = useState('사용자');
  const [userGroup, setUserGroup] = useState('온보딩 미완료');
  const [userInitial, setUserInitial] = useState('?');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [guideSeen, setGuideSeen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { grouped, remove } = useConversations();

  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, []);

  // Do it OS 하위 페이지를 직접 방문/이동했을 땐 컨텍스트 보존을 위해 자동 펼침.
  // 그 외 페이지(/app/chat 등)에서는 기본 접힘 유지.
  useEffect(() => {
    if (pathname?.startsWith(DOIT_HREF)) {
      setExpandedKeys((prev) => (prev.has('Do it OS') ? prev : new Set([...prev, 'Do it OS'])));
    }
  }, [pathname]);

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

  useEffect(() => {
    async function loadSidebarState() {
      try {
        const userRes = await api('/api/v1/users/me');
        if (userRes.ok) {
          const user = await userRes.json();
          const name = user.name || '사용자';
          setUserName(name);
          setUserInitial(name.charAt(0) || '?');
        }
      } catch {}

      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (statusRes.ok) {
          const status = await statusRes.json();
          const completed = Boolean(status.is_completed);
          setHasOnboarding(completed);
          if (completed) {
            setUserGroup(formatUserGroupDisplay(status.user_group, '온보딩 완료'));
          } else {
            setUserGroup('온보딩 미완료');
          }
        }
      } catch {
        setHasOnboarding(false);
        setUserGroup('온보딩 미완료');
      }
    }

    loadSidebarState();
  }, []);
  
  useEffect(() => {
    if (!pathname.startsWith(CHAT_PATH)) return;

    const sessionId = Number(searchParams.get('session_id'));
    const isNew = searchParams.get(CHAT_NEW_QUERY_KEY) === CHAT_NEW_QUERY_VALUE;

    setActiveSessionId(Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null);
    setActiveIsNew(isNew);
  }, [pathname, searchParams]);

  const toggleExpanded = (label) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    const handler = (event) => {
      const nextSessionId = event.detail?.id ?? null;
      const nextIsNew = Boolean(event.detail?.isNew);
      setActiveSessionId(nextSessionId);
      setActiveIsNew(nextIsNew);
    };

    window.addEventListener('danaa:conversation-update', handler);
    window.addEventListener('danaa:conversation-active', handler);
    return () => {
      window.removeEventListener('danaa:conversation-update', handler);
      window.removeEventListener('danaa:conversation-active', handler);
    };
  }, []);

  const handleConversationClick = (conversation) => {
    setActiveSessionId(conversation.id);
    setActiveIsNew(false);

    if (pathname.startsWith(CHAT_PATH)) {
      window.dispatchEvent(new CustomEvent('danaa:load-session', { detail: { id: conversation.id } }));
      return;
    }

    router.push(buildChatHref({ sessionId: conversation.id }));
  };

  const handleNewChatClick = () => {
    if (!hasOnboarding) {
      alert('온보딩을 완료해야 새 대화를 시작할 수 있어요.');
      return;
    }

    setActiveSessionId(null);
    setActiveIsNew(true);

    if (typeof window !== 'undefined' && typeof window.__danaa_newChat === 'function') {
      window.__danaa_newChat();
      return;
    }

    router.push(buildChatHref({ isNew: true }));
  };

  const handleDeleteConversation = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await api(`/api/v1/chat/sessions/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      remove(deleteTarget.id);
      if (activeSessionId === deleteTarget.id) {
        setActiveSessionId(null);
        setActiveIsNew(true);
        if (typeof window !== 'undefined' && typeof window.__danaa_newChat === 'function') {
          window.__danaa_newChat();
        } else {
          router.push(buildChatHref({ isNew: true }));
        }
      }
      setDeleteTarget(null);
      window.dispatchEvent(new CustomEvent('danaa:conversation-refresh'));
    } catch {
      alert('대화 기록을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const currentCat = categories[selectedCat];
  const chatHref = useMemo(
    () => buildChatHref({ sessionId: activeSessionId, isNew: activeIsNew }),
    [activeSessionId, activeIsNew],
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`${
          open ? 'w-[300px]' : 'w-[48px]'
        } ${
          open ? 'fixed inset-y-0 left-0 z-40 md:relative md:z-auto' : ''
        } flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-cream-500 bg-[var(--sidebar-bottom)] transition-all duration-200`}
      >
        <div className="flex h-12 items-center border-b border-cream-500 px-2 shrink-0 bg-[var(--sidebar-top)]">
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-neutral-600 hover:bg-cream-400"
          >
            ☰
          </button>
          {open && (
            <Link
              href="/app/chat"
              className="ml-2 text-[16px] font-bold tracking-tight text-[var(--color-text)] transition-opacity hover:opacity-70"
            >
              DANAA
            </Link>
          )}
        </div>

        <nav className="p-1 bg-[var(--sidebar-top)]" data-tutorial="sidebar-nav">
          {navItems.map((item) => {
            const href = item.href === CHAT_PATH ? chatHref : item.href;
            const active = pathname.startsWith(item.href);
            const hasSub = Boolean(item.subitems?.length);
            const isExpanded = expandedKeys.has(item.label);

            return (
              <div key={item.label}>
                {hasSub && open ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.label)}
                    aria-expanded={isExpanded}
                    aria-label={`${item.label} 하위 메뉴 ${isExpanded ? '접기' : '펼치기'}`}
                    className={`flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2 text-left text-[14px] whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[var(--color-nav-active)] font-semibold text-nature-900'
                        : 'text-neutral-400 hover:bg-cream-400'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <item.icon size={18} />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-hint)]">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                ) : (
                  <Link
                    href={href}
                    className={`flex h-10 items-center gap-2.5 overflow-hidden rounded-lg px-2 text-[14px] whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[var(--color-nav-active)] font-semibold text-nature-900'
                        : 'text-neutral-400 hover:bg-cream-400'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <item.icon size={18} />
                    </span>
                    {open && <span>{item.label}</span>}
                  </Link>
                )}

                {hasSub && open && isExpanded && (
                  <ul className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l-2 border-[var(--color-border)] pl-2.5">
                    {item.subitems.map((sub) => {
                      const subActive = pathname === sub.href;
                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors ${
                              subActive
                                ? 'bg-[var(--color-nav-active)] font-medium text-nature-900'
                                : 'text-neutral-400 hover:bg-cream-400'
                            }`}
                          >
                            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${subActive ? 'bg-nature-500' : 'bg-[var(--color-text-hint)]/60'}`} />
                            <sub.icon size={13} className="shrink-0" />
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {open && (
          <div className="mt-1 flex-1 overflow-y-auto custom-scroll border-t border-cream-500 px-2">
            <button
              onClick={handleNewChatClick}
              className="mt-2 mb-1 w-full rounded-lg border border-dashed border-cream-500 bg-transparent px-2 py-2.5 text-[15px] text-neutral-400 transition-colors hover:bg-cream-400"
            >
              + 새 대화
            </button>
            {hasOnboarding ? (
              grouped.length > 0 ? (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 pt-3 pb-1.5 text-[13px] font-semibold tracking-wider text-[var(--color-text-hint)] uppercase">
                      {group.label}
                    </div>
                    {group.items.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => handleConversationClick(conversation)}
                        className={`group/conversation mb-0.5 flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-[15px] transition-all ${
                          activeSessionId === conversation.id && !activeIsNew
                            ? 'bg-[var(--color-nav-active)] font-semibold text-nature-900'
                            : 'text-neutral-400 hover:bg-cream-300 hover:text-nature-900'
                        }`}
                      >
                        <span className="mr-2 flex-1 truncate">{conversation.title}</span>
                        <span className="shrink-0 text-[13px] text-[var(--color-message-meta)] group-hover/conversation:hidden">
                          {formatTime(conversation.updatedAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(conversation);
                          }}
                          aria-label="대화 삭제"
                          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-cream-500 hover:text-danger group-hover/conversation:flex"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="mb-2">
                      <MessageSquare size={24} className="mx-auto text-[var(--color-text-hint)]" />
                    </div>
                    <div className="text-[14px] text-neutral-400">새 대화를 시작해보세요</div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="mb-2">
                    <MessageSquare size={24} className="mx-auto text-[var(--color-text-hint)]" />
                  </div>
                  <div className="text-[14px] leading-[1.55] text-neutral-400">
                    온보딩 완료 후
                    <br />
                    대화 기록이 표시됩니다
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!open && (
          <div className="mt-auto flex flex-col items-center gap-1.5 border-t border-cream-500 py-1.5">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-cream-400 hover:text-nature-900"
              aria-label="서비스 안내 열기"
            >
              <HelpCircle size={15} />
            </button>
            <a
              href="/do-it-os-guide.html"
              target="_blank"
              rel="noopener noreferrer"
              onClick={markGuideSeen}
              className="relative flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-cream-400 hover:text-nature-900"
              aria-label="Do it OS 학습 가이드 새 탭으로 열기"
              title="Do it OS 학습 가이드"
            >
              <Zap size={13} />
              {!guideSeen && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500"
                />
              )}
            </a>
            <span className="text-sm">
              <currentCat.icon size={16} />
            </span>
            <Link
              href="/app/settings"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-400 text-[13px] font-semibold text-neutral-400 transition-colors hover:bg-cream-500"
            >
              {userInitial}
            </Link>
          </div>
        )}

        {open && (
          <div className="shrink-0 border-t border-cream-500 px-2 py-2">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-full border border-cream-500 bg-cream-400 px-3 py-2.5 text-[14px] text-neutral-500 transition-colors hover:bg-cream-500 hover:text-nature-900"
            >
              <HelpCircle size={14} />
              서비스 안내
            </button>

            <div className="relative">
              <button
                onClick={() => setCatOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-cream-400"
              >
                <div className="flex items-center gap-2 text-[15px]">
                  <currentCat.icon size={16} className={currentCat.active ? 'text-nature-500' : 'text-[var(--color-text-hint)]'} />
                  <div>
                    <div className={`font-medium ${currentCat.active ? 'text-nature-900' : 'text-[var(--color-text-hint)]'}`}>{currentCat.name}</div>
                    <div className="text-[13px] text-[var(--color-text-hint)]">{currentCat.desc}</div>
                  </div>
                </div>
                <span className="text-[var(--color-text-hint)]">{catOpen ? '▾' : '▸'}</span>
              </button>

              {catOpen && (
                <div className="absolute bottom-full left-0 right-0 z-20 mb-2 space-y-1 rounded-xl border border-cream-500 bg-[var(--color-surface)] p-2 shadow-soft">
                  {categories.map((category, index) => {
                    const isAvailable = index === 0;
                    return (
                      <button
                        key={category.name}
                        onClick={() => {
                          if (!isAvailable) return;
                          setSelectedCat(index);
                          setCatOpen(false);
                        }}
                        disabled={!isAvailable}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-[14px] transition-colors ${
                          selectedCat === index
                            ? 'bg-cream-400 text-nature-900'
                            : isAvailable
                              ? 'text-neutral-400 hover:bg-cream-400/70'
                              : 'cursor-not-allowed text-[#9A948B]'
                        }`}
                      >
                        <category.icon size={14} className={isAvailable ? 'text-nature-500' : 'text-[var(--color-text-hint)]'} />
                        <div>
                          <div className="font-medium">{category.name}</div>
                          <div className="text-[12px] text-[var(--color-text-hint)]">
                            {isAvailable ? category.desc : '준비 중'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between rounded-lg px-2 py-2">
              <div>
                <div className="text-[15px] font-medium text-nature-900">{userName}</div>
                <div className="text-[13px] text-[var(--color-text-hint)]">{userGroup}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href="/do-it-os-guide.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={markGuideSeen}
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border border-cream-500 text-neutral-400 transition-colors hover:bg-cream-400 hover:text-nature-900"
                  aria-label="Do it OS 학습 가이드 새 탭으로 열기"
                  title="Do it OS 학습 가이드"
                >
                  <Zap size={13} />
                  {!guideSeen && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500"
                    />
                  )}
                </a>
                <Link
                  href="/app/settings"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-cream-500 text-neutral-400 transition-colors hover:bg-cream-400 hover:text-nature-900"
                  aria-label="설정 열기"
                >
                  ⚙
                </Link>
              </div>
            </div>
          </div>
        )}
      </aside>

      {isGuideOpen && (
        <AppGuideModal guide={productGuide} onClose={() => setIsGuideOpen(false)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-[360px] rounded-xl border border-cream-500 bg-[var(--color-surface)] p-5 shadow-soft">
            <h3 className="text-[16px] font-semibold text-nature-900">대화를 삭제하시겠습니까?</h3>
            <p className="mt-2 text-[14px] leading-[1.55] text-neutral-500">
              "{deleteTarget.title}" 대화가 목록에서 삭제됩니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-lg border border-cream-500 px-3.5 py-2 text-[14px] text-neutral-500 transition-colors hover:bg-cream-300 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                disabled={isDeleting}
                className="rounded-lg bg-danger px-3.5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-danger-light disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
