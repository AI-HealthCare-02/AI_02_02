'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Droplet,
  Heart,
  HeartPulse,
  HelpCircle,
  MessageSquare,
  Scale,
  Target,
} from 'lucide-react';

import AppGuideModal from './AppGuideModal';
import useConversations from '../hooks/useConversations';
import { api } from '../hooks/useApi';

const CHAT_PATH = '/app/chat';
const CHAT_NEW_QUERY_KEY = 'new';
const CHAT_NEW_QUERY_VALUE = '1';

const navItems = [
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { grouped } = useConversations();

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
            setUserGroup(status.user_group ? `${status.user_group} 그룹` : '온보딩 완료');
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

  const currentCat = categories[selectedCat];
  const chatHref = useMemo(
    () => buildChatHref({ sessionId: activeSessionId, isNew: activeIsNew }),
    [activeSessionId, activeIsNew],
  );

  return (
    <>
      <aside
        className={`${
          open ? 'w-[300px]' : 'w-[48px]'
        } flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-black/[.06] bg-white/90 backdrop-blur-2xl transition-all duration-200`}
      >
        <div className="flex h-12 items-center border-b border-black/[.04] px-2 shrink-0">
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-neutral-600 hover:bg-black/[.03]"
          >
            ☰
          </button>
          {open && (
            <Link
              href="/"
              className="ml-2 text-[16px] font-bold tracking-tight text-nature-900 transition-opacity hover:opacity-70"
            >
              DANAA
            </Link>
          )}
        </div>

        <nav className="p-1" data-tutorial="sidebar-nav">
          {navItems.map((item) => {
            const href = item.href === CHAT_PATH ? chatHref : item.href;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={href}
                className={`flex h-10 items-center gap-2.5 overflow-hidden rounded-lg px-2 text-[14px] whitespace-nowrap transition-colors ${
                  active ? 'bg-cream-300 font-medium text-nature-900' : 'text-neutral-400 hover:bg-black/[.03]'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <item.icon size={18} />
                </span>
                {open && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {open && (
          <div className="mt-1 flex-1 overflow-y-auto border-t border-black/[.04] px-2">
            <button
              onClick={handleNewChatClick}
              className="mt-2 mb-1 w-full rounded-lg border border-dashed border-black/[.08] bg-transparent px-2 py-2 text-[13px] text-neutral-400 transition-colors hover:bg-black/[.03]"
            >
              + 새 대화
            </button>

            {hasOnboarding ? (
              grouped.length > 0 ? (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-neutral-300 uppercase">
                      {group.label}
                    </div>
                    {group.items.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => handleConversationClick(conversation)}
                        className={`mb-0.5 flex cursor-pointer justify-between rounded-md px-2 py-1.5 text-[13px] transition-all ${
                          activeSessionId === conversation.id && !activeIsNew
                            ? 'bg-cream-300 font-medium text-nature-900'
                            : 'text-neutral-400 hover:bg-cream-300 hover:text-nature-900'
                        }`}
                      >
                        <span className="mr-2 flex-1 truncate">{conversation.title}</span>
                        <span className="shrink-0 text-[11px] text-neutral-300">
                          {formatTime(conversation.updatedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="mb-2">
                      <MessageSquare size={24} className="mx-auto text-neutral-300" />
                    </div>
                    <div className="text-[12px] text-neutral-400">새 대화를 시작해보세요</div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="mb-2">
                    <MessageSquare size={24} className="mx-auto text-neutral-300" />
                  </div>
                  <div className="text-[12px] text-neutral-400">
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
          <div className="mt-auto flex flex-col items-center gap-1.5 border-t border-black/[.04] py-1.5">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/[.03] hover:text-nature-900"
              aria-label="서비스 안내 열기"
            >
              <HelpCircle size={15} />
            </button>
            <span className="text-sm">
              <currentCat.icon size={16} />
            </span>
            <Link
              href="/app/settings"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-400 text-[11px] font-semibold text-neutral-400 transition-colors hover:bg-cream-500"
            >
              {userInitial}
            </Link>
          </div>
        )}

        {open && (
          <div className="shrink-0 border-t border-black/[.04] px-2 py-2">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-full border border-black/[.06] bg-white px-3 py-2 text-[12px] text-neutral-500 transition-colors hover:bg-black/[.03] hover:text-nature-900"
            >
              <HelpCircle size={14} />
              서비스 안내
            </button>

            <button
              onClick={() => setCatOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-black/[.03]"
            >
              <div className="flex items-center gap-2 text-[13px]">
                <currentCat.icon size={16} className={currentCat.active ? 'text-nature-500' : 'text-neutral-300'} />
                <div>
                  <div className={`font-medium ${currentCat.active ? 'text-nature-900' : 'text-neutral-300'}`}>{currentCat.name}</div>
                  <div className="text-[11px] text-neutral-300">{currentCat.desc}</div>
                </div>
              </div>
              <span className="text-neutral-300">{catOpen ? '▾' : '▸'}</span>
            </button>

            {catOpen && (
              <div className="mt-2 space-y-1 rounded-xl bg-cream-300 p-2">
                {categories.map((category, index) => (
                  <button
                    key={category.name}
                    onClick={() => {
                      setSelectedCat(index);
                      setCatOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition-colors ${
                      selectedCat === index ? 'bg-white text-nature-900' : 'text-neutral-400 hover:bg-white/70'
                    }`}
                  >
                    <category.icon size={14} className={category.active ? 'text-nature-500' : 'text-neutral-300'} />
                    <div>
                      <div className="font-medium">{category.name}</div>
                      <div className="text-[10px] text-neutral-300">{category.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between rounded-lg px-2 py-2">
              <div>
                <div className="text-[13px] font-medium text-nature-900">{userName}</div>
                <div className="text-[11px] text-neutral-300">{userGroup}</div>
              </div>
              <Link
                href="/app/settings"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-black/[.06] text-neutral-400 transition-colors hover:bg-black/[.03] hover:text-nature-900"
                aria-label="설정 열기"
              >
                ⚙
              </Link>
            </div>
          </div>
        )}
      </aside>

      {isGuideOpen && (
        <AppGuideModal guide={productGuide} onClose={() => setIsGuideOpen(false)} />
      )}
    </>
  );
}
