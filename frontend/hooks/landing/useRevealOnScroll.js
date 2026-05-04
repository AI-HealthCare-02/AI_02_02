'use client';

import { useEffect } from 'react';

/**
 * data-reveal / data-reveal-stagger / data-observe 마커가 있는 요소가 viewport에
 * 들어오면 .is-in 클래스 추가 → CSS transition으로 등장.
 * V4 JS L2734 — IntersectionObserver(threshold:0.15, rootMargin:'0px 0px -80px 0px').
 *
 * 컴포넌트 트리가 마운트된 뒤에 호출 — selector 기반이라 dependency: [].
 */
export function useRevealOnScroll(selector = '[data-reveal], [data-reveal-stagger], [data-observe]') {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      // fallback: 모두 즉시 보이게
      document.querySelectorAll(selector).forEach((el) => el.classList.add('is-in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' },
    );

    document.querySelectorAll(selector).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);
}
