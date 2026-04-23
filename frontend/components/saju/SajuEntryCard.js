'use client';

/**
 * SajuEntryCard · 세로형 타로 카드 느낌 (v2.7 P1 · 중앙정렬 리디자인)
 *
 * 구조 (세로 직립 카드):
 *   ┌─────────────────┐
 *   │  ✦     🌙   ✧   │  ← visual 헤더 (장식 + 상단 우측 배지)
 *   │         ·        │
 *   │              [참고용]
 *   │                 │
 *   ├─────────────────┤
 *   │       🔮        │  ← 중앙 아이콘
 *   │                 │
 *   │    오늘의 운세    │  ← 제목 (중앙)
 *   │                 │
 *   │   생년월일을 넣으면│
 *   │   나다운 하루 흐름을│ ← 설명 (중앙 정렬)
 *   │    보여드려요      │
 *   │                 │
 *   │  [ 열어보기 › ]  │  ← CTA (중앙)
 *   └─────────────────┘
 *
 * 디자인:
 *  - 세로형 비율 (max-width 220px), 우측 패널 안에서 margin:auto 로 가운데 배치
 *  - visual 헤더 + 본문 모두 center align
 *  - 무속·네온·과한 보라 금지. 라이트/다크 분기.
 */

import { memo, useCallback } from 'react';
import { ts } from '@/lib/i18n/saju.ko';

function SajuEntryCardImpl({ onOpen }) {
  const handleClick = useCallback(() => {
    if (typeof onOpen === 'function') onOpen();
  }, [onOpen]);

  const title = ts('saju.entry.title');
  const badge = ts('saju.entry.badge');
  const desc = ts('saju.entry.desc');
  const cta = ts('saju.entry.cta');
  const emoji = ts('saju.entry.emoji');

  return (
    <button
      type="button"
      className="saju-entry-card"
      onClick={handleClick}
      aria-label={`${title} — ${cta}`}
    >
      {/* 상단 visual 헤더 — 그라데이션 + 별 + 달 + 우상단 배지 */}
      <span className="saju-entry-card__visual" aria-hidden="true">
        <span className="saju-entry-card__glow saju-entry-card__glow--a" />
        <span className="saju-entry-card__glow saju-entry-card__glow--b" />
        <span className="saju-entry-card__star saju-entry-card__star--1">✦</span>
        <span className="saju-entry-card__star saju-entry-card__star--2">✧</span>
        <span className="saju-entry-card__star saju-entry-card__star--3">·</span>
        <span className="saju-entry-card__star saju-entry-card__star--4">✦</span>
        <span className="saju-entry-card__moon">🌙</span>
        <span className="saju-entry-card__badge">{badge}</span>
      </span>

      {/* 본문 영역 — 전부 center */}
      <span className="saju-entry-card__content">
        <span className="saju-entry-card__emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="saju-entry-card__title">{title}</span>
        <span className="saju-entry-card__desc">{desc}</span>
        <span className="saju-entry-card__cta" aria-hidden="true">
          {cta}
          <span className="saju-entry-card__cta-arrow">›</span>
        </span>
      </span>
    </button>
  );
}

export default memo(SajuEntryCardImpl);
