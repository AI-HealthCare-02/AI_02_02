'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ClipboardList,
  Droplets,
  HeartPulse,
  Moon,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';

import { api } from '../../../hooks/useApi';

const TREND_OPTIONS = [
  { key: 'both', label: '통합 보기' },
  { key: 'model', label: 'AI 예측 보기' },
  { key: 'findrisc', label: '생활기반 보기' },
];

const MODEL_LEVEL_COLORS = {
  low: '#4CAF50',
  moderate: '#FFC107',
  high: '#FF7A45',
  very_high: '#E53935',
};

const MODEL_STAGE_LABELS = {
  low: '일반 위험군',
  moderate: '당뇨 위험 주의군',
  high: '당뇨 고위험군',
  very_high: '당뇨 관리 필요군',
};

const MODEL_BAR_STOPS = [
  { label: '일반', color: '#3BAA5C' },
  { label: '주의', color: '#B7C52B' },
  { label: '고위험', color: '#FF9F1C' },
  { label: '관리 필요', color: '#E6533C' },
];

const LIFESTYLE_BAR_STOPS = [
  { label: '안정', color: '#57B847' },
  { label: '약간', color: '#A8C545' },
  { label: '보통', color: '#F0B429' },
  { label: '높음', color: '#FF7A45' },
  { label: '매우 높음', color: '#E5484D' },
];

const SLEEP_HOURS = {
  under_5: 4.5,
  between_5_6: 5.5,
  between_6_7: 6.5,
  between_7_8: 7.5,
  over_8: 8.5,
};

const FACTOR_LABELS = {
  good_sleep: '수면 리듬이 안정적이에요',
  poor_sleep: '수면 시간이 조금 부족해요',
  healthy_diet: '식사 균형이 괜찮아요',
  poor_diet: '식습관 점검이 필요해요',
  regular_exercise: '운동 흐름이 유지되고 있어요',
  low_activity: '활동량을 조금 더 늘려보세요',
  regular_walk: '걷기 습관이 잘 이어지고 있어요',
  good_vegetable_intake: '채소 섭취가 잘 되고 있어요',
  low_vegetable_intake: '채소 섭취를 늘려보세요',
  carb_heavy_meals: '탄수화물 위주 식사가 잦아요',
  frequent_alcohol: '음주 빈도를 조금 줄여보세요',
};

function getLastNDates(days) {
  const today = new Date();
  const dates = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const value = new Date(today);
    value.setDate(today.getDate() - offset);
    dates.push(value.toISOString().slice(0, 10));
  }
  return dates;
}

function average(values) {
  const filtered = values.filter((value) => value != null);
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function roundToSingle(value) {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

function getModelStageLabel(level, fallback) {
  return MODEL_STAGE_LABELS[level] || fallback || '분석 준비 중';
}

function getModelColor(level) {
  return MODEL_LEVEL_COLORS[level] || '#FFC107';
}

function getFindriscLabel(score) {
  if (score == null) return '-';
  if (score <= 3) return '안정 단계';
  if (score <= 8) return '조금 더 관리 필요';
  if (score <= 12) return '생활습관 점검 필요';
  if (score <= 20) return '집중 관리 단계';
  return '생활관리 강화 필요';
}

function getFindriscMarker(score) {
  const safeScore = Math.min(26, Math.max(0, score ?? 0));
  return `${(safeScore / 26) * 100}%`;
}

function getModelMarker(score) {
  const safeScore = Math.min(100, Math.max(0, score ?? 0));
  return `${safeScore}%`;
}

function buildTrendPoints(history) {
  const recent = (history || []).slice(-8);
  if (!recent.length) return [];
  return recent.map((item, index) => {
    const x = 48 + index * (recent.length === 1 ? 0 : 540 / (recent.length - 1));
    const modelScore = item.predicted_score_pct;
    const findriscScore = item.findrisc_score ?? 0;
    return {
      x,
      label: String(item.period_end).slice(5),
      modelScore,
      findriscScore,
      yModel: modelScore == null ? null : 156 - ((Math.min(100, Math.max(0, modelScore)) / 100) * 124),
      yFindrisc: 156 - ((Math.min(26, Math.max(0, findriscScore)) / 26) * 124),
    };
  });
}

function buildPolyline(points) {
  return points
    .filter((point) => point[1] != null)
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}

function metricDiff(current, previous, unit = '') {
  if (current == null || previous == null) {
    return { text: '비교 전', tone: 'text-neutral-400' };
  }
  const delta = roundToSingle(current - previous);
  if (delta > 0) return { text: `↑ ${delta}${unit}`, tone: 'text-nature-700' };
  if (delta < 0) return { text: `↓ ${Math.abs(delta)}${unit}`, tone: 'text-danger' };
  return { text: '→ 유지', tone: 'text-neutral-400' };
}

function scoreDiet(log) {
  let score = 0;
  if (log.vegetable_intake_level === 'enough') score += 35;
  if (log.vegetable_intake_level === 'little') score += 20;
  if (log.meal_balance_level === 'balanced') score += 35;
  if (log.meal_balance_level === 'protein_veg_heavy') score += 25;
  if (log.sweetdrink_level === 'none') score += 15;
  if (log.sweetdrink_level === 'one') score += 8;
  if (log.nightsnack_level === 'none') score += 15;
  if (log.nightsnack_level === 'light') score += 8;
  if (!log.vegetable_intake_level && !log.meal_balance_level && !log.sweetdrink_level && !log.nightsnack_level) {
    return null;
  }
  return score;
}

function getDietLabel(score) {
  if (score == null) return '-';
  if (score >= 75) return '좋음';
  if (score >= 50) return '보통';
  return '점검 필요';
}

function miniChartPoints(series, maxValue, minValue = 0) {
  const safe = series.map((value) => (value == null ? minValue : value));
  return safe.map((value, index) => {
    const x = 28 + index * 48;
    const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
    const y = 96 - (ratio * 52);
    return [x, y];
  });
}

function getCoachingLines(risk) {
  const aiCoaching = risk?.ai_coaching_lines || [];
  if (aiCoaching.length) return aiCoaching.slice(0, 3);

  const recommendations = risk?.recommended_actions || [];
  const signals = risk?.supporting_signals || [];
  const positives = (risk?.top_positive_factors || []).map((item) => FACTOR_LABELS[item] || item);
  const risks = (risk?.top_risk_factors || []).map((item) => FACTOR_LABELS[item] || item);
  if (recommendations.length >= 2) return recommendations.slice(0, 2);
  if (recommendations.length === 1 && signals.length >= 1) {
    return [recommendations[0], `주요 신호: ${signals.slice(0, 2).join(', ')}`];
  }
  if (signals.length >= 1) return signals.slice(0, 2).map((item) => `주요 신호: ${item}`);
  if (positives.length || risks.length) {
    return [
      positives.length ? `잘하고 있는 점: ${positives.slice(0, 2).join(', ')}` : '최근 기록에서 큰 위험 신호는 보이지 않습니다.',
      risks.length ? `조금 더 관리할 점: ${risks.slice(0, 2).join(', ')}` : '이번 주는 수면과 식습관 흐름이 비교적 안정적입니다.',
    ];
  }
  return ['최근 건강 기록을 더 쌓으면 맞춤 코칭이 더 구체적으로 제공됩니다.'];
}

function buildTrendCards(logs) {
  if (!logs.length) return [];
  const previousWeek = logs.slice(0, 7);
  const currentWeek = logs.slice(7);

  const currentSleep = currentWeek.map((log) => SLEEP_HOURS[log.sleep_duration_bucket] ?? null);
  const previousSleep = previousWeek.map((log) => SLEEP_HOURS[log.sleep_duration_bucket] ?? null);
  const currentSleepAvg = roundToSingle(average(currentSleep));
  const previousSleepAvg = roundToSingle(average(previousSleep));

  const currentExerciseSeries = currentWeek.map((log) => ((log.exercise_done || (log.exercise_minutes || 0) > 0) ? 1 : 0));
  const previousExerciseSeries = previousWeek.map((log) => ((log.exercise_done || (log.exercise_minutes || 0) > 0) ? 1 : 0));
  const currentExerciseCount = currentExerciseSeries.reduce((sum, value) => sum + value, 0);
  const previousExerciseCount = previousExerciseSeries.reduce((sum, value) => sum + value, 0);

  const currentDietSeries = currentWeek.map((log) => scoreDiet(log));
  const previousDietSeries = previousWeek.map((log) => scoreDiet(log));
  const currentDietAvg = roundToSingle(average(currentDietSeries));
  const previousDietAvg = roundToSingle(average(previousDietSeries));
  const currentVegDays = currentWeek.filter((log) => log.vegetable_intake_level === 'enough').length;

  const currentWaterSeries = currentWeek.map((log) => log.water_cups ?? null);
  const previousWaterSeries = previousWeek.map((log) => log.water_cups ?? null);
  const currentWaterAvg = roundToSingle(average(currentWaterSeries));
  const previousWaterAvg = roundToSingle(average(previousWaterSeries));

  return [
    {
      key: 'sleep',
      label: '수면',
      icon: Moon,
      color: '#F0B429',
      value: currentSleepAvg == null ? '-' : `${currentSleepAvg}h`,
      sublabel: '목표 7h',
      diff: metricDiff(currentSleepAvg, previousSleepAvg, 'h'),
      compareLabel: previousSleepAvg == null || currentSleepAvg == null ? '이전 7일 비교 데이터 없음' : `이전 7일 ${previousSleepAvg}h -> 최근 7일 ${currentSleepAvg}h`,
      goalLabel: '7h',
      goalValue: 7,
      minValue: 4,
      maxValue: 8.5,
      series: currentSleep,
      previousSeries: previousSleep,
    },
    {
      key: 'exercise',
      label: '운동',
      icon: Activity,
      color: '#46B35F',
      value: `${currentExerciseCount}회`,
      sublabel: '목표 3회',
      diff: metricDiff(currentExerciseCount, previousExerciseCount, '회'),
      compareLabel: `이전 7일 ${previousExerciseCount}회 -> 최근 7일 ${currentExerciseCount}회`,
      goalLabel: '3회',
      goalValue: 3,
      minValue: 0,
      maxValue: 5,
      series: currentExerciseSeries.reduce((accumulator, value) => {
        const previous = accumulator.length ? accumulator[accumulator.length - 1] : 0;
        accumulator.push(previous + value);
        return accumulator;
      }, []),
      previousSeries: previousExerciseSeries.reduce((accumulator, value) => {
        const previous = accumulator.length ? accumulator[accumulator.length - 1] : 0;
        accumulator.push(previous + value);
        return accumulator;
      }, []),
    },
    {
      key: 'diet',
      label: '식습관',
      icon: HeartPulse,
      color: '#F0B429',
      value: getDietLabel(currentDietAvg),
      sublabel: `채소 충분 ${currentVegDays}/7일`,
      diff: metricDiff(currentDietAvg, previousDietAvg, '점'),
      compareLabel: previousDietAvg == null || currentDietAvg == null ? '이전 7일 비교 데이터 없음' : `이전 7일 ${Math.round(previousDietAvg)}점 -> 최근 7일 ${Math.round(currentDietAvg)}점`,
      goalLabel: '70점',
      goalValue: 70,
      minValue: 0,
      maxValue: 100,
      series: currentDietSeries,
      previousSeries: previousDietSeries,
    },
    {
      key: 'hydration',
      label: '수분',
      icon: Droplets,
      color: '#E2544F',
      value: currentWaterAvg == null ? '-' : `${currentWaterAvg}잔`,
      sublabel: '목표 6잔',
      diff: metricDiff(currentWaterAvg, previousWaterAvg, '잔'),
      compareLabel: previousWaterAvg == null || currentWaterAvg == null ? '이전 7일 비교 데이터 없음' : `이전 7일 ${previousWaterAvg}잔 -> 최근 7일 ${currentWaterAvg}잔`,
      goalLabel: '6잔',
      goalValue: 6,
      minValue: 0,
      maxValue: 8,
      series: currentWaterSeries,
      previousSeries: previousWaterSeries,
    },
  ];
}

function TrendCard({ card }) {
  const Icon = card.icon;
  const points = miniChartPoints(card.series, card.maxValue, card.minValue);
  const previousPoints = miniChartPoints(card.previousSeries || [], card.maxValue, card.minValue);
  const polyline = buildPolyline(points);
  const previousPolyline = buildPolyline(previousPoints);
  const goalY = 96 - (((card.goalValue - card.minValue) / (card.maxValue - card.minValue)) * 52);

  return (
    <div className="bg-[#F8F7F3] rounded-[18px] p-4 border border-[#EEE8DE]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: card.color }} />
          <span className="text-[13px] font-medium text-nature-900">{card.label}</span>
        </div>
        <span className={`text-[12px] font-medium ${card.diff.tone}`}>{card.diff.text}</span>
      </div>

      <div className="text-center">
        <div className="text-[18px] font-semibold text-nature-900">{card.value}</div>
        <div className="text-[11px] text-neutral-400 mt-1">{card.sublabel}</div>
      </div>

      <div className="text-[11px] text-neutral-400 text-center mt-2 leading-[1.5]">
        {card.compareLabel}
      </div>

      <div className="mt-4">
        <svg width="100%" viewBox="0 0 360 112" style={{ display: 'block' }}>
          <line x1="24" y1={goalY} x2="336" y2={goalY} stroke="#DAD7CF" strokeWidth="1" strokeDasharray="4 4" />
          <polyline
            points={previousPolyline}
            fill="none"
            stroke={card.color}
            strokeOpacity="0.35"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke={card.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map(([x, y], index) => (
            <circle key={`${card.key}-${index}`} cx={x} cy={y} r={index === points.length - 1 ? 3.5 : 0} fill={card.color} />
          ))}
          <text x="338" y={goalY + 4} textAnchor="start" fontSize="10" fill="#A7A095">{card.goalLabel}</text>
        </svg>
        <div className="flex gap-4 justify-center text-[10px] text-neutral-400 mt-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: card.color }}></span>
            최근 7일
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: card.color }}></span>
            이전 7일
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const [status, setStatus] = useState(null);
  const [risk, setRisk] = useState(null);
  const [history, setHistory] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [trendMode, setTrendMode] = useState('both');

  useEffect(() => {
    async function load() {
      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setStatus(statusData);

          if (statusData.is_completed) {
            const dates = getLastNDates(14);
            const [riskRes, historyRes, ...dailyResponses] = await Promise.all([
              api('/api/v1/risk/recalculate', { method: 'POST' }),
              api('/api/v1/risk/history?weeks=8'),
              ...dates.map((date) => api(`/api/v1/health/daily/${date}`)),
            ]);

            if (riskRes.ok) setRisk(await riskRes.json());
            if (historyRes.ok) {
              const historyData = await historyRes.json();
              setHistory(historyData.history || []);
            }

            const logs = await Promise.all(
              dailyResponses.map(async (response, index) => {
                if (!response.ok) return { log_date: dates[index] };
                return response.json();
              }),
            );
            setDailyLogs(logs);
          }
        }
      } catch {
        setStatus(null);
        setRisk(null);
        setHistory([]);
        setDailyLogs([]);
      }
      setLoaded(true);
    }

    load();
  }, []);

  const hasOnboarding = Boolean(status?.is_completed);
  const hasModelPrediction = risk?.model_enabled === true;
  const coachingLines = useMemo(() => getCoachingLines(risk), [risk]);
  const trendPoints = useMemo(() => buildTrendPoints(history), [history]);
  const trendCards = useMemo(() => buildTrendCards(dailyLogs), [dailyLogs]);
  const trendOptions = useMemo(
    () => TREND_OPTIONS.filter((option) => hasModelPrediction || option.key === 'findrisc'),
    [hasModelPrediction],
  );
  const hasRiskHistory = trendPoints.length > 1;

  useEffect(() => {
    if (!hasModelPrediction && trendMode !== 'findrisc') {
      setTrendMode('findrisc');
    }
  }, [hasModelPrediction, trendMode]);

  if (!loaded) {
    return (
      <>
        <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
          <span className="text-[14px] font-medium text-nature-900">리포트</span>
        </header>
        <div className="flex-1 px-6 py-6">
          <div className="max-w-[920px] mx-auto space-y-4 animate-pulse">
            <div className="bg-[#F7F4EC] border border-[#ECE4D3] rounded-xl px-5 py-4">
              <div className="text-[13px] font-medium text-nature-900 mb-1">최근 기록과 AI 분석을 정리하고 있어요</div>
              <div className="text-[12px] text-neutral-500">최근 생활 기록을 기준으로 현재 상태와 변화 흐름을 불러오는 중입니다.</div>
            </div>
            <div className="h-6 bg-cream-400 rounded w-1/4"></div>
            <div className="bg-cream-300 rounded-xl p-6 h-48"></div>
            <div className="bg-cream-300 rounded-xl p-6 h-56"></div>
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
        <div className="max-w-[920px] mx-auto">
          <div className="bg-white shadow-float rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-black/[.04]">
              <div className="flex items-baseline gap-3">
                <span className="text-[16px] font-semibold text-nature-900">DA-NA-A</span>
                <span className="text-[13px] text-neutral-400">리포트 대시보드</span>
              </div>
            </div>

            <div className="px-7 py-5 flex flex-col gap-0">
              {!hasOnboarding && (
                <div className="text-center py-10">
                  <div className="mb-4"><ClipboardList size={40} className="text-neutral-300 mx-auto" /></div>
                  <div className="text-[16px] font-medium text-nature-900 mb-2">아직 건강 프로필이 없어요</div>
                  <div className="text-[14px] text-neutral-400 mb-6">온보딩 설문을 완료하면 리포트와 위험도 분석을 볼 수 있습니다.</div>
                  <Link href="/onboarding/diabetes" className="inline-block px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors">
                    온보딩 시작하기
                  </Link>
                </div>
              )}

              {hasOnboarding && risk && (
                <>
                  <div className="bg-[#F7F4EC] border border-[#ECE4D3] rounded-xl px-5 py-4 mb-4">
                    <div className="text-[13px] font-semibold text-nature-900 mb-1">대시보드 안내</div>
                    <div className="text-[12px] text-neutral-500 leading-[1.7]">
                      이 화면은 최근 7일 생활 기록을 요약해서 현재 상태와 변화를 빠르게 보는 화면입니다.
                      아래 위험도 추이 영역에서는 최근 변화 흐름을 함께 볼 수 있습니다.
                    </div>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">위험도 정보</div>
                  <div className="space-y-3 mb-4">
                    <section className="bg-[#F4F7FB] rounded-[22px] p-5 border border-[#E4EBF3]">
                      <div className="text-[11px] font-medium text-[#6B7A90] tracking-wider mb-3">AI 예측 위험도</div>
                      {hasModelPrediction ? (
                        <div className="flex flex-col md:flex-row gap-4 md:items-center">
                          <div className="w-[92px] shrink-0 rounded-[16px] bg-white border border-[#D7E1EC] px-3 py-4 text-center shadow-sm">
                            <div className="text-[11px] text-[#7D8CA3] mb-1">예측 점수</div>
                            <div className="text-[24px] font-semibold leading-none text-[#22324A]">{risk.predicted_score_pct ?? '-'}</div>
                            <div className="text-[11px] text-[#7D8CA3] mt-1">/100</div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="text-[15px] font-semibold text-[#22324A]">
                                {getModelStageLabel(risk.predicted_risk_level, risk.predicted_stage_label)}
                              </div>
                              <div className="px-3 py-1 rounded-full bg-white border border-[#D7E1EC] text-[11px] text-[#5B6C83]">
                                {risk.predicted_score_pct ?? '-'}% 구간
                              </div>
                            </div>
                            <div className="relative h-[11px] rounded-full" style={{ background: 'linear-gradient(90deg, #3BAA5C 0%, #B7C52B 35%, #FF9F1C 68%, #E6533C 100%)' }}>
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full border-[3px] border-white shadow-md bg-[#2C3E50]"
                                style={{ left: `calc(${getModelMarker(risk.predicted_score_pct)} - 9px)` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[11px] mt-2 px-[2px]">
                              {MODEL_BAR_STOPS.map((stop) => (
                                <span key={stop.label} style={{ color: stop.color }}>{stop.label}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[16px] bg-white border border-dashed border-[#D7E1EC] px-4 py-4">
                          <div className="text-[14px] font-semibold text-[#22324A] mb-1">AI 예측 리포트 준비 중</div>
                          <div className="text-[12px] text-[#708198] leading-[1.6]">
                            {risk.model_status_message || '모델 산출물 파일이 연결되면 AI 예측 위험도와 예측 추이를 함께 표시합니다.'}
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="bg-[#F8F7F3] rounded-[22px] p-5 border border-[#ECE5D8]">
                      <div className="text-[11px] font-medium text-[#8A7F70] tracking-wider mb-3">생활기반 위험 점수</div>
                      <div className="flex flex-col md:flex-row gap-4 md:items-center">
                        <div className="w-[92px] shrink-0 rounded-[16px] bg-white border border-[#E5DECF] px-3 py-4 text-center shadow-sm">
                          <div className="text-[11px] text-[#9A8E7E] mb-1">점수</div>
                          <div className="text-[24px] font-semibold leading-none text-[#2F3B2F]">{risk.findrisc_score ?? '-'}</div>
                          <div className="text-[11px] text-[#9A8E7E] mt-1">/26</div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="text-[15px] font-semibold text-[#2F3B2F]">{getFindriscLabel(risk.findrisc_score)}</div>
                            <div className="px-3 py-1 rounded-full bg-white border border-[#E5DECF] text-[11px] text-[#807463]">
                              {risk.findrisc_score ?? '-'}점 구간
                            </div>
                          </div>
                          <div className="relative h-[11px] rounded-full" style={{ background: 'linear-gradient(90deg, #57B847 0%, #A8C545 25%, #F0B429 50%, #FF7A45 76%, #E5484D 100%)' }}>
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full border-[3px] border-white shadow-md bg-[#3D3A33]"
                              style={{ left: `calc(${getFindriscMarker(risk.findrisc_score)} - 9px)` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[11px] mt-2 px-[2px]">
                            {LIFESTYLE_BAR_STOPS.map((stop) => (
                              <span key={stop.label} style={{ color: stop.color }}>{stop.label}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="bg-cream-300 rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-nature-500" />
                      <div className="text-[13px] font-semibold text-nature-900">AI 코칭</div>
                    </div>
                    <div className="text-[11px] text-neutral-400 mb-2 leading-[1.6]">
                      최근 7일 기록과 현재 위험도를 바탕으로 AI가 핵심 변화만 짧게 정리합니다.
                    </div>
                    <div className="space-y-1.5 text-[14px] text-neutral-500 leading-[1.7]">
                      {coachingLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">위험도 추이</div>
                  <div className="bg-cream-300 rounded-xl p-5 mb-4">
                    <div className="text-[11px] text-neutral-400 mb-4 leading-[1.6]">
                      {hasModelPrediction
                        ? '현재 주차를 포함한 최근 8주 기록입니다. AI 예측과 생활기반 점수 중 보고 싶은 기준을 선택해 비교할 수 있습니다.'
                        : '현재 주차를 포함한 최근 8주 생활기반 점수 흐름입니다. AI 예측 모델이 연결되면 예측 추이도 함께 비교할 수 있습니다.'}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {trendOptions.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => setTrendMode(option.key)}
                          className={`px-3.5 py-1.5 rounded-full text-[12px] border transition-colors ${
                            trendMode === option.key
                              ? 'bg-nature-500 text-white border-nature-500'
                              : 'bg-white text-neutral-400 border-cream-500 hover:border-neutral-400'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {hasRiskHistory ? (
                      <>
                        <svg width="100%" viewBox="0 0 640 200" style={{ display: 'block' }}>
                          <line x1="48" y1="32" x2="588" y2="32" stroke="#ECE7D8" strokeWidth="1" strokeDasharray="4 4" />
                          <line x1="48" y1="94" x2="588" y2="94" stroke="#ECE7D8" strokeWidth="1" strokeDasharray="4 4" />
                          <line x1="48" y1="156" x2="588" y2="156" stroke="#DED7C5" strokeWidth="1" />
                          {hasModelPrediction && (trendMode === 'both' || trendMode === 'model') && (
                            <polyline
                              points={buildPolyline(trendPoints.map((point) => [point.x, point.yModel]))}
                              fill="none"
                              stroke="#FF7A45"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          {(trendMode === 'both' || trendMode === 'findrisc') && (
                            <polyline
                              points={buildPolyline(trendPoints.map((point) => [point.x, point.yFindrisc]))}
                              fill="none"
                              stroke="#4A5D23"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={trendMode === 'both' ? '6 5' : '0'}
                            />
                          )}
                          {trendPoints.map((point) => (
                            <g key={`${point.label}-${point.x}`}>
                              {hasModelPrediction && (trendMode === 'both' || trendMode === 'model') && point.yModel != null && (
                                <>
                                  <circle cx={point.x} cy={point.yModel} r="4.5" fill="#FF7A45" />
                                  <text x={point.x} y={point.yModel - 10} textAnchor="middle" fontSize="10" fill="#FF7A45">
                                    {point.modelScore}%
                                  </text>
                                </>
                              )}
                              {(trendMode === 'both' || trendMode === 'findrisc') && (
                                <>
                                  <circle cx={point.x} cy={point.yFindrisc} r="4.5" fill="#4A5D23" />
                                  <text x={point.x} y={point.yFindrisc + 18} textAnchor="middle" fontSize="10" fill="#4A5D23">
                                    {point.findriscScore}점
                                  </text>
                                </>
                              )}
                              <text x={point.x} y="184" textAnchor="middle" fontSize="11" fill="#999">
                                {point.label}
                              </text>
                            </g>
                          ))}
                        </svg>

                        <div className="flex flex-wrap gap-4 justify-center text-[11px] text-neutral-400 mt-3">
                          {hasModelPrediction && (trendMode === 'both' || trendMode === 'model') && (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-3 h-0.5 bg-[#FF7A45]"></span>
                              AI 예측 위험도
                            </span>
                          )}
                          {(trendMode === 'both' || trendMode === 'findrisc') && (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-3 border-t-2 border-dashed border-nature-500"></span>
                              생활기반 위험 점수
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <div className="mb-2"><TrendingUp size={24} className="text-neutral-300 mx-auto" /></div>
                        <div className="text-[13px] text-nature-900 mb-1">아직 위험도 추이를 만들 데이터가 부족합니다.</div>
                        <div className="text-[11px] text-neutral-400">건강 기록이 쌓이면 AI 예측과 생활기반 변화를 함께 보여줍니다.</div>
                      </div>
                    )}
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">항목별 트렌드</div>
                  <div className="text-[11px] text-neutral-400 mb-3 leading-[1.6]">
                    수면, 운동, 식습관, 수분 항목을 최근 7일 기준으로 보여주고 이전 7일과 비교합니다.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {trendCards.map((card) => (
                      <TrendCard key={card.key} card={card} />
                    ))}
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">챌린지 이행</div>
                  <div className="bg-cream-300 rounded-xl p-6 text-center">
                    <div className="mb-2"><Target size={24} className="text-neutral-300 mx-auto" /></div>
                    <div className="text-[13px] text-nature-900 mb-1">추천 액션을 챌린지로 연결해보세요</div>
                    <div className="text-[11px] text-neutral-400 mb-3">
                      {(risk.recommended_actions || []).slice(0, 2).join(' / ') || '생활 목표를 선택하면 여기서 진행 상황을 볼 수 있습니다.'}
                    </div>
                    <Link href="/app/challenge" className="text-[12px] text-nature-500 hover:underline">챌린지 보러가기</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
