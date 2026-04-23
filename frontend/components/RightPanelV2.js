'use client';

/**
 * RightPanelV2 · 우측 Today 패널 리디자인
 *
 * 주요 구조:
 *   - Stone(#4A4A4A) 요약 카드
 *   - V2 Fixed Slot (min-height 300px · 챌린지 위치 고정)
 *   - 1열 .rp-row 리스트 (시간 흐름 순서)
 *   - cards 재사용: chat/page.js에서 SleepPanel 등을 props.panels로 주입
 *   - 미응답 질문 섹션 + 모달 (lazy)
 *
 * 접근성:
 *   - <button> 태그 사용
 *   - cardsSectionRef를 .rp-rows에 이전 (바깥 클릭 닫힘 보존)
 *   - data-tutorial="today-cards", "unanswered" 유지
 */

import { memo, useMemo, lazy, Suspense, useState } from 'react';
import { Pencil } from 'lucide-react';
import { getVisibleCards, getVisibleMissedCategories } from '@/lib/chat/cardRegistry';
import { t } from '@/lib/i18n/rightPanel.ko';

// 미응답 모달은 mount-on-open · 초기 청크에서 분리
const MissedQuestionsModal = lazy(() => import('./MissedQuestionsModal'));
// 호버/포커스 시 프리페치해 첫 클릭 지연 제거
const prefetchMissedModal = () => import('./MissedQuestionsModal');

/**
 * RpRow · memo 추출 · activeCard 토글 시 2행만 리렌더
 */
const RpRow = memo(function RpRow({ cardDef, isActive, value, valueMuted, onClick }) {
  return (
    <button
      type="button"
      className={`rp-row ${isActive ? 'is-active' : ''}`}
      onClick={onClick}
      data-key={cardDef.key}
      aria-label={`${t(cardDef.nameKey)} 기록${value ? ` · ${value}` : ' · 미입력'}`}
      aria-expanded={isActive}
    >
      <span className="rp-emoji" aria-hidden="true">{cardDef.emoji}</span>
      <span className="rp-row__name">{t(cardDef.nameKey)}</span>
      <span className={`rp-row__value ${valueMuted ? 'rp-row__value--muted' : ''}`}>
        {value || t('rightPanel.row.placeholder')}
      </span>
      <span className="rp-row__chevron" aria-hidden="true">›</span>
    </button>
  );
});

/**
 * 요약 문장 생성 (log 기반 derived)
 * — 도메인 규칙: 의료 표현 금지 · 중립 톤
 * — boolean false(쉬었어요/건너뛰었어요/안 마셨어요)도 "기록됨"으로 카운트
 */
function buildSummaryLine(log) {
  if (!log) return '오늘 기록을 차근차근 쌓아볼까요?';

  const has = {
    sleep: log.sleep_quality != null || log.sleep_duration_bucket != null,
    meal: log.breakfast_status != null || log.lunch_status != null || log.dinner_status != null,
    exercise: log.exercise_done != null,
    water: log.water_cups != null && log.water_cups > 0,
    mood: log.mood_level != null,
    medication: log.took_medication != null,
    alcohol: log.alcohol_today != null,
  };
  const count = Object.values(has).filter(Boolean).length;

  if (count === 0) return '오늘 기록을 차근차근 쌓아볼까요?';
  if (count >= 5) return '오늘 거의 다 챙기셨어요. 마무리까지 같이 해볼까요?';
  if (has.sleep && has.meal && !has.exercise) return '수면·식사 챙기셨네요. 운동도 살짝 이어가 볼까요?';
  if (has.water && !has.exercise) return '물 충분히 드시고 계시네요. 걷기도 조금씩 늘려볼까요?';
  if (has.exercise && !has.meal) return '운동 체크 남기셨어요. 식사도 챙기면 더 좋아요.';
  if (has.sleep && !has.meal) return '푹 주무셨네요. 식사는 어떠셨나요?';
  if (has.meal && !has.sleep) return '식사 기록 남기셨네요. 수면도 함께 남겨볼까요?';
  return '오늘 기록 이어가고 계세요. 계속 함께 해요.';
}

function countAnswered(log) {
  if (!log) return 0;
  const keys = [
    'sleep_quality', 'sleep_duration_bucket',
    'breakfast_status', 'lunch_status', 'dinner_status',
    'exercise_done', 'water_cups', 'mood_level',
  ];
  return keys.filter((k) => log[k] != null && log[k] !== '' && log[k] !== 0).length;
}

function formatLastInputTime(log) {
  if (!log?.last_updated_at) return null;
  try {
    const d = new Date(log.last_updated_at);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
  } catch {
    return null;
  }
}

// 값 표시 헬퍼 (각 카드별 display value)
function displayValue(key, log) {
  if (!log) return { value: null, muted: true };
  if (key === 'sleep') {
    const dur = log.sleep_duration_bucket;
    const q = log.sleep_quality;
    if (!dur && !q) return { value: null, muted: true };
    const durationLabels = {
      under_5: '5시간 미만',
      between_5_6: '5~6시간',
      between_6_7: '6~7시간',
      between_7_8: '7~8시간',
      over_8: '8시간 이상',
      less_5: '5시간 미만',
      '5_6': '5~6시간',
      '6_7': '6~7시간',
      '7_8': '7~8시간',
      '8_plus': '8시간 이상',
    };
    const qualityLabels = {
      very_good: '아주 좋음',
      excellent: '아주 좋음',
      good: '좋음',
      normal: '보통',
      bad: '나쁨',
      very_bad: '아주 나쁨',
    };
    const parts = [durationLabels[dur], qualityLabels[q]].filter(Boolean);
    return { value: parts.join(' · ') || null, muted: false };
  }
  if (key === 'water') {
    const cups = Number(log.water_cups || 0);
    if (cups > 0) return { value: `${cups}잔`, muted: false };
    return { value: null, muted: true };
  }
  switch (key) {
    case 'sleep': {
      const dur = log.sleep_duration_bucket;
      const q = log.sleep_quality;
      if (!dur && !q) return { value: null, muted: true };
      const DURATION = { less_5: '5h 미만', '5_6': '5.5h', '6_7': '6.5h', '7_8': '7.5h', '8_plus': '8h+' };
      const QUALITY = {
        very_good: '아주 좋음',
        excellent: '아주 좋음',
        good: '좋음',
        normal: '보통',
        bad: '나쁨',
        very_bad: '아주 나쁨',
      };
      const parts = [DURATION[dur], QUALITY[q]].filter(Boolean);
      return { value: parts.join(' · ') || null, muted: false };
    }
    case 'meal': {
      const done = ['breakfast_status', 'lunch_status', 'dinner_status'].filter((k) => log[k]).length;
      return { value: `${done}/3`, muted: done === 0 };
    }
    case 'medication':
      if (log.took_medication === true) return { value: '드셨어요', muted: false };
      if (log.took_medication === false) return { value: '건너뛰었어요', muted: false };
      return { value: null, muted: true };
    case 'exercise':
      if (log.exercise_done === true) return { value: '했어요', muted: false };
      if (log.exercise_done === false) return { value: '쉬었어요', muted: false };
      return { value: null, muted: true };
    case 'water':
      if (log.water_cups != null && log.water_cups > 0) return { value: `${log.water_cups}잔`, muted: false };
      return { value: null, muted: true };
    case 'mood': {
      const MOOD = { great: '아주 좋음', good: '좋음', normal: '보통', hard: '힘듦' };
      return { value: MOOD[log.mood_level] || null, muted: !log.mood_level };
    }
    case 'alcohol':
      if (log.alcohol_today === false) return { value: '안 마셨어요', muted: false };
      if (log.alcohol_today === true) {
        const AMT = { light: '가볍게', moderate: '보통', heavy: '많이' };
        return { value: AMT[log.alcohol_amount_level] || '마셨어요', muted: false };
      }
      return { value: null, muted: true };
    default:
      return { value: null, muted: true };
  }
}

export default function RightPanelV2({
  log,
  update,
  save,
  saveImmediate,
  todaySaveState,
  activeCard,
  setActiveCard,
  cardsSectionRef,
  userCtx,
  todayISO,
  onGoChat,
  panels,
  extras,
}) {
  const {
    SleepPanel,
    MealPanel,
    ExercisePanelV2,
    WaterPanelV2,
    MoodPanel,
    MedicationPanel,
    AlcoholPanel,
  } = panels;
  const { updateAlcoholToday, updateAlcoholAmount, HabitsSection } = extras;

  const [missedOpen, setMissedOpen] = useState(false);

  const visibleCards = useMemo(() => getVisibleCards(userCtx), [userCtx]);
  const summaryLine = useMemo(() => buildSummaryLine(log), [log]);
  const answeredCount = useMemo(() => countAnswered(log), [log]);
  const lastInputTime = useMemo(() => formatLastInputTime(log), [log]);

  // 입력 존재 상태는 연필 아이콘으로 표현 (톤앤매너 중립 유지)
  const pencilIcon = (
    <Pencil size={13} strokeWidth={2} aria-label="오늘 입력됨" className="inline-block" />
  );
  const saveBadge = (() => {
    if (userCtx?.isOffline) return { label: t('rightPanel.action.offline'), className: 'bg-danger/10 text-danger-light' };
    if (todaySaveState === 'error') return { label: t('rightPanel.action.error'), className: 'bg-danger/10 text-danger-light' };
    if (todaySaveState === 'saving') return { label: t('rightPanel.action.saving'), className: 'bg-cream-300 text-neutral-500' };
    if (todaySaveState === 'saved') return { label: pencilIcon, className: 'bg-nature-900 text-[var(--color-bg)]' };
    // idle 상태: 저장된 항목이 있을 때만 연필 아이콘 표시 (입력 없을 땐 뱃지 자체 숨김)
    if (answeredCount > 0) return { label: pencilIcon, className: 'bg-cream-400 text-nature-900' };
    return null;
  })();

  const handleToggleCard = (key) => setActiveCard((prev) => (prev === key ? null : key));

  return (
    <aside
      className="rp rp--today hidden md:flex w-[320px] xl:w-[336px] border-l border-cream-500 bg-cream-200 flex-col shrink-0 overflow-y-auto custom-scroll"
      style={{ scrollbarGutter: 'stable' }}
      aria-label="Today 우측 패널"
      data-variant="v2"
    >
      <div className="p-5 space-y-6">
        {/* ═══ 요약 카드 · Stone ═══ */}
        <div className="rp__head">
          <h4 className="rp__title">{t('rightPanel.title')}</h4>
          {saveBadge && (
            <span className={`rp-action ${saveBadge.className}`}>{saveBadge.label}</span>
          )}
        </div>

        <div className="rp-quick" style={{ background: 'var(--color-summary-surface)' }}>
          <div className="rp-quick__line">{summaryLine}</div>
          <div className="rp-quick__meta">
            <span><strong>{answeredCount}/7</strong>{t('rightPanel.quick.meta.recorded')}</span>
            {lastInputTime && <span><strong>{lastInputTime}</strong>{t('rightPanel.quick.meta.lastInput')}</span>}
          </div>
        </div>

        {/* ═══ 카드 목록 ═══ */}
        <div ref={cardsSectionRef}>
          <div className="rp-rows" data-tutorial="today-cards">
            {visibleCards.map((c) => {
              const { value, muted } = displayValue(c.key, log);
              return (
                <RpRow
                  key={c.key}
                  cardDef={c}
                  isActive={activeCard === c.key}
                  value={value}
                  valueMuted={muted}
                  onClick={() => handleToggleCard(c.key)}
                />
              );
            })}
          </div>

          {/* ═══ Fixed Slot (300px 예약) ═══ */}
          <div className={`rp-fixed-input ${activeCard ? 'is-filled' : ''}`}>
            {activeCard === 'sleep' && <SleepPanel log={log} update={update} save={save} />}
            {activeCard === 'meal' && <MealPanel log={log} update={update} save={save} />}
            {activeCard === 'medication' && visibleCards.some((c) => c.key === 'medication') && (
              <MedicationPanel log={log} update={update} />
            )}
            {activeCard === 'exercise' && <ExercisePanelV2 log={log} update={update} save={save} />}
            {activeCard === 'water' && <WaterPanelV2 log={log} update={update} />}
            {activeCard === 'mood' && <MoodPanel log={log} update={update} />}
            {activeCard === 'alcohol' && (
              <AlcoholPanel
                log={log}
                updateAlcoholToday={updateAlcoholToday}
                updateAlcoholAmount={updateAlcoholAmount}
              />
            )}
          </div>
        </div>

        {/* ═══ 챌린지 ═══ */}
        {HabitsSection && <HabitsSection />}

        {/* ═══ 미응답 질문 섹션 ═══ */}
        <div>
          <div className="rp__subtitle">
            <span>{t('rightPanel.missed.title')}</span>
            <span className="rp__subtitle-action">{t('rightPanel.missed.action.recent3days')}</span>
          </div>
          <button
            type="button"
            className="rp-missed"
            onClick={() => setMissedOpen(true)}
            onMouseEnter={prefetchMissedModal}
            onFocus={prefetchMissedModal}
            data-tutorial="unanswered"
            aria-label={t('rightPanel.missed.card.title') + ' 팝업 열기'}
          >
            <span className="rp-missed__icon" aria-hidden="true">📋</span>
            <span className="rp-missed__body">
              <span className="rp-missed__title">{t('rightPanel.missed.card.title')}</span>
              <span className="rp-missed__desc">{t('rightPanel.missed.card.desc')}</span>
            </span>
            <span className="rp-missed__chevron" aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      {/* 모달 · lazy · mount-on-open */}
      {missedOpen && (
        <Suspense fallback={<div className="mqm-loading" role="status">불러오는 중…</div>}>
          <MissedQuestionsModal
            open={missedOpen}
            onClose={() => setMissedOpen(false)}
            todayISO={todayISO}
            todayLog={log}
            userCtx={userCtx}
            saveImmediate={saveImmediate}
            onGoChat={onGoChat}
          />
        </Suspense>
      )}
    </aside>
  );
}
