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
  headline: '이 메뉴에서 무엇을 할 수 있는지 쉽게 안내해 드릴게요.',
  what_it_is: '각 메뉴가 어떤 용도인지, 언제 사용하면 좋은지 한눈에 볼 수 있는 안내 화면이에요.',
  where_to_check: '채팅, 리포트, 챌린지, 오늘 기록 탭을 눌러 보면서 필요한 기능을 살펴보세요.',
  next_action: '원하는 메뉴를 찾았다면 해당 화면으로 이동해서 바로 사용해 보시면 됩니다.',
  limitations:
    '지금은 기본 안내 문구를 보여드리고 있어요. 더 자세한 설명이 준비되면 이 화면에서 함께 확인할 수 있어요.',
};

const FRIENDLY_OVERRIDES = {
  chat: {
    headline: 'AI와 대화하면서 오늘 기록도 함께 남길 수 있어요.',
    what_it_is:
      '채팅 메뉴는 궁금한 점을 물어보는 공간이면서, 오늘 건강 상태를 자연스럽게 기록할 수 있는 화면이에요.',
    where_to_check:
      '채팅 화면에서 답변을 읽고, 아래에 보이는 입력 카드나 오른쪽 기록 영역을 함께 확인해 보세요.',
    next_action:
      '먼저 궁금한 점을 편하게 입력해 보세요. 이어서 보이는 기록 항목이 있으면 그 자리에서 바로 답하면 됩니다.',
    limitations:
      '상황에 따라 항상 같은 입력 항목이 바로 보이지 않을 수 있어요. 그래도 오늘 기록 화면에서 이어서 입력할 수 있어요.',
  },
  report: {
    headline: '기록한 내용을 한눈에 모아 볼 수 있어요.',
    what_it_is:
      '리포트 메뉴는 내가 남긴 건강 기록이 어떻게 쌓이고 있는지, 어떤 흐름을 보이는지 정리해서 보여주는 화면이에요.',
    where_to_check:
      '리포트 메뉴를 열면 저장된 건강 기록과 변화 흐름을 확인할 수 있어요. 기록이 충분히 쌓이면 더 자세한 분석도 함께 볼 수 있어요.',
    next_action:
      '오늘 기록을 먼저 입력한 뒤 리포트 메뉴로 이동해서 수면, 식사, 운동 같은 내용이 잘 반영됐는지 확인해 보세요.',
    limitations:
      '아직 입력한 기록이 많지 않으면 일부 그래프나 자세한 분석 내용은 잠시 비어 있을 수 있어요.',
  },
  challenge: {
    headline: '작은 목표를 정해서 꾸준히 실천해 볼 수 있어요.',
    what_it_is:
      '챌린지 메뉴는 건강 습관을 조금씩 이어갈 수 있도록 도와주는 실천 화면이에요.',
    where_to_check:
      '챌린지 메뉴를 열면 지금 진행 중인 목표와 오늘 실천 여부를 한눈에 볼 수 있어요.',
    next_action:
      '마음에 드는 챌린지를 고른 뒤, 하루가 끝나기 전에 오늘 했는지 체크해 보세요.',
    limitations:
      '리포트 기록과 챌린지 체크는 따로 관리될 수 있어요. 기록을 남겼더라도 챌린지 화면에서 직접 체크해야 할 수 있어요.',
  },
  pending: {
    headline: '오늘 아직 입력하지 않은 기록을 쉽게 확인할 수 있어요.',
    what_it_is:
      '오늘 기록 메뉴는 아직 비어 있는 건강 항목이 무엇인지 알려주고, 빠진 내용을 이어서 적을 수 있게 도와줘요.',
    where_to_check:
      '채팅 화면 오른쪽이나 오늘 기록 관련 안내에서 아직 입력하지 않은 항목을 확인할 수 있어요.',
    next_action:
      '비어 있는 항목이 보이면 수면, 식사, 운동처럼 기억나는 내용부터 하나씩 입력해 보세요.',
    limitations:
      '모든 항목을 한 번에 다 입력하지 않아도 괜찮아요. 생각나는 것부터 차례대로 채워도 됩니다.',
  },
};

function normalizeSectionCopy(key, section) {
  const base =
    section && typeof section === 'object'
      ? {
          headline: section.headline || '',
          what_it_is: section.what_it_is || section.summary || '',
          where_to_check: section.where_to_check || '',
          next_action: section.next_action || '',
          limitations: section.limitations || '',
        }
      : EMPTY_GUIDE;

  const merged = {
    ...base,
    ...(FRIENDLY_OVERRIDES[key] || {}),
  };

  return {
    headline: merged.headline || EMPTY_GUIDE.headline,
    what_it_is: merged.what_it_is || EMPTY_GUIDE.what_it_is,
    where_to_check: merged.where_to_check || EMPTY_GUIDE.where_to_check,
    next_action: merged.next_action || EMPTY_GUIDE.next_action,
    limitations: merged.limitations || EMPTY_GUIDE.limitations,
  };
}

function GuideSection({ section }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">쉽게 보기</div>
        <div className="mt-1 text-[18px] font-semibold text-nature-900">{section.headline}</div>
      </div>

      <div className="rounded-2xl border border-cream-500 bg-cream-300 px-4 py-3">
        <div className="text-[12px] font-medium text-nature-900">이 메뉴는 어떤 기능인가요?</div>
        <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.what_it_is}</div>
      </div>

      <div className="rounded-2xl border border-cream-500 bg-cream-400 px-4 py-3">
        <div className="text-[12px] font-medium text-nature-900">어디에서 보면 되나요?</div>
        <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.where_to_check}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-cream-500 bg-cream-400 px-4 py-3">
          <div className="text-[12px] font-medium text-nature-900">이렇게 사용해 보세요</div>
          <div className="mt-1 text-[13px] leading-[1.8] text-neutral-500">{section.next_action}</div>
        </div>
        <div className="rounded-2xl border border-cream-500 bg-cream-400 px-4 py-3">
          <div className="text-[12px] font-medium text-nature-900">참고하면 좋아요</div>
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
        return [key, normalizeSectionCopy(key, section)];
      }),
    );
  }, [guide]);

  const activeSection = sections[activeTab] || EMPTY_GUIDE;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="flex max-h-[calc(100dvh-32px)] min-h-0 w-full max-w-[820px] flex-col overflow-hidden rounded-[24px] border border-cream-500 bg-cream-300 shadow-2xl sm:max-h-[min(720px,calc(100dvh-48px))] sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3 border-b border-cream-500 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              <BookOpen size={14} />
              서비스 안내 다시보기
            </div>
            <div className="mt-2 text-[22px] font-semibold text-nature-900">DANAA 기능 안내</div>
            <div className="mt-1 text-[13px] text-neutral-400">
              DANAA에서 무엇을 할 수 있는지 쉽게 살펴볼 수 있어요.
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <GuideSection section={activeSection} />
        </div>
      </div>
    </div>
  );
}
