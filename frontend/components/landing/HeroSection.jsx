'use client';

import Icon from './Icon';
import HeroOmni from './HeroOmni';
import { useMagneticButton } from '../../hooks/landing/useMagneticButton';

export default function HeroSection() {
  const ctaRef = useMagneticButton();

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            만성질환 생활관리 솔루션
          </span>
          <h1 id="hero-title" className="h1">
            <span>매일 쓰는 AI와</span>
            <br />
            <span>할 일 관리 시스템 안에서,</span>
            <br />
            <em>자연스럽게 건강관리까지 잡다.</em>
          </h1>
          <p className="hero__sub lead">
            새 앱 설치도, 비싼 센서도 없습니다. 평소처럼 AI와 대화하는 동안 식사·수면·기분 같은 생활 패턴이 자동으로 쌓이고,
            FINDRISC 기반 <strong>참고 위험도</strong>와 7일 챌린지로 자연스럽게 이어지는 — 일상에 녹아든 건강관리 솔루션입니다.
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary btn--lg" href="/login" ref={ctaRef}>
              무료로 시작하기
              <Icon id="arrow" size={16} />
            </a>
            <a className="btn btn--ghost btn--lg" href="#solution">
              어떻게 작동하는지 보기
            </a>
          </div>
          <div className="hero__assure">
            <Icon id="check" size={14} />
            이메일만으로 30초 가입 · 카드 등록 없음 · 센서 구매 없음
          </div>
          <p className="hero__disclaimer" role="note">
            ※ 다나아는 의료 진단을 대체하지 않는 <strong>참고용 생활관리 도구</strong>입니다.
          </p>
        </div>

        {/* Hero visual — omni(배경 z=0) + mock window(z=1) + floats 공존 */}
        <div className="hero__visual hero__visual--mock" aria-hidden="true">
          <HeroOmni />

          <div className="mock-window">
            <div className="mock-window__bar">
              <span className="mock-dot mock-dot--r" />
              <span className="mock-dot mock-dot--y" />
              <span className="mock-dot mock-dot--g" />
              <div className="mock-tabs">
                <span className="mock-tab is-active">
                  <span className="mock-tab__mark">D</span>다나아
                </span>
                <span className="mock-tab mock-tab--ghost">+</span>
              </div>
              <div className="mock-url">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                danaa.kr
              </div>
            </div>
            <div className="mock-window__body">
              <div className="mock-bubble mock-bubble--me">오늘 점심 비빔밥 먹었어. 단백질 충분할까?</div>
              <div className="mock-bubble mock-bubble--ai">
                <div className="mock-bubble__name">다나아 AI</div>
                비빔밥 한 그릇은 보통 단백질 18~22g 정도예요. 보통 성인 1끼 권장량(20~25g)에 거의 맞춰 들어옵니다.
              </div>
              <div className="mock-card">
                <div className="mock-card__head">
                  <span className="mock-card__icon">
                    <Icon id="sparkles" size={14} />
                  </span>
                  <span className="mock-card__label">대화 흐름 끊지 않는 1초 기록</span>
                </div>
                <div className="mock-card__title">채소도 충분히 드셨어요?</div>
                <div className="mock-card__opts">
                  <span className="mock-opt">충분히</span>
                  <span className="mock-opt mock-opt--mid">조금</span>
                  <span className="mock-opt mock-opt--low">거의 없음</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-float hero-float--risk">
            <div className="hero-float__label geist">참고 위험도</div>
            <div className="hero-float__value">
              <strong>62</strong>
              <span>/ 100</span>
              <em className="hero-float__tag">중간</em>
            </div>
            <div className="hero-float__bar">
              <span style={{ width: '62%' }} />
            </div>
            <div className="hero-float__foot">FINDRISC 기준 · 의료 진단 아님</div>
          </div>

          <div className="hero-float hero-float--challenge">
            <div className="hero-float__label geist">7일 챌린지</div>
            <div className="hero-float__row">
              <span className="hero-float__title">물 8잔 마시기</span>
              <span className="hero-float__count">4 / 8</span>
            </div>
            <div className="hero-float__dots">
              <span className="dot dot--on" />
              <span className="dot dot--on" />
              <span className="dot dot--on" />
              <span className="dot dot--on" />
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
