'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ReportDetailPage() {
  const [scoreTab, setScoreTab] = useState('all'); // all, meal, sleep, exercise, water
  const [hasData, setHasData] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showPreview, setShowPreview] = useState(false); // 구성 미리보기

  useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('danaa_daily_'));
      setHasData(keys.length >= 7);
    } catch {}
    setLoaded(true);
  }, []);

  /* ── AI 슬롯 데이터 ── */
  const aiSlot = {
    all:      { label: 'AI 주간 요약', content: '운동이 이번 주 가장 잘됐어요. 수분만 올리면 다음 주 점수 확 올라요. 오후 알림 하나로 해결 가능해요.' },
    meal:     { label: 'AI 식사 추천', content: '주말 아침을 한 번도 못 챙겼어요. 채소만 늘려도 +15점 바로 가능해요.' },
    sleep:    { label: 'AI 수면 추천', content: '금요일 5.5h 하나가 발목 잡고 있어요. 취침 30분만 당기면 목표 달성.' },
    exercise: { label: 'AI 운동 추천', content: '목표 달성! 오후 루틴이 완벽하게 잡혔어요. 화·목 산책만 추가하면 매일 달성.' },
    water:    { label: 'AI 수분 추천', content: '오후 2~6시에 거의 물을 안 마셔요. 알림 하나만 추가하면 목표 6잔 달성.' },
  };

  /* ── 점수 카드 데이터 ── */
  const scoreCards = [
    { key: 'meal',     label: '식사', score: 65, diff: '-3', prev: 68, diffColor: '#E24B4A', hint: '주말 아침 0회' },
    { key: 'sleep',    label: '수면', score: 78, diff: '+5', prev: 73, diffColor: '#3D7C3F', hint: '금요일 5.5h' },
    { key: 'exercise', label: '운동', score: 82, diff: '+8', prev: 74, diffColor: '#3D7C3F', hint: '목표 달성' },
    { key: 'water',    label: '수분', score: 70, diff: '→',  prev: 70, diffColor: '#888',    hint: '오후 섭취 거의 0' },
  ];

  /* ── 카테고리 순서 계산 ── */
  const allCategories = ['meal', 'sleep', 'exercise', 'water'];
  const orderedCategories = scoreTab !== 'all'
    ? [scoreTab, ...allCategories.filter(c => c !== scoreTab)]
    : allCategories;

  const categoryComponents = {
    meal: <MealSection />,
    sleep: <SleepSection />,
    exercise: <ExerciseSection />,
    water: <WaterSection />,
  };

  return (
    <>
      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[13px] font-medium text-nature-900">리포트</span>
        <div className="flex-1"></div>
      </header>

      {/* 서브 탭 */}
      <div className="flex border-b border-cream-500 bg-white shrink-0">
        <Link
          href="/app/report"
          className="px-5 py-2.5 text-[13px] font-medium transition-colors relative text-neutral-400 hover:text-neutral-600"
        >
          대시보드
        </Link>
        <div className="px-5 py-2.5 text-[13px] font-medium transition-colors relative text-nature-900 cursor-default">
          상세 리포트
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-nature-900"></div>
        </div>
      </div>

      {/* 콘텐츠 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[840px] mx-auto">
          <div className="bg-white shadow-float rounded-xl overflow-hidden">

            {/* 리포트 헤더 */}
            <div className="px-7 py-5 border-b border-black/[.04]">
              <div className="flex items-baseline gap-3">
                <span className="text-[15px] font-semibold text-nature-900">DA-NA-A</span>
                <span className="text-[12px] text-neutral-400">상세 리포트</span>
              </div>
            </div>

            {/* 리포트 본문 */}
            <div className="px-7 py-5 flex flex-col gap-0">

            {/* ── 데이터 없을 때 ── */}
            {loaded && !hasData && !showPreview && (
              <div className="text-center py-10">
                <div className="text-[40px] mb-4">📊</div>
                <div className="text-[15px] font-medium text-nature-900 mb-2">아직 상세 리포트를 만들 수 없어요</div>
                <div className="text-[13px] text-neutral-400 mb-2">7일 이상 건강 기록을 쌓으면 상세 분석을 볼 수 있어요</div>
                <div className="text-[11px] text-neutral-300 mb-6">수면, 식사, 운동, 수분을 매일 기록해주세요</div>
                <div className="flex gap-2 justify-center">
                  <Link href="/app/chat" className="inline-block px-5 py-2.5 bg-nature-900 text-white text-[13px] font-medium rounded-lg hover:bg-nature-800 transition-colors">
                    AI 채팅에서 기록 시작 →
                  </Link>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="px-5 py-2.5 border border-cream-500 text-[13px] font-medium text-neutral-400 rounded-lg hover:bg-cream-300 transition-colors"
                  >
                    상세 리포트 구성 보기
                  </button>
                </div>
              </div>
            )}

            {/* ── 구성 미리보기 (데이터 없을 때 각 파트별 빈 상태) ── */}
            {loaded && !hasData && showPreview && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[13px] font-medium text-nature-900">리포트 구성 미리보기</div>
                  <button onClick={() => setShowPreview(false)} className="text-[11px] text-neutral-400 hover:text-nature-900 transition-colors">← 돌아가기</button>
                </div>

                {/* AI 슬롯 미리보기 */}
                <div className="bg-cream-300 rounded-lg p-4 mb-4 opacity-60">
                  <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">AI 주간 요약</div>
                  <div className="text-[13px] text-neutral-300 leading-[1.7]">데이터가 쌓이면 AI가 주간 건강 요약을 제공해요</div>
                </div>

                {/* 점수 카드 미리보기 */}
                <div className="text-[10px] text-neutral-300 text-right mb-1.5">카드를 탭하면 항목별 상세를 볼 수 있어요</div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: '식사', icon: '🍽️' },
                    { label: '수면', icon: '💤' },
                    { label: '운동', icon: '🏃' },
                    { label: '수분', icon: '💧' },
                  ].map(c => (
                    <div key={c.label} className="rounded-lg py-2.5 px-2 text-center border border-cream-500 bg-white opacity-60">
                      <div className="text-[16px] mb-1">{c.icon}</div>
                      <div className="text-[18px] font-semibold text-neutral-300 leading-none">—</div>
                      <div className="text-[10px] text-neutral-400 mt-1">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* 구분선 */}
                <div className="border-t-2 border-cream-400 my-5"></div>
                <div className="text-[15px] font-semibold text-nature-900 mb-1.5">카테고리별 상세</div>
                <div className="text-[10px] text-neutral-400 mb-5">각 항목의 주간 기록과 AI 추천을 확인하세요</div>

                {/* 식사 빈 상태 */}
                <div className="mb-5">
                  <div className="text-[13px] font-semibold text-nature-900 mb-3">🍽️ 식사 상세</div>
                  <div className="bg-cream-300 rounded-lg p-5 text-center">
                    <div className="text-[11px] text-neutral-400 mb-1">아직 식사 기록이 없어요</div>
                    <div className="text-[10px] text-neutral-300">매일 아침·점심·저녁 기록이 쌓이면 분석돼요</div>
                  </div>
                </div>

                {/* 수면 빈 상태 */}
                <div className="mb-5">
                  <div className="text-[13px] font-semibold text-nature-900 mb-3">💤 수면 상세</div>
                  <div className="bg-cream-300 rounded-lg p-5 text-center">
                    <div className="text-[11px] text-neutral-400 mb-1">아직 수면 기록이 없어요</div>
                    <div className="text-[10px] text-neutral-300">수면 시간과 질을 기록하면 패턴이 분석돼요</div>
                  </div>
                </div>

                {/* 운동 빈 상태 */}
                <div className="mb-5">
                  <div className="text-[13px] font-semibold text-nature-900 mb-3">🏃 운동 상세</div>
                  <div className="bg-cream-300 rounded-lg p-5 text-center">
                    <div className="text-[11px] text-neutral-400 mb-1">아직 운동 기록이 없어요</div>
                    <div className="text-[10px] text-neutral-300">운동 종류와 시간을 기록하면 추이가 표시돼요</div>
                  </div>
                </div>

                {/* 수분 빈 상태 */}
                <div className="mb-5">
                  <div className="text-[13px] font-semibold text-nature-900 mb-3">💧 수분 상세</div>
                  <div className="bg-cream-300 rounded-lg p-5 text-center">
                    <div className="text-[11px] text-neutral-400 mb-1">아직 수분 기록이 없어요</div>
                    <div className="text-[10px] text-neutral-300">일일 수분 섭취량을 기록하면 분석돼요</div>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-300 text-center mt-3">※ 7일 이상 기록 시 실제 데이터로 채워집니다</div>
              </>
            )}

            {loaded && hasData && (
              <>

              {/* ── AI 슬롯 ── */}
              <div className="bg-cream-300 rounded-lg p-4 mb-4" style={{ minHeight: 68 }}>
                <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">{aiSlot[scoreTab].label}</div>
                <div className="text-[13px] text-nature-900 leading-[1.7]">{aiSlot[scoreTab].content}</div>
              </div>

              {/* ── 점수 카드 (탭 역할) ── */}
              <div className="text-[10px] text-neutral-300 text-right mb-1.5">카드를 탭하면 항목별 상세를 볼 수 있어요</div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {scoreCards.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setScoreTab(scoreTab === c.key ? 'all' : c.key)}
                    className={`rounded-lg py-2.5 px-2 text-center cursor-pointer transition-all ${
                      scoreTab === c.key
                        ? 'border-2 border-nature-900 shadow-float bg-white'
                        : 'border border-cream-500 bg-white shadow-soft hover:shadow-float hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="text-[10px] text-neutral-400 mb-1">{c.label}</div>
                    <div className="text-[22px] font-semibold leading-none text-nature-900">{c.score}</div>
                    <div className="text-[10px] font-medium mt-1" style={{ color: c.diffColor }}>
                      {c.diff === '→' ? `→ ${c.prev}` : `${c.diff.startsWith('+') ? '▲' : '▼'}${c.diff.replace(/[+-]/, '')} · ${c.prev}`}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1.5 pt-1.5 border-t border-black/[.04] leading-snug">{c.hint}</div>
                  </button>
                ))}
              </div>

              {/* 전체 보기 버튼 */}
              <div className="flex justify-end mb-3.5">
                <button
                  onClick={() => setScoreTab('all')}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] cursor-pointer transition-all ${
                    scoreTab === 'all'
                      ? 'bg-nature-900 text-white border border-nature-900'
                      : 'bg-white text-neutral-400 border border-cream-500 hover:border-neutral-400'
                  }`}
                >
                  전체 한번에 보기
                </button>
              </div>

              {/* ── 주간 달성률 그래프 ── */}
              <div className="text-[12px] font-semibold text-nature-900 mb-2.5">주간 달성률</div>
              <svg width="100%" viewBox="0 0 640 180" style={{ display: 'block', marginBottom: 6 }}>
                <line x1="50" y1="20" x2="600" y2="20" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
                <line x1="50" y1="70" x2="600" y2="70" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
                <line x1="50" y1="120" x2="600" y2="120" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
                <line x1="50" y1="160" x2="600" y2="160" stroke="#eee" strokeWidth="0.5"/>
                <rect x="405" y="18" width="50" height="144" rx="3" fill="#f5f5f5" opacity="0.8"/>
                <text x="430" y="14" fontSize="9" fill="#bbb" textAnchor="middle">금</text>
                {/* 수면 */}
                <polyline points="90,37 175,50 260,30 345,50 430,65 515,20 600,20" fill="none" stroke="#4A90D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={scoreTab === 'all' || scoreTab === 'sleep' ? 1 : 0.15}/>
                {/* 운동 */}
                <polyline points="90,20 175,160 260,20 345,160 430,20 515,20 600,160" fill="none" stroke="#5DB87A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" opacity={scoreTab === 'all' || scoreTab === 'exercise' ? 1 : 0.15}/>
                {/* 식사 */}
                <polyline points="90,50 175,70 260,100 345,50 430,75 515,120 600,140" fill="none" stroke="#F0A500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={scoreTab === 'all' || scoreTab === 'meal' ? 1 : 0.15}/>
                {/* 수분 */}
                <polyline points="90,80 175,100 260,80 345,100 430,100 515,50 600,50" fill="none" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={scoreTab === 'all' || scoreTab === 'water' ? 1 : 0.15}/>
                {/* X축 */}
                {['월','화','수','목','금','토','일'].map((d, i) => (
                  <text key={d} x={90 + i * 85} y="174" fontSize="11" fill={d === '금' ? '#555' : '#bbb'} fontWeight={d === '금' ? '500' : 'normal'} textAnchor="middle">{d}</text>
                ))}
              </svg>
              <div className="flex gap-3.5 justify-center text-[10px] text-neutral-400 mb-4">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#4A90D9]"></span>수면</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 border-t-2 border-dashed border-[#5DB87A]"></span>운동</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#F0A500]"></span>식사</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#B0B0B0]"></span>수분</span>
              </div>

              {/* ── 전체보기 인사이트 (scoreTab === 'all') ── */}
              {scoreTab === 'all' && (
                <div className="mb-1.5">
                  <div className="border border-cream-500 rounded-[10px] p-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#9888;&#65039;</div>
                      <div>
                        <div className="text-[12px] font-medium text-nature-900">금요일이 가장 취약해요</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">수면·식사·수분 3개 항목 동시 최저</div>
                      </div>
                    </div>
                    <div className="mt-2 bg-cream-300 rounded-md px-3 py-2 flex items-center gap-2">
                      <div className="flex-1 text-[10px] text-neutral-400"><b className="text-nature-900">금요일 저녁 루틴</b>만 바꾸면 +8점</div>
                      <Link href="/app/challenge" className="text-[10px] px-3 py-1.5 border border-cream-500 rounded-[5px] text-neutral-400 bg-cream-300 hover:bg-cream-400 transition-colors whitespace-nowrap">개선 시작 &#8594;</Link>
                    </div>
                  </div>
                  <div className="border border-cream-500 rounded-[10px] p-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#9989;</div>
                      <div>
                        <div className="text-[12px] font-medium text-nature-900">운동 루틴이 잡혔어요</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">월·수·금·토 오후 7~8시 꾸준 · 165분</div>
                      </div>
                    </div>
                  </div>
                  <div className="border border-cream-500 rounded-[10px] p-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#128161;</div>
                      <div>
                        <div className="text-[12px] font-medium text-nature-900">수분만 올리면 효과 최대</div>
                      </div>
                    </div>
                    <div className="mt-2 bg-cream-300 rounded-md px-3 py-2 flex items-center gap-2">
                      <div className="flex-1 text-[10px] text-neutral-400">오후 <b className="text-nature-900">2잔만 추가</b>하면 +5점</div>
                      <Link href="/app/challenge" className="text-[10px] px-3 py-1.5 border border-cream-500 rounded-[5px] text-neutral-400 bg-cream-300 hover:bg-cream-400 transition-colors whitespace-nowrap">수분 챌린지 &#8594;</Link>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 구분선 ── */}
              <div className="border-t-2 border-cream-400 my-7"></div>
              <div className="text-[15px] font-semibold text-nature-900 mb-1.5">카테고리별 상세</div>
              <div className="text-[10px] text-neutral-400 mb-5">각 항목의 주간 기록과 AI 추천을 확인하세요</div>

              {/* ── 카테고리별 상세 (선택 시 해당 카테고리 우선, 영역 구분) ── */}
              {orderedCategories.map(cat => {
                const isSelected = scoreTab === cat && scoreTab !== 'all';
                return (
                  <div
                    key={cat}
                    className={isSelected
                      ? 'mb-6 border-2 border-nature-500 rounded-xl p-4 bg-cream-300/20'
                      : 'mb-6'
                    }
                  >
                    {categoryComponents[cat]}
                  </div>
                );
              })}

              {/* ── 하단 안내 ── */}
              <div className="text-[10px] text-neutral-300 text-center mt-5">※ 생활 습관 기반 참고 자료입니다</div>
            </>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════ 식사 상세 컴포넌트 ══════════ */
function MealSection() {
  return (
    <>
      <div className="text-[13px] font-semibold text-nature-900 mb-3 flex items-center gap-1.5">&#127869;&#65039; 식사 상세</div>

      <div className="bg-cream-300 rounded-lg p-3.5 mb-3.5">
        <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">이번 주 핵심</div>
        <div className="text-[13px] text-nature-900 leading-[1.6]">주말 아침을 한 번도 못 챙겼어요.<br/>채소만 늘려도 <b className="text-nature-500">+15점</b> 바로 가능해요.</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <div className="bg-cream-300 rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">아침 달성률</div>
          <div className="text-[18px] font-semibold text-nature-900">57%</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">주말 0회</div>
        </div>
        <div className="bg-[#fff0f0] rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">채소 충분</div>
          <div className="text-[18px] font-semibold text-[#C43C3C]">2/7일</div>
          <div className="text-[10px] text-[#E24B4A] mt-0.5">부족</div>
        </div>
        <div className="bg-[#fff0f0] rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">단 음료</div>
          <div className="text-[18px] font-semibold text-[#C43C3C]">주 2회</div>
          <div className="text-[10px] text-[#E24B4A] mt-0.5">과다</div>
        </div>
      </div>

      <div className="text-[11px] font-medium text-neutral-400 tracking-wider mt-5 mb-3">끼니별 기록</div>
      <div className="overflow-x-auto mb-1.5">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <td className="text-[10px] text-neutral-400 p-1 text-left"></td>
              {['월','화','수','목','금','토','일'].map(d => (
                <td key={d} className={`text-[10px] p-1 ${d === '금' ? 'text-neutral-600 font-medium' : 'text-neutral-400'}`}>{d}</td>
              ))}
              <td></td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-[11px] text-neutral-400 p-1 text-left">아침</td>
              {[
                { sym: '◎', bg: '#e8f5e9', color: '#3D7C3F' },
                { sym: '○', bg: '#fff8e1', color: '#f57f17' },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
                { sym: '◎', bg: '#e8f5e9', color: '#3D7C3F' },
                { sym: '◎', bg: '#e8f5e9', color: '#3D7C3F' },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
              ].map((cell, i) => (
                <td key={i} className="p-0.5">
                  <div className="w-8 h-8 rounded-[7px] mx-auto flex items-center justify-center text-[12px]" style={{ background: cell.bg, color: cell.color }}>{cell.sym}</div>
                </td>
              ))}
              <td className="text-[11px] font-medium text-nature-900 p-1">57%</td>
            </tr>
            <tr>
              <td className="text-[11px] text-neutral-400 p-1 text-left">점심</td>
              {[
                { sym: '◎', bg: '#e8f5e9', color: '#3D7C3F' },
                { sym: '◎', bg: '#e8f5e9', color: '#3D7C3F' },
                { sym: '○', bg: '#fff8e1', color: '#f57f17' },
                { sym: '◎', bg: '#e8f5e9', color: '#3D7C3F' },
                { sym: '○', bg: '#fff8e1', color: '#f57f17' },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
              ].map((cell, i) => (
                <td key={i} className="p-0.5">
                  <div className="w-8 h-8 rounded-[7px] mx-auto flex items-center justify-center text-[12px]" style={{ background: cell.bg, color: cell.color }}>{cell.sym}</div>
                </td>
              ))}
              <td className="text-[11px] font-medium text-nature-900 p-1">60%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex gap-2.5 text-[10px] text-neutral-400 mb-3.5">
        <span>◎ 든든히</span><span>○ 간단히</span><span>- 안먹음</span>
      </div>

      <div className="text-[13px] font-medium text-nature-900 tracking-wider mt-5 mb-3">AI 추천</div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 mb-2 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#127820;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">바쁜 아침 대용식 3가지</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">바나나+그릭요거트, 삶은 달걀+통밀크래커, 오트밀 10분</div>
          <Link href="/app/challenge" className="text-[12px] text-[#2196F3] font-semibold mt-1 inline-block">아침 챙기기 챌린지 &#8594;</Link>
        </div>
      </div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#129367;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">채소 하루 1가지 추가법</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">점심 쌈채소 한 줌, 저녁 나물 한 가지</div>
          <Link href="/app/challenge" className="text-[12px] text-[#2196F3] font-semibold mt-1 inline-block">채소 챌린지 &#8594;</Link>
        </div>
      </div>
    </>
  );
}

/* ══════════ 수면 상세 컴포넌트 ══════════ */
function SleepSection() {
  return (
    <>
      <div className="text-[13px] font-semibold text-nature-900 mb-3 flex items-center gap-1.5">&#128164; 수면 상세</div>

      <div className="bg-cream-300 rounded-lg p-3.5 mb-3.5">
        <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">이번 주 핵심</div>
        <div className="text-[13px] text-nature-900 leading-[1.6]">금요일 5.5h 하나가 발목 잡고 있어요.<br/>취침 <b className="text-nature-500">30분만 당기면</b> 목표 달성.</div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3.5">
        <div className="bg-cream-300 rounded-lg py-2.5 px-2 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">주간 평균</div>
          <div className="text-[18px] font-semibold text-nature-900">6.8h</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">목표 7h</div>
        </div>
        <div className="bg-[#fff0f0] rounded-lg py-2.5 px-2 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">평일</div>
          <div className="text-[18px] font-semibold text-[#C43C3C]">6.5h</div>
          <div className="text-[10px] text-[#E24B4A] mt-0.5">부족</div>
        </div>
        <div className="bg-[#f0faf5] rounded-lg py-2.5 px-2 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">주말</div>
          <div className="text-[18px] font-semibold text-[#3D7C3F]">8.0h</div>
          <div className="text-[10px] text-[#3D7C3F] mt-0.5">충분</div>
        </div>
        <div className="bg-cream-300 rounded-lg py-2.5 px-2 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">수면 질</div>
          <div className="text-[18px] font-semibold text-nature-900">보통</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">good 3</div>
        </div>
      </div>

      <div className="text-[11px] font-medium text-neutral-400 tracking-wider mt-5 mb-3">요일별 수면 시간</div>
      <svg width="100%" viewBox="0 0 640 155" style={{ display: 'block', marginBottom: 14 }}>
        <line x1="50" y1="15" x2="600" y2="15" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
        <line x1="50" y1="55" x2="600" y2="55" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
        <line x1="50" y1="95" x2="600" y2="95" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
        <line x1="50" y1="128" x2="600" y2="128" stroke="#eee" strokeWidth="0.5"/>
        <text x="24" y="19" fontSize="10" fill="#bbb" textAnchor="middle">9h</text>
        <text x="24" y="59" fontSize="10" fill="#bbb" textAnchor="middle">7h</text>
        <text x="24" y="99" fontSize="10" fill="#bbb" textAnchor="middle">5h</text>
        <line x1="50" y1="55" x2="600" y2="55" stroke="#888" strokeWidth="0.5" strokeDasharray="6 4" opacity="0.4"/>
        <text x="608" y="58" fontSize="9" fill="#999">목표</text>
        <polyline points="90,45 175,55 260,35 345,55 430,68 515,15 600,15" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="430" cy="68" r="5" fill="#fff" stroke="#E24B4A" strokeWidth="2"/>
        {[{x:90,y:45},{x:175,y:55},{x:260,y:35},{x:345,y:55},{x:515,y:15},{x:600,y:15}].map((p,i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#888"/>
        ))}
        {[{x:90,v:'6.5'},{x:175,v:'6.0'},{x:260,v:'7.0'},{x:345,v:'6.0'},{x:430,v:'5.5',color:'#E24B4A',bold:true},{x:515,v:'8.0'},{x:600,v:'8.0'}].map((p,i) => (
          <text key={i} x={p.x} y="80" fontSize="11" fill={p.color || '#888'} fontWeight={p.bold ? '500' : 'normal'} textAnchor="middle">{p.v}</text>
        ))}
        {['월','화','수','목','금','토','일'].map((d,i) => (
          <text key={d} x={90 + i * 85} y="145" fontSize="11" fill={d === '금' ? '#555' : '#bbb'} fontWeight={d === '금' ? '500' : 'normal'} textAnchor="middle">{d}</text>
        ))}
      </svg>

      <div className="text-[13px] font-medium text-nature-900 tracking-wider mt-5 mb-3">AI 추천</div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 mb-2 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#128245;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">취침 30분 전 루틴</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">스마트폰 내려놓기 &#8594; 블루라이트 차단 &#8594; 조명 낮추기. 멜라토닌 2배</div>
          <Link href="/app/challenge" className="text-[12px] text-[#2196F3] font-semibold mt-1 inline-block">수면 루틴 챌린지 &#8594;</Link>
        </div>
      </div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#127777;&#65039;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">수면 환경 체크</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">실내 18~20 C, 암막 커튼, 취침 3시간 전 마지막 식사</div>
        </div>
      </div>
    </>
  );
}

/* ══════════ 운동 상세 컴포넌트 ══════════ */
function ExerciseSection() {
  return (
    <>
      <div className="text-[13px] font-semibold text-nature-900 mb-3 flex items-center gap-1.5">&#127939; 운동 상세</div>

      <div className="bg-cream-300 rounded-lg p-3.5 mb-3.5">
        <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">이번 주 핵심</div>
        <div className="text-[13px] text-nature-900 leading-[1.6]">목표 달성! 오후 루틴이 완벽하게 잡혔어요.<br/>화·목 <b className="text-nature-500">산책만 추가</b>하면 매일 달성.</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <div className="bg-[#f0faf5] rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">이번 주 횟수</div>
          <div className="text-[18px] font-semibold text-[#3D7C3F]">4회</div>
          <div className="text-[10px] text-[#3D7C3F] mt-0.5">목표 달성</div>
        </div>
        <div className="bg-cream-300 rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">총 시간</div>
          <div className="text-[18px] font-semibold text-nature-900">165분</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">목표 초과</div>
        </div>
        <div className="bg-cream-300 rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">식후 산책</div>
          <div className="text-[18px] font-semibold text-nature-900">4/7일</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">꾸준히</div>
        </div>
      </div>

      <div className="text-[11px] font-medium text-neutral-400 tracking-wider mt-5 mb-3">운동 기록</div>
      <div className="overflow-x-auto mb-3.5">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <td className="text-[10px] text-neutral-400 p-1 text-left"></td>
              {['월','화','수','목','금','토','일'].map(d => (
                <td key={d} className={`text-[10px] p-1 ${d === '금' ? 'text-neutral-600 font-medium' : 'text-neutral-400'}`}>{d}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-[11px] text-neutral-400 p-1 text-left">운동</td>
              {[
                { sym: '&#128694;', bg: '#e8f5e9', isIcon: true },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
                { sym: '&#127947;&#65039;', bg: '#e8f5e9', isIcon: true },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
                { sym: '&#128694;', bg: '#e8f5e9', isIcon: true },
                { sym: '&#127947;&#65039;', bg: '#e8f5e9', isIcon: true },
                { sym: '-', bg: '#f5f5f5', color: '#aaa' },
              ].map((cell, i) => (
                <td key={i} className="p-0.5">
                  <div
                    className="w-8 h-8 rounded-[7px] mx-auto flex items-center justify-center text-[14px]"
                    style={{ background: cell.bg, color: cell.color || '#2D2B28' }}
                    dangerouslySetInnerHTML={cell.isIcon ? { __html: cell.sym } : undefined}
                  >
                    {!cell.isIcon ? cell.sym : null}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="text-[10px] text-neutral-400 p-1 text-left">시간</td>
              {['30분','-','45분','-','40분','50분','-'].map((t, i) => (
                <td key={i} className="text-[10px] p-1 text-neutral-400">{t}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-[13px] font-medium text-nature-900 tracking-wider mt-5 mb-3">AI 추천</div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#128694;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">화·목 10분 식후 산책</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">식후 10~15분 걷기는 혈당 스파이크 30% 낮춰요</div>
          <Link href="/app/challenge" className="text-[12px] text-[#2196F3] font-semibold mt-1 inline-block">식후 산책 챌린지 &#8594;</Link>
        </div>
      </div>
    </>
  );
}

/* ══════════ 수분 상세 컴포넌트 ══════════ */
function WaterSection() {
  return (
    <>
      <div className="text-[13px] font-semibold text-nature-900 mb-3 flex items-center gap-1.5">&#128167; 수분 상세</div>

      <div className="bg-cream-300 rounded-lg p-3.5 mb-3.5">
        <div className="text-[10px] font-medium text-neutral-400 tracking-wider mb-1.5">이번 주 핵심</div>
        <div className="text-[13px] text-nature-900 leading-[1.6]">오후 2~6시에 거의 물을 안 마셔요.<br/>알림 하나만 추가하면 <b className="text-nature-500">목표 6잔 달성</b>.</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <div className="bg-[#fff0f0] rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">일 평균</div>
          <div className="text-[18px] font-semibold text-[#C43C3C]">3.8잔</div>
          <div className="text-[10px] text-[#E24B4A] mt-0.5">목표 6잔</div>
        </div>
        <div className="bg-[#f0faf5] rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">오전</div>
          <div className="text-[18px] font-semibold text-[#3D7C3F]">2잔</div>
          <div className="text-[10px] text-[#3D7C3F] mt-0.5">양호</div>
        </div>
        <div className="bg-[#fff0f0] rounded-lg py-2.5 px-3 text-center">
          <div className="text-[10px] text-neutral-400 mb-1">오후</div>
          <div className="text-[18px] font-semibold text-[#C43C3C]">1.8잔</div>
          <div className="text-[10px] text-[#E24B4A] mt-0.5">2~6시 거의 0</div>
        </div>
      </div>

      <div className="text-[11px] font-medium text-neutral-400 tracking-wider mt-5 mb-3">요일별 수분</div>
      <svg width="100%" viewBox="0 0 640 138" style={{ display: 'block', marginBottom: 14 }}>
        <line x1="50" y1="15" x2="600" y2="15" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
        <line x1="50" y1="50" x2="600" y2="50" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
        <line x1="50" y1="85" x2="600" y2="85" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 4"/>
        <line x1="50" y1="112" x2="600" y2="112" stroke="#eee" strokeWidth="0.5"/>
        <text x="24" y="19" fontSize="10" fill="#bbb" textAnchor="middle">8잔</text>
        <text x="24" y="54" fontSize="10" fill="#bbb" textAnchor="middle">6잔</text>
        <text x="24" y="89" fontSize="10" fill="#bbb" textAnchor="middle">4잔</text>
        <line x1="50" y1="50" x2="600" y2="50" stroke="#888" strokeWidth="0.5" strokeDasharray="6 4" opacity="0.4"/>
        <text x="608" y="53" fontSize="9" fill="#999">목표</text>
        <polyline points="90,85 175,92 260,85 345,92 430,92 515,62 600,62" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {[{x:90,y:85},{x:175,y:92},{x:260,y:85},{x:345,y:92},{x:430,y:92},{x:515,y:62},{x:600,y:62}].map((p,i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#888"/>
        ))}
        {[{x:90,v:'4',y:74},{x:175,v:'3',y:106},{x:260,v:'4',y:74},{x:345,v:'3',y:106},{x:430,v:'3',y:106},{x:515,v:'5',y:51},{x:600,v:'5',y:51}].map((p,i) => (
          <text key={i} x={p.x} y={p.y} fontSize="11" fill="#888" textAnchor="middle">{p.v}</text>
        ))}
        {['월','화','수','목','금','토','일'].map((d,i) => (
          <text key={d} x={90 + i * 85} y="128" fontSize="11" fill={d === '금' ? '#555' : '#bbb'} fontWeight={d === '금' ? '500' : 'normal'} textAnchor="middle">{d}</text>
        ))}
      </svg>

      <div className="flex gap-5 text-[11px] text-neutral-400 mb-3.5">
        <span>야식 <b className="font-medium text-nature-900 ml-1.5">2회</b> <span className="text-neutral-400 ml-1">금요일 집중</span></span>
        <span>음주 <b className="font-medium text-nature-900 ml-1.5">1회</b> <span className="text-neutral-400 ml-1">가벼운</span></span>
      </div>

      <div className="text-[13px] font-medium text-nature-900 tracking-wider mt-5 mb-3">AI 추천</div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 mb-2 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#127861;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">카페인 없는 대안 음료</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">보리차, 루이보스티 -- 오후 2시 알림 설정 추천</div>
          <Link href="/app/challenge" className="text-[12px] text-[#2196F3] font-semibold mt-1 inline-block">수분 챌린지 &#8594;</Link>
        </div>
      </div>
      <div className="border border-cream-500 rounded-lg px-3 py-2.5 flex gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-cream-300 flex items-center justify-center text-[13px] shrink-0">&#9200;</div>
        <div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">오후 수분 타이머</div>
          <div className="text-[10px] text-neutral-400 leading-relaxed">오후 2시·4시·6시 각 1잔 -- AI 채팅에서 자동 확인</div>
        </div>
      </div>
    </>
  );
}
