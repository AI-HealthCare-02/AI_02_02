'use client';

import Icon from './Icon';
import { useMagneticButton } from '../../hooks/landing/useMagneticButton';

export default function CtaSection() {
  const ctaRef = useMagneticButton();

  return (
    <section className="cta" id="cta" aria-labelledby="cta-title">
      <div className="container">
        <div className="cta__box">
          <div className="cta__copy">
            <h2 id="cta-title" className="cta__title">
              3개월 뒤의 생활습관,
              <br />
              오늘 한 탭에서 시작합니다.
            </h2>
            <p className="cta__sub">
              이미 매일 AI를 쓰고 있다면 추가 부담은 0. 작은 기록이 쌓일수록 큰 변화로 이어집니다.
            </p>
            <div className="cta__actions">
              <a className="btn btn--white btn--lg" href="/login" ref={ctaRef}>
                무료로 시작하기
                <Icon id="arrow" size={16} />
              </a>
              <a className="btn btn--outline-light btn--lg" href="#solution">
                작동 방식 다시 보기
              </a>
            </div>
            <p className="cta__assure">이메일만으로 30초 가입 · 카드 등록 없음 · 의료 서비스가 아닙니다</p>
          </div>
          <div className="cta__panel" aria-hidden="true">
            <div className="cta__panel-head">
              <span className="pulse" />
              오늘의 흐름
            </div>
            <div className="cta__panel-row">
              <Icon id="check" size={14} />
              AI에게 점심 추천 받음
            </div>
            <div className="cta__panel-row">
              <Icon id="check" size={14} />
              "채소 충분히?" 카드 → 양호
            </div>
            <div className="cta__panel-row">
              <Icon id="check" size={14} />
              수면 6시간 — 주의 단서 1건
            </div>
            <div className="cta__panel-row">
              <Icon id="check" size={14} />
              챌린지 "물 8잔" 4 / 8
            </div>
            <div className="cta__panel-tags">
              <span className="pill pill--green">+1 양호</span>
              <span className="pill pill--orange">주의 1</span>
              <span className="pill pill--gray">진행중</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
