'use client';

/**
 * SajuCardSection · 우측 패널 독립 섹션 (v2.7 P1.5 → API 통합)
 *
 * 분기:
 *  1) 마운트 시 GET /api/v1/saju/profile 으로 프로필 존재 확인
 *  2) 결과:
 *     - profile 존재 → SajuTodayCard (재방문) — 클릭 시 모달 step 4 직행
 *     - profile 없음 / 401 / 503 → SajuEntryCard (최초) — 클릭 시 모달 step 1 부터
 *  3) 모달 닫힐 때 프로필 재확인 (방금 등록 했을 수 있음)
 *
 * 에러 정책:
 *  - 401 (비로그인) / 503 (SAJU_ENABLED=false) → entry card 노출 (영향 없음)
 *  - 네트워크 실패 → entry card 노출 (사용자가 클릭하면 모달이 자체 에러 처리)
 *
 * P5 확장 지점:
 *  - GET /api/v1/saju/today 의 summary 를 SajuTodayCard 에 prop 으로 전달
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { api } from '@/hooks/useApi';
import SajuEntryCard from './SajuEntryCard';
import SajuTodayCard from './SajuTodayCard';
import SajuSetupModal from './SajuSetupModal';
import { ts } from '@/lib/i18n/saju.ko';

const RESULT_STEP = 3; // SajuSetupModal STEPS = ['consent','profile','calibration','result']

async function fetchProfileExists() {
  try {
    const res = await api('/api/v1/saju/profile');
    if (res.status === 200) {
      const data = await res.json();
      return data !== null;
    }
    return false; // 401/503/기타 → entry 노출
  } catch {
    return false;
  }
}

function SajuCardSectionImpl() {
  // null = 로딩, false = 프로필 없음(entry), true = 있음(today)
  const [profileExists, setProfileExists] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(0);

  // 마운트 시 프로필 존재 확인
  useEffect(() => {
    let cancelled = false;
    fetchProfileExists().then((exists) => {
      if (!cancelled) setProfileExists(exists);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEntryOpen = useCallback(() => {
    setModalInitialStep(0);
    setModalOpen(true);
  }, []);

  const handleResultOpen = useCallback(() => {
    setModalInitialStep(RESULT_STEP);
    setModalOpen(true);
  }, []);

  // 모달 닫힐 때 프로필 재확인 (방금 동의·프로필 입력 했을 수 있음)
  const handleClose = useCallback(async () => {
    setModalOpen(false);
    const exists = await fetchProfileExists();
    setProfileExists(exists);
  }, []);

  return (
    <section
      className="saju-card-section"
      aria-label={ts('saju.section.ariaLabel')}
    >
      <div className="saju-card-section__subtitle">
        {ts('saju.section.title')}
      </div>
      {/* 로딩 중에는 카드 영역 비워둠 (점멸 방지) */}
      {profileExists === null ? null : profileExists ? (
        <SajuTodayCard onOpen={handleResultOpen} />
      ) : (
        <SajuEntryCard onOpen={handleEntryOpen} />
      )}
      <SajuSetupModal
        open={modalOpen}
        onClose={handleClose}
        initialStep={modalInitialStep}
      />
    </section>
  );
}

export default memo(SajuCardSectionImpl);
