'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3 as BarChart3Icon, ClipboardList, Target, TrendingUp } from 'lucide-react';

import { api } from '../../../hooks/useApi';

const LEVELS = [
  { key: 'LOW', label: '낮음', color: '#4CAF50', max: 3 },
  { key: 'SLIGHT', label: '약간', color: '#8BC34A', max: 8 },
  { key: 'MODERATE', label: '보통', color: '#FFC107', max: 12 },
  { key: 'HIGH', label: '높음', color: '#FF7043', max: 20 },
  { key: 'VERY_HIGH', label: '매우 높음', color: '#E53935', max: 26 },
];

const CATEGORY_LABELS = {
  sleep: '수면',
  diet: '식사',
  exercise: '운동',
  hydration: '수분',
};

function getScorePosition(score) {
  return Math.min(100, Math.max(0, (score / 26) * 100));
}

function getCurrentLevel(score) {
  for (const level of LEVELS) {
    if (score <= level.max) return level;
  }
  return LEVELS[LEVELS.length - 1];
}

function countRecordedDays(categories) {
  if (!categories || typeof categories !== 'object') return 0;

  const recordedDates = new Set();

  Object.values(categories).forEach((category) => {
    if (!Array.isArray(category?.series)) return;

    category.series.forEach((point) => {
      if (point?.date && point?.value !== null && point?.value !== undefined) {
        recordedDates.add(point.date);
      }
    });
  });

  return recordedDates.size;
}

export default function ReportPage() {
  const [status, setStatus] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [challengeOverview, setChallengeOverview] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [statusRes, weeklyRes, challengeRes] = await Promise.all([
          api('/api/v1/onboarding/status'),
          api('/api/v1/health/weekly'),
          api('/api/v1/challenges/overview'),
        ]);

        const nextStatus = statusRes.ok ? await statusRes.json() : null;
        const nextWeekly = weeklyRes.ok ? await weeklyRes.json() : null;
        const nextChallenge = challengeRes.ok ? await challengeRes.json() : null;

        if (!cancelled) {
          setStatus(nextStatus);
          setWeekly(nextWeekly);
          setChallengeOverview(nextChallenge);
        }
      } catch (error) {
        console.error('report_dashboard_load_failed', error);
        if (!cancelled) {
          setStatus(null);
          setWeekly(null);
          setChallengeOverview(null);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasOnboarding = Boolean(status?.is_completed);
  const score = status?.initial_findrisc_score ?? 0;
  const level = getCurrentLevel(score);
  const recordedDays = useMemo(() => countRecordedDays(weekly?.categories), [weekly]);
  const activeChallenges = Array.isArray(challengeOverview?.active) ? challengeOverview.active : [];
  const challengeStats = challengeOverview?.stats || {};
  const categoryCards = useMemo(() => {
    const categories = weekly?.categories || {};
    return Object.entries(CATEGORY_LABELS).map(([key, label]) => {
      const category = categories[key];
      return {
        key,
        label,
        currentValue: category?.current_value,
        goalValue: category?.goal_value,
      };
    });
  }, [weekly]);

  if (!loaded) {
    return (
      <>
        <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
          <span className="text-[14px] font-medium text-nature-900">리포트</span>
        </header>
        <div className="flex-1 px-6 py-6">
          <div className="max-w-[840px] mx-auto space-y-4 animate-pulse">
            <div className="h-6 bg-cream-400 rounded w-1/4"></div>
            <div className="bg-cream-300 rounded-xl p-6 h-32"></div>
            <div className="bg-cream-300 rounded-xl p-6 h-24"></div>
            <div className="bg-cream-300 rounded-xl p-6 h-24"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">리포트</span>
      </header>

      <div className="flex border-b border-cream-500 bg-white shrink-0">
        <div className="px-5 py-2.5 text-[14px] font-medium transition-colors relative text-nature-900 cursor-default">
          대시보드
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-nature-500"></div>
        </div>
        <Link href="/app/report/detail" className="px-5 py-2.5 text-[14px] font-medium transition-colors relative text-neutral-400 hover:text-neutral-600">
          상세 리포트
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[840px] mx-auto">
          <div className="bg-white shadow-float rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-black/[.04]">
              <div className="flex items-baseline gap-3">
                <span className="text-[16px] font-semibold text-nature-900">DA-NA-A</span>
                <span className="text-[13px] text-neutral-400">대시보드</span>
              </div>
            </div>

            <div className="px-7 py-5 flex flex-col gap-0">
              {!hasOnboarding && (
                <div className="text-center py-10">
                  <div className="mb-4"><ClipboardList size={40} className="text-neutral-300 mx-auto" /></div>
                  <div className="text-[16px] font-medium text-nature-900 mb-2">아직 건강 프로필이 없어요</div>
                  <div className="text-[14px] text-neutral-400 mb-6">온보딩 설문을 완료하면 위험도 정보와 리포트를 볼 수 있어요.</div>
                  <Link href="/onboarding/diabetes" className="inline-block px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors">
                    온보딩 시작하기
                  </Link>
                </div>
              )}

              {hasOnboarding && (
                <>
                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">위험도 정보</div>
                  <div className="bg-cream-300 rounded-xl p-[18px_20px] mb-3.5">
                    <div className="flex gap-4 items-center">
                      <div className="bg-white border border-cream-500 rounded-lg px-5 py-3.5 text-center min-w-[80px]">
                        <div className="text-[11px] text-neutral-400 mb-1">점수</div>
                        <div className="text-[34px] font-semibold text-nature-500 leading-none">{score}</div>
                        <div className="text-[12px] text-neutral-400 mt-1">/26</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-end mb-2">
                          <span className="text-[11px] px-3 py-1 border border-cream-500 rounded-lg text-neutral-400 bg-white">{level.label} 구간</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mb-2">FINDRISC 위험도 지수</div>
                        <div className="relative h-[10px] rounded-[5px] mb-1.5" style={{ background: 'linear-gradient(to right, #4CAF50, #8BC34A, #FFC107, #FF7043, #E53935)' }}>
                          <div
                            className="absolute top-[-3px] w-4 h-4 rounded-full border-[2.5px] border-white shadow-md"
                            style={{ left: `calc(${getScorePosition(score)}% - 8px)`, background: '#4A5D23' }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          {LEVELS.map((item) => (
                            <span key={item.key} style={{ color: item.color }} className={item.key === level.key ? 'font-bold' : ''}>
                              {item.key === level.key ? `•${item.label}` : item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-cream-300 rounded-xl p-4 mb-3.5">
                    <div className="text-[11px] font-medium text-neutral-400 tracking-wider mb-1.5">요약</div>
                    <div className="text-[14px] text-neutral-400 leading-[1.8]">
                      그룹: {status.user_group || '-'} / BMI: {status.bmi ?? '-'} / 초기 위험도: {status.initial_risk_level || '-'}
                    </div>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">위험도 추이</div>
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-1"><TrendingUp size={24} className="text-neutral-300" /></div>
                      <div>
                        <div className="text-[13px] text-nature-900 mb-1">대시보드는 지금 바로 볼 수 있어요</div>
                        <div className="text-[11px] text-neutral-400">
                          최근 7일 중 기록된 날짜는 {recordedDays}일이고, 기록이 쌓일수록 추이와 그래프가 더 선명해져요.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">목표별 그래프 준비 상태</div>
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    {categoryCards.map((item) => (
                      <div key={item.key} className="rounded-xl bg-cream-300 p-4">
                        <div className="text-[12px] font-medium text-nature-900">{item.label}</div>
                        <div className="mt-2 text-[24px] font-semibold text-nature-900">
                          {item.currentValue === null || item.currentValue === undefined ? '-' : Math.round(item.currentValue)}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {item.currentValue === null || item.currentValue === undefined
                            ? '아직 서버 기록이 부족해요'
                            : `현재 점수 / 목표 ${Math.round(item.goalValue || 0)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-cream-300 rounded-xl p-4 mb-3.5">
                    <div className="text-[12px] text-neutral-400 mb-3">
                      채팅 아래 카드나 오른쪽 패널에서 기록한 값이 서버에 저장되면, 대시보드와 상세 리포트가 같은 기준으로 채워져요.
                    </div>
                    <div className="flex gap-2">
                      <Link href="/app/chat" className="text-[12px] text-nature-500 hover:underline">오늘 기록 입력하러 가기</Link>
                      <Link href="/app/report/detail" className="text-[12px] text-neutral-400 hover:text-nature-900">상세 리포트 기준 보기</Link>
                    </div>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">챌린지 진행</div>
                  {activeChallenges.length === 0 ? (
                    <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                      <div className="mb-2"><Target size={24} className="text-neutral-300 mx-auto" /></div>
                      <div className="text-[13px] text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
                      <div className="text-[11px] text-neutral-400 mb-3">
                        서버 기준으로 현재 진행 중인 챌린지가 없어요. 챌린지는 챌린지 화면에서 시작하고 체크해요.
                      </div>
                      <Link href="/app/challenge" className="text-[12px] text-nature-500 hover:underline">챌린지 둘러보기</Link>
                    </div>
                  ) : (
                    <div className="bg-cream-300 rounded-xl p-4 mb-3.5 space-y-3">
                      <div className="text-[11px] text-neutral-400">
                        현재 진행 중 {challengeStats.active_count || activeChallenges.length}개 / 남은 슬롯 {challengeStats.remaining_active_slots ?? 0}개
                      </div>
                      {activeChallenges.map((challenge) => (
                        <div key={challenge.user_challenge_id} className="rounded-xl bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[12px] font-medium text-nature-900">{challenge.emoji} {challenge.name}</div>
                              <div className="text-[10px] text-neutral-400">
                                진행률 {Math.round(Number(challenge.progress_pct || 0) * 100)}% · 연속 {challenge.current_streak || 0}일
                              </div>
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {challenge.today_checked ? '오늘 체크 완료' : '오늘 체크 필요'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
