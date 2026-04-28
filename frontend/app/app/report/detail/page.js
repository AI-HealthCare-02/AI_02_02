'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Droplets,
  Leaf,
  Moon,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import { api } from '../../../../hooks/useApi';

const DETAIL_CACHE_PREFIX = 'danaa:report:detail:v4';
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const SLEEP_HOURS = {
  under_5: 4.5, between_5_6: 5.5, between_6_7: 6.5, between_7_8: 7.5, over_8: 8.5,
};

function scoreDiet(log) {
  let score = 0, hasAny = false;
  if (log.vegetable_intake_level) { score += log.vegetable_intake_level === 'enough' ? 35 : 20; hasAny = true; }
  if (log.meal_balance_level) { score += log.meal_balance_level === 'balanced' ? 35 : log.meal_balance_level === 'protein_veg_heavy' ? 25 : 10; hasAny = true; }
  if (log.sweetdrink_level) { score += log.sweetdrink_level === 'none' ? 15 : 8; hasAny = true; }
  if (log.nightsnack_level) { score += log.nightsnack_level === 'none' ? 15 : 8; hasAny = true; }
  return hasAny ? score : null;
}

function buildSeries(logs, category) {
  if (category === 'sleep') return logs.map((l) => SLEEP_HOURS[l.sleep_duration_bucket] ?? null);
  if (category === 'diet') return logs.map((l) => scoreDiet(l));
  if (category === 'exercise') return logs.map((l) => (l.exercise_done || (l.exercise_minutes || 0) > 0 ? (l.exercise_minutes || 30) : 0));
  return [];
}

function average(values) {
  const valid = values.filter((v) => v != null);
  if (!valid.length) return null;
  return Number((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1));
}

function dailyScore(log) {
  const vals = [];
  const sh = SLEEP_HOURS[log.sleep_duration_bucket];
  if (sh != null) vals.push(Math.min(100, Math.round((sh / 8) * 100)));
  const ds = scoreDiet(log);
  if (ds != null) vals.push(ds);
  if (log.exercise_done !== undefined || log.exercise_minutes !== undefined) {
    const hasEx = log.exercise_done || (log.exercise_minutes || 0) > 0;
    vals.push(hasEx ? Math.min(100, Math.round(((log.exercise_minutes || 30) / 60) * 100)) : 0);
  }
  return vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
}

function getLastNDates(days) {
  const today = new Date();
  return Array.from({ length: days }, (_, offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - offset));
    return d.toISOString().slice(0, 10);
  });
}

// ── 캐시 ────────────────────────────────────────────────────────────────────

function cacheKey(userId) {
  return userId == null ? null : `${DETAIL_CACHE_PREFIX}:u${userId}`;
}
function readCache(key) {
  if (typeof window === 'undefined' || !key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > DETAIL_CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch { return null; }
}
function writeCache(key, payload) {
  if (typeof window === 'undefined' || !key) return;
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), payload })); } catch {}
}
function clearCaches() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(`${DETAIL_CACHE_PREFIX}:`)).forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

// ── 색상 헬퍼 ───────────────────────────────────────────────────────────────

function tone(score) {
  if (score == null) return { label: '기록 부족', color: '#9CA3AF', bg: '#F3F4F6' };
  if (score >= 70) return { label: '양호', color: '#10B981', bg: '#D1FAE5' };
  if (score >= 40) return { label: '주의', color: '#F59E0B', bg: '#FEF3C7' };
  return { label: '개선 필요', color: '#EF4444', bg: '#FEE2E2' };
}

function predTone(score) {
  if (score == null) return { label: '미측정', color: '#9CA3AF', bg: '#F3F4F6' };
  if (score < 40) return { label: '안정', color: '#10B981', bg: '#D1FAE5' };
  if (score < 70) return { label: '주의', color: '#F59E0B', bg: '#FEF3C7' };
  return { label: '위험', color: '#EF4444', bg: '#FEE2E2' };
}

// ── 카테고리 설정 ────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  sleep: {
    key: 'sleep', label: '수면', Icon: Moon, scoreKey: 'sleep_score', color: '#6366F1',
    formatAvg: (v) => v != null ? `${v}시간` : '-',
    goodDesc: (v) => v == null ? '기록이 부족해요' : v >= 7 ? '권장 수면 시간을 지키고 있어요' : v >= 6 ? '수면이 다소 부족해요 (권장 7시간)' : '수면 시간이 부족해요',
    problems: (score, avg) => {
      if (avg != null && avg < 6) return ['수면 시간이 심각하게 부족합니다 (6시간 미만)', '수면 부족은 혈당 조절 호르몬 균형을 깨뜨립니다'];
      if (avg != null && avg < 7) return ['수면 시간이 다소 부족합니다 (권장 7시간 이상)', '취침 시간이 불규칙합니다'];
      if (score != null && score < 70) return ['수면 패턴이 불규칙합니다'];
      return ['현재 수면 상태가 양호합니다'];
    },
    solutions: () => ['매일 같은 시간에 취침하는 루틴 만들기', '취침 1시간 전 스마트폰 사용 줄이기', '목표: 23시 이전 취침, 7시간 이상 수면'],
  },
  exercise: {
    key: 'exercise', label: '운동', Icon: Activity, scoreKey: 'exercise_score', color: '#10B981',
    formatAvg: (v) => v != null ? `${Math.round(v)}분` : '-',
    goodDesc: (v) => v == null ? '기록이 부족해요' : v > 30 ? '충분한 운동을 하고 있어요' : v > 0 ? '운동량이 다소 부족해요' : '운동 기록이 없어요',
    problems: (score, avg) => {
      if (avg === 0 || avg == null) return ['최근 운동 기록이 없습니다', '신체 활동 부족은 혈당 조절에 직접 영향을 줍니다'];
      if (avg < 30) return ['운동량이 부족합니다 (권장 30분 이상)', '활동량 부족은 당뇨 위험 점수에 반영됩니다'];
      return ['운동 상태가 양호합니다'];
    },
    solutions: () => ['하루 30분 빠르게 걷기', '엘리베이터 대신 계단 이용하기', '목표: 주 5일 이상 유산소 운동'],
  },
  diet: {
    key: 'diet', label: '식단', Icon: UtensilsCrossed, scoreKey: 'diet_score', color: '#F59E0B',
    formatAvg: (v) => v != null ? `${Math.round(v)}점` : '-',
    goodDesc: (v) => v == null ? '기록이 부족해요' : v >= 70 ? '균형 잡힌 식습관을 유지하고 있어요' : v >= 40 ? '식습관 개선이 필요해요' : '식습관이 불균형해요',
    problems: (score) => {
      if (score != null && score < 40) return ['식습관이 전반적으로 불균형합니다', '불규칙한 식사가 혈당 스파이크를 유발할 수 있습니다'];
      if (score != null && score < 70) return ['채소 섭취가 부족합니다', '단음료·야식 섭취를 줄이는 것이 좋습니다'];
      return ['식습관 상태가 양호합니다'];
    },
    solutions: () => ['매 끼니 채소 한 접시 추가하기', '단음료 대신 물 또는 무가당 음료 선택', '목표: 균형 잡힌 식사, 야식 줄이기'],
  },
};

// ── 공통 탭 ──────────────────────────────────────────────────────────────────

function ReportTabs() {
  return (
    <div className="shrink-0 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex w-full max-w-[960px] gap-0 px-5">
        <Link href="/app/report" className="inline-flex items-center border-b-2 border-transparent px-5 py-3 text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]">
          대시보드
        </Link>
        <div className="inline-flex items-center border-b-2 border-[#2563EB] px-5 py-3 text-[14px] font-semibold text-[#111827]">
          상세 리포트
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF]">
          <BarChart3 size={18} className="text-[#2563EB]" />
        </div>
        <div className="text-[15px] font-semibold text-[#111827]">리포트를 불러오는 중</div>
      </div>
    </div>
  );
}

// ── 1. 상단 요약 ──────────────────────────────────────────────────────────────

function SummaryHeader({ risk }) {
  const pred = risk?.predicted_score_pct;
  const findrisc = risk?.findrisc_score;
  const pt = predTone(pred);

  const sleep = risk?.sleep_score;
  const diet = risk?.diet_score;
  const exercise = risk?.exercise_score;

  const issues = [];
  if (exercise != null && exercise < 70) issues.push('운동 부족');
  if (sleep != null && sleep < 70) issues.push(sleep < 40 ? '수면 부족' : '수면 불규칙');
  if (diet != null && diet < 70) issues.push(diet < 40 ? '식습관 불균형' : '채소 섭취 부족');

  const summary = issues.length
    ? `${issues.slice(0, 2).join(' · ')}이 주요 원인입니다`
    : pred != null && pred < 40 ? '전반적인 건강 상태가 안정적입니다'
    : '기록이 더 쌓이면 정확한 진단이 가능합니다';

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center gap-6">

        {/* 건강 위험도 게이지 */}
        <div className="flex items-center gap-4">
          <div className="relative h-[72px] w-[72px] shrink-0">
            <svg className="-rotate-90" width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="28" fill="none" stroke="#F1F5F9" strokeWidth="7" />
              <circle cx="36" cy="36" r="28" fill="none" stroke={pt.color} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${Math.max(0, Math.min(100, pred ?? 0)) / 100 * Math.PI * 56} ${Math.PI * 56}`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[18px] font-extrabold leading-none" style={{ color: pt.color }}>{pred ?? '-'}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">건강 위험도</div>
            <div className="mt-0.5 text-[22px] font-extrabold text-[#0F172A]">{pred != null ? `${pred}점` : '-'}</div>
            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: pt.color, backgroundColor: pt.bg }}>{pt.label}</span>
          </div>
        </div>

        <div className="hidden h-12 w-px bg-[#F1F5F9] sm:block" />

        {/* 당뇨 위험도 */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">당뇨 위험도 (FINDRISC)</div>
          <div className="mt-1 text-[22px] font-extrabold text-[#0F172A]">
            {findrisc != null ? `${findrisc}점` : '-'}
            <span className="ml-1 text-[13px] font-normal text-[#94A3B8]">/ 26</span>
          </div>
          <div className="text-[12px] text-[#64748B]">
            {findrisc != null ? (findrisc <= 7 ? '낮은 위험' : findrisc <= 14 ? '중간 위험' : '높은 위험') : '미측정'}
          </div>
        </div>

        <div className="hidden h-12 w-px bg-[#F1F5F9] sm:block" />

        {/* 한줄 요약 */}
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">한줄 요약</div>
          <div className="mt-1 text-[15px] font-semibold leading-snug text-[#0F172A]">{summary}</div>
          {issues.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {issues.map((issue) => (
                <span key={issue} className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E]">{issue}</span>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── 2. 건강 카드 (클릭 가능) ──────────────────────────────────────────────────

function HealthCard({ categoryKey, risk, logs, onClick }) {
  const cfg = CATEGORY_CONFIG[categoryKey];
  const { Icon, label, color, scoreKey } = cfg;
  const score = risk?.[scoreKey];
  const t = tone(score);

  const series = buildSeries(logs.slice(-7), categoryKey);
  const avg = average(series);

  const recent = series.slice(-3).filter((v) => v != null);
  const prev = series.slice(-6, -3).filter((v) => v != null);
  const ra = recent.length ? recent.reduce((a, b) => a + b) / recent.length : null;
  const pa = prev.length ? prev.reduce((a, b) => a + b) / prev.length : null;
  const trend = ra != null && pa != null ? (ra > pa + 0.5 ? '↑' : ra < pa - 0.5 ? '↓' : null) : null;
  const trendColor = trend === '↑' ? '#10B981' : '#EF4444';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-white p-5 shadow-[0_1px_6px_rgba(0,0,0,0.06)] text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)] cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-[#0F172A]">{label}</div>
            <div className="mt-0.5 text-[11px] text-[#64748B]">{cfg.goodDesc(avg)}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: t.color, backgroundColor: t.bg }}>{t.label}</span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[26px] font-extrabold" style={{ color }}>{cfg.formatAvg(avg)}</span>
        <span className="text-[11px] text-[#94A3B8]">7일 평균</span>
        {trend && <span className="ml-1 text-[13px] font-bold" style={{ color: trendColor }}>{trend}</span>}
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-[#F1F5F9]">
        <div className="h-full rounded-full transition-all" style={{ width: `${score == null ? 0 : Math.max(4, Math.min(100, score))}%`, backgroundColor: t.color }} />
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 text-[12px] font-semibold text-[#2563EB]">
        자세히 보기 <ChevronRight size={14} />
      </div>
    </button>
  );
}

// ── 3. 단일 변화 그래프 ───────────────────────────────────────────────────────

function TrendGraph({ logs }) {
  const scores = logs.map(dailyScore);
  const hasData = scores.some((v) => v != null);

  const trendDesc = (() => {
    const valid = scores.filter((v) => v != null);
    if (valid.length < 3) return null;
    const f1 = valid.slice(0, Math.floor(valid.length / 2)).reduce((a, b) => a + b) / Math.floor(valid.length / 2);
    const f2 = valid.slice(Math.floor(valid.length / 2)).reduce((a, b) => a + b) / Math.ceil(valid.length / 2);
    if (f2 > f1 + 3) return { text: '최근 상승 추세 ↑', color: '#10B981' };
    if (f2 < f1 - 3) return { text: '최근 감소 추세 ↓', color: '#EF4444' };
    return { text: '안정적인 흐름', color: '#64748B' };
  })();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-bold text-[#0F172A]">최근 7일 건강 변화</div>
        {trendDesc && <span className="text-[12px] font-semibold" style={{ color: trendDesc.color }}>{trendDesc.text}</span>}
      </div>
      <div className="text-[11px] text-[#94A3B8] mb-4">수면 · 식단 · 운동 기록을 종합한 일별 건강 점수입니다</div>

      {!hasData ? (
        <div className="flex h-[100px] items-center justify-center rounded-xl bg-[#F8FAFC] text-[12px] text-[#94A3B8]">
          일일 건강 기록을 남기면 변화 그래프가 나타납니다
        </div>
      ) : (
        <svg width="100%" viewBox="0 0 640 110" role="img" aria-label="7일 건강 변화">
          <line x1="40" y1="20" x2="600" y2="20" stroke="#F1F5F9" strokeDasharray="4 3" />
          <line x1="40" y1="55" x2="600" y2="55" stroke="#F1F5F9" strokeDasharray="4 3" />
          <line x1="40" y1="90" x2="600" y2="90" stroke="#E5E7EB" />
          {(() => {
            const pts = scores.map((v, i) => ({
              x: 40 + i * (scores.length === 1 ? 0 : 560 / (scores.length - 1)),
              y: v != null ? 90 - (Math.max(0, Math.min(100, v)) / 100) * 70 : null,
              date: logs[i]?.log_date,
            }));
            const valid = pts.filter((p) => p.y != null);
            const pathD = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return (
              <>
                {pathD && <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                {pts.map((p, i) => (
                  <g key={i}>
                    {p.y != null && <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#2563EB" strokeWidth="2" />}
                    <text x={p.x} y="106" textAnchor="middle" fontSize="9" fill="#94A3B8">
                      {String(p.date || '').slice(5)}
                    </text>
                  </g>
                ))}
              </>
            );
          })()}
        </svg>
      )}
    </div>
  );
}

// ── 4. 오늘의 행동 ────────────────────────────────────────────────────────────

function TodayActions({ risk }) {
  const sleep = risk?.sleep_score;
  const diet = risk?.diet_score;
  const exercise = risk?.exercise_score;

  const actions = [];
  if (exercise == null || exercise < 70) actions.push({ Icon: Activity, text: '30분 걷기', sub: '혈당을 낮추는 가장 쉬운 방법', color: '#10B981' });
  if (sleep == null || sleep < 70) actions.push({ Icon: Moon, text: '23시 이전 취침', sub: '수면 7시간 이상 확보가 목표', color: '#6366F1' });
  if (diet == null || diet < 70) actions.push({ Icon: Leaf, text: '채소 한 접시 추가', sub: '혈당 스파이크를 줄이는 핵심 습관', color: '#F59E0B' });
  if (actions.length < 3) actions.push({ Icon: Droplets, text: '물 1.5L 마시기', sub: '수분 섭취는 혈당 관리에 도움', color: '#3B82F6' });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
      <div className="text-[14px] font-bold text-[#0F172A] mb-1">오늘 이렇게 해보세요</div>
      <div className="text-[11px] text-[#94A3B8] mb-4">현재 상태를 기반으로 바로 시작할 수 있는 행동입니다</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {actions.slice(0, 3).map((action) => {
          const Icon = action.Icon;
          return (
            <div key={action.text} className="flex items-start gap-3 rounded-xl p-4" style={{ backgroundColor: `${action.color}0D` }}>
              <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${action.color}18` }}>
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
  );
}

// ── 5. 상세 모달 ──────────────────────────────────────────────────────────────

function MiniGraph({ series, color }) {
  const hasData = series.some((v) => v != null);
  if (!hasData) {
    return (
      <div className="flex h-[80px] items-center justify-center rounded-xl bg-[#F8FAFC] text-[11px] text-[#94A3B8]">
        기록 데이터가 없습니다
      </div>
    );
  }
  const max = Math.max(1, ...series.filter((v) => v != null));
  const n = series.length;
  const pts = series.map((v, i) => ({
    x: 20 + i * (n === 1 ? 0 : 260 / (n - 1)),
    y: v != null ? 60 - (Math.max(0, Math.min(max, v)) / max) * 45 : null,
  }));
  const valid = pts.filter((p) => p.y != null);
  const pathD = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg width="100%" viewBox="0 0 300 75" className="rounded-xl bg-[#F8FAFC]">
      {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => p.y != null && <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke={color} strokeWidth="1.5" />)}
    </svg>
  );
}

function DetailModal({ categoryKey, risk, logs, onClose }) {
  const cfg = CATEGORY_CONFIG[categoryKey];
  const { Icon, label, color, scoreKey } = cfg;
  const score = risk?.[scoreKey];
  const t = tone(score);
  const series = buildSeries(logs, categoryKey);
  const avg = average(series);
  const problems = cfg.problems(score, avg);
  const solutions = cfg.solutions();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <div className="text-[16px] font-bold text-[#0F172A]">{label} 상세</div>
              <div className="text-[11px] text-[#64748B]">최근 7일 기록 기반</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]">
            <X size={16} />
          </button>
        </div>

        {/* 평균 + 상태 */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[28px] font-extrabold" style={{ color }}>{cfg.formatAvg(avg)}</span>
          <span className="text-[12px] text-[#94A3B8]">7일 평균</span>
          <span className="ml-auto rounded-full px-3 py-1 text-[12px] font-bold" style={{ color: t.color, backgroundColor: t.bg }}>{t.label}</span>
        </div>

        {/* 그래프 */}
        <MiniGraph series={series} color={color} />

        {/* 문제 */}
        <div className="mt-5">
          <div className="mb-2.5 text-[12px] font-bold text-[#0F172A]">문제</div>
          <div className="space-y-2">
            {problems.map((p) => (
              <div key={p} className="flex items-start gap-2 rounded-xl bg-[#FEF9EC] px-3.5 py-2.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                <span className="text-[12px] text-[#374151]">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 해결 */}
        <div className="mt-4">
          <div className="mb-2.5 text-[12px] font-bold text-[#0F172A]">해결</div>
          <div className="space-y-2">
            {solutions.map((s) => (
              <div key={s} className="flex items-start gap-2 rounded-xl bg-[#F0FDF4] px-3.5 py-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#10B981] text-[9px] font-bold text-white">✓</div>
                <span className="text-[12px] text-[#374151]">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [risk, setRisk] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [modalCategory, setModalCategory] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      let userId = null;
      try {
        const r = await api('/api/v1/users/me');
        if (r.ok) { const d = await r.json(); userId = d?.id ?? null; }
      } catch {}

      const key = cacheKey(userId);
      const cached = readCache(key);
      if (cached) {
        setStatus(cached.status); setRisk(cached.risk); setLogs(cached.logs || []);
        setLoaded(true);
      }

      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
        const statusData = await statusRes.json();
        if (cancelled) return;
        setStatus(statusData);

        if (!statusData.is_completed) {
          setRisk(null); setLogs([]);
          writeCache(key, { status: statusData, risk: null, logs: [] });
          return;
        }

        const dates = getLastNDates(7);
        const [riskRes, ...dailyRes] = await Promise.allSettled([
          api('/api/v1/risk/current'),
          ...dates.map((d) => api(`/api/v1/health/daily/${d}`)),
        ]);
        if (cancelled) return;

        const nextRisk = riskRes.status === 'fulfilled' && riskRes.value.ok ? await riskRes.value.json() : null;
        const dailyLogs = await Promise.all(
          dailyRes.map(async (r, i) => r.status === 'fulfilled' && r.value.ok ? r.value.json() : { log_date: dates[i] }),
        );
        if (cancelled) return;

        setRisk(nextRisk); setLogs(dailyLogs);
        writeCache(key, { status: statusData, risk: nextRisk, logs: dailyLogs });
      } catch (err) {
        console.error('report_detail_load_failed', err);
        if (!cancelled) setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => clearCaches();
    window.addEventListener('danaa:report-cache-refresh', handler);
    return () => window.removeEventListener('danaa:report-cache-refresh', handler);
  }, []);

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

  const hasOnboarding = Boolean(status?.is_completed);

  return (
    <div className="flex h-full flex-col bg-[#F4F6F8]">
      <header className="flex h-12 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
        <span className="text-[14px] font-medium text-[#111827]">리포트</span>
      </header>
      <ReportTabs />

      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarGutter: 'stable' }}>
        <main className="mx-auto max-w-[960px] space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-[#FEE2E2] px-4 py-3 text-[13px] text-[#DC2626]">
              <AlertTriangle size={13} />{error}
            </div>
          )}

          {!hasOnboarding ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF]">
                <BarChart3 size={20} className="text-[#2563EB]" />
              </div>
              <div className="mt-4 text-[18px] font-semibold text-[#111827]">건강 설문을 완료하면 상세 리포트를 볼 수 있습니다</div>
              <div className="mt-2 text-[13px] leading-6 text-[#6B7280]">기본 정보와 생활 기록이 있어야 결과를 자세히 보여드릴 수 있습니다.</div>
              <Link href="/onboarding/diabetes" className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#2563EB] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]">
                설문 시작하기
              </Link>
            </div>
          ) : (
            <>
              <SummaryHeader risk={risk} />

              <div className="grid gap-3 sm:grid-cols-3">
                {['sleep', 'exercise', 'diet'].map((cat) => (
                  <HealthCard key={cat} categoryKey={cat} risk={risk} logs={logs} onClick={() => setModalCategory(cat)} />
                ))}
              </div>

              <TrendGraph logs={logs} />

              <TodayActions risk={risk} />
            </>
          )}
        </main>
      </div>

      {modalCategory && (
        <DetailModal
          categoryKey={modalCategory}
          risk={risk}
          logs={logs}
          onClose={() => setModalCategory(null)}
        />
      )}
    </div>
  );
}