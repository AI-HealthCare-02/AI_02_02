'use client';

import { useEffect, useState } from 'react';

/**
 * 사용자가 prefers-reduced-motion: reduce 를 선호하는지 여부.
 * SSR 안전 — 초기 렌더는 false (motion-on) → mount 후 matchMedia 결과로 갱신.
 * V4 mockup: window.matchMedia('(prefers-reduced-motion: reduce)').matches (L2703)
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  return reduced;
}
