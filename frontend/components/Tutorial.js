'use client';

import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    target: '[data-tutorial="sidebar-nav"]',
    emoji: '🧭',
    title: '메뉴 살펴보기',
    desc: '채팅, 리포트, 챌린지 메뉴로 이동할 수 있어요.',
    position: 'right',
  },
  {
    target: null,
    emoji: '💬',
    title: 'AI와 대화하다 보면',
    desc: '이런 식으로 생활 습관을 물어봐요. 잘 답변해주실수록 맞춤 리포트가 정확해져요!',
    position: 'center',
    miniChat: true,
  },
  {
    target: '[data-tutorial="today-cards"]',
    emoji: '📊',
    title: '오늘의 건강 기록',
    desc: '수면, 식사, 운동, 수분을 탭해서 기록해요.',
    position: 'left',
  },
  {
    target: '[data-tutorial="unanswered"]',
    emoji: '❓',
    title: '미답변 질문',
    desc: '놓친 질문도 꼼꼼히 답변해주시면 리포트의 정확도가 올라가요!',
    position: 'left',
  },
  {
    target: null,
    emoji: '🎉',
    title: '준비 완료!',
    desc: '오늘의 건강 기록부터 시작해볼까요?',
    position: 'center',
  },
];

export default function Tutorial({ onComplete }) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const current = STEPS[step];

  // 대상 요소 위치 계산
  const updateSpotlight = useCallback(() => {
    if (!current.target) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(current.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    }
  }, [current.target]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [step, updateSpotlight]);

  const finish = useCallback(() => {
    try { localStorage.setItem('danaa_tutorial_done', 'true'); } catch {}
    onComplete?.();
  }, [onComplete]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  // 툴팁 위치 계산
  const getTooltipStyle = () => {
    if (current.position === 'center' || !spotlightRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 16;
    const s = spotlightRect;

    switch (current.position) {
      case 'right':
        return {
          position: 'fixed',
          top: s.top + s.height / 2,
          left: s.left + s.width + gap,
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          position: 'fixed',
          top: s.top + s.height / 2,
          right: window.innerWidth - s.left + gap,
          transform: 'translateY(-50%)',
        };
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - s.top + gap,
          left: s.left + s.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: s.top + s.height + gap,
          left: s.left + s.width / 2,
          transform: 'translateX(-50%)',
        };
      default:
        return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  // 화살표 방향 (툴팁에서 대상을 가리키는 방향)
  const getArrowClass = () => {
    if (current.position === 'center' || !spotlightRect) return '';
    const map = {
      right: 'tutorial-arrow-left',
      left: 'tutorial-arrow-right',
      top: 'tutorial-arrow-bottom',
      bottom: 'tutorial-arrow-top',
    };
    return map[current.position] || '';
  };

  return (
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: 'auto' }}>
      {/* 오버레이 — SVG로 스포트라이트 구멍 */}
      <svg className="fixed inset-0 w-full h-full" style={{ zIndex: 100 }}>
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
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* 스포트라이트 링 */}
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

      {/* 툴팁 */}
      <div
        className={`bg-white rounded-2xl shadow-2xl p-5 z-[102] ${current.miniChat ? 'max-w-[360px]' : 'max-w-[300px]'} ${getArrowClass()}`}
        style={getTooltipStyle()}
      >
        {/* 이모지 + 제목 */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-cream-300 flex items-center justify-center text-[20px]">
            {current.emoji}
          </div>
          <div className="text-[14px] font-semibold text-nature-900">{current.title}</div>
        </div>

        {/* 미니 채팅 예시 */}
        {current.miniChat && (
          <div className="bg-[#f5f5f3] rounded-xl p-3 mb-3 space-y-2.5">
            {/* AI 질문 */}
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-nature-900 text-white flex items-center justify-center text-[8px] font-semibold shrink-0">다</div>
              <div className="bg-white rounded-xl rounded-tl-md px-3 py-2 text-[11px] text-nature-900 leading-[1.6] shadow-sm">
                어제 저녁은 드셨나요? 🍽️
              </div>
            </div>
            {/* 사용자 답변 버튼들 */}
            <div className="flex justify-end gap-1.5">
              <div className="bg-nature-900 text-white rounded-xl rounded-br-md px-3 py-1.5 text-[11px]">
                간단히 먹었어요
              </div>
            </div>
            {/* AI 후속 */}
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-nature-900 text-white flex items-center justify-center text-[8px] font-semibold shrink-0">다</div>
              <div className="bg-white rounded-xl rounded-tl-md px-3 py-2 text-[11px] text-nature-900 leading-[1.6] shadow-sm">
                채소는 드셨나요? 🥗
                <div className="flex gap-1 mt-1.5">
                  {['충분히', '조금', '못 먹었어요'].map(opt => (
                    <span key={opt} className="px-2 py-0.5 rounded-full text-[9px] bg-cream-300 text-neutral-400 border border-cream-500">{opt}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 설명 */}
        <div className="text-[12px] text-neutral-400 leading-[1.7] mb-4">
          {current.desc}
        </div>

        {/* 하단: 도트 + 버튼 */}
        <div className="flex items-center justify-between">
          {/* 진행 도트 */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-nature-900' : i < step ? 'bg-nature-500' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <button
                onClick={finish}
                className="text-[11px] text-neutral-400 hover:text-nature-900 transition-colors"
              >
                건너뛰기
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 bg-nature-900 text-white text-[12px] font-medium rounded-lg hover:bg-nature-800 transition-colors"
            >
              {step < STEPS.length - 1 ? '다음' : '시작하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
