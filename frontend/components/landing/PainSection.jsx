'use client';

const PAINS = [
  {
    num: '01',
    title: '앱 하나 더 켜는 게 부담',
    desc: '건강검진에서 경고를 받아도, 매일 별도 앱을 켜기란 쉽지 않습니다. ChatGPT는 매일 들어가면서 헬스 앱 아이콘만 안 눌리는 이유입니다.',
  },
  {
    num: '02',
    title: '매번 손으로 입력 못 합니다',
    desc: '식사·수면·운동을 매일 폼에 적자니 회의 한 번 길어지면 그날 저녁부터 기록은 끝. 일주일이면 자연스럽게 손을 놓게 됩니다.',
  },
  {
    num: '03',
    title: '센서·구독료 진입 장벽',
    desc: 'CGM(연속혈당측정기) 센서는 수십만 원, 병·의원 방문은 더 어렵습니다. "한번 가볍게 시작해 볼" 수단이 비어 있습니다.',
  },
];

export default function PainSection() {
  return (
    <section className="section pain" aria-labelledby="pain-title">
      <div className="container">
        <div className="section__head" data-reveal>
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            왜 기존 건강 앱은 통하지 않나
          </span>
          <h2 id="pain-title" className="h2">
            앱은 좋은데,
            <br />
            일주일이 못 갑니다.
          </h2>
          <p className="lead">
            사용자 게으름이 아닙니다. 매일 새 앱을 켜고 일일이 입력해야 한다는 부담이 — 평균 7일 안에 이탈을 만듭니다.
          </p>
        </div>
        <div className="pain__grid" data-reveal-stagger>
          {PAINS.map((p) => (
            <article key={p.num} className="pain__card">
              <span className="pain__num geist">{p.num}</span>
              <h3 className="pain__title">{p.title}</h3>
              <p className="pain__desc">{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
