'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Droplets,
  Leaf,
  Moon,
  RefreshCw,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import { api } from '@/hooks/useApi';

const SLEEP_HOURS = {
  under_5: 4.5,
  between_5_6: 5.5,
  between_6_7: 6.5,
  between_7_8: 7.5,
  over_8: 8.5,
};

const THEME = {
  page: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  surfaceSoft: 'var(--color-card-surface-subtle)',
  border: 'var(--color-border)',
  text: 'var(--color-text)',
  muted: 'var(--color-text-secondary)',
  hint: 'var(--color-text-hint)',
};

const RANGE_PRESETS = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: 'custom', label: '직접 선택' },
];

const CATEGORY_CONFIG = {
  sleep: {
    key: 'sleep',
    label: '수면',
    icon: Moon,
    scoreKey: 'sleep_score',
    color: '#6366F1',
    yTicks: [0, 2, 4, 6, 8],
    yMax: 8,
    formatValue: (value) => (value != null ? `${value}시간` : '-'),
    summary: (avg) => {
      if (avg == null) return '수면 기록이 아직 충분하지 않아요.';
      if (avg >= 7) return '수면 시간이 비교적 안정적으로 유지되고 있어요.';
      if (avg >= 6) return '수면 시간이 약간 부족한 편이에요.';
      return '수면 시간이 전반적으로 부족해 보여요.';
    },
    problems: (score, avg) => {
      if (avg != null && avg < 6) return ['최근 평균 수면이 6시간 미만이에요.', '수면 부족은 혈당 조절과 피로도에 직접 영향을 줄 수 있어요.'];
      if (avg != null && avg < 7) return ['목표 수면 시간 7시간에 아직 못 미치고 있어요.', '취침 시간이 일정하지 않다면 점수가 흔들릴 수 있어요.'];
      if (score != null && score < 70) return ['수면 패턴이 아직 안정적이지 않아요.'];
      return ['수면 상태는 비교적 안정적이에요.'];
    },
    actions: ['취침 시간을 일정하게 맞추기', '잠들기 1시간 전 화면 사용 줄이기', '주 7일 기준 수면 기록 남기기'],
  },
  exercise: {
    key: 'exercise',
    label: '운동',
    icon: Activity,
    scoreKey: 'exercise_score',
    color: '#10B981',
    yTicks: [0, 15, 30, 45, 60],
    yMax: 60,
    formatValue: (value) => (value != null ? `${Math.round(value)}분` : '-'),
    summary: (avg) => {
      if (avg == null) return '운동 기록이 아직 충분하지 않아요.';
      if (avg >= 30) return '운동 시간이 비교적 잘 유지되고 있어요.';
      if (avg > 0) return '운동 기록은 있지만 조금 더 늘릴 수 있어요.';
      return '운동 기록이 거의 없어요.';
    },
    problems: (score, avg) => {
      if (avg == null || avg === 0) return ['최근 운동 기록이 거의 없어요.', '활동량 부족은 체중과 혈당 관리에 영향을 줄 수 있어요.'];
      if (avg < 30) return ['평균 운동 시간이 30분보다 적어요.', '짧게라도 꾸준히 움직이는 패턴이 필요해요.'];
      if (score != null && score < 70) return ['운동 점수가 아직 안정권까지 올라오지 않았어요.'];
      return ['운동 기록은 비교적 잘 유지되고 있어요.'];
    },
    actions: ['하루 30분 걷기 목표 세우기', '짧은 산책 10분이라도 기록 남기기', '주 5일 기준 운동 리듬 만들기'],
  },
  diet: {
    key: 'diet',
    label: '식습관',
    icon: UtensilsCrossed,
    scoreKey: 'diet_score',
    color: '#F59E0B',
    yTicks: [0, 25, 50, 75, 100],
    yMax: 100,
    formatValue: (value) => (value != null ? `${Math.round(value)}점` : '-'),
    summary: (avg) => {
      if (avg == null) return '식사 기록이 아직 충분하지 않아요.';
      if (avg >= 70) return '식사 균형이 비교적 잘 유지되고 있어요.';
      if (avg >= 40) return '식사 패턴은 보통이지만 개선 여지가 있어요.';
      return '식사 패턴 보완이 필요한 상태예요.';
    },
    problems: (score) => {
      if (score != null && score < 40) return ['식사 균형 점수가 낮은 편이에요.', '단 음료나 야식, 식사 구성 불균형이 영향을 줄 수 있어요.'];
      if (score != null && score < 70) return ['식사 패턴이 조금 흔들리고 있어요.', '한 끼만이라도 균형 있게 구성하면 도움이 돼요.'];
      return ['식사 패턴은 비교적 안정적이에요.'];
    },
    actions: ['채소와 단백질을 함께 챙기기', '야식과 단 음료 섭취 줄이기', '식사 기록을 빠짐없이 남기기'],
  },
};

function getTodayISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function shiftDate(baseISO, diffDays) {
  const [year, month, day] = String(baseISO || '').split('-').map(Number);
  if (!year || !month || !day) return baseISO;
  const date = new Date(Date.UTC(year, month - 1, day + diffDays));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function buildDateList(startDate, endDate) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = shiftDate(current, 1);
  }
  return dates;
}

function makePresetRange(presetKey) {
  const today = getTodayISO();
  const preset = RANGE_PRESETS.find((item) => item.key === presetKey);
  const days = preset?.days ?? 7;
  return {
    preset: presetKey,
    startDate: shiftDate(today, -(days - 1)),
    endDate: today,
  };
}

function scoreDiet(log) {
  let score = 0;
  let hasAny = false;
  if (log.vegetable_intake_level) {
    score += log.vegetable_intake_level === 'enough' ? 35 : 20;
    hasAny = true;
  }
  if (log.meal_balance_level) {
    score += log.meal_balance_level === 'balanced' ? 35 : log.meal_balance_level === 'protein_veg_heavy' ? 25 : 10;
    hasAny = true;
  }
  if (log.sweetdrink_level) {
    score += log.sweetdrink_level === 'none' ? 15 : 8;
    hasAny = true;
  }
  if (log.nightsnack_level) {
    score += log.nightsnack_level === 'none' ? 15 : 8;
    hasAny = true;
  }
  if (!hasAny) {
    const mealValues = [log.breakfast_status, log.lunch_status, log.dinner_status];
    if (mealValues.some(Boolean)) {
      const eatenMeals = mealValues.filter((value) => value && value !== 'skipped').length;
      return Math.round((eatenMeals / mealValues.length) * 100);
    }
  }
  return hasAny ? score : null;
}

function buildSeries(logs, categoryKey) {
  if (categoryKey === 'sleep') return logs.map((log) => SLEEP_HOURS[log.sleep_duration_bucket] ?? null);
  if (categoryKey === 'diet') return logs.map((log) => scoreDiet(log));
  if (categoryKey === 'exercise') {
    return logs.map((log) => (log.exercise_done || (log.exercise_minutes || 0) > 0 ? (log.exercise_minutes || 30) : 0));
  }
  return [];
}

function average(values) {
  const valid = values.filter((value) => value != null);
  if (!valid.length) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

function dailyScore(log) {
  const values = [];
  const sleepHours = SLEEP_HOURS[log.sleep_duration_bucket];
  if (sleepHours != null) values.push(Math.min(100, Math.round((sleepHours / 8) * 100)));
  const dietScore = scoreDiet(log);
  if (dietScore != null) values.push(dietScore);
  if (log.exercise_done !== undefined || log.exercise_minutes !== undefined) {
    const didExercise = log.exercise_done || (log.exercise_minutes || 0) > 0;
    values.push(didExercise ? Math.min(100, Math.round(((log.exercise_minutes || 30) / 60) * 100)) : 0);
  }
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function formatDateLabel(date) {
  if (!date) return '-';
  return date.slice(5).replace('-', '.');
}

function formatXAxisLabel(date, index, total, spanDays) {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);

  if (spanDays <= 14) return formatDateLabel(date);
  if (index === 0 || index === total - 1) {
    if (spanDays > 365) return `${year}.${String(month).padStart(2, '0')}`;
    if (spanDays > 45) return `${month}월`;
    return formatDateLabel(date);
  }
  if (spanDays <= 45) {
    const stride = Math.max(2, Math.ceil(total / 6));
    return index % stride === 0 ? formatDateLabel(date) : '';
  }
  if (spanDays <= 365) {
    return day === 1 ? `${month}월` : '';
  }
  if (spanDays <= 1095) {
    return day === 1 && [1, 4, 7, 10].includes(month)
      ? `${year}.${String(month).padStart(2, '0')}`
      : '';
  }
  return month === 1 && day === 1 ? `${year}` : '';
}

function rangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return '-';
  return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
}

function scoreTone(score) {
  if (score == null) return { label: '기록 부족', color: '#94A3B8', bg: 'rgba(148,163,184,0.16)' };
  if (score >= 70) return { label: '양호', color: '#10B981', bg: 'rgba(16,185,129,0.14)' };
  if (score >= 40) return { label: '주의', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)' };
  return { label: '관리 필요', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' };
}

function predictionTone(score) {
  if (score == null) return { label: '미측정', color: '#94A3B8', bg: 'rgba(148,163,184,0.16)' };
  if (score < 40) return { label: '낮음', color: '#10B981', bg: 'rgba(16,185,129,0.14)' };
  if (score < 70) return { label: '보통', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)' };
  return { label: '높음', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' };
}

function SurfaceCard({ className = '', children }) {
  return (
    <div className={className} style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
      {children}
    </div>
  );
}

function ReportTabs() {
  return (
    <div className="shrink-0 border-b bg-white theme-report-page" style={{ borderColor: THEME.border }}>
      <div className="mx-auto flex w-full max-w-[1260px] gap-0 px-5">
        <Link href="/app/report" className="inline-flex items-center border-b-2 border-transparent px-5 py-3 text-[14px] font-semibold transition-colors" style={{ color: THEME.muted }}>
          대시보드
        </Link>
        <div className="inline-flex items-center border-b-2 px-5 py-3 text-[14px] font-semibold" style={{ borderColor: '#2563EB', color: THEME.text }}>
          상세 리포트
        </div>
      </div>
    </div>
  );
}

function SummaryHeader({ risk }) {
  const prediction = risk?.predicted_score_pct ?? null;
  const findrisc = risk?.findrisc_score ?? null;
  const tone = predictionTone(prediction);
  const issues = [];
  if ((risk?.exercise_score ?? 100) < 70) issues.push('운동 점수');
  if ((risk?.sleep_score ?? 100) < 70) issues.push('수면 점수');
  if ((risk?.diet_score ?? 100) < 70) issues.push('식습관 점수');
  const summary = issues.length > 0
    ? `${issues.slice(0, 2).join(', ')}가 낮아 최근 생활 습관 보완이 필요해 보여요.`
    : '최근 생활 습관 점수는 전반적으로 안정적인 흐름이에요.';

  return (
    <SurfaceCard className="rounded-3xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="relative h-[76px] w-[76px] shrink-0">
            <svg className="-rotate-90" width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r="29" fill="none" stroke="rgba(148,163,184,0.20)" strokeWidth="8" />
              <circle
                cx="38"
                cy="38"
                r="29"
                fill="none"
                stroke={tone.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(Math.max(0, Math.min(100, prediction ?? 0)) / 100) * Math.PI * 58} ${Math.PI * 58}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[18px] font-extrabold" style={{ color: tone.color }}>
              {prediction ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: THEME.hint }}>예측 위험도</div>
            <div className="mt-1 text-[24px] font-extrabold" style={{ color: THEME.text }}>{prediction != null ? `${prediction}%` : '-'}</div>
            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: tone.color, backgroundColor: tone.bg }}>{tone.label}</span>
          </div>
        </div>

        <div className="hidden h-12 w-px sm:block" style={{ background: THEME.border }} />

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: THEME.hint }}>당뇨 위험도 (FINDRISC)</div>
          <div className="mt-1 text-[24px] font-extrabold" style={{ color: THEME.text }}>
            {findrisc != null ? `${findrisc}점` : '-'}
            <span className="ml-1 text-[13px] font-normal" style={{ color: THEME.hint }}>/ 26</span>
          </div>
          <div className="text-[12px]" style={{ color: THEME.muted }}>
            {findrisc != null ? (findrisc <= 7 ? '낮은 편' : findrisc <= 14 ? '보통 수준' : '주의 필요') : '미측정'}
          </div>
        </div>

        <div className="hidden h-12 w-px sm:block" style={{ background: THEME.border }} />

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: THEME.hint }}>요약 의견</div>
          <div className="mt-1 text-[15px] font-semibold leading-snug" style={{ color: THEME.text }}>{summary}</div>
          {issues.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {issues.map((issue) => (
                <span key={issue} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB' }}>
                  {issue}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

function HealthCard({ categoryKey, risk, logs, rangeText, onOpen }) {
  const cfg = CATEGORY_CONFIG[categoryKey];
  const Icon = cfg.icon;
  const score = risk?.[cfg.scoreKey] ?? null;
  const series = buildSeries(logs, categoryKey);
  const avg = average(series);
  const tone = scoreTone(score);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-3xl p-5 text-left transition-transform hover:-translate-y-0.5"
      style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${cfg.color}16` }}>
            <Icon size={18} style={{ color: cfg.color }} />
          </div>
          <div>
            <div className="text-[15px] font-bold" style={{ color: THEME.text }}>{cfg.label}</div>
            <div className="text-[12px]" style={{ color: THEME.muted }}>{cfg.summary(avg)}</div>
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: tone.color, background: tone.bg }}>
          {tone.label}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-[28px] font-extrabold" style={{ color: cfg.color }}>{cfg.formatValue(avg)}</span>
        <span className="pb-1 text-[11px]" style={{ color: THEME.hint }}>{rangeText} 평균</span>
      </div>

      <div className="mt-3 h-2 rounded-full" style={{ background: 'rgba(148,163,184,0.18)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, score ?? 0))}%`, background: cfg.color }} />
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 text-[12px] font-semibold" style={{ color: '#2563EB' }}>
        상세 보기 <ChevronRight size={14} />
      </div>
    </button>
  );
}

function LineGraph({ title, scores, logs, yTicks, yMax, accentColor, emptyMessage }) {
  const hasData = scores.some((value) => value != null);
  const graphWidth = 760;
  const graphHeight = 280;
  const left = 54;
  const right = 22;
  const top = 18;
  const bottom = 38;
  const innerWidth = graphWidth - left - right;
  const innerHeight = graphHeight - top - bottom;

  const points = scores.map((value, index) => ({
    x: left + (scores.length <= 1 ? innerWidth / 2 : (innerWidth / Math.max(1, scores.length - 1)) * index),
    y: value == null ? null : top + innerHeight - (Math.max(0, Math.min(yMax, value)) / yMax) * innerHeight,
    raw: value,
    date: logs[index]?.log_date,
    label: formatXAxisLabel(logs[index]?.log_date, index, scores.length, logs.length),
  }));

  const pathData = points
    .filter((point) => point.y != null)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="report-detail-graph rounded-2xl p-4 sm:rounded-3xl sm:p-5" style={{ background: THEME.surface, border: `1px solid ${THEME.border}` }}>
      <div className="mb-4">
        <div className="text-[15px] font-bold" style={{ color: THEME.text }}>{title}</div>
        <div className="text-[12px]" style={{ color: THEME.muted }}>날짜별 점수와 수치를 함께 확인할 수 있어요.</div>
      </div>

      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center rounded-2xl" style={{ background: THEME.surfaceSoft, color: THEME.hint }}>
          {emptyMessage}
        </div>
      ) : (
        <svg className="block max-h-[280px] min-h-[190px]" width="100%" viewBox={`0 0 ${graphWidth} ${graphHeight}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
          {yTicks.map((tick) => {
            const y = top + innerHeight - (tick / yMax) * innerHeight;
            return (
              <g key={tick}>
                <line x1={left} y1={y} x2={graphWidth - right} y2={y} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />
                <text x={left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor" style={{ color: THEME.hint }}>
                  {tick}
                </text>
              </g>
            );
          })}
          <line x1={left} y1={graphHeight - bottom} x2={graphWidth - right} y2={graphHeight - bottom} stroke="rgba(148,163,184,0.28)" />
          {pathData ? <path d={pathData} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.map((point) => (
            <g key={`${point.date}-${point.x}`}>
              {point.y != null ? <circle cx={point.x} cy={point.y} r="4.5" fill="white" stroke={accentColor} strokeWidth="2.5" /> : null}
              {point.label ? (
                <text x={point.x} y={graphHeight - 14} textAnchor="middle" fontSize="10" fill="currentColor" style={{ color: THEME.hint }}>
                  {point.label}
                </text>
              ) : null}
              {point.y != null ? (
                <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="10" fill={accentColor}>
                  {Math.round(point.raw)}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function TrendGraph({
  logs,
  preset,
  startDate,
  endDate,
  customStart,
  customEnd,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustomRange,
}) {
  const scores = logs.map(dailyScore);
  const valid = scores.filter((value) => value != null);
  const averageScore = valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;

  return (
    <SurfaceCard className="rounded-2xl p-4 sm:rounded-3xl sm:p-6">
      <div className="mb-5 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[15px] font-bold" style={{ color: THEME.text }}>최근 생활 점수 추이</div>
          <div className="mt-1 text-[12px]" style={{ color: THEME.muted }}>
            수면, 식습관, 운동 기록을 종합한 일별 흐름이에요. 현재 조회 범위는 {rangeLabel(startDate, endDate)} 입니다.
          </div>
          <div className="mt-2 flex items-center gap-4 text-[12px]" style={{ color: THEME.hint }}>
            <span>평균 {averageScore != null ? `${averageScore}점` : '-'}</span>
            <span>{logs.length}일 조회</span>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_PRESETS.map((item) => {
              const active = preset === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPresetChange(item.key)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? '#2563EB' : THEME.surfaceSoft,
                    color: active ? '#FFFFFF' : THEME.text,
                    border: `1px solid ${active ? '#2563EB' : THEME.border}`,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px]" style={{ color: THEME.muted }}>
            <CalendarDays size={14} />
            <input type="date" max={getTodayISO()} value={customStart} onChange={(e) => onCustomStartChange(e.target.value)} className="min-w-0 flex-1 rounded-xl px-3 py-2 sm:flex-none" style={{ background: THEME.surfaceSoft, border: `1px solid ${THEME.border}`, color: THEME.text }} />
            <span>-</span>
            <input type="date" max={getTodayISO()} value={customEnd} onChange={(e) => onCustomEndChange(e.target.value)} className="min-w-0 flex-1 rounded-xl px-3 py-2 sm:flex-none" style={{ background: THEME.surfaceSoft, border: `1px solid ${THEME.border}`, color: THEME.text }} />
            <button type="button" onClick={onApplyCustomRange} className="rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: THEME.surfaceSoft, border: `1px solid ${THEME.border}`, color: THEME.text }}>
              적용
            </button>
          </div>
        </div>
      </div>

      <LineGraph
        title="생활 점수 추이"
        scores={scores}
        logs={logs}
        yTicks={[0, 25, 50, 75, 100]}
        yMax={100}
        accentColor="#2563EB"
        emptyMessage="선택한 기간에 표시할 기록이 아직 없어요."
      />
    </SurfaceCard>
  );
}

function TodayActions({ risk }) {
  const actions = [];
  if ((risk?.exercise_score ?? 100) < 70) actions.push({ icon: Activity, title: '30분 걷기', desc: '오늘은 짧은 산책부터 시작해 보세요.', color: '#10B981' });
  if ((risk?.sleep_score ?? 100) < 70) actions.push({ icon: Moon, title: '23시 전 취침', desc: '수면 리듬을 맞추는 데 도움이 돼요.', color: '#6366F1' });
  if ((risk?.diet_score ?? 100) < 70) actions.push({ icon: Leaf, title: '채소 먼저 먹기', desc: '한 끼만이라도 식사 균형을 챙겨 보세요.', color: '#F59E0B' });
  if (actions.length < 3) actions.push({ icon: Droplets, title: '물 1.5L 마시기', desc: '기본 생활 습관 관리에 도움이 돼요.', color: '#3B82F6' });

  return (
    <SurfaceCard className="rounded-3xl p-4 sm:p-6">
      <div className="mb-4 text-[15px] font-bold" style={{ color: THEME.text }}>오늘 바로 해볼 행동</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.slice(0, 3).map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.title} className="rounded-2xl p-4" style={{ background: `${action.color}12` }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ background: `${action.color}20` }}>
                <Icon size={17} style={{ color: action.color }} />
              </div>
              <div className="mt-3 text-[13px] font-bold" style={{ color: THEME.text }}>{action.title}</div>
              <div className="mt-1 text-[11px] leading-[1.6]" style={{ color: THEME.muted }}>{action.desc}</div>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

function DetailModal({ categoryKey, risk, logs, rangeText, onClose }) {
  const cfg = CATEGORY_CONFIG[categoryKey];
  const Icon = cfg.icon;
  const score = risk?.[cfg.scoreKey] ?? null;
  const series = buildSeries(logs, categoryKey);
  const avg = average(series);
  const tone = scoreTone(score);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-t-3xl p-4 sm:rounded-3xl sm:p-6" style={{ background: THEME.surface, border: `1px solid ${THEME.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${cfg.color}16` }}>
              <Icon size={18} style={{ color: cfg.color }} />
            </div>
            <div>
              <div className="text-[17px] font-bold" style={{ color: THEME.text }}>{cfg.label} 상세</div>
              <div className="text-[12px]" style={{ color: THEME.muted }}>{rangeText} 기준</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: THEME.surfaceSoft, color: THEME.muted }}>
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="text-[28px] font-extrabold" style={{ color: cfg.color }}>{cfg.formatValue(avg)}</span>
          <span className="text-[12px]" style={{ color: THEME.hint }}>평균</span>
          <span className="ml-auto rounded-full px-3 py-1 text-[12px] font-bold" style={{ color: tone.color, background: tone.bg }}>{tone.label}</span>
        </div>

        <LineGraph title={`${cfg.label} 추이`} scores={series} logs={logs} yTicks={cfg.yTicks} yMax={cfg.yMax} accentColor={cfg.color} emptyMessage={`${cfg.label} 기록이 부족해서 그래프를 아직 보여줄 수 없어요.`} />

        <div className="mt-5 grid gap-3 md:grid-cols-2 md:gap-4">
          <div>
            <div className="mb-2 text-[12px] font-bold" style={{ color: THEME.text }}>점검 포인트</div>
            <div className="space-y-2">
              {cfg.problems(score, avg).map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl px-3.5 py-3" style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#F59E0B' }} />
                  <span className="text-[12px]" style={{ color: THEME.text }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] font-bold" style={{ color: THEME.text }}>개선 제안</div>
            <div className="space-y-2">
              {cfg.actions.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl px-3.5 py-3" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: '#10B981' }}>✓</div>
                  <span className="text-[12px]" style={{ color: THEME.text }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  const [status, setStatus] = useState(null);
  const [risk, setRisk] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [modalCategory, setModalCategory] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const initialRange = useMemo(() => makePresetRange('7d'), []);
  const [preset, setPreset] = useState('7d');
  const [customStart, setCustomStart] = useState(initialRange.startDate);
  const [customEnd, setCustomEnd] = useState(initialRange.endDate);
  const [appliedRange, setAppliedRange] = useState(initialRange);

  useEffect(() => {
    if (preset === '7d' || preset === '30d') {
      const next = makePresetRange(preset);
      setAppliedRange(next);
      setCustomStart(next.startDate);
      setCustomEnd(next.endDate);
    }
  }, [preset]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);
      setError('');

      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`status ${statusRes.status}`);
        const statusData = await statusRes.json();
        if (cancelled) return;
        setStatus(statusData);

        if (!statusData.is_completed) {
          setRisk(null);
          setLogs([]);
          return;
        }

        let riskData = null;
        try {
          const riskRes = await api('/api/v1/risk/current');
          if (riskRes.ok) {
            riskData = await riskRes.json();
          }
        } catch (riskError) {
          console.error('report_detail_risk_load_failed', riskError);
        }

        const dates = buildDateList(appliedRange.startDate, appliedRange.endDate);
        const settled = await Promise.allSettled(
          dates.map(async (date) => {
            const response = await api(`/api/v1/health/daily/${date}`);
            return response.ok ? response.json() : { log_date: date };
          }),
        );

        if (cancelled) return;

        const nextLogs = settled.map((item, index) => {
          if (item.status === 'fulfilled') {
            return item.value;
          }
          return { log_date: dates[index] };
        });

        setRisk(riskData);
        setLogs(nextLogs);
      } catch (loadError) {
        console.error('report_detail_load_failed', loadError);
        if (!cancelled) setError('상세 리포트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [appliedRange, refreshNonce]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setRefreshNonce((value) => value + 1);
    window.addEventListener('danaa:report-cache-refresh', handler);
    return () => window.removeEventListener('danaa:report-cache-refresh', handler);
  }, []);

  const hasOnboarding = Boolean(status?.is_completed);
  const rangeText = preset === 'custom' ? rangeLabel(appliedRange.startDate, appliedRange.endDate) : preset === '30d' ? '30일' : '7일';

  const handleApplyCustomRange = () => {
    const today = getTodayISO();
    if (!customStart || !customEnd || customStart > customEnd) {
      setError('조회 시작일과 종료일을 다시 확인해 주세요.');
      return;
    }
    if (customStart > today || customEnd > today) {
      setError('직접 선택 기간은 오늘 날짜까지만 조회할 수 있어요.');
      return;
    }
    setPreset('custom');
    setAppliedRange({ preset: 'custom', startDate: customStart, endDate: customEnd });
    setError('');
  };

  return (
    <div className="theme-report-page flex h-full flex-col" style={{ background: THEME.page }}>
      <header className="flex h-12 shrink-0 items-center border-b px-4" style={{ background: THEME.surface, borderColor: THEME.border }}>
        <span className="text-[14px] font-medium" style={{ color: THEME.text }}>상세 리포트</span>
      </header>
      <ReportTabs />

      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5" style={{ scrollbarGutter: 'stable' }}>
        <main className="mx-auto max-w-[1120px] space-y-4">
          {error ? (
            <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#DC2626' }}>
              <AlertTriangle size={13} />
              {error}
            </div>
          ) : null}

          {!loaded ? (
            <SurfaceCard className="flex min-h-[320px] items-center justify-center rounded-3xl">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(37,99,235,0.10)' }}>
                  <RefreshCw size={18} style={{ color: '#2563EB' }} />
                </div>
                <div className="text-[15px] font-semibold" style={{ color: THEME.text }}>상세 리포트를 불러오는 중</div>
              </div>
            </SurfaceCard>
          ) : !hasOnboarding ? (
            <SurfaceCard className="rounded-3xl p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(37,99,235,0.10)' }}>
                <BarChart3 size={20} style={{ color: '#2563EB' }} />
              </div>
              <div className="mt-4 text-[18px] font-semibold" style={{ color: THEME.text }}>온보딩을 완료하면 상세 리포트를 볼 수 있어요.</div>
              <div className="mt-2 text-[13px] leading-6" style={{ color: THEME.muted }}>기본 정보와 건강 질문을 먼저 입력하면 생활 습관 기반 리포트를 바로 확인할 수 있어요.</div>
              <Link href="/onboarding/diabetes" className="mt-5 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white" style={{ background: '#2563EB' }}>
                온보딩 하러가기
              </Link>
            </SurfaceCard>
          ) : (
            <>
              <SummaryHeader risk={risk} />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.keys(CATEGORY_CONFIG).map((categoryKey) => (
                  <HealthCard
                    key={categoryKey}
                    categoryKey={categoryKey}
                    risk={risk}
                    logs={logs}
                    rangeText={rangeText}
                    onOpen={() => setModalCategory(categoryKey)}
                  />
                ))}
              </div>

              <TrendGraph
                logs={logs}
                preset={preset}
                startDate={appliedRange.startDate}
                endDate={appliedRange.endDate}
                customStart={customStart}
                customEnd={customEnd}
                onPresetChange={setPreset}
                onCustomStartChange={setCustomStart}
                onCustomEndChange={setCustomEnd}
                onApplyCustomRange={handleApplyCustomRange}
              />

              <TodayActions risk={risk} />
            </>
          )}
        </main>
      </div>

      {modalCategory ? (
        <DetailModal
          categoryKey={modalCategory}
          risk={risk}
          logs={logs}
          rangeText={rangeText}
          onClose={() => setModalCategory(null)}
        />
      ) : null}
    </div>
  );
}
