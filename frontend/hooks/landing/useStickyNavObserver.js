'use client';

import { useEffect, useRef } from 'react';

/**
 * Nav가 sticky 상태가 되면 .is-stuck 클래스 추가 — body 최상단에 1px sentinel.
 * V4 JS L2723 — IntersectionObserver(sentinel) 패턴.
 */
export function useStickyNavObserver() {
  const navRef = useRef(null);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl || typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(([entry]) => {
      navEl.classList.toggle('is-stuck', !entry.isIntersecting);
    });
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  return navRef;
}
