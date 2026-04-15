'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3 as BarChartIcon } from 'lucide-react';

import { api } from '../../../../hooks/useApi';

const CATEGORY_ORDER = ['sleep', 'diet', 'exercise', 'hydration'];
const CATEGORY_META = {
  sleep: { label: '수면', accent: 'bg-[#d9e7ff]' },
  diet: { label: '식사', accent: 'bg-[#ffe6bf]' },
  exercise: { label: '운동', accent: 'bg-[#dff4d4]' },
  hydration: { label: '수분', accent: 'bg-[#d9f2ff]' },
};

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

function formatDateRange(weekly) {
  if (!weekly?.week_start || !weekly?.week_end) return '';
  return `${weekly.week_start} ~ ${weekly.week_end}`;
}

function scoreText(value) {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value)}`;
}

function changeText(value) {
  if (value === null || value === undefined) return '비교 데이터 없음';
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `지난주보다 +${rounded}`;
  if (rounded < 0) return `지난주보다 ${rounded}`;
  return '지난주와 비슷함';
}

function CategoryCard({ categoryKey, data, previewOnly }) {
  const meta = CATEGORY_META[categoryKey];
  const series = Array.isArray(data?.series) ? data.series : [];

  return (
    <div className="rounded-2xl border border-black/[.06] bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-nature-900">{meta.label}</div>
          <div className="text-[11px] text-neutral-400">
            {previewOnly ? '7일 기록이 다 쌓이면 실제 분석이 더 정확해져요.' : '최근 7일 서버 기록 기준 주간 분석이에요.'}
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] text-neutral-500 ${meta.accent}`}>
          목표 {Math.round(data?.goal_value || 0)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-cream-300 px-3 py-3">
          <div className="text-[11px] text-neutral-400">현재 점수</div>
          <div className="mt-1 text-[22px] font-semibold text-nature-900">{scoreText(data?.current_value)}</div>
        </div>
        <div className="rounded-xl bg-cream-300 px-3 py-3">
          <div className="text-[11px] text-neutral-400">지난주</div>
          <div className="mt-1 text-[22px] font-semibold text-nature-900">{scoreText(data?.previous_value)}</div>
        </div>
        <div className="rounded-xl bg-cream-300 px-3 py-3">
          <div className="text-[11px] text-neutral-400">변화</div>
          <div className="mt-1 text-[13px] font-medium text-nature-900">{changeText(data?.change)}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-medium text-neutral-400">최근 7일 기록</div>
        <div className="grid grid-cols-7 gap-2">
          {series.map((point) => (
            <div key={point.date} className="rounded-xl bg-cream-300 px-2 py-3 text-center">
              <div className="text-[10px] text-neutral-400">{String(point.date).slice(5)}</div>
              <div className="mt-1 text-[13px] font-semibold text-nature-900">
                {scoreText(point.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  const [weekly, setWeekly] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWeeklySummary() {
      try {
        const response = await api('/api/v1/health/weekly');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setWeekly(payload);
        }
      } catch (error) {
        console.error('report_weekly_load_failed', error);
        if (!cancelled) {
          setWeekly(null);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    loadWeeklySummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const recordedDays = useMemo(() => countRecordedDays(weekly?.categories), [weekly]);
  const hasData = recordedDays >= 7;
  const shouldShowSections = loaded && (hasData || showPreview);

  if (!loaded) {
    return (
      <>
        <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
          <span className="text-[14px] font-medium text-nature-900">리포트</span>
        </header>
        <div className="flex-1 px-6 py-6">
          <div className="max-w-[840px] mx-auto space-y-4 animate-pulse">
            <div className="h-6 bg-cream-400 rounded w-1/4"></div>
            <div className="bg-cream-300 rounded-xl p-6 h-28"></div>
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
        <Link href="/app/report" className="px-5 py-2.5 text-[14px] font-medium transition-colors relative text-neutral-400 hover:text-neutral-600">
          대시보드
        </Link>
        <div className="px-5 py-2.5 text-[14px] font-medium transition-colors relative text-nature-900 cursor-default">
          상세 리포트
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-nature-500"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[840px] mx-auto">
          <div className="bg-white shadow-float rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-black/[.04]">
              <div className="flex items-baseline gap-3">
                <span className="text-[16px] font-semibold text-nature-900">DA-NA-A</span>
                <span className="text-[13px] text-neutral-400">상세 리포트</span>
              </div>
            </div>

            <div className="px-7 py-5 flex flex-col gap-5">
              {!hasData && !showPreview && (
                <div className="text-center py-10">
                  <div className="mb-4"><BarChartIcon size={40} className="text-neutral-300 mx-auto" /></div>
                  <div className="text-[16px] font-medium text-nature-900 mb-2">아직 상세 리포트를 열 수 없어요</div>
                  <div className="text-[14px] text-neutral-400 mb-2">상세 리포트는 최근 7일 중 기록된 날짜가 7일이 되면 열려요.</div>
                  <div className="text-[12px] text-neutral-300 mb-2">현재 {recordedDays}일 기록됨 · {Math.max(0, 7 - recordedDays)}일 더 필요해요.</div>
                  <div className="text-[12px] text-neutral-300 mb-6">
                    수면, 식사, 운동, 수분 중 하나 이상이 서버에 저장된 날을 1일로 계산해요. 채팅 아래 카드나 오른쪽 패널에서 기록할 수 있어요.
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Link href="/app/chat" className="inline-block px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors">
                      오늘 기록 입력하러 가기 →
                    </Link>
                    <button
                      onClick={() => setShowPreview(true)}
                      className="px-5 py-2.5 border border-cream-500 text-[14px] font-medium text-neutral-400 rounded-lg hover:bg-cream-300 transition-colors"
                    >
                      상세 리포트 구성 보기
                    </button>
                  </div>
                </div>
              )}

              {shouldShowSections && (
                <>
                  {!hasData && (
                    <div className="rounded-2xl bg-cream-300 px-5 py-4">
                      <div className="text-[12px] font-medium text-nature-900">미리보기 상태</div>
                      <div className="mt-1 text-[12px] text-neutral-400">
                        아직 7일이 다 차지 않아서 일부 값은 비어 있을 수 있어요. 그래도 어떤 분석이 열릴지 미리 볼 수 있어요.
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-cream-300 px-5 py-4">
                    <div className="text-[12px] text-neutral-400">분석 기준 주간</div>
                    <div className="mt-1 text-[16px] font-semibold text-nature-900">{formatDateRange(weekly)}</div>
                    <div className="mt-2 text-[12px] text-neutral-400">
                      최근 7일 중 기록된 날짜 {recordedDays}일 · 서버에 저장된 기록만 분석에 사용해요.
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {CATEGORY_ORDER.map((categoryKey) => (
                      <CategoryCard
                        key={categoryKey}
                        categoryKey={categoryKey}
                        data={weekly?.categories?.[categoryKey]}
                        previewOnly={!hasData}
                      />
                    ))}
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
