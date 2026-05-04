'use client';

/**
 * SajuCardSection · 우측 패널 독립 섹션 (v2.7 P4.1 — EntryCard 일관)
 *
 * 동작:
 *  1) 마운트 시 GET /api/v1/saju/profile 로 프로필 존재 확인
 *  2) profile 유무와 관계없이 세로형 SajuEntryCard 유지 (CTA/설명만 분기).
 *     - profile 있음 → 클릭 시 모달 step 4 (결과) 직행
 *     - profile 없음 / 401 / 503 → 클릭 시 모달 step 1 (동의) 부터
 *  3) 모달 닫힐 때 프로필 재확인 (방금 등록 했을 수 있음)
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { api } from '@/hooks/useApi';
import SajuEntryCard from './SajuEntryCard';
import SajuSetupModal from './SajuSetupModal';
import { ts } from '@/lib/i18n/saju.ko';

const RESULT_STEP = 3; // SajuSetupModal STEPS = ['consent','profile','calibration','result']

/**
 * 프로필 존재 여부 단건 조회.
 * P4.1: EntryCard 일관 유지 → summary prefetch 불필요. profile 만 확인.
 * 401/404/503 등 비정상은 모두 "프로필 없음" 간주 → 첫 방문 흐름 전환.
 */
async function fetchProfileAndToday() {
  try {
    const profileRes = await api('/api/v1/saju/profile');
    if (profileRes.status !== 200) return { exists: false };
    const profile = await profileRes.json();
    return { exists: profile !== null, profile };
  } catch {
    return { exists: false };
  }
}

function SajuCardSectionImpl() {
  // null = 로딩, false = 프로필 없음, true = 있음 (CTA/설명 문구만 다름, 카드 형태는 동일)
  const [profileExists, setProfileExists] = useState(null);
  const [sajuProfile, setSajuProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(0);
  // 재방문자 모달 진입 시 로딩 텍스트 깜박임 제거 — 카드 마운트 시점에 today 응답 미리 받아둠.
  // 200 OK 만 저장. 비-200·네트워크 실패는 null 유지 → 모달이 원래 경로(loadTodayResult)로 폴백.
  const [prefetchedToday, setPrefetchedToday] = useState(null);

  // 마운트 시 프로필 존재 확인 (summary 는 사용 안 함 — EntryCard 통일)
  useEffect(() => {
    let cancelled = false;
    fetchProfileAndToday().then(({ exists, profile }) => {
      if (cancelled) return;
      setProfileExists(exists);
      setSajuProfile(profile || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 프로필이 있는 사용자에 한해 today 미리 가져오기 (재방문 모달 즉시 표시).
  // 첫 방문자(profileExists=false)는 calibration 단계까지 가야 today 가 의미 있으므로 prefetch 스킵.
  useEffect(() => {
    if (profileExists !== true) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api('/api/v1/saju/today');
        if (cancelled) return;
        if (res.status === 200) {
          const data = await res.json();
          setPrefetchedToday(data);
        }
      } catch {
        /* prefetch 실패는 무해 — 모달 오픈 시 원래 fetch 경로로 폴백 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileExists]);

  const handleOpen = useCallback(() => {
    setModalInitialStep(profileExists ? RESULT_STEP : 0);
    setModalOpen(true);
  }, [profileExists]);

  // 모달 닫힐 때 재확인 (방금 동의·프로필 입력 했을 수 있음)
  // prefetchedToday 는 의도적으로 유지 — 같은 날 안에서 today 응답은 사실상 변하지 않으며,
  // 닫고 즉시 다시 여는 경우의 깜박임 회귀를 막기 위함. 새 프로필이 막 등록되면 setProfileExists
  // 가 false→true 로 바뀌어 prefetch effect 가 자연스럽게 새 응답을 채운다.
  const handleClose = useCallback(async () => {
    setModalOpen(false);
    setPrefetchedToday(null);
    const { exists, profile } = await fetchProfileAndToday();
    setProfileExists(exists);
    setSajuProfile(profile || null);
  }, []);

  return (
    <section
      className="saju-card-section"
      aria-label={ts('saju.section.ariaLabel')}
    >
      <div className="saju-card-section__subtitle">
        {ts('saju.section.title')}
      </div>
      {/* 로딩 중에는 카드 영역 비워둠 (점멸 방지).
          프로필 유무와 관계없이 세로형 EntryCard 유지 — CTA/설명 문구만 분기. */}
      {profileExists === null ? null : (
        <SajuEntryCard onOpen={handleOpen} hasProfile={profileExists} />
      )}
      <SajuSetupModal
        open={modalOpen}
        onClose={handleClose}
        initialStep={modalInitialStep}
        hasProfile={Boolean(profileExists)}
        sajuProfile={sajuProfile}
        prefetchedToday={prefetchedToday}
      />
    </section>
  );
}

export default memo(SajuCardSectionImpl);
