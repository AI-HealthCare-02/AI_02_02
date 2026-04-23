'use client';

import { useState } from 'react';

export default function RightPanel() {
  const [waterCount, setWaterCount] = useState(3);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [lunchChoice, setLunchChoice] = useState(null);
  const [walkChoice, setWalkChoice] = useState(null);

  const toggleDetail = (id) => {
    setExpandedDetail(expandedDetail === id ? null : id);
  };

  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];
  const streakDays = 5; // Mon-Fri checked

  return (
    <aside className="w-[260px] border-l border-neutral-200 bg-white flex flex-col shrink-0 overflow-y-auto custom-scroll">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200">
        <h3 className="text-[14px] font-semibold text-nature-900">오늘 한눈에</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* ── 1. 수치 카드 4개 ── */}
        <div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { val: '6.8h', label: '수면', id: 'sleep' },
              { val: '2/3', label: '식사', id: 'meal' },
              { val: '✓', label: '운동', id: 'exercise' },
              { val: `${waterCount}잔`, label: '수분', id: 'water' },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => toggleDetail(item.id)}
                className={`text-center py-2 cursor-pointer rounded-lg transition-all ${
                  expandedDetail === item.id
                    ? 'bg-nature-100 ring-1 ring-nature-500/20'
                    : 'hover:bg-neutral-50'
                }`}
              >
                <div className="text-[16px] font-bold text-nature-900">{item.val}</div>
                <div className="text-[11px] text-[var(--color-text-hint)] font-medium">{item.label}</div>
              </div>
            ))}
          </div>

          {/* ── 수면 상세 ── */}
          {expandedDetail === 'sleep' && (
            <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-[13px] animate-[fadeIn_0.15s_ease]">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">😐</span>
                <span className="text-nature-900 font-medium">좀 부족해요</span>
              </div>
            </div>
          )}

          {/* ── 식사 상세 ── */}
          {expandedDetail === 'meal' && (
            <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-[13px] space-y-2 animate-[fadeIn_0.15s_ease]">
              {/* 아침 - done */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">☀️</span>
                <span className="text-nature-900 font-medium">아침 — 먹었어요</span>
              </div>

              {/* 점심 - pending with pills */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">🌤️</span>
                <span className="text-neutral-400 font-medium text-[12px]">점심</span>
                <div className="flex gap-1 ml-auto">
                  {['먹었어요', '못 먹었어요'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setLunchChoice(lunchChoice === opt ? null : opt)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        lunchChoice === opt
                          ? 'bg-nature-500 text-white border border-nature-500'
                          : 'bg-white border border-neutral-200 text-neutral-400 hover:border-nature-500 hover:text-nature-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 저녁 - future */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">🌙</span>
                <span className="text-neutral-200">저녁 — 아직</span>
              </div>

              {/* 구분선 */}
              <hr className="border-dashed border-neutral-200 my-1" />

              {/* 채소 - done */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">🥗</span>
                <span className="text-nature-900 font-medium">채소 — 조금</span>
              </div>

              {/* 식사구성 - done */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">🍚</span>
                <span className="text-nature-900 font-medium">식사구성 — 고르게 먹었어요</span>
              </div>
            </div>
          )}

          {/* ── 운동 상세 ── */}
          {expandedDetail === 'exercise' && (
            <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-[13px] space-y-2 animate-[fadeIn_0.15s_ease]">
              {/* 운동 - done */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">💪</span>
                <span className="text-nature-900 font-medium">운동 — 안 했어요</span>
              </div>

              {/* 산책 - pending with pills */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">🚶</span>
                <span className="text-neutral-400 font-medium text-[12px]">산책</span>
                <div className="flex gap-1 ml-auto">
                  {['했어요', '못했어요'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setWalkChoice(walkChoice === opt ? null : opt)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        walkChoice === opt
                          ? 'bg-nature-500 text-white border border-nature-500'
                          : 'bg-white border border-neutral-200 text-neutral-400 hover:border-nature-500 hover:text-nature-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 수분 상세 ── */}
          {expandedDetail === 'water' && (
            <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3 animate-[fadeIn_0.15s_ease]">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[15px]">💧</span>
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => setWaterCount(Math.max(0, waterCount - 1))}
                    className="w-6 h-6 rounded-full border border-neutral-200 bg-white text-neutral-400 flex items-center justify-center text-[14px] font-medium hover:bg-neutral-100 hover:border-nature-500 hover:text-nature-500 transition-colors"
                  >
                    −
                  </button>
                  <span className="text-[16px] font-bold text-nature-900">{waterCount}</span>
                  <span className="text-[12px] text-[var(--color-text-hint)] font-medium">/ 8잔</span>
                  <button
                    onClick={() => setWaterCount(Math.min(12, waterCount + 1))}
                    className="w-6 h-6 rounded-full border border-neutral-200 bg-white text-neutral-400 flex items-center justify-center text-[14px] font-medium hover:bg-neutral-100 hover:border-nature-500 hover:text-nature-500 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="w-full h-[5px] bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-nature-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (waterCount / 8) * 100)}%` }}
                />
              </div>
              <div className="text-[11px] text-[var(--color-text-hint)] mt-1.5 font-medium">하루 권장 8잔 (240ml 기준)</div>
            </div>
          )}
        </div>

        {/* ── 2. 오늘의 브리핑 ── */}
        <div>
          <h4 className="text-[13px] font-semibold text-nature-900 mb-2.5">오늘의 브리핑</h4>
          <div className="space-y-2.5">
            {[
              { icon: '💤', text: '수면 5~6시간', sub: '좀 부족해요' },
              { icon: '🍽️', text: '아침 먹었어요', sub: '좋아요! 👏' },
              { icon: '🏃', text: '운동 미기록', sub: '저녁에 응답해주세요' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-2.5">
                <span className="text-[14px] mt-0.5">{item.icon}</span>
                <div>
                  <div className="text-[12px] text-nature-900 font-medium">{item.text}</div>
                  <div className="text-[11px] text-[var(--color-text-hint)]">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. 나의 습관 ── */}
        <div>
          <h4 className="text-[13px] font-semibold text-nature-900 mb-2.5">나의 습관</h4>

          {/* Streak card */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-[10px] p-3 mb-3">
            {/* Streak header */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-[16px]">🔥</span>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-nature-900">5일 연속</div>
                <div className="text-[11px] text-neutral-400">💪 좋은 습관이 만들어지고 있어요</div>
              </div>
            </div>

            {/* Week dots */}
            <div className="flex items-center gap-1.5 mb-3">
              {weekDays.map((day, i) => (
                <div key={day} className="flex-1 text-center">
                  <div className="text-[9px] text-[var(--color-text-hint)] mb-1 font-medium">{day}</div>
                  <div
                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] mx-auto transition-colors ${
                      i < streakDays
                        ? 'bg-nature-900 text-white font-medium'
                        : 'border border-dashed border-neutral-200 text-neutral-200'
                    }`}
                  >
                    {i < streakDays ? '✓' : '·'}
                  </div>
                </div>
              ))}
            </div>

            {/* Best challenge inside streak card */}
            <div className="bg-white rounded-md px-2.5 py-2 flex items-center gap-2">
              <span className="text-[14px]">🍽️</span>
              <span className="text-[12px] font-semibold text-nature-900 flex-1">아침 챙기기</span>
              <span className="text-[12px] font-semibold text-nature-900">80%</span>
              <span className="text-[9px] bg-nature-500 text-white px-1.5 py-0.5 rounded font-medium">최고!</span>
            </div>
            <div className="h-[3px] bg-neutral-200 rounded-full mx-2 mt-1.5">
              <div className="h-full bg-neutral-300 rounded-full" style={{ width: '80%' }} />
            </div>
          </div>

          {/* Habit progress bars */}
          <div className="space-y-2.5">
            {[
              { icon: '🍳', name: '아침 챙기기', progress: '4/5일', pct: 80 },
              { icon: '🚶', name: '매일 산책', progress: '4/7일', pct: 57 },
            ].map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-nature-900 font-medium">{item.icon} {item.name}</span>
                  <span className="text-[11px] text-[var(--color-text-hint)] font-medium">{item.progress}</span>
                </div>
                <div className="w-full h-[3px] bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-neutral-300 rounded-full transition-all" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
