'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Flame, Loader2 } from 'lucide-react';

import { api } from '../../../hooks/useApi';

const CHECKIN_STATUS = 'achieved';
const MAX_ACTIVE_CHALLENGES = 2;
const LEGACY_STORAGE_KEY = 'danaa_challenges';

const CATEGORY_GROUPS = [
  {
    key: 'all',
    label: '전체',
    matches: () => true,
  },
  {
    key: 'food',
    label: '식습관',
    matches: (item) => item.category === 'diet',
  },
  {
    key: 'move',
    label: '운동',
    matches: (item) => item.category === 'exercise',
  },
  {
    key: 'life',
    label: '생활',
    matches: (item) => ['sleep', 'hydration', 'medication', 'lifestyle'].includes(item.category),
  },
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
  exercise: 'bg-blue-50 text-blue-600',
  diet: 'bg-emerald-50 text-emerald-600',
  sleep: 'bg-violet-50 text-violet-600',
  hydration: 'bg-sky-50 text-sky-600',
  medication: 'bg-amber-50 text-amber-600',
  lifestyle: 'bg-stone-100 text-stone-600',
};

const LEGACY_ID_TO_CODE = {
  veggie: 'vegetable_3servings',
  soda: 'no_sweetdrink',
  night: 'no_nightsnack',
  walk: 'daily_walk_30min',
  exercise: 'exercise_150min',
  water: 'water_6cups',
  sleep: 'sleep_7h',
};

function percent(value) {
  return Math.round(Math.min(100, Math.max(0, Number(value || 0) * 100)));
}

function fireChallengeRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('danaa:challenge-overview-refresh'));
  }
}

function normalizeLegacyChallengeIds(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        if (typeof item.id === 'string' && LEGACY_ID_TO_CODE[item.id]) {
          return LEGACY_ID_TO_CODE[item.id];
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '기타';
}

function categoryBadgeStyle(category) {
  return CATEGORY_BADGE_STYLES[category] || 'bg-stone-100 text-stone-600';
}

export default function ChallengePage() {
  const [overview, setOverview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [legacyCodes, setLegacyCodes] = useState([]);

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const response = await api('/api/v1/challenges/overview');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      setOverview(payload);
    } catch (nextError) {
      console.error('challenge_overview_load_failed', nextError);
      setOverview(null);
      setError('챌린지 상태를 불러오지 못했어요. 잠시 후 다시 확인해주세요.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    setLegacyCodes(normalizeLegacyChallengeIds(storedValue));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handler = () => {
      loadOverview();
    };

    window.addEventListener('danaa:challenge-overview-refresh', handler);
    return () => {
      window.removeEventListener('danaa:challenge-overview-refresh', handler);
    };
  }, [loadOverview]);

  const activeChallenges = Array.isArray(overview?.active) ? overview.active : [];
  const completedChallenges = Array.isArray(overview?.completed) ? overview.completed : [];
  const recommendedChallenges = Array.isArray(overview?.recommended) ? overview.recommended : [];
  const catalog = Array.isArray(overview?.catalog) ? overview.catalog : [];
  const stats = overview?.stats || {};
  const activeTemplateIds = useMemo(
    () => new Set(activeChallenges.map((item) => Number(item.template_id))),
    [activeChallenges],
  );
  const recommendedTemplateIds = useMemo(
    () => new Set(recommendedChallenges.map((item) => Number(item.template_id))),
    [recommendedChallenges],
  );
  const topStreak = useMemo(
    () => activeChallenges.reduce((max, item) => Math.max(max, Number(item.current_streak || 0)), 0),
    [activeChallenges],
  );
  const activeCount = Number(stats.active_count || activeChallenges.length || 0);
  const maxActiveCount = Number(stats.max_active_count || MAX_ACTIVE_CHALLENGES);
  const remainingSlots = Number(stats.remaining_active_slots ?? Math.max(0, maxActiveCount - activeCount));
  const categoryCounts = useMemo(
    () =>
      CATEGORY_GROUPS.reduce((acc, group) => {
        acc[group.key] = catalog.filter((item) => group.matches(item)).length;
        return acc;
      }, {}),
    [catalog],
  );
  const filteredCatalog = useMemo(() => {
    const currentGroup = CATEGORY_GROUPS.find((item) => item.key === activeCategory) || CATEGORY_GROUPS[0];
    return catalog.filter((item) => currentGroup.matches(item));
  }, [activeCategory, catalog]);
  const importableLegacyTemplates = useMemo(() => {
    if (legacyCodes.length === 0) return [];
    return legacyCodes
      .map((code) => catalog.find((item) => item.code === code))
      .filter(Boolean)
      .filter((item, index, array) => array.findIndex((candidate) => candidate.template_id === item.template_id) === index)
      .filter((item) => !activeTemplateIds.has(Number(item.template_id)));
  }, [activeTemplateIds, catalog, legacyCodes]);

  const toggleSelect = useCallback(
    (templateId) => {
      const numericId = Number(templateId);
      if (activeTemplateIds.has(numericId)) return;

      setSelectedTemplateIds((prev) => {
        if (prev.includes(numericId)) {
          return prev.filter((item) => item !== numericId);
        }

        const availableSlots = Math.max(0, remainingSlots - prev.length);
        if (availableSlots <= 0) {
          return prev;
        }

        return [...prev, numericId];
      });
    },
    [activeTemplateIds, remainingSlots],
  );

  const joinChallenge = useCallback(
    async (templateId) => {
      const numericId = Number(templateId);
      const busyId = `join:${numericId}`;
      setBusyKey(busyId);
      setError('');

      try {
        const response = await api(`/api/v1/challenges/${numericId}/join`, {
          method: 'POST',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || `HTTP ${response.status}`);
        }

        await loadOverview();
        fireChallengeRefresh();
      } catch (nextError) {
        setError(nextError.message || '챌린지를 시작하지 못했어요.');
      } finally {
        setBusyKey('');
      }
    },
    [loadOverview],
  );

  const joinSelectedChallenges = useCallback(async () => {
    if (selectedTemplateIds.length === 0) return;

    for (const templateId of selectedTemplateIds) {
      // eslint-disable-next-line no-await-in-loop
      await joinChallenge(templateId);
    }

    setSelectedTemplateIds([]);
  }, [joinChallenge, selectedTemplateIds]);

  const importLegacyChallenges = useCallback(async () => {
    if (importableLegacyTemplates.length === 0) return;

    const limit = Math.max(0, remainingSlots);
    const targets = importableLegacyTemplates.slice(0, limit);
    if (targets.length === 0) {
      setError('지금은 남은 슬롯이 없어서 기존 챌린지를 가져올 수 없어요.');
      return;
    }

    setBusyKey('legacy-import');
    setError('');

    try {
      for (const template of targets) {
        // eslint-disable-next-line no-await-in-loop
        await joinChallenge(template.template_id);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      setLegacyCodes([]);
    } finally {
      setBusyKey('');
    }
  }, [importableLegacyTemplates, joinChallenge, remainingSlots]);

  const checkinChallenge = useCallback(
    async (userChallengeId) => {
      const busyId = `checkin:${userChallengeId}`;
      setBusyKey(busyId);
      setError('');

      try {
        const response = await api(`/api/v1/challenges/${userChallengeId}/checkin`, {
          method: 'POST',
          body: JSON.stringify({ status: CHECKIN_STATUS }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || `HTTP ${response.status}`);
        }

        await loadOverview();
        fireChallengeRefresh();
      } catch (nextError) {
        setError(nextError.message || '오늘 체크를 저장하지 못했어요.');
      } finally {
        setBusyKey('');
      }
    },
    [loadOverview],
  );

  if (!loaded) {
    return (
      <>
        <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
          <span className="text-[14px] font-medium text-nature-900">챌린지</span>
        </header>
        <div className="flex-1 px-6 py-6">
          <div className="max-w-[840px] mx-auto space-y-4 animate-pulse">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-cream-400"></div>
              <div className="h-8 w-24 rounded bg-cream-400"></div>
            </div>
            <div className="h-28 rounded-2xl bg-cream-300"></div>
            <div className="h-64 rounded-2xl bg-cream-300"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">챌린지</span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[840px] mx-auto">
          <div className="mb-5 flex items-center gap-3.5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <Flame size={24} />
            </span>
            <div>
              <div className="text-[28px] font-semibold text-nature-900">{topStreak}일</div>
              <div className="text-[13px] text-neutral-400">연속 기록</div>
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {activeChallenges.map((challenge) => (
                <span
                  key={challenge.user_challenge_id}
                  className="rounded-full bg-cream-300 px-3 py-1.5 text-[14px] text-neutral-500"
                >
                  {challenge.emoji} {challenge.name}
                </span>
              ))}
              {activeChallenges.length < maxActiveCount && (
                <span className="rounded-full bg-cream-300 px-3 py-1.5 text-[14px] text-neutral-300">
                  남은 슬롯 {remainingSlots}개
                </span>
              )}
            </div>
          </div>

          <div className="mb-6 rounded-2xl bg-cream-300 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[14px] text-neutral-400">현재 진행 중</div>
                <div className="mt-1 text-[24px] font-semibold text-nature-900">
                  {activeCount}/{maxActiveCount}개
                </div>
                <div className="text-[14px] text-neutral-400">
                  남은 슬롯 {remainingSlots}개 · 최고 연속 {topStreak}일
                </div>
              </div>
              <div className="rounded-full bg-white px-3.5 py-1.5 text-[14px] text-neutral-500">
                챌린지 참여와 체크는 이 화면에서 관리해요
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-danger/20 bg-danger-light px-4 py-3.5 text-[14px] text-danger">
              {error}
            </div>
          )}

          {importableLegacyTemplates.length > 0 && (
            <div className="mb-5 rounded-2xl border border-cream-500 bg-white px-4 py-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">예전 챌린지 기록이 남아 있어요</div>
                  <div className="mt-1 text-[13px] text-neutral-400">
                    이전 브라우저 저장값에서 가져올 수 있는 챌린지 {importableLegacyTemplates.length}개를 찾았어요.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={importLegacyChallenges}
                  disabled={busyKey === 'legacy-import' || remainingSlots <= 0}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    busyKey === 'legacy-import' || remainingSlots <= 0
                      ? 'bg-cream-300 text-neutral-400 cursor-not-allowed'
                      : 'bg-nature-900 text-white hover:bg-nature-800'
                  }`}
                >
                  {busyKey === 'legacy-import' ? '가져오는 중' : '기존 챌린지 가져오기'}
                </button>
              </div>
            </div>
          )}

          <section className="mb-6">
            <h3 className="mb-3 text-[16px] font-semibold text-nature-900">오늘의 챌린지</h3>

            {activeChallenges.length === 0 ? (
              <div className="rounded-2xl bg-cream-300 px-5 py-6 text-center">
                <div className="text-[13px] font-medium text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
                <div className="text-[13px] leading-[1.55] text-neutral-400">아래에서 챌린지를 고르면 이곳에 진행 상태가 보여요.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {activeChallenges.map((challenge) => {
                  const busy = busyKey === `checkin:${challenge.user_challenge_id}`;
                  const progress = percent(challenge.progress_pct);
                  return (
                    <div key={challenge.user_challenge_id} className="rounded-xl bg-white p-4 shadow-soft">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[20px]">{challenge.emoji}</span>
                            <span className="text-[15px] font-medium text-nature-900">{challenge.name}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[12px] ${categoryBadgeStyle(challenge.category)}`}>
                              {categoryLabel(challenge.category)}
                            </span>
                          </div>
                          <div className="mt-1 text-[14px] text-neutral-400">
                            목표 {challenge.target_days}일 · 현재 {challenge.days_completed}일 완료 · 연속 {challenge.current_streak}일
                          </div>
                        </div>
                        {challenge.today_checked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-nature-100 px-3.5 py-1.5 text-[13px] text-nature-700">
                            <CheckCircle2 size={14} />
                            오늘 체크 완료
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => checkinChallenge(challenge.user_challenge_id)}
                            disabled={busy}
                            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                              busy
                                ? 'bg-cream-300 text-neutral-400 cursor-wait'
                                : 'bg-nature-900 text-white hover:bg-nature-800'
                            }`}
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            오늘 체크하기
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-[48px] shrink-0 text-[14px] text-neutral-400">진행</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-400">
                          <div className="h-full rounded-full bg-nature-500 transition-all" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-[14px] font-medium text-nature-900">{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mb-6 rounded-xl bg-cream-300 px-4 py-3 text-[13px] text-neutral-500">
            건강 기록은 리포트와 브리핑에 반영되고, 챌린지 진행률과 오늘 체크는 이 화면에서 따로 관리돼요.
          </div>

          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-semibold text-nature-900">추천 챌린지</h3>
              <div className="text-[14px] text-neutral-400">남은 슬롯 {remainingSlots}개</div>
            </div>

            {recommendedChallenges.length === 0 ? (
              <div className="rounded-2xl bg-cream-300 px-5 py-6 text-center text-[14px] text-neutral-400">
                지금 자동 추천된 챌린지는 없어요. 아래 목록에서 직접 골라도 돼요.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recommendedChallenges.map((challenge) => {
                  const busy = busyKey === `join:${challenge.template_id}`;
                  const disabled = remainingSlots <= 0 || activeTemplateIds.has(Number(challenge.template_id)) || busy;
                  return (
                    <div key={challenge.template_id} className="rounded-xl bg-white p-4 shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[18px]">{challenge.emoji}</span>
                            <span className="text-[15px] font-medium text-nature-900">{challenge.name}</span>
                          </div>
                          <div className="mt-1 text-[14px] text-neutral-400">
                            {challenge.description} · 기본 {challenge.default_duration_days}일
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => joinChallenge(challenge.template_id)}
                          disabled={disabled}
                          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                            disabled
                              ? 'bg-cream-300 text-neutral-400 cursor-not-allowed'
                              : 'bg-nature-500 text-white hover:bg-nature-600'
                          }`}
                        >
                          {busy ? '시작 중' : activeTemplateIds.has(Number(challenge.template_id)) ? '참여 중' : '시작'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-t-2 border-cream-400 pt-6">
            <h3 className="mb-3 text-[16px] font-semibold text-nature-900">챌린지 선택</h3>

            <div className="mb-5 flex flex-wrap gap-2">
              {CATEGORY_GROUPS.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setActiveCategory(group.key)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    activeCategory === group.key
                      ? 'border border-nature-500 bg-nature-500 text-white'
                      : 'bg-cream-400 text-neutral-500 hover:bg-cream-500'
                  }`}
                >
                  {group.label}
                  <span className="ml-1 opacity-70">{categoryCounts[group.key] || 0}</span>
                </button>
              ))}
            </div>

            <div className="mb-2.5 text-[13px] font-medium text-neutral-400">
              선택 ({selectedTemplateIds.length}/{remainingSlots}개)
              {activeCount > 0 && <span className="ml-1 text-neutral-300">· 이미 {activeCount}개 진행 중</span>}
            </div>

            <div className="space-y-1.5">
              {filteredCatalog.map((item) => {
                const templateId = Number(item.template_id);
                const isActive = activeTemplateIds.has(templateId);
                const isSelected = selectedTemplateIds.includes(templateId);
                const selectionDisabled = !isSelected && !isActive && selectedTemplateIds.length >= remainingSlots;

                return (
                  <button
                    key={templateId}
                    type="button"
                    onClick={() => toggleSelect(templateId)}
                    disabled={isActive || selectionDisabled}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                      isActive
                        ? 'cursor-default bg-cream-300 opacity-60'
                        : selectionDisabled
                          ? 'cursor-not-allowed bg-cream-300 opacity-35'
                          : isSelected
                            ? 'border-2 border-nature-500 bg-cream-300'
                            : 'bg-white shadow-soft hover:bg-cream-300'
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                        isSelected || isActive ? 'bg-nature-500 text-white' : 'border border-cream-500 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream-300 text-[20px]">
                      {item.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-nature-900">{item.name}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[12px] ${categoryBadgeStyle(item.category)}`}>
                          {categoryLabel(item.category)}
                        </span>
                      </div>
                      <div className="text-[14px] text-neutral-400">
                        {item.description} · 기본 {item.default_duration_days}일
                      </div>
                    </div>
                    {(item.is_recommended || recommendedTemplateIds.has(templateId)) && (
                      <span className="rounded bg-cream-300 px-2.5 py-1 text-[13px] text-nature-500">추천</span>
                    )}
                    {isActive && (
                      <span className="rounded bg-nature-500 px-2.5 py-1 text-[13px] text-white">참여 중</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedTemplateIds.length > 0 && (
              <div className="py-4 text-center">
                <button
                  type="button"
                  onClick={joinSelectedChallenges}
                  className="rounded-lg bg-nature-500 px-6 py-2.5 text-[14px] font-medium text-white hover:bg-nature-600 transition-colors"
                >
                  {selectedTemplateIds.length === 1
                    ? '챌린지 시작하기'
                    : `${selectedTemplateIds.length}개 챌린지 시작하기`}
                </button>
              </div>
            )}

            <div className="py-3 text-center text-[13px] text-neutral-400">
              참여 중 <span className="font-medium text-nature-900">{activeCount}</span> / 최대 {maxActiveCount}개
            </div>
          </section>

          <section className="mt-6">
            <h3 className="mb-3 text-[16px] font-semibold text-nature-900">완료한 챌린지</h3>
            {completedChallenges.length === 0 ? (
              <div className="rounded-2xl bg-cream-300 px-5 py-6 text-center text-[14px] text-neutral-400">
                아직 완료한 챌린지는 없어요.
              </div>
            ) : (
              <div className="space-y-3">
                {completedChallenges.map((challenge) => (
                  <div key={challenge.user_challenge_id} className="rounded-xl bg-white p-4 shadow-soft">
                    <div className="flex items-center gap-2">
                      <span className="text-[18px]">{challenge.emoji}</span>
                      <span className="text-[15px] font-medium text-nature-900">{challenge.name}</span>
                      <span className="rounded-full bg-nature-100 px-2.5 py-1 text-[12px] text-nature-700">완료</span>
                    </div>
                    <div className="mt-1 text-[14px] text-neutral-400">
                      총 {challenge.days_completed}일 기록 · 최고 연속 {challenge.best_streak}일
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
