'use client';

import { useState, useEffect, useCallback } from 'react';
import { Compass, MessageSquare, BarChart3, HelpCircle, Sparkles } from 'lucide-react';

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
    title: 'AI와 대화해보세요',
    desc: '이런 식으로 생활 습관을 물어볼 수 있어요. 답변이 쌓일수록 맞춤 리포트가 더 정확해져요.',
    position: 'center',
    miniChat: true,
  },
  {
    target: '[data-tutorial="today-cards"]',
    emoji: BarChart3,
    title: '오늘의 건강 기록',
    desc: '수면, 식사, 운동, 수분을 빠르게 기록할 수 있어요.\n오른쪽 패널에서 바로 입력해도 됩니다.',
    position: 'left',
  },
  {
    target: '[data-tutorial="unanswered"]',
    emoji: HelpCircle,
    title: '미답변 질문',
    desc: '남아 있는 질문에 답할수록 리포트의 정확도가 올라가요.',
    position: 'left',
  },
  {
    target: null,
    emoji: Sparkles,
    title: '준비 완료!',
    desc: '이제 오늘의 건강 기록부터 시작해볼까요?',
    position: 'center',
  },
];

export default function Tutorial({ onComplete }) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const current = STEPS[step];

  const updateSpotlight = useCallback(() => {
    if (!current.target) {
      setSpotlightRect(null);
      return;
    }

    const element = document.querySelector(current.target);
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
  }, [current.target]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [step, updateSpotlight]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem('danaa_tutorial_done', 'true');
    } catch {}
    onComplete?.();
  }, [onComplete]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    finish();
  };

  const getTooltipStyle = () => {
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

    switch (current.position) {
      case 'right':
        return {
          position: 'fixed',
          top: rect.top + rect.height / 2,
          left: rect.left + rect.width + gap,
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          position: 'fixed',
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + gap,
          transform: 'translateY(-50%)',
        };
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - rect.top + gap,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: rect.top + rect.height + gap,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
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
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight-mask)" />
      </svg>

      {spotlightRect && (
        <div
          className="fixed rounded-xl ring-2 ring-white/60 animate-pulse"
          style={{
            zIndex: 101,
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        className={`z-[102] rounded-[28px] bg-white p-7 shadow-2xl ${
          current.miniChat ? 'w-[520px] max-w-[92vw]' : 'w-[460px] max-w-[92vw]'
        } ${getArrowClass()}`}
        style={getTooltipStyle()}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-300">
            <current.emoji size={24} />
          </div>
          <div className="text-[18px] font-semibold text-nature-900">{current.title}</div>
        </div>

        {current.miniChat && (
          <div className="mb-4 space-y-3 rounded-2xl bg-cream-300 p-4">
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nature-900 text-[9px] font-semibold text-white">
                AI
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13px] leading-[1.7] text-nature-900 shadow-sm">
                어제 저녁은 어떻게 드셨나요?
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <div className="rounded-2xl rounded-br-md bg-nature-900 px-3.5 py-2 text-[13px] text-white">
                간단하게 먹었어요
              </div>
            </div>

            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nature-900 text-[9px] font-semibold text-white">
                AI
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13px] leading-[1.7] text-nature-900 shadow-sm">
                채소는 얼마나 드셨나요?
                <div className="mt-2 flex gap-1.5">
                  {['충분히', '조금', '먹지 않았어요'].map((option) => (
                    <span
                      key={option}
                      className="rounded-full border border-cream-500 bg-cream-300 px-2.5 py-1 text-[10px] text-neutral-500"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-5 whitespace-pre-line text-[15px] leading-[1.75] text-neutral-500">
          {current.desc}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  index === step ? 'bg-nature-500' : index < step ? 'bg-nature-500' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step < STEPS.length - 1 && (
              <button
                onClick={finish}
                className="text-[13px] text-neutral-400 transition-colors hover:text-nature-900"
              >
                건너뛰기
              </button>
            )}
            <button
              onClick={next}
              className="rounded-xl bg-nature-500 px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-nature-600"
            >
              {step < STEPS.length - 1 ? '다음' : '시작하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
