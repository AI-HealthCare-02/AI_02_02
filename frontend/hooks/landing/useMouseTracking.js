'use client';

import { useEffect } from 'react';

/**
 * 글로벌 마우스 위치를 :root --mouse-x / --mouse-y 로 주입.
 * V4 JS L2748 onMouseMove() — Hero parallax 등 글로벌 효과에 사용.
 *
 * 터치 디바이스 또는 prefers-reduced-motion 시 비활성.
 */
export function useGlobalMouseTracking({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if ('ontouchstart' in window) return;

    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        document.documentElement.style.setProperty('--mouse-x', x + '%');
        document.documentElement.style.setProperty('--mouse-y', y + '%');
        raf = null;
      });
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);
}

/**
 * 특정 element 안 마우스 위치를 --mx / --my 로 주입 (로컬 spotlight용).
 * V4 JS L2765 [data-spotlight] — Bento cell A 카드의 라디얼 스포트라이트.
 *
 * 사용: const ref = useLocalMouseTracking(); → <div ref={ref} data-spotlight>
 */
export function useLocalMouseTracking({ enabled = true } = {}) {
  return (node) => {
    if (!node || !enabled) return;
    if (typeof window === 'undefined' || 'ontouchstart' in window) return;

    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = node.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        node.style.setProperty('--mx', mx + '%');
        node.style.setProperty('--my', my + '%');
        raf = null;
      });
    };
    const onLeave = () => {
      node.style.removeProperty('--mx');
      node.style.removeProperty('--my');
    };
    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);
    // ref callback cleanup은 React 19+ 에서 지원. 18에서는 cleanup 안전하게 무시.
    node.__cleanupMouse = () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  };
}
