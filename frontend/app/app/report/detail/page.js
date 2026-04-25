'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Droplets,
  Dumbbell,
  Footprints,
  Leaf,
  Moon,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';

import { api } from '../../../../hooks/useApi';

const DETAIL_CACHE_PREFIX = 'danaa:report:detail:v3';
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const PERIOD_OPTIONS = [
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
];

const CATEGORY_META = {
  sleep: {
    label: '수면',
    icon: Moon,
    color: '#6366f1',
    description: '짧거나 불규칙한 수면은 컨디션과 혈당 관리에 영향을 줄 수 있습니다.',
  },
  diet: {
    label: '식습관',
    icon: UtensilsCrossed,
    color: '#f59e0b',
    description: '채소 섭취, 식사 균형, 단음료와 야식 기록을 함께 봅니다.',
  },
  exercise: {
    label: '운동',
    icon: Activity,
    color: '#10b981',
    description: '운동 빈도와 활동량은 공식 위험 점수에도 직접 반영됩니다.',
  },
  hydration: {
    label: '수분',
    icon: Droplets,
    color: '#3b82f6',
    description: '수분 기록은 예측 점수보다 생활습관 관리 참고용으로 사용됩니다.',
  },
};

const FINDRISC_LABELS = {
  age: '나이',
  bmi: '체중 상태',
  waist: '허리둘레',
  activity: '신체 활동',
  vegetable: '채소 섭취',
  hypertension: '고혈압 이력',
  glucose_history: '고혈당 이력',
  family: '가족력',
};

const SLEEP_HOURS = {
  under_5: 4.5,
  between_5_6: 5.5,
  between_6_7: 6.5,
  between_7_8: 7.5,
  over_8: 8.5,
};

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
  } catch {}
}

function clearDetailCaches() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`${DETAIL_CACHE_PREFIX}:`))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

function getLastNDates(days) {
  const today = new Date();
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - offset));
    return date.toISOString().slice(0, 10);
  });
}

function scoreDiet(log) {
  let score = 0;
  let hasAny = false;
  if (log.vegetable_intake_level) { score += log.vegetable_intake_level === 'enough' ? 35 : 20; hasAny = true; }
  if (log.meal_balance_level) { score += log.meal_balance_level === 'balanced' ? 35 : log.meal_balance_level === 'protein_veg_heavy' ? 25 : 10; hasAny = true; }
  if (log.sweetdrink_level) { score += log.sweetdrink_level === 'none' ? 15 : 8; hasAny = true; }
  if (log.nightsnack_level) { score += log.nightsnack_level === 'none' ? 15 : 8; hasAny = true; }
  return hasAny ? score : null;
}

function buildSeries(logs, category) {
  if (category === 'sleep') return logs.map((log) => SLEEP_HOURS[log.sleep_duration_bucket] ?? null);
  if (category === 'diet') return logs.map((log) => scoreDiet(log));
  if (category === 'exercise') return logs.map((log) => (log.exercise_done || (log.exercise_minutes || 0) > 0 ? (log.exercise_minutes || 30) : 0));
  if (category === 'hydration') return logs.map((log) => (log.water_cups != null ? Number((log.water_cups * 0.2).toFixed(1)) : null));
  return [];
}

function average(values) {
  const valid = values.filter((v) => v != null);
  if (!valid.length) return null;
  return Number((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1));
}

function clampPct(value) {
  if (value == null) return 0;
  return Math.max(0, Math.min(100, value));
}

function scoreTone(score) {
  if (score == null) return { label: '기록 부족', color: '#9CA3AF', bg: '#F3F4F6' };
  if (score >= 70) return { label: '좋음', color: '#059669', bg: '#D1FAE5' };
  if (score >= 40) return { label: '주의', color: '#D97706', bg: '#FEF3C7' };
  return { label: '개선 필요', color: '#DC2626', bg: '#FEE2E2' };
}

function findriscTone(score) {
  if (score == null) return { label: '미확인', color: '#9CA3AF', bg: '#F3F4F6' };
  if (score <= 7) return { label: '낮음', color: '#059669', bg: '#D1FAE5' };
  if (score <= 14) return { label: '주의', color: '#D97706', bg: '#FEF3C7' };
  return { label: '높음', color: '#DC2626', bg: '#FEE2E2' };
}

function formatMetricValue(category, value) {
  if (value == null) return '-';
  if (category === 'sleep') return `${value}시간`;
  if (category === 'diet') return `${Math.round(value)}점`;
  if (category === 'exercise') return `${Math.round(value)}분`;
  if (category === 'hydration') return `${value}L`;
  return String(value);
}

function pointY(value, max) {
  if (value == null) return null;
  return 120 - (Math.max(0, Math.min(max, value)) / max) * 88;
}

function linePath(series, max) {
  const valid = series
    .map((v, i) => [40 + i * (series.length === 1 ? 0 : 560 / (series.length - 1)), pointY(v, max)])
    .filter(([, y]) => y != null);
  if (valid.length < 2) return '';
  return valid.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

function formatDateLabel(value) {
  if (!value) return '';
  const [, month, day] = String(value).split('-');
  return `${month}.${day}`;
}

const AGE_RANGE_LABELS = {
  under_45: '45세 미만',
  '45_54': '45–54세',
  '55_64': '55–64세',
  '65_plus': '65세 이상',
};

function formatAgeRange(v) {
  return AGE_RANGE_LABELS[v] || v || '-';
}

function countFilled(logs, fields) {
  return logs.filter((log) => fields.some((f) => log?.[f] != null)).length;
}

function buildCompleteness(logs, periodDays) {
  return [
    { label: '수면', done: countFilled(logs, ['sleep_quality', 'sleep_duration_bucket']), total: periodDays },
    { label: '식습관', done: countFilled(logs, ['vegetable_intake_level', 'meal_balance_level', 'sweetdrink_level', 'nightsnack_level']), total: periodDays },
    { label: '운동', done: countFilled(logs, ['exercise_done', 'exercise_minutes', 'walk_done']), total: periodDays },
    { label: '수분', done: countFilled(logs, ['water_cups']), total: periodDays },
  ];
}

function buildUsedRecords({ status, risk, logs }) {
  const recent = logs.slice(-7);
  const avgSleep = average(buildSeries(recent, 'sleep'));
  const avgDiet = average(buildSeries(recent, 'diet'));
  const exerciseDays = recent.filter((log) => log.exercise_done || (log.exercise_minutes || 0) > 0).length;
  const drinkingDays = recent.filter((log) => log.alcohol_today).length;
  const signals = risk?.supporting_signals || [];
  return [
    { label: '나이대', value: formatAgeRange(status?.age_range), helper: '공식 위험 점수에 사용됩니다.' },
    { label: 'BMI', value: status?.bmi != null ? String(status.bmi) : '-', helper: '체중 상태 기본 항목입니다.' },
    { label: '최근 수면', value: avgSleep != null ? `${avgSleep}시간` : '-', helper: '최근 7일 평균 수면 시간입니다.' },
    { label: '최근 식습관', value: avgDiet != null ? `${Math.round(avgDiet)}점` : '-', helper: '채소·균형·단음료·야식 기준입니다.' },
    { label: '운동한 날', value: `${exerciseDays}일 / 7일`, helper: '신체 활동 여부에 반영됩니다.' },
    { label: '음주 기록', value: `${drinkingDays}일 / 7일`, helper: '생활습관 참고 항목입니다.' },
    { label: '혈당 신호', value: signals.some((s) => s.includes('혈당')) ? '확인됨' : '미확인', helper: '측정값이 있으면 위험 신호로 봅니다.' },
    { label: '혈압 신호', value: signals.some((s) => s.includes('혈압')) ? '확인됨' : '미확인', helper: '혈압 관련 기록을 참고합니다.' },
  ];
}

// ── 공통 탭 ──────────────────────────────────────────────────────────────────

function ReportTabs() {
  return (
    <div className="shrink-0 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex w-full max-w-[1260px] gap-0 px-5">
        <Link
          href="/app/report"
          className="inline-flex items-center border-b-2 border-transparent px-5 py-3 text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
        >
          대시보드
        </Link>
        <div className="inline-flex items-center border-b-2 border-[#2563EB] px-5 py-3 text-[14px] font-semibold text-[#111827]">
          상세 리포트
        </div>
      </div>
    </div>
  );
}

// ── UI 컴포넌트 ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF]">
          <BarChart3 size={18} className="text-[#2563EB]" />
        </div>
        <div className="text-[15px] font-semibold text-[#111827]">상세 리포트를 정리하는 중</div>
        <div className="mt-1 text-[12px] text-[#6B7280]">최근 기록과 위험도 결과를 함께 불러오고 있습니다.</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, desc }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-bold text-[#0F172A]">{title}</h2>
      {desc && <p className="mt-0.5 text-[12px] text-[#64748B]">{desc}</p>}
    </div>
  );
}

function Badge({ tone }) {
  return (
    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color: tone.color, backgroundColor: tone.bg }}>
      {tone.label}
    </span>
  );
}

// ── 한줄 진단 배너 ────────────────────────────────────────────────────────────

function buildDiagnosis(risk, logs) {
  const sleep = risk?.sleep_score;
  const diet = risk?.diet_score;
  const exercise = risk?.exercise_score;
  const pred = risk?.predicted_score_pct;
  const findrisc = risk?.findrisc_score;

  const issues = [];
  if (exercise != null && exercise < 40) issues.push('운동 부족');
  else if (exercise != null && exercise < 70) issues.push('운동 부족');
  if (sleep != null && sleep < 40) issues.push('수면 부족');
  else if (sleep != null && sleep < 70) issues.push('수면 불규칙');
  if (diet != null && diet < 40) issues.push('식습관 불균형');
  else if (diet != null && diet < 70) issues.push('채소 섭취 부족');

  const allGood = sleep >= 70 && diet >= 70 && exercise >= 70;
  const highRisk = (pred != null && pred >= 70) || (findrisc != null && findrisc >= 15);

  let statusText, statusColor, statusBg;
  if (highRisk) {
    statusText = '위험'; statusColor = '#DC2626'; statusBg = '#FEE2E2';
  } else if (issues.length >= 2 || (pred != null && pred >= 40)) {
    statusText = '개선 필요'; statusColor = '#D97706'; statusBg = '#FEF3C7';
  } else if (allGood) {
    statusText = '양호'; statusColor = '#059669'; statusBg = '#D1FAE5';
  } else {
    statusText = '주의'; statusColor = '#D97706'; statusBg = '#FEF3C7';
  }

  let summary;
  if (issues.length === 0) {
    summary = allGood ? '전반적인 생활습관이 안정적으로 관리되고 있습니다.' : '기록이 더 쌓이면 더 정확한 진단이 가능합니다.';
  } else {
    summary = `${issues.slice(0, 2).join(' · ')}으로 인해 건강 위험도가 상승했습니다.`;
  }

  return { summary, issues, statusText, statusColor, statusBg };
}

function DiagnosisBanner({ risk, logs }) {
  const { summary, issues, statusText, statusColor, statusBg } = buildDiagnosis(risk, logs);

  return (
    <div className="rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
      style={{ background: `linear-gradient(135deg, ${statusBg} 0%, white 60%)`, border: `1px solid ${statusColor}22` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">현재 상태 진단</div>
          <p className="text-[15px] font-bold leading-snug text-[#0F172A]">{summary}</p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-[12px] font-bold"
          style={{ color: statusColor, backgroundColor: statusBg }}>
          {statusText}
        </span>
      </div>
      {issues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {issues.map((issue) => (
            <span key={issue} className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ color: statusColor, borderColor: `${statusColor}40`, backgroundColor: `${statusColor}0D` }}>
              {issue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 핵심 문제 TOP3 ───────────────────────────────────────────────────────────

function buildTopIssues(risk, logs) {
  const recent = logs.slice(-7);
  const avgSleep = average(buildSeries(recent, 'sleep'));
  const exerciseDays = recent.filter((log) => log.exercise_done || (log.exercise_minutes || 0) > 0).length;

  const candidates = [];

  const exercise = risk?.exercise_score;
  if (exercise != null && exercise < 70) {
    const t = scoreTone(exercise);
    candidates.push({
      rank: exercise < 40 ? 0 : 1,
      Icon: Dumbbell,
      title: '운동 부족',
      value: exerciseDays != null ? `주 ${exerciseDays}일 운동` : `${exercise}점`,
      desc: '신체 활동 부족은 혈당 조절 능력을 낮추고 FINDRISC 점수에 직접 반영됩니다.',
      color: t.color, bg: t.bg,
    });
  }

  const sleep = risk?.sleep_score;
  if (sleep != null && sleep < 70) {
    const t = scoreTone(sleep);
    candidates.push({
      rank: sleep < 40 ? 0 : 1,
      Icon: Moon,
      title: '수면 부족',
      value: avgSleep != null ? `평균 ${avgSleep}시간` : `${sleep}점`,
      desc: '수면 부족은 혈당 조절 호르몬 균형을 깨뜨려 당뇨 위험을 높입니다.',
      color: t.color, bg: t.bg,
    });
  }

  const diet = risk?.diet_score;
  if (diet != null && diet < 70) {
    const t = scoreTone(diet);
    candidates.push({
      rank: diet < 40 ? 0 : 1,
      Icon: Leaf,
      title: '식습관 불균형',
      value: `${diet}점`,
      desc: '불균형한 식습관과 채소 부족은 혈당 스파이크와 인슐린 저항성을 높입니다.',
      color: t.color, bg: t.bg,
    });
  }

  const findrisc = risk?.findrisc_score;
  if (findrisc != null && findrisc >= 10) {
    const t = findriscTone(findrisc);
    candidates.push({
      rank: findrisc >= 15 ? -1 : 0,
      Icon: AlertTriangle,
      title: '공식 당뇨 위험',
      value: `FINDRISC ${findrisc}점`,
      desc: '나이, 체중, 허리둘레, 가족력 등 구조적 위험 요인이 높게 나타났습니다.',
      color: t.color, bg: t.bg,
    });
  }

  return candidates.sort((a, b) => a.rank - b.rank).slice(0, 3);
}

function TopIssuesSection({ risk, logs }) {
  const issues = buildTopIssues(risk, logs);
  if (issues.length === 0) {
    return (
      <div>
        <SectionHeader title="핵심 문제 요인" desc="현재 가장 관리가 필요한 항목을 정리합니다." />
        <div className="rounded-2xl bg-white p-6 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
          <div className="text-[13px] text-[#059669]">현재 주요 문제 요인이 없습니다. 꾸준히 유지하세요!</div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <SectionHeader title="핵심 문제 요인 TOP 3" desc="지금 가장 먼저 개선이 필요한 항목입니다." />
      <div className="grid gap-3 md:grid-cols-3">
        {issues.map((issue, i) => {
          const Icon = issue.Icon;
          return (
            <div key={issue.title} className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
              style={{ border: `1px solid ${issue.color}30` }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ backgroundColor: issue.bg }}>
                  <Icon size={16} style={{ color: issue.color }} />
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ color: issue.color, backgroundColor: issue.bg }}>
                  #{i + 1}
                </span>
              </div>
              <div className="text-[13px] font-bold text-[#0F172A]">{issue.title}</div>
              <div className="mt-0.5 text-[17px] font-extrabold" style={{ color: issue.color }}>{issue.value}</div>
              <p className="mt-2 text-[11px] leading-[1.7] text-[#64748B]">{issue.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 개선 가이드 ──────────────────────────────────────────────────────────────

function buildGuide(risk) {
  const sleep = risk?.sleep_score;
  const diet = risk?.diet_score;
  const exercise = risk?.exercise_score;

  const actions = [];

  const ACCENT = '#2563EB';
  if (exercise == null || exercise < 70) {
    actions.push({ Icon: Footprints, text: '하루 30분 걷기', sub: '혈당을 낮추는 가장 쉬운 방법입니다.', color: ACCENT });
  }
  if (sleep == null || sleep < 70) {
    actions.push({ Icon: Moon, text: '취침 시간 30분 앞당기기', sub: '수면 7시간 이상 확보가 목표입니다.', color: ACCENT });
  }
  if (diet == null || diet < 70) {
    actions.push({ Icon: Leaf, text: '매 끼니 채소 한 접시', sub: '혈당 스파이크를 줄이는 핵심 습관입니다.', color: ACCENT });
  }
  if (actions.length < 3) {
    actions.push({ Icon: Droplets, text: '하루 물 1.5L 마시기', sub: '수분 섭취는 신진대사와 혈당 관리에 도움이 됩니다.', color: ACCENT });
  }

  return actions.slice(0, 3);
}

function ImprovementGuideSection({ risk }) {
  const actions = buildGuide(risk);
  return (
    <div>
      <SectionHeader title="지금 바로 실천할 수 있는 것" desc="현재 상태를 기반으로 바로 시작할 수 있는 행동을 제안합니다." />
      <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
        <div className="grid gap-3 md:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.Icon;
            return (
              <div key={action.text} className="flex items-start gap-3 rounded-xl p-4"
                style={{ backgroundColor: `${action.color}0D` }}>
                <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${action.color}18` }}>
                  <Icon size={17} style={{ color: action.color }} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#0F172A]">{action.text}</div>
                  <div className="mt-0.5 text-[11px] leading-[1.6] text-[#64748B]">{action.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 추천 챌린지 ──────────────────────────────────────────────────────────────

function RecommendedChallengesSection({ risk }) {
  const sleep = risk?.sleep_score;
  const diet = risk?.diet_score;
  const exercise = risk?.exercise_score;

  const ACCENT = '#2563EB';
  const items = [
    exercise == null || exercise < 70
      ? { Icon: Dumbbell, title: '주 150분 운동 챌린지', reason: '운동 점수가 낮아 추천합니다', color: ACCENT }
      : null,
    sleep == null || sleep < 70
      ? { Icon: Moon, title: '규칙적인 수면 루틴 챌린지', reason: '수면 패턴 개선이 필요합니다', color: ACCENT }
      : null,
    diet == null || diet < 70
      ? { Icon: Leaf, title: '채소 충분히 먹기 챌린지', reason: '식습관 점수 향상을 위해 추천합니다', color: ACCENT }
      : null,
    { Icon: Droplets, title: '하루 1L 물 섭취 챌린지', reason: '수분 관리는 기본 건강 습관입니다', color: ACCENT },
  ].filter(Boolean).slice(0, 3);

  return (
    <div>
      <SectionHeader title="추천 챌린지" desc="현재 부족한 항목을 개선하는 데 도움이 되는 챌린지입니다." />
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.Icon;
          return (
            <div key={item.title} className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${item.color}14` }}>
                <Icon size={18} style={{ color: item.color }} />
              </div>
              <div className="text-[13px] font-bold text-[#0F172A]">{item.title}</div>
              <div className="mt-1 text-[11px] text-[#64748B]">{item.reason}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center">
        <Link href="/app/challenge"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]">
          챌린지 시작하기 →
        </Link>
      </div>
    </div>
  );
}

// ── 점수 요약 (3카드) ────────────────────────────────────────────────────────

function SummarySection({ risk }) {
  const predTone = scoreTone(risk?.predicted_score_pct);
  const finTone = findriscTone(risk?.findrisc_score);
  const lifeTone = scoreTone(risk?.lifestyle_score);

  const cards = [
    {
      title: '건강 위험도',
      sub: '다나와 모델 · AI 종합',
      value: risk?.predicted_score_pct,
      suffix: '/ 100',
      tone: predTone,
      pct: clampPct(risk?.predicted_score_pct),
      desc: '설문, 최근 생활기록, 측정 신호를 함께 보고 현재 관리가 필요한 정도를 나타냅니다.',
    },
    {
      title: '당뇨 위험도',
      sub: 'FINDRISC · 기본 건강 지표',
      value: risk?.findrisc_score,
      suffix: '/ 26',
      tone: finTone,
      pct: clampPct((risk?.findrisc_score ?? 0) / 26 * 100),
      desc: '나이, 체중, 허리둘레, 활동량, 가족력 등 공식 항목을 기준으로 계산합니다.',
    },
    {
      title: '생활습관 점수',
      sub: '수면 · 식습관 · 운동 종합',
      value: risk?.lifestyle_score,
      suffix: '점',
      tone: lifeTone,
      pct: clampPct(risk?.lifestyle_score),
      desc: '수면, 식습관, 운동 기록이 얼마나 안정적인지 보여주는 관리용 점수입니다.',
    },
  ];

  return (
    <div>
      <SectionHeader title="종합 점수" desc="가장 최근 평가 기준입니다. 기간별 추이는 아래 기록 추이에서 확인하세요." />
      <div className="grid gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-[#0F172A]">{card.title}</div>
                <div className="mt-0.5 text-[10px] text-[#94A3B8]">{card.sub}</div>
              </div>
              <Badge tone={card.tone} />
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[36px] font-extrabold leading-none" style={{ color: card.tone.color }}>{card.value ?? '-'}</span>
              <span className="text-[12px] text-[#94A3B8]">{card.suffix}</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[#F1F5F9]">
              <div className="h-full rounded-full transition-all" style={{ width: `${card.pct}%`, backgroundColor: card.tone.color }} />
            </div>
            <p className="mt-3 text-[11px] leading-[1.7] text-[#64748B]">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 반영된 기록 ──────────────────────────────────────────────────────────────

function UsedRecordsSection({ status, risk, logs }) {
  const items = buildUsedRecords({ status, risk, logs });
  return (
    <div>
      <SectionHeader title="결과에 반영된 기록" desc="리포트가 참고한 주요 기록입니다. 비어 있으면 결과가 덜 구체적으로 보일 수 있습니다." />
      <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[#F1F5F9]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]">
            <ShieldCheck size={15} className="text-[#2563EB]" />
          </div>
          <span className="text-[13px] font-semibold text-[#0F172A]">반영 항목 상세</span>
        </div>
        <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-[#F8FAFC] p-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{item.label}</div>
              <div className="mt-2 text-[18px] font-bold text-[#0F172A]">{item.value}</div>
              <div className="mt-1 text-[10px] leading-[1.6] text-[#64748B]">{item.helper}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 점수 구성 ────────────────────────────────────────────────────────────────

function ScoreSection({ risk }) {
  const factors = Object.entries(risk?.score_breakdown || {}).filter(([, v]) => Number(v) > 0);
  const lifestyleItems = [
    { key: 'sleep_score', label: '수면', icon: Moon, color: '#6366f1' },
    { key: 'diet_score', label: '식습관', icon: UtensilsCrossed, color: '#f59e0b' },
    { key: 'exercise_score', label: '운동', icon: Activity, color: '#10b981' },
  ];

  return (
    <div>
      <SectionHeader title="점수 구성" desc="각 점수가 어떻게 만들어졌는지 항목별로 확인합니다." />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
          <div className="text-[13px] font-semibold text-[#0F172A]">FINDRISC 점수 구성</div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">점수가 더해진 항목만 표시합니다. 숫자가 높을수록 관리가 필요한 요인입니다.</div>
          <div className="mt-4 space-y-2">
            {factors.length > 0 ? factors.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FAFC] px-3.5 py-2.5">
                <span className="text-[12px] font-medium text-[#374151]">{FINDRISC_LABELS[key] || key}</span>
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]">+{value}점</span>
              </div>
            )) : (
              <div className="rounded-xl bg-[#F8FAFC] px-4 py-5 text-[12px] text-[#64748B]">
                아직 표시할 공식 위험 항목이 충분하지 않습니다.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
          <div className="text-[13px] font-semibold text-[#0F172A]">생활습관 점수 상세</div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">매일 남긴 기록을 기준으로 수면, 식습관, 운동 상태를 점검합니다.</div>
          <div className="mt-4 space-y-2.5">
            {lifestyleItems.map((item) => {
              const Icon = item.icon;
              const score = risk?.[item.key];
              const tone = scoreTone(score);
              return (
                <div key={item.key} className="rounded-xl bg-[#F8FAFC] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${item.color}18` }}>
                        <Icon size={13} style={{ color: item.color }} />
                      </div>
                      <span className="text-[12px] font-semibold text-[#0F172A]">{item.label}</span>
                    </div>
                    <Badge tone={tone} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="w-10 shrink-0 text-[17px] font-bold" style={{ color: tone.color }}>
                      {score ?? '-'}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-[#E5E7EB]">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${score == null ? 0 : Math.max(6, clampPct(score))}%`, backgroundColor: tone.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 기록 완성도 ──────────────────────────────────────────────────────────────

function CompletenessSection({ logs, periodDays }) {
  const rows = buildCompleteness(logs, periodDays);
  return (
    <div>
      <SectionHeader title="기록 완성도" desc="기록이 많을수록 리포트가 생활 흐름을 더 정확히 보여줄 수 있습니다." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const pct = Math.round((row.done / Math.max(1, row.total)) * 100);
          const barColor = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
          const bgColor = pct >= 70 ? '#D1FAE5' : pct >= 40 ? '#FEF3C7' : '#FEE2E2';
          return (
            <div key={row.label} className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#374151]">{row.label}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: barColor, backgroundColor: bgColor }}>{pct}%</span>
              </div>
              <div className="mt-3 text-[24px] font-bold text-[#0F172A]">{row.done}<span className="ml-1 text-[14px] font-normal text-[#94A3B8]">/ {row.total}일</span></div>
              <div className="mt-3 h-1.5 rounded-full bg-[#F1F5F9]">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 기록 추이 ────────────────────────────────────────────────────────────────

function TrendCard({ category, logs, periodDays, score }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const series = buildSeries(logs, category);
  const avg = average(series);
  const max = Math.max(1, ...series.filter((v) => v != null), category === 'hydration' ? 1.2 : 1);
  const path = linePath(series, max);
  const tone = scoreTone(score);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${meta.color}14`, color: meta.color }}>
            <Icon size={16} />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#0F172A]">{meta.label}</div>
            <div className="mt-0.5 text-[10px] leading-[1.6] text-[#64748B]">{meta.description}</div>
          </div>
        </div>
        {score != null && <Badge tone={tone} />}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold text-[#0F172A]">{formatMetricValue(category, avg)}</span>
        <span className="text-[11px] text-[#94A3B8]">{periodDays}일 평균</span>
      </div>

      {path ? (
        <svg className="mt-3" width="100%" viewBox="0 0 640 150" role="img" aria-label={`${meta.label} 기록 추이`}>
          <line x1="40" y1="32" x2="600" y2="32" stroke="#F1F5F9" strokeDasharray="4 3" />
          <line x1="40" y1="76" x2="600" y2="76" stroke="#F1F5F9" strokeDasharray="4 3" />
          <line x1="40" y1="120" x2="600" y2="120" stroke="#E5E7EB" />
          <path d={path} fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {series.map((value, index) => {
            const y = pointY(value, max);
            if (y == null) return null;
            const x = 40 + index * (series.length === 1 ? 0 : 560 / (series.length - 1));
            return <circle key={`${category}-${index}`} cx={x} cy={y} r="3.5" fill="white" stroke={meta.color} strokeWidth="2" />;
          })}
          {logs.map((log, index) => {
            const x = 40 + index * (logs.length === 1 ? 0 : 560 / (logs.length - 1));
            return (
              <text key={`lbl-${log.log_date}`} x={x} y="142" textAnchor="middle" fontSize="9" fill="#94A3B8">
                {index % Math.max(1, Math.ceil(logs.length / 6)) === 0 || index === logs.length - 1
                  ? formatDateLabel(log.log_date) : ''}
              </text>
            );
          })}
        </svg>
      ) : (
        <div className="mt-3 flex h-[150px] items-center justify-center rounded-xl bg-[#F8FAFC] text-[12px] text-[#94A3B8]">
          {meta.label} 기록이 더 쌓이면 추이를 보여드립니다.
        </div>
      )}
    </div>
  );
}

function TrendSection({ logs, periodDays, onPeriodChange, risk }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader title="기록 추이" desc="기간별 생활습관 기록이 어떻게 변했는지 확인합니다." />
        <div className="flex gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onPeriodChange(opt.value)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                periodDays === opt.value
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F1F5F9] text-[#6B7280] hover:bg-[#E2E8F0]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <TrendCard category="sleep" logs={logs} periodDays={periodDays} score={risk?.sleep_score} />
        <TrendCard category="diet" logs={logs} periodDays={periodDays} score={risk?.diet_score} />
        <TrendCard category="exercise" logs={logs} periodDays={periodDays} score={risk?.exercise_score} />
        <TrendCard category="hydration" logs={logs} periodDays={periodDays} score={null} />
      </div>
    </div>
  );
}

// ── 페이지 ─────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const [periodDays, setPeriodDays] = useState(7);
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [risk, setRisk] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');
      let currentUserId = null;
      try {
        const userRes = await api('/api/v1/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          currentUserId = userData?.id ?? null;
        }
      } catch {}

      const cacheKey = detailCacheKey(currentUserId, periodDays);
      const cached = readDetailCache(cacheKey);
      if (cached) {
        setStatus(cached.status);
        setRisk(cached.risk);
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

        if (!statusData.is_completed) {
          setRisk(null);
          setLogs([]);
          writeDetailCache(cacheKey, { status: statusData, risk: null, logs: [] });
          return;
        }

        const dates = getLastNDates(periodDays);
        const [riskRes, ...dailyResponses] = await Promise.allSettled([
          api('/api/v1/risk/current'),
          ...dates.map((date) => api(`/api/v1/health/daily/${date}`)),
        ]);
        if (cancelled) return;

        const nextRisk = riskRes.status === 'fulfilled' && riskRes.value.ok ? await riskRes.value.json() : null;
        const dailyLogs = await Promise.all(
          dailyResponses.map(async (res, index) => {
            if (res.status !== 'fulfilled' || !res.value.ok) return { log_date: dates[index] };
            return res.value.json();
          }),
        );
        if (cancelled) return;

        setRisk(nextRisk);
        setLogs(dailyLogs);
        writeDetailCache(cacheKey, { status: statusData, risk: nextRisk, logs: dailyLogs });
      } catch (err) {
        console.error('report_detail_load_failed', err);
        if (!cancelled) {
          setError('상세 리포트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
          setRisk(null);
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [periodDays]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => clearDetailCaches();
    window.addEventListener('danaa:report-cache-refresh', handler);
    return () => window.removeEventListener('danaa:report-cache-refresh', handler);
  }, []);

  const hasOnboarding = Boolean(status?.is_completed);

  if (!loaded) {
    return (
      <div className="flex h-full flex-col bg-[#F4F6F8]">
        <header className="flex h-12 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
          <span className="text-[14px] font-medium text-[#111827]">리포트</span>
        </header>
        <ReportTabs />
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#F4F6F8]">
      <header className="flex h-12 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
        <span className="text-[14px] font-medium text-[#111827]">리포트</span>
      </header>
      <ReportTabs />

      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarGutter: 'stable' }}>
        <main className="mx-auto max-w-[1260px] space-y-8">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-[#FEE2E2] px-4 py-3 text-[13px] text-[#DC2626]">
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          {!hasOnboarding ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-[#F1F5F9]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF]">
                <BarChart3 size={20} className="text-[#2563EB]" />
              </div>
              <div className="mt-4 text-[18px] font-semibold text-[#111827]">건강 설문을 완료하면 상세 리포트를 볼 수 있습니다</div>
              <div className="mt-2 text-[13px] leading-6 text-[#6B7280]">
                기본 정보와 생활 기록이 있어야 결과에 반영된 항목을 자세히 보여드릴 수 있습니다.
              </div>
              <Link href="/onboarding/diabetes"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#2563EB] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]">
                설문 시작하기
              </Link>
            </div>
          ) : (
            <>
              {/* 1. 한줄 진단 */}
              <DiagnosisBanner risk={risk} logs={logs} />
              {/* 2. 종합 점수 */}
              <SummarySection risk={risk} />
              {/* 3. 핵심 문제 TOP3 */}
              <TopIssuesSection risk={risk} logs={logs} />
              {/* 4. 반영된 기록 */}
              <UsedRecordsSection status={status} risk={risk} logs={logs} />
              {/* 5. 개선 가이드 */}
              <ImprovementGuideSection risk={risk} />
              {/* 6. 기록 추이 */}
              <TrendSection logs={logs} periodDays={periodDays} onPeriodChange={setPeriodDays} risk={risk} />
              {/* 7. 점수 구성 */}
              <ScoreSection risk={risk} />
              {/* 8. 기록 완성도 */}
              <CompletenessSection logs={logs} periodDays={periodDays} />
              {/* 9. 추천 챌린지 */}
              <RecommendedChallengesSection risk={risk} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
