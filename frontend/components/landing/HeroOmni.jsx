'use client';

/**
 * V2에 있던 옴니 원형 애니메이션 부활 — V4의 mock-window와 공존하기 위해
 * .hero__visual 안 절대 위치 0번 레이어로 배치.
 *
 * SVG 점선 원 3겹 + radial gradient orb + 라벨.
 * 애니메이션은 100% CSS keyframes (omniDraw1/2/3, omniSpin) — landing.css에 이식됨.
 * prefers-reduced-motion 시에도 CSS 미디어쿼리에 의해 자동 정지.
 */
export default function HeroOmni() {
  return (
    <div className="hero-omni" aria-hidden="true">
      <div className="orb" />
      <div className="omni">
        <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
          <circle className="omni__ring omni__ring--1" cx="200" cy="200" r="60" />
          <circle className="omni__ring omni__ring--2" cx="200" cy="200" r="90" />
          <circle className="omni__ring omni__ring--3" cx="200" cy="200" r="120" />
        </svg>
      </div>
    </div>
  );
}
