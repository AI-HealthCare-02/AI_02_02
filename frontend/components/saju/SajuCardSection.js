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

/**
 * 프로필 존재 여부 + 오늘 카드 summary (있을 때) 한 번에 조회.
 * P4 통합 — profile 있으면 GET /today 호출해서 SajuTodayCard 에 한 줄 요약 전달.
 * 401/404/501/503 등 비정상은 모두 entry 노출 + summary null.
 */
async function fetchProfileAndToday() {
  try {
    const profileRes = await api('/api/v1/saju/profile');
    if (profileRes.status !== 200) return { exists: false, summary: null };
    const profile = await profileRes.json();
    if (profile === null) return { exists: false, summary: null };
    // profile 있음 → today 도 시도 (실패해도 entry 가 아니라 today card 유지, summary 만 null)
    try {
      const todayRes = await api('/api/v1/saju/today?focus=total&tone=soft');
      if (todayRes.status === 200) {
        const today = await todayRes.json();
        return { exists: true, summary: today.summary || null };
      }
    } catch { /* today 실패해도 today card 는 유지 */ }
    return { exists: true, summary: null };
  } catch {
    return { exists: false, summary: null };
  }
}

function SajuCardSectionImpl() {
  // null = 로딩, false = 프로필 없음(entry), true = 있음(today)
  const [profileExists, setProfileExists] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(0);

  // 마운트 시 프로필 + 오늘 카드 summary 동시 확인
  useEffect(() => {
    let cancelled = false;
    fetchProfileAndToday().then(({ exists, summary }) => {
      if (cancelled) return;
      setProfileExists(exists);
      setTodaySummary(summary);
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

  // 모달 닫힐 때 재확인 (방금 동의·프로필 입력 했을 수 있음)
  const handleClose = useCallback(async () => {
    setModalOpen(false);
    const { exists, summary } = await fetchProfileAndToday();
    setProfileExists(exists);
    setTodaySummary(summary);
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
        <SajuTodayCard onOpen={handleResultOpen} summary={todaySummary} />
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
