'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ── 위험도 레벨 설정 ── */
const LEVELS = [
  { key: 'LOW', label: '낮음', color: '#4CAF50', max: 3 },
  { key: 'SLIGHT', label: '약간', color: '#8BC34A', max: 8 },
  { key: 'MODERATE', label: '보통', color: '#FFC107', max: 12 },
  { key: 'HIGH', label: '높음', color: '#FF7043', max: 20 },
  { key: 'VERY_HIGH', label: '매우높음', color: '#E53935', max: 26 },
];

function getScorePosition(score) {
  // 0~26 → 0%~100%
  return Math.min(100, Math.max(0, (score / 26) * 100));
}

function getCurrentLevel(score) {
  for (const lv of LEVELS) {
    if (score <= lv.max) return lv;
  }
  return LEVELS[4];
}

function generateInsight(risk, onboarding) {
  if (!risk || !onboarding) return null;
  const tips = [];
  if (risk.breakdown.activity > 0) tips.push('운동량을 주 3회 이상으로 늘리면 위험도를 낮출 수 있어요.');
  if (risk.breakdown.vegetable > 0) tips.push('채소·과일 섭취를 늘려보세요.');
  if (risk.breakdown.family > 0) tips.push('가족력이 있으므로 정기 검진이 중요합니다.');
  if (risk.breakdown.bmi > 0) tips.push('적정 체중 유지가 위험도 감소에 도움돼요.');
  if (tips.length === 0) tips.push('현재 생활습관이 좋은 편이에요! 꾸준히 유지해주세요.');
  return tips.join(' ');
}

export default function ReportPage() {
  const [risk, setRisk] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem('danaa_risk');
      const o = localStorage.getItem('danaa_onboarding');
      if (r) setRisk(JSON.parse(r));
      if (o) setOnboarding(JSON.parse(o));
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  const hasOnboarding = !!risk;
  const score = risk?.score ?? 0;
  const level = getCurrentLevel(score);
  const insight = generateInsight(risk, onboarding);

  return (
    <>
      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[13px] font-medium text-nature-900">리포트</span>
        <div className="flex-1"></div>
      </header>

      {/* 서브 탭 */}
      <div className="flex border-b border-cream-500 bg-white shrink-0">
        <div className="px-5 py-2.5 text-[13px] font-medium transition-colors relative text-nature-900 cursor-default">
          대시보드
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-nature-900"></div>
        </div>
        <Link href="/app/report/detail" className="px-5 py-2.5 text-[13px] font-medium transition-colors relative text-neutral-400 hover:text-neutral-600">
          상세 리포트
        </Link>
      </div>

      {/* 콘텐츠 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[840px] mx-auto">
          <div className="bg-white shadow-float rounded-xl overflow-hidden">
            {/* 리포트 헤더 */}
            <div className="px-7 py-5 border-b border-black/[.04]">
              <div className="flex items-baseline gap-3">
                <span className="text-[15px] font-semibold text-nature-900">DA-NA-A</span>
                <span className="text-[12px] text-neutral-400">대시보드</span>
              </div>
            </div>

            {/* 리포트 본문 */}
            <div className="px-7 py-5 flex flex-col gap-0">

              {/* ══ 온보딩 안 했을 때 ══ */}
              {!hasOnboarding && (
                <div className="text-center py-10">
                  <div className="text-[40px] mb-4">📋</div>
                  <div className="text-[15px] font-medium text-nature-900 mb-2">아직 건강 프로필이 없어요</div>
                  <div className="text-[13px] text-neutral-400 mb-6">온보딩 설문을 완료하면 위험도 분석을 볼 수 있어요</div>
                  <Link href="/onboarding/diabetes" className="inline-block px-5 py-2.5 bg-nature-900 text-white text-[13px] font-medium rounded-lg hover:bg-nature-800 transition-colors">
                    온보딩 시작하기
                  </Link>
                </div>
              )}

              {/* ══ 온보딩 완료 후 ══ */}
              {hasOnboarding && (
                <>
                  {/* 1. 위험도 정보 */}
                  <div className="text-[12px] font-semibold text-nature-900 mb-2.5">위험도 정보</div>
                  <div className="bg-cream-300 rounded-xl p-[18px_20px] mb-3.5">
                    <div className="flex gap-4 items-center">
                      {/* 점수 박스 */}
                      <div className="bg-white border border-cream-500 rounded-lg px-5 py-3.5 text-center min-w-[80px]">
                        <div className="text-[10px] text-neutral-400 mb-1">점수</div>
                        <div className="text-[34px] font-semibold text-nature-500 leading-none">{score}</div>
                        <div className="text-[11px] text-neutral-400 mt-1">/26</div>
                      </div>
                      {/* 그래프 영역 */}
                      <div className="flex-1">
                        <div className="flex justify-end mb-2">
                          <span className="text-[10px] px-3 py-1 border border-cream-500 rounded-lg text-neutral-400 bg-white">{level.label} 구간</span>
                        </div>
                        <div className="text-[10px] text-neutral-400 mb-2">FINDRISC 위험도 지표</div>
                        {/* 그라데이션 바 */}
                        <div className="relative h-[10px] rounded-[5px] mb-1.5" style={{ background: 'linear-gradient(to right, #4CAF50, #8BC34A, #FFC107, #FF7043, #E53935)' }}>
                          <div
                            className="absolute top-[-3px] w-4 h-4 rounded-full border-[2.5px] border-white shadow-md"
                            style={{ left: `calc(${getScorePosition(score)}% - 8px)`, background: '#4A5D23' }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          {LEVELS.map(lv => (
                            <span key={lv.key} style={{ color: lv.color }} className={lv.key === level.key ? 'font-bold' : ''}>
                              {lv.key === level.key ? `▶ ${lv.label}` : lv.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. AI 인사이트 */}
                  {insight && (
                    <div className="bg-cream-300 rounded-xl p-4 mb-3.5">
                      <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">AI 인사이트</div>
                      <div className="text-[13px] text-neutral-400 leading-[1.8]">{insight}</div>
                    </div>
                  )}

                  {/* 3. 위험도 추이 — 데이터 없음 */}
                  <div className="text-[12px] font-semibold text-nature-900 mb-2.5">위험도 추이</div>
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                    <div className="text-[20px] mb-2">📈</div>
                    <div className="text-[12px] text-nature-900 mb-1">아직 추이 데이터가 없어요</div>
                    <div className="text-[10px] text-neutral-400">2주 이상 건강 기록을 쌓으면 위험도 변화 추이를 볼 수 있어요</div>
                  </div>

                  {/* 5. 항목별 트렌드 — 데이터 없음 */}
                  <div className="text-[12px] font-semibold text-nature-900 mb-2.5">항목별 트렌드</div>
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                    <div className="text-[20px] mb-2">📊</div>
                    <div className="text-[12px] text-nature-900 mb-1">건강 기록을 시작해보세요</div>
                    <div className="text-[10px] text-neutral-400 mb-3">매일 수면, 식사, 운동, 수분을 기록하면 트렌드가 표시돼요</div>
                    <Link href="/app/chat" className="text-[11px] text-[#2196F3] hover:underline">AI 채팅에서 기록 시작 →</Link>
                  </div>

                  {/* 6. 챌린지 이행 — 데이터 없음 */}
                  <div className="text-[12px] font-semibold text-nature-900 mb-2.5">챌린지 이행</div>
                  <div className="bg-cream-300 rounded-xl p-6 mb-3.5 text-center">
                    <div className="text-[20px] mb-2">🎯</div>
                    <div className="text-[12px] text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
                    <div className="text-[10px] text-neutral-400 mb-3">챌린지에 참여하면 이행 상황이 표시돼요</div>
                    <Link href="/app/challenge" className="text-[11px] text-[#2196F3] hover:underline">챌린지 둘러보기 →</Link>
                  </div>

                  {/* 상세 리포트 링크 */}
                  <div className="text-right mt-3.5">
                    <Link href="/app/report/detail" className="text-[11px] text-[#2196F3] cursor-pointer hover:underline">
                      상세 리포트에서 자세히 보기 →
                    </Link>
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
