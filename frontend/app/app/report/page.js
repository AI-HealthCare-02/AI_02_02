'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClipboardList, TrendingUp, BarChart3 as BarChart3Icon, Target } from 'lucide-react';

import { api } from '../../../hooks/useApi';

const LEVELS = [
  { key: 'LOW', label: '낮음', color: '#4CAF50', max: 3 },
  { key: 'SLIGHT', label: '약간', color: '#8BC34A', max: 8 },
  { key: 'MODERATE', label: '보통', color: '#FFC107', max: 12 },
  { key: 'HIGH', label: '높음', color: '#FF7043', max: 20 },
  { key: 'VERY_HIGH', label: '매우 높음', color: '#E53935', max: 26 },
];

function getScorePosition(score) {
  return Math.min(100, Math.max(0, (score / 26) * 100));
}

function getCurrentLevel(score) {
  for (const level of LEVELS) {
    if (score <= level.max) return level;
  }
  return LEVELS[4];
}

export default function ReportPage() {
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await api('/api/v1/onboarding/status');
        if (res.ok) {
          const data = await res.json();
          if (data.is_completed) {
            setStatus(data);
          }
        }
      } catch {}
      setLoaded(true);
    }

    loadStatus();
  }, []);

  if (!loaded) {
    return (
      <>
        <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
          <span className="text-[14px] font-medium text-nature-900">리포트</span>
        </header>
        <div className="flex-1 px-6 py-6">
          <div className="max-w-[840px] mx-auto space-y-4 animate-pulse">
            <div className="h-6 bg-cream-400 rounded w-1/4"></div>
            <div className="bg-cream-300 rounded-xl p-6 space-y-3">
              <div className="h-4 bg-cream-400 rounded w-1/2"></div>
              <div className="h-8 bg-cream-400 rounded w-full"></div>
              <div className="h-4 bg-cream-400 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const hasOnboarding = Boolean(status?.is_completed);
  const score = status?.initial_findrisc_score ?? 0;
  const level = getCurrentLevel(score);

  return (
    <>
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">리포트</span>
        <div className="flex-1"></div>
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
                  <div className="text-[14px] text-neutral-400 mb-6">온보딩 설문을 완료하면 위험도 분석을 볼 수 있어요</div>
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
                              {item.key === level.key ? `• ${item.label}` : item.label}
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
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                    <div className="mb-2"><TrendingUp size={24} className="text-neutral-300 mx-auto" /></div>
                    <div className="text-[13px] text-nature-900 mb-1">아직 추이 데이터가 없어요</div>
                    <div className="text-[11px] text-neutral-400">건강 기록이 쌓이면 변화 추이를 여기에 보여줍니다.</div>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">목표별 그래프</div>
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                    <div className="mb-2"><BarChart3Icon size={24} className="text-neutral-300 mx-auto" /></div>
                    <div className="text-[13px] text-nature-900 mb-1">건강 기록을 시작해보세요</div>
                    <div className="text-[11px] text-neutral-400 mb-3">수면, 식사, 운동, 수분 기록이 쌓이면 그래프가 표시됩니다.</div>
                    <Link href="/app/chat" className="text-[12px] text-nature-500 hover:underline">AI 채팅에서 기록 시작</Link>
                  </div>

                  <div className="text-[13px] font-semibold text-nature-900 mb-2.5">챌린지 진행</div>
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                    <div className="mb-2"><Target size={24} className="text-neutral-300 mx-auto" /></div>
                    <div className="text-[13px] text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
                    <div className="text-[11px] text-neutral-400 mb-3">챌린지에 참여하면 진행 상황이 여기에 표시됩니다.</div>
                    <Link href="/app/challenge" className="text-[12px] text-nature-500 hover:underline">챌린지 둘러보기</Link>
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
