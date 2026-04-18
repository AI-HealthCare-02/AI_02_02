'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, ArrowRight, CheckCircle, Droplets, Moon, Sparkles, TrendingDown, TrendingUp, UtensilsCrossed } from 'lucide-react';

import { api } from '../../../hooks/useApi';

const TREND_MODES = [
  { key: 'findrisc', label: '생활습관' },
  { key: 'ai',       label: 'AI 예측' },
];

// 카테고리별 색상 — 구분감 있게
const HEALTH_META = {
  sleep:     { label: '수면',  icon: Moon,            color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-500' },
  diet:      { label: '식사',  icon: UtensilsCrossed, color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-500'  },
  exercise:  { label: '운동',  icon: Activity,        color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-500'},
  hydration: { label: '수분',  icon: Droplets,        color: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-500'   },
};

// ── 위험도 색상 시스템 ─────────────────────────────────────────────────────────
// FINDRISC(0~26)와 AI 예측(0~100) 모두 동일한 레벨 기준으로 통일
function getFindriscLevel(score) {
  if (score == null) return 'none';
  if (score <= 3)  return 'low';      // 안전
  if (score <= 8)  return 'low';      // 보통
  if (score <= 12) return 'medium';   // 주의
  if (score <= 20) return 'high';     // 위험
  return 'critical';                  // 고위험
}

function getModelLevel(pct) {
  if (pct == null) return 'none';
  if (pct < 20)  return 'low';        // 정상
  if (pct < 40)  return 'medium';     // 전단계
  if (pct < 65)  return 'high';       // 위험
  return 'critical';                  // 고위험
}

const RISK_LABEL = {
  none:     '측정 전',
  low:      '정상',
  medium:   '주의',
  high:     '위험',
  critical: '고위험',
};

const RISK_STYLES = {
  none:     { bar: 'bg-stone-300',   track: 'bg-stone-100',  badge: 'bg-stone-100 text-stone-500',    border: 'border-stone-100',  color: '#a8a29e' },
  low:      { bar: 'bg-emerald-400', track: 'bg-emerald-50', badge: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200', color: '#10b981' },
  medium:   { bar: 'bg-amber-400',   track: 'bg-amber-50',   badge: 'bg-amber-50 text-amber-700',    border: 'border-amber-200',  color: '#f59e0b' },
  high:     { bar: 'bg-orange-400',  track: 'bg-orange-50',  badge: 'bg-orange-50 text-orange-700',  border: 'border-orange-200', color: '#f97316' },
  critical: { bar: 'bg-red-500',     track: 'bg-red-50',     badge: 'bg-red-50 text-red-700',        border: 'border-red-200',    color: '#ef4444' },
};

function getFindriscLabel(score) {
  return RISK_LABEL[getFindriscLevel(score)];
}

function formatValue(category, value) {
  if (value == null) return '-';
  if (category === 'sleep')     return `${value.toFixed(1)}h`;
  if (category === 'diet')      return `${Math.round(value)}점`;
  if (category === 'exercise')  return `${Math.round(value)}회`;
  if (category === 'hydration') return `${value.toFixed(1)}L`;
  return `${value}`;
}

function formatAvgLabel(category, value) {
  if (value == null) return '기록 없음';
  if (category === 'sleep')     return `평균 ${value.toFixed(1)}시간`;
  if (category === 'hydration') return `평균 ${value.toFixed(1)}L`;
  if (category === 'exercise')  return `평균 ${value.toFixed(1)}회`;
  if (category === 'diet')      return `평균 ${Math.round(value)}점`;
  return `${value}`;
}

function buildTrendPoints(history) {
  const recent = (history || []).slice(-7);
  if (!recent.length) return [];
  return recent.map((item, i) => {
    const x        = 56 + i * (recent.length === 1 ? 0 : 568 / (recent.length - 1));
    const model    = item.predicted_score_pct;
    const findrisc = item.findrisc_score ?? 0;
    return {
      x,
      label:     String(item.period_end).slice(5),
      model,
      findrisc,
      yModel:    model == null ? null : 160 - (Math.min(100, Math.max(0, model)) / 100) * 110,
      yFindrisc: 160 - (Math.min(26, Math.max(0, findrisc)) / 26) * 110,
    };
  });
}

function buildSmoothPath(points) {
  const valid = points.filter(([, y]) => y != null);
  if (valid.length < 2) return '';
  let d = `M ${valid[0][0]},${valid[0][1]}`;
  for (let i = 1; i < valid.length; i++) {
    const [x0, y0] = valid[i - 1];
    const [x1, y1] = valid[i];
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
    const [x0, y0] = valid[i - 1];
    const [x1, y1] = valid[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  d += ` L ${valid.at(-1)[0]},${baseY} Z`;
  return d;
}

function getTrendInsight(points, mode, summary) {
  if (summary?.impact_analysis?.length) {
    const top = summary.impact_analysis[0];
    if (top?.contribution_pct > 0) return `${top.label} 관리가 위험도에 가장 큰 영향을 주고 있어요.`;
  }
  if (points.length < 2) return '기록이 더 쌓이면 변화 흐름을 보여드릴게요.';
  const first = mode === 'ai' ? points[0]?.model    : points[0]?.findrisc;
  const last  = mode === 'ai' ? points.at(-1)?.model : points.at(-1)?.findrisc;
  if (first == null || last == null) return '최근 기록을 바탕으로 흐름을 분석하고 있어요.';
  const diff = last - first;
  if (diff > 0) return '최근 7일간 위험도가 올라갔어요. 생활습관을 점검해보세요.';
  if (diff < 0) return '최근 7일간 위험도가 내려가고 있어요. 잘 하고 계세요!';
  return '최근 7일간 위험도가 안정적으로 유지되고 있어요.';
}

// ── 탭 ───────────────────────────────────────────────────────────────────────

function ReportTabs() {
  return (
    <div className="border-b border-black/[.06]">
      <div className="mx-auto flex max-w-[1080px] gap-1 px-6">
        <div className="inline-flex items-center border-b-2 border-nature-500 px-5 py-3 text-[14px] font-semibold text-nature-900">
          대시보드
        </div>
        <Link
          href="/app/report/detail"
          className="inline-flex cursor-pointer items-center border-b-2 border-transparent px-5 py-3 text-[14px] font-semibold text-neutral-500 transition-colors hover:text-nature-800"
        >
          상세 리포트
        </Link>
      </div>
    </div>
  );
}

// ── 위험도 게이지 카드 ─────────────────────────────────────────────────────────

function RiskGaugeCard({ title, value, total, label, badge, level }) {
  const progress = Math.max(0, Math.min(100, (Number(value ?? 0) / Number(total || 1)) * 100));
  const style    = RISK_STYLES[level ?? 'none'];

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">{title}</div>
          <div className="mt-0.5 text-[13px] text-stone-500">{label}</div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${style.badge}`}>{badge}</span>
      </div>

      <div className="mt-4 flex items-end gap-1">
        <span className="text-[38px] font-bold leading-none text-stone-800">{value ?? '-'}</span>
        <span className="mb-1 text-[14px] text-stone-400">/ {total}</span>
      </div>

      <div className={`mt-4 h-2.5 overflow-hidden rounded-full ${style.track}`}>
        <div className={`h-full rounded-full transition-all duration-700 ${style.bar}`} style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-stone-400">
        <span>안전</span>
        <span className="font-medium">{Math.round(progress)}%</span>
        <span>위험</span>
      </div>
    </div>
  );
}

// ── 트렌드 토글 ───────────────────────────────────────────────────────────────

function TrendToggle({ activeMode, onChange, aiEnabled }) {
  return (
    <div className="inline-flex rounded-full bg-stone-100 p-1">
      {TREND_MODES.map((mode) => {
        const disabled = mode.key === 'ai' && !aiEnabled;
        const active   = activeMode === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => !disabled && onChange(mode.key)}
            disabled={disabled}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all ${
              active ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400'
            } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 트렌드 차트 ───────────────────────────────────────────────────────────────

function TrendChart({ points, mode, activeLevel }) {
  const isAi  = mode === 'ai';
  const color = RISK_STYLES[activeLevel ?? 'none'].color;
  const series = points.map((p) => [p.x, isAi ? p.yModel : p.yFindrisc]);
  const values = points.map((p) => (isAi ? p.model : p.findrisc));
  const smoothPath = buildSmoothPath(series);
  const areaPath   = buildAreaPath(series, 160);
  const gradId     = `grad-${mode}`;

  return (
    <svg width="100%" viewBox="0 0 680 195" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* 그리드 */}
      <line x1="48" y1="50"  x2="632" y2="50"  stroke="#f5f5f4" strokeDasharray="4 4" />
      <line x1="48" y1="105" x2="632" y2="105" stroke="#f5f5f4" strokeDasharray="4 4" />
      <line x1="48" y1="160" x2="632" y2="160" stroke="#e7e5e4" />

      {/* 영역 */}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

      {/* 곡선 */}
      {smoothPath && (
        <path d={smoothPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* 포인트 */}
      {points.map((p, i) => {
        const y = isAi ? p.yModel : p.yFindrisc;
        if (y == null) return null;
        const isLast = i === points.length - 1;
        return (
          <g key={`pt-${i}`}>
            {isLast && <circle cx={p.x} cy={y} r="16" fill={color} opacity="0.08" />}
            <circle cx={p.x} cy={y} r="4.5" fill="white" stroke={color} strokeWidth="2.5" />
            <text x={p.x} y={y - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
              {isAi ? `${values[i]}%` : values[i]}
            </text>
            <text x={p.x} y="182" textAnchor="middle" fontSize="11" fill="#a8a29e">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 건강 요약 카드 ─────────────────────────────────────────────────────────────

function HealthSummaryCard({ category, item }) {
  const { label, icon: Icon, color, bg, text } = HEALTH_META[category];
  const avgValue = item?.current_value;
  const progress = Math.max(6, Math.min(100, Number(item?.score ?? 0)));
  const delta    = item?.delta_pct;
  const isUp     = (delta ?? 0) > 0;
  const isDown   = (delta ?? 0) < 0;

  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
          <Icon size={15} className={text} />
        </div>
        {delta != null && (
          <div className={`flex items-center gap-0.5 text-[12px] font-semibold ${isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-stone-400'}`}>
            {isUp   && <TrendingUp size={12} />}
            {isDown && <TrendingDown size={12} />}
            {isUp ? '+' : ''}{delta}%
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-[11px] text-stone-400">{label}</div>
        <div className={`mt-0.5 text-[26px] font-bold leading-none ${avgValue != null ? 'text-stone-800' : 'text-stone-300'}`}>
          {formatValue(category, avgValue ?? null)}
        </div>
        <div className="mt-1 text-[11px] text-stone-400">{formatAvgLabel(category, avgValue ?? null)}</div>
      </div>

      <div className="mt-3 h-1 rounded-full bg-stone-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

// 로딩 단계 메시지
const LOAD_STEPS = [
  { key: 'init',     label: '건강 데이터 불러오는 중...',     icon: '📋' },
  { key: 'risk',     label: 'AI가 위험도를 계산하고 있어요', icon: '🤖' },
  { key: 'history',  label: '변화 추이 분석 중...',           icon: '📈' },
  { key: 'summary',  label: '건강 요약 정리 중...',           icon: '✅' },
];

function LoadingScreen({ step }) {
  const current = LOAD_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      {/* 스피너 */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <svg className="absolute inset-0 animate-spin" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" stroke="#e7e5e4" strokeWidth="4" />
          <path d="M32 4 a28 28 0 0 1 28 28" stroke="#78716c" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="text-2xl">{LOAD_STEPS[Math.max(0, current)].icon}</span>
      </div>

      {/* 현재 단계 메시지 */}
      <div className="text-center">
        <div className="text-[16px] font-semibold text-stone-700">
          {LOAD_STEPS[Math.max(0, current)].label}
        </div>
        <div className="mt-1 text-[13px] text-stone-400">잠깐만 기다려주세요</div>
      </div>

      {/* 단계 진행 바 */}
    </div>
  );
}

export default function ReportPage() {
  const [status,    setStatus]    = useState(null);
  const [risk,      setRisk]      = useState(null);
  const [history,   setHistory]   = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loaded,    setLoaded]    = useState(false);
  const [loadStep,  setLoadStep]  = useState('init');
  const [error,     setError]     = useState('');
  const [trendMode, setTrendMode] = useState('findrisc');

  useEffect(() => {
    async function load() {
      setError('');
      try {
        setLoadStep('init');
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
        const statusData = await statusRes.json();
        setStatus(statusData);

        if (statusData.is_completed) {
          setLoadStep('risk');
          const riskRes = await api('/api/v1/risk/recalculate', { method: 'POST' });
          setRisk(riskRes.ok ? await riskRes.json() : null);

          setLoadStep('history');
          const historyRes = await api('/api/v1/risk/history?weeks=7');
          if (historyRes.ok) setHistory((await historyRes.json()).history || []);

          setLoadStep('summary');
          const summaryRes = await api('/api/v1/analysis/summary?period=7');
          setSummary(summaryRes.ok ? await summaryRes.json() : null);
        }
      } catch (err) {
        console.error('report_dashboard_load_failed', err);
        setError('데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!risk?.model_enabled && trendMode === 'ai') setTrendMode('findrisc');
  }, [risk, trendMode]);

  const hasOnboarding = Boolean(status?.is_completed);
  const trendPoints   = useMemo(() => buildTrendPoints(history), [history]);
  const hasTrend      = useMemo(() => {
    if (trendMode === 'ai') return trendPoints.filter((p) => p.yModel != null).length > 1;
    return trendPoints.length > 1;
  }, [trendMode, trendPoints]);
  const comparisonMap = useMemo(
    () => Object.fromEntries((summary?.comparisons || []).map((item) => [item.key, item])),
    [summary],
  );
  const trendInsight  = useMemo(() => getTrendInsight(trendPoints, trendMode, summary), [trendMode, trendPoints, summary]);
  const findriscLevel = getFindriscLevel(risk?.findrisc_score);
  const modelLevel    = getModelLevel(risk?.predicted_score_pct);
  const findriscBadge = RISK_LABEL[findriscLevel];
  const modelBadge    = risk ? RISK_LABEL[modelLevel] : '분석 중';
  const activeLevel   = trendMode === 'ai' ? modelLevel : findriscLevel;

  if (!loaded) {
    return (
      <div className="theme-report-page flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-[#F5F5F4] bg-white px-4">
          <span className="text-[14px] font-medium text-nature-900">리포트</span>
        </header>
        <ReportTabs />
        <LoadingScreen step={loadStep} />
      </div>
    );
  }

  return (
    <div className="theme-report-page flex h-full flex-col">
      <header className="h-12 shrink-0 border-b border-[#F5F5F4] bg-white px-4">
        <div className="flex h-full items-center text-[14px] font-medium text-stone-700">리포트</div>
      </header>
      <ReportTabs />

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="mx-auto max-w-[1080px]">
          <main className="min-w-0 space-y-6">

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-500">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {/* 온보딩 미완료 */}
          {!hasOnboarding && (
            <section className="rounded-2xl border border-stone-100 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
                <Sparkles size={20} className="text-stone-400" />
              </div>
              <div className="mt-4 text-[22px] font-semibold text-stone-800">
                건강 설문을 완료하면 리포트를 볼 수 있어요
              </div>
              <div className="mt-2 text-[13px] leading-7 text-stone-400">
                설문 완료 후 당뇨 위험도와 생활습관 분석 결과를 바로 확인할 수 있어요.
              </div>
              <Link
                href="/onboarding/diabetes"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-stone-800 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-stone-700"
              >
                설문 시작하기 <ArrowRight size={14} />
              </Link>
            </section>
          )}

          {hasOnboarding && (
            <>
              {/* 위험도 카드 2개 */}
              <div className="grid gap-4 lg:grid-cols-2">
                <RiskGaugeCard
                  title="생활습관 위험도"
                  value={risk?.findrisc_score}
                  total={26}
                  label="FINDRISC 기반 당뇨 위험 점수"
                  level={findriscLevel}
                  badge={findriscBadge}
                />
                <RiskGaugeCard
                  title="AI 예측 위험도"
                  value={risk?.predicted_score_pct}
                  total={100}
                  label="AI가 분석한 발병 가능성"
                  level={modelLevel}
                  badge={modelBadge}
                />
              </div>

              {/* 변화 추이 */}
              <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-stone-800">위험도 변화 추이</div>
                    <div className="text-[12px] text-stone-400">최근 7일</div>
                  </div>
                  <TrendToggle activeMode={trendMode} onChange={setTrendMode} aiEnabled={Boolean(risk?.model_enabled)} />
                </div>

                {hasTrend ? (
                  <>
                    <TrendChart points={trendPoints} mode={trendMode} activeLevel={activeLevel} />
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-stone-50 px-4 py-3 text-[13px] text-stone-500">
                      {activeLevel === 'low'
                        ? <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                        : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                      }
                      {trendInsight}
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-stone-50 py-10 text-center text-[13px] text-stone-400">
                    기록이 더 쌓이면 변화 흐름을 보여드릴게요.
                  </div>
                )}
              </section>

              {/* 건강 요약 4개 카드 */}
              <section className="pt-2">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[15px] font-semibold text-stone-800">최근 7일 건강 요약</div>
                  <Link
                    href="/app/report/detail"
                    className="flex items-center gap-1 text-[13px] font-medium text-stone-400 hover:text-stone-700"
                  >
                    자세히 보기 <ArrowRight size={13} />
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {Object.keys(HEALTH_META).map((category) => (
                    <HealthSummaryCard key={category} category={category} item={comparisonMap[category]} />
                  ))}
                </div>
              </section>
            </>
          )}

          </main>
        </div>
      </div>
    </div>
  );
}
