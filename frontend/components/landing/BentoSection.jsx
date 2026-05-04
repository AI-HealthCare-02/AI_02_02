'use client';

import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { useLocalMouseTracking } from '../../hooks/landing/useMouseTracking';

/**
 * 효과 1: 벤토 박스 레이아웃 (CSS Grid 12-col + Flexbox + Hover transform).
 * - cell A 큰 카드(span 7/2)에 Bento spotlight (마우스 따라가는 라디얼 그라데이션)
 * - cell B (5/1), cell C (5/1), cell D 다크(6/1), cell E 보라(6/1), cell F 가로 (12/1)
 */
export default function BentoSection() {
  const cellARef = useRef(null);
  const attachLocal = useLocalMouseTracking();

  useEffect(() => {
    if (cellARef.current) attachLocal(cellARef.current);
    return () => {
      const node = cellARef.current;
      if (node && node.__cleanupMouse) node.__cleanupMouse();
    };
  }, [attachLocal]);

  return (
    <section className="section bento" id="features" aria-labelledby="features-title">
      <div className="container">
        <div className="section__head" data-reveal>
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            핵심 기능
          </span>
          <h2 id="features-title" className="h2">
            한 화면에 담긴,
            <br />
            다나아의 다섯 가지 흐름.
          </h2>
          <p className="lead">
            일상 운영 → AI 대화 → 참고 위험도 → 작은 챌린지 → 재방문 후크.
            <br />
            다섯 기능이 끊기지 않고 하나의 순환을 그립니다.
          </p>
        </div>

        <div className="bento__grid" data-reveal-stagger>
          {/* A: Do it OS — span 7/2, spotlight */}
          <article
            ref={cellARef}
            className="bento__cell bento__cell--a"
            aria-labelledby="bento-a"
            data-spotlight
          >
            <div className="bento__head">
              <span className="bento__icon">
                <Icon id="list" size={22} />
              </span>
              <span className="bento__num geist">01 / DO IT OS</span>
            </div>
            <h3 id="bento-a" className="bento__title">
              하루를 운영하다 보면,
              <br />
              생활 패턴이 자동으로 쌓인다.
            </h3>
            <p className="bento__desc">
              생각 정리·일정·할 일·프로젝트·자기 전 회고를 한곳에서. 일상이 정돈되는 동안{' '}
              <strong>생활 패턴 데이터가 함께 따라옵니다</strong>.
            </p>
            <div className="doit-mock" aria-hidden="true">
              <div className="doit-mock__col">
                <h4>오늘 할 일</h4>
                <div className="doit-mock__row"><span className="doit-mock__check is-done" />회의록 정리<span className="pill pill--gray">완료</span></div>
                <div className="doit-mock__row"><span className="doit-mock__check" />저녁 산책 30분<span className="pill pill--green">생활</span></div>
                <div className="doit-mock__row"><span className="doit-mock__check" />발표 자료 초안<span className="pill pill--gray">업무</span></div>
              </div>
              <div className="doit-mock__col">
                <h4>정리된 패턴</h4>
                <div className="doit-mock__row"><span className="doit-mock__check is-done" />수면 6시간<span className="pill pill--orange">주의</span></div>
                <div className="doit-mock__row"><span className="doit-mock__check is-done" />점심 채소 충분<span className="pill pill--green">양호</span></div>
                <div className="doit-mock__row"><span className="doit-mock__check" />야식 가능성<span className="pill pill--orange">주의</span></div>
              </div>
            </div>
          </article>

          {/* B: AI 채팅 — hover 시 mock UI fade-out + 추가 설명 fade-in (Airtable 패턴) */}
          <article className="bento__cell bento__cell--b" aria-labelledby="bento-b">
            <div className="bento__head">
              <span className="bento__icon">
                <Icon id="message" size={22} />
              </span>
              <span className="bento__num geist">02 / AI CHAT</span>
            </div>
            <h3 id="bento-b" className="bento__title">
              대화는 그대로,
              <br />
              건강만 1초 만에 기록.
            </h3>
            <p className="bento__desc">AI 답변 끝에 작은 건강 카드 한 장이 톡 — 탭 한 번이면 끝납니다.</p>
            <div className="chat-mock" aria-hidden="true">
              <div className="chat-mock__bubble">점심 비빔밥 먹었어. 단백질 충분할까?</div>
              <div className="chat-mock__card">
                <div>
                  <strong>채소 충분히 드셨어요?</strong>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>탭 한 번이면 기록 끝</div>
                </div>
                <span className="pill pill--orange">+1</span>
              </div>
            </div>
          </article>

          {/* C: 참고 위험도 */}
          <article className="bento__cell bento__cell--c" aria-labelledby="bento-c" data-observe>
            <div className="bento__head">
              <span className="bento__icon">
                <Icon id="activity" size={22} />
              </span>
              <span className="bento__num geist">03 / RISK</span>
            </div>
            <h3 id="bento-c" className="bento__title">
              FINDRISC 기반
              <br />
              참고 위험도 한눈에.
            </h3>
            <p className="bento__desc">국제적으로 쓰이는 8개 변수로 당뇨 위험도를 가늠합니다.</p>
            <div className="gauge" aria-hidden="true"><div className="gauge__fill" /></div>
            <div className="gauge__legend"><span>LOW</span><span>MID</span><span>HIGH</span></div>
            <div className="gauge__value geist">62<small>/ 26점 환산 · 참고용</small></div>
            <p className="bento__footnote">FINDRISC는 참고용 지표이며, 의료 진단을 대체하지 않습니다.</p>
          </article>

          {/* D: 챌린지 (다크) */}
          <article className="bento__cell bento__cell--d" aria-labelledby="bento-d">
            <div className="bento__head">
              <span className="bento__icon">
                <Icon id="trophy" size={22} />
              </span>
              <span className="bento__num geist">04 / CHALLENGE</span>
            </div>
            <h3 id="bento-d" className="bento__title">
              기록만 쌓이지 않습니다.
              <br />
              실행으로 이어집니다.
            </h3>
            <p className="bento__desc">7일 단위 작은 도전 → 실행 여부 자동 체크 → 6티어 뱃지로 가볍게 동기 부여.</p>
            <div className="badges" aria-hidden="true">
              <span className="badge badge--bronze">B</span>
              <span className="badge badge--silver">S</span>
              <span className="badge badge--gold">G</span>
              <span className="badge badge--diamond">D</span>
              <span className="badge badge--master">M</span>
              <span className="badge badge--champ">C</span>
            </div>
          </article>

          {/* E: 사주 (보라) */}
          <article className="bento__cell bento__cell--e" aria-labelledby="bento-e">
            <div className="bento__head">
              <span className="bento__icon">
                <Icon id="sparkles" size={22} />
              </span>
              <span className="bento__num geist">05 / SAJU HOOK</span>
            </div>
            <h3 id="bento-e" className="bento__title">
              내일 다시 들어오게 만드는
              <br />
              가벼운 호기심 한 장.
            </h3>
            <p className="bento__desc">생년월일 기반 기질 해석과 오늘의 카드 — 자기이해와 재미를 자연스러운 재방문 후크로 활용합니다.</p>
            <div className="saju-mock" aria-hidden="true">
              <div className="saju-card">
                <span className="saju-card__day geist">TODAY</span>
                <span className="saju-card__title">바람의 날</span>
                <span className="saju-card__sub">선택보다 정리가 좋은 날</span>
              </div>
              <div className="saju-card">
                <span className="saju-card__day geist">TRAIT</span>
                <span className="saju-card__title">내향형 정리가</span>
                <span className="saju-card__sub">루틴에서 강해지는 기질</span>
              </div>
            </div>
            <p className="bento__footnote">사주는 자기이해와 재미를 위한 참고 리딩이며, 의료·심리 진단이 아닙니다.</p>
          </article>

          {/* F: 데이터 흐름 가로 */}
          <article className="bento__cell bento__cell--f" aria-labelledby="bento-f">
            <div className="bento__head">
              <span className="bento__icon">
                <Icon id="flow" size={22} />
              </span>
              <span className="bento__num geist">06 / DATA FLOW</span>
            </div>
            <h3 id="bento-f" className="bento__title">투명함으로 신뢰를 만든다</h3>
            <p className="bento__desc">당신의 데이터가 어디서 어디로 흐르는지 모두 공개합니다.</p>
            <div className="flow" aria-hidden="true">
              <div className="flow__step">
                <span className="flow__label">① 입력</span>
                <h4 className="flow__title">Do it OS · AI 채팅</h4>
                <p className="flow__desc">일상 정리 + 인라인 건강 질문</p>
              </div>
              <div className="flow__step">
                <span className="flow__label">② 정리</span>
                <h4 className="flow__title">생활 패턴 분류</h4>
                <p className="flow__desc">피로·수면·식사·스트레스 자동 정리</p>
              </div>
              <div className="flow__step">
                <span className="flow__label">③ 참고 지표</span>
                <h4 className="flow__title">FINDRISC 위험도</h4>
                <p className="flow__desc">8개 변수 기반 참고 점수</p>
              </div>
              <div className="flow__step">
                <span className="flow__label">④ 행동</span>
                <h4 className="flow__title">7일 챌린지 추천</h4>
                <p className="flow__desc">작은 도전 + 뱃지로 실행</p>
              </div>
            </div>
          </article>
        </div>

        <p className="bento__disclaim">
          위 모든 기능은 <strong>생활습관 관리 참고 정보</strong>이며, 의료 진단·처방을 대체하지 않습니다.
        </p>
      </div>
    </section>
  );
}
