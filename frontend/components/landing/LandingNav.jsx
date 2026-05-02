'use client';

import Icon from './Icon';
import { useStickyNavObserver } from '../../hooks/landing/useStickyNavObserver';
import { useMagneticButton } from '../../hooks/landing/useMagneticButton';

const NAV_LINKS = [
  { href: '#solution', label: '작동 방식' },
  { href: '#features', label: '핵심 기능' },
  { href: '#deck', label: '서비스 흐름' },
  { href: '#compare', label: '비교' },
  { href: '#trust', label: '안전·신뢰' },
];

export default function LandingNav() {
  const navRef = useStickyNavObserver();
  const ctaRef = useMagneticButton();

  return (
    <header className="nav" id="nav" role="banner" ref={navRef}>
      <div className="container nav__inner">
        <a href="#" className="brand" aria-label="DANAA 홈">
          <span className="brand__mark" aria-hidden="true">D</span>
          <span className="brand__name">DANAA</span>
        </a>
        <nav aria-label="주 메뉴">
          <ul className="nav__links">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="btn btn--primary" href="/login" ref={ctaRef}>
          무료로 시작
          <Icon id="arrow" size={14} />
        </a>
      </div>
    </header>
  );
}
