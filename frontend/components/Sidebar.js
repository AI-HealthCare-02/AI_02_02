'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Droplet,
  Heart,
  HeartPulse,
  MessageSquare,
  Scale,
  Settings,
  Target,
} from 'lucide-react';

import useConversations from '../hooks/useConversations';
import { api } from '../hooks/useApi';

const navItems = [
  { icon: MessageSquare, label: 'AI 채팅', href: '/app/chat' },
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

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState(0);
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [userName, setUserName] = useState('사용자');
  const [userGroup, setUserGroup] = useState('온보딩 미완료');
  const [userInitial, setUserInitial] = useState('?');
  const pathname = usePathname();
  const router = useRouter();
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
          setHasOnboarding(Boolean(status.is_completed));
          if (status.is_completed) {
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
    const handler = (event) => {
      setActiveSessionId(event.detail?.id ?? null);
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
    if (pathname.startsWith('/app/chat')) {
      window.dispatchEvent(new CustomEvent('danaa:load-session', { detail: { id: conversation.id } }));
      return;
    }

    router.push(`/app/chat?session_id=${conversation.id}`);
  };

  const currentCat = categories[selectedCat];

  return (
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
          ≡
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
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
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
            onClick={() => {
              if (!hasOnboarding) {
                alert('온보딩 완료 후 새 대화를 시작할 수 있습니다.');
                return;
              }
              setActiveSessionId(null);
              if (window.__danaa_newChat) {
                window.__danaa_newChat();
              }
            }}
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
                        activeSessionId === conversation.id
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
        <div className="mt-auto shrink-0 border-t border-black/[.04] p-2 pb-4">
          {catOpen && (
            <div className="mb-2 rounded-lg bg-cream-300 p-1.5">
              {categories.map((cat, index) => (
                <button
                  key={cat.name}
                  disabled={!cat.active}
                  onClick={() => {
                    if (!cat.active) return;
                    setSelectedCat(index);
                    setCatOpen(false);
                  }}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all last:mb-0 ${
                    index === selectedCat
                      ? 'bg-white text-nature-900 shadow-xs'
                      : cat.active
                        ? 'text-neutral-600 hover:bg-white/60'
                        : 'cursor-not-allowed text-neutral-400 opacity-40'
                  }`}
                >
                  <span className="text-base">
                    <cat.icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{cat.name}</div>
                    <div className="text-[11px] leading-tight text-neutral-400">{cat.desc}</div>
                  </div>
                  {index === selectedCat && (
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-nature-500 text-[8px] text-white">
                      ✓
                    </div>
                  )}
                  {!cat.active && (
                    <span className="shrink-0 rounded bg-black/[.04] px-1.5 py-0.5 text-[8px] text-neutral-400">
                      준비 중
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setCatOpen((prev) => !prev)}
            className="mb-2 flex w-full items-center gap-2 rounded-lg bg-cream-300 px-2.5 py-2 transition-colors hover:bg-cream-400"
          >
            <span className="text-sm">
              <currentCat.icon size={16} />
            </span>
            <span className="flex-1 text-left text-[13px] font-medium text-nature-900">{currentCat.name}</span>
            <span className={`text-[11px] text-neutral-300 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          <Link
            href="/app/settings"
            className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[.03]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-nature-900 text-[11px] font-bold text-white transition-all group-hover:ring-2 group-hover:ring-nature-500/20">
              {userInitial}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-nature-900">{userName}</div>
              <div className="text-[11px] text-neutral-300">{userGroup}</div>
            </div>
            <span className="text-[11px] text-neutral-300">
              <Settings size={14} />
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
