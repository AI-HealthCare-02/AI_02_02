'use client';

import { useEffect, useRef } from 'react';

/**
 * 자석 버튼 — 마우스가 버튼에 가까이 가면 살짝 따라 움직임.
 * V4 JS L2786 [data-magnetic] — CTA 버튼들에 사용.
 * --btn-x / --btn-y CSS var를 element style에 직접 주입.
 *
 * 사용: const ref = useMagneticButton(); → <a ref={ref} className="btn ...">
 */
export function useMagneticButton({ strength = 0.18, enabled = true } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn || !enabled || typeof window === 'undefined') return;
    if ('ontouchstart' in window) return;

    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) * strength;
        const dy = (e.clientY - cy) * (strength + 0.04);
        btn.style.setProperty('--btn-x', dx + 'px');
        btn.style.setProperty('--btn-y', dy + 'px');
        raf = null;
      });
    };
    const onLeave = () => {
      btn.style.setProperty('--btn-x', '0px');
      btn.style.setProperty('--btn-y', '0px');
    };
    btn.addEventListener('mousemove', onMove);
    btn.addEventListener('mouseleave', onLeave);
    return () => {
      btn.removeEventListener('mousemove', onMove);
      btn.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength, enabled]);

  return ref;
}
