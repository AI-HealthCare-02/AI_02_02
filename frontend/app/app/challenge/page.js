'use client';

import { useState, useEffect } from 'react';

const ALL_CHALLENGES = [
  { id: 'veggie', cat: 'food', icon: '🥗', bg: '#D1FAE5', name: '채소 먹기', desc: '매일 채소/과일 1회', recommended: true },
  { id: 'soda', cat: 'food', icon: '🥤', bg: '#FEE2E2', name: '단음료 줄이기', desc: '주 3일 이하', recommended: false },
  { id: 'night', cat: 'food', icon: '🌙', bg: '#F3E8FF', name: '야식 줄이기', desc: '9시 이후 안 먹기', recommended: false },
  { id: 'walk', cat: 'move', icon: '🚶', bg: '#DBEAFE', name: '매일 산책', desc: '식후 15분 걷기', recommended: true },
  { id: 'exercise', cat: 'move', icon: '🏃', bg: '#FCE7F3', name: '주간 운동', desc: '주 150분 이상', recommended: false },
  { id: 'water', cat: 'life', icon: '💧', bg: '#E0E7FF', name: '수분 챙기기', desc: '하루 6잔 이상', recommended: false },
  { id: 'sleep', cat: 'life', icon: '😴', bg: '#F0FDF4', name: '수면 관리', desc: '7시간 이상 자기', recommended: false },
];

const CATEGORIES = [
  { key: 'all', label: '전체', count: 7 },
  { key: 'food', label: '식습관', count: 3 },
  { key: 'move', label: '운동', count: 2 },
  { key: 'life', label: '생활', count: 2 },
];

const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function ChallengePage() {
  const [activeCat, setActiveCat] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [streak, setStreak] = useState(0);
  const [weekCheckins, setWeekCheckins] = useState([false, false, false, false, false, false, false]);
  const [loaded, setLoaded] = useState(false);

  // localStorage: danaa_challenges (채팅 패널과 공유)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('danaa_challenges');
      if (saved) {
        const data = JSON.parse(saved);
        setActiveChallenges(data);
        setSelectedIds(data.filter(c => !c.fixed).map(c => c.id));
        // 스트릭 계산
        const maxStreak = data.reduce((max, c) => Math.max(max, c.current_streak || 0), 0);
        setStreak(maxStreak);
      }
    } catch {}
    setLoaded(true);
  }, []);

  const saveChallenges = (challenges) => {
    setActiveChallenges(challenges);
    try { localStorage.setItem('danaa_challenges', JSON.stringify(challenges)); } catch {}
  };

  const filteredChallenges = activeCat === 'all'
    ? ALL_CHALLENGES
    : ALL_CHALLENGES.filter((c) => c.cat === activeCat);

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((s) => s !== id));
    } else if (selectedIds.length < 1) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  const joinChallenge = () => {
    if (selectedIds.length === 0) return;
    const ch = ALL_CHALLENGES.find(c => c.id === selectedIds[0]);
    if (!ch) return;
    const newChallenge = {
      id: ch.id, name: ch.name, emoji: ch.icon, desc: ch.desc,
      target_days: 14, days_completed: 0, current_streak: 0, today_checked: false, fixed: false,
    };
    const next = [...activeChallenges.filter(c => !c.fixed || c.id !== ch.id), newChallenge];
    saveChallenges(next);
  };

  const hasActive = activeChallenges.length > 0;

  if (!loaded) return null;

  return (
    <>
      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[13px] font-medium text-nature-900">챌린지</span>
      </header>

      {/* 스크롤 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[840px] mx-auto">

          {/* ── 스트릭 ── */}
          <div className="flex items-center gap-3.5 mb-4">
            <span className="text-[28px]">🔥</span>
            <div>
              <span className="text-[28px] font-semibold">{streak}일</span>
              <span className="text-[14px] text-neutral-400 ml-1">연속</span>
            </div>
            <div className="flex gap-1.5 ml-auto">
              {hasActive && activeChallenges.map(c => (
                <span key={c.id} className="px-2.5 py-1 rounded-full bg-cream-400 text-neutral-600 text-[11px]">
                  {c.emoji} {c.name}
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-full bg-cream-300 text-neutral-400 text-[11px] opacity-50">🔒 ???</span>
            </div>
          </div>

          {/* ── 주간 도트 ── */}
          <div className="flex justify-between mb-6">
            {WEEK_DAYS.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] text-neutral-400">{d}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium ${
                  weekCheckins[i] ? 'bg-nature-900 text-white' : 'bg-cream-400 text-neutral-300'
                }`}>
                  {weekCheckins[i] ? '✓' : '·'}
                </div>
              </div>
            ))}
          </div>

          {/* ── 오늘의 챌린지 ── */}
          <h3 className="text-[15px] font-semibold text-nature-900 mb-3">오늘의 챌린지</h3>

          {!hasActive ? (
            <div className="bg-cream-300 rounded-xl p-6 mb-5 text-center">
              <div className="text-[12px] text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
              <div className="text-[10px] text-neutral-400">아래에서 챌린지를 선택해서 시작해보세요</div>
            </div>
          ) : (
            <>
              {activeChallenges.map(ch => (
                <div key={ch.id} className="shadow-soft rounded-lg p-4 mb-3 bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] bg-cream-300">
                      {ch.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-nature-900">{ch.name}</div>
                      <div className="text-[12px] text-neutral-400">{ch.desc} · AI 채팅에서 자동 체크</div>
                    </div>
                    {ch.fixed && <span className="text-[11px] px-2.5 py-1 rounded-md bg-cream-400 text-neutral-400">고정</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-neutral-400 w-[56px] shrink-0">진행</span>
                    <div className="flex-1 h-1.5 bg-cream-400 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-400 rounded-full" style={{ width: `${Math.min(100, ch.days_completed / ch.target_days * 100)}%` }}></div>
                    </div>
                    <span className="text-[13px] font-medium text-nature-900">{ch.days_completed}/{ch.target_days}일</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── AI 넛지 ── */}
          {hasActive ? (
            <div className="bg-cream-300 rounded-xl px-4 py-3 mb-6 text-[13px] text-neutral-400 leading-relaxed">
              💬 챌린지를 시작했어요! AI 채팅에서 건강 기록을 하면 자동으로 체크됩니다.
            </div>
          ) : (
            <div className="bg-cream-300 rounded-xl px-4 py-3 mb-6 text-[13px] text-neutral-400 leading-relaxed">
              💬 챌린지를 선택하면 매일 건강 습관을 추적할 수 있어요
            </div>
          )}

          {/* ── 구분선 ── */}
          <div className="border-t-2 border-cream-400 mb-6"></div>

          {/* ── 챌린지 선택 ── */}
          <div id="ch-select-area">
            <h3 className="text-[15px] font-semibold text-nature-900 mb-3">챌린지 선택</h3>

            {/* 카테고리 탭 */}
            <div className="flex gap-2 mb-5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCat(cat.key)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    activeCat === cat.key
                      ? 'bg-nature-900 text-white border border-nature-900'
                      : 'bg-cream-400 text-neutral-400 hover:bg-cream-500'
                  }`}
                >
                  {cat.label}<span className="ml-1 opacity-70">{cat.count}</span>
                </button>
              ))}
            </div>

            {/* 챌린지 목록 */}
            <div className="text-[12px] font-medium text-neutral-400 mb-2.5">선택 (1개)</div>
            <div className="space-y-1.5 mb-4">
              {filteredChallenges.map((ch) => {
                const isSelected = selectedIds.includes(ch.id);
                const isActive = activeChallenges.some(c => c.id === ch.id);
                return (
                  <div
                    key={ch.id}
                    onClick={() => !isActive && toggleSelect(ch.id)}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                      isActive
                        ? 'bg-cream-300 opacity-50 cursor-default'
                        : isSelected
                          ? 'border-2 border-nature-500 bg-cream-300 cursor-pointer'
                          : 'bg-white hover:bg-cream-300 shadow-soft cursor-pointer'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      isSelected || isActive ? 'bg-nature-500 text-white' : 'border border-cream-500 text-transparent'
                    }`}>
                      ✓
                    </div>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[18px] shrink-0" style={{ background: ch.bg }}>
                      {ch.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-nature-900">{ch.name}</div>
                      <div className="text-[11px] text-neutral-400">{ch.desc}</div>
                    </div>
                    {ch.recommended && <span className="text-[10px] px-2 py-0.5 rounded bg-cream-300 text-nature-500">추천</span>}
                    {isActive && <span className="text-[10px] px-2 py-0.5 rounded bg-nature-500 text-white">참여 중</span>}
                  </div>
                );
              })}
            </div>

            {/* 참여 버튼 */}
            {selectedIds.length > 0 && !activeChallenges.some(c => c.id === selectedIds[0]) && (
              <div className="text-center py-3">
                <button
                  onClick={joinChallenge}
                  className="px-6 py-2.5 bg-nature-900 text-white text-[13px] font-medium rounded-lg hover:bg-nature-800 transition-colors"
                >
                  챌린지 시작하기
                </button>
              </div>
            )}

            <div className="text-center py-3 text-[12px] text-neutral-400">
              참여 중 <span className="text-nature-900 font-medium">{activeChallenges.length}</span> / 최대 2개
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
