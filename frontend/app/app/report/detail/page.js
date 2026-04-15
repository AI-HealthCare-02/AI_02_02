'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3 as BarChartIcon } from 'lucide-react';

import { api } from '../../../../hooks/useApi';

const PERIOD_OPTIONS = [
  { value: 1, label: '1일' },
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
];

const CATEGORY_ORDER = ['sleep', 'diet', 'exercise', 'hydration'];

const CATEGORY_META = {
  sleep: { label: '수면', color: '#4A90D9' },
  diet: { label: '식사', color: '#F0A500' },
  exercise: { label: '운동', color: '#60A5FA' },
  hydration: { label: '수분', color: '#B0B0B0' },
};

const FACTOR_LABELS = {
  good_sleep: '수면 상태 양호',
  poor_sleep: '수면 관리 필요',
  healthy_diet: '식습관 양호',
  poor_diet: '식습관 관리 필요',
  regular_exercise: '운동 루틴 양호',
  low_activity: '활동량 부족',
  regular_walk: '걷기 루틴 양호',
  good_vegetable_intake: '채소 섭취 양호',
  low_vegetable_intake: '채소 섭취 부족',
  carb_heavy_meals: '탄수화물 위주 식사',
  frequent_alcohol: '음주 빈도 높음',
};

const SLEEP_HOURS = {
  under_5: 4.5,
  between_5_6: 5.5,
  between_6_7: 6.5,
  between_7_8: 7.5,
  over_8: 8.5,
};

function labelFactor(value) {
  return FACTOR_LABELS[value] || value;
}

function getLastNDates(days) {
  const today = new Date();
  const dates = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const target = new Date(today);
    target.setDate(today.getDate() - offset);
    dates.push(target.toISOString().slice(0, 10));
  }
  return dates;
}

function average(values) {
  const filtered = values.filter((value) => value != null);
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function round1(value) {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
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

function getPeriodLabel(days) {
  if (days === 1) return '오늘';
  return `최근 ${days}일`;
}

function buildPolyline(points) {
  return points
    .filter((point) => point[1] != null)
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}

function seriesToPoints(series, maxValue, minValue = 0, width = 640, height = 180) {
  if (!series.length) return [];
  return series.map((value, index) => {
    const x = 90 + index * ((width - 140) / Math.max(1, series.length - 1));
    const ratio = maxValue === minValue ? 0.5 : ((value ?? minValue) - minValue) / (maxValue - minValue);
    const y = (height - 20) - (Math.max(0, Math.min(1, ratio)) * (height - 40));
    return [x, y];
  });
}

function seriesToBars(series, maxValue, options = {}) {
  const {
    chartWidth = 500,
    startX = 90,
    baseY = 112,
    chartHeight = 97,
    groupWidth = 20,
    barWidth = 8,
    gap = 3,
  } = options;

  const step = chartWidth / Math.max(1, series.length - 1 || 1);
  return series.map((value, index) => {
    const safe = Math.max(0, value ?? 0);
    const height = maxValue <= 0 ? 0 : (safe / maxValue) * chartHeight;
    const x = startX + (index * step) - (groupWidth / 2);
    return {
      x,
      y: baseY - height,
      width: barWidth,
      height,
      pairedX: x + barWidth + gap,
    };
  });
}

function metricText(current, previous, unit = '') {
  if (current == null) return '-';
  if (previous == null) return `${current}${unit}`;
  const delta = round1(current - previous);
  if (delta > 0) return `${current}${unit} / 이전 대비 +${delta}${unit}`;
  if (delta < 0) return `${current}${unit} / 이전 대비 -${Math.abs(delta)}${unit}`;
  return `${current}${unit} / 이전과 동일`;
}

function getCategoryAnalytics(currentLogs, previousLogs, periodDays) {
  const currentSleepSeries = currentLogs.map((log) => SLEEP_HOURS[log.sleep_duration_bucket] ?? null);
  const previousSleepSeries = previousLogs.map((log) => SLEEP_HOURS[log.sleep_duration_bucket] ?? null);
  const currentSleepAvg = round1(average(currentSleepSeries));
  const previousSleepAvg = round1(average(previousSleepSeries));

  const currentDietSeries = currentLogs.map((log) => scoreDiet(log));
  const previousDietSeries = previousLogs.map((log) => scoreDiet(log));
  const currentDietAvg = round1(average(currentDietSeries));
  const previousDietAvg = round1(average(previousDietSeries));

  const currentExerciseSeries = currentLogs.map((log) => (log.exercise_done || (log.exercise_minutes || 0) > 0 ? (log.exercise_minutes || 30) : 0));
  const previousExerciseSeries = previousLogs.map((log) => (log.exercise_done || (log.exercise_minutes || 0) > 0 ? (log.exercise_minutes || 30) : 0));
  const currentExerciseTotal = currentExerciseSeries.reduce((sum, value) => sum + value, 0);
  const previousExerciseTotal = previousExerciseSeries.reduce((sum, value) => sum + value, 0);

  const currentWaterSeries = currentLogs.map((log) => log.water_cups ?? null);
  const previousWaterSeries = previousLogs.map((log) => log.water_cups ?? null);
  const currentWaterAvg = round1(average(currentWaterSeries));
  const previousWaterAvg = round1(average(previousWaterSeries));

  const exerciseTarget = Math.max(30, Math.round((150 / 7) * periodDays));

  return {
    sleep: {
      key: 'sleep',
      label: '수면',
      score: Math.round(Math.min(100, ((currentSleepAvg || 0) / 7) * 100)),
      currentValue: currentSleepAvg == null ? '-' : `${currentSleepAvg}h`,
      compareText: metricText(currentSleepAvg, previousSleepAvg, 'h'),
      currentSummary: `${getPeriodLabel(periodDays)} 평균 수면시간`,
      currentSeries: currentSleepSeries.map((value) => value ?? 0),
      previousSeries: previousSleepSeries.map((value) => value ?? 0),
      chartMax: 8.5,
      insight: currentSleepAvg != null ? `이 기간 평균 수면은 ${currentSleepAvg}시간입니다.` : '수면 기록이 아직 부족합니다.',
    },
    diet: {
      key: 'diet',
      label: '식사',
      score: Math.round(currentDietAvg ?? 0),
      currentValue: currentDietAvg == null ? '-' : `${Math.round(currentDietAvg)}점`,
      compareText: metricText(Math.round(currentDietAvg ?? 0), Math.round(previousDietAvg ?? 0), '점'),
      currentSummary: `${getPeriodLabel(periodDays)} 식습관 점수`,
      currentSeries: currentDietSeries.map((value) => value ?? 0),
      previousSeries: previousDietSeries.map((value) => value ?? 0),
      chartMax: 100,
      insight: currentDietAvg != null ? `채소, 식사 균형, 간식 기록을 반영한 평균 점수입니다.` : '식사 기록이 아직 부족합니다.',
    },
    exercise: {
      key: 'exercise',
      label: '운동',
      score: Math.round(Math.min(100, (currentExerciseTotal / exerciseTarget) * 100)),
      currentValue: `${currentExerciseTotal}분`,
      compareText: metricText(currentExerciseTotal, previousExerciseTotal, '분'),
      currentSummary: `${getPeriodLabel(periodDays)} 총 운동시간`,
      currentSeries: currentExerciseSeries,
      previousSeries: previousExerciseSeries,
      chartMax: Math.max(60, ...currentExerciseSeries, ...previousExerciseSeries, 60),
      insight: `이 기간 운동 목표는 ${exerciseTarget}분 기준으로 계산합니다.`,
    },
    hydration: {
      key: 'hydration',
      label: '수분',
      score: Math.round(Math.min(100, ((currentWaterAvg || 0) / 6) * 100)),
      currentValue: currentWaterAvg == null ? '-' : `${currentWaterAvg}잔`,
      compareText: metricText(currentWaterAvg, previousWaterAvg, '잔'),
      currentSummary: `${getPeriodLabel(periodDays)} 평균 물 섭취량`,
      currentSeries: currentWaterSeries.map((value) => value ?? 0),
      previousSeries: previousWaterSeries.map((value) => value ?? 0),
      chartMax: 8,
      insight: currentWaterAvg != null ? `이 기간 평균 수분 섭취는 ${currentWaterAvg}잔입니다.` : '수분 기록이 아직 부족합니다.',
    },
  };
}

function PeriodButton({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-[12px] border transition-colors ${
        active
          ? 'bg-nature-500 text-white border-nature-500'
          : 'bg-white text-neutral-400 border-cream-500 hover:border-neutral-400'
      }`}
    >
      {label}
    </button>
  );
}

function ScoreCard({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2.5 px-2 text-center cursor-pointer transition-all ${
        active
          ? 'border-2 border-nature-500 shadow-float bg-white'
          : 'border border-cream-500 bg-white shadow-soft hover:shadow-float hover:-translate-y-0.5'
      }`}
    >
      <div className="text-[11px] text-neutral-400 mb-1">{item.label}</div>
      <div className="text-[22px] font-semibold leading-none text-nature-900">{item.score}</div>
      <div className="text-[11px] font-medium mt-1 text-neutral-500">{item.currentValue}</div>
      <div className="text-[11px] text-neutral-400 mt-1.5 pt-1.5 border-t border-black/[.04] leading-snug">{item.compareText}</div>
    </button>
  );
}

function ComparisonChart({ title, currentSeries, previousSeries, color, maxValue, days, variant = 'line' }) {
  const currentPoints = seriesToPoints(currentSeries, maxValue);
  const previousPoints = seriesToPoints(previousSeries, maxValue);
  const currentBars = seriesToBars(currentSeries, maxValue);
  const previousBars = seriesToBars(previousSeries, maxValue);
  const previousColor = '#8E877B';
  const labels = Array.from({ length: currentSeries.length }, (_, index) => {
    if (days === 1) return ['오늘'][index] || '';
    return `${index + 1}일`;
  });
  const showEvery = days >= 30 ? 5 : days >= 14 ? 2 : 1;

  return (
    <>
      <div className="text-[12px] font-medium text-neutral-400 tracking-wider mt-5 mb-3">{title}</div>
      <svg width="100%" viewBox="0 0 640 138" style={{ display: 'block', marginBottom: 8 }}>
        <line x1="50" y1="15" x2="600" y2="15" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="50" y1="50" x2="600" y2="50" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="50" y1="85" x2="600" y2="85" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="50" y1="112" x2="600" y2="112" stroke="#eee" strokeWidth="0.5" />
        {variant === 'bar' ? (
          <>
            {previousBars.map((bar, index) => (
              <rect
                key={`prev-bar-${title}-${index}`}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx="3"
                fill={previousColor}
                fillOpacity="0.55"
                stroke={previousColor}
                strokeOpacity="0.85"
                strokeWidth="1"
              />
            ))}
            {currentBars.map((bar, index) => (
              <rect
                key={`curr-bar-${title}-${index}`}
                x={bar.pairedX}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx="3"
                fill={color}
              />
            ))}
          </>
        ) : (
          <>
            <polyline
              points={buildPolyline(previousPoints)}
              fill="none"
              stroke={previousColor}
              strokeWidth="2.4"
              strokeOpacity="0.9"
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline points={buildPolyline(currentPoints)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {currentPoints.map(([x, y], index) => (
              <circle key={`curr-dot-${title}-${index}`} cx={x} cy={y} r={index === currentPoints.length - 1 ? 3.5 : 0} fill={color} />
            ))}
          </>
        )}
        {labels.map((label, index) => {
          if (days !== 1 && index % showEvery !== 0 && index !== labels.length - 1) return null;
          return (
            <text key={`${title}-${label}-${index}`} x={currentPoints[index]?.[0] ?? 90} y="128" fontSize="10" fill="#AAA" textAnchor="middle">
              {label}
            </text>
          );
        })}
      </svg>
      <div className="flex gap-4 justify-center text-[11px] text-neutral-400">
        <span className="flex items-center gap-1">
          <span className={`inline-block ${variant === 'bar' ? 'w-2 h-2 rounded-sm' : 'w-3 h-0.5'}`} style={{ backgroundColor: color }}></span>
          선택 기간
        </span>
        <span className="flex items-center gap-1">
          <span className={variant === 'bar' ? 'inline-block w-2 h-2 rounded-sm' : 'inline-block w-3 border-t-2 border-dashed'} style={variant === 'bar' ? { backgroundColor: previousColor } : { borderColor: previousColor }}></span>
          이전 같은 기간
        </span>
      </div>
    </>
  );
}

function OverviewChart({ analytics, selectedKey, days }) {
  const seriesMap = {
    sleep: analytics.sleep.currentSeries,
    diet: analytics.diet.currentSeries,
    exercise: analytics.exercise.currentSeries,
    hydration: analytics.hydration.currentSeries,
  };

  const maxMap = {
    sleep: analytics.sleep.chartMax,
    diet: analytics.diet.chartMax,
    exercise: analytics.exercise.chartMax,
    hydration: analytics.hydration.chartMax,
  };

  const colors = {
    sleep: CATEGORY_META.sleep.color,
    diet: CATEGORY_META.diet.color,
    exercise: CATEGORY_META.exercise.color,
    hydration: CATEGORY_META.hydration.color,
  };

  const labels = Array.from({ length: analytics.sleep.currentSeries.length }, (_, index) => {
    if (days === 1) return ['오늘'][index] || '';
    return `${index + 1}일`;
  });
  const showEvery = days >= 30 ? 5 : days >= 14 ? 2 : 1;

  return (
    <>
      <div className="text-[13px] font-semibold text-nature-900 mb-2.5">전체 그래프</div>
      <div className="bg-cream-300 rounded-xl p-5 mb-4">
        <div className="text-[11px] text-neutral-400 mb-3 leading-[1.6]">
          선택한 기간의 주요 항목 흐름입니다. 카드를 누르면 해당 항목을 더 선명하게 볼 수 있습니다.
        </div>
        <svg width="100%" viewBox="0 0 640 180" style={{ display: 'block', marginBottom: 6 }}>
          <line x1="50" y1="20" x2="600" y2="20" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="50" y1="70" x2="600" y2="70" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="50" y1="120" x2="600" y2="120" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="50" y1="160" x2="600" y2="160" stroke="#eee" strokeWidth="0.5" />
          {Object.keys(seriesMap).map((key) => {
            const points = seriesToPoints(seriesMap[key], maxMap[key]);
            const isFocused = !selectedKey || selectedKey === key;
            return (
              <g key={key}>
                <polyline
                  points={buildPolyline(points)}
                  fill="none"
                  stroke={colors[key]}
                  strokeWidth={isFocused ? '2.5' : '1.8'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isFocused ? 0.95 : 0.18}
                />
                {points.length > 0 && (
                  <circle
                    cx={points[points.length - 1][0]}
                    cy={points[points.length - 1][1]}
                    r={isFocused ? 3.2 : 2.2}
                    fill={colors[key]}
                    fillOpacity={isFocused ? 1 : 0.35}
                  />
                )}
              </g>
            );
          })}
          {labels.map((label, index) => {
            if (days !== 1 && index % showEvery !== 0 && index !== labels.length - 1) return null;
            return (
              <text key={`${label}-${index}`} x={90 + index * ((640 - 140) / Math.max(1, labels.length - 1))} y="174" fontSize="11" fill="#AAA" textAnchor="middle">
                {label}
              </text>
            );
          })}
        </svg>
        <div className="flex gap-3.5 justify-center text-[11px] text-neutral-400 mb-1">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CATEGORY_META.sleep.color }}></span>수면</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CATEGORY_META.diet.color }}></span>식사</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CATEGORY_META.exercise.color }}></span>운동</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CATEGORY_META.hydration.color }}></span>수분</span>
        </div>
      </div>
    </>
  );
}

function MetricCard({ title, value, suffix = '', caption }) {
  return (
    <div className="bg-cream-300 rounded-lg py-2.5 px-3 text-center">
      <div className="text-[11px] text-neutral-400 mb-1">{title}</div>
      <div className="font-semibold text-nature-900 text-[18px]">{value}{suffix}</div>
      <div className="text-[11px] text-neutral-400 mt-0.5">{caption}</div>
    </div>
  );
}

export default function ReportDetailPage() {
  const [scoreTab, setScoreTab] = useState('all');
  const [periodDays, setPeriodDays] = useState(7);
  const [status, setStatus] = useState(null);
  const [risk, setRisk] = useState(null);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoaded(false);
      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);

        const statusData = await statusRes.json();
        setStatus(statusData);

        if (statusData.is_completed) {
          const fetchDays = periodDays * 2;
          const dates = getLastNDates(fetchDays);
          const summaryPeriod = periodDays === 1 ? 7 : periodDays;
          const [riskRes, summaryRes, ...logResponses] = await Promise.all([
            api('/api/v1/risk/recalculate', { method: 'POST' }),
            api(`/api/v1/analysis/summary?period=${summaryPeriod}`),
            ...dates.map((date) => api(`/api/v1/health/daily/${date}`)),
          ]);

          if (riskRes.ok) setRisk(await riskRes.json());
          else setRisk(null);

          if (summaryRes.ok) setSummary(await summaryRes.json());
          else setSummary(null);

          const dailyLogs = await Promise.all(
            logResponses.map(async (response, index) => (response.ok ? response.json() : { log_date: dates[index] })),
          );
          setLogs(dailyLogs);
        }
      } catch {
        setStatus(null);
        setRisk(null);
        setSummary(null);
        setLogs([]);
      }
      setLoaded(true);
    }

    load();
  }, [periodDays]);

  const hasOnboarding = Boolean(status?.is_completed);
  const currentLogs = useMemo(() => logs.slice(-periodDays), [logs, periodDays]);
  const previousLogs = useMemo(() => logs.slice(-periodDays * 2, -periodDays), [logs, periodDays]);
  const hasDailyData = currentLogs.some((log) => log.sleep_duration_bucket || log.meal_balance_level || log.exercise_done != null || log.water_cups != null);

  const analytics = useMemo(() => getCategoryAnalytics(currentLogs, previousLogs, periodDays), [currentLogs, previousLogs, periodDays]);
  const categoryItems = useMemo(() => CATEGORY_ORDER.map((key) => analytics[key]), [analytics]);
  const selectedKey = scoreTab === 'all' ? null : scoreTab;
  const selectedItem = selectedKey ? analytics[selectedKey] : null;

  const positiveFactors = (summary?.top_positive_factors || []).map(labelFactor);
  const riskFactors = (summary?.top_risk_factors || []).map(labelFactor);
  const recommendedActions = risk?.recommended_actions || [];

  const sectionMap = {
    sleep: {
      title: '수면 상세',
      insight: selectedItem?.insight || analytics.sleep.insight,
      metrics: [
        { title: '수면 점수', value: analytics.sleep.score, suffix: '/100' },
        { title: '평균 수면', value: analytics.sleep.currentValue, caption: getPeriodLabel(periodDays) },
        { title: '비교', value: analytics.sleep.compareText, caption: '이전 같은 기간' },
      ],
      chart: <ComparisonChart title="수면 시간 비교" currentSeries={analytics.sleep.currentSeries} previousSeries={analytics.sleep.previousSeries} color={CATEGORY_META.sleep.color} maxValue={analytics.sleep.chartMax} days={periodDays} />,
    },
    diet: {
      title: '식사 상세',
      insight: analytics.diet.insight,
      metrics: [
        { title: '식사 점수', value: analytics.diet.score, suffix: '/100' },
        { title: '현재 점수', value: analytics.diet.currentValue, caption: getPeriodLabel(periodDays) },
        { title: '비교', value: analytics.diet.compareText, caption: '이전 같은 기간' },
      ],
      chart: <ComparisonChart title="식사 점수 비교" currentSeries={analytics.diet.currentSeries} previousSeries={analytics.diet.previousSeries} color={CATEGORY_META.diet.color} maxValue={analytics.diet.chartMax} days={periodDays} />,
    },
    exercise: {
      title: '운동 상세',
      insight: analytics.exercise.insight,
      metrics: [
        { title: '운동 점수', value: analytics.exercise.score, suffix: '/100' },
        { title: '총 운동시간', value: analytics.exercise.currentValue, caption: getPeriodLabel(periodDays) },
        { title: '비교', value: analytics.exercise.compareText, caption: '이전 같은 기간' },
      ],
      chart: <ComparisonChart title="운동 시간 비교" currentSeries={analytics.exercise.currentSeries} previousSeries={analytics.exercise.previousSeries} color={CATEGORY_META.exercise.color} maxValue={analytics.exercise.chartMax} days={periodDays} variant="bar" />,
    },
    hydration: {
      title: '수분 상세',
      insight: analytics.hydration.insight,
      metrics: [
        { title: '수분 점수', value: analytics.hydration.score, suffix: '/100' },
        { title: '평균 섭취량', value: analytics.hydration.currentValue, caption: getPeriodLabel(periodDays) },
        { title: '비교', value: analytics.hydration.compareText, caption: '이전 같은 기간' },
      ],
      chart: <ComparisonChart title="수분 섭취량 비교" currentSeries={analytics.hydration.currentSeries} previousSeries={analytics.hydration.previousSeries} color={CATEGORY_META.hydration.color} maxValue={analytics.hydration.chartMax} days={periodDays} />,
    },
  };

  const orderedSections = selectedKey ? [selectedKey, ...CATEGORY_ORDER.filter((item) => item !== selectedKey)] : CATEGORY_ORDER;

  return (
    <>
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">리포트</span>
      </header>

      <div className="flex border-b border-cream-500 bg-white shrink-0">
        <Link href="/app/report" className="px-5 py-2.5 text-[14px] font-medium transition-colors relative text-neutral-400 hover:text-neutral-600">대시보드</Link>
        <div className="px-5 py-2.5 text-[14px] font-medium transition-colors relative text-nature-900 cursor-default">
          상세 리포트
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-nature-500"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[900px] mx-auto">
          <div className="bg-white shadow-float rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-black/[.04]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-[16px] font-semibold text-nature-900">DA-NA-A</span>
                  <span className="text-[13px] text-neutral-400">상세 리포트</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {PERIOD_OPTIONS.map((option) => (
                    <PeriodButton key={option.value} active={periodDays === option.value} label={option.label} onClick={() => setPeriodDays(option.value)} />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-7 py-5 flex flex-col gap-0">
              {!loaded && (
                <>
                  <div className="bg-[#F7F4EC] border border-[#ECE4D3] rounded-xl px-5 py-4 mb-4">
                    <div className="text-[13px] font-medium text-nature-900 mb-1">상세 분석을 준비하고 있어요</div>
                    <div className="text-[12px] text-neutral-500 leading-[1.7]">
                      선택한 기간의 DB 기록과 AI 분석을 정리하는 중입니다.
                    </div>
                  </div>
                  <div className="text-center py-10 text-[14px] text-neutral-400">리포트를 불러오는 중입니다.</div>
                </>
              )}

              {loaded && !hasOnboarding && (
                <div className="text-center py-10">
                  <div className="mb-4"><BarChartIcon size={40} className="text-neutral-300 mx-auto" /></div>
                  <div className="text-[16px] font-medium text-nature-900 mb-2">아직 상세 리포트를 만들 수 없어요</div>
                  <div className="text-[14px] text-neutral-400 mb-6">온보딩 설문과 건강 기록이 쌓이면 실제 분석 결과가 표시됩니다.</div>
                  <Link href="/onboarding/diabetes" className="inline-block px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors">온보딩 시작하기</Link>
                </div>
              )}

              {loaded && hasOnboarding && !hasDailyData && (
                <div className="text-center py-10">
                  <div className="mb-4"><BarChartIcon size={40} className="text-neutral-300 mx-auto" /></div>
                  <div className="text-[16px] font-medium text-nature-900 mb-2">아직 상세 리포트를 만들 수 없어요</div>
                  <div className="text-[14px] text-neutral-400 mb-2">{getPeriodLabel(periodDays)} 건강 기록이 더 쌓이면 상세 분석을 볼 수 있어요</div>
                  <div className="text-[12px] text-neutral-300 mb-6">수면, 식사, 운동, 수분을 기록하면 기간별 비교가 가능합니다.</div>
                  <Link href="/app/chat" className="inline-block px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors">AI 채팅에서 기록 시작</Link>
                </div>
              )}

              {loaded && hasOnboarding && hasDailyData && risk && (
                <>
                  <div className="bg-[#F7F4EC] border border-[#ECE4D3] rounded-xl px-5 py-4 mb-4">
                    <div className="text-[13px] font-semibold text-nature-900 mb-1">상세 리포트 안내</div>
                    <div className="text-[12px] text-neutral-500 leading-[1.7]">
                      이 화면은 선택한 기간의 기록을 더 깊게 분석하는 화면입니다. 오른쪽 버튼으로 1일, 7일, 30일 기준을 바꿔서
                      같은 항목을 다시 볼 수 있습니다.
                    </div>
                  </div>

                  <div className="bg-cream-300 rounded-lg p-4 mb-4" style={{ minHeight: 68 }}>
                    <div className="text-[11px] font-medium text-neutral-400 tracking-wider mb-1.5">
                      {periodDays === 1 ? 'AI 오늘 요약' : `AI ${getPeriodLabel(periodDays)} 요약`}
                    </div>
                    <div className="text-[14px] text-nature-900 leading-[1.7]">
                      {summary
                        ? `좋은 흐름: ${positiveFactors.slice(0, 2).join(', ') || '아직 없음'}. 우선 관리: ${riskFactors.slice(0, 2).join(', ') || '기본 관리 유지'}.`
                        : recommendedActions[0] || '기록이 더 쌓이면 기간별 분석 요약이 표시됩니다.'}
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-400 mb-3 leading-[1.6]">
                    기준 기간: {getPeriodLabel(periodDays)}. 아래 비교 문구와 점선 그래프는 바로 이전 같은 기간과의 차이를 뜻합니다.
                  </div>

                  <div className="text-[11px] text-neutral-300 text-right mb-1.5">카드를 탭하면 항목별 상세를 먼저 볼 수 있어요</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {categoryItems.map((item) => (
                      <ScoreCard key={item.key} item={item} active={scoreTab === item.key} onClick={() => setScoreTab(scoreTab === item.key ? 'all' : item.key)} />
                    ))}
                  </div>

                  <div className="flex justify-end mb-3.5">
                    <button onClick={() => setScoreTab('all')} className={`px-3.5 py-1.5 rounded-full text-[12px] cursor-pointer transition-all ${scoreTab === 'all' ? 'bg-nature-500 text-white border border-nature-500' : 'bg-white text-neutral-400 border border-cream-500 hover:border-neutral-400'}`}>전체 보기</button>
                  </div>

                  <OverviewChart analytics={analytics} selectedKey={selectedKey} days={periodDays} />

                  {scoreTab === 'all' && (
                    <div className="mb-4 space-y-2">
                      <InsightCard icon="⚠️" title="지금 가장 먼저 볼 신호" text={riskFactors[0] || '아직 뚜렷한 위험 신호는 없습니다.'} />
                      <InsightCard icon="✅" title="잘 유지되고 있는 패턴" text={positiveFactors[0] || '기록이 더 쌓이면 강점을 더 정확히 찾을 수 있어요.'} />
                      <InsightCard icon="💡" title="가장 바로 실행할 액션" text={recommendedActions[0] || '기본 생활습관 관리 유지'} />
                    </div>
                  )}

                  <div className="border-t-2 border-cream-400 my-7"></div>
                  <div className="text-[16px] font-semibold text-nature-900 mb-1.5">항목별 상세</div>
                  <div className="text-[11px] text-neutral-400 mb-5">{getPeriodLabel(periodDays)} 기록과 이전 같은 기간 비교를 함께 보여줍니다.</div>

                  {orderedSections.map((key) => {
                    const section = sectionMap[key];
                    return (
                      <div key={key} className={scoreTab === key ? 'mb-6 border-2 border-nature-500 rounded-xl p-4 bg-cream-300/20' : 'mb-6'}>
                        <div className="text-[14px] font-semibold text-nature-900 mb-3">{section.title}</div>
                        <div className="bg-cream-300 rounded-lg p-3.5 mb-3.5">
                          <div className="text-[11px] font-medium text-neutral-400 tracking-wider mb-1.5">해석</div>
                          <div className="text-[14px] text-nature-900 leading-[1.6]">{section.insight}</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3.5">
                          {section.metrics.map((metric) => (
                            <MetricCard key={`${key}-${metric.title}`} title={metric.title} value={metric.value} suffix={metric.suffix || ''} caption={metric.caption} />
                          ))}
                        </div>
                        {section.chart}
                      </div>
                    );
                  })}

                  <div className="text-[11px] text-neutral-300 text-center mt-3">
                    모델 트랙: {risk.model_track === 'diabetic_track' ? '당뇨형' : '비당뇨형'} / {risk.disclaimer}
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

function InsightCard({ icon, title, text }) {
  return (
    <div className="border border-cream-500 rounded-[10px] p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[14px] shrink-0">{icon}</div>
        <div>
          <div className="text-[13px] font-medium text-nature-900">{title}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">{text}</div>
        </div>
      </div>
    </div>
  );
}
