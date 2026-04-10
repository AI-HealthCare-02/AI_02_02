'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Moon, Utensils, Dumbbell, Droplets, Sunrise, Sun, Leaf, UtensilsCrossed, Footprints, Target, Smile, ClipboardList, CircleCheck } from 'lucide-react';
import Tutorial from '../../../components/Tutorial';
import { getToken } from '../../../hooks/useApi';

/* ── API 설정 ── */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
const DEV_AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';

/* ── 유틸 ── */
const todayKey = () => {
  const d = new Date();
  return `danaa_daily_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const emptyLog = () => ({
  sleep_quality: null, sleep_duration: null,
  breakfast: null, lunch: null, dinner: null,
  vegetable: null, meal_balance: null,
  exercise_done: null, exercise_type: null, exercise_minutes: null, walk_done: null,
  water_cups: 0, mood: null,
});

const SLEEP_LABELS = { under_5: '5h 미만', between_5_6: '5~6h', between_6_7: '6~7h', between_7_8: '7~8h', over_8: '8h 이상' };
const SLEEP_QUALITY_LABELS = { very_good: '아주 좋음', good: '좋음', normal: '보통', bad: '나쁨', very_bad: '아주 나쁨' };
const MEAL_LABELS = { hearty: '든든히', simple: '간단히', skipped: '못먹음' };
const EXERCISE_TYPES = { walking: '산책', running: '달리기', cycling: '자전거', swimming: '수영', gym: '헬스', home_workout: '홈트', other: '기타' };

function getSleepDisplay(log) {
  if (!log.sleep_duration) return null;
  const map = { under_5: '<5h', between_5_6: '5.5h', between_6_7: '6.5h', between_7_8: '7.5h', over_8: '8h+' };
  return map[log.sleep_duration] || '—';
}
function getMealCount(log) {
  return [log.breakfast, log.lunch, log.dinner].filter(v => v !== null).length;
}

export default function ChatPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [log, setLog] = useState(emptyLog());
  const [loaded, setLoaded] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [risk, setRisk] = useState(null);

  // 튜토리얼 상태
  const [showTutorial, setShowTutorial] = useState(false);

  // 채팅 상태
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const chatEndRef = useRef(null);
  const abortRef = useRef(null);

  // 새 대화 시작
  const newChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setInputText('');
    setIsStreaming(false);
    setSessionId(null);
  }, []);

  // window에 노출 (Sidebar에서 호출용)
  useEffect(() => {
    window.__danaa_newChat = newChat;
    return () => { delete window.__danaa_newChat; };
  }, [newChat]);

  // 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // localStorage 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey());
      if (saved) setLog(prev => ({ ...emptyLog(), ...JSON.parse(saved) }));
      const ob = localStorage.getItem('danaa_onboarding');
      if (ob) setOnboarding(JSON.parse(ob));
      const rk = localStorage.getItem('danaa_risk');
      if (rk) setRisk(JSON.parse(rk));
      // 튜토리얼: 온보딩 완료 + 튜토리얼 미완료 시 표시
      if (ob && !localStorage.getItem('danaa_tutorial_done')) {
        setShowTutorial(true);
        setPanelOpen(true); // 튜토리얼 시 오른쪽 패널 자동 열기
      }
    } catch {}
    setLoaded(true);
  }, []);

  /* ── SSE 파싱 유틸 ── */
  function parseSSE(text) {
    const events = [];
    const lines = text.split('\n');
    let currentEvent = null;
    let currentData = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);
      } else if (line === '' && currentEvent) {
        try { events.push({ event: currentEvent, data: JSON.parse(currentData) }); } catch {}
        currentEvent = null;
        currentData = '';
      }
    }
    return events;
  }

  /* ── 메시지 전송 ── */
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg = { role: 'user', content: text, ts: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
    const aiMsg = { role: 'assistant', content: '', ts: null, streaming: true };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInputText('');
    setIsStreaming(true);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const authToken = getToken() || DEV_AUTH_TOKEN;
      const res = await fetch(`${API_BASE}/api/v1/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message: text, session_id: sessionId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          // 인증 만료 → 토큰 삭제 + 로그인 이동
          try { localStorage.removeItem('danaa_token'); } catch {}
          throw new Error('AUTH_EXPIRED');
        } else if (res.status === 429) {
          throw new Error('RATE_LIMIT');
        } else if (res.status >= 500) {
          throw new Error('SERVER_ERROR');
        } else {
          throw new Error(`HTTP_${res.status}`);
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSE(buffer);
        // 처리된 이벤트 이후의 남은 버퍼 유지
        const lastNewline = buffer.lastIndexOf('\n\n');
        if (lastNewline !== -1) buffer = buffer.slice(lastNewline + 2);

        for (const evt of events) {
          if (evt.event === 'token' && evt.data.content) {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + evt.data.content };
              }
              return updated;
            });
          } else if (evt.event === 'done') {
            if (evt.data.session_id) {
              setSessionId(evt.data.session_id);
              // 사이드바 대화 히스토리에 추가/업데이트
              window.dispatchEvent(new CustomEvent('danaa:conversation-update', {
                detail: {
                  id: evt.data.session_id,
                  title: text.slice(0, 30) || '새 대화',
                  updatedAt: new Date().toISOString(),
                  messageCount: 1,
                }
              }));
            }
          }
        }
      }

      // 스트리밍 완료
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, streaming: false, ts: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
        }
        return updated;
      });

    } catch (err) {
      if (err.name === 'AbortError') return;

      // 에러 유형별 메시지
      let errorMsg;
      switch (err.message) {
        case 'AUTH_EXPIRED':
          errorMsg = '로그인이 만료됐어요. 다시 로그인해주세요.';
          setTimeout(() => { window.location.href = '/login'; }, 2000);
          break;
        case 'RATE_LIMIT':
          errorMsg = '메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.';
          break;
        case 'SERVER_ERROR':
          errorMsg = '서버에 문제가 발생했어요. 잠시 후 다시 시도해주세요.';
          break;
        default:
          errorMsg = '인터넷 연결을 확인해주세요. 연결이 원활하지 않아요.';
          break;
      }

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: errorMsg,
            streaming: false,
            isError: true,
            ts: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputText, isStreaming, sessionId]);

  // localStorage 저장
  const save = useCallback((next) => {
    setLog(next);
    try { localStorage.setItem(todayKey(), JSON.stringify(next)); } catch {}
  }, []);

  const update = useCallback((field, value) => {
    save({ ...log, [field]: value });
  }, [log, save]);

  const hasAnyData = loaded && (log.sleep_duration || log.breakfast !== null || log.exercise_done !== null || log.water_cups > 0);

  /* ── 카드 값 계산 ── */
  const sleepVal = getSleepDisplay(log);
  const mealCount = getMealCount(log);
  const mealVal = mealCount > 0 ? `${mealCount}/3` : null;
  const exerciseVal = log.exercise_done === true ? '✓' : log.exercise_done === false ? '✗' : null;
  const waterVal = log.water_cups > 0 ? `${log.water_cups}잔` : null;

  const cards = [
    { key: 'sleep', label: '수면', val: sleepVal, color: activeCard === 'sleep' ? 'bg-cream-400' : '' },
    { key: 'meal', label: '식사', val: mealVal, color: activeCard === 'meal' ? 'bg-cream-400' : '' },
    { key: 'exercise', label: '운동', val: exerciseVal, color: activeCard === 'exercise' ? 'bg-cream-400' : '' },
    { key: 'water', label: '수분', val: waterVal, color: activeCard === 'water' ? 'bg-cream-400' : '' },
  ];

  /* ── 브리핑 자동 생성 ── */
  const briefings = [];
  if (log.sleep_duration) {
    const q = log.sleep_quality;
    const sub = q ? SLEEP_QUALITY_LABELS[q] : '';
    briefings.push({ icon: 'moon', text: `수면 ${SLEEP_LABELS[log.sleep_duration]}`, sub: sub || '기록됨' });
  }
  if (log.breakfast !== null) {
    briefings.push({ icon: 'utensils', text: `아침 — ${MEAL_LABELS[log.breakfast]}`, sub: log.breakfast === 'hearty' ? '좋아요!' : log.breakfast === 'skipped' ? '내일은 꼭!' : '기록됨' });
  }
  if (log.exercise_done !== null) {
    briefings.push({ icon: 'dumbbell', text: log.exercise_done ? `운동 ${log.exercise_type ? EXERCISE_TYPES[log.exercise_type] : ''} ${log.exercise_minutes ? log.exercise_minutes + '분' : ''}`.trim() : '운동 — 안 했어요', sub: log.exercise_done ? '잘했어요!' : '내일은 해봐요' });
  }
  if (log.water_cups > 0) {
    briefings.push({ icon: 'droplets', text: `수분 ${log.water_cups}잔`, sub: log.water_cups >= 8 ? '목표 달성!' : log.water_cups >= 5 ? '좀 더 마셔요' : '좀 부족해요' });
  }

  /* ── 로딩 스켈레톤 ── */
  if (!loaded) return (
    <>
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">AI 채팅</span>
      </header>
      <div className="flex-1 px-6 py-6">
        <div className="max-w-[840px] mx-auto space-y-4">
          {/* 아바타 + 텍스트 스켈레톤 */}
          <div className="flex gap-2.5 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-cream-400 shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-cream-400 rounded w-3/4"></div>
              <div className="h-3 bg-cream-400 rounded w-1/2"></div>
              <div className="h-3 bg-cream-400 rounded w-2/3"></div>
            </div>
          </div>
          <div className="flex gap-2.5 animate-pulse">
            <div className="w-7 h-7 shrink-0"></div>
            <div className="flex-1 border border-cream-400 rounded-xl p-4 space-y-2">
              <div className="h-3 bg-cream-400 rounded w-1/3"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-cream-400 rounded-full w-20"></div>
                <div className="h-8 bg-cream-400 rounded-full w-20"></div>
                <div className="h-8 bg-cream-400 rounded-full w-20"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="py-3 px-6 bg-white border-t border-cream-500">
        <div className="max-w-[840px] mx-auto flex gap-2 items-center animate-pulse">
          <div className="flex-1 h-10 bg-cream-400 rounded-[20px]"></div>
          <div className="w-9 h-9 bg-cream-400 rounded-full"></div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 튜토리얼 */}
      {showTutorial && <Tutorial onComplete={() => { setShowTutorial(false); setPanelOpen(false); }} />}

      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">AI 채팅</span>
        <div className="flex-1"></div>
        <button onClick={() => setPanelOpen(!panelOpen)} className="w-8 h-8 rounded-lg hover:bg-black/[.03] flex items-center justify-center text-sm text-neutral-400 relative">
          <ClipboardList size={16} />
          <span className="absolute top-[5px] right-[5px] w-[7px] h-[7px] bg-warning rounded-full border-[1.5px] border-white"></span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 채팅 영역 ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>

            {/* ── 온보딩 완료 시: 맞춤 인사 ── */}
            {onboarding && (
              <>
                <div className="max-w-[840px] mx-auto mb-3.5">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">다</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] leading-[1.7] text-nature-900">
                        안녕하세요! 다나아 AI입니다<br />
                        {risk?.group && <>
                          <strong>{risk.group}그룹</strong>({risk.groupLabel})이시네요.
                          {risk.levelLabel && <> 현재 위험도는 <strong>{risk.levelLabel}</strong> 단계예요.</>}
                          <br />
                        </>}
                        오늘의 건강 기록부터 시작해볼까요?<br />
                        <span className="text-neutral-400">오른쪽 패널에서 수면, 식사, 운동, 수분을 기록할 수 있어요.</span>
                      </div>
                      <div className="text-[12px] text-neutral-300 mt-0.5">지금</div>
                    </div>
                  </div>
                </div>

                {/* 빠른 기록 유도 카드 */}
                {!hasAnyData && messages.length === 0 && (
                  <div className="max-w-[840px] mx-auto mb-3.5">
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 shrink-0"></div>
                      <div className="flex-1 border border-cream-500 rounded-xl p-4 bg-cream-300 shadow-soft">
                        <div className="text-[13px] font-medium text-nature-900 mb-2.5">오늘의 건강을 기록해보세요</div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '수면 기록', card: 'sleep' },
                            { label: '식사 기록', card: 'meal' },
                            { label: '운동 기록', card: 'exercise' },
                            { label: '수분 기록', card: 'water' },
                          ].map(item => (
                            <button key={item.card} onClick={() => { setPanelOpen(true); setActiveCard(item.card); }}
                              className="px-3 py-1.5 rounded-full text-[12px] bg-white border border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500 transition-all">
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── 온보딩 미완료 시 ── */}
            {!onboarding && (
              <div className="max-w-[840px] mx-auto mb-3.5">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">다</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] leading-[1.7] text-nature-900">
                      안녕하세요! 다나아 AI입니다<br />
                      맞춤 건강관리를 시작하려면 먼저 온보딩 설문을 완료해주세요.
                    </div>
                    <a href="/onboarding/diabetes" className="inline-block mt-2 px-4 py-2 bg-nature-500 text-white text-[13px] font-medium rounded-lg hover:bg-nature-600 transition-colors">
                      온보딩 시작하기 →
                    </a>
                    <div className="text-[12px] text-neutral-300 mt-1.5">지금</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 채팅 메시지 ── */}
            {messages.map((msg, idx) => (
              <div key={idx} className="max-w-[840px] mx-auto mb-3.5">
                {msg.role === 'user' ? (
                  /* 사용자 메시지 - 오른쪽 */
                  <div className="flex justify-end">
                    <div>
                      <div className="bg-cream-300 text-nature-900 text-[14px] leading-[1.7] rounded-2xl rounded-br-md px-4 py-2.5 max-w-[480px] border border-cream-500">
                        {msg.content}
                      </div>
                      <div className="text-[12px] text-neutral-300 mt-0.5 text-right">{msg.ts}</div>
                    </div>
                  </div>
                ) : (
                  /* AI 메시지 - 왼쪽 (아바타 없음) */
                  <div className="flex-1 min-w-0">
                    <div className={`text-[14px] leading-[1.7] ${msg.isError ? 'text-red-500' : 'text-nature-900'}`}>
                      {msg.content || <span className="text-neutral-300">생각 중...</span>}
                      {msg.streaming && <span className="inline-block w-[2px] h-[14px] bg-nature-900 ml-0.5 animate-pulse align-middle"></span>}
                    </div>
                    {msg.ts && <div className="text-[12px] text-neutral-300 mt-0.5">{msg.ts}</div>}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />

          </div>

          {/* 입력창 */}
          <div className="py-3 px-6 bg-white border-t border-cream-500" data-tutorial="chat-input">
            <div className="max-w-[840px] mx-auto flex gap-2 items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMessage(); } }}
                placeholder={isStreaming ? '답변을 기다리는 중...' : '다나아에게 무엇이든 물어보세요...'}
                disabled={isStreaming}
                className="flex-1 py-2.5 px-4 rounded-[20px] border border-cream-400 text-[14px] outline-none bg-cream-300 focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || !inputText.trim()}
                className="w-9 h-9 rounded-full bg-nature-500 text-white flex items-center justify-center text-lg cursor-pointer shrink-0 hover:bg-nature-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ══ 오른쪽 패널 ══ */}
        {panelOpen && (
          <aside className="w-[320px] border-l border-cream-500 bg-white flex flex-col shrink-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>

            <div className="p-4 space-y-5">
              {/* ═══ 1. 오늘 한눈에 ═══ */}
              <div>
                <h4 className="text-[13px] font-semibold text-nature-900 mb-2">오늘 한눈에</h4>
                <div className="border-b border-cream-500 mb-3"></div>

                {/* 4개 카드 */}
                <div className="grid grid-cols-4 gap-1.5 mb-3" data-tutorial="today-cards">
                  {cards.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setActiveCard(activeCard === c.key ? null : c.key)}
                      className={`text-center py-2.5 cursor-pointer rounded-lg transition-all ${
                        activeCard === c.key
                          ? `${c.color} shadow-float ring-1 ring-black/[.06]`
                          : 'hover:bg-black/[.03] shadow-xs'
                      }`}
                    >
                      <div className={`text-[16px] font-semibold ${c.val ? 'text-nature-900' : 'text-neutral-300'}`}>
                        {c.val || '—'}
                      </div>
                      <div className="text-[11px] text-neutral-400">{c.label}</div>
                    </button>
                  ))}
                </div>

                {/* 확장 패널 - 카드 선택 시 */}
                {activeCard === 'sleep' && (
                  <SleepPanel log={log} update={update} save={save} />
                )}
                {activeCard === 'meal' && (
                  <MealPanel log={log} update={update} save={save} />
                )}
                {activeCard === 'exercise' && (
                  <ExercisePanel log={log} update={update} save={save} />
                )}
                {activeCard === 'water' && (
                  <WaterPanel log={log} update={update} />
                )}

                {/* 아무 카드도 선택 안 했을 때: 비워두기 */}
              </div>

              {/* ═══ 2. 오늘의 브리핑 ═══ */}
              <div>
                <h4 className="text-[13px] font-semibold text-nature-900 mb-2">오늘의 브리핑</h4>
                <div className="border-b border-cream-500 mb-3"></div>
                {briefings.length > 0 ? (
                  <div className="bg-cream-300 rounded-xl p-4 space-y-3">
                    {briefings.map((item) => (
                      <div key={item.text} className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                          {(() => { const iconMap = { moon: Moon, utensils: Utensils, dumbbell: Dumbbell, droplets: Droplets }; const Icon = iconMap[item.icon]; return Icon ? <Icon size={15} className="text-nature-900" /> : null; })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-nature-900">{item.text}</div>
                          <div className="text-[11px] text-neutral-400">{item.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cream-300 rounded-xl p-4 text-center">
                    <div className="mb-2 flex justify-center"><ClipboardList size={20} className="text-neutral-400" /></div>
                    <div className="text-[13px] font-medium text-nature-900 mb-1">아직 기록이 없어요</div>
                    <div className="text-[11px] text-neutral-400">건강 기록을 시작하면 브리핑이 표시돼요</div>
                  </div>
                )}
              </div>

              {/* ═══ 3. 나의 습관 ═══ */}
              <HabitsSection />

              {/* ═══ 4. 미답변 질문 ═══ */}
              <div data-tutorial="unanswered">
              <UnansweredQuestionsSection log={log} update={update} />
              </div>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}


/* ═══════════ 수면 패널 ═══════════ */
function SleepPanel({ log, update }) {
  const durations = [
    { key: 'under_5', label: '5h 미만' },
    { key: 'between_5_6', label: '5~6h' },
    { key: 'between_6_7', label: '6~7h' },
    { key: 'between_7_8', label: '7~8h' },
    { key: 'over_8', label: '8h 이상' },
  ];
  const qualities = [
    { key: 'very_good', label: '아주 좋음' },
    { key: 'good', label: '좋음' },
    { key: 'normal', label: '보통' },
    { key: 'bad', label: '나쁨' },
    { key: 'very_bad', label: '아주 나쁨' },
  ];

  if (!log.sleep_duration && !log.sleep_quality) {
    return (
      <div className="bg-cream-300 rounded-lg p-4 mb-3 text-center">
        <div className="mb-2 flex justify-center"><Moon size={16} className="text-nature-900" /></div>
        <div className="text-[13px] text-nature-900 mb-3">수면을 기록해주세요</div>
        <div className="text-[11px] text-neutral-400 mb-3">몇 시간 주무셨나요?</div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {durations.map(d => (
            <button key={d.key} onClick={() => update('sleep_duration', d.key)}
              className="px-2.5 py-1 rounded-full text-[12px] bg-white border border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500 transition-all">
              {d.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
      {/* 수면 시간 */}
      <div className="text-[11px] text-neutral-400 mb-2">수면 시간</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {durations.map(d => (
          <button key={d.key} onClick={() => update('sleep_duration', log.sleep_duration === d.key ? null : d.key)}
            className={`px-2.5 py-1 rounded-full text-[12px] transition-all ${
              log.sleep_duration === d.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            {d.label}
          </button>
        ))}
      </div>
      {/* 수면 질 */}
      <div className="text-[11px] text-neutral-400 mb-2">수면 질</div>
      <div className="flex flex-wrap gap-1.5">
        {qualities.map(q => (
          <button key={q.key} onClick={() => update('sleep_quality', log.sleep_quality === q.key ? null : q.key)}
            className={`px-2 py-1 rounded-full text-[12px] transition-all ${
              log.sleep_quality === q.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════ 식사 패널 ═══════════ */
function MealPanel({ log, update }) {
  const meals = [
    { key: 'breakfast', label: '아침', icon: 'sunrise' },
    { key: 'lunch', label: '점심', icon: 'sun' },
    { key: 'dinner', label: '저녁', icon: 'moon' },
  ];
  const options = [
    { key: 'hearty', label: '든든히' },
    { key: 'simple', label: '간단히' },
    { key: 'skipped', label: '못먹음' },
  ];
  const vegOptions = [
    { key: 'enough', label: '충분' },
    { key: 'little', label: '조금' },
    { key: 'none', label: '없음' },
  ];
  const balanceOptions = [
    { key: 'balanced', label: '균형' },
    { key: 'carb_heavy', label: '탄수화물 위주' },
    { key: 'protein_veg_heavy', label: '단백질·채소 위주' },
  ];

  return (
    <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
      {meals.map(meal => (
        <div key={meal.key} className="mb-3 last:mb-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[13px]">{(() => { const m = { sunrise: Sunrise, sun: Sun, moon: Moon }; const I = m[meal.icon]; return I ? <I size={13} className="text-nature-900" /> : null; })()}</span>
            <span className="text-[12px] font-medium text-nature-900">
              {meal.label}
              {log[meal.key] && <span className="text-neutral-400 font-normal"> — {MEAL_LABELS[log[meal.key]]}</span>}
            </span>
          </div>
          <div className="flex gap-1.5">
            {options.map(opt => (
              <button key={opt.key} onClick={() => update(meal.key, log[meal.key] === opt.key ? null : opt.key)}
                className={`px-2.5 py-1 rounded-full text-[12px] transition-all ${
                  log[meal.key] === opt.key
                    ? 'bg-nature-500 text-white border border-nature-500'
                    : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {meal.key !== 'dinner' && <div className="border-b border-black/[.04] mt-3"></div>}
        </div>
      ))}

      {/* 채소 */}
      <div className="border-t border-black/[.06] mt-3 pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Leaf size={13} className="text-nature-900" />
          <span className="text-[12px] font-medium text-nature-900">채소</span>
          {log.vegetable && <span className="text-[11px] text-neutral-400">— {vegOptions.find(v => v.key === log.vegetable)?.label}</span>}
        </div>
        <div className="flex gap-1.5">
          {vegOptions.map(opt => (
            <button key={opt.key} onClick={() => update('vegetable', log.vegetable === opt.key ? null : opt.key)}
              className={`px-2.5 py-1 rounded-full text-[12px] transition-all ${
                log.vegetable === opt.key
                  ? 'bg-nature-500 text-white border border-nature-500'
                  : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 식사구성 */}
      <div className="border-t border-black/[.06] mt-3 pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <UtensilsCrossed size={13} className="text-nature-900" />
          <span className="text-[12px] font-medium text-nature-900">식사구성</span>
          {log.meal_balance && <span className="text-[11px] text-neutral-400">— {balanceOptions.find(v => v.key === log.meal_balance)?.label}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {balanceOptions.map(opt => (
            <button key={opt.key} onClick={() => update('meal_balance', log.meal_balance === opt.key ? null : opt.key)}
              className={`px-2.5 py-1 rounded-full text-[12px] transition-all ${
                log.meal_balance === opt.key
                  ? 'bg-nature-500 text-white border border-nature-500'
                  : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ 운동 패널 ═══════════ */
function ExercisePanel({ log, update, save }) {
  const types = [
    { key: 'walking', label: '산책' },
    { key: 'running', label: '달리기' },
    { key: 'cycling', label: '자전거' },
    { key: 'swimming', label: '수영' },
    { key: 'gym', label: '헬스' },
    { key: 'home_workout', label: '홈트' },
    { key: 'other', label: '기타' },
  ];

  if (log.exercise_done === null) {
    return (
      <div className="bg-cream-300 rounded-lg p-4 mb-3 text-center">
        <div className="mb-2 flex justify-center"><Dumbbell size={16} className="text-nature-900" /></div>
        <div className="text-[13px] text-nature-900 mb-3">운동 — 안 했어요</div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => update('exercise_done', true)}
            className="px-3.5 py-1.5 rounded-full text-[12px] bg-nature-500 text-white border border-nature-500 transition-all">
            했어요
          </button>
          <button onClick={() => update('exercise_done', false)}
            className="px-3.5 py-1.5 rounded-full text-[12px] bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03] transition-all">
            못했어요
          </button>
        </div>
      </div>
    );
  }

  if (log.exercise_done === false) {
    return (
      <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell size={13} className="text-nature-900" />
          <span className="text-[12px] font-medium text-nature-900">운동 — 안 했어요</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save({ ...log, exercise_done: true, exercise_type: null, exercise_minutes: null })}
            className="px-3 py-1 rounded-full text-[12px] bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03] transition-all">
            했어요로 변경
          </button>
        </div>
        {/* 산책 */}
        <div className="border-t border-black/[.06] mt-3 pt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Footprints size={13} className="text-nature-900" />
            <span className="text-[12px] font-medium text-nature-900">산책</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => update('walk_done', log.walk_done === true ? null : true)}
              className={`px-3 py-1 rounded-full text-[12px] transition-all ${log.walk_done === true ? 'bg-nature-500 text-white border border-nature-500' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
              했어요
            </button>
            <button onClick={() => update('walk_done', log.walk_done === false ? null : false)}
              className={`px-3 py-1 rounded-full text-[12px] transition-all ${log.walk_done === false ? 'bg-nature-500 text-white border border-nature-500' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
              못했어요
            </button>
          </div>
        </div>
      </div>
    );
  }

  // exercise_done === true
  return (
    <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
      <div className="text-[11px] text-neutral-400 mb-2">운동 종류</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {types.map(t => (
          <button key={t.key} onClick={() => update('exercise_type', log.exercise_type === t.key ? null : t.key)}
            className={`px-2 py-1 rounded-full text-[12px] transition-all ${
              log.exercise_type === t.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-neutral-400 mb-2">운동 시간 (분)</div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => update('exercise_minutes', Math.max(0, (log.exercise_minutes || 0) - 10))}
          className="w-7 h-7 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[13px] hover:bg-black/[.03]">−</button>
        <span className="text-[16px] font-semibold text-nature-900 min-w-[40px] text-center">{log.exercise_minutes || 0}</span>
        <span className="text-[11px] text-neutral-300">분</span>
        <button onClick={() => update('exercise_minutes', Math.min(300, (log.exercise_minutes || 0) + 10))}
          className="w-7 h-7 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[13px] hover:bg-black/[.03]">+</button>
      </div>

      {/* 산책 */}
      <div className="border-t border-black/[.06] pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Footprints size={13} className="text-nature-900" />
          <span className="text-[12px] font-medium text-nature-900">산책</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => update('walk_done', log.walk_done === true ? null : true)}
            className={`px-3 py-1 rounded-full text-[12px] transition-all ${log.walk_done === true ? 'bg-nature-500 text-white border border-nature-500' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
            했어요
          </button>
          <button onClick={() => update('walk_done', log.walk_done === false ? null : false)}
            className={`px-3 py-1 rounded-full text-[12px] transition-all ${log.walk_done === false ? 'bg-nature-500 text-white border border-nature-500' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
            못했어요
          </button>
        </div>
      </div>

      <div className="border-t border-black/[.06] mt-3 pt-2">
        <button onClick={() => save({ ...log, exercise_done: false, exercise_type: null, exercise_minutes: null })}
          className="text-[11px] text-neutral-400 hover:text-nature-900 transition-colors">
          안 했어요로 변경
        </button>
      </div>
    </div>
  );
}

/* ═══════════ 수분 패널 ═══════════ */
function WaterPanel({ log, update }) {
  return (
    <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => update('water_cups', Math.max(0, log.water_cups - 1))}
          className="w-8 h-8 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[15px] hover:bg-black/[.03] transition-colors">−</button>
        <div className="text-center">
          <span className="text-[28px] font-semibold text-nature-900">{log.water_cups}</span>
          <span className="text-[13px] text-neutral-400 ml-1">/ 8잔</span>
        </div>
        <button onClick={() => update('water_cups', Math.min(12, log.water_cups + 1))}
          className="w-8 h-8 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[15px] hover:bg-black/[.03] transition-colors">+</button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <Droplets size={16} className="text-nature-400" />
        <div className="flex-1 h-2 bg-cream-500 rounded-full overflow-hidden">
          <div className="h-full bg-nature-400 rounded-full transition-all" style={{ width: `${Math.min(100, log.water_cups / 8 * 100)}%` }}></div>
        </div>
      </div>
      <div className="text-[11px] text-neutral-400 text-center">하루 권장 8잔 (240ml 기준)</div>
    </div>
  );
}

/* ═══════════ 나의 습관 섹션 ═══════════ */
// localStorage key: danaa_challenges
// 백엔드 연동 시: GET /api/v1/challenges/overview → active 배열
// 모델: UserChallenge (template_id, status, current_streak, days_completed, target_days, progress_pct, today_checked)
// 체크인: POST /api/v1/challenges/{user_challenge_id}/checkin { status: "ACHIEVED" | "MISSED" }
function HabitsSection() {
  const [challenges, setChallenges] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('danaa_challenges');
      if (saved) setChallenges(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  return (
    <div>
      <h4 className="text-[13px] font-semibold text-nature-900 mb-2">나의 습관</h4>
      <div className="border-b border-cream-500 mb-3"></div>
      {challenges.length === 0 ? (
        <div className="bg-cream-300 rounded-xl p-4 text-center">
          <div className="mb-2 flex justify-center"><Target size={20} className="text-nature-900" /></div>
          <div className="text-[13px] font-medium text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
          <div className="text-[11px] text-neutral-400 mb-3">챌린지에 참여하면 여기에 진행 상황이 표시돼요</div>
          <a href="/app/challenge" className="inline-block px-3.5 py-1.5 rounded-full text-[12px] bg-nature-500 text-white hover:bg-nature-600 transition-colors">
            챌린지 둘러보기
          </a>
        </div>
      ) : (
        <div className="bg-cream-300 rounded-xl p-4 space-y-3">
          {challenges.map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-nature-900">{item.emoji} {item.name}</span>
                <span className="text-[11px] text-neutral-400">{item.days_completed}/{item.target_days}일</span>
              </div>
              <div className="w-full h-1.5 bg-cream-500 rounded-full overflow-hidden">
                <div className="h-full bg-neutral-400 rounded-full" style={{ width: `${Math.min(100, item.days_completed / item.target_days * 100)}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════ 미답변 질문 섹션 ═══════════ */
// localStorage key: danaa_unanswered_questions
// 백엔드 연동 시: GET /api/v1/questions/unanswered → { questions: [...], total: N, answered: N }
// 모델: UnansweredQuestion (id, text, emoji, options: string[], field_key, answered_at)
// 답변: POST /api/v1/questions/{id}/answer { value: string }
function UnansweredQuestionsSection({ log, update }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  // 실시간으로 log에서 미답변 필드를 계산
  const ALL_QUESTIONS = [
    { id: 'sleep', icon: Moon, text: '몇 시간 주무셨나요?', options: ['5h 미만', '5~6h', '6~7h', '7~8h', '8h 이상'], field: 'sleep_duration', values: ['under_5', 'between_5_6', 'between_6_7', 'between_7_8', 'over_8'] },
    { id: 'breakfast', icon: Sunrise, text: '아침은 드셨나요?', options: ['든든히', '간단히', '못먹음'], field: 'breakfast', values: ['hearty', 'simple', 'skipped'] },
    { id: 'exercise', icon: Dumbbell, text: '오늘 운동 하셨나요?', options: ['했어요', '못했어요'], field: 'exercise_done', values: [true, false] },
    { id: 'veg', icon: Leaf, text: '채소·과일 드셨나요?', options: ['충분히', '조금', '못 먹었어요'], field: 'vegetable', values: ['enough', 'little', 'none'] },
    { id: 'balance', icon: UtensilsCrossed, text: '식사 구성은 어떠셨나요?', options: ['균형', '탄수화물 위주', '단백질·채소 위주'], field: 'meal_balance', values: ['balanced', 'carb_heavy', 'protein_veg_heavy'] },
    { id: 'mood', icon: Smile, text: '오늘 기분은 어떠세요?', options: ['좋아요', '보통이에요', '별로예요'], field: 'mood', values: ['good', 'normal', 'bad'] },
  ];

  const questions = ALL_QUESTIONS.filter(q => log[q.field] === null || log[q.field] === undefined);
  const totalCount = ALL_QUESTIONS.length;
  const answeredCount = totalCount - questions.length;

  function answerQuestion(qIdx, valueIdx) {
    const q = questions[qIdx];
    if (q && update) {
      update(q.field, q.values[valueIdx]);
    }
    if (currentIdx >= questions.length - 1 && questions.length > 1) {
      setCurrentIdx(Math.max(0, questions.length - 2));
    }
  }
  const currentQ = questions[currentIdx];

  return (
    <div>
      <h4 className="text-[13px] font-semibold text-nature-900 mb-2">미답변 질문</h4>
      <div className="border-b border-cream-500 mb-3"></div>

      {questions.length === 0 ? (
        <div className="bg-cream-300 rounded-xl p-4 text-center">
          <div className="mb-2 flex justify-center"><CircleCheck size={20} className="text-nature-500" /></div>
          <div className="text-[13px] font-medium text-nature-900 mb-1">모든 질문에 답변 완료!</div>
          <div className="text-[11px] text-neutral-400">AI 채팅에서 대화하면 새 질문이 표시돼요</div>
        </div>
      ) : (
        <>
          {/* 진행 바 */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex-1 h-1 bg-cream-500 rounded-full overflow-hidden mr-2">
                <div className="h-full bg-nature-500 rounded-full transition-all" style={{ width: `${(answeredCount / totalCount) * 100}%` }}></div>
              </div>
              <span className="text-[11px] text-neutral-400">{answeredCount}/{totalCount} 완료</span>
            </div>
          </div>

          {/* 현재 질문 카드 */}
          {currentQ && (
            <div className="bg-cream-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">{currentQ.icon && <currentQ.icon size={15} className="text-nature-900" />}</div>
                <div className="text-[13px] font-medium text-nature-900">{currentQ.text}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentQ.options.map((opt, optIdx) => (
                  <button
                    key={opt}
                    onClick={() => answerQuestion(currentIdx, optIdx)}
                    className="px-3 py-1.5 rounded-full text-[12px] bg-white border border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 네비게이션 */}
          {questions.length > 1 && (
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => { /* skip / 나중에 */ }}
                className="text-[11px] text-neutral-400 hover:text-nature-900 transition-colors"
              >
                나중에 →
              </button>
              <div className="flex items-center gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIdx ? 'bg-nature-900' : 'bg-neutral-300'}`}></div>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="w-6 h-6 rounded border border-cream-500 bg-white text-[11px] text-neutral-400 flex items-center justify-center hover:bg-black/[.03] disabled:opacity-30"
                >‹</button>
                <button
                  onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
                  disabled={currentIdx === questions.length - 1}
                  className="w-6 h-6 rounded border border-cream-500 bg-white text-[11px] text-neutral-400 flex items-center justify-center hover:bg-black/[.03] disabled:opacity-30"
                >›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
