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

function seriesToPoints(series, maxValue, width = 640, height = 170) {
  const left = 40, right = 16, top = 14, bottom = 28;
  return series.map((value, i) => {
    const x = left + i * ((width - left - right) / Math.max(1, series.length - 1));
    if (value == null) return [x, null];
    return [x, height - bottom - (value / maxValue) * (height - top - bottom)];
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
  const currentSeries  = useMemo(() => buildSeries(currentLogs, category),  [currentLogs, category]);
  const previousSeries = useMemo(() => buildSeries(previousLogs, category), [previousLogs, category]);
  const labels         = useMemo(() => currentLogs.map((l) => formatDateLabel(l.log_date)), [currentLogs]);
  const maxValue       = useMemo(() => maxSeriesValue([currentSeries, previousSeries]), [currentSeries, previousSeries]);
  const currentPoints  = useMemo(() => seriesToPoints(currentSeries, maxValue),  [currentSeries, maxValue]);
  const previousPoints = useMemo(() => seriesToPoints(previousSeries, maxValue), [previousSeries, maxValue]);
  const smoothPath     = useMemo(() => buildSmoothPath(currentPoints),  [currentPoints]);
  const areaPath       = useMemo(() => buildAreaPath(currentPoints, 142), [currentPoints]);
  const gradId         = `grad-${category}`;

  const delta   = comparison?.delta_pct;
  const isUp    = (delta ?? 0) > 0;
  const isDown  = (delta ?? 0) < 0;

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

      <svg width="100%" viewBox="0 0 640 170" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={meta.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <line x1="40" y1="142" x2="624" y2="142" stroke="#e7e5e4" />
        <line x1="40" y1="88"  x2="624" y2="88"  stroke="#f5f5f4" strokeDasharray="4 4" />
        <line x1="40" y1="34"  x2="624" y2="34"  stroke="#f5f5f4" strokeDasharray="4 4" />

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
            const x = currentPoints[i]?.[0] ?? 0;
            const y = currentPoints[i]?.[1] ?? 142;
            return (
              <rect key={`bar-${i}`} x={x - 7} y={y} width="14" height={Math.max(0, 142 - y)} rx="4"
                fill={meta.color} opacity="0.8" />
            );
          })
        ) : (
          <>
            {areaPath   && <path d={areaPath}   fill={`url(#${gradId})`} />}
            {smoothPath && <path d={smoothPath} fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {currentPoints.map(([x, y], i) =>
              y == null ? null : (
                <g key={`pt-${i}`}>
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
      </svg>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-4 text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: meta.color }} />
            현재
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-stone-300" />
            이전
          </div>
        </div>
        <div className="text-[12px] text-stone-500">
          {categoryInterpretation(meta, comparison)}
        </div>
      </div>
    </section>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const [periodDays, setPeriodDays] = useState(7);
  const [status,  setStatus]  = useState(null);
  const [summary, setSummary] = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [loaded,  setLoaded]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    async function load() {
      setLoaded(false); setError('');
      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
        const statusData = await statusRes.json();
        setStatus(statusData);

        if (statusData.is_completed) {
          const dates = getLastNDates(periodDays * 2);
          const [summaryRes, ...dailyResponses] = await Promise.allSettled([
            api(`/api/v1/analysis/summary?period=${periodDays}`),
            ...dates.map((date) => api(`/api/v1/health/daily/${date}`)),
          ]);
          setSummary(summaryRes.status === 'fulfilled' && summaryRes.value.ok ? await summaryRes.value.json() : null);
          const dailyLogs = await Promise.all(
            dailyResponses.map(async (res, i) => {
              if (res.status !== 'fulfilled' || !res.value.ok) return { log_date: dates[i] };
              return res.value.json();
            }),
          );
          setLogs(dailyLogs);
          if (summaryRes.status === 'rejected' || !summaryRes.value?.ok) setError('일부 데이터를 불러오지 못했어요.');
        }
      } catch (err) {
        console.error('report_detail_load_failed', err);
        setError('상세 리포트를 불러오지 못했어요.');
        setSummary(null); setLogs([]);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [periodDays]);

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
