'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Service Flow 가로 3D Deck 네비게이션 — V4 JS L2818 setDeck() + 키보드 + 터치.
 *
 * 5장 카드를 활성 인덱스 기준으로 -2/-1/0/+1/+2 offset 부여.
 * stageRef를 받은 element에 keydown(←/→) + touchstart/touchend 부착.
 *
 * SSR-safe — 초기 activeIdx=0 정적 → 서버 HTML과 hydration 일치.
 */
export function useDeckNavigation(total) {
  const [activeIdx, setActiveIdx] = useState(0);
  const stageRef = useRef(null);

  const setDeck = useCallback(
    (next) => {
      setActiveIdx((curr) => {
        const value = typeof next === 'function' ? next(curr) : next;
        return ((value % total) + total) % total;
      });
    },
    [total],
  );

  // 키보드 + 터치 이벤트 — stageRef에 부착
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof window === 'undefined') return;

    if (!stage.hasAttribute('tabindex')) stage.setAttribute('tabindex', '0');

    const onKeydown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDeck((i) => i - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDeck((i) => i + 1);
      }
    };

    let touchX = null;
    const onTouchStart = (e) => {
      touchX = e.touches[0].clientX;
    };
    const onTouchEnd = (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) setDeck((i) => i + (dx < 0 ? 1 : -1));
      touchX = null;
    };

    stage.addEventListener('keydown', onKeydown);
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchend', onTouchEnd);
    return () => {
      stage.removeEventListener('keydown', onKeydown);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchend', onTouchEnd);
    };
  }, [setDeck]);

  /** 카드 인덱스 → data-offset attribute 값 */
  const getOffsetLabel = useCallback(
    (cardIdx) => {
      const offset = cardIdx - activeIdx;
      if (offset === 0) return '0';
      if (offset === -1) return '-1';
      if (offset === 1) return '1';
      if (offset === -2) return '-2';
      if (offset === 2) return '2';
      return 'hidden';
    },
    [activeIdx],
  );

  return { activeIdx, setDeck, stageRef, getOffsetLabel };
}
