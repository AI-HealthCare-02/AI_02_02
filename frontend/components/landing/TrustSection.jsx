'use client';

import Icon from './Icon';

const CARDS = [
  {
    icon: 'shield',
    title: '진단 아닌, 참고 도구',
    desc: '위험도와 코칭은 모두 참고 지표일 뿐입니다. 최종 판단은 의료 전문가와 함께 내려주세요.',
  },
  {
    icon: 'lock',
    title: '3중 안전 가드',
    desc: '위기 신호는 LLM 호출 전 차단, 단정 표현은 권유형으로 자동 변환, 모든 응답에 면책 안내가 자동으로 붙습니다.',
  },
  {
    icon: 'data',
    title: '데이터는 언제든 회수',
    desc: '원본 건강 수치는 외부 LLM에 전송되지 않습니다. 라벨화된 위험 구간만 프롬프트에 포함되고, 내보내기·삭제는 언제든 가능합니다.',
  },
];

const STATS = [
  { value: 'FINDRISC 8 + 생활 8', label: '참고 입력 변수 항목' },
  { value: '3중', label: '개인정보 보호 기준' },
  { value: '4가지', label: '사용자 권리 (열람·정정·삭제·처리정지)' },
  { value: '제로', label: '원시 건강 수치 외부 전송' },
];

export default function TrustSection() {
  return (
    <section className="section trust" id="trust" aria-labelledby="trust-title">
      <div className="container">
        <div className="section__head" data-reveal>
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            안전·신뢰
          </span>
          <h2 id="trust-title" className="h2">
            "참고용 도구"라는 약속,
            <br />
            코드까지 지킵니다.
          </h2>
          <p className="lead">
            의료 진단을 대체하지 않습니다. 안전 가드 · 개인정보 보호 · 데이터 통제 —
            <br />
            세 가지를 코드 레벨에서 운영합니다.
          </p>
        </div>

        <div className="trust__grid" data-reveal-stagger>
          {CARDS.map((c) => (
            <article key={c.title} className="trust__card">
              <div className="trust__icon">
                <Icon id={c.icon} size={22} />
              </div>
              <h3 className="trust__title">{c.title}</h3>
              <p className="trust__desc">{c.desc}</p>
            </article>
          ))}
        </div>

        <div className="trust__stats" aria-label="현재 검증 상태">
          {STATS.map((s) => (
            <div key={s.label} className="trust__stat">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <p className="trust__disclaim">
          위 항목은 <strong>참고 입력</strong>이며 진단 도구가 아닙니다. 의료 상담이 필요하면 의료기관(보건소·병원)에 방문하세요.
        </p>
      </div>
    </section>
  );
}
