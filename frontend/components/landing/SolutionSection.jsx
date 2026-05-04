'use client';

import Icon from './Icon';

const STEPS = [
  {
    num: '01',
    icon: 'list',
    title: 'Do it OS로 하루를 굴립니다',
    desc: (
      <>
        생각·일정·할 일·프로젝트를 한곳에서 정리합니다. 일상이 정돈되는 동안 피로·수면·식사 같은{' '}
        <strong>생활 패턴이 함께 드러납니다</strong>.
      </>
    ),
  },
  {
    num: '02',
    icon: 'message',
    title: 'AI 대화 중에 1초 기록',
    desc: (
      <>
        평소처럼 AI에게 묻고 답하면, 응답 끝에 가벼운 건강 질문이 한두 장 붙습니다. <strong>탭 한 번이면 기록 끝</strong> — 대화 흐름은 끊기지 않습니다.
      </>
    ),
  },
  {
    num: '03',
    icon: 'target',
    title: '참고 위험도·작은 챌린지로',
    desc: (
      <>
        쌓인 기록은 FINDRISC 기반 위험도, 생활습관 분석, 7일 단위 챌린지로 정리되어 <strong>실제 행동으로 이어집니다</strong>.
      </>
    ),
  },
];

export default function SolutionSection() {
  return (
    <section className="section solution" id="solution" aria-labelledby="solution-title">
      <div className="container">
        <div className="section__head" data-reveal>
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            다나아는 이렇게 풉니다
          </span>
          <h2 id="solution-title" className="h2">
            하루를 운영하다 보면,
            <br />
            건강 데이터가 따라옵니다.
          </h2>
          <p className="lead">
            "매일 입력해야 하는 앱"이 아니라, 이미 쓰는 AI·할 일 관리 안에서 자연스럽게 데이터가 쌓이는 구조 —{' '}
            <strong>건강 입력이 아닌, 건강이 자동으로 따라오는 흐름</strong>입니다.
          </p>
        </div>
        <div className="solution__steps" data-reveal-stagger>
          {STEPS.map((s) => (
            <article key={s.num} className="step">
              <div className="step__head">
                <span className="step__index geist">{s.num}</span>
                <span className="step__icon">
                  <Icon id={s.icon} size={16} />
                </span>
              </div>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__desc">{s.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
