'use client';

import { useState, useEffect, useCallback } from 'react';
import { Compass, MessageSquare, BarChart3, HelpCircle, Sparkles } from 'lucide-react';

import { getScopedStorageKey } from '../hooks/useApi';

const STEPS = [
  {
    target: '[data-tutorial="sidebar-nav"]',
    emoji: Compass,
    title: '메뉴 둘러보기',
    desc: '채팅, 리포트, 챌린지 메뉴로 이동할 수 있어요.',
    position: 'right',
  },
  {
    target: null,
    emoji: MessageSquare,
    title: 'AI와 대화하기',
    desc: '건강 기록이나 생활 습관을 물어보면, 답변과 함께 기록 카드가 붙을 수 있어요.',
    position: 'center',
    miniChat: true,
  },
  {
    target: '[data-tutorial="today-cards"]',
    emoji: BarChart3,
    title: '오늘 기록 입력하기',
    desc: '수면, 식사, 운동, 수분은 오른쪽 패널에서 직접 입력하거나, 답변 아래 카드에서 질문형으로 기록할 수 있어요.',
    position: 'left',
  },
  {
    target: '[data-tutorial="unanswered"]',
    emoji: HelpCircle,
    title: '남은 질문 확인하기',
    desc: '미답변 질문은 오늘 아직 비어 있는 기록 요약이에요. 새 질문을 보내면 다음 카드가 답변 아래에 붙을 수 있어요.',
    position: 'left',
  },
  {
    target: null,
    emoji: Sparkles,
    title: '준비 완료',
    desc: '이제 오늘 기록을 시작해볼까요?',
    position: 'center',
  },
];

export default function Tutorial({ onComplete }) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const current = STEPS[step];

  const getTargetElement = useCallback((target) => {
    if (!target) return null;
    const element = document.querySelector(target);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return element;
  }, []);

  const updateSpotlight = useCallback(() => {
    if (!current.target) {
      setSpotlightRect(null);
      return;
    }

    const element = getTargetElement(current.target);
    if (!element) {
      setSpotlightRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setSpotlightRect({
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    });
  }, [current.target, getTargetElement]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [step, updateSpotlight]);

  useEffect(() => {
    if (!current.target) return;
    const element = getTargetElement(current.target);
    if (!element) return;

    element.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });

    const timer = window.setTimeout(() => {
      updateSpotlight();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [current.target, getTargetElement, updateSpotlight]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(getScopedStorageKey('danaa_tutorial_done'), 'true');
    } catch {}
    onComplete?.();
  }, [onComplete]);

  const next = () => {
    let nextStep = step + 1;
    while (nextStep < STEPS.length) {
      const nextConfig = STEPS[nextStep];
      if (!nextConfig.target || getTargetElement(nextConfig.target)) {
        setStep(nextStep);
        return;
      }
      nextStep += 1;
    }
    finish();
  };

  const getTooltipStyle = () => {
    const tooltipWidth = Math.min(360, window.innerWidth - 32);
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    if (current.position === 'center' || !spotlightRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 20;
    const rect = spotlightRect;
    const minLeft = 16;
    const maxLeft = window.innerWidth - tooltipWidth - 16;
    const centeredTop = clamp(rect.top + rect.height / 2 - 120, 16, window.innerHeight - 220);

    switch (current.position) {
      case 'right':
        return {
          position: 'fixed',
          top: centeredTop,
          left: clamp(rect.left + rect.width + gap, minLeft, maxLeft),
          transform: 'none',
        };
      case 'left':
        return {
          position: 'fixed',
          top: centeredTop,
          left: clamp(rect.left - tooltipWidth - gap, minLeft, maxLeft),
          transform: 'none',
        };
      case 'top':
        return {
          position: 'fixed',
          top: clamp(rect.top - 220 - gap, 16, window.innerHeight - 220),
          left: clamp(rect.left + rect.width / 2 - tooltipWidth / 2, minLeft, maxLeft),
          transform: 'none',
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: clamp(rect.top + rect.height + gap, 16, window.innerHeight - 220),
          left: clamp(rect.left + rect.width / 2 - tooltipWidth / 2, minLeft, maxLeft),
          transform: 'none',
        };
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  const getArrowClass = () => {
    if (current.position === 'center' || !spotlightRect) return '';

    const classMap = {
      right: 'tutorial-arrow-left',
      left: 'tutorial-arrow-right',
      top: 'tutorial-arrow-bottom',
      bottom: 'tutorial-arrow-top',
    };
    return classMap[current.position] || '';
  };

  return (
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: 'auto' }}>
      <svg className="fixed inset-0 h-full w-full" style={{ zIndex: 100 }}>
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="20"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(27, 31, 26, 0.72)"
          mask="url(#tutorial-mask)"
        />
      </svg>

      {spotlightRect && (
        <div
          className="pointer-events-none fixed rounded-[20px] border border-white/70 shadow-[0_0_0_9999px_rgba(27,31,26,0.08)]"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            zIndex: 101,
          }}
        />
      )}

      <div
        className={`w-[min(360px,calc(100vw-32px))] rounded-[28px] border border-cream-500 bg-cream-300 p-6 shadow-2xl ${getArrowClass()}`}
        style={{ ...getTooltipStyle(), zIndex: 102 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-300 text-nature-900">
            <current.emoji size={20} />
          </div>
          <div>
            <div className="text-[12px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
              STEP {step + 1}
            </div>
            <div className="text-[20px] font-semibold text-nature-900">{current.title}</div>
          </div>
        </div>

        <div className="mt-4 text-[14px] leading-[1.8] text-neutral-500">{current.desc}</div>

        {current.miniChat && (
          <div className="mt-4 rounded-2xl border border-cream-500 bg-cream-400 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nature-500 text-[12px] font-semibold text-white">
                다
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-medium text-nature-900">다나아 예시</div>
                <div className="mt-1 text-[12px] leading-[1.7] text-neutral-500">
                  “오늘 수면 어땠어?”처럼 물어보면 답변과 함께 기록 카드가 붙을 수 있어요.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="text-[13px] font-medium text-neutral-400 transition-colors hover:text-nature-900"
          >
            건너뛰기
          </button>

          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {STEPS.map((item, index) => (
                <span
                  key={item.title}
                  className={`h-2 rounded-full transition-all ${
                    index === step ? 'w-5 bg-nature-500' : 'w-2 bg-cream-500'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              className="rounded-full bg-nature-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-nature-600"
            >
              {step === STEPS.length - 1 ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
