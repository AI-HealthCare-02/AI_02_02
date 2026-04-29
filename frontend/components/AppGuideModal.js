'use client';

import { useMemo, useState } from 'react';
import { BookOpen, MessageSquare, BarChart3, Target, ClipboardList, X } from 'lucide-react';

const TAB_CONFIG = [
  { key: 'chat', label: '채팅', icon: MessageSquare },
  { key: 'report', label: '리포트', icon: BarChart3 },
  { key: 'challenge', label: '챌린지', icon: Target },
  { key: 'pending', label: '오늘 기록', icon: ClipboardList },
];

const EMPTY_GUIDE = {
  headline: '안내를 불러오는 중이에요.',
  what_it_is: '현재 서비스 안내 내용을 바로 읽어오지 못했어요.',
  where_to_check: '잠시 후 다시 열어 보거나 새로고침 후 다시 확인해 주세요.',
  next_action: '문제가 계속되면 채팅에서 바로 질문해도 됩니다.',
  limitations: '이 창은 서비스 안내 요약본을 보여주는 화면이라, 원본을 읽지 못하면 기본 안내만 표시돼요.',
};

function GuideSection({ section }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">핵심 설명</div>
        <div className="mt-1 text-[18px] font-semibold text-nature-900">{section.headline}</div>
      </div>

      <div className="rounded-2xl border border-cream-500 bg-cream-300 px-4 py-3">
        <div className="text-[12px] font-medium text-nature-900">이 기능은 무엇인가요?</div>
        <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.what_it_is}</div>
      </div>

      <div className="rounded-2xl border border-cream-500 bg-cream-400 px-4 py-3">
        <div className="text-[12px] font-medium text-nature-900">어디서 확인하면 되나요?</div>
        <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.where_to_check}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-cream-500 bg-cream-400 px-4 py-3">
          <div className="text-[12px] font-medium text-nature-900">다음에 하면 좋은 행동</div>
          <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.next_action}</div>
        </div>
        <div className="rounded-2xl border border-cream-500 bg-cream-400 px-4 py-3">
          <div className="text-[12px] font-medium text-nature-900">알아두면 좋은 점</div>
          <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.limitations}</div>
        </div>
      </div>
    </div>
  );
}

export default function AppGuideModal({ guide, onClose }) {
  const [activeTab, setActiveTab] = useState('chat');

  const sections = useMemo(() => {
    if (!guide || typeof guide !== 'object') {
      return Object.fromEntries(TAB_CONFIG.map(({ key }) => [key, EMPTY_GUIDE]));
    }

    return Object.fromEntries(
      TAB_CONFIG.map(({ key }) => {
        const section = guide[key];
        return [key, section && typeof section === 'object' ? section : EMPTY_GUIDE];
      }),
    );
  }, [guide]);

  const activeSection = sections[activeTab] || EMPTY_GUIDE;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="flex h-[720px] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-cream-500 bg-cream-300 shadow-2xl">
        <div className="flex items-start justify-between border-b border-cream-500 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              <BookOpen size={14} />
              서비스 안내 다시보기
            </div>
            <div className="mt-2 text-[22px] font-semibold text-nature-900">도나 기능 안내</div>
            <div className="mt-1 text-[13px] text-neutral-400">
              채팅, 리포트, 챌린지, 오늘 기록 흐름을 다시 확인할 수 있어요.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-500 text-neutral-400 transition-colors hover:bg-cream-400 hover:text-nature-900"
            aria-label="서비스 안내 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-cream-500 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-nature-900 text-white'
                      : 'bg-cream-300 text-neutral-500 hover:bg-cream-400'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <GuideSection section={activeSection} />
        </div>
      </div>
    </div>
  );
}
