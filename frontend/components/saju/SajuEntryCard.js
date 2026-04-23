'use client';

/**
 * SajuEntryCard · 사주 사이드 게임 최초 노출 카드 (v2.7 P1)
 *
 * 상태:
 *  - 입력 전: 제목 + 부드러운 안내 + "열어보기" 버튼
 *  - 입력 완료: SajuTodayCard 로 교체 (P5 에서 추가)
 *
 * 원칙 (v2.7):
 *  - 작고 조용한 톤. 무속·네온·과한 보라 금지.
 *  - 라이트/다크 토큰 유지 (cream/surface/border CSS 변수 상속).
 *  - 클릭 전에는 동의/입력을 받지 않음.
 *  - CARD_REGISTRY 와 분리 (활성 카드 상태와 무관).
 */

import { memo, useCallback } from 'react';
import { ts } from '@/lib/i18n/saju.ko';

function SajuEntryCardImpl({ onOpen }) {
  const handleClick = useCallback(() => {
    if (typeof onOpen === 'function') onOpen();
  }, [onOpen]);

  return (
    <button
      type="button"
      className="saju-entry-card"
      onClick={handleClick}
      aria-label={ts('saju.entry.title') + ' 열기'}
    >
      <span className="saju-entry-card__badge" aria-hidden="true">
        {ts('saju.entry.badge')}
      </span>
      <span className="saju-entry-card__body">
        <span className="saju-entry-card__title">{ts('saju.entry.title')}</span>
        <span className="saju-entry-card__desc">{ts('saju.entry.desc')}</span>
      </span>
      <span className="saju-entry-card__cta" aria-hidden="true">
        {ts('saju.entry.cta')} ›
      </span>
    </button>
  );
}

export default memo(SajuEntryCardImpl);
