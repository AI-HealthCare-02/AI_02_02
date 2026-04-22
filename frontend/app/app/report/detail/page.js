'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, BarChart3, Droplets, Moon, TrendingDown, TrendingUp, UtensilsCrossed } from 'lucide-react';

import { api } from '../../../../hooks/useApi';

const PERIOD_OPTIONS = [
  { value: 7,  label: '7일'  },
  { value: 30, label: '30일' },
];

const CATEGORY_META = {
  sleep:     { label: '수면',   icon: Moon,            color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-500',  goal: '7h'    },
  diet:      { label: '식습관', icon: UtensilsCrossed, color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-500',   goal: '70점'  },
  exercise:  { label: '운동',   icon: Activity,        color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-500', goal: '주 3회' },
  hydration: { label: '수분',   icon: Droplets,        color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-500',    goal: '1.2L'  },
};

const REFERENCE_LINES = {
  sleep:     { value: 7,   label: '기준 7h'    },
  diet:      { value: 70,  label: '기준 70점'  },
  exercise:  { value: 21,  label: '기준 21분'  },
  hydration: { value: 1.2, label: '기준 1.2L' },
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 170;
const CHART_LEFT = 40;
const CHART_RIGHT = 16;
const CHART_TOP = 14;
const CHART_BOTTOM = 28;
const CHART_RIGHT_X = CHART_WIDTH - CHART_RIGHT;
const CHART_BASE_Y = CHART_HEIGHT - CHART_BOTTOM;
const TOOLTIP_WIDTH = 138;
const TOOLTIP_HEIGHT = 54;
const TOOLTIP_OFFSET = 10;
const REFERENCE_LINE_COLOR = 'color-mix(in srgb, var(--color-text) 52%, #ef4444 48%)';

const SLEEP_HOURS = {
  under_5: 4.5, between_5_6: 5.5, between_6_7: 6.5, between_7_8: 7.5, over_8: 8.5,
};

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function getLastNDates(days) {
  const today = new Date();
  return Array.from({ length: days }, (_, offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - offset));
    return d.toISOString().slice(0, 10);
  });
}

function formatDateLabel(value) {
  if (!value) return '';
  const [, month, day] = String(value).split('-');
  return `${month}.${day}`;
}

function scoreDiet(log) {
  let score = 0, hasAny = false;
  if (log.vegetable_intake_level) { hasAny = true; score += log.vegetable_intake_level === 'enough' ? 35 : 20; }
  if (log.meal_balance_level)     { hasAny = true; score += log.meal_balance_level === 'balanced' ? 35 : log.meal_balance_level === 'protein_veg_heavy' ? 25 : 10; }
  if (log.sweetdrink_level)       { hasAny = true; score += log.sweetdrink_level === 'none' ? 15 : 8; }
  if (log.nightsnack_level)       { hasAny = true; score += log.nightsnack_level === 'none' ? 15 : 8; }
  return hasAny ? score : null;
}

function buildSeries(logs, category) {
  if (category === 'sleep')     return logs.map((l) => SLEEP_HOURS[l.sleep_duration_bucket] ?? null);
  if (category === 'diet')      return logs.map((l) => scoreDiet(l));
  if (category === 'exercise')  return logs.map((l) => (l.exercise_done || (l.exercise_minutes || 0) > 0 ? (l.exercise_minutes || 30) : 0));
  if (category === 'hydration') return logs.map((l) => (l.water_cups != null ? Number((l.water_cups * 0.2).toFixed(1)) : null));
  return [];
}

function maxSeriesValue(series) {
  const values = series.flat().filter((v) => v != null);
  return values.length ? Math.max(...values, 1) : 1;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function valueToChartY(value, maxValue, height = CHART_HEIGHT) {
  const safeMax = Math.max(maxValue || 1, 1);
  return height - CHART_BOTTOM - (value / safeMax) * (height - CHART_TOP - CHART_BOTTOM);
}

function getTooltipPosition(x, y) {
  const placeLeft = x + TOOLTIP_OFFSET + TOOLTIP_WIDTH > CHART_RIGHT_X;
  const tooltipX = placeLeft ? x - TOOLTIP_WIDTH - TOOLTIP_OFFSET : x + TOOLTIP_OFFSET;
  return {
    x: clamp(tooltipX, CHART_LEFT, CHART_RIGHT_X - TOOLTIP_WIDTH),
    y: clamp(y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET, CHART_TOP, CHART_BASE_Y - TOOLTIP_HEIGHT),
  };
}

function formatSeriesValue(category, value) {
  if (value == null) return '기록 없음';
  if (category === 'sleep') return `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}시간`;
  if (category === 'diet') return `${Math.round(value)}점`;
  if (category === 'exercise') return `${Math.round(value)}분`;
  if (category === 'hydration') return `${Number(value).toFixed(1)}L`;
  return String(value);
}

function seriesToPoints(series, maxValue, width = CHART_WIDTH, height = CHART_HEIGHT) {
  return series.map((value, i) => {
    const x = CHART_LEFT + i * ((width - CHART_LEFT - CHART_RIGHT) / Math.max(1, series.length - 1));
    if (value == null) return [x, null];
    return [x, valueToChartY(value, maxValue, height)];
  });
}

function buildSmoothPath(points) {
  const valid = points.filter(([, y]) => y != null);
  if (valid.length < 2) return '';
  let d = `M ${valid[0][0]},${valid[0][1]}`;
  for (let i = 1; i < valid.length; i++) {
    const [x0, y0] = valid[i - 1], [x1, y1] = valid[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

function buildAreaPath(points, baseY) {
  const valid = points.filter(([, y]) => y != null);
  if (valid.length < 2) return '';
  let d = `M ${valid[0][0]},${baseY} L ${valid[0][0]},${valid[0][1]}`;
  for (let i = 1; i < valid.length; i++) {
    const [x0, y0] = valid[i - 1], [x1, y1] = valid[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  d += ` L ${valid.at(-1)[0]},${baseY} Z`;
  return d;
}

function buildPrevPolyline(points) {
  return points.filter(([, y]) => y != null).map(([x, y]) => `${x},${y}`).join(' ');
}

function categoryInterpretation(meta, item) {
  if (!item || item.delta_pct == null) return `${meta.label} 기록이 아직 충분하지 않아요.`;
  if (item.delta_pct > 0)  return `이전 기간보다 ${item.delta_pct}% 올랐어요.`;
  if (item.delta_pct < 0)  return `이전 기간보다 ${Math.abs(item.delta_pct)}% 낮아졌어요.`;
  return '이전 기간과 비슷하게 유지되고 있어요.';
}

// ── 탭 ───────────────────────────────────────────────────────────────────────

function ReportTabs() {
  return (
    <div className="border-b border-black/[.06]">
      <div className="mx-auto flex max-w-[1080px] gap-1 px-6">
        <Link
          href="/app/report"
          className="inline-flex cursor-pointer items-center border-b-2 border-transparent px-5 py-3 text-[14px] font-semibold text-neutral-500 transition-colors hover:text-nature-800"
        >
          대시보드
        </Link>
        <div className="inline-flex items-center border-b-2 border-nature-500 px-5 py-3 text-[14px] font-semibold text-nature-900">
          상세 리포트
        </div>
      </div>
    </div>
  );
}

// ── 기간 버튼 ─────────────────────────────────────────────────────────────────

function PeriodButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all ${
        active ? 'bg-stone-700 text-white shadow-sm' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
      }`}
    >
      {label}
    </button>
  );
}

// ── 영향 분석 타일 ─────────────────────────────────────────────────────────────

// ── 점수 상세 분석 (상세 리포트 전용) ─────────────────────────────────────────

const FINDRISC_DETAIL = {
  age:             { label: '나이',          desc: '나이가 높을수록 당뇨 위험이 올라가요.' },
  bmi:             { label: 'BMI (체중)',     desc: 'BMI 25 이상이면 위험도가 높아져요.' },
  waist:           { label: '허리둘레',       desc: '복부비만은 인슐린 저항성과 연관돼요.' },
  activity:        { label: '운동 부족',      desc: '주 4일 이상 운동하면 점수가 낮아져요.' },
  vegetable:       { label: '채소 섭취 부족', desc: '매일 채소를 충분히 먹으면 1점 줄어요.' },
  hypertension:    { label: '고혈압 이력',    desc: '고혈압 약 복용 이력이 반영돼요.' },
  glucose_history: { label: '고혈당 이력',    desc: '과거 고혈당 판정 이력이 반영돼요.' },
  family:          { label: '가족력',         desc: '부모·형제 중 당뇨 환자가 있으면 반영돼요.' },
};

const LIFESTYLE_DETAIL = [
  { key: 'sleep_score',     label: '수면',  icon: Moon,            color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600',  missingMsg: '수면 기록(수면 시간·질)을 추가하면 반영돼요.' },
  { key: 'diet_score',      label: '식사',  icon: UtensilsCrossed, color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600',   missingMsg: '채소 섭취·식사 균형·단음료·야식 기록이 필요해요.' },
  { key: 'exercise_score',  label: '운동',  icon: Activity,        color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', missingMsg: '운동 여부·시간·걷기 기록을 추가하면 반영돼요.' },
  { key: 'lifestyle_score', label: '종합',  icon: Droplets,        color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600',  missingMsg: null },
];

function getScoreTone(score) {
  if (score >= 70) return { bar: 'bg-emerald-400', label: '양호', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (score >= 40) return { bar: 'bg-amber-400',   label: '보통', text: 'text-amber-600',   bg: 'bg-amber-50' };
  return               { bar: 'bg-red-400',     label: '부족', text: 'text-red-500',     bg: 'bg-red-50' };
}

function DetailScoreSection({ risk }) {
  if (!risk) return null;

  const breakdown = risk.score_breakdown || {};
  const totalFindrisc = risk.findrisc_score ?? 0;
  const signals = risk.supporting_signals || [];

  const factors = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-4">
      {/* FINDRISC 세부 원인 */}
      {factors.length > 0 && (
        <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
          <div className="mb-1 text-[14px] font-semibold text-stone-800">
            생활습관 위험도 {totalFindrisc}점 — 항목별 원인
          </div>
          <div className="mb-4 text-[12px] text-stone-400">
            온보딩 설문 기반이에요. 생활습관을 바꾸면 점수가 낮아질 수 있어요.
          </div>
          <div className="space-y-4">
            {factors.map(([key, value]) => {
              const meta = FINDRISC_DETAIL[key];
              const pct = Math.round((value / Math.max(totalFindrisc, 1)) * 100);
              return (
                <div key={key}>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold text-stone-700">{meta?.label ?? key}</div>
                      <div className="text-[11px] text-stone-400">{meta?.desc}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-0.5 text-[12px] font-bold text-orange-500">
                      +{value}점
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-orange-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 생활습관 점수 상세 */}
      <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
        <div className="mb-1 text-[14px] font-semibold text-stone-800">생활습관 점수 상세</div>
        <div className="mb-4 text-[12px] text-stone-400">최근 7일 기록 기반이에요. 기록이 쌓일수록 정확해져요.</div>
        <div className="space-y-4">
          {LIFESTYLE_DETAIL.map((item) => {
            const Icon = item.icon;
            const score = risk[item.key] ?? 0;
            const sc = getScoreTone(score);
            const isEmpty = score === 0 && item.key !== 'lifestyle_score';
            return (
              <div key={item.key}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg}`}>
                      <Icon size={14} style={{ color: item.color }} />
                    </div>
                    <span className="text-[13px] font-semibold text-stone-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                    <span className="text-[15px] font-bold text-stone-800">{score}</span>
                    <span className="text-[11px] text-stone-400">/100</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${sc.bar}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                {isEmpty && item.missingMsg && (
                  <div className="mt-1.5 text-[11px] text-stone-400">{item.missingMsg}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* AI 신호 */}
      {signals.length > 0 && (
        <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
          <div className="mb-1 text-[14px] font-semibold text-stone-800">AI 모델이 감지한 신호</div>
          <div className="mb-3 text-[12px] text-stone-400">건강 프로필과 기록을 분석해 위험도에 반영된 항목이에요.</div>
          <div className="space-y-2">
            {signals.map((signal, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl bg-stone-50 px-3 py-2.5">
                <TrendingUp size={12} className="shrink-0 text-amber-400" />
                <span className="text-[13px] text-stone-600">{signal}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ImpactTile({ item, index }) {
  const styles = [
    { wrap: 'bg-stone-800 border-stone-700',  label: 'text-white',     sub: 'text-white/60',  bar: 'bg-white/25',  track: 'bg-white/10',  badge: 'bg-white/15 text-white',      rank: 'text-white/50' },
    { wrap: 'bg-white border-stone-200',      label: 'text-stone-800', sub: 'text-stone-400', bar: 'bg-stone-500', track: 'bg-stone-100', badge: 'bg-stone-100 text-stone-600', rank: 'text-stone-300' },
    { wrap: 'bg-white border-stone-100',      label: 'text-stone-700', sub: 'text-stone-400', bar: 'bg-stone-300', track: 'bg-stone-100', badge: 'bg-stone-50 text-stone-500',  rank: 'text-stone-200' },
  ];
  const s = styles[index] || styles[2];

  return (
    <div className={`rounded-2xl border p-4 ${s.wrap}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-widest ${s.rank}`}>#{index + 1} 우선순위</div>
          <div className={`mt-0.5 text-[15px] font-semibold ${s.label}`}>{item.label}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${s.badge}`}>
          {item.contribution_pct}%
        </span>
      </div>
      <div className={`mt-3 h-1.5 rounded-full ${s.track}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${s.bar}`} style={{ width: `${item.contribution_pct}%` }} />
      </div>
      <div className={`mt-2 text-[11px] ${s.sub}`}>
        현재 {item.current_score}점 · 목표 {item.target_score}점
      </div>
    </div>
  );
}

// ── 비교 카드 ─────────────────────────────────────────────────────────────────

function ComparisonCard({ item }) {
  const meta  = CATEGORY_META[item.key];
  const Icon  = meta?.icon;
  const delta = item.delta_pct;
  const isUp  = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;

  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.bg}`}>
            <Icon size={15} className={meta.text} />
          </div>
        )}
        <div className="text-[13px] font-semibold text-stone-700">{item.label}</div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div className="text-[22px] font-bold leading-none text-stone-800">{item.current_display}</div>
        {delta != null && (
          <div className={`flex items-center gap-0.5 text-[12px] font-semibold ${isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-stone-400'}`}>
            {isUp   && <TrendingUp size={12} />}
            {isDown && <TrendingDown size={12} />}
            {isUp ? '+' : ''}{delta}%
          </div>
        )}
      </div>
      <div className="mt-1 text-[11px] text-stone-400">이전 {item.previous_display}</div>
    </div>
  );
}

// ── 카테고리 차트 ─────────────────────────────────────────────────────────────

function CategoryChart({ category, currentLogs, previousLogs, comparison }) {
  const meta           = CATEGORY_META[category];
  const Icon           = meta.icon;
  const referenceLine  = REFERENCE_LINES[category];
  const [activeDatum, setActiveDatum] = useState(null);
  const currentSeries  = useMemo(() => buildSeries(currentLogs, category),  [currentLogs, category]);
  const previousSeries = useMemo(() => buildSeries(previousLogs, category), [previousLogs, category]);
  const labels         = useMemo(() => currentLogs.map((l) => formatDateLabel(l.log_date)), [currentLogs]);
  const maxValue       = useMemo(
    () => maxSeriesValue([currentSeries, previousSeries, referenceLine ? [referenceLine.value] : []]),
    [currentSeries, previousSeries, referenceLine],
  );
  const currentPoints  = useMemo(() => seriesToPoints(currentSeries, maxValue),  [currentSeries, maxValue]);
  const previousPoints = useMemo(() => seriesToPoints(previousSeries, maxValue), [previousSeries, maxValue]);
  const smoothPath     = useMemo(() => buildSmoothPath(currentPoints),  [currentPoints]);
  const areaPath       = useMemo(() => buildAreaPath(currentPoints, CHART_BASE_Y), [currentPoints]);
  const referenceY     = referenceLine ? valueToChartY(referenceLine.value, maxValue) : null;
  const referenceLabelY = referenceY == null ? null : Math.max(CHART_TOP + 4, referenceY - 6);
  const showReferenceLabel = labels.length <= 10;
  const gradId         = `grad-${category}`;
  const chartTitleId   = `chart-title-${category}`;
  const chartDescId    = `chart-desc-${category}`;
  const tooltipId      = `chart-tooltip-${category}`;
  const referenceValue = referenceLine ? formatSeriesValue(category, referenceLine.value) : '';
  const activeTooltip  = activeDatum ? getTooltipPosition(activeDatum.x, activeDatum.y) : null;

  const delta   = comparison?.delta_pct;
  const isUp    = (delta ?? 0) > 0;
  const isDown  = (delta ?? 0) < 0;

  useEffect(() => {
    setActiveDatum(null);
  }, [category, currentLogs]);

  function showDatum(index) {
    const value = currentSeries[index];
    const point = currentPoints[index];
    if (value == null || !point || point[1] == null) {
      setActiveDatum(null);
      return;
    }
    setActiveDatum({
      index,
      x: point[0],
      y: point[1],
      label: labels[index] || '',
      value,
      valueLabel: formatSeriesValue(category, value),
    });
  }

  function datumAriaLabel(index) {
    const label = labels[index] || '';
    const value = formatSeriesValue(category, currentSeries[index]);
    return `${label} ${meta.label} 현재 값 ${value}. 비교 기준 ${referenceValue}`;
  }

  return (
    <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.bg}`}>
            <Icon size={16} className={meta.text} />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-stone-800">{meta.label}</div>
            <div className="text-[11px] text-stone-400">목표 {meta.goal}</div>
          </div>
        </div>
        {delta != null && (
          <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold ${
            isUp ? 'bg-emerald-50 text-emerald-600' : isDown ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-500'
          }`}>
            {isUp   && <TrendingUp size={12} />}
            {isDown && <TrendingDown size={12} />}
            {isUp ? '+' : ''}{delta}%
          </div>
        )}
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="group"
        aria-labelledby={`${chartTitleId} ${chartDescId}`}
        style={{ display: 'block' }}
      >
        <title id={chartTitleId}>{meta.label} 추이 그래프</title>
        <desc id={chartDescId}>
          현재 값, 이전 기간, 비교 기준선을 함께 표시합니다. 데이터 포인트에 포커스하거나 마우스를 올리면 현재 값을 확인할 수 있습니다.
        </desc>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={meta.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <line x1={CHART_LEFT} y1={CHART_BASE_Y} x2={CHART_RIGHT_X} y2={CHART_BASE_Y} stroke="#e7e5e4" />
        <line x1={CHART_LEFT} y1="88"  x2={CHART_RIGHT_X} y2="88"  stroke="#f5f5f4" strokeDasharray="4 4" />
        <line x1={CHART_LEFT} y1="34"  x2={CHART_RIGHT_X} y2="34"  stroke="#f5f5f4" strokeDasharray="4 4" />

        {referenceLine && referenceY != null && (
          <g aria-hidden="true">
            <line
              x1={CHART_LEFT}
              y1={referenceY}
              x2={CHART_RIGHT_X}
              y2={referenceY}
              stroke={REFERENCE_LINE_COLOR}
              strokeOpacity="0.72"
              strokeWidth="1.25"
              strokeDasharray="10 7"
              strokeLinecap="round"
            />
            {showReferenceLabel && (
              <text
                x={CHART_RIGHT_X - 4}
                y={referenceLabelY}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill={REFERENCE_LINE_COLOR}
              >
                {referenceLine.label}
              </text>
            )}
          </g>
        )}

        <polyline
          points={buildPrevPolyline(previousPoints)}
          fill="none"
          stroke="#d6d3d1"
          strokeWidth="1.8"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {category === 'exercise' ? (
          currentSeries.map((value, i) => {
            if (value == null) return null;
            const x = currentPoints[i]?.[0] ?? 0;
            const y = currentPoints[i]?.[1] ?? CHART_BASE_Y;
            const barHeight = Math.max(0, CHART_BASE_Y - y);
            const hitHeight = Math.max(36, barHeight);
            const hitY = CHART_BASE_Y - hitHeight;
            return (
              <g
                key={`bar-${i}`}
                role="img"
                tabIndex={0}
                aria-label={datumAriaLabel(i)}
                aria-describedby={activeDatum?.index === i ? tooltipId : undefined}
                onPointerEnter={() => showDatum(i)}
                onPointerMove={() => showDatum(i)}
                onPointerLeave={() => setActiveDatum(null)}
                onFocus={() => showDatum(i)}
                onBlur={() => setActiveDatum(null)}
              >
                <rect x={x - 7} y={y} width="14" height={barHeight} rx="4" fill={meta.color} opacity="0.8" />
                <rect x={x - 12} y={hitY} width="24" height={hitHeight} rx="6" fill="transparent" pointerEvents="all" />
              </g>
            );
          })
        ) : (
          <>
            {areaPath   && <path d={areaPath}   fill={`url(#${gradId})`} />}
            {smoothPath && <path d={smoothPath} fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {currentPoints.map(([x, y], i) =>
              y == null ? null : (
                <g
                  key={`pt-${i}`}
                  role="img"
                  tabIndex={0}
                  aria-label={datumAriaLabel(i)}
                  aria-describedby={activeDatum?.index === i ? tooltipId : undefined}
                  onPointerEnter={() => showDatum(i)}
                  onPointerMove={() => showDatum(i)}
                  onPointerLeave={() => setActiveDatum(null)}
                  onFocus={() => showDatum(i)}
                  onBlur={() => setActiveDatum(null)}
                >
                  <circle cx={x} cy={y} r="14" fill="transparent" pointerEvents="all" />
                  {i === currentPoints.length - 1 && <circle cx={x} cy={y} r="12" fill={meta.color} opacity="0.1" />}
                  <circle cx={x} cy={y} r="4" fill="white" stroke={meta.color} strokeWidth="2.5" />
                </g>
              )
            )}
          </>
        )}

        {labels.map((label, i) => (
          <text key={`lbl-${i}`} x={currentPoints[i]?.[0] ?? 40} y="162" textAnchor="middle" fontSize="10" fill="#a8a29e">
            {i % Math.max(1, Math.ceil(labels.length / 6)) === 0 || i === labels.length - 1 ? label : ''}
          </text>
        ))}

        {activeTooltip && activeDatum && (
          <g id={tooltipId} role="tooltip" pointerEvents="none">
            <rect
              x={activeTooltip.x}
              y={activeTooltip.y}
              width={TOOLTIP_WIDTH}
              height={TOOLTIP_HEIGHT}
              rx="8"
              fill="var(--color-surface)"
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <rect x={activeTooltip.x + 9} y={activeTooltip.y + 10} width="3" height="34" rx="1.5" fill={meta.color} />
            <text x={activeTooltip.x + 20} y={activeTooltip.y + 18} fontSize="10" fontWeight="600" fill="var(--color-text-muted)">
              {activeDatum.label}
            </text>
            <text x={activeTooltip.x + 20} y={activeTooltip.y + 34} fontSize="12" fontWeight="700" fill="var(--color-text)">
              현재 값: {activeDatum.valueLabel}
            </text>
            <text x={activeTooltip.x + 20} y={activeTooltip.y + 48} fontSize="10" fontWeight="600" fill="var(--color-text-muted)">
              비교 기준: {referenceValue}
            </text>
          </g>
        )}
      </svg>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-4 text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: meta.color }} />
            현재 값
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-stone-300" />
            이전 기간
          </div>
          {referenceLine && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 border-t border-dashed"
                style={{ borderTopColor: REFERENCE_LINE_COLOR, opacity: 0.72 }}
              />
              비교 기준
            </div>
          )}
        </div>
        <div className="text-[12px] text-stone-500">
          {categoryInterpretation(meta, comparison)}
        </div>
      </div>
    </section>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

const DETAIL_CACHE_PREFIX = 'danaa:report:detail:v1';
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

function detailCacheKey(userId, periodDays) {
  return userId == null ? null : `${DETAIL_CACHE_PREFIX}:u${userId}:${periodDays}`;
}

function readDetailCache(cacheKey) {
  if (typeof window === 'undefined' || !cacheKey) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > DETAIL_CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeDetailCache(cacheKey, payload) {
  if (typeof window === 'undefined' || !cacheKey) return;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload }));
  } catch {
    // ignore
  }
}

function clearDetailCaches() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`${DETAIL_CACHE_PREFIX}:`))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export default function ReportDetailPage() {
  const [periodDays, setPeriodDays] = useState(7);
  const [status,  setStatus]  = useState(null);
  const [summary, setSummary] = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [loaded,  setLoaded]  = useState(false);
  const [risk,    setRisk]    = useState(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');

      // user_id가 확인된 경우에만 사용자별 상세 캐시를 사용한다.
      // 확인 실패 시 캐시를 건너뛰어 계정 전환 간 데이터 노출을 막는다.
      let currentUserId = null;
      try {
        const userRes = await api('/api/v1/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          currentUserId = userData?.id ?? null;
        }
      } catch {
        currentUserId = null;
      }
      const cacheKey = detailCacheKey(currentUserId, periodDays);

      const cached = readDetailCache(cacheKey);
      if (cached) {
        setStatus(cached.status);
        setSummary(cached.summary);
        setLogs(cached.logs || []);
        setLoaded(true);
      } else {
        setLoaded(false);
      }

      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
        const statusData = await statusRes.json();
        if (cancelled) return;
        setStatus(statusData);

        if (statusData.is_completed) {
          const dates = getLastNDates(periodDays * 2);
          const [summaryRes, riskRes, ...dailyResponses] = await Promise.allSettled([
            api(`/api/v1/analysis/summary?period=${periodDays}`),
            api('/api/v1/risk/current'),
            ...dates.map((date) => api(`/api/v1/health/daily/${date}`)),
          ]);
          if (cancelled) return;
          const summaryData = summaryRes.status === 'fulfilled' && summaryRes.value.ok ? await summaryRes.value.json() : null;
          setSummary(summaryData);
          const dailyLogs = await Promise.all(
            dailyResponses.map(async (res, i) => {
              if (res.status !== 'fulfilled' || !res.value.ok) return { log_date: dates[i] };
              return res.value.json();
            }),
          );
          if (cancelled) return;
          setLogs(dailyLogs);
          writeDetailCache(cacheKey, { status: statusData, summary: summaryData, logs: dailyLogs });
          if (summaryRes.status === 'rejected' || !summaryRes.value?.ok) setError('일부 데이터를 불러오지 못했어요.');
        } else {
          writeDetailCache(cacheKey, { status: statusData, summary: null, logs: [] });
        }
      } catch (err) {
        console.error('report_detail_load_failed', err);
        if (!cancelled) {
          setError('상세 리포트를 불러오지 못했어요.');
          setSummary(null); setLogs([]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  // 건강 기록 저장 이벤트로 상세 캐시도 무효화
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => clearDetailCaches();
    window.addEventListener('danaa:report-cache-refresh', handler);
    return () => window.removeEventListener('danaa:report-cache-refresh', handler);
  }, []);

  const hasOnboarding = Boolean(status?.is_completed);
  const currentLogs   = useMemo(() => logs.slice(-periodDays),                  [logs, periodDays]);
  const previousLogs  = useMemo(() => logs.slice(-periodDays * 2, -periodDays), [logs, periodDays]);
  const comparisonMap = useMemo(
    () => Object.fromEntries((summary?.comparisons || []).map((item) => [item.key, item])),
    [summary],
  );
  const hasData = useMemo(
    () => currentLogs.some((l) => l.sleep_duration_bucket || l.vegetable_intake_level || l.exercise_done != null || l.water_cups != null),
    [currentLogs],
  );

  return (
    <div className="theme-report-page flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[#F5F5F4] bg-white px-4">
        <span className="text-[14px] font-medium text-nature-900">리포트</span>
      </header>
      <ReportTabs />

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="mx-auto max-w-[1080px] space-y-4">

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-500">{error}</div>
          )}

          {/* 헤더 */}
          <section className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white px-6 py-4 shadow-sm">
            <div>
              <div className="text-[17px] font-semibold text-stone-800">건강 데이터 분석</div>
              <div className="text-[12px] text-stone-400">기간별 변화와 영향 요인을 확인하세요</div>
            </div>
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <PeriodButton key={opt.value} active={periodDays === opt.value} label={opt.label} onClick={() => setPeriodDays(opt.value)} />
              ))}
            </div>
          </section>

          {/* 온보딩 미완료 */}
          {loaded && !hasOnboarding && (
            <section className="rounded-2xl border border-stone-100 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
                <BarChart3 size={22} className="text-stone-400" />
              </div>
              <div className="mt-4 text-[20px] font-semibold text-stone-800">온보딩을 먼저 완료해주세요</div>
              <div className="mt-2 text-[13px] text-stone-400">온보딩 완료 후 건강 데이터 분석이 활성화돼요.</div>
              <Link href="/onboarding/diabetes" className="mt-5 inline-flex rounded-full bg-stone-800 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-stone-700">
                설문 시작하기
              </Link>
            </section>
          )}

          {/* 데이터 없음 */}
          {loaded && hasOnboarding && !hasData && (
            <section className="rounded-2xl border border-stone-100 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
                <BarChart3 size={22} className="text-stone-400" />
              </div>
              <div className="mt-4 text-[20px] font-semibold text-stone-800">기록이 더 필요해요</div>
              <div className="mt-2 text-[13px] text-stone-400">기록이 쌓이면 기간 비교와 영향 분석을 보여드릴게요.</div>
            </section>
          )}

          {loaded && hasOnboarding && hasData && summary && (
            <>
              <DetailScoreSection risk={risk} />

              {/* 핵심 요약 + 영향 분석 */}
              <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="flex flex-col gap-3 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
                  <div className="text-[12px] font-semibold uppercase tracking-widest text-stone-400">이번 기간 핵심</div>
                  <p className="text-[16px] font-semibold leading-relaxed text-stone-800">
                    {summary.summary_message}
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(summary.comparisons || []).map((item) => (
                      <ComparisonCard key={item.key} item={item} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
                  <div className="text-[12px] font-semibold uppercase tracking-widest text-stone-400">지금 가장 중요한 것</div>
                  <p className="text-[13px] text-stone-500">위험도에 영향을 주는 항목 순위예요.</p>
                  <div className="flex flex-col gap-2">
                    {(summary.impact_analysis || []).map((item, i) => (
                      <ImpactTile key={item.key} item={item} index={i} />
                    ))}
                  </div>
                </div>
              </section>

              {/* 카테고리별 차트 */}
              <section className="space-y-4">
                <div className="text-[15px] font-semibold text-stone-700">항목별 상세 추이</div>
                {Object.keys(CATEGORY_META).map((category) => (
                  <CategoryChart
                    key={category}
                    category={category}
                    currentLogs={currentLogs}
                    previousLogs={previousLogs}
                    comparison={comparisonMap[category]}
                  />
                ))}
              </section>
            </>
          )}

          {/* 로딩 */}
          {!loaded && (
            <div className="animate-pulse space-y-4">
              <div className="h-16 rounded-2xl bg-stone-100" />
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="h-64 rounded-2xl bg-stone-100" />
                <div className="h-64 rounded-2xl bg-stone-100" />
              </div>
              {[...Array(4)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-stone-100" />)}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
