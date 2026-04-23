'use client';

/**
 * SajuCardSection · 우측 패널 독립 섹션 (v2.7 P1.5)
 *
 * 배치:
 *  RightPanelV2
 *    Today 카드 / 건강 기록 리스트
 *    ↓
 *    SajuCardSection ← 여기 (독립 섹션, CARD_REGISTRY 와 분리)
 *    ↓
 *    도전 챌린지 / 미응답 질문
 *
 * P1.5 (통합 테스트용 MVP 모달):
 *  - 입력 전 상태의 SajuEntryCard 만 렌더
 *  - 클릭 시 SajuSetupModal (4단계: 동의 → 프로필 → calibration → mock 결과) 오픈
 *  - 백엔드 호출 없음 (mock). P5 에서 실제 API hooking.
 *
 * P5 확장 지점:
 *  - fetch('/api/v1/saju/profile') 으로 프로필 존재 여부 확인
 *  - 프로필 있으면 SajuTodayCard 로 교체
 *  - 모달 내부의 Mock 결과 → GET /api/v1/saju/today 응답으로 교체
 */

import { memo, useCallback, useState } from 'react';
import SajuEntryCard from './SajuEntryCard';
import SajuSetupModal from './SajuSetupModal';
import { ts } from '@/lib/i18n/saju.ko';

function SajuCardSectionImpl() {
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpen = useCallback(() => setModalOpen(true), []);
  const handleClose = useCallback(() => setModalOpen(false), []);

  return (
    <section
      className="saju-card-section"
      aria-label={ts('saju.section.ariaLabel')}
    >
      <div className="saju-card-section__subtitle">
        {ts('saju.section.title')}
      </div>
      <SajuEntryCard onOpen={handleOpen} />
      <SajuSetupModal open={modalOpen} onClose={handleClose} />
    </section>
  );
}

export default memo(SajuCardSectionImpl);
