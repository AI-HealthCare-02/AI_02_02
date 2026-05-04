'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, CheckCircle2, Clock, Coffee, Droplets, Dumbbell,
  Footprints, GlassWater, Leaf, Loader2, Medal, Moon, PhoneOff, Pill,
  Sparkles, Soup, Timer, Trophy, Utensils, Wine, X,
} from 'lucide-react';

import { api } from '../../../hooks/useApi';

const CHECKIN_STATUS = 'achieved';
const MAX_ACTIVE_CHALLENGES = 2;
const CHALLENGE_DAYS = 7;

const CATEGORY_GROUPS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'select', label: '챌린지 선택' },
];

const FILTER_GROUPS = [
  { key: 'all', label: '전체', matches: () => true },
  { key: 'diet', label: '식습관', matches: (item) => item.category === 'diet' },
  { key: 'exercise', label: '운동', matches: (item) => item.category === 'exercise' },
  { key: 'life', label: '생활', matches: (item) => ['sleep', 'hydration', 'medication', 'lifestyle'].includes(item.category) },
];

const CATEGORY_LABELS = {
  exercise: '운동',
  diet: '식습관',
  sleep: '수면',
  hydration: '수분',
  medication: '복약',
  lifestyle: '생활',
};

const CATEGORY_BADGE_STYLES = {
  exercise: 'bg-[#F7F4EF] text-[#6F665C]',
  diet: 'bg-[#F7F4EF] text-[#6F665C]',
  sleep: 'bg-[#F7F4EF] text-[#6F665C]',
  hydration: 'bg-[#F7F4EF] text-[#6F665C]',
  medication: 'bg-[#F7F4EF] text-[#6F665C]',
  lifestyle: 'bg-[#F7F4EF] text-[#6F665C]',
};

const BADGE_THEME = {
  bronze:     { icon: Medal,    shell: 'border-[#D8A57A] bg-white text-[#9E5A28]', dot: 'bg-[#C97C43]', accent: 'text-[#9E5A28]' },
  silver:     { icon: Medal,    shell: 'border-[#C9D0D9] bg-white text-[#61707F]', dot: 'bg-[#A8B4C2]', accent: 'text-[#61707F]' },
  gold:       { icon: Trophy,   shell: 'border-[#E8C45E] bg-white text-[#A87812]', dot: 'bg-[#D9A514]', accent: 'text-[#A87812]' },
  diamond:    { icon: Sparkles, shell: 'border-[#83CFE2] bg-white text-[#1A7D96]', dot: 'bg-[#39AFCD]', accent: 'text-[#1A7D96]' },
  master:     { icon: Trophy,   shell: 'border-[#E29AB2] bg-white text-[#B64B72]', dot: 'bg-[#D96992]', accent: 'text-[#B64B72]' },
  challenger: { icon: Sparkles, shell: 'border-[#8FD2A6] bg-white text-[#288C4D]', dot: 'bg-[#43B96A]', accent: 'text-[#288C4D]' },
  unranked:   { icon: Medal,    shell: 'border-[#D9D2C8] bg-white text-[#7A7065]', dot: 'bg-[#B8ADA0]', accent: 'text-[#7A7065]' },
};

const BADGE_RANGES = [
  { tier: 'bronze',  label: '브론즈', range: '10–29회' },
  { tier: 'silver',  label: '실버',   range: '30–59회' },
  { tier: 'gold',    label: '골드',   range: '60–99회' },
  { tier: 'diamond', label: '다이아', range: '100–199회' },
  { tier: 'master',  label: '마스터', range: '200회 이상' },
];

const CHALLENGE_COPY = {
  water_6cups: {
    name: '물 8잔 마시기',
    description: '하루 동안 물 8잔 이상을 마셔요.',
    cadence: '매일',
    target: '하루 8잔',
  },
  vegetable_3servings: {
    name: '끼니마다 채소 먹기',
    description: '아침, 점심, 저녁 식사 때마다 채소를 함께 먹어요.',
    cadence: '매일',
    target: '하루 3끼',
  },
  exercise_3x_week: {
    name: '주 3회 유산소 운동',
    description: '일주일에 3번 이상 유산소 운동을 실천해요.',
    cadence: '주간',
    target: '주 3회',
  },
  drink_less_alcohol: {
    name: '음주 주 2회 이하',
    description: '일주일에 2회 이하로 음주 빈도를 줄여요.',
    cadence: '주간',
    target: '주 2회 이하',
  },
};

function fireChallengeRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('danaa:challenge-overview-refresh'));
  }
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || '기타';
}

function categoryBadgeStyle(category) {
  return CATEGORY_BADGE_STYLES[category] || 'bg-[#F7F4EF] text-[#6F665C]';
}

function badgeTheme(tier) {
  return BADGE_THEME[tier] || BADGE_THEME.unranked;
}

function challengeBadgeLabel(item) {
  const label = String(item?.badge_label || '').trim();
  if (label && label !== 'undefined' && label !== 'null') return label;
  const tier = String(item?.badge_tier || '').toLowerCase();
  if (tier === 'unranked') return '미획득';
  if (Number(item?.days_completed || 0) > 0) return '진행 중';
  return '시작 전';
}

function badgeHint(item) {
  const nextLabel = String(item?.next_badge_label || '').trim();
  const completed = Number(item?.lifetime_completed_count ?? item?.days_completed ?? 0);
  const target = Number(item?.target_days ?? item?.default_duration_days ?? CHALLENGE_DAYS);
  const remainingToNext = Number(item?.remaining_to_next_badge);

  if (nextLabel) {
    if (Number.isFinite(remainingToNext) && remainingToNext > 0) {
      return `${remainingToNext}회 더 완료하면 ${nextLabel}`;
    }
    return `다음 배지: ${nextLabel}`;
  }

  const currentLabel = challengeBadgeLabel(item);
  if (currentLabel === '미획득' || currentLabel === '시작 전' || currentLabel === '진행 중') {
    const left = Number.isFinite(target) && target > 0 ? Math.max(0, target - completed) : null;
    if (left == null) return '완료 기록이 쌓이면 배지 진행률이 표시됩니다.';
    if (left > 0) return `${left}일 더 완료하면 완주 배지에 가까워져요.`;
    return '완주 기록을 확인 중입니다.';
  }

  return '현재 달성한 배지입니다.';
}

function normalizeChallengeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function challengeListKey(item) {
  const category = String(item?.category || 'misc').toLowerCase();
  const normalizedName = normalizeChallengeLabel(item?.name);
  if (normalizedName) return `${category}:${normalizedName}`;
  const normalizedCode = normalizeChallengeLabel(item?.code);
  if (normalizedCode) return `${category}:${normalizedCode}`;
  return `${category}:${item?.template_id ?? 'unknown'}`;
}

function dedupeChallengeItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = challengeListKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function challengeCopy(item) {
  const override = CHALLENGE_COPY[item?.code] || null;
  return {
    name: override?.name || item?.name || '챌린지',
    description: override?.description || item?.description || '',
    cadence: override?.cadence || '매일',
    target: override?.target || null,
    duration: Number(item?.default_duration_days) > 0 ? `${item.default_duration_days}일 과정` : null,
  };
}

function challengeVisual(item) {
  const raw = `${item?.name || ''} ${item?.code || ''}`.toLowerCase();
  const s = (icon) => ({ icon, shell: 'bg-[#F7F4EF] text-[#6F665C]' });

  if (raw.includes('water_before_meal') || raw.includes('식전 물')) return s(GlassWater);
  if (raw.includes('herbal_tea') || raw.includes('무가당') || raw.includes('차 마시')) return s(Coffee);
  if (raw.includes('no_sweetdrink') || raw.includes('sweetdrink') || raw.includes('단음료')) return s(X);
  if (raw.includes('water') || raw.includes('물') || item?.category === 'hydration') return s(Droplets);
  if (raw.includes('walk') || raw.includes('걷기')) return s(Footprints);
  if (raw.includes('stretch') || raw.includes('스트레칭')) return s(Timer);
  if (raw.includes('150분') || raw.includes('exercise_150min')) return s(Activity);
  if (raw.includes('exercise') || raw.includes('유산소') || raw.includes('운동') || item?.category === 'exercise') return s(Dumbbell);
  if (raw.includes('consistent_bedtime') || raw.includes('규칙적 취침') || raw.includes('bedtime')) return s(Clock);
  if (raw.includes('no_phone') || raw.includes('스마트폰') || raw.includes('phone')) return s(PhoneOff);
  if (raw.includes('sleep') || raw.includes('수면') || raw.includes('숙면') || item?.category === 'sleep') return s(Moon);
  if (raw.includes('no_nightsnack') || raw.includes('야식')) return s(Soup);
  if (raw.includes('채소') || raw.includes('vegetable')) return s(Leaf);
  if (raw.includes('식') || raw.includes('meal') || raw.includes('diet') || item?.category === 'diet') return s(Utensils);
  if (raw.includes('alcohol') || raw.includes('음주') || raw.includes('술')) return s(Wine);
  if (raw.includes('약') || raw.includes('medication') || item?.category === 'medication') return s(Pill);

  return { icon: Sparkles, shell: 'bg-[#F7F4EF] text-[#6C635A]' };
}

function ChallengeVisualBadge({ visual, size = 24 }) {
  if (visual.emoji) {
    return <span className="leading-none" style={{ fontSize: size }}>{visual.emoji}</span>;
  }
  const VisualIcon = visual.icon;
  return <VisualIcon size={size} />;
}

/* ── 탭바 ────────────────────────────────────────────── */
function TabBar({ activeTab, onChange, highlightSelection }) {
  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-[1260px] gap-0 px-5">
        {CATEGORY_GROUPS.map((tab) => {
          const isActive = activeTab === tab.key;
          const shouldPulse = tab.key === 'select' && highlightSelection;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative inline-flex cursor-pointer items-center border-b-2 px-5 py-3 text-[14px] font-semibold transition-colors ${
                isActive
                  ? 'border-[#2563EB] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
              {shouldPulse && (
                <>
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[18px] text-nature-500 animate-bounce">↓</span>
                  <span className="ml-2 inline-flex h-2.5 w-2.5 rounded-full bg-nature-500 shadow-[0_0_0_6px_rgba(34,197,94,0.18)] animate-pulse" />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── 통계 요약 바 ─────────────────────────────────────── */
function StatsBar({ activeCount, maxActiveCount, topStreak, earnedBadgeCount }) {
  const stats = [
    { key: 'active', label: '진행 중', value: `${activeCount}/${maxActiveCount}개`, sub: '챌린지' },
    { key: 'streak', label: '최고 연속', value: `${topStreak}일`, sub: '날 연속 달성' },
    { key: 'badge', label: '획득 배지', value: `${earnedBadgeCount}개`, sub: '배지' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((s) => (
        <div
          key={s.key}
          className="rounded-2xl border border-[#E7E0D6] bg-white px-3 py-3 text-center shadow-sm"
        >
          <div className="text-[10px] font-semibold tracking-wide text-[#9A9084]">{s.label}</div>
          <div className="mt-1 text-[22px] font-bold leading-none text-nature-900">{s.value}</div>
          <div className="mt-0.5 text-[10px] text-[#B0A898]">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ── 7일 진행 바 ──────────────────────────────────────── */
function SevenDayProgress({ daysCompleted, streak }) {
  const filled = Math.max(0, Math.min(CHALLENGE_DAYS, Number(daysCompleted || 0)));
  const weeklyPercent = Math.round((filled / CHALLENGE_DAYS) * 100);

  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F1] px-3 py-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-[#7E776C]">7일 진행</span>
        <span className="font-semibold text-nature-950">
          {filled}/{CHALLENGE_DAYS}일 · {weeklyPercent}%
          {streak > 0 && (
            <span className="ml-2 font-normal text-[#9A9084]">연속 {streak}일</span>
          )}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: CHALLENGE_DAYS }, (_, i) => (
          <div
            key={i}
            className={`h-[6px] flex-1 rounded-full transition-colors ${
              i < filled ? 'bg-nature-950' : 'bg-[#DDD8CF]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── 진행 중 챌린지 카드 ───────────────────────────────── */
function ActiveChallengeCard({
  challenge, busyKey, confirmCancelId, setConfirmCancelId,
  checkinChallenge, uncheckinChallenge, cancelChallenge,
}) {
  const checking = busyKey === `checkin:${challenge.user_challenge_id}`;
  const unchecking = busyKey === `uncheckin:${challenge.user_challenge_id}`;
  const cancelling = busyKey === `cancel:${challenge.user_challenge_id}`;
  const showCancelConfirm = confirmCancelId === challenge.user_challenge_id;
  const cancelDisabled = checking || unchecking || cancelling;
  const visual = challengeVisual(challenge);
  const completedToday = Boolean(challenge.today_checked);

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        completedToday
          ? 'border-nature-950/40 bg-white ring-1 ring-nature-950/10'
          : 'border-[#E7E0D6] bg-white'
      }`}
    >
      {/* 헤더 행: 아이콘 + 정보 + 체크인 버튼 */}
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${visual.shell}`}>
          <ChallengeVisualBadge visual={visual} size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold text-nature-900">{challenge.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${categoryBadgeStyle(challenge.category)}`}>
              {categoryLabel(challenge.category)}
            </span>
          </div>
          <div className="mt-0.5 text-[12px] text-neutral-500">
            <strong className="font-semibold text-nature-950">{challenge.days_completed}일</strong> 완료
            <span className="mx-1.5 text-neutral-300">·</span>
            배지: <span className={`font-medium ${challenge.badge_tier !== 'unranked' ? 'text-nature-800' : 'text-neutral-400'}`}>
              {challengeBadgeLabel(challenge)}
            </span>
          </div>
        </div>

        {/* 체크인 버튼 */}
        <button
          type="button"
          onClick={() => (completedToday
            ? uncheckinChallenge(challenge.user_challenge_id)
            : checkinChallenge(challenge.user_challenge_id)
          )}
          disabled={checking || unchecking || cancelling}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors sm:px-4 sm:text-[13px] ${
            completedToday
              ? 'border border-nature-950 bg-nature-950 text-[var(--color-primary-bg)]'
              : 'border border-[#D8D2C7] bg-white text-[#3E3A36] hover:bg-[#F7F4EF] disabled:cursor-not-allowed disabled:opacity-50'
          }`}
        >
          {checking || unchecking
            ? <Loader2 size={13} className="animate-spin" />
            : <CheckCircle2 size={13} />
          }
          <span className="hidden sm:inline">{completedToday ? '완료 취소' : '수행 완료'}</span>
          <span className="sm:hidden">{completedToday ? '취소' : '완료'}</span>
        </button>
      </div>

      {/* 7일 진행 바 */}
      <SevenDayProgress daysCompleted={challenge.days_completed} streak={challenge.current_streak} />

      {/* 하단: 배지 힌트 + 챌린지 취소 토글 */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-neutral-400">{badgeHint(challenge)}</span>
        <button
          type="button"
          onClick={() => setConfirmCancelId(showCancelConfirm ? null : challenge.user_challenge_id)}
          disabled={cancelDisabled}
          className="shrink-0 text-[12px] text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelling ? '취소 중...' : '챌린지 취소'}
        </button>
      </div>

      {/* 취소 확인 */}
      {showCancelConfirm && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
          <p className="text-[12px] leading-[1.6] text-rose-700">
            취소하면 현재 연속 기록이 끊기고, 다시 시작할 때 1일부터 새로 시작돼요. 지금까지의 기록은 이력으로 보존돼요.
            {challenge.today_checked && ' 오늘 완료한 기록도 남지만, 같은 챌린지는 내일부터 다시 시작할 수 있어요.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cancelChallenge(challenge.user_challenge_id)}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              그래도 취소하기
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancelId(null)}
              disabled={cancelling}
              className="inline-flex items-center rounded-full border border-[#D8D2C7] bg-white px-4 py-2 text-[12px] font-semibold text-neutral-600 hover:bg-[#F7F4EF] disabled:opacity-50"
            >
              계속하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 배지 현황 ────────────────────────────────────────── */
function BadgeStatusBoard({ items, earnedBadgeCount }) {
  const visibleItems = items.slice(0, 12);

  return (
    <section className="rounded-2xl border border-[#E7E0D6] bg-white p-5 shadow-sm">
      {/* 헤더 */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-semibold text-nature-900">배지 현황</div>
          <div className="mt-0.5 text-[12px] text-neutral-400">
            {earnedBadgeCount > 0 ? `${earnedBadgeCount}개 배지 획득` : '챌린지를 완료하면 배지를 얻어요'}
          </div>
        </div>
      </div>

      {/* 배지 등급 기준 — 가로 스크롤 */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {BADGE_RANGES.map((item) => {
          const theme = badgeTheme(item.tier);
          return (
            <div
              key={item.tier}
              className="shrink-0 flex items-center gap-1.5 rounded-full border border-[#EEE7DC] bg-[#FAFAF7] px-3 py-1.5"
            >
              <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
              <span className={`text-[11px] font-semibold ${theme.accent}`}>{item.label}</span>
              <span className="text-[10px] text-neutral-400">{item.range}</span>
            </div>
          );
        })}
      </div>

      {/* 배지 그리드 */}
      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D7CFC3] bg-[#FCFBF7] px-5 py-8 text-center text-[13px] text-[#8F857A]">
          아직 획득한 배지가 없어요. 오늘 챌린지를 완료하면 첫 배지에 가까워집니다.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visibleItems.map((badge) => {
            const theme = badgeTheme(badge.badge_tier);
            const visual = challengeVisual(badge);
            const isUnranked = badge.badge_tier === 'unranked';
            return (
              <div
                key={`${badge.template_id}-${badge.badge_tier}`}
                className={`rounded-2xl border p-3 text-center transition-shadow ${
                  isUnranked
                    ? 'border-[#E8E1D6] bg-[#FAF8F4] opacity-70'
                    : 'border-[#EEE7DC] bg-white shadow-sm hover:shadow-md'
                }`}
              >
                <div
                  className={`relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border-2 ${theme.shell} ${isUnranked ? 'grayscale-[0.3]' : ''}`}
                >
                  <ChallengeVisualBadge visual={visual} size={24} />
                  {!isUnranked && (
                    <span className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${theme.dot}`} />
                  )}
                </div>
                <div className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.04em] ${isUnranked ? 'text-[#9A9084]' : theme.accent}`}>
                  {challengeBadgeLabel(badge)}
                </div>
                <div className={`mt-0.5 text-[12px] font-medium leading-tight ${isUnranked ? 'text-[#7F756A]' : 'text-nature-900'}`}>
                  {badge.name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── 메인 페이지 ──────────────────────────────────────── */
export default function ChallengePage() {
  const [overview, setOverview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingActive, setEditingActive] = useState(false);
  const joinInFlightRef = useRef(new Set());

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const response = await api('/api/v1/challenges/overview');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setOverview(await response.json());
    } catch (nextError) {
      console.error('challenge_overview_load_failed', nextError);
      setOverview(null);
      setError('챌린지 상태를 불러오지 못했어요.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (Array.isArray(overview?.active) && overview.active.length === 0 && editingActive) {
      setEditingActive(false);
    }
  }, [overview, editingActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => loadOverview();
    window.addEventListener('danaa:challenge-overview-refresh', handler);
    return () => window.removeEventListener('danaa:challenge-overview-refresh', handler);
  }, [loadOverview]);

  /* ── 파생 상태 ─────────────────────────────────── */
  const activeChallenges = Array.isArray(overview?.active) ? overview.active : [];
  const earnedBadges = Array.isArray(overview?.badges) ? overview.badges : [];
  const recommendedChallenges = useMemo(() => dedupeChallengeItems(overview?.recommended), [overview?.recommended]);
  const catalog = useMemo(() => dedupeChallengeItems(overview?.catalog), [overview?.catalog]);
  const stats = overview?.stats || {};

  const activeCount = Number(stats.active_count || activeChallenges.length || 0);
  const maxActiveCount = Number(stats.max_active_count || MAX_ACTIVE_CHALLENGES);
  const remainingSlots = Number(stats.remaining_active_slots ?? Math.max(0, maxActiveCount - activeCount));
  const earnedBadgeCount = Number(stats.earned_badge_count || earnedBadges.length || 0);
  const topStreak = activeChallenges.reduce((max, item) => Math.max(max, Number(item.current_streak || 0)), 0);
  const activeTemplateIds = useMemo(() => new Set(activeChallenges.map((item) => Number(item.template_id))), [activeChallenges]);
  const badgeStatusItems = useMemo(() => {
    const earnedMap = new Map(earnedBadges.map((badge) => [Number(badge.template_id), badge]));
    return catalog.map((item) => {
      const earned = earnedMap.get(Number(item.template_id));
      if (earned) return earned;
      return {
        template_id: item.template_id,
        badge_tier: 'unranked',
        badge_label: '미획득',
        name: item.name,
        category: item.category,
        code: item.code,
        emoji: item.emoji,
      };
    });
  }, [catalog, earnedBadges]);

  const filteredCatalog = useMemo(() => {
    const group = FILTER_GROUPS.find((item) => item.key === activeFilter) || FILTER_GROUPS[0];
    return catalog.filter((item) => group.matches(item));
  }, [activeFilter, catalog]);

  const primaryRecommended = recommendedChallenges[0] || null;
  const guidedSelectableCatalog = useMemo(
    () => filteredCatalog.filter((item) => !primaryRecommended || Number(item.template_id) !== Number(primaryRecommended.template_id)),
    [filteredCatalog, primaryRecommended],
  );

  const blockedTodayTemplateIds = useMemo(() => {
    const set = new Set();
    for (const item of catalog) {
      if (item?.blocked_today) set.add(Number(item.template_id));
    }
    for (const item of recommendedChallenges) {
      if (item?.blocked_today) set.add(Number(item.template_id));
    }
    return set;
  }, [catalog, recommendedChallenges]);

  /* ── 액션 ─────────────────────────────────────── */
  const toggleSelect = useCallback((templateId) => {
    const numericId = Number(templateId);
    if (activeTemplateIds.has(numericId)) return;
    if (blockedTodayTemplateIds.has(numericId)) return;
    setSelectedTemplateIds((prev) => {
      if (prev.includes(numericId)) return prev.filter((item) => item !== numericId);
      if (prev.length >= remainingSlots) return prev;
      return [...prev, numericId];
    });
  }, [activeTemplateIds, blockedTodayTemplateIds, remainingSlots]);

  const joinChallenge = useCallback(async (templateId) => {
    const numericId = Number(templateId);
    if (joinInFlightRef.current.has(numericId)) return;
    joinInFlightRef.current.add(numericId);
    setBusyKey(`join:${numericId}`);
    setError('');
    try {
      const response = await api(`/api/v1/challenges/${numericId}/join`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `HTTP ${response.status}`);
      await loadOverview();
      fireChallengeRefresh();
      setActiveTab('dashboard');
    } catch (nextError) {
      setError(nextError.message || '챌린지를 시작하지 못했어요.');
    } finally {
      joinInFlightRef.current.delete(numericId);
      setBusyKey('');
    }
  }, [loadOverview]);

  const cancelChallenge = useCallback(async (userChallengeId) => {
    setBusyKey(`cancel:${userChallengeId}`);
    setError('');
    try {
      const response = await api(`/api/v1/challenges/${userChallengeId}/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `HTTP ${response.status}`);
      await loadOverview();
      fireChallengeRefresh();
    } catch (nextError) {
      setError(nextError.message || '챌린지를 취소하지 못했어요.');
    } finally {
      setBusyKey('');
    }
  }, [loadOverview]);

  const checkinChallenge = useCallback(async (userChallengeId) => {
    setBusyKey(`checkin:${userChallengeId}`);
    setError('');
    try {
      const response = await api(`/api/v1/challenges/${userChallengeId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ status: CHECKIN_STATUS }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `HTTP ${response.status}`);
      await loadOverview();
      fireChallengeRefresh();
      if (confirmCancelId === userChallengeId) setConfirmCancelId(null);
    } catch (nextError) {
      setError(nextError.message || '오늘 체크를 처리하지 못했어요.');
    } finally {
      setBusyKey('');
    }
  }, [confirmCancelId, loadOverview]);

  const uncheckinChallenge = useCallback(async (userChallengeId) => {
    setBusyKey(`uncheckin:${userChallengeId}`);
    setError('');
    try {
      const response = await api(`/api/v1/challenges/${userChallengeId}/checkin`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `HTTP ${response.status}`);
      await loadOverview();
      fireChallengeRefresh();
    } catch (nextError) {
      setError(nextError.message || '오늘 완료 체크를 해제하지 못했어요.');
    } finally {
      setBusyKey('');
    }
  }, [loadOverview]);

  const joinSelectedChallenges = useCallback(async () => {
    for (const templateId of selectedTemplateIds) {
      // eslint-disable-next-line no-await-in-loop
      await joinChallenge(templateId);
    }
    setSelectedTemplateIds([]);
  }, [joinChallenge, selectedTemplateIds]);

  /* ── 로딩 스켈레톤 ─────────────────────────────── */
  if (!loaded) {
    return (
      <div className="theme-challenge-page flex-1 px-4 py-5">
        <div className="mx-auto max-w-[960px] space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-cream-300" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-cream-300" />
          <div className="h-32 animate-pulse rounded-2xl bg-cream-200" />
        </div>
      </div>
    );
  }

  /* ── 선택 탭 상태 텍스트 ────────────────────────── */
  const isFull = activeCount >= maxActiveCount;
  const isEmpty = activeCount === 0;
  const selectStatusTitle = isEmpty
    ? '아직 시작한 챌린지가 없어요'
    : isFull
    ? `이미 최대 ${maxActiveCount}개 참여 중이에요`
    : `현재 ${activeCount} / ${maxActiveCount}개 참여 중`;
  const selectStatusBody = isEmpty
    ? `최대 ${maxActiveCount}개까지 선택할 수 있어요. 아래 추천 또는 전체 목록에서 시작해 보세요.`
    : isFull
    ? '진행 중인 챌린지를 취소하면 새로 선택할 수 있어요.'
    : `${maxActiveCount - activeCount}개 더 선택할 수 있어요.`;

  return (
    <div className="theme-challenge-page flex h-full flex-col">
      {/* 페이지 헤더 */}
      <header className="flex h-12 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
        <span className="text-[14px] font-medium text-nature-900">챌린지</span>
      </header>

      {/* 탭바 */}
      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        highlightSelection={activeChallenges.length === 0}
      />

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-4 py-5">

          {/* 오류 배너 */}
          {error && (
            <div className="mb-4 rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}

          {/* ══ 대시보드 탭 ══════════════════════════ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              {/* 통계 요약 */}
              <StatsBar
                activeCount={activeCount}
                maxActiveCount={maxActiveCount}
                topStreak={topStreak}
                earnedBadgeCount={earnedBadgeCount}
              />

              {/* 진행 중 챌린지 섹션 */}
              <section className="rounded-2xl border border-[#E7E0D6] bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-semibold text-nature-900">진행 중 챌린지</h2>
                    <p className="mt-0.5 text-[12px] text-neutral-400">
                      {activeCount > 0
                        ? `${activeCount}개 활성 · 오늘 수행을 완료해 보세요`
                        : '아직 시작한 챌린지가 없어요'}
                    </p>
                  </div>
                  {activeCount === 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('select')}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-nature-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-nature-800"
                    >
                      선택하러 가기
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {activeChallenges.length === 0 ? (
                  /* 빈 상태 */
                  <div className="rounded-xl border border-dashed border-[#D8D2C7] bg-[#FCFBF7] p-5">
                    {primaryRecommended ? (
                      /* 추천 챌린지 미리보기 */
                      <div>
                        <div className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-[#8B8277]">먼저 추천</div>
                        {(() => {
                          const display = challengeCopy(primaryRecommended);
                          return (
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-[16px] font-semibold text-nature-900">{display.name}</div>
                                <div className="mt-1 text-[13px] text-neutral-500">{display.description}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-500">
                                  <span className="rounded-full bg-white px-2.5 py-1">{display.cadence}</span>
                                  {display.target && <span className="rounded-full bg-white px-2.5 py-1">{display.target}</span>}
                                  {display.duration && <span className="rounded-full bg-white px-2.5 py-1">{display.duration}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => joinChallenge(primaryRecommended.template_id)}
                                disabled={busyKey === `join:${primaryRecommended.template_id}`}
                                className="shrink-0 rounded-full bg-nature-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-nature-600 disabled:opacity-50"
                              >
                                {busyKey === `join:${primaryRecommended.template_id}` ? '시작 중' : '시작하기'}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-center text-[13px] text-neutral-400">
                        선택 탭에서 원하는 챌린지를 찾아 바로 시작해 보세요.
                      </p>
                    )}
                  </div>
                ) : (
                  /* 활성 챌린지 카드 목록 */
                  <div className="space-y-3">
                    {activeChallenges.map((challenge) => (
                      <ActiveChallengeCard
                        key={challenge.user_challenge_id}
                        challenge={challenge}
                        busyKey={busyKey}
                        confirmCancelId={confirmCancelId}
                        setConfirmCancelId={setConfirmCancelId}
                        checkinChallenge={checkinChallenge}
                        uncheckinChallenge={uncheckinChallenge}
                        cancelChallenge={cancelChallenge}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* 배지 현황 */}
              <BadgeStatusBoard items={badgeStatusItems} earnedBadgeCount={earnedBadgeCount} />
            </div>
          )}

          {/* ══ 선택 탭 ══════════════════════════════ */}
          {activeTab === 'select' && (
            <div className="space-y-4">
              {/* 상태 배너 */}
              <div
                className={`rounded-2xl border px-4 py-4 ${
                  isFull
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                    : 'border-nature-950/30 bg-cream-100 dark:border-nature-400/30 dark:bg-nature-900/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                      isFull ? 'bg-amber-500' : 'bg-nature-950 dark:bg-nature-500'
                    }`}
                  >
                    {isFull ? <X size={14} /> : <Sparkles size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-nature-950 dark:text-[var(--color-text)]">{selectStatusTitle}</div>
                    <div className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">{selectStatusBody}</div>
                  </div>
                  {!isEmpty && (
                    <button
                      type="button"
                      onClick={() => setEditingActive((prev) => !prev)}
                      className="shrink-0 rounded-full border border-nature-950 bg-nature-950 px-3.5 py-1.5 text-[12px] font-semibold text-[var(--color-primary-bg)] hover:opacity-90"
                    >
                      {editingActive ? '닫기' : '챌린지 수정'}
                    </button>
                  )}
                </div>

                {/* 인라인 수정 영역 */}
                {editingActive && !isEmpty && (
                  <div className="mt-4 space-y-2">
                    {activeChallenges.map((ch) => {
                      const busy = busyKey === `cancel:${ch.user_challenge_id}`;
                      const chVisual = challengeVisual(ch);
                      const isConfirming = confirmCancelId === ch.user_challenge_id;

                      return (
                        <div key={ch.user_challenge_id} className="rounded-xl border border-cream-400 bg-white p-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${chVisual.shell}`}>
                              <ChallengeVisualBadge visual={chVisual} size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-[14px] font-semibold text-nature-900">{ch.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${categoryBadgeStyle(ch.category)}`}>
                                  {categoryLabel(ch.category)}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[12px] text-neutral-500">
                                {ch.days_completed}일 진행 · 연속 {ch.current_streak}일
                                {ch.today_checked && <span className="ml-1 text-neutral-400">· 오늘 완료됨</span>}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(isConfirming ? null : ch.user_challenge_id)}
                              disabled={busy}
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#D8D2C7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6F665C] hover:bg-[#F7F4EF] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              취소
                            </button>
                          </div>

                          {isConfirming && (
                            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                              <p className="text-[12px] leading-[1.6] text-rose-700">
                                취소하면 연속 기록이 끊기고 다시 시작할 때 1일부터 새로 시작돼요.
                                {ch.today_checked && ' 오늘 완료한 챌린지는 같은 종목으로 내일부터 다시 시작할 수 있어요.'}
                              </p>
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => cancelChallenge(ch.user_challenge_id)}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                  그래도 취소하기
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCancelId(null)}
                                  disabled={busy}
                                  className="inline-flex items-center rounded-full border border-cream-400 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-neutral-600 hover:bg-cream-100"
                                >
                                  계속하기
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 추천 챌린지 */}
              {recommendedChallenges.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-nature-900">추천 챌린지</h3>
                      <p className="mt-0.5 text-[12px] text-neutral-400">지금 바로 시작할 수 있는 항목</p>
                    </div>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {recommendedChallenges.map((challenge) => {
                      const busy = busyKey === `join:${challenge.template_id}`;
                      const isActiveAlready = activeTemplateIds.has(Number(challenge.template_id));
                      const blockedToday = Boolean(challenge.blocked_today);
                      const disabled = remainingSlots <= 0 || isActiveAlready || blockedToday || busy;
                      const visual = challengeVisual(challenge);
                      const display = challengeCopy(challenge);
                      let label;
                      if (busy) label = '시작 중';
                      else if (isActiveAlready) label = '진행 중';
                      else if (blockedToday) label = '내일부터';
                      else label = '시작하기';

                      return (
                        <div
                          key={challenge.template_id}
                          className={`rounded-2xl border border-[#E7E0D6] bg-white p-4 shadow-sm ${blockedToday ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${visual.shell}`}>
                              <ChallengeVisualBadge visual={visual} size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-semibold text-nature-900">{display.name}</div>
                              <div className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-neutral-500">{display.description}</div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                                <span className="rounded-full bg-[#F7F5F1] px-2 py-0.5 text-neutral-500">{display.cadence}</span>
                                {display.target && <span className="rounded-full bg-[#F7F5F1] px-2 py-0.5 text-neutral-500">{display.target}</span>}
                              </div>
                              {blockedToday && (
                                <div className="mt-1 text-[11px] text-neutral-400">오늘 체크인한 챌린지라 내일부터 다시 시작할 수 있어요.</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => joinChallenge(challenge.template_id)}
                              disabled={disabled}
                              className="shrink-0 rounded-full bg-nature-500 px-3 py-2 text-[12px] font-semibold text-white hover:bg-nature-600 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-neutral-400"
                            >
                              {label}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 전체 챌린지 목록 */}
              <section className="rounded-2xl border border-[#E7E0D6] bg-white p-5 shadow-sm">
                <div className="mb-1">
                  <h3 className="text-[17px] font-semibold text-nature-900">챌린지 목록</h3>
                  <p className="mt-0.5 text-[12px] text-neutral-400">
                    {remainingSlots > 0
                      ? `${remainingSlots}개 더 선택할 수 있어요`
                      : '현재 꽉 찼어요. 진행 중인 챌린지를 취소하면 새로 선택할 수 있어요.'}
                  </p>
                </div>

                {/* 필터 */}
                <div className="mb-4 mt-3 flex flex-wrap gap-2">
                  {FILTER_GROUPS.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setActiveFilter(group.key)}
                      className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                        activeFilter === group.key
                          ? 'bg-nature-950 text-[var(--color-primary-bg)]'
                          : 'bg-[#F2EEE7] text-neutral-600 hover:bg-[#EAE4D8]'
                      }`}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>

                {/* 챌린지 아이템 목록 */}
                <div className="space-y-2">
                  {guidedSelectableCatalog.map((item) => {
                    const templateId = Number(item.template_id);
                    const isActive = activeTemplateIds.has(templateId);
                    const blockedToday = Boolean(item.blocked_today);
                    const isSelected = selectedTemplateIds.includes(templateId);
                    const selectionDisabled = !isSelected && !isActive && !blockedToday && selectedTemplateIds.length >= remainingSlots;
                    const theme = badgeTheme(item.badge_tier);
                    const visual = challengeVisual(item);
                    const display = challengeCopy(item);
                    const BadgeIcon = theme.icon;

                    return (
                      <button
                        key={templateId}
                        type="button"
                        onClick={() => toggleSelect(templateId)}
                        disabled={isActive || blockedToday || selectionDisabled}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          isActive
                            ? 'border-cream-400 bg-cream-200 opacity-60 cursor-not-allowed'
                            : blockedToday
                            ? 'border-cream-400 bg-cream-100 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'border-nature-500 bg-nature-50 ring-1 ring-nature-300'
                            : selectionDisabled
                            ? 'cursor-not-allowed border-cream-300 bg-white opacity-50'
                            : 'border-cream-300 bg-white hover:border-cream-500 hover:bg-cream-50'
                        }`}
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${visual.shell}`}>
                          <ChallengeVisualBadge visual={visual} size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[14px] font-semibold text-nature-900">{display.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${categoryBadgeStyle(item.category)}`}>
                              {categoryLabel(item.category)}
                            </span>
                            {blockedToday && (
                              <span className="rounded-full bg-cream-300 px-2 py-0.5 text-[11px] text-neutral-500">내일부터</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[12px] text-neutral-500">{display.description}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-neutral-500">
                            <span className="rounded-full bg-[#F7F5F1] px-2 py-0.5">{display.cadence}</span>
                            {display.target && <span className="rounded-full bg-[#F7F5F1] px-2 py-0.5">{display.target}</span>}
                            {display.duration && <span className="rounded-full bg-[#F7F5F1] px-2 py-0.5">{display.duration}</span>}
                          </div>
                        </div>
                        <div className={`shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${theme.shell}`}>
                          <BadgeIcon size={11} />
                          {challengeBadgeLabel(item)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 선택 확정 버튼 */}
                {selectedTemplateIds.length > 0 && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={joinSelectedChallenges}
                      className="cursor-pointer rounded-full bg-nature-500 px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-nature-600"
                    >
                      선택한 챌린지 {selectedTemplateIds.length}개 시작하기
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
