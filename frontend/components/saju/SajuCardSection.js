'use client';

/**
 * SajuCardSection · 우측 패널 독립 섹션 (v2.7 P1)
 *
 * 배치:
 *  RightPanelV2
 *    Today 카드 / 건강 기록 리스트
 *    ↓
 *    SajuCardSection ← 여기 (독립 섹션, CARD_REGISTRY 와 분리)
 *    ↓
 *    도전 챌린지 / 미응답 질문
 *
 * P1 스캐폴딩:
 *  - 입력 전 상태의 SajuEntryCard 만 렌더
 *  - 클릭 시 SetupModal 은 P5 에서 추가 (현재 alert 로 placeholder)
 *
 * P2~P5 확장 지점:
 *  - fetch('/api/v1/saju/profile') 으로 프로필 존재 여부 확인
 *  - 프로필 있으면 SajuTodayCard 로 교체
 *  - 클릭 시 SajuSetupModal 또는 SajuTodayFortuneModal 오픈
 */

import { memo } from 'react';
import SajuEntryCard from './SajuEntryCard';
import { ts } from '@/lib/i18n/saju.ko';

function SajuCardSectionImpl() {
  const handleOpen = () => {
    // P5 에서 SajuSetupModal / SajuTodayFortuneModal 로 교체.
    // P1 단계에서는 조용히 준비 중 알림.
    if (typeof window !== 'undefined') {
      window.alert(ts('saju.state.disabled'));
    }
  };

  return (
    <section
      className="saju-card-section"
      aria-label={ts('saju.section.ariaLabel')}
    >
      <div className="saju-card-section__subtitle">
        {ts('saju.section.title')}
      </div>
      <SajuEntryCard onOpen={handleOpen} />
    </section>
  );
}

export default memo(SajuCardSectionImpl);
