'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, BarChart3, Target, Settings, Droplet, Heart, Scale, HeartPulse } from 'lucide-react';
import useConversations from '../hooks/useConversations';

const navItems = [
  { icon: MessageSquare, label: 'AI 채팅', href: '/app/chat' },
  { icon: BarChart3, label: '리포트', href: '/app/report' },
  { icon: Target, label: '챌린지', href: '/app/challenge' },
];

const categories = [
  { emoji: Droplet, name: '당뇨', desc: '혈당, 위험도, 습관 추적', active: true },
  { emoji: Heart, name: '고혈압', desc: '혈압, 심혈관', active: false },
  { emoji: Scale, name: '비만', desc: '체중, 활동량', active: false },
  { emoji: HeartPulse, name: '심혈관', desc: '심장 건강', active: false },
];

/** 시간 포맷: "10:20" 형태 */
function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  const pathname = usePathname();

  const [userName, setUserName] = useState('');
  const [userGroup, setUserGroup] = useState('');
  const [userInitial, setUserInitial] = useState('');

  // 대화 히스토리 훅
  const { grouped } = useConversations();

  useEffect(() => {
    try {
      const ob = localStorage.getItem('danaa_onboarding');
      if (ob) {
        setHasOnboarding(true);
        const data = JSON.parse(ob);
        const name = data.name || '사용자';
        setUserName(name);
        setUserInitial(name.charAt(0));
      }
      const rk = localStorage.getItem('danaa_risk');
      if (rk) {
        const risk = JSON.parse(rk);
        setUserGroup(`${risk.group || ''}. ${risk.groupLabel || ''}`);
      }
    } catch {}
  }, []);

  // 세션 로드 이벤트 수신 (chat 페이지에서 새 세션 생성 시)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.id) setActiveSessionId(e.detail.id);
    };
    window.addEventListener('danaa:conversation-update', handler);
    return () => window.removeEventListener('danaa:conversation-update', handler);
  }, []);

  const handleConversationClick = (conv) => {
    setActiveSessionId(conv.id);
    // 해당 세션 로드 이벤트 발행 — chat 페이지에서 수신
    window.dispatchEvent(new CustomEvent('danaa:load-session', { detail: { id: conv.id } }));
  };

  const currentCat = categories[selectedCat];

  return (
    <aside className={`${open ? 'w-[300px]' : 'w-[48px]'} h-full min-h-0 bg-white/90 backdrop-blur-2xl border-r border-black/[.06] flex flex-col transition-all duration-200 shrink-0 overflow-hidden`}>
      {/* 토글 + 로고 */}
      <div className="h-12 flex items-center border-b border-black/[.04] px-2 shrink-0">
        <button onClick={() => setOpen(!open)} className="w-8 h-8 rounded-lg hover:bg-black/[.03] flex items-center justify-center text-neutral-600 text-lg">
          ☰
        </button>
        {open && (
          <Link href="/" className="ml-2 text-[16px] font-bold text-nature-900 tracking-tight hover:opacity-70 transition-opacity">
            DANAA
          </Link>
        )}
      </div>

      {/* 네비 */}
      <nav className="p-1" data-tutorial="sidebar-nav">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 h-10 rounded-lg text-[14px] whitespace-nowrap overflow-hidden transition-colors ${
                active ? 'bg-cream-300 text-nature-900 font-medium' : 'text-neutral-400 hover:bg-black/[.03]'
              }`}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"><item.icon size={18} /></span>
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 대화 히스토리 */}
      {open && (
        <div className="flex-1 overflow-y-auto px-2 border-t border-black/[.04] mt-1">
          {/* 새 대화 버튼 — 항상 표시 */}
          <button
            onClick={() => {
              if (!hasOnboarding) {
                alert('온보딩을 먼저 완료해주세요!');
                return;
              }
              setActiveSessionId(null);
              if (window.__danaa_newChat) window.__danaa_newChat();
            }}
            className="w-full py-2 px-2 border border-dashed border-black/[.08] rounded-lg bg-transparent text-[13px] text-neutral-400 cursor-pointer mt-2 mb-1 hover:bg-black/[.03] transition-colors"
          >+ 새 대화</button>

          {hasOnboarding ? (
            grouped.length > 0 ? (
              // 실제 대화 목록 (날짜별 그룹)
              // 백엔드 연동 시: GET /api/v1/chat/sessions → useConversations 훅에서 자동 로드
              grouped.map((group) => (
                <div key={group.label}>
                  <div className="text-[11px] font-semibold text-neutral-300 px-2 pt-2.5 pb-1 uppercase tracking-wider">
                    {group.label}
                  </div>
                  {group.items.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleConversationClick(conv)}
                      className={`text-[13px] px-2 py-1.5 rounded-md cursor-pointer flex justify-between mb-0.5 transition-all ${
                        activeSessionId === conv.id
                          ? 'bg-cream-300 text-nature-900 font-medium'
                          : 'text-neutral-400 hover:bg-cream-300 hover:text-nature-900'
                      }`}
                    >
                      <span className="truncate flex-1 mr-2">{conv.title}</span>
                      <span className="text-[11px] text-neutral-300 shrink-0">{formatTime(conv.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              // 온보딩 완료, 대화 없음
              <div className="flex-1 flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="mb-2"><MessageSquare size={24} className="text-neutral-300 mx-auto" /></div>
                  <div className="text-[12px] text-neutral-400">새 대화를 시작해보세요</div>
                </div>
              </div>
            )
          ) : (
            // 온보딩 미완료
            <div className="flex-1 flex items-center justify-center py-8">
              <div className="text-center">
                <div className="mb-2"><MessageSquare size={24} className="text-neutral-300 mx-auto" /></div>
                <div className="text-[12px] text-neutral-400">온보딩을 완료하면<br/>대화 기록이 표시돼요</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 하단: 접힌 상태 */}
      {!open && (
        <div className="mt-auto py-1.5 flex flex-col items-center gap-1.5 border-t border-black/[.04]">
          <span className="text-sm"><currentCat.emoji size={16} /></span>
          <Link href="/app/settings" className="w-6 h-6 rounded-full bg-cream-400 flex items-center justify-center text-[11px] font-semibold text-neutral-400 hover:bg-cream-500 transition-colors">
            {userInitial || '?'}
          </Link>
        </div>
      )}

      {/* 하단: 펼친 상태 */}
      {open && (
        <div className="mt-auto border-t border-black/[.04] p-2 pb-4 shrink-0">

          {/* 카테고리 토글 리스트 — 버튼 위에 인라인으로 펼쳐짐 */}
          {catOpen && (
            <div className="mb-2 bg-cream-300 rounded-lg p-1.5">
              {categories.map((cat, i) => (
                <button
                  key={cat.name}
                  disabled={!cat.active}
                  onClick={() => {
                    if (cat.active) {
                      setSelectedCat(i);
                      setCatOpen(false);
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all mb-0.5 last:mb-0 ${
                    i === selectedCat
                      ? 'bg-white shadow-xs text-nature-900'
                      : cat.active
                      ? 'hover:bg-white/60 text-neutral-600'
                      : 'opacity-40 cursor-not-allowed text-neutral-400'
                  }`}
                >
                  <span className="text-base"><cat.emoji size={16} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{cat.name}</div>
                    <div className="text-[11px] text-neutral-400 leading-tight">{cat.desc}</div>
                  </div>
                  {i === selectedCat && (
                    <div className="w-4 h-4 rounded-full bg-nature-500 text-white flex items-center justify-center text-[8px] shrink-0">✓</div>
                  )}
                  {!cat.active && (
                    <span className="text-[8px] bg-black/[.04] text-neutral-400 px-1.5 py-0.5 rounded shrink-0">준비 중</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 당뇨 버튼 — 위치 고정 */}
          <button
            onClick={() => setCatOpen(!catOpen)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cream-300 cursor-pointer hover:bg-cream-400 transition-colors mb-2"
          >
            <span className="text-sm"><currentCat.emoji size={16} /></span>
            <span className="text-[13px] font-medium text-nature-900 flex-1 text-left">{currentCat.name}</span>
            <span className={`text-[11px] text-neutral-300 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {/* 프로필 — 클릭하면 설정으로 이동 */}
          <Link href="/app/settings" className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[.03] transition-colors cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[11px] font-bold group-hover:ring-2 group-hover:ring-nature-500/20 transition-all">{userInitial || '?'}</div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-nature-900">{userName || '사용자'}</div>
              <div className="text-[11px] text-neutral-300">{userGroup || '온보딩 미완료'}</div>
            </div>
            <span className="text-[11px] text-neutral-300"><Settings size={14} /></span>
          </Link>
        </div>
      )}
    </aside>
  );
}
