'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Droplets, Dumbbell, Footprints, GlassWater, Leaf, Loader2, Medal, Moon, Pill, Sparkles, Soup, Trophy, Utensils, Wine, X } from 'lucide-react';

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
  bronze: { icon: Medal, shell: 'border-[#D8A57A] bg-white text-[#9E5A28]', dot: 'bg-[#C97C43]', accent: 'text-[#9E5A28]' },
  silver: { icon: Medal, shell: 'border-[#C9D0D9] bg-white text-[#61707F]', dot: 'bg-[#A8B4C2]', accent: 'text-[#61707F]' },
  gold: { icon: Trophy, shell: 'border-[#E8C45E] bg-white text-[#A87812]', dot: 'bg-[#D9A514]', accent: 'text-[#A87812]' },
  diamond: { icon: Sparkles, shell: 'border-[#83CFE2] bg-white text-[#1A7D96]', dot: 'bg-[#39AFCD]', accent: 'text-[#1A7D96]' },
  master: { icon: Trophy, shell: 'border-[#E29AB2] bg-white text-[#B64B72]', dot: 'bg-[#D96992]', accent: 'text-[#B64B72]' },
  challenger: { icon: Sparkles, shell: 'border-[#8FD2A6] bg-white text-[#288C4D]', dot: 'bg-[#43B96A]', accent: 'text-[#288C4D]' },
  unranked: { icon: Medal, shell: 'border-[#D9D2C8] bg-white text-[#7A7065]', dot: 'bg-[#B8ADA0]', accent: 'text-[#7A7065]' },
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

function badgeHint(item) {
  if (!item?.next_badge_label) return '현재 최고 등급입니다.';
  return `${item.remaining_to_next_badge}회 더 완료하면 ${item.next_badge_label}`;
}

function badgeAchievementText(item) {
  const count = Number(item?.lifetime_completed_count || 0);
  if (count <= 0) return '첫 달성에 가까워졌어요';
  return `누적 ${count}회 달성`;
}

function challengeVisual(item) {
  const raw = `${item?.name || ''} ${item?.code || ''}`.toLowerCase();

  if (raw.includes('water_6cups') || raw.includes('water') || raw.includes('물') || item?.category === 'hydration') {
    return { icon: Droplets, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('daily_walk_30min') || raw.includes('walk')) {
    return { icon: Footprints, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('exercise_150min') || raw.includes('exercise') || raw.includes('운동') || item?.category === 'exercise') {
    return { icon: Dumbbell, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('sleep') || raw.includes('수면') || item?.category === 'sleep') {
    return { icon: Moon, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('alcohol') || raw.includes('drink_less_alcohol') || raw.includes('음주') || raw.includes('술')) {
    return { icon: Wine, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('약') || raw.includes('medication') || item?.category === 'medication') {
    return { icon: Pill, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('vegetable_3servings') || raw.includes('채소') || raw.includes('vegetable') || raw.includes('salad')) {
    return { icon: Leaf, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('no_sweetdrink') || raw.includes('sweetdrink') || raw.includes('soda') || raw.includes('단음료')) {
    return { icon: GlassWater, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('no_nightsnack') || raw.includes('nightsnack') || raw.includes('야식')) {
    return { icon: Soup, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  if (raw.includes('식') || raw.includes('meal') || raw.includes('diet') || item?.category === 'diet') {
    return { icon: Utensils, shell: 'bg-[#F7F4EF] text-[#6F665C]' };
  }
  return { icon: Sparkles, shell: 'bg-[#F7F4EF] text-[#6C635A]' };
}

function ChallengeVisualBadge({ visual, size = 24 }) {
  if (visual.emoji) {
    return <span className="leading-none" style={{ fontSize: size }}>{visual.emoji}</span>;
  }

  const VisualIcon = visual.icon;
  return <VisualIcon size={size} />;
}

function TabBar({ activeTab, onChange, highlightSelection }) {
  return (
    <div className="border-b border-black/[.06]">
      <div className="mx-auto flex max-w-[1080px] gap-1 px-6">
        {CATEGORY_GROUPS.map((tab) => {
          const isActive = activeTab === tab.key;
          const shouldPulse = tab.key === 'select' && highlightSelection;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative inline-flex cursor-pointer items-center border-b-2 px-5 py-3 text-[14px] font-semibold transition-colors ${
                isActive ? 'border-nature-500 text-nature-900' : 'border-transparent text-neutral-500 hover:text-nature-800'
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

function BadgePatchTray({ badges }) {
  const featuredBadge = badges[0] || null;

  if (!featuredBadge) {
    return (
      <div className="rounded-[24px] border border-[#E7E0D6] bg-white px-4 py-4 text-center shadow-sm">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[#8B8277]">내 뱃지</div>
        <div className="mt-3 text-[12px] text-[#8F857A]">아직 획득한 뱃지가 없어요</div>
      </div>
    );
  }

  const theme = badgeTheme(featuredBadge.badge_tier);
  const visual = challengeVisual(featuredBadge);

  return (
    <div className="rounded-[24px] border border-[#E7E0D6] bg-white px-4 py-4 text-center shadow-sm">
      <div className="text-[11px] font-semibold tracking-[0.08em] text-[#8B8277]">내 뱃지</div>
      <div className={`relative mx-auto mt-3 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-sm ${theme.shell}`}>
        <ChallengeVisualBadge visual={visual} size={24} />
        <span className={`absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full ring-2 ring-white ${theme.dot}`} />
      </div>
      <div className={`mt-2 text-[12px] font-semibold uppercase tracking-[0.04em] ${theme.accent}`}>
        {featuredBadge.badge_label}
      </div>
      <div className="mt-1 text-[12px] text-neutral-500">{featuredBadge.name}</div>
    </div>
  );
}

function BadgeStatusBoard({ items, earnedBadgeCount }) {
  const visibleItems = items.slice(0, 12);

  return (
    <section className="rounded-[28px] border border-[#E7E0D6] bg-white p-5 shadow-soft">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[22px] font-semibold text-nature-900">뱃지 현황</div>
          <div className="mt-1 text-[13px] text-neutral-500">지금까지 획득한 뱃지 {earnedBadgeCount}개</div>
        </div>
      </div>
          <div className="mt-4">
        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D7CFC3] bg-white px-5 py-6 text-[13px] text-[#8F857A]">
            아직 획득한 뱃지가 없습니다. 오늘 챌린지를 완료하면 첫 뱃지에 가까워집니다.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {visibleItems.map((badge) => {
              const theme = badgeTheme(badge.badge_tier);
              const visual = challengeVisual(badge);
              const isUnranked = badge.badge_tier === 'unranked';
              return (
                <div key={`${badge.template_id}-${badge.badge_tier}`} className={`min-w-[152px] rounded-[24px] border px-4 py-4 text-center shadow-[0_12px_30px_rgba(0,0,0,0.05)] ${isUnranked ? 'border-[#E8E1D6] bg-[#FAF8F4] opacity-80' : 'border-[#EEE7DC] bg-white'}`}>
                  <div className={`relative inline-flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 ${theme.shell} ${isUnranked ? 'grayscale-[0.2]' : ''}`}>
                    <ChallengeVisualBadge visual={visual} size={28} />
                    {!isUnranked && <span className={`absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full ring-2 ring-white ${theme.dot}`} />}
                  </div>
                  <div className={`mt-3 text-[12px] font-semibold uppercase tracking-[0.04em] ${isUnranked ? 'text-[#9A9084]' : theme.accent}`}>
                    {badge.badge_label}
                  </div>
                  <div className={`mt-1 text-[14px] font-semibold ${isUnranked ? 'text-[#7F756A]' : 'text-nature-900'}`}>{badge.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SevenDayProgress({ daysCompleted, streak }) {
  const filled = Math.max(0, Math.min(CHALLENGE_DAYS, Number(daysCompleted || 0)));
  const streakDays = Math.max(0, Math.min(CHALLENGE_DAYS, Number(streak || 0)));
  const weeklyPercent = Math.round((filled / CHALLENGE_DAYS) * 100);

  return (
    <div className="mt-4 rounded-[20px] border border-[#ECE7DE] bg-[#FCFBF7] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium text-[#7E776C]">7일 진행률</div>
        <div className="rounded-full bg-[#171717] px-2.5 py-1 text-[11px] font-semibold text-white">
          {filled}/{CHALLENGE_DAYS}
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: CHALLENGE_DAYS }, (_, index) => {
          const done = index < filled;
          return (
            <div
              key={index}
              className={`h-[8px] flex-1 rounded-full border ${done ? 'border-[#1F1F1F] bg-[#1F1F1F]' : 'border-[#D8D2C7] bg-[#F2EEE7]'}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <div className="text-[#7E776C]">
          이번 주 <span className="font-semibold text-[#2B2B2B]">{weeklyPercent}%</span>
        </div>
        <div className="font-medium text-[#7E776C]">
          <span className="font-semibold text-[#2B2B2B]">{streakDays}일</span> 연속
        </div>
      </div>
    </div>
  );
}

function ActiveChallengeCard({ challenge, busyKey, confirmCancelId, setConfirmCancelId, checkinChallenge, cancelChallenge }) {
  const checking = busyKey === `checkin:${challenge.user_challenge_id}`;
  const cancelling = busyKey === `cancel:${challenge.user_challenge_id}`;
  const showCancelConfirm = confirmCancelId === challenge.user_challenge_id;
  const cancelDisabled = challenge.today_checked || checking || cancelling;
  const visual = challengeVisual(challenge);

  return (
    <section className="rounded-[28px] border border-cream-500 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] ${visual.shell}`}>
            <ChallengeVisualBadge visual={visual} size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[18px] font-semibold text-nature-900">{challenge.name}</div>
              <span className={`rounded-full px-2.5 py-1 text-[12px] ${categoryBadgeStyle(challenge.category)}`}>{categoryLabel(challenge.category)}</span>
            </div>
            <div className="mt-1.5 text-[13px] text-neutral-500">
              현재 {challenge.days_completed}일 완료, 연속 {challenge.current_streak}일 기록 중
            </div>
            <div className="mt-1 text-[12px] text-neutral-400">
              현재 뱃지: {challenge.badge_label} · {badgeHint(challenge)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => checkinChallenge(challenge.user_challenge_id)}
            disabled={challenge.today_checked || checking || cancelling}
            className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold ${
              challenge.today_checked
                ? 'border-[#D8D2C7] bg-[#F2EEE7] text-[#6F665C]'
                : 'border-[#D8D2C7] bg-white text-[#3E3A36] hover:bg-[#F7F4EF] disabled:cursor-not-allowed disabled:bg-[#F2EEE7] disabled:text-neutral-400'
            }`}
          >
            {checking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {challenge.today_checked ? '오늘 완료' : '오늘 할 행동 체크'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmCancelId(showCancelConfirm ? null : challenge.user_challenge_id)}
            disabled={cancelDisabled}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#D8D2C7] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#6F665C] hover:bg-[#F7F4EF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            {challenge.today_checked ? '오늘 완료 후 취소 불가' : '챌린지 취소'}
          </button>
        </div>
      </div>

      <SevenDayProgress daysCompleted={challenge.days_completed} streak={challenge.current_streak} />

      {showCancelConfirm && !challenge.today_checked && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-[13px] text-rose-700">취소하면 현재 연속 기록이 끊기고, 다시 시작할 때 1일부터 새로 시작됩니다.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cancelChallenge(challenge.user_challenge_id)}
              disabled={cancelling}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              그래도 취소하기
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancelId(null)}
              disabled={cancelling}
              className="inline-flex cursor-pointer items-center rounded-full border border-cream-400 bg-white px-4 py-2 text-[13px] font-semibold text-neutral-600 hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              계속하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ChallengePage() {
  const [overview, setOverview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => loadOverview();
    window.addEventListener('danaa:challenge-overview-refresh', handler);
    return () => window.removeEventListener('danaa:challenge-overview-refresh', handler);
  }, [loadOverview]);

  const activeChallenges = Array.isArray(overview?.active) ? overview.active : [];
  const earnedBadges = Array.isArray(overview?.badges) ? overview.badges : [];
  const recommendedChallenges = Array.isArray(overview?.recommended) ? overview.recommended : [];
  const catalog = Array.isArray(overview?.catalog) ? overview.catalog : [];
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
        badge_label: 'UNRANKED',
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

  const toggleSelect = useCallback((templateId) => {
    const numericId = Number(templateId);
    if (activeTemplateIds.has(numericId)) return;

    setSelectedTemplateIds((prev) => {
      if (prev.includes(numericId)) return prev.filter((item) => item !== numericId);
      if (prev.length >= remainingSlots) return prev;
      return [...prev, numericId];
    });
  }, [activeTemplateIds, remainingSlots]);

  const joinChallenge = useCallback(async (templateId) => {
    const numericId = Number(templateId);
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
      if (confirmCancelId === userChallengeId) {
        setConfirmCancelId(null);
      }
    } catch (nextError) {
      setError(nextError.message || '오늘 체크를 처리하지 못했어요.');
    } finally {
      setBusyKey('');
    }
  }, [confirmCancelId, loadOverview]);

  const joinSelectedChallenges = useCallback(async () => {
    for (const templateId of selectedTemplateIds) {
      // eslint-disable-next-line no-await-in-loop
      await joinChallenge(templateId);
    }
    setSelectedTemplateIds([]);
  }, [joinChallenge, selectedTemplateIds]);

  if (!loaded) {
    return (
      <div className="theme-challenge-page flex-1 px-6 py-6">
        <div className="mx-auto h-48 max-w-[960px] animate-pulse rounded-[28px] bg-cream-300" />
      </div>
    );
  }

  return (
    <div className="theme-challenge-page flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-black/[.04] bg-white/90 px-4 backdrop-blur-xl">
        <span className="text-[14px] font-medium text-nature-900">챌린지</span>
      </header>
      <TabBar activeTab={activeTab} onChange={setActiveTab} highlightSelection={activeChallenges.length === 0} />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[1080px]">
          <main className="min-w-0">
            {error && <div className="mb-4 rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-[14px] text-danger">{error}</div>}

            {activeTab === 'dashboard' ? (
              <div className="space-y-5">
                <section className="rounded-[28px] border border-cream-500 bg-white p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[24px] font-semibold text-nature-900">현재 진행 중 챌린지</div>
                      <div className="mt-1 text-[13px] text-neutral-500">지금 {activeCount} / {maxActiveCount}개 진행 중이며 최고 연속 기록은 {topStreak}일입니다.</div>
                    </div>
                    <div className="w-full max-w-[260px]">
                      <BadgePatchTray badges={earnedBadges} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeChallenges.length === 0 ? (
                      <section className="rounded-[24px] border border-cream-500 bg-[#FCFBF7] p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-[20px] font-semibold text-nature-900">먼저 챌린지를 선택해 주세요</div>
                            <div className="mt-2 text-[14px] text-neutral-500">선택 탭에서 추천 챌린지와 전체 목록을 보고 바로 시작할 수 있습니다.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('select')}
                            className="inline-flex items-center gap-2 rounded-full bg-nature-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-nature-800"
                          >
                            선택하러 가기
                            <ArrowRight size={15} />
                          </button>
                        </div>
                        {primaryRecommended && (
                          <div className="mt-4 rounded-[22px] border border-[#E8E1D6] bg-white p-4 shadow-sm">
                            <div className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-[#8B8277]">가장 먼저 추천</div>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-[18px] font-semibold text-nature-900">{primaryRecommended.name}</div>
                                <div className="mt-1 text-[13px] text-neutral-500">{primaryRecommended.description}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => joinChallenge(primaryRecommended.template_id)}
                                disabled={busyKey === `join:${primaryRecommended.template_id}`}
                                className="shrink-0 rounded-full bg-nature-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-nature-600 disabled:opacity-50"
                              >
                                {busyKey === `join:${primaryRecommended.template_id}` ? '시작 중' : '추천 챌린지 시작'}
                              </button>
                            </div>
                          </div>
                        )}
                      </section>
                    ) : (
                      activeChallenges.map((challenge) => (
                        <ActiveChallengeCard
                          key={challenge.user_challenge_id}
                          challenge={challenge}
                          busyKey={busyKey}
                          confirmCancelId={confirmCancelId}
                          setConfirmCancelId={setConfirmCancelId}
                          checkinChallenge={checkinChallenge}
                          cancelChallenge={cancelChallenge}
                        />
                      ))
                    )}
                  </div>
                </section>

                <BadgeStatusBoard items={badgeStatusItems} earnedBadgeCount={earnedBadgeCount} />
              </div>
            ) : (
              <div className="space-y-5">
                {recommendedChallenges.length > 0 && (
                  <section className="rounded-[28px] border border-cream-500 bg-white p-4 shadow-soft">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[17px] font-semibold text-nature-900">추천 챌린지</div>
                      <div className="text-[12px] text-neutral-400">지금 바로 시작 가능한 항목</div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {recommendedChallenges.map((challenge) => {
                        const busy = busyKey === `join:${challenge.template_id}`;
                        const disabled = remainingSlots <= 0 || activeTemplateIds.has(Number(challenge.template_id)) || busy;
                        const visual = challengeVisual(challenge);

                        return (
                          <div key={challenge.template_id} className="rounded-2xl border border-cream-300 bg-cream-50 p-3">
                            <div className="flex items-start gap-3">
                              <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${visual.shell}`}>
                                <ChallengeVisualBadge visual={visual} size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[14px] font-semibold text-nature-900">{challenge.name}</div>
                                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-neutral-500">{challenge.description}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => joinChallenge(challenge.template_id)}
                                disabled={disabled}
                                className="shrink-0 rounded-full bg-nature-500 px-3 py-2 text-[12px] font-semibold text-white hover:bg-nature-600 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-neutral-400"
                              >
                                {busy ? '시작 중' : activeTemplateIds.has(Number(challenge.template_id)) ? '진행 중' : '바로 시작'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="rounded-[28px] border border-cream-500 bg-white p-5 shadow-soft">
                  <div className="mb-4">
                    <div className="text-[22px] font-semibold text-nature-900">챌린지 선택</div>
                    <div className="mt-1 text-[13px] text-neutral-500">지금은 {remainingSlots}개까지 더 선택할 수 있습니다.</div>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {FILTER_GROUPS.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setActiveFilter(group.key)}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium ${
                          activeFilter === group.key ? 'bg-nature-500 text-white' : 'bg-cream-300 text-neutral-600 hover:bg-cream-400'
                        }`}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {guidedSelectableCatalog.map((item) => {
                      const templateId = Number(item.template_id);
                      const isActive = activeTemplateIds.has(templateId);
                      const isSelected = selectedTemplateIds.includes(templateId);
                      const selectionDisabled = !isSelected && !isActive && selectedTemplateIds.length >= remainingSlots;
                      const theme = badgeTheme(item.badge_tier);
                      const visual = challengeVisual(item);
                      const BadgeIcon = theme.icon;

                      return (
                        <button
                          key={templateId}
                          type="button"
                          onClick={() => toggleSelect(templateId)}
                          disabled={isActive || selectionDisabled}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                            isActive ? 'border-cream-400 bg-cream-200 opacity-60' : isSelected ? 'border-nature-500 bg-nature-50' : 'border-cream-400 bg-white hover:bg-cream-100'
                          } ${selectionDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <div className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${visual.shell}`}>
                            <ChallengeVisualBadge visual={visual} size={22} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[15px] font-semibold text-nature-900">{item.name}</div>
                              <span className={`rounded-full px-2.5 py-1 text-[12px] ${categoryBadgeStyle(item.category)}`}>{categoryLabel(item.category)}</span>
                            </div>
                            <div className="mt-1 text-[13px] text-neutral-500">{item.description}</div>
                          </div>
                          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] ${theme.shell}`}>
                            <BadgeIcon size={12} />
                            {item.badge_label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedTemplateIds.length > 0 && (
                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={joinSelectedChallenges}
                        className="cursor-pointer rounded-full bg-nature-500 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-nature-600"
                      >
                        선택한 챌린지 시작
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
