'use client';

import Icon from './Icon';
import { useDeckNavigation } from '../../hooks/landing/useDeckNavigation';

/**
 * 효과 ④ 3D 입체 스크롤 네비게이션 — 가로 3D 캐러셀.
 * - CSS 3D Transforms (perspective 1800px + rotateY ±28deg + translateZ -80~-220px)
 * - 키보드 ←/→, 터치 스와이프, 화살표 버튼, 도트 인디케이터, 탭 메뉴
 * - IntersectionObserver는 reveal-on-scroll에서 처리
 */

const TABS = [
  { idx: 0, num: '01', label: '일상에 녹다' },
  { idx: 1, num: '02', label: '패턴이 쌓인다' },
  { idx: 2, num: '03', label: '위험도로 정리' },
  { idx: 3, num: '04', label: '작은 챌린지' },
  { idx: 4, num: '05', label: '다시 들어오게' },
];

const CARDS = [
  {
    num: '01 — 일상에 녹다',
    title: 'Do it OS로 하루를 운영합니다.',
    desc: '생각 정리 · 일정 · 할 일 · 프로젝트 · 자기 전 회고 — 매일 켜는 하나의 운영 공간 안에서 일상이 흘러갑니다.',
    rows: [
      { icon: 'calendar', strong: '오늘 일정', value: '5건', tag: { text: '진행', mod: '' } },
      { icon: 'list', strong: '할 일', value: '11개', tag: { text: '정리', mod: '' } },
      { icon: 'moon', strong: '자기 전 회고', value: '22:30', tag: { text: '예정', mod: 'orange' } },
    ],
  },
  {
    num: '02 — 패턴이 쌓인다',
    title: 'AI 대화 속에서 생활 데이터가 자동으로.',
    desc: '평소처럼 AI에게 묻고 답하면, 답변 끝에 가벼운 건강 카드 한 장 — 탭 한 번이면 식사 · 수면 · 기분이 자동으로 정리됩니다.',
    rows: [
      { icon: 'message', strong: '오늘 대화', value: '7회', tag: { text: '자연 흐름', mod: '' } },
      { icon: 'bolt', strong: '인라인 카드 응답', value: '4건', tag: { text: '+ 생활 데이터', mod: 'orange' } },
      { icon: 'data', strong: '정리된 항목', value: '식사 · 수면 · 운동 · 기분', tag: { text: '자동', mod: '' } },
    ],
  },
  {
    num: '03 — 위험도로 정리',
    title: 'FINDRISC 기반 참고 위험도로 한눈에.',
    desc: '국제 검증된 FINDRISC 8개 변수 + 생활기록 8개 항목 — 현재 당뇨 위험도와 1주일 추세를 참고용 지표로 보여줍니다.',
    rows: [
      { icon: 'activity', strong: '참고 위험도', value: '62 / 100', tag: { text: '중간', mod: 'orange' } },
      { icon: 'target', strong: '주간 추세', value: '−3점', tag: { text: '개선 중', mod: '' } },
      { icon: 'shield', strong: '표시', value: '의료 진단 아님', tag: { text: '참고용', mod: 'purple' } },
    ],
  },
  {
    num: '04 — 작은 챌린지',
    title: '기록이 아닌, 실행으로 이어집니다.',
    desc: '7일 단위 작은 도전을 추천하고, 채팅 안에서 자동 체크인 — 6티어 뱃지(브론즈→챔피언)가 차곡차곡 쌓입니다.',
    rows: [
      { icon: 'trophy', strong: '진행 챌린지', value: '물 8잔 마시기', tag: { text: '4 / 8', mod: '' } },
      { icon: 'bolt', strong: '스트릭', value: '3일 연속', tag: { text: '유지', mod: '' } },
      { icon: 'sparkles', strong: '다음 뱃지', value: '실버까지 2회', tag: { text: '곧 도착', mod: 'orange' } },
    ],
  },
  {
    num: '05 — 다시 들어오게',
    title: '내일 다시 만나는 가벼운 호기심 한 장.',
    desc: '생년월일 기반의 기질 해석과 오늘의 카드 — 자기이해와 재미가 자연스러운 재방문 후크가 됩니다. 의료·심리 진단이 아닙니다.',
    rows: [
      { icon: 'sparkles', strong: '오늘의 카드', value: '바람의 날', tag: { text: '참고', mod: 'purple' } },
      { icon: 'calendar', strong: '월간 흐름', value: '5월 첫째 주', tag: { text: '정리 시기', mod: '' } },
      { icon: 'shield', strong: '표시', value: '참고 리딩', tag: { text: '의료 아님', mod: 'purple' } },
    ],
  },
];

export default function ServiceFlowDeck() {
  const { activeIdx, setDeck, stageRef, getOffsetLabel } = useDeckNavigation(CARDS.length);

  return (
    <section className="scroll-nav" id="deck" aria-labelledby="deck-title">
      <div className="container">
        <div className="section__head" data-reveal>
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            Service Flow
          </span>
          <h2 id="deck-title" className="h2">
            사용자가 다나아 안에서
            <br />
            지나는 다섯 단계.
          </h2>
          <p className="lead">
            왼쪽 ↔ 오른쪽으로 카드를 넘기면, 일상→데이터→행동→재방문까지
            <br />
            이어지는 흐름이 입체로 펼쳐집니다.
          </p>
        </div>

        <ul className="scroll-nav__tabs" id="deckTabs" role="tablist" aria-label="서비스 흐름 단계">
          {TABS.map((t) => (
            <li key={t.idx}>
              <button
                type="button"
                className="scroll-nav__tab"
                role="tab"
                aria-current={t.idx === activeIdx ? 'true' : 'false'}
                onClick={() => setDeck(t.idx)}
              >
                <span className="scroll-nav__num">{t.num}</span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        <div
          className="deck-stage"
          id="deckStage"
          ref={stageRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="서비스 흐름 5단계 카드"
        >
          <div className="deck-track" id="deckTrack">
            {CARDS.map((card, i) => (
              <article
                key={i}
                className="deck-card"
                data-deck-card={i}
                data-offset={getOffsetLabel(i)}
                aria-hidden={i !== activeIdx}
              >
                <div className="deck-card__head">
                  <span className="deck-card__num">{card.num}</span>
                </div>
                <h3 className="deck-card__title">{card.title}</h3>
                <p className="deck-card__desc">{card.desc}</p>
                <div className="deck-card__visual">
                  {card.rows.map((r, j) => (
                    <div key={j} className="deck-row">
                      <Icon id={r.icon} size={16} />
                      <strong>{r.strong}</strong>
                      {r.value}
                      <span className={`deck-tag${r.tag.mod ? ` deck-tag--${r.tag.mod}` : ''}`}>{r.tag.text}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="deck-controls" role="group" aria-label="카드 탐색">
          <button
            type="button"
            className="deck-arrow"
            id="deckPrev"
            aria-label="이전 단계"
            onClick={() => setDeck((i) => i - 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="deck-dots" id="deckDots" role="tablist" aria-label="단계 인디케이터">
            {CARDS.map((_, i) => (
              <button
                key={i}
                type="button"
                className="deck-dot"
                data-deck-dot={i}
                role="tab"
                aria-selected={i === activeIdx ? 'true' : 'false'}
                aria-current={i === activeIdx ? 'true' : 'false'}
                aria-label={`${i + 1}단계`}
                onClick={() => setDeck(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="deck-arrow"
            id="deckNext"
            aria-label="다음 단계"
            onClick={() => setDeck((i) => i + 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
