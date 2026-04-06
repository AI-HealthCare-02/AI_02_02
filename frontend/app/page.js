'use client';

import Link from 'next/link';

// ═══ 카테고리 데이터 ═══
// active: true인 것만 클릭 가능. 나머지는 "준비 중" 표시
const categories = [
  {
    id: 'diabetes',
    name: '당뇨',
    description: '혈당 관리, 위험도 예측, 생활습관 추적',
    emoji: '🩸',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    active: true,
  },
  {
    id: 'hypertension',
    name: '고혈압',
    description: '혈압 관리, 심혈관 위험 모니터링',
    emoji: '💓',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    active: false,
  },
  {
    id: 'obesity',
    name: '비만',
    description: '체중 관리, 식단 및 활동량 추적',
    emoji: '⚖️',
    color: '#10B981',
    bgColor: '#D1FAE5',
    active: false,
  },
  {
    id: 'cardiovascular',
    name: '심혈관질환',
    description: '심장 건강, 종합 위험인자 관리',
    emoji: '🫀',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    active: false,
  },
  {
    id: 'other',
    name: '기타',
    description: '기타 만성질환 및 건강 고민',
    emoji: '🏥',
    color: '#64748B',
    bgColor: '#F1F5F9',
    active: false,
  },
];

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* ── 히어로 영역 ── */}
      <section className="landing-hero">
        <div className="landing-badge">
          <span className="dot"></span>
          DA-NA-A Health Platform
        </div>
        <h1>
          나의 건강,<br />
          <span>다나아</span>에서 시작
        </h1>
        <p>
          AI 채팅과 함께하는 맞춤형 건강관리.
          <br />
          관심 있는 건강 카테고리를 선택해주세요.
        </p>
      </section>

      {/* ── 카테고리 선택 ── */}
      <section className="category-section">
        <h2>건강 카테고리</h2>
        <p className="sub">현재 당뇨 서비스가 운영 중이며, 나머지는 곧 오픈됩니다.</p>

        <div className="category-grid">
          {categories.map((cat) =>
            cat.active ? (
              // 활성화된 카테고리 → 클릭하면 설문 페이지로 이동
              <Link
                key={cat.id}
                href={`/onboarding/${cat.id}`}
                className="category-card"
              >
                <div
                  className="card-icon"
                  style={{ background: cat.bgColor }}
                >
                  {cat.emoji}
                </div>
                <div className="card-info">
                  <h3>{cat.name}</h3>
                  <p>{cat.description}</p>
                </div>
                <span className="card-arrow">→</span>
              </Link>
            ) : (
              // 비활성 카테고리 → 클릭 불가, "준비 중" 표시
              <div key={cat.id} className="category-card disabled">
                <div
                  className="card-icon"
                  style={{ background: cat.bgColor }}
                >
                  {cat.emoji}
                </div>
                <div className="card-info">
                  <h3>{cat.name}</h3>
                  <p>{cat.description}</p>
                </div>
                <span className="coming-soon-badge">준비 중</span>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
