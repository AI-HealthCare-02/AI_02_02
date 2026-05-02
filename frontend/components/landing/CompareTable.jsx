'use client';

/**
 * 효과 3: 인터랙티브 데이터 테이블.
 * - position: sticky thead (상단 고정)
 * - position: sticky 첫 번째 열 (좌측 고정)
 * - 색상 Pill 태그 6종
 * - React 가상 DOM으로 데이터 행 단위 렌더링
 */

const ROWS = [
  {
    label: '진입 장벽',
    legacy: { text: '매일 별도 앱 켜기', pill: 'orange' },
    sensor: { text: 'CGM 센서 구매', pill: 'red' },
    self: { text: '별도 앱·센서 0', pill: 'green' },
  },
  {
    label: '데이터 수집 방식',
    legacy: '매일 수동 입력 폼',
    sensor: '센서 자동 측정',
    self: { text: 'AI 채팅 안에서 자연 수집', pill: 'green' },
  },
  {
    label: '위험도 안내',
    legacy: '기록 기반 시각화',
    sensor: '센서 기반 머신러닝',
    self: { text: 'FINDRISC 기반 참고 지표', pill: 'blue' },
  },
  {
    label: '데이터 보호 표현',
    legacy: { text: 'UI 가이드라인', pill: 'gray' },
    sensor: { text: '비공개', pill: 'gray' },
    self: { text: '3중 개인정보 보호 기준', pill: 'green' },
  },
  {
    label: '재방문 동기',
    legacy: '알림 푸시',
    sensor: '실시간 데이터',
    self: { text: '사주 Hook + 작은 행동', pill: 'purple' },
  },
  {
    label: '비용',
    legacy: '부분 유료',
    sensor: { text: '센서 + 구독', pill: 'red' },
    self: { text: '무료 · 카드 등록 불필요', pill: 'green' },
  },
];

function Cell({ data, isSelf, dataLabel }) {
  const className = isSelf ? 'is-self' : undefined;
  if (typeof data === 'string') {
    return <td className={className} data-label={dataLabel}>{data}</td>;
  }
  return (
    <td className={className} data-label={dataLabel}>
      <span className={`pill pill--${data.pill}`}>{data.text}</span>
    </td>
  );
}

export default function CompareTable() {
  return (
    <section className="section" id="compare" aria-labelledby="compare-title">
      <div className="container">
        <div className="section__head" data-reveal>
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            차별점
          </span>
          <h2 id="compare-title" className="h2">
            기존 솔루션과
            <br />
            무엇이 다를까요?
          </h2>
          <p className="lead">
            정면 대결이 아닙니다.
            <br />
            기존이 못 풀던 빈 자리 — "센서 살 돈도, 앱 켤 시간도 없는 일상" — 을 채우는 자리입니다.
          </p>
        </div>
        <div className="compare__wrap" data-reveal>
          <div className="compare__scroll" tabIndex={0} aria-label="비교표 스크롤 영역">
            <table className="compare">
              <caption className="sr-only">기존 건강 기록 앱·센서 기반 솔루션·DANAA 6가지 항목 비교</caption>
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col">기존 건강 기록 앱</th>
                  <th scope="col">센서 기반 솔루션</th>
                  <th scope="col" className="is-self">DANAA</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <Cell data={row.legacy} dataLabel="기존 건강 기록 앱" />
                    <Cell data={row.sensor} dataLabel="센서 기반 솔루션" />
                    <Cell data={row.self} isSelf dataLabel="DANAA" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
