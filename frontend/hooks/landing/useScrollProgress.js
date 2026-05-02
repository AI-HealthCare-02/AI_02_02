'use client';

import { useEffect, useRef } from 'react';

/**
 * 스크롤 진행도(0~100%)를 ref로 받은 element.style.width로 직접 주입.
 * V4 JS L2705 updateProgress() 와 동일 동작 — requestAnimationFrame + passive scroll.
 * React state 안 씀 (60fps 리렌더 방지).
 */
export function useScrollProgress() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    let ticking = false;

    const update = () => {
      const h = document.documentElement;
      const scrollTop = h.scrollTop || document.body.scrollTop;
      const scrollHeight = h.scrollHeight - h.clientHeight;
      const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      el.style.width = pct + '%';
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return ref;
}
