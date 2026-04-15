'use client';

import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Tutorial from '../../../components/Tutorial';
import InlineHealthQuestionCard from './components/InlineHealthQuestionCard';
import { api, getToken } from '../../../hooks/useApi';

/* ── API 설정 ── */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
const CHAT_API_PATH = '/api/v1/chat/send';
const CHAT_API_URL = `${API_BASE}${CHAT_API_PATH}`;
const CHAT_SESSIONS_API_PATH = '/api/v1/chat/sessions';
const HEALTH_ANSWER_API_URL = `${API_BASE}/api/v1/chat/health-answer`;
const CHAT_HISTORY_API_PATH = '/api/v1/chat/history';
const DAILY_HEALTH_API_PATH = (logDate) => `/api/v1/health/daily/${logDate}`;
const DEV_AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';
const DAILY_SCHEMA_VERSION_KEY = 'danaa_daily_schema_v';
const DAILY_SCHEMA_VERSION = '1.7';
const PANEL_SAVE_DEBOUNCE_MS = 500;
const CHAT_NEW_QUERY_KEY = 'new';
const CHAT_NEW_QUERY_VALUE = '1';
const PANEL_LOG_FIELDS = [
  'sleep_quality',
  'sleep_duration_bucket',
  'breakfast_status',
  'lunch_status',
  'dinner_status',
  'vegetable_intake_level',
  'meal_balance_level',
  'exercise_done',
  'exercise_type',
  'exercise_minutes',
  'walk_done',
  'water_cups',
  'mood_level',
];

/* ── 유틸 ── */
const todayKey = () => {
  const d = new Date();
  return `danaa_daily_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const LEGACY_LOG_FIELD_MAP = new Map([
  [['sleep', '_', 'duration'].join(''), 'sleep_duration_bucket'],
  [['break', 'fast'].join(''), 'breakfast_status'],
  [['lunch'].join(''), 'lunch_status'],
  [['dinner'].join(''), 'dinner_status'],
  [['veget', 'able'].join(''), 'vegetable_intake_level'],
  [['meal', '_', 'balance'].join(''), 'meal_balance_level'],
  [['mo', 'od'].join(''), 'mood_level'],
]);

const emptyLog = () => ({
  sleep_quality: null, sleep_duration_bucket: null,
  breakfast_status: null, lunch_status: null, dinner_status: null,
  vegetable_intake_level: null, meal_balance_level: null,
  exercise_done: null, exercise_type: null, exercise_minutes: null, walk_done: null,
  water_cups: 0, mood_level: null,
});

function migrateStoredLog(rawLog) {
  const nextLog = { ...emptyLog(), ...(rawLog || {}) };

  LEGACY_LOG_FIELD_MAP.forEach((canonicalField, legacyField) => {
    if (
      nextLog[canonicalField] == null &&
      rawLog &&
      Object.prototype.hasOwnProperty.call(rawLog, legacyField)
    ) {
      nextLog[canonicalField] = rawLog[legacyField];
    }
    delete nextLog[legacyField];
  });

  return nextLog;
}

function isLogFieldAnswered(field, value) {
  if (field === 'water_cups') return Number(value) > 0;
  return value !== null && value !== undefined && value !== '';
}

function isServerConfirmedField(log, field) {
  return isLogFieldAnswered(field, log?.[field]);
}

function isHealthQuestionVisibleForLog(question, log) {
  const condition = question?.condition;
  if (!condition) return true;

  if (condition.endsWith('_true')) {
    const parentField = condition.slice(0, -5);
    return log?.[parentField] === true;
  }

  return false;
}

const SLEEP_LABELS = {
  under_5: '5시간 미만',
  between_5_6: '5~6시간',
  between_6_7: '6~7시간',
  between_7_8: '7~8시간',
  over_8: '8시간 이상',
};
const SLEEP_QUALITY_LABELS = {
  very_good: '아주 좋음',
  good: '좋음',
  normal: '보통',
  bad: '나쁨',
  very_bad: '아주 나쁨',
};
const MEAL_LABELS = { hearty: '든든히 먹음', simple: '간단히 먹음', skipped: '거름' };
const EXERCISE_TYPES = {
  walking: '걷기',
  running: '달리기',
  cycling: '자전거',
  swimming: '수영',
  gym: '헬스',
  home_workout: '홈트',
  other: '기타',
};

const HEALTH_OPTION_LABELS = {
  ...SLEEP_LABELS,
  ...SLEEP_QUALITY_LABELS,
  ...MEAL_LABELS,
  ...EXERCISE_TYPES,
  enough: '충분해요',
  little: '조금 먹었어요',
  none: '거의 없어요',
  balanced: '균형 잡혔어요',
  carb_heavy: '탄수화물이 많아요',
  protein_veg_heavy: '단백질과 채소가 많아요',
  one: '한 번',
  two_plus: '두 번 이상',
  stressed: '스트레스가 있어요',
  very_stressed: '많이 지쳤어요',
  light: '가볍게',
  moderate: '보통',
  heavy: '많이',
};

function getHealthOptionLabel(option) {
  if (typeof option === 'boolean') return option ? '네' : '아니요';
  if (typeof option === 'number') return `${option}`;
  return HEALTH_OPTION_LABELS[option] || String(option).replaceAll('_', ' ');
}

function normalizeMissingSummary(rawSummary) {
  if (!rawSummary || typeof rawSummary !== 'object') return null;
  const labels = Array.isArray(rawSummary.labels)
    ? rawSummary.labels.filter((label) => typeof label === 'string' && label.trim())
    : [];

  return {
    count: Number(rawSummary.count || 0),
    labels,
    truncatedCount: Number(rawSummary.truncated_count || 0),
  };
}

function normalizePendingQuestions(rawPending) {
  if (!rawPending || typeof rawPending !== 'object') return null;

  const bundles = Array.isArray(rawPending.bundles)
    ? rawPending.bundles
        .map((bundle) => {
          const questions = Array.isArray(bundle?.questions)
            ? bundle.questions
                .filter((question) => question && typeof question.field === 'string')
                .map((question) => ({
                  field: question.field,
                  summaryLabel: question.summary_label || question.text || question.field,
                  text: question.text || question.summary_label || question.field,
                  inputType: question.input_type || question.inputType || 'select',
                  options: Array.isArray(question.options) ? question.options : [],
                  condition: question.condition || null,
                }))
            : [];

          if (!bundle?.bundle_key || questions.length === 0) return null;

          return {
            bundleKey: bundle.bundle_key,
            name: bundle.name || bundle.bundle_key,
            unansweredCount: Number(bundle.unanswered_count || questions.length),
            questions,
          };
        })
        .filter(Boolean)
    : [];

  return {
    count: Number(rawPending.count || bundles.length),
    bundles,
  };
}

function buildInlineSubmitResult(fieldResults) {
  const entries = Object.entries(fieldResults || {});
  return {
    saved_fields: entries
      .filter(([, result]) => result === 'accepted')
      .map(([field]) => field),
    skipped_fields: entries
      .filter(([, result]) => String(result).startsWith('skipped'))
      .map(([field]) => field),
  };
}

function getAnsweredFieldsForBundle(bundle, log) {
  if (!bundle || !Array.isArray(bundle.questions)) return [];
  return bundle.questions
    .filter((question) => isLogFieldAnswered(question.field, log?.[question.field]))
    .map((question) => question.field);
}

function buildChatUrl({ sessionId = null, isNew = false } = {}) {
  if (sessionId) {
    return `/app/chat?session_id=${sessionId}`;
  }
  if (isNew) {
    return `/app/chat?${CHAT_NEW_QUERY_KEY}=${CHAT_NEW_QUERY_VALUE}`;
  }
  return '/app/chat';
}

function normalizeHealthQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((bundle) => {
      const questions = Array.isArray(bundle?.questions)
        ? bundle.questions
            .filter((question) => question && typeof question.field === 'string')
            .map((question) => ({
              field: question.field,
              text: question.text || question.field,
              options: Array.isArray(question.options) ? question.options : [],
              inputType: question.input_type || 'select',
              condition: question.condition || null,
            }))
        : [];

      if (!bundle?.bundle_key || questions.length === 0) return null;

      return {
        bundleKey: bundle.bundle_key,
        name: bundle.name || bundle.bundle_key,
        questions,
      };
    })
    .filter(Boolean);
}

function getSleepDisplay(log) {
  if (!log.sleep_duration_bucket) return null;
  const map = { under_5: '<5h', between_5_6: '5.5h', between_6_7: '6.5h', between_7_8: '7.5h', over_8: '8h+' };
  return map[log.sleep_duration_bucket] || '—';
}
function getMealCount(log) {
  return [log.breakfast_status, log.lunch_status, log.dinner_status].filter(v => v !== null).length;
}

const ChatTranscript = memo(function ChatTranscript({
  messages,
  streamingDraft,
  chatEndRef,
  onSubmitHealthAnswer,
}) {
  return (
    <>
      {messages.map((msg) => {
        const primaryHealthQuestion = Array.isArray(msg.healthQuestions) ? msg.healthQuestions[0] : null;

        return (
          <div
            key={msg.id ?? `${msg.role}-${msg.ts ?? 'message'}`}
            data-message-id={msg.id ?? undefined}
            className="max-w-[840px] mx-auto mb-3.5"
          >
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div>
                  <div className="bg-nature-900 text-white text-[13px] leading-[1.7] rounded-2xl rounded-br-md px-4 py-2.5 max-w-[480px]">
                    {msg.content}
                  </div>
                  <div className="text-[11px] text-neutral-300 mt-0.5 text-right">{msg.ts}</div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">다</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] leading-[1.7] ${msg.isError ? 'text-red-500' : 'text-nature-900'}`}>
                    {msg.content || <span className="text-neutral-300">생각 중...</span>}
                    {msg.streaming && <span className="inline-block w-[2px] h-[14px] bg-nature-900 ml-0.5 animate-pulse align-middle"></span>}
                  </div>
                  {msg.ts && <div className="text-[11px] text-neutral-300 mt-0.5">{msg.ts}</div>}
                  {!msg.isError && !msg.streaming && primaryHealthQuestion && (
                    <div className="mt-3 max-w-[560px]" data-inline-health-card="true">
                      <InlineHealthQuestionCard
                        bundleKey={primaryHealthQuestion.bundleKey}
                        bundleName={primaryHealthQuestion.name}
                        questions={primaryHealthQuestion.questions}
                        onSubmit={onSubmitHealthAnswer}
                        formatOptionLabel={getHealthOptionLabel}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {streamingDraft && (
        <div
          data-message-id={streamingDraft.id ?? undefined}
          className="max-w-[840px] mx-auto mb-3.5"
        >
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">다</div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] leading-[1.7] ${streamingDraft.isError ? 'text-red-500' : 'text-nature-900'}`}>
                {streamingDraft.content || <span className="text-neutral-300">생각 중...</span>}
                {streamingDraft.streaming && <span className="inline-block w-[2px] h-[14px] bg-nature-900 ml-0.5 animate-pulse align-middle"></span>}
              </div>
              {streamingDraft.ts && <div className="text-[11px] text-neutral-300 mt-0.5">{streamingDraft.ts}</div>}
            </div>
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </>
  );
});

export default function ChatPage() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  const [log, setLog] = useState(emptyLog());
  const [missingSummary, setMissingSummary] = useState(null);
  const [pendingQuestions, setPendingQuestions] = useState(null);
  const [manualCardBundleKey, setManualCardBundleKey] = useState(null);
  const [todaySaveState, setTodaySaveState] = useState('idle');
  const [loaded, setLoaded] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [risk, setRisk] = useState(null);

  // 튜토리얼 상태
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialKey, setTutorialKey] = useState(0);

  // 채팅 상태
  const [messages, setMessages] = useState([]);
  const [streamingDraft, setStreamingDraft] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyPolicyNotice, setHistoryPolicyNotice] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isFollowingActiveReply, setIsFollowingActiveReply] = useState(false);
  const [activeReplyMessageId, setActiveReplyMessageId] = useState(null);
  const chatScrollRef = useRef(null);
  const chatEndRef = useRef(null);
  const manualHealthCardRef = useRef(null);
  const abortRef = useRef(null);
  const draftMessageRef = useRef(null);
  const streamPerfRef = useRef(null);
  const draftFlushFrameRef = useRef(null);
  const pendingDraftDeltaRef = useRef('');
  const scrollFrameRef = useRef(null);
  const scrollCountRef = useRef(0);
  const nextMessageIdRef = useRef(1);
  const saveTimerRef = useRef(null);
  const saveVersionRef = useRef(0);
  const lastServerLogRef = useRef(migrateStoredLog(emptyLog()));

  const createLocalMessageId = useCallback(() => {
    const nextId = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    return `local-${nextId}`;
  }, []);

  const cacheDailyLog = useCallback((nextLog) => {
    const migratedNext = migrateStoredLog(nextLog);
    try {
      localStorage.setItem(todayKey(), JSON.stringify(migratedNext));
      localStorage.setItem(DAILY_SCHEMA_VERSION_KEY, DAILY_SCHEMA_VERSION);
    } catch {}
    return migratedNext;
  }, []);

  const applyServerDailyLog = useCallback((nextLog) => {
    const migratedNext = cacheDailyLog(nextLog);
    lastServerLogRef.current = migratedNext;
    setLog(migratedNext);
    return migratedNext;
  }, [cacheDailyLog]);

  const applyDailyPayload = useCallback((payload) => {
    const nextLog = migrateStoredLog(payload?.daily_log || payload || emptyLog());
    const nextMissingSummary = normalizeMissingSummary(
      payload?.daily_log?.missing_summary ?? payload?.missing_summary,
    );
    const nextPendingQuestions = normalizePendingQuestions(
      payload?.daily_log?.pending_questions ?? payload?.pending_questions,
    );
    applyServerDailyLog(nextLog);
    setMissingSummary(nextMissingSummary);
    setPendingQuestions(nextPendingQuestions);
    return nextLog;
  }, [applyServerDailyLog]);

  const buildTodayLogPatch = useCallback((nextLog) => {
    const payload = { source: 'direct' };
    const serverLog = migrateStoredLog(lastServerLogRef.current || emptyLog());

    PANEL_LOG_FIELDS.forEach((field) => {
      const nextValue = nextLog?.[field];
      const serverValue = serverLog?.[field];

      if (nextValue === serverValue) return;
      if (nextValue === null || nextValue === undefined) return;

      payload[field] = nextValue;
    });

    if (payload.exercise_done === false) {
      delete payload.exercise_type;
      delete payload.exercise_minutes;
    }
    if (payload.alcohol_today === false) {
      delete payload.alcohol_amount_level;
    }

    return Object.keys(payload).length > 1 ? payload : null;
  }, []);

  const persistTodayLog = useCallback(async (nextLog, version) => {
    const payload = buildTodayLogPatch(nextLog);

    if (!payload) {
      if (version === saveVersionRef.current) {
        setTodaySaveState('idle');
      }
      return;
    }

    try {
      const response = await api(DAILY_HEALTH_API_PATH(todayDateString()), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      applyDailyPayload(result);

      if (version === saveVersionRef.current) {
        setTodaySaveState('saved');
      }
    } catch (error) {
      console.error('today_log_save_failed', error);
      if (version === saveVersionRef.current) {
        const fallback = migrateStoredLog(lastServerLogRef.current || emptyLog());
        cacheDailyLog(fallback);
        setLog(fallback);
        setTodaySaveState('error');
      }
    }
  }, [applyDailyPayload, buildTodayLogPatch, cacheDailyLog]);

  const fetchTodayLog = useCallback(async () => {
    try {
      const response = await api(DAILY_HEALTH_API_PATH(todayDateString()));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      applyDailyPayload(payload);
      setTodaySaveState('idle');
    } catch (error) {
      console.error('today_log_load_failed', error);
    }
  }, [applyDailyPayload]);

  const resetConversation = useCallback((explicitNew = false) => {
    if (isStreaming && abortRef.current) {
      abortRef.current.abort();
    }
    draftMessageRef.current = null;
    pendingDraftDeltaRef.current = '';
    setStreamingDraft(null);
    setMessages([]);
    setSessionId(null);
    setInputText('');
    setIsStreaming(false);
    setIsHistoryLoading(false);
    setHistoryPolicyNotice(false);
    setIsFollowingActiveReply(false);
    setActiveReplyMessageId(null);
    setManualCardBundleKey(null);
    if (typeof window !== 'undefined') {
      const nextUrl = buildChatUrl({ isNew: explicitNew });
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(window.history.state, '', nextUrl);
      }
      window.dispatchEvent(new CustomEvent('danaa:conversation-active', {
        detail: { id: null, isNew: explicitNew },
      }));
    }
  }, [isStreaming]);

  const loadSessionHistory = useCallback(async (targetSessionId) => {
    if (!targetSessionId || isStreaming) return false;

    setIsHistoryLoading(true);
    try {
      const response = await api(`${CHAT_HISTORY_API_PATH}?session_id=${targetSessionId}&limit=50`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const nextMessages = Array.isArray(payload?.messages)
        ? payload.messages.map((message) => ({
            id: message.id ?? createLocalMessageId(),
            role: message.role,
            content: message.content,
            ts: new Date(message.created_at).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            streaming: false,
            status: 'completed',
            isError: false,
            healthQuestions: [],
          }))
        : [];

      draftMessageRef.current = null;
      pendingDraftDeltaRef.current = '';
      setStreamingDraft(null);
      setMessages(nextMessages);
      setSessionId(targetSessionId);
      setInputText('');
      setActiveCard(null);
      setManualCardBundleKey(null);
      setHistoryPolicyNotice(nextMessages.length > 0);
      setIsFollowingActiveReply(false);
      setActiveReplyMessageId(null);
      if (typeof window !== 'undefined') {
        const nextUrl = buildChatUrl({ sessionId: targetSessionId });
        if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
          window.history.replaceState(window.history.state, '', nextUrl);
        }
        window.dispatchEvent(new CustomEvent('danaa:conversation-active', {
          detail: { id: targetSessionId, isNew: false },
        }));
      }
      return true;
    } catch (error) {
      console.error('chat_history_load_failed', error);
      return false;
    } finally {
      setIsHistoryLoading(false);
    }
  }, [createLocalMessageId, isStreaming]);

  const restoreLatestSession = useCallback(async () => {
    const response = await api(`${CHAT_SESSIONS_API_PATH}?limit=1`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const latestSessionId = Number(payload?.sessions?.[0]?.id);
    if (!latestSessionId) {
      resetConversation(false);
      return true;
    }

    return loadSessionHistory(latestSessionId);
  }, [loadSessionHistory, resetConversation]);

  // 자동 스크롤
  const scrollToReplyTarget = useCallback((messageId, behavior = 'smooth', block = 'nearest') => {
    if (!messageId || typeof document === 'undefined') return;
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const target = document.querySelector(`[data-message-id="${String(messageId)}"]`);
      if (!target || typeof target.scrollIntoView !== 'function') return;
      scrollCountRef.current += 1;
      target.scrollIntoView({ behavior, block });
    });
  }, []);

  const handleChatScroll = useCallback(() => {
    if (!isStreaming || !isFollowingActiveReply) return;
    const container = chatScrollRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 160) {
      setIsFollowingActiveReply(false);
    }
  }, [isFollowingActiveReply, isStreaming]);

  useEffect(() => {
    if (!streamingDraft?.id || !isFollowingActiveReply) return;
    scrollToReplyTarget(streamingDraft.id, 'smooth', 'start');
  }, [isFollowingActiveReply, scrollToReplyTarget, streamingDraft?.id]);

  useEffect(() => {
    if (!isStreaming || !streamingDraft?.content || !activeReplyMessageId || !isFollowingActiveReply) return;
    scrollToReplyTarget(activeReplyMessageId, 'auto', 'nearest');
  }, [
    activeReplyMessageId,
    isFollowingActiveReply,
    isStreaming,
    scrollToReplyTarget,
    streamingDraft?.content,
  ]);

  useEffect(() => {
    if (isStreaming || !activeReplyMessageId || !isFollowingActiveReply) return;
    const hasFinalReply = messages.some((message) => String(message.id) === String(activeReplyMessageId));
    if (!hasFinalReply) return;

    scrollToReplyTarget(activeReplyMessageId, 'smooth', 'nearest');
    setIsFollowingActiveReply(false);
  }, [activeReplyMessageId, isFollowingActiveReply, isStreaming, messages, scrollToReplyTarget]);

  useEffect(() => () => {
    if (draftFlushFrameRef.current !== null) cancelAnimationFrame(draftFlushFrameRef.current);
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
  }, []);

  // localStorage 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey());
      if (saved) {
        const migratedLog = migrateStoredLog(JSON.parse(saved));
        setLog(migratedLog);
        localStorage.setItem(todayKey(), JSON.stringify(migratedLog));
        localStorage.setItem(DAILY_SCHEMA_VERSION_KEY, DAILY_SCHEMA_VERSION);
      }
      const ob = localStorage.getItem('danaa_onboarding');
      if (ob) setOnboarding(JSON.parse(ob));
      const rk = localStorage.getItem('danaa_risk');
      if (rk) setRisk(JSON.parse(rk));
      // 튜토리얼: 온보딩 완료 + 튜토리얼 미완료 시 표시
      if (ob && !localStorage.getItem('danaa_tutorial_done')) {
        setShowTutorial(true);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    fetchTodayLog();
  }, [fetchTodayLog, loaded]);

  useEffect(() => {
    const handleLoadSession = (event) => {
      const targetSessionId = Number(event?.detail?.id);
      if (!targetSessionId) return;
      loadSessionHistory(targetSessionId);
    };

    window.addEventListener('danaa:load-session', handleLoadSession);
    window.__danaa_newChat = () => resetConversation(true);

    return () => {
      window.removeEventListener('danaa:load-session', handleLoadSession);
      if (typeof window !== 'undefined' && window.__danaa_newChat) {
        delete window.__danaa_newChat;
      }
    };
  }, [loadSessionHistory, resetConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const requestedSessionId = Number(searchParams.get('session_id'));
    const explicitNew = searchParams.get(CHAT_NEW_QUERY_KEY) === CHAT_NEW_QUERY_VALUE;

    if (isStreaming || isHistoryLoading) {
      return;
    }

    (async () => {
      if (requestedSessionId) {
        if (sessionId === requestedSessionId) {
          return;
        }
        const restored = await loadSessionHistory(requestedSessionId);
        if (!restored) {
          resetConversation(true);
        }
        return;
      }

      if (explicitNew) {
        if (sessionId || messages.length > 0) {
          resetConversation(true);
        } else {
          window.dispatchEvent(new CustomEvent('danaa:conversation-active', {
            detail: { id: null, isNew: true },
          }));
        }
        return;
      }

      if (!sessionId && messages.length === 0) {
        try {
          const restored = await restoreLatestSession();
          if (!restored) {
            resetConversation(true);
          }
        } catch (error) {
          console.error('chat_session_restore_failed', error);
          resetConversation(true);
        }
      }
    })();

    return undefined;
  }, [isHistoryLoading, isStreaming, loadSessionHistory, messages.length, resetConversation, restoreLatestSession, sessionId]);

  useEffect(() => {
    async function syncOnboardingState() {
      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        if (status.is_completed) {
          setOnboarding(status);
          setRisk({
            group: status.user_group || null,
            level: status.initial_risk_level || null,
            score: status.initial_findrisc_score || null,
          });
          const tutorialPending = localStorage.getItem('danaa_tutorial_pending') === 'true';
          const tutorialDone = localStorage.getItem('danaa_tutorial_done') === 'true';
          if (tutorialPending || !tutorialDone) {
            setShowTutorial(false);
            window.setTimeout(() => {
              const stillPending = localStorage.getItem('danaa_tutorial_pending') === 'true';
              const stillDone = localStorage.getItem('danaa_tutorial_done') === 'true';
              if (stillPending || !stillDone) {
                setTutorialKey((prev) => prev + 1);
                setShowTutorial(true);
              }
            }, 300);
          }
        } else {
          setOnboarding(null);
          setRisk(null);
        }
      } catch {}
    }

    syncOnboardingState();
  }, []);

  /* ── SSE 파싱 유틸 ── */
  function parseLegacySSE(text) {
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
        try { events.push({ event: currentEvent, data: JSON.parse(currentData) }); } catch { return { events, invalid: true }; }
        currentEvent = null;
        currentData = '';
      }
    }
    return { events, invalid: false };
  }

  function parseSSEFrame(frame) {
    const lines = frame.split('\n');
    let eventLine = null;
    let dataLine = null;

    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('event: ')) {
        if (eventLine !== null) return null;
        eventLine = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        if (dataLine !== null) return null;
        dataLine = line.slice(6);
      } else {
        return null;
      }
    }

    if (!eventLine || dataLine === null) return null;

    try {
      return { event: eventLine, data: JSON.parse(dataLine) };
    } catch {
      return null;
    }
  }

  function createIncrementalSSEParser() {
    let buffer = '';

    return {
      feed(chunk) {
        buffer += chunk;
        const events = [];

        while (true) {
          const frameEnd = buffer.indexOf('\n\n');
          if (frameEnd === -1) break;

          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);

          if (!frame.trim()) continue;

          const parsed = parseSSEFrame(frame);
          if (!parsed) return { events, invalid: true };
          events.push(parsed);
        }

        return { events, invalid: false };
      },
      flush() {
        return buffer.trim().length > 0;
      },
    };
  }

  function pushClientPerf(result) {
    if (typeof window === 'undefined') return;
    const payload = { ...result, ts: new Date().toISOString() };
    window.__danaaChatPerf = [...(window.__danaaChatPerf || []), payload];
    console.info('chat_client_perf', payload);
  }

  function scheduleFirstPaintMeasure() {
    const perf = streamPerfRef.current;
    if (!perf || perf.paintTtftMs !== null || perf.paintPending) return;
    perf.paintPending = true;
    requestAnimationFrame(() => {
      const current = streamPerfRef.current;
      if (!current || current.paintTtftMs !== null || current.requestStartedAt == null) return;
      current.paintTtftMs = performance.now() - current.requestStartedAt;
      current.paintPending = false;
    });
  }

  function flushPendingDraftContent() {
    const currentDraft = draftMessageRef.current;
    if (!currentDraft) return;
    if (!pendingDraftDeltaRef.current) return;
    const nextDraft = {
      ...currentDraft,
      content: `${currentDraft.content}${pendingDraftDeltaRef.current}`,
    };
    pendingDraftDeltaRef.current = '';
    draftMessageRef.current = nextDraft;
    setStreamingDraft(nextDraft);
    scheduleFirstPaintMeasure();
  }

  function appendAssistantDraftContent(delta) {
    if (!draftMessageRef.current) return;
    pendingDraftDeltaRef.current += delta;
    if (draftFlushFrameRef.current !== null) return;
    draftFlushFrameRef.current = requestAnimationFrame(() => {
      draftFlushFrameRef.current = null;
      flushPendingDraftContent();
    });
  }

  function finalizeAssistantDraft(status, overrides = {}) {
    if (draftFlushFrameRef.current !== null) {
      cancelAnimationFrame(draftFlushFrameRef.current);
      draftFlushFrameRef.current = null;
    }
    flushPendingDraftContent();
    const currentDraft = draftMessageRef.current;
    if (!currentDraft) return false;

    const finalDraft = {
      ...currentDraft,
      ...overrides,
      streaming: false,
      status,
      ts: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    draftMessageRef.current = null;
    pendingDraftDeltaRef.current = '';
    setStreamingDraft(null);
    setMessages(prev => [...prev, finalDraft]);
    return true;
  }

  const submitHealthAnswer = useCallback(async (bundleKey, answers) => {
    const authToken = getToken() || DEV_AUTH_TOKEN;
    const response = await fetch(HEALTH_ANSWER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        bundle_key: bundleKey,
        answers,
      }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      const detail = payload?.detail;
      throw new Error(typeof detail === 'string' ? detail : '저장 중 문제가 생겼어요.');
    }

    await fetchTodayLog();

    return payload;
  }, [fetchTodayLog]);

  const submitPendingQuestionAnswer = useCallback(async (_bundleKey, answers) => {
    const response = await api(DAILY_HEALTH_API_PATH(todayDateString()), {
      method: 'PATCH',
      body: JSON.stringify({
        source: 'direct',
        ...answers,
      }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      const detail = payload?.detail;
      throw new Error(typeof detail === 'string' ? detail : '보완 기록을 저장하는 중 문제가 생겼어요.');
    }

    applyDailyPayload(payload);
    return buildInlineSubmitResult(payload?.field_results);
  }, [applyDailyPayload]);

  /* ── 메시지 전송 ── */
const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming || isHistoryLoading) return;

    const userMsg = {
      id: createLocalMessageId(),
      role: 'user',
      content: text,
      ts: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    const aiMsg = {
      id: createLocalMessageId(),
      role: 'assistant',
      content: '',
      ts: null,
      streaming: true,
      status: 'streaming',
      isError: false,
      healthQuestions: [],
    };

    setMessages(prev => [...prev, userMsg]);
    draftMessageRef.current = aiMsg;
    setStreamingDraft(aiMsg);
    setActiveReplyMessageId(aiMsg.id);
    setIsFollowingActiveReply(true);
    setInputText('');
    setHistoryPolicyNotice(false);
    setIsStreaming(true);
    streamPerfRef.current = {
      requestStartedAt: typeof performance !== 'undefined' ? performance.now() : null,
      wireTtftMs: null,
      paintTtftMs: null,
      paintPending: false,
      receiverVersion: 'v1',
      result: 'streaming',
    };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const authToken = getToken() || DEV_AUTH_TOKEN;
      const res = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message: text, session_id: sessionId }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (!res.body) {
        throw new Error('Empty response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const receiverVersion = res.headers.get('X-Chat-SSE-Receiver-Version');
      const useV2Parser = receiverVersion === 'v2';
      const incrementalParser = createIncrementalSSEParser();
      let legacyBuffer = '';
      const streamState = { phase: 'streaming', firstTokenSeen: false };
      if (streamPerfRef.current) {
        streamPerfRef.current.receiverVersion = useV2Parser ? 'v2' : 'v1';
      }

      const markTerminal = (status, overrides = {}) => {
        if (streamState.phase !== 'streaming') return false;
        streamState.phase = status;
        if (streamPerfRef.current) {
          streamPerfRef.current.result = status;
        }
        return finalizeAssistantDraft(status, overrides);
      };

      const applyError = (messageText) => {
        if (streamState.phase !== 'streaming') return;
        if (!streamState.firstTokenSeen) {
          markTerminal('failed', {
            content: messageText || '현재 AI 서버와 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
            isError: true,
          });
          return;
        }
        markTerminal('failed', { isError: true });
      };

      const handleEvent = (evt) => {
        if (streamState.phase !== 'streaming') return;
        if (evt.event === 'token' && evt.data.content) {
          const perf = streamPerfRef.current;
          if (perf && perf.requestStartedAt != null && perf.wireTtftMs === null) {
            perf.wireTtftMs = performance.now() - perf.requestStartedAt;
          }
          streamState.firstTokenSeen = true;
          appendAssistantDraftContent(evt.data.content);
          return;
        }
        if (evt.event === 'done') {
          if (evt.data.session_id) {
            setSessionId(evt.data.session_id);
            if (typeof window !== 'undefined') {
              const nextUrl = buildChatUrl({ sessionId: evt.data.session_id });
              if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
                window.history.replaceState(window.history.state, '', nextUrl);
              }
              window.dispatchEvent(new CustomEvent('danaa:conversation-active', {
                detail: { id: evt.data.session_id, isNew: false },
              }));
              window.dispatchEvent(new CustomEvent('danaa:conversation-refresh'));
            }
          }
          markTerminal('completed', {
            healthQuestions: normalizeHealthQuestions(evt.data.health_questions),
          });
          return;
        }
        if (evt.event === 'error') {
          applyError(evt.data.message);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        // 처리된 이벤트 이후의 남은 버퍼 유지
        if (useV2Parser) {
          const { events, invalid } = incrementalParser.feed(chunkText);
          if (invalid) {
            applyError('응답을 해석하는 중 문제가 생겼어요. 다시 시도해 주세요.');
            break;
          }
          for (const evt of events) handleEvent(evt);
        } else {
          legacyBuffer += chunkText;
          const { events, invalid } = parseLegacySSE(legacyBuffer);
          const lastNewline = legacyBuffer.lastIndexOf('\n\n');
          if (lastNewline !== -1) legacyBuffer = legacyBuffer.slice(lastNewline + 2);
          if (invalid) {
            applyError('응답을 해석하는 중 문제가 생겼어요. 다시 시도해 주세요.');
            break;
          }
          for (const evt of events) handleEvent(evt);
        }
      }

      // 스트리밍 완료
      if (useV2Parser && incrementalParser.flush()) {
        applyError('응답이 중간에 끊겼어요. 다시 시도해 주세요.');
      } else if (streamState.phase === 'streaming') {
        markTerminal('completed');
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        if (streamPerfRef.current) {
          streamPerfRef.current.result = 'aborted';
        }
        if (draftFlushFrameRef.current !== null) {
          cancelAnimationFrame(draftFlushFrameRef.current);
          draftFlushFrameRef.current = null;
        }
        flushPendingDraftContent();
        if (draftMessageRef.current?.content) {
          finalizeAssistantDraft('aborted');
        } else {
          draftMessageRef.current = null;
          pendingDraftDeltaRef.current = '';
          setStreamingDraft(null);
          setActiveReplyMessageId(null);
          setIsFollowingActiveReply(false);
        }
        return;
      }
      // 에러 시 AI 메시지를 에러 메시지로 교체
      if (streamPerfRef.current) {
        streamPerfRef.current.result = 'failed';
      }
      finalizeAssistantDraft('failed', {
        content: '현재 AI 서버와 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
        isError: true,
      });
      return;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: '현재 AI 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
            streaming: false,
            isError: true,
            ts: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return updated;
      });
    } finally {
      const perf = streamPerfRef.current;
      if (perf?.requestStartedAt != null) {
        pushClientPerf({
          receiver_version: perf.receiverVersion,
          result: perf.result,
          wire_ttft_ms: perf.wireTtftMs != null ? Number(perf.wireTtftMs.toFixed(2)) : null,
          paint_ttft_ms: perf.paintTtftMs != null ? Number(perf.paintTtftMs.toFixed(2)) : null,
          paint_minus_wire_ms:
            perf.paintTtftMs != null && perf.wireTtftMs != null
              ? Number((perf.paintTtftMs - perf.wireTtftMs).toFixed(2))
              : null,
          scroll_into_view_count: scrollCountRef.current,
        });
      }
      scrollCountRef.current = 0;
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [createLocalMessageId, inputText, isHistoryLoading, isStreaming, sessionId]);

  // 오른쪽 패널 기록은 먼저 화면에 반영하고, 잠시 뒤 기존 daily API로 저장합니다.
  const save = useCallback((next) => {
    const migratedNext = migrateStoredLog(next);
    setLog(migratedNext);
    cacheDailyLog(migratedNext);
    setTodaySaveState('saving');

    saveVersionRef.current += 1;
    const currentVersion = saveVersionRef.current;

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      persistTodayLog(migratedNext, currentVersion);
    }, PANEL_SAVE_DEBOUNCE_MS);
  }, [cacheDailyLog, persistTodayLog]);

  const update = useCallback((field, value) => {
    save({ ...log, [field]: value });
  }, [log, save]);

  const selectedPendingBundle = useMemo(() => {
    if (!manualCardBundleKey) return null;
    return pendingQuestions?.bundles?.find((bundle) => bundle.bundleKey === manualCardBundleKey) || null;
  }, [manualCardBundleKey, pendingQuestions]);

  const pendingHealthSummary = useMemo(() => ({
    count: pendingQuestions?.count ?? missingSummary?.count ?? 0,
    bundles: pendingQuestions?.bundles || [],
    labels: missingSummary?.labels || [],
    truncatedCount: missingSummary?.truncatedCount || 0,
  }), [missingSummary, pendingQuestions]);

  const hasLiveHealthCard = useMemo(
    () => messages.some((message) => Array.isArray(message?.healthQuestions) && message.healthQuestions.length > 0),
    [messages],
  );

  const scrollToLatestHealthCard = useCallback(() => {
    if (typeof document === 'undefined') return;
    const cards = document.querySelectorAll('[data-inline-health-card="true"]');
    const target = cards[cards.length - 1];
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const openPendingBundleCard = useCallback((bundleKey) => {
    if (!bundleKey) return;
    setManualCardBundleKey(bundleKey);
  }, []);

  useEffect(() => {
    if (!manualCardBundleKey) return;
    const stillExists = pendingQuestions?.bundles?.some((bundle) => bundle.bundleKey === manualCardBundleKey);
    if (!stillExists) {
      setManualCardBundleKey(null);
    }
  }, [manualCardBundleKey, pendingQuestions]);

  useEffect(() => {
    if (!selectedPendingBundle || !manualHealthCardRef.current) return;
    manualHealthCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedPendingBundle]);

  const hasAnyData =
    loaded &&
    (
      isLogFieldAnswered('sleep_duration_bucket', log.sleep_duration_bucket) ||
      isLogFieldAnswered('breakfast_status', log.breakfast_status) ||
      log.exercise_done !== null ||
      isLogFieldAnswered('water_cups', log.water_cups)
    );

  /* ── 카드 값 계산 ── */
  const sleepVal = getSleepDisplay(log);
  const mealCount = getMealCount(log);
  const mealVal = mealCount > 0 ? `${mealCount}/3` : null;
  const exerciseVal = log.exercise_done === true ? '✓' : log.exercise_done === false ? '✗' : null;
  const waterVal = log.water_cups > 0 ? `${log.water_cups}잔` : null;

  const cards = [
    { key: 'sleep', label: '수면', val: sleepVal, color: activeCard === 'sleep' ? 'bg-cream-400' : '' },
    { key: 'meal', label: '식사', val: mealVal, color: activeCard === 'meal' ? 'bg-cream-400' : '' },
    { key: 'exercise', label: '운동', val: exerciseVal, color: activeCard === 'exercise' ? 'bg-[#e3f2fd]' : '' },
    { key: 'water', label: '수분', val: waterVal, color: activeCard === 'water' ? 'bg-cream-400' : '' },
  ];

  /* ── 브리핑 자동 생성 ── */
  const briefings = [];
  if (log.sleep_duration_bucket) {
    const q = log.sleep_quality;
    const sub = q ? SLEEP_QUALITY_LABELS[q] : '';
    briefings.push({ icon: '💤', text: `수면 ${SLEEP_LABELS[log.sleep_duration_bucket]}`, sub: sub || '기록됨' });
  }
  if (log.breakfast_status !== null) {
    briefings.push({ icon: '🍽️', text: `아침 — ${MEAL_LABELS[log.breakfast_status]}`, sub: log.breakfast_status === 'hearty' ? '좋아요! 👏' : log.breakfast_status === 'skipped' ? '내일은 꼭!' : '기록됨' });
  }
  if (log.exercise_done !== null) {
    briefings.push({ icon: '🏃', text: log.exercise_done ? `운동 ${log.exercise_type ? EXERCISE_TYPES[log.exercise_type] : ''} ${log.exercise_minutes ? log.exercise_minutes + '분' : ''}`.trim() : '운동 — 안 했어요', sub: log.exercise_done ? '잘했어요! 💪' : '내일은 해봐요' });
  }
  if (log.water_cups > 0) {
    briefings.push({ icon: '💧', text: `수분 ${log.water_cups}잔`, sub: log.water_cups >= 8 ? '목표 달성! 🎉' : log.water_cups >= 5 ? '좀 더 마셔요' : '좀 부족해요' });
  }

  if (!loaded) return null;

  return (
    <>
      {/* 튜토리얼 */}
      {showTutorial && (
        <Tutorial
          key={tutorialKey}
          onComplete={() => {
            try {
              localStorage.removeItem('danaa_tutorial_pending');
            } catch {}
            setShowTutorial(false);
          }}
        />
      )}

      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[13px] font-medium text-nature-900">AI 채팅</span>
        <div className="flex-1"></div>
        <button onClick={() => setPanelOpen(!panelOpen)} className="w-8 h-8 rounded-lg hover:bg-black/[.03] flex items-center justify-center text-sm text-neutral-400 relative">
          📋
          <span className="absolute top-[5px] right-[5px] w-[7px] h-[7px] bg-[#E07800] rounded-full border-[1.5px] border-white"></span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 채팅 영역 ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto px-6 py-6"
            style={{ scrollbarGutter: 'stable' }}
          >

            {/* ── 온보딩 완료 시: 맞춤 인사 ── */}
            {onboarding && (
              <>
                <div className="max-w-[840px] mx-auto mb-3.5">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">다</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-[1.7] text-nature-900">
                        안녕하세요! 다나아 AI입니다 😊<br />
                        {risk?.group && <>
                          <strong>{risk.group}그룹</strong>({risk.groupLabel})이시네요.
                          {risk.levelLabel && <> 현재 위험도는 <strong>{risk.levelLabel}</strong> 단계예요.</>}
                          <br />
                        </>}
                        오늘 기록을 차근차근 쌓아볼까요?<br />
                        <span className="text-neutral-400">질문에 답하면 본문 아래 카드로 기록할 수 있고, 오른쪽 패널에서는 오늘 기록을 직접 입력하거나 저장된 상태와 남은 질문을 함께 확인할 수 있어요.</span>
                      </div>
                      <div className="text-[11px] text-neutral-300 mt-0.5">지금</div>
                    </div>
                  </div>
                </div>

                {/* 빠른 기록 유도 카드 */}
                {!hasAnyData && messages.length === 0 && (
                  <div className="max-w-[840px] mx-auto mb-3.5">
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 shrink-0"></div>
                      <div className="flex-1 border border-cream-500 rounded-xl p-4 bg-cream-300 shadow-soft">
                        <div className="text-[12px] font-medium text-nature-900 mb-2.5">오늘 기록을 어디서든 시작해보세요</div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '💤 수면 기록', card: 'sleep' },
                            { label: '🍽️ 식사 기록', card: 'meal' },
                            { label: '🏃 운동 기록', card: 'exercise' },
                            { label: '💧 수분 기록', card: 'water' },
                          ].map(item => (
                            <button key={item.card} onClick={() => { setPanelOpen(true); setActiveCard(item.card); }}
                              className="px-3 py-1.5 rounded-full text-[11px] bg-white border border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500 transition-all">
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
                  <div className="w-7 h-7 rounded-full bg-nature-900 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">다</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-[1.7] text-nature-900">
                      안녕하세요! 다나아 AI입니다 😊<br />
                      맞춤 건강관리를 시작하려면 먼저 온보딩 설문을 완료해주세요.
                    </div>
                    <a href="/onboarding/diabetes" className="inline-block mt-2 px-4 py-2 bg-nature-900 text-white text-[12px] font-medium rounded-lg hover:bg-nature-800 transition-colors">
                      온보딩 시작하기 →
                    </a>
                    <div className="text-[11px] text-neutral-300 mt-1.5">지금</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 채팅 메시지 ── */}
            {historyPolicyNotice && (
              <div className="max-w-[840px] mx-auto mb-3.5">
                <div className="ml-[38px] rounded-xl border border-cream-500 bg-cream-300 px-4 py-3 text-[12px] leading-[1.6] text-neutral-500">
                  이전 대화는 텍스트만 복원돼요. 건강 질문 카드는 새 답변에서만 표시됩니다.
                </div>
              </div>
            )}

            <ChatTranscript
              messages={messages}
              streamingDraft={streamingDraft}
              chatEndRef={chatEndRef}
              onSubmitHealthAnswer={submitHealthAnswer}
            />

            {selectedPendingBundle && (
              <div ref={manualHealthCardRef} className="max-w-[840px] mx-auto mb-3.5">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 shrink-0"></div>
                  <div className="flex-1 max-w-[560px]">
                    <InlineHealthQuestionCard
                      bundleKey={selectedPendingBundle.bundleKey}
                      bundleName={selectedPendingBundle.name}
                      questions={selectedPendingBundle.questions}
                      onSubmit={submitPendingQuestionAnswer}
                      formatOptionLabel={getHealthOptionLabel}
                      initialAnswers={log}
                      initialSavedFields={getAnsweredFieldsForBundle(selectedPendingBundle, log)}
                      helperText="놓친 질문을 지금 카드로 이어서 기록할 수 있어요."
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* 입력창 */}
          <div className="py-3 px-6 bg-white border-t border-cream-500" data-tutorial="chat-input">
            <div className="max-w-[840px] mx-auto flex gap-2 items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMessage(); } }}
                placeholder={isHistoryLoading ? '이전 대화를 불러오는 중...' : isStreaming ? '답변을 기다리는 중...' : '다나아에게 무엇이든 물어보세요...'}
                disabled={isStreaming || isHistoryLoading}
                className="flex-1 py-2.5 px-4 rounded-[20px] border border-cream-400 text-[13px] outline-none bg-cream-300 focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || isHistoryLoading || !inputText.trim()}
                className="w-9 h-9 rounded-full bg-nature-900 text-white flex items-center justify-center text-lg cursor-pointer shrink-0 hover:bg-nature-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* ══ 오른쪽 패널 ══ */}
        {panelOpen && (
          <aside className="w-[280px] border-l border-cream-500 bg-white flex flex-col shrink-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>

            <div className="p-4 space-y-5">
              {/* ═══ 1. 오늘 한눈에 ═══ */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-[12px] font-semibold text-nature-900">오늘 한눈에</h4>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                      todaySaveState === 'error'
                        ? 'bg-red-50 text-red-500'
                        : todaySaveState === 'saving'
                          ? 'bg-cream-300 text-neutral-500'
                          : todaySaveState === 'saved'
                            ? 'bg-nature-100 text-nature-700'
                            : 'bg-white text-neutral-300'
                    }`}
                  >
                    {todaySaveState === 'error'
                      ? '저장 실패'
                      : todaySaveState === 'saving'
                        ? '저장 중'
                        : todaySaveState === 'saved'
                          ? '오늘 기록에 저장됨'
                          : '직접 입력 가능'}
                  </span>
                </div>
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
                      <div className={`text-[15px] font-semibold ${c.val ? 'text-nature-900' : 'text-neutral-300'}`}>
                        {c.val || '—'}
                      </div>
                      <div className="text-[10px] text-neutral-400">{c.label}</div>
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
                  <ExercisePanelV2 log={log} update={update} save={save} />
                )}
                {activeCard === 'water' && (
                  <WaterPanelV2 log={log} update={update} />
                )}

                {/* 아무 카드도 선택 안 했을 때: 비워두기 */}
              </div>

              {/* ═══ 2. 오늘의 브리핑 ═══ */}
              <div>
                <h4 className="text-[12px] font-semibold text-nature-900 mb-2">오늘의 브리핑</h4>
                <div className="border-b border-cream-500 mb-3"></div>
                {briefings.length > 0 ? (
                  <div className="bg-cream-300 rounded-xl p-4 space-y-3">
                    {briefings.map((item) => (
                      <div key={item.text} className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[14px] shrink-0">{item.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-nature-900">{item.text}</div>
                          <div className="text-[10px] text-neutral-400">{item.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cream-300 rounded-xl p-4 text-center">
                    <div className="text-[20px] mb-2">📋</div>
                    <div className="text-[12px] font-medium text-nature-900 mb-1">아직 기록이 없어요</div>
                    <div className="text-[10px] text-neutral-400">건강 기록을 시작하면 브리핑이 표시돼요</div>
                  </div>
                )}
              </div>

              {/* ═══ 3. 나의 습관 ═══ */}
              <HabitsSection />

              {/* ═══ 4. 미답변 질문 ═══ */}
              <div data-tutorial="unanswered">
              <UnansweredQuestionsSectionV2
                pendingSummary={pendingHealthSummary}
                hasLiveHealthCard={hasLiveHealthCard}
                onJumpToHealthCard={scrollToLatestHealthCard}
                activeBundleKey={manualCardBundleKey}
                onSelectBundle={openPendingBundleCard}
              />
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
    { key: 'very_good', label: '😊 아주 좋음' },
    { key: 'good', label: '🙂 좋음' },
    { key: 'normal', label: '😐 보통' },
    { key: 'bad', label: '😴 나쁨' },
    { key: 'very_bad', label: '😩 아주 나쁨' },
  ];
  const durationLocked = false;
  const qualityLocked = false;
  const panelLocked = false;

  if (!log.sleep_duration_bucket && !log.sleep_quality) {
    return (
      <div className="bg-cream-300 rounded-lg p-4 mb-3 text-center">
        {panelLocked && (
          <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
            이미 저장된 운동 기록은 오늘 화면에서 다시 바꾸지 않아요.
          </div>
        )}
        {panelLocked && (
          <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
            이미 저장된 수면 기록은 오늘 화면에서 다시 바꾸지 않아요.
          </div>
        )}
        <div className="text-[13px] mb-2">😴</div>
        <div className="text-[12px] text-nature-900 mb-3">수면을 기록해주세요</div>
        <div className="text-[10px] text-neutral-400 mb-3">몇 시간 주무셨나요?</div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {durations.map(d => (
            <button key={d.key} onClick={() => update('sleep_duration_bucket', d.key)} disabled={durationLocked}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                durationLocked
                  ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                  : 'bg-white border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
      {panelLocked && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 수면 기록은 오늘 화면에서 다시 바꾸지 않아요.
        </div>
      )}
      {/* 수면 시간 */}
      <div className="text-[10px] text-neutral-400 mb-2">수면 시간</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {durations.map(d => (
          <button key={d.key} onClick={() => update('sleep_duration_bucket', d.key)} disabled={durationLocked}
            className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
              log.sleep_duration_bucket === d.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : durationLocked
                  ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
                  : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            {d.label}
          </button>
        ))}
      </div>
      {/* 수면 질 */}
      <div className="text-[10px] text-neutral-400 mb-2">수면 질</div>
      <div className="flex flex-wrap gap-1.5">
        {qualities.map(q => (
          <button key={q.key} onClick={() => update('sleep_quality', q.key)} disabled={qualityLocked}
            className={`px-2 py-1 rounded-full text-[11px] transition-all ${
              log.sleep_quality === q.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : qualityLocked
                  ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
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
    { key: 'breakfast_status', label: '아침', icon: '🌅' },
    { key: 'lunch_status', label: '점심', icon: '☀️' },
    { key: 'dinner_status', label: '저녁', icon: '🌙' },
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
  const breakfastLocked = false;
  const lunchLocked = false;
  const dinnerLocked = false;
  const vegetableLocked = false;
  const balanceLocked = false;
  const panelLocked = false;

  return (
    <div className="bg-cream-300 rounded-lg p-3.5 mb-3">
      {panelLocked && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 식사 기록은 오늘 화면에서 다시 바꾸지 않아요.
        </div>
      )}
      {meals.map(meal => (
        <div key={meal.key} className="mb-3 last:mb-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[12px]">{meal.icon}</span>
            <span className="text-[11px] font-medium text-nature-900">
              {meal.label}
              {log[meal.key] && <span className="text-neutral-400 font-normal"> — {MEAL_LABELS[log[meal.key]]}</span>}
            </span>
          </div>
          <div className="flex gap-1.5">
            {options.map(opt => (
              <button
                key={opt.key}
                onClick={() => update(meal.key, opt.key)}
                disabled={
                  meal.key === 'breakfast_status'
                    ? breakfastLocked
                    : meal.key === 'lunch_status'
                      ? lunchLocked
                      : dinnerLocked
                }
                className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                  log[meal.key] === opt.key
                    ? 'bg-nature-500 text-white border border-nature-500'
                    : (
                        meal.key === 'breakfast_status'
                          ? breakfastLocked
                          : meal.key === 'lunch_status'
                            ? lunchLocked
                            : dinnerLocked
                      )
                      ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
                      : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {meal.key !== 'dinner_status' && <div className="border-b border-black/[.04] mt-3"></div>}
        </div>
      ))}

      {/* 채소 */}
      <div className="border-t border-black/[.06] mt-3 pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[12px]">🥬</span>
          <span className="text-[11px] font-medium text-nature-900">채소</span>
          {log.vegetable_intake_level && <span className="text-[10px] text-neutral-400">— {vegOptions.find(v => v.key === log.vegetable_intake_level)?.label}</span>}
        </div>
        <div className="flex gap-1.5">
          {vegOptions.map(opt => (
            <button key={opt.key} onClick={() => update('vegetable_intake_level', opt.key)} disabled={vegetableLocked}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                log.vegetable_intake_level === opt.key
                  ? 'bg-nature-500 text-white border border-nature-500'
                  : vegetableLocked
                    ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
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
          <span className="text-[12px]">🍱</span>
          <span className="text-[11px] font-medium text-nature-900">식사구성</span>
          {log.meal_balance_level && <span className="text-[10px] text-neutral-400">— {balanceOptions.find(v => v.key === log.meal_balance_level)?.label}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {balanceOptions.map(opt => (
            <button key={opt.key} onClick={() => update('meal_balance_level', opt.key)} disabled={balanceLocked}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                log.meal_balance_level === opt.key
                  ? 'bg-nature-500 text-white border border-nature-500'
                  : balanceLocked
                    ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
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
function ExercisePanel({ log, update, save, confirmedLog }) {
  const types = [
    { key: 'walking', label: '🚶 산책' },
    { key: 'running', label: '🏃 달리기' },
    { key: 'cycling', label: '🚴 자전거' },
    { key: 'swimming', label: '🏊 수영' },
    { key: 'gym', label: '🏋️ 헬스' },
    { key: 'home_workout', label: '🏠 홈트' },
    { key: 'other', label: '기타' },
  ];

  const exerciseDoneLocked = isServerConfirmedField(confirmedLog, 'exercise_done');
  const exerciseTypeLocked = isServerConfirmedField(confirmedLog, 'exercise_type');
  const exerciseMinutesLocked = isServerConfirmedField(confirmedLog, 'exercise_minutes');
  const walkLocked = isServerConfirmedField(confirmedLog, 'walk_done');
  const panelLocked = exerciseDoneLocked || exerciseTypeLocked || exerciseMinutesLocked || walkLocked;

  if (log.exercise_done === null) {
    return (
      <div className="bg-cream-300 rounded-lg p-4 mb-3 text-center">
        <div className="text-[13px] mb-2">🏃</div>
        <div className="text-[12px] text-nature-900 mb-3">운동 — 안 했어요</div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => update('exercise_done', true)} disabled={exerciseDoneLocked}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                : 'bg-nature-500 text-white border-nature-500'
            }`}>
            했어요
          </button>
          <button onClick={() => update('exercise_done', false)} disabled={exerciseDoneLocked}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            못했어요
          </button>
        </div>
      </div>
    );
  }

  if (log.exercise_done === false) {
    return (
      <div className={`bg-cream-300 rounded-lg p-3.5 mb-3 ${panelLocked ? 'pointer-events-none opacity-70' : ''}`}>
        {panelLocked && (
          <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
            이미 저장된 운동 기록은 오늘 화면에서 다시 바꾸지 않아요.
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12px]">🏃</span>
          <span className="text-[11px] font-medium text-nature-900">운동 — 안 했어요</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save({ ...log, exercise_done: true, exercise_type: null, exercise_minutes: null })} disabled={exerciseDoneLocked}
            className={`px-3 py-1 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            했어요로 변경
          </button>
        </div>
        {/* 산책 */}
        <div className="border-t border-black/[.06] mt-3 pt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[12px]">🚶</span>
            <span className="text-[11px] font-medium text-nature-900">산책</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => update('walk_done', log.walk_done === true ? null : true)} disabled={walkLocked}
              className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === true ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
              했어요
            </button>
            <button onClick={() => update('walk_done', log.walk_done === false ? null : false)} disabled={walkLocked}
              className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === false ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
              못했어요
            </button>
          </div>
        </div>
      </div>
    );
  }

  // exercise_done === true
  return (
    <div className={`bg-cream-300 rounded-lg p-3.5 mb-3 ${panelLocked ? 'opacity-70' : ''}`}>
      {panelLocked && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 운동 기록은 오늘 패널에서 다시 바꾸지 않아요.
        </div>
      )}
      <div className="text-[10px] text-neutral-400 mb-2">운동 종류</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {types.map(t => (
          <button key={t.key} onClick={() => update('exercise_type', log.exercise_type === t.key ? null : t.key)} disabled={exerciseTypeLocked}
            className={`px-2 py-1 rounded-full text-[11px] transition-all ${
              log.exercise_type === t.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : exerciseTypeLocked
                  ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
                  : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-neutral-400 mb-2">운동 시간 (분)</div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => update('exercise_minutes', Math.max(0, (log.exercise_minutes || 0) - 10))} disabled={exerciseMinutesLocked}
          className="w-7 h-7 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[12px] hover:bg-black/[.03]">−</button>
        <span className="text-[16px] font-semibold text-nature-900 min-w-[40px] text-center">{log.exercise_minutes || 0}</span>
        <span className="text-[10px] text-neutral-300">분</span>
        <button onClick={() => update('exercise_minutes', Math.min(300, (log.exercise_minutes || 0) + 10))} disabled={exerciseMinutesLocked}
          className="w-7 h-7 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[12px] hover:bg-black/[.03]">+</button>
      </div>

      {/* 산책 */}
      <div className="border-t border-black/[.06] pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[12px]">🚶</span>
          <span className="text-[11px] font-medium text-nature-900">산책</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => update('walk_done', log.walk_done === true ? null : true)} disabled={walkLocked}
            className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === true ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
            했어요
          </button>
          <button onClick={() => update('walk_done', log.walk_done === false ? null : false)} disabled={walkLocked}
            className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === false ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed' : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'}`}>
            못했어요
          </button>
        </div>
      </div>

      <div className="border-t border-black/[.06] mt-3 pt-2">
        <button onClick={() => save({ ...log, exercise_done: false, exercise_type: null, exercise_minutes: null })} disabled={exerciseDoneLocked}
          className={`text-[10px] transition-colors ${exerciseDoneLocked ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-400 hover:text-nature-900'}`}>
          안 했어요로 변경
        </button>
      </div>
    </div>
  );
}

/* ═══════════ 수분 패널 ═══════════ */
function WaterPanel({ log, update, confirmedLog }) {
  const waterLocked = isServerConfirmedField(confirmedLog, 'water_cups');
  return (
    <div className={`bg-cream-300 rounded-lg p-3.5 mb-3 ${waterLocked ? 'pointer-events-none opacity-70' : ''}`}>
      {waterLocked && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 수분 기록은 오늘 화면에서 다시 바꾸지 않아요.
        </div>
      )}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => update('water_cups', Math.max(0, log.water_cups - 1))} disabled={waterLocked}
          className="w-8 h-8 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[14px] hover:bg-black/[.03] transition-colors">−</button>
        <div className="text-center">
          <span className="text-[28px] font-semibold text-nature-900">{log.water_cups}</span>
          <span className="text-[12px] text-neutral-400 ml-1">/ 8잔</span>
        </div>
        <button onClick={() => update('water_cups', Math.min(12, log.water_cups + 1))} disabled={waterLocked}
          className="w-8 h-8 rounded-full border border-cream-500 bg-white text-neutral-400 flex items-center justify-center text-[14px] hover:bg-black/[.03] transition-colors">+</button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[16px]">💧</span>
        <div className="flex-1 h-2 bg-cream-500 rounded-full overflow-hidden">
          <div className="h-full bg-[#64b5f6] rounded-full transition-all" style={{ width: `${Math.min(100, log.water_cups / 8 * 100)}%` }}></div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-400 text-center">하루 권장 8잔 (240ml 기준)</div>
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
    let cancelled = false;

    async function loadChallengeOverview() {
      try {
        const response = await api('/api/v1/challenges/overview');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setChallenges(Array.isArray(payload?.active) ? payload.active : []);
        }
      } catch (error) {
        console.error('challenge_overview_load_failed', error);
        if (!cancelled) {
          setChallenges([]);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    loadChallengeOverview();

    const refreshHandler = () => {
      loadChallengeOverview();
    };

    window.addEventListener('danaa:challenge-overview-refresh', refreshHandler);

    return () => {
      cancelled = true;
      window.removeEventListener('danaa:challenge-overview-refresh', refreshHandler);
    };
  }, []);

  if (!loaded) return null;

  return (
    <div>
      <h4 className="text-[12px] font-semibold text-nature-900 mb-2">나의 습관</h4>
      <div className="border-b border-cream-500 mb-3"></div>
      {challenges.length === 0 ? (
        <div className="bg-cream-300 rounded-xl p-4 text-center">
          <div className="text-[20px] mb-2">🎯</div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">아직 참여 중인 챌린지가 없어요</div>
          <div className="text-[10px] text-neutral-400 mb-3">챌린지에 참여하면 여기에 진행 상황이 표시돼요</div>
          <a href="/app/challenge" className="inline-block px-3.5 py-1.5 rounded-full text-[11px] bg-nature-900 text-white hover:bg-nature-800 transition-colors">
            챌린지 둘러보기
          </a>
        </div>
      ) : (
        <div className="bg-cream-300 rounded-xl p-4 space-y-3">
          {challenges.map((item) => (
            <div key={item.user_challenge_id ?? item.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-nature-900">{item.emoji} {item.name}</span>
                <span className="text-[10px] text-neutral-400">
                  {item.today_checked ? '오늘 체크 완료' : '오늘 체크 필요'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-cream-500 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-400 rounded-full"
                  style={{ width: `${Math.min(100, Number(item.progress_pct || 0) * 100)}%` }}
                ></div>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
                <span>진행률 {Math.round(Number(item.progress_pct || 0) * 100)}%</span>
                <span>연속 {item.current_streak || 0}일</span>
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
function UnansweredQuestionsSection({ pendingSummary, hasLiveHealthCard, onJumpToHealthCard }) {
  const count = Number(pendingSummary?.count || 0);
  const labels = Array.isArray(pendingSummary?.labels) ? pendingSummary.labels : [];
  const truncatedCount = Number(pendingSummary?.truncatedCount || 0);
  const questions = labels.map((label, index) => ({
    field: `missing-${index}`,
    text: label,
  }));

  return (
    <div>
      <h4 className="text-[12px] font-semibold text-nature-900 mb-2">미답변 질문</h4>
      <div className="border-b border-cream-500 mb-3"></div>

      {count === 0 ? (
        <div className="bg-cream-300 rounded-xl p-4 text-center">
          <div className="text-[20px] mb-2">✅</div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">지금 이어서 답할 질문은 없어요</div>
          <div className="text-[10px] text-neutral-400">새 질문이 생기면 답변 아래 카드에서 바로 기록할 수 있어요.</div>
        </div>
      ) : (
        <div className="bg-cream-300 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-nature-900">
                {pendingSummary?.bundleName || '오늘 기록 보완'}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                질문형 기록은 채팅 본문 아래 카드에서 이어지고, 오른쪽 패널에서는 오늘 기록 상태를 바로 확인할 수 있어요.
              </div>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] text-neutral-400">
              {questions.length}개 남음
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {questions.map((question, index) => (
              <div key={question.field} className="rounded-lg bg-white px-3 py-2">
                <div className="text-[10px] text-neutral-400">질문 {index + 1}</div>
                <div className="text-[11px] font-medium text-nature-900 mt-0.5">{question.text}</div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onJumpToHealthCard}
            className="mt-3 w-full rounded-lg bg-nature-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-nature-800 transition-colors"
          >
            채팅 카드로 이동
          </button>
        </div>
      )}
    </div>
  );
}

function ExercisePanelV2({ log, update, save }) {
  const types = [
    { key: 'walking', label: '걷기 산책' },
    { key: 'running', label: '달리기' },
    { key: 'cycling', label: '자전거' },
    { key: 'swimming', label: '수영' },
    { key: 'gym', label: '헬스' },
    { key: 'home_workout', label: '홈트' },
    { key: 'other', label: '기타' },
  ];

  const exerciseDoneLocked = false;
  const exerciseTypeLocked = false;
  const exerciseMinutesLocked = false;
  const walkLocked = false;
  const panelLocked = false;

  const circleButtonClass = (locked) => `w-7 h-7 rounded-full border flex items-center justify-center text-[12px] transition-colors ${
    locked
      ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
      : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
  }`;

  const pillClass = (active, locked) => `px-3 py-1 rounded-full text-[11px] transition-all ${
    active
      ? 'bg-nature-500 text-white border border-nature-500'
      : locked
        ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
        : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
  }`;

  if (log.exercise_done === null) {
    return (
      <div className="bg-cream-300 rounded-lg p-4 mb-3 text-center">
        <div className="text-[13px] mb-2">운동</div>
        <div className="text-[12px] text-nature-900 mb-3">오늘 운동을 했나요?</div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => update('exercise_done', true)}
            disabled={exerciseDoneLocked}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                : 'bg-nature-500 text-white border-nature-500'
            }`}
          >
            했어요
          </button>
          <button
            onClick={() => update('exercise_done', false)}
            disabled={exerciseDoneLocked}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}
          >
            못 했어요
          </button>
        </div>
      </div>
    );
  }

  if (log.exercise_done === false) {
    return (
      <div className={`bg-cream-300 rounded-lg p-3.5 mb-3 ${panelLocked ? 'opacity-70' : ''}`}>
        {panelLocked && (
          <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
            이미 저장된 운동 기록은 오늘 화면에서 다시 바뀌지 않아요.
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12px]">운동</span>
          <span className="text-[11px] font-medium text-nature-900">오늘 운동은 하지 않았어요</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save({ ...log, exercise_done: true, exercise_type: null, exercise_minutes: null })}
            disabled={exerciseDoneLocked}
            className={`px-3 py-1 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
                : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}
          >
            운동함으로 바꾸기
          </button>
        </div>
        <div className="border-t border-black/[.06] mt-3 pt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[12px]">걷기</span>
            <span className="text-[11px] font-medium text-nature-900">오늘 산책은 했나요?</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => update('walk_done', true)}
              disabled={walkLocked}
              className={pillClass(log.walk_done === true, walkLocked)}
            >
              했어요
            </button>
            <button
              onClick={() => update('walk_done', false)}
              disabled={walkLocked}
              className={pillClass(log.walk_done === false, walkLocked)}
            >
              못 했어요
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-cream-300 rounded-lg p-3.5 mb-3 ${panelLocked ? 'opacity-70' : ''}`}>
      {panelLocked && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 운동 기록은 오늘 화면에서 다시 바뀌지 않아요.
        </div>
      )}
      <div className="text-[10px] text-neutral-400 mb-2">운동 종류</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {types.map((type) => (
          <button
            key={type.key}
            onClick={() => update('exercise_type', type.key)}
            disabled={exerciseTypeLocked}
            className={`px-2 py-1 rounded-full text-[11px] transition-all ${
              log.exercise_type === type.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : exerciseTypeLocked
                  ? 'bg-white/70 border border-cream-500 text-neutral-300 cursor-not-allowed'
                  : 'bg-white border border-cream-500 text-neutral-400 hover:bg-black/[.03]'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-neutral-400 mb-2">운동 시간 (분)</div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => update('exercise_minutes', Math.max(0, (log.exercise_minutes || 0) - 10))}
          disabled={exerciseMinutesLocked}
          className={circleButtonClass(exerciseMinutesLocked)}
        >
          -
        </button>
        <span className="text-[16px] font-semibold text-nature-900 min-w-[40px] text-center">{log.exercise_minutes || 0}</span>
        <span className="text-[10px] text-neutral-300">분</span>
        <button
          onClick={() => update('exercise_minutes', Math.min(300, (log.exercise_minutes || 0) + 10))}
          disabled={exerciseMinutesLocked}
          className={circleButtonClass(exerciseMinutesLocked)}
        >
          +
        </button>
      </div>

      <div className="border-t border-black/[.06] pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[12px]">걷기</span>
          <span className="text-[11px] font-medium text-nature-900">오늘 산책은 했나요?</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => update('walk_done', true)}
            disabled={walkLocked}
            className={pillClass(log.walk_done === true, walkLocked)}
          >
            했어요
          </button>
          <button
            onClick={() => update('walk_done', false)}
            disabled={walkLocked}
            className={pillClass(log.walk_done === false, walkLocked)}
          >
            못 했어요
          </button>
        </div>
      </div>

      <div className="border-t border-black/[.06] mt-3 pt-2">
        <button
          onClick={() => save({ ...log, exercise_done: false, exercise_type: null, exercise_minutes: null })}
          disabled={exerciseDoneLocked}
          className={`text-[10px] transition-colors ${
            exerciseDoneLocked ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-400 hover:text-nature-900'
          }`}
        >
          운동 안 함으로 바꾸기
        </button>
      </div>
    </div>
  );
}

function WaterPanelV2({ log, update }) {
  const waterLocked = false;

  return (
    <div className={`bg-cream-300 rounded-lg p-3.5 mb-3 ${waterLocked ? 'opacity-70' : ''}`}>
      {waterLocked && (
        <div className="mb-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 수분 기록은 오늘 화면에서 다시 바뀌지 않아요.
        </div>
      )}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => update('water_cups', Math.max(0, log.water_cups - 1))}
          disabled={waterLocked}
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-[14px] transition-colors ${
            waterLocked
              ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
              : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
          }`}
        >
          -
        </button>
        <div className="text-center">
          <span className="text-[28px] font-semibold text-nature-900">{log.water_cups}</span>
          <span className="text-[12px] text-neutral-400 ml-1">/ 8잔</span>
        </div>
        <button
          onClick={() => update('water_cups', Math.min(12, log.water_cups + 1))}
          disabled={waterLocked}
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-[14px] transition-colors ${
            waterLocked
              ? 'bg-white/70 border-cream-500 text-neutral-300 cursor-not-allowed'
              : 'bg-white border-cream-500 text-neutral-400 hover:bg-black/[.03]'
          }`}
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[16px]">수분</span>
        <div className="flex-1 h-2 bg-cream-500 rounded-full overflow-hidden">
          <div className="h-full bg-[#64b5f6] rounded-full transition-all" style={{ width: `${Math.min(100, (log.water_cups / 8) * 100)}%` }}></div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-400 text-center">하루 권장 8잔(240ml 기준)</div>
    </div>
  );
}

function UnansweredQuestionsSectionV2({ pendingSummary, hasLiveHealthCard, onJumpToHealthCard, activeBundleKey, onSelectBundle }) {
  const count = Number(pendingSummary?.count || 0);
  const bundles = Array.isArray(pendingSummary?.bundles) ? pendingSummary.bundles : [];
  const labels = Array.isArray(pendingSummary?.labels) ? pendingSummary.labels : [];
  const truncatedCount = Number(pendingSummary?.truncatedCount || 0);

  return (
    <div>
      <h4 className="text-[12px] font-semibold text-nature-900 mb-2">미답변 질문</h4>
      <div className="border-b border-cream-500 mb-3"></div>

      {count === 0 ? (
        <div className="bg-cream-300 rounded-xl p-4 text-center">
          <div className="text-[20px] mb-2">✅</div>
          <div className="text-[12px] font-medium text-nature-900 mb-1">지금 이어서 답할 질문은 없어요</div>
          <div className="text-[10px] text-neutral-400">
            새 질문을 보내면 현재 시간과 기록 상태에 맞는 다음 카드가 새 답변 아래에 붙어요.
          </div>
        </div>
      ) : (
        <div className="bg-cream-300 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-nature-900">오늘 아직 비어 있는 질문</div>
              <div className="text-[10px] text-neutral-400 mt-1">
                오른쪽 패널은 남은 기록 요약이고, 실제 질문 카드는 새 답변 아래에 붙어요.
              </div>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] text-neutral-400">
              {count}개 남음
            </span>
          </div>

          {bundles.length > 0 && (
            <div className="mt-3 space-y-2">
              {bundles.map((bundle) => (
                <button
                  key={bundle.bundleKey}
                  type="button"
                  onClick={() => onSelectBundle?.(bundle.bundleKey)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    activeBundleKey === bundle.bundleKey
                      ? 'bg-nature-900 text-white'
                      : 'bg-white hover:bg-cream-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] opacity-70">
                        {bundle.unansweredCount || bundle.questions?.length || 0}개 질문
                      </div>
                      <div className="text-[11px] font-medium mt-0.5 truncate">{bundle.name}</div>
                    </div>
                    <span className="text-[10px] opacity-70">
                      {activeBundleKey === bundle.bundleKey ? '카드 열림' : '카드 열기'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {bundles.length === 0 && labels.length > 0 && (
            <div className="mt-3 space-y-2">
              {labels.map((label, index) => (
                <div key={`${label}-${index}`} className="rounded-lg bg-white px-3 py-2">
                  <div className="text-[10px] text-neutral-400">질문 {index + 1}</div>
                  <div className="text-[11px] font-medium text-nature-900 mt-0.5">{label}</div>
                </div>
              ))}
              {truncatedCount > 0 && (
                <div className="text-[10px] text-neutral-400 text-right">외 {truncatedCount}개</div>
              )}
            </div>
          )}

          {hasLiveHealthCard ? (
            <div className="mt-3 rounded-lg bg-white px-3 py-2 text-[10px] text-neutral-400">
              지금 화면 아래에 나온 카드에서 바로 이어서 기록할 수 있어요.
            </div>
          ) : (
            <button
              type="button"
              onClick={onJumpToHealthCard}
              className="mt-3 w-full rounded-lg bg-nature-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-nature-800 transition-colors"
            >
              현재 카드 위치로 이동
            </button>
          )}
        </div>
      )}
    </div>
  );
}
