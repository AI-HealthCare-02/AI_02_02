'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { icon: '💬', label: 'AI 채팅', href: '/app/chat' },
  { icon: '📊', label: '리포트', href: '/app/report' },
  { icon: '🎯', label: '챌린지', href: '/app/challenge' },
];

const categories = [
  { emoji: '🩸', name: '당뇨', desc: '혈당, 위험도, 습관 추적', active: true },
  { emoji: '💓', name: '고혈압', desc: '혈압, 심혈관', active: false },
  { emoji: '⚖️', name: '비만', desc: '체중, 활동량', active: false },
  { emoji: '🫀', name: '심혈관', desc: '심장 건강', active: false },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState(0);
  const pathname = usePathname();

  const currentCat = categories[selectedCat];

  return (
    <aside className={`${open ? 'w-[280px]' : 'w-[48px]'} h-full min-h-0 bg-white/90 backdrop-blur-2xl border-r border-black/[.06] flex flex-col transition-all duration-200 shrink-0 overflow-hidden`}>
      {/* 토글 */}
      <div className="h-12 flex items-center border-b border-black/[.04] px-2 shrink-0">
        <button onClick={() => setOpen(!open)} className="w-8 h-8 rounded-lg hover:bg-black/[.03] flex items-center justify-center text-neutral-600 text-lg">
          ☰
        </button>
      </div>

      {/* 네비 */}
      <nav className="p-1" data-tutorial="sidebar-nav">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 h-10 rounded-lg text-xs whitespace-nowrap overflow-hidden transition-colors ${
                active ? 'bg-cream-300 text-nature-900 font-medium' : 'text-neutral-400 hover:bg-black/[.03]'
              }`}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0">{item.icon}</span>
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 대화 히스토리 */}
      {open && (
        <div className="flex-1 overflow-y-auto px-2 border-t border-black/[.04] mt-1">
          <button className="w-full py-2 px-2 border border-dashed border-black/[.08] rounded-lg bg-transparent text-[12px] text-neutral-400 cursor-pointer mt-2 mb-1 hover:border-black/[.15] transition-colors">+ 새 대화</button>
          <div className="text-[10px] font-semibold text-neutral-300 px-2 pt-2.5 pb-1 uppercase tracking-wider">오늘</div>
          <div className="text-[12px] px-2 py-1.5 rounded-md bg-cream-300 text-nature-900 font-medium cursor-pointer flex justify-between mb-0.5">
            혈당 관리 팁 <span className="text-[10px] text-neutral-300">10:20</span>
          </div>
          <div className="text-[12px] px-2 py-1.5 rounded-md text-neutral-400 hover:bg-black/[.03] cursor-pointer flex justify-between mb-0.5">
            점심 메뉴 추천 <span className="text-[10px] text-neutral-300">12:15</span>
          </div>
          <div className="text-[10px] font-semibold text-neutral-300 px-2 pt-2.5 pb-1 uppercase tracking-wider">어제</div>
          <div className="text-[12px] px-2 py-1.5 rounded-md text-neutral-400 hover:bg-black/[.03] cursor-pointer flex justify-between">
            운동 루틴 상담 <span className="text-[10px] text-neutral-300">18:30</span>
          </div>
        </div>
      )}

      {/* 하단: 접힌 상태 */}
      {!open && (
        <div className="mt-auto py-1.5 flex flex-col items-center gap-1.5 border-t border-black/[.04]">
          <span className="text-sm">{currentCat.emoji}</span>
          <Link href="/app/settings" className="w-6 h-6 rounded-full bg-cream-400 flex items-center justify-center text-[10px] font-semibold text-neutral-400 hover:bg-cream-500 transition-colors">
            홍
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
                  <span className="text-base">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium">{cat.name}</div>
                    <div className="text-[10px] text-neutral-400 leading-tight">{cat.desc}</div>
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
            <span className="text-sm">{currentCat.emoji}</span>
            <span className="text-[12px] font-medium text-nature-900 flex-1 text-left">{currentCat.name}</span>
            <span className={`text-[10px] text-neutral-300 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {/* 프로필 — 클릭하면 설정으로 이동 */}
          <Link href="/app/settings" className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/[.03] transition-colors cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[10px] font-bold group-hover:ring-2 group-hover:ring-nature-500/20 transition-all">홍</div>
            <div className="flex-1">
              <div className="text-[12px] font-medium text-nature-900">홍길동</div>
              <div className="text-[10px] text-neutral-300">B그룹 · 주의</div>
            </div>
            <span className="text-[10px] text-neutral-300">⚙️</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
