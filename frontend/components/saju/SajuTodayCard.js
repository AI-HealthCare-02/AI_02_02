'use client';

/**
 * SajuTodayCard · 재방문 시 우측 패널에 노출되는 작은 요약 카드 (v2.7 P1.5)
 *
 * 진입:
 *  - SajuCardSection 이 GET /api/v1/saju/profile 으로 프로필 존재 확인 → 있으면 이 카드 렌더
 *  - 없으면 SajuEntryCard (기존)
 *
 * 동작:
 *  - 클릭 시 onOpen() 호출 → SajuSetupModal(initialStep=3) 결과 화면 직행
 *
 * P5 확장 지점:
 *  - GET /api/v1/saju/today 응답의 summary / keywords 를 본문에 삽입
 *  - 현재는 i18n placeholder.summary 노출
 */

import { memo, useCallback } from 'react';
import { ts } from '@/lib/i18n/saju.ko';

function SajuTodayCardImpl({ onOpen, summary }) {
  const handleClick = useCallback(() => {
    if (typeof onOpen === 'function') onOpen();
  }, [onOpen]);

  return (
    <button
      type="button"
      className="saju-today-card"
      onClick={handleClick}
      aria-label={`${ts('saju.today.title')} — ${ts('saju.today.cta')}`}
    >
      <span className="saju-today-card__header">
        <span className="saju-today-card__title">{ts('saju.today.title')}</span>
        <span className="saju-today-card__badge">{ts('saju.entry.badge')}</span>
      </span>
      <span className="saju-today-card__summary">
        {summary || ts('saju.today.placeholder.summary')}
      </span>
      <span className="saju-today-card__cta">
        {ts('saju.today.cta')} ›
      </span>
    </button>
  );
}

export default memo(SajuTodayCardImpl);
