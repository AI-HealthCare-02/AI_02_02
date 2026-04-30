'use client';

import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';
import Tutorial from '../../../components/Tutorial';
import InlineHealthQuestionCard from './components/InlineHealthQuestionCard';
import VideoRecommendations from '../../../components/VideoRecommendations';
import { api, getScopedStorageKey, getToken } from '../../../hooks/useApi';

/* ── Right Panel V2 (리디자인) · 기본 활성화 / env 값 0일 때만 비활성화 ── */
const RIGHT_PANEL_V2_ENABLED = process.env.NEXT_PUBLIC_RIGHT_PANEL_V2 !== '0';
const RightPanelV2 = dynamic(() => import('../../../components/RightPanelV2'), { ssr: false });

/* ── API 설정 ── */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const CHAT_API_PATH = '/api/v1/chat/send';
const CHAT_API_URL = `${API_BASE}${CHAT_API_PATH}`;
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
  'took_medication',
  'mood_level',
  'alcohol_today',
  'alcohol_amount_level',
];

const ONBOARDING_STORAGE_KEY = 'danaa_onboarding';
const RISK_STORAGE_KEY = 'danaa_risk';
const TUTORIAL_PENDING_KEY = 'danaa_tutorial_pending';
const TUTORIAL_DONE_KEY = 'danaa_tutorial_done';

/* ── 유틸 ── */
const todayKey = () => {
  const d = new Date();
  return getScopedStorageKey(
    `danaa_daily_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  );
};

// KST 고정: 백엔드(Asia/Seoul)와 "오늘" 경계 일치 · 시간대 다른 디바이스에서 자정 경계 버그 방지
const todayDateString = () => {
  // sv-SE 로케일은 YYYY-MM-DD 형식 반환
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
};

// N일 전 날짜 (KST 기준) - 미응답 모달 과거 2일용
const daysAgoDateString = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
};

const LEGACY_LOG_FIELD_MAP = new Map([
  [['sleep', '_', 'duration'].join(''), 'sleep_duration_bucket'],
  [['break', 'fast'].join(''), 'breakfast_status'],
  [['lunch'].join(''), 'lunch_status'],
  [['dinner'].join(''), 'dinner_status'],
  [['veget', 'able'].join(''), 'vegetable_intake_level'],
  [['meal', '_', 'balance'].join(''), 'meal_balance_level'],
  [['medication'].join(''), 'took_medication'],
  [['mo', 'od'].join(''), 'mood_level'],
  [['alcohol', '_', 'amount'].join(''), 'alcohol_amount_level'],
]);

const emptyLog = () => ({
  sleep_quality: null, sleep_duration_bucket: null,
  breakfast_status: null, lunch_status: null, dinner_status: null,
  vegetable_intake_level: null, meal_balance_level: null,
  exercise_done: null, exercise_type: null, exercise_minutes: null, walk_done: null,
  water_cups: 0, took_medication: null, mood_level: null, alcohol_today: null, alcohol_amount_level: null,
});

function migrateStoredLog(rawLog) {
  const nextLog = { ...emptyLog(), ...(rawLog || {}) };

  LEGACY_LOG_FIELD_MAP.forEach((canonicalField, legacyField) => {
    // 자기매핑(legacyField === canonicalField)이면 delete로 현재 값까지 날아가므로 skip
    if (legacyField === canonicalField) return;
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
  very_good: '푹 잤어요',
  good: '잘 잤어요',
  normal: '조금 뒤척였어요',
  bad: '자주 깼어요',
  very_bad: '거의 못 잤어요',
};
const MEAL_LABELS = { hearty: '먹었어요', simple: '먹었어요', skipped: '못 먹었어요' };
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
  very_good: '푹 잤어요',
  good: '잘 잤어요',
  normal: '조금 뒤척였어요',
  enough: '충분히 먹었어요',
  little: '조금 먹었어요',
  none: '거의 못 먹었어요',
  balanced: '고르게 먹었어요',
  carb_heavy: '밥·빵·면 위주였어요',
  protein_veg_heavy: '단백질과 채소가 많아요',
  one: '한 번',
  two_plus: '두 번 이상',
  stressed: '스트레스가 있어요',
  very_stressed: '많이 지쳤어요',
  light: '가볍게',
  moderate: '보통',
  heavy: '많이',
};

const CLINICAL_EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/gu;

function stripDisplayEmoji(value) {
  if (value == null) return '';

  return String(value)
    .replace(CLINICAL_EMOJI_REGEX, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function getHealthOptionLabel(option) {
  if (typeof option === 'boolean') return option ? '네' : '아니요';
  if (typeof option === 'number') return `${option}`;
  return stripDisplayEmoji(HEALTH_OPTION_LABELS[option] || String(option).replaceAll('_', ' '));
}

// ClinicalMark · 각 health panel 의 상단 약자 원형 마크 (SL / AM / NO / PM / VG / BL / EX / WK / WA / CH / Q …)
// 2026-04-23: 인라인 아코디언 전환 후 시각적으로 과도하게 노출돼 제거. 프로젝트 전반에 영향 0
// (이 함수는 chat/page.js 내부 전용으로, 모든 사용 지점이 이 파일 안에만 있음).
// 추후 필요 시 label 을 다시 렌더하려면 원래 구현 복원.
function ClinicalMark() {
  return null;
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
            unansweredFields: Array.isArray(bundle.unanswered_fields)
              ? bundle.unanswered_fields.filter((field) => typeof field === 'string')
              : [],
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
  onCompleteHealthAnswer,
}) {
  const streamingAssistantContent = stripDisplayEmoji(streamingDraft?.content);

  return (
    <>
      {messages.map((msg) => {
        const primaryHealthQuestion = Array.isArray(msg.healthQuestions) ? msg.healthQuestions[0] : null;
        const assistantContent = msg.role === 'assistant' ? stripDisplayEmoji(msg.content) : msg.content;

        return (
          <div
            key={msg.id ?? `${msg.role}-${msg.ts ?? 'message'}`}
            data-message-id={msg.id ?? undefined}
            className="max-w-[840px] mx-auto mb-3.5"
          >
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div>
                  <div className="bg-[var(--color-user-bubble)] text-[var(--color-user-bubble-text)] text-[15px] leading-[1.75] rounded-xl rounded-br-sm px-4 py-3 max-w-[520px]">
                    {msg.content}
                  </div>
                  <div className="text-[13px] text-[var(--color-message-meta)] mt-1 text-right">{msg.ts}</div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[var(--color-avatar-bg)] text-[var(--color-avatar-text)] flex items-center justify-center text-[11px] font-semibold shrink-0">다</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[15px] leading-[1.75] ${msg.isError ? 'text-red-500' : 'text-nature-900'}`}>
                    {assistantContent || <span className="text-[var(--color-text-hint)]">생각 중...</span>}
                    {msg.streaming && <span className="inline-block w-[2px] h-[14px] bg-neutral-400 ml-0.5 animate-pulse align-middle"></span>}
                  </div>
                  {msg.ts && <div className="text-[13px] text-[var(--color-message-meta)] mt-1">{msg.ts}</div>}
                  {!msg.isError && !msg.streaming && primaryHealthQuestion && (
                    <div className="mt-3 max-w-[560px]" data-inline-health-card="true">
                      <InlineHealthQuestionCard
                        key={primaryHealthQuestion.bundleKey}
                        bundleKey={primaryHealthQuestion.bundleKey}
                        bundleName={stripDisplayEmoji(primaryHealthQuestion.name)}
                        questions={primaryHealthQuestion.questions}
                        onSubmit={onSubmitHealthAnswer}
                        onComplete={onCompleteHealthAnswer}
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
            <div className="w-7 h-7 rounded-full bg-[var(--color-avatar-bg)] text-[var(--color-avatar-text)] flex items-center justify-center text-[11px] font-semibold shrink-0">다</div>
            <div className="flex-1 min-w-0">
              <div className={`text-[15px] leading-[1.75] ${streamingDraft.isError ? 'text-red-500' : 'text-nature-900'}`}>
                {streamingAssistantContent || <span className="text-[var(--color-text-hint)]">생각 중...</span>}
                {streamingDraft.streaming && <span className="inline-block w-[2px] h-[14px] bg-neutral-400 ml-0.5 animate-pulse align-middle"></span>}
              </div>
              {streamingDraft.ts && <div className="text-[13px] text-[var(--color-message-meta)] mt-1">{streamingDraft.ts}</div>}
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
  // 네트워크 연결 상태 (RightPanelV2 오프라인 뱃지용)
  const [navigatorOnline, setNavigatorOnline] = useState(true);
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
  const fetchRequestIdRef = useRef(0);
  const lastServerLogRef = useRef(migrateStoredLog(emptyLog()));
  const currentLogRef = useRef(migrateStoredLog(emptyLog()));
  const directSaveInflightRef = useRef(0);
  const cardsSectionRef = useRef(null);
  const chatInputRef = useRef(null);

  // 활성 상세 카드 바깥(채팅 영역 등)을 클릭하면 접힘
  useEffect(() => {
    if (!activeCard) return undefined;
    const handlePointer = (event) => {
      const node = cardsSectionRef.current;
      if (node && !node.contains(event.target)) {
        setActiveCard(null);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
    };
  }, [activeCard]);

  const createLocalMessageId = useCallback(() => {
    const nextId = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    return `local-${nextId}`;
  }, []);

  const cacheDailyLog = useCallback((nextLog) => {
    const migratedNext = migrateStoredLog(nextLog);
    try {
      localStorage.setItem(todayKey(), JSON.stringify(migratedNext));
      localStorage.setItem(getScopedStorageKey(DAILY_SCHEMA_VERSION_KEY), DAILY_SCHEMA_VERSION);
    } catch {}
    return migratedNext;
  }, []);

  const applyServerDailyLog = useCallback((nextLog, { fromDirectSave = false } = {}) => {
    const migratedNext = cacheDailyLog(nextLog);
    lastServerLogRef.current = migratedNext;
    if (!fromDirectSave && directSaveInflightRef.current > 0) {
      // 진행 중인 direct save를 외부 스냅샷이 덮어쓰지 않도록 user-facing state 보존
      return migratedNext;
    }
    currentLogRef.current = migratedNext;
    setLog(migratedNext);
    return migratedNext;
  }, [cacheDailyLog]);

  const applyDailyPayload = useCallback((payload, options = {}) => {
    const nextLog = migrateStoredLog(payload?.daily_log || payload || emptyLog());
    const nextMissingSummary = normalizeMissingSummary(
      payload?.daily_log?.missing_summary ?? payload?.missing_summary,
    );
    const nextPendingQuestions = normalizePendingQuestions(
      payload?.daily_log?.pending_questions ?? payload?.pending_questions,
    );
    applyServerDailyLog(nextLog, options);
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
      applyDailyPayload(result, { fromDirectSave: true });

      // 건강 기록 변경 → 리포트 캐시 무효화 이벤트
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('danaa:report-cache-refresh'));
      }

      if (version === saveVersionRef.current) {
        setTodaySaveState('saved');
      }
    } catch (error) {
      // 실패해도 사용자 입력은 유지한다 — 이전 서버 상태로 덮어쓰면 입력한 값이 화면에서 사라져
      // 사용자가 뭘 눌렀는지조차 못 보게 되는 치명적 UX 문제. 저장 상태만 'error'로 표시하고
      // 사용자 입력(currentLogRef/log)은 그대로 두어 재시도 기회를 남긴다.
      console.error('today_log_save_failed', {
        message: error?.message || String(error),
        status: error?.status,
        payload,
        attempted: {
          alcohol_today: nextLog?.alcohol_today,
          alcohol_amount_level: nextLog?.alcohol_amount_level,
          mood_level: nextLog?.mood_level,
          took_medication: nextLog?.took_medication,
        },
      });
      if (version === saveVersionRef.current) {
        setTodaySaveState('error');
      }
    }
  }, [applyDailyPayload, buildTodayLogPatch, cacheDailyLog]);

  const fetchTodayLog = useCallback(async () => {
    fetchRequestIdRef.current += 1;
    const requestId = fetchRequestIdRef.current;
    const requestSaveVersion = saveVersionRef.current;
    try {
      const response = await api(DAILY_HEALTH_API_PATH(todayDateString()));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (
        requestId !== fetchRequestIdRef.current ||
        requestSaveVersion !== saveVersionRef.current
      ) {
        return;
      }
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

  // 네트워크 상태 추적 (RightPanelV2 오프라인 뱃지)
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setNavigatorOnline(navigator.onLine);
    const onOnline = () => setNavigatorOnline(true);
    const onOffline = () => setNavigatorOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
        currentLogRef.current = migratedLog;
        setLog(migratedLog);
        localStorage.setItem(todayKey(), JSON.stringify(migratedLog));
        localStorage.setItem(getScopedStorageKey(DAILY_SCHEMA_VERSION_KEY), DAILY_SCHEMA_VERSION);
      }
      const ob = localStorage.getItem(getScopedStorageKey(ONBOARDING_STORAGE_KEY));
      if (ob) setOnboarding(JSON.parse(ob));
      const rk = localStorage.getItem(getScopedStorageKey(RISK_STORAGE_KEY));
      if (rk) setRisk(JSON.parse(rk));
      // 튜토리얼: 온보딩 완료 + 튜토리얼 미완료 시 표시
      if (ob && !localStorage.getItem(getScopedStorageKey(TUTORIAL_DONE_KEY))) {
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
    const pushBundleKey = searchParams.get('bundle_key');

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

      if (pushBundleKey) {
        setManualCardBundleKey(pushBundleKey);
        if (!sessionId && messages.length === 0) {
          window.dispatchEvent(new CustomEvent('danaa:conversation-active', {
            detail: { id: null, isNew: true },
          }));
        }
        return;
      }

      if (!sessionId && messages.length === 0) {
        resetConversation(true);
      }
    })();

    return undefined;
  }, [isHistoryLoading, isStreaming, loadSessionHistory, messages.length, resetConversation, sessionId]);

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
          const tutorialPending = localStorage.getItem(getScopedStorageKey(TUTORIAL_PENDING_KEY)) === 'true';
          const tutorialDone = localStorage.getItem(getScopedStorageKey(TUTORIAL_DONE_KEY)) === 'true';
          if (tutorialPending || !tutorialDone) {
            setShowTutorial((prev) => {
              if (!prev) {
                setTutorialKey((key) => key + 1);
              }
              return true;
            });
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

    if (payload?.daily_log || payload?.pending_questions || payload?.card_availability) {
      applyDailyPayload(payload);
    } else {
      await fetchTodayLog();
    }

    return payload;
  }, [applyDailyPayload, fetchTodayLog]);

  // 번들 내 모든 질문 완료 시 카드 제거 (메시지의 healthQuestions에서 해당 bundleKey 필터링)
  const completeHealthAnswer = useCallback((bundleKey) => {
    setMessages((prev) =>
      prev.map((m) =>
        Array.isArray(m.healthQuestions) && m.healthQuestions.some((q) => q.bundleKey === bundleKey)
          ? { ...m, healthQuestions: m.healthQuestions.filter((q) => q.bundleKey !== bundleKey) }
          : m,
      ),
    );
  }, []);

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
      requestAnimationFrame(() => {
        chatInputRef.current?.focus();
      });
    }
  }, [createLocalMessageId, inputText, isHistoryLoading, isStreaming, sessionId]);

  // 오른쪽 패널 기록은 먼저 화면에 반영하고, 잠시 뒤 기존 daily API로 저장합니다.
  const save = useCallback((next) => {
    const migratedNext = migrateStoredLog(next);
    currentLogRef.current = migratedNext;
    setLog(migratedNext);
    cacheDailyLog(migratedNext);
    setTodaySaveState('saving');

    saveVersionRef.current += 1;
    const currentVersion = saveVersionRef.current;

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      directSaveInflightRef.current += 1;
      Promise.resolve(persistTodayLog(migratedNext, currentVersion)).finally(() => {
        directSaveInflightRef.current = Math.max(0, directSaveInflightRef.current - 1);
      });
    }, PANEL_SAVE_DEBOUNCE_MS);
  }, [cacheDailyLog, persistTodayLog]);

  const saveImmediate = useCallback((next) => {
    const migratedNext = migrateStoredLog(next);
    currentLogRef.current = migratedNext;
    setLog(migratedNext);
    cacheDailyLog(migratedNext);
    setTodaySaveState('saving');

    saveVersionRef.current += 1;
    const currentVersion = saveVersionRef.current;

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    directSaveInflightRef.current += 1;
    Promise.resolve(persistTodayLog(migratedNext, currentVersion)).finally(() => {
      directSaveInflightRef.current = Math.max(0, directSaveInflightRef.current - 1);
    });
  }, [cacheDailyLog, persistTodayLog]);

  const update = useCallback((field, value) => {
    const baseLog = migrateStoredLog(currentLogRef.current || emptyLog());
    const nextLog = { ...baseLog, [field]: value };

    if (field === 'exercise_done' && value === false) {
      nextLog.exercise_type = null;
      nextLog.exercise_minutes = null;
    }

    if (field === 'alcohol_today' && value === false) {
      nextLog.alcohol_amount_level = null;
    }

    save(nextLog);
  }, [save]);

  const updateAlcoholToday = useCallback((value) => {
    const baseLog = migrateStoredLog(currentLogRef.current || emptyLog());
    const nextLog = {
      ...baseLog,
      alcohol_today: value,
      alcohol_amount_level: value ? (baseLog.alcohol_amount_level ?? null) : null,
    };
    saveImmediate(nextLog);
  }, [saveImmediate]);

  const updateAlcoholAmount = useCallback((value) => {
    const baseLog = migrateStoredLog(currentLogRef.current || emptyLog());
    const nextLog = {
      ...baseLog,
      alcohol_today: true,
      alcohol_amount_level: value,
    };
    saveImmediate(nextLog);
  }, [saveImmediate]);

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
    if (!pendingQuestions) return;
    const stillExists = pendingQuestions?.bundles?.some((bundle) => bundle.bundleKey === manualCardBundleKey);
    if (!stillExists) {
      setManualCardBundleKey(null);
    }
  }, [manualCardBundleKey, pendingQuestions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const pushBundleKey = searchParams.get('bundle_key');
    if (!pushBundleKey) return;
    setManualCardBundleKey(pushBundleKey);
  }, [pendingQuestions]);

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
      isLogFieldAnswered('water_cups', log.water_cups) ||
      isLogFieldAnswered('took_medication', log.took_medication) ||
      isLogFieldAnswered('mood_level', log.mood_level) ||
      isLogFieldAnswered('alcohol_today', log.alcohol_today)
    );

  // 복약 카드 노출은 onboarding.user_group === 'A' 로만 판정.
  // 위험도 risk.group ('A' 위험 단계)은 별도 개념이므로 OR 결합 안 함 (의미 혼선 방지)
  const isGroupA = onboarding?.user_group === 'A';

  const pendingCardCounts = useMemo(() => {
    const counts = {
      sleep: 0,
      meal: 0,
      exercise: 0,
      water: 0,
      mood: 0,
      medication: 0,
      alcohol: 0,
    };

    const fieldToCardKey = {
      sleep_quality: 'sleep',
      sleep_duration_bucket: 'sleep',
      breakfast_status: 'meal',
      lunch_status: 'meal',
      dinner_status: 'meal',
      vegetable_intake_level: 'meal',
      meal_balance_level: 'meal',
      exercise_done: 'exercise',
      exercise_type: 'exercise',
      exercise_minutes: 'exercise',
      walk_done: 'exercise',
      mood_level: 'mood',
      took_medication: 'medication',
      alcohol_today: 'alcohol',
      alcohol_amount_level: 'alcohol',
    };

    (pendingQuestions?.bundles || []).forEach((bundle) => {
      const unansweredFields = Array.isArray(bundle?.unansweredFields) && bundle.unansweredFields.length > 0
        ? bundle.unansweredFields
        : (bundle.questions || [])
            .map((question) => question?.field)
            .filter((field) => typeof field === 'string' && !isLogFieldAnswered(field, log?.[field]));

      unansweredFields.forEach((field) => {
        const cardKey = fieldToCardKey[field];
        if (cardKey) {
          counts[cardKey] += 1;
        }
      });
    });

    return counts;
  }, [log, pendingQuestions]);

  /* ── 카드 값 계산 ── */
  const sleepVal = getSleepDisplay(log);
  const mealCount = getMealCount(log);
  const mealVal = mealCount > 0 ? `${mealCount}/3` : null;
  const exerciseVal = log.exercise_done === true ? '✓' : log.exercise_done === false ? '✗' : null;
  const waterVal = log.water_cups > 0 ? `${log.water_cups}잔` : null;
  const moodVal = log.mood_level ? getHealthOptionLabel(log.mood_level).replace('아주 ', '') : null;
  const medicationVal = log.took_medication === true ? '완료' : log.took_medication === false ? '건너뛰었어요' : null;
  const alcoholVal = log.alcohol_today === false
    ? '안 마셨어요'
    : log.alcohol_today === true
      ? (log.alcohol_amount_level ? getHealthOptionLabel(log.alcohol_amount_level) : '마셨어요')
      : null;

  const alcoholCardVal = log.alcohol_today === false
    ? '미음주'
    : log.alcohol_today === true
      ? (log.alcohol_amount_level ? getHealthOptionLabel(log.alcohol_amount_level) : '음주량 입력 필요')
      : null;

  const cards = [
    { key: 'sleep', label: '수면', marker: 'SL', val: sleepVal, pendingCount: pendingCardCounts.sleep, color: activeCard === 'sleep' ? 'bg-cream-400' : '' },
    { key: 'meal', label: '식사', marker: 'ME', val: mealVal, pendingCount: pendingCardCounts.meal, color: activeCard === 'meal' ? 'bg-cream-400' : '' },
    { key: 'exercise', label: '운동', marker: 'EX', val: exerciseVal, pendingCount: pendingCardCounts.exercise, color: activeCard === 'exercise' ? 'bg-cream-400' : '' },
    { key: 'water', label: '수분', marker: 'WA', val: waterVal, pendingCount: pendingCardCounts.water, color: activeCard === 'water' ? 'bg-cream-400' : '' },
    { key: 'mood', label: '기분', marker: 'MO', val: moodVal, pendingCount: pendingCardCounts.mood, color: activeCard === 'mood' ? 'bg-cream-400' : '' },
    { key: 'alcohol', label: '음주', marker: 'AL', val: alcoholCardVal, pendingCount: pendingCardCounts.alcohol, color: activeCard === 'alcohol' ? 'bg-cream-400' : '' },
    ...(isGroupA
      ? [{ key: 'medication', label: '복약', marker: 'MD', val: medicationVal, pendingCount: pendingCardCounts.medication, color: activeCard === 'medication' ? 'bg-cream-400' : '' }]
      : []),
  ];

  if (!loaded) return null;

  return (
    <>
      {/* 튜토리얼 */}
      {showTutorial && (
        <Tutorial
          key={tutorialKey}
          onComplete={() => {
            try {
              localStorage.removeItem(getScopedStorageKey(TUTORIAL_PENDING_KEY));
            } catch {}
            setShowTutorial(false);
          }}
        />
      )}

      {/* 헤더 */}
      <header className="h-12 bg-[var(--color-bg)]/90 backdrop-blur-xl border-b border-cream-500/30 px-4 flex items-center shrink-0">
        <span className="text-[15px] font-medium text-nature-900">AI 채팅</span>
        <div className="flex-1"></div>
        <div className="relative group hidden md:flex">
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? '사이드바 닫기' : '사이드바 열기'}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          >
            <FileText size={16} strokeWidth={1.75} />
            <span className="absolute right-[5px] top-[5px] h-[7px] w-[7px] rounded-full border-[1.5px] border-[var(--color-bg)] bg-warning" />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-50 whitespace-nowrap rounded-md bg-[var(--color-text)] px-2 py-1 text-[11px] font-semibold text-[var(--color-bg)] shadow-lg ring-1 ring-black/10 opacity-0 transition-opacity duration-150 delay-[400ms] group-hover:opacity-100"
          >
            {panelOpen ? '사이드바 닫기' : '사이드바 열기'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 채팅 영역 ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto chat-scroll px-3 py-4 md:px-6 md:py-6"
            style={{ scrollbarGutter: 'stable' }}
          >

            {/* ── 온보딩 완료 시: 맞춤 인사 ── */}
            {onboarding && (
              <>
                <div className="max-w-[840px] mx-auto mb-3.5">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-avatar-bg)] text-[var(--color-avatar-text)] flex items-center justify-center text-[11px] font-semibold shrink-0">다</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] leading-[1.75] text-nature-900">
                        안녕하세요! 다나아 AI입니다.<br />
                        {risk?.group && <>
                          설문 결과가 반영되어 있어요.
                          {risk.levelLabel && <> 현재 위험도는 <strong>{risk.levelLabel}</strong> 단계예요.</>}
                          <br />
                        </>}
                        오늘 기록을 차근차근 쌓아볼까요?<br />
                        <span className="text-neutral-400">질문에 답하면 본문 아래 카드로 기록할 수 있고, 오른쪽 패널에서는 오늘 기록을 직접 입력하거나 저장된 상태와 남은 질문을 함께 확인할 수 있어요.</span>
                      </div>
                      <div className="text-[13px] text-[var(--color-text-hint)] mt-1">지금</div>
                    </div>
                  </div>
                </div>

                {/* 빠른 기록 유도 카드 */}
                {!hasAnyData && messages.length === 0 && (
                  <div className="max-w-[840px] mx-auto mb-3.5">
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 shrink-0"></div>
                      <div className="flex-1 border border-cream-500 rounded-xl p-4 bg-cream-300 shadow-soft">
                        <div className="text-[15px] font-medium text-nature-900 mb-2.5">오늘 기록을 어디서든 시작해보세요</div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '수면 기록', card: 'sleep' },
                            { label: '식사 기록', card: 'meal' },
                            { label: '운동 기록', card: 'exercise' },
                            { label: '수분 기록', card: 'water' },
                          ].map(item => (
                            <button key={item.card} onClick={() => { setPanelOpen(true); setActiveCard(item.card); }}
                              className="px-3.5 py-2 rounded-full text-[14px] bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500 transition-all">
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
                  <div className="w-7 h-7 rounded-full bg-[var(--color-avatar-bg)] text-[var(--color-avatar-text)] flex items-center justify-center text-[11px] font-semibold shrink-0">다</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] leading-[1.75] text-nature-900">
                      안녕하세요! 다나아 AI입니다.<br />
                      맞춤 건강관리를 시작하려면 먼저 온보딩 설문을 완료해주세요.
                    </div>
                    <a href="/onboarding/diabetes" className="inline-block mt-2 px-4 py-2.5 bg-[var(--color-cta-bg)] text-[var(--color-cta-text)] text-[14px] font-medium rounded-lg hover:bg-[var(--color-cta-hover)] transition-colors">
                      온보딩 시작하기 →
                    </a>
                    <div className="text-[13px] text-[var(--color-text-hint)] mt-1.5">지금</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 채팅 메시지 ── */}
            {historyPolicyNotice && (
              <div className="max-w-[840px] mx-auto mb-3.5">
                <div className="ml-[38px] rounded-xl border border-cream-500 bg-cream-300 px-4 py-3.5 text-[14px] leading-[1.6] text-neutral-500">
                  이전 대화는 텍스트만 복원돼요. 건강 질문 카드는 새 답변에서만 표시됩니다.
                </div>
              </div>
            )}

            {onboarding && (
              <VideoRecommendations />
            )}

            <ChatTranscript
              messages={messages}
              streamingDraft={streamingDraft}
              chatEndRef={chatEndRef}
              onSubmitHealthAnswer={submitHealthAnswer}
              onCompleteHealthAnswer={completeHealthAnswer}
            />

            {selectedPendingBundle && (
              <div ref={manualHealthCardRef} className="max-w-[840px] mx-auto mb-3.5">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 shrink-0"></div>
                  <div className="flex-1 max-w-[560px]">
                    <InlineHealthQuestionCard
                      bundleKey={selectedPendingBundle.bundleKey}
                      bundleName={stripDisplayEmoji(selectedPendingBundle.name)}
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
          <div className="py-3 px-3 md:px-6" data-tutorial="chat-input">
            <div className="max-w-[840px] mx-auto">
              <div
                className="rounded-2xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-4 pt-3 pb-2.5 cursor-text"
                onClick={(e) => {
                  // 버튼 클릭 시에는 기본 핸들러가 먼저 처리되므로, input이 아닌 빈 영역 클릭일 때만 포커스
                  if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                    chatInputRef.current?.focus();
                  }
                }}
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMessage(); } }}
                  placeholder={isHistoryLoading ? '이전 대화를 불러오는 중...' : isStreaming ? '답변을 기다리는 중...' : '답글...'}
                  disabled={isStreaming || isHistoryLoading}
                  className="w-full bg-transparent text-[14px] text-nature-900 outline-none placeholder:text-neutral-400 disabled:opacity-50"
                />
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[16px] text-neutral-400 cursor-pointer hover:text-neutral-500">+</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-neutral-400">다나아 AI</span>
                    <button
                      onClick={sendMessage}
                      disabled={isStreaming || isHistoryLoading || !inputText.trim()}
                      className="w-7 h-7 rounded-lg bg-transparent text-neutral-400 flex items-center justify-center text-sm cursor-pointer shrink-0 hover:text-nature-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-center text-[11px] text-[var(--color-text-hint)]">다나아는 AI이며 실수할 수 있습니다. 응답을 다시 한번 확인해 주세요.</div>
            </div>
          </div>
        </div>

        {/* ══ 오른쪽 패널 ══ */}
        {panelOpen && RIGHT_PANEL_V2_ENABLED && (
          <RightPanelV2
            log={log}
            update={update}
            save={save}
            saveImmediate={saveImmediate}
            todaySaveState={todaySaveState}
            activeCard={activeCard}
            setActiveCard={setActiveCard}
            cardsSectionRef={cardsSectionRef}
            userCtx={{ groups: [onboarding?.user_group].filter(Boolean), isOffline: !navigatorOnline }}
            todayISO={todayDateString()}
            onGoChat={() => {/* 채팅 입력창 포커스 등 */}}
            panels={{ SleepPanel, MealPanel, ExercisePanelV2, WaterPanelV2, MoodPanel, MedicationPanel, AlcoholPanel }}
            extras={{ updateAlcoholToday, updateAlcoholAmount, HabitsSection }}
          />
        )}
        {panelOpen && !RIGHT_PANEL_V2_ENABLED && (
          <aside className="hidden md:flex w-[320px] xl:w-[336px] border-l border-cream-500 bg-cream-200 flex-col shrink-0 overflow-y-auto custom-scroll" style={{ scrollbarGutter: 'stable' }}>

            <div className="p-5 space-y-6">
              {/* ═══ 1. 오늘 한눈에 ═══ */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-[16px] font-semibold text-nature-900">오늘 한눈에</h4>
                  <span
                    className={`rounded-full px-2.5 py-1.5 text-[13px] font-medium ${
                      todaySaveState === 'error'
                        ? 'bg-danger/10 text-danger-light'
                        : todaySaveState === 'saving'
                          ? 'bg-cream-300 text-neutral-500'
                          : todaySaveState === 'saved'
                            ? 'bg-nature-100 text-nature-700'
                            : 'bg-cream-400 text-[var(--color-text-hint)]'
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
                <div className="border-b border-cream-500 mb-4"></div>
                <div className="mb-4 rounded-xl bg-[var(--color-card-surface-subtle)] px-4 py-3 text-[14px] leading-[1.55] text-neutral-400">
                  오늘 필요한 기록은 여기에서 바로 입력하고, 비어 있는 항목도 같은 카드에서 이어서 채울 수 있어요.
                </div>

                {/* 기록 카드 + 확장 패널 — 바깥 클릭으로 닫히는 영역 */}
                <div ref={cardsSectionRef}>
                <div className="grid grid-cols-2 gap-2.5 mb-4" data-tutorial="today-cards">
                  {cards.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setActiveCard(activeCard === c.key ? null : c.key)}
                      className={`rounded-2xl p-4 text-left cursor-pointer transition-all ${
                        activeCard === c.key
                          ? `${c.color} shadow-float ring-1 ring-cream-500`
                          : 'bg-cream-300 hover:bg-cream-400 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <ClinicalMark label={c.marker} className="mb-2" />
                          <div className="text-[14px] text-neutral-400">{c.label}</div>
                        </div>
                        {c.pendingCount > 0 && (
                          <span className="rounded-full bg-cream-400 px-2.5 py-1 text-[14px] text-nature-700 shrink-0">
                            미입력 {c.pendingCount}
                          </span>
                        )}
                      </div>
                      <div className={`mt-3 text-[18px] font-semibold leading-[1.25] ${c.val ? 'text-nature-900' : 'text-[var(--color-text-hint)]'}`}>
                        {c.val || '바로 입력'}
                      </div>
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
                {activeCard === 'mood' && (
                  <MoodPanel log={log} update={update} />
                )}
                {activeCard === 'medication' && isGroupA && (
                  <MedicationPanel log={log} update={update} />
                )}
                {activeCard === 'alcohol' && (
                  <AlcoholPanel
                    log={log}
                    updateAlcoholToday={updateAlcoholToday}
                    updateAlcoholAmount={updateAlcoholAmount}
                  />
                )}
                </div>
              </div>

              <HabitsSection />
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
    { key: 'very_good', label: '푹 잤어요' },
    { key: 'good', label: '잘 잤어요' },
    { key: 'normal', label: '조금 뒤척였어요' },
    { key: 'bad', label: '자주 깼어요' },
    { key: 'very_bad', label: '거의 못 잤어요' },
  ];
  const durationLocked = false;
  const qualityLocked = false;
  const panelLocked = false;

  if (!log.sleep_duration_bucket && !log.sleep_quality) {
    return (
      <div className="bg-cream-300 rounded-xl p-4.5 mb-4 text-center">
        {panelLocked && (
          <div className="mb-3 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">
            이미 저장된 운동 기록은 오늘 화면에서 다시 바꾸지 않아요.
          </div>
        )}
        {panelLocked && (
          <div className="mb-3 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">
            이미 저장된 수면 기록은 오늘 화면에서 다시 바꾸지 않아요.
          </div>
        )}
        <ClinicalMark label="SL" className="mx-auto mb-2.5" />
        <div className="text-[16px] font-medium text-nature-900 mb-3">수면을 기록해주세요</div>
        <div className="text-[14px] leading-[1.55] text-neutral-400 mb-3.5">몇 시간 주무셨나요?</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {durations.map(d => (
            <button key={d.key} onClick={() => update('sleep_duration_bucket', d.key)} disabled={durationLocked}
              className={`px-3 py-1.5 rounded-full text-[15px] border transition-all ${
                durationLocked
                  ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                  : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-nature-500 hover:text-white hover:border-nature-500'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream-300 rounded-xl p-4.5 mb-4">
      {panelLocked && (
        <div className="mb-3 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">
          이미 저장된 수면 기록은 오늘 화면에서 다시 바꾸지 않아요.
        </div>
      )}
      {/* 수면 시간 */}
      <div className="text-[14px] text-neutral-400 mb-2.5">수면 시간</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {durations.map(d => (
          <button key={d.key} onClick={() => update('sleep_duration_bucket', d.key)} disabled={durationLocked}
            className={`px-3 py-1.5 rounded-full text-[15px] transition-all ${
              log.sleep_duration_bucket === d.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : durationLocked
                  ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                  : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
            }`}>
            {d.label}
          </button>
        ))}
      </div>
      {/* 수면 질 */}
      <div className="text-[14px] text-neutral-400 mb-2.5">수면 질</div>
      <div className="flex flex-wrap gap-2">
        {qualities.map(q => (
          <button key={q.key} onClick={() => update('sleep_quality', q.key)} disabled={qualityLocked}
            className={`px-2.5 py-1.5 rounded-full text-[15px] transition-all ${
              log.sleep_quality === q.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : qualityLocked
                  ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                  : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
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
  const [mealSaveMessage, setMealSaveMessage] = useState('');
  const notifyMealSaved = useCallback((field, value) => {
    update(field, value);
    setMealSaveMessage('식사 기록을 저장했어요.');
    window.setTimeout(() => setMealSaveMessage(''), 1800);
  }, [update]);
  const meals = [
    { key: 'breakfast_status', label: '아침', marker: 'AM' },
    { key: 'lunch_status', label: '점심', marker: 'NO' },
    { key: 'dinner_status', label: '저녁', marker: 'PM' },
  ];
  const options = [
    { key: 'hearty', label: '먹었어요' },
    { key: 'skipped', label: '못 먹었어요' },
  ];
  const vegOptions = [
    { key: 'enough', label: '충분히 먹었어요' },
    { key: 'little', label: '조금 먹었어요' },
    { key: 'none', label: '거의 못 먹었어요' },
  ];
  const balanceOptions = [
    { key: 'balanced', label: '고르게 먹었어요' },
    { key: 'carb_heavy', label: '밥·빵·면 위주였어요' },
    { key: 'protein_veg_heavy', label: '고기·채소 위주였어요' },
  ];
  const breakfastLocked = false;
  const lunchLocked = false;
  const dinnerLocked = false;
  const vegetableLocked = false;
  const balanceLocked = false;
  const panelLocked = false;

  return (
    <div className="bg-cream-300 rounded-xl p-4.5 mb-4">
      {mealSaveMessage && (
        <div className="mb-3 rounded-xl bg-nature-50 px-3.5 py-2 text-[13px] font-medium text-nature-800">
          {mealSaveMessage}
        </div>
      )}
      {panelLocked && (
        <div className="mb-4 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">
          이미 저장된 식사 기록은 오늘 화면에서 다시 바꾸지 않아요.
        </div>
      )}
      {meals.map(meal => (
        <div key={meal.key} className="mb-4 last:mb-0">
          <div className="flex items-center gap-2 mb-2">
            <ClinicalMark label={meal.marker} />
            <span className="text-[15px] font-medium text-nature-900">
              {meal.label}
              {log[meal.key] && <span className="text-neutral-400 font-normal"> — {MEAL_LABELS[log[meal.key]]}</span>}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {options.map(opt => (
              <button
                key={opt.key}
                onClick={() => notifyMealSaved(meal.key, opt.key)}
                disabled={
                  meal.key === 'breakfast_status'
                    ? breakfastLocked
                    : meal.key === 'lunch_status'
                      ? lunchLocked
                      : dinnerLocked
                }
                className={`px-3 py-1.5 rounded-full text-[15px] transition-all ${
                  log[meal.key] === opt.key
                    ? 'bg-nature-500 text-white border border-nature-500'
                    : (
                        meal.key === 'breakfast_status'
                          ? breakfastLocked
                          : meal.key === 'lunch_status'
                            ? lunchLocked
                            : dinnerLocked
                      )
                      ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                      : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {meal.key !== 'dinner_status' && <div className="border-b border-cream-500 mt-4"></div>}
        </div>
      ))}

      {/* 채소 */}
      <div className="border-t border-cream-500 mt-4 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <ClinicalMark label="VG" />
          <span className="text-[15px] font-medium text-nature-900">채소</span>
          {log.vegetable_intake_level && <span className="text-[13px] text-neutral-400">— {vegOptions.find(v => v.key === log.vegetable_intake_level)?.label}</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {vegOptions.map(opt => (
            <button key={opt.key} onClick={() => notifyMealSaved('vegetable_intake_level', opt.key)} disabled={vegetableLocked}
              className={`px-3 py-1.5 rounded-full text-[15px] transition-all ${
                log.vegetable_intake_level === opt.key
                  ? 'bg-nature-500 text-white border border-nature-500'
                  : vegetableLocked
                    ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                    : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 식사구성 */}
      <div className="border-t border-cream-500 mt-4 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <ClinicalMark label="BL" />
          <span className="text-[15px] font-medium text-nature-900">식사구성</span>
          {log.meal_balance_level && <span className="text-[13px] text-neutral-400">— {balanceOptions.find(v => v.key === log.meal_balance_level)?.label}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {balanceOptions.map(opt => (
            <button key={opt.key} onClick={() => notifyMealSaved('meal_balance_level', opt.key)} disabled={balanceLocked}
              className={`px-3 py-1.5 rounded-full text-[15px] transition-all ${
                log.meal_balance_level === opt.key
                  ? 'bg-nature-500 text-white border border-nature-500'
                  : balanceLocked
                    ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                    : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
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
    { key: 'walking', label: '산책' },
    { key: 'running', label: '달리기' },
    { key: 'cycling', label: '자전거' },
    { key: 'swimming', label: '수영' },
    { key: 'gym', label: '헬스' },
    { key: 'home_workout', label: '홈트' },
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
        <ClinicalMark label="EX" className="mx-auto mb-2" />
        <div className="text-[12px] text-nature-900 mb-3">운동 — 안 했어요</div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => update('exercise_done', true)} disabled={exerciseDoneLocked}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                : 'bg-nature-500 text-white border-nature-500'
            }`}>
            했어요
          </button>
          <button onClick={() => update('exercise_done', false)} disabled={exerciseDoneLocked}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'
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
          <div className="mb-3 rounded-lg bg-cream-400 px-3 py-2 text-[10px] text-neutral-400">
            이미 저장된 운동 기록은 오늘 화면에서 다시 바꾸지 않아요.
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
            <ClinicalMark label="EX" className="h-6 min-w-[24px] px-1.5 text-[9px]" />
          <span className="text-[11px] font-medium text-nature-900">운동 — 안 했어요</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save({ ...log, exercise_done: true, exercise_type: null, exercise_minutes: null })} disabled={exerciseDoneLocked}
            className={`px-3 py-1 rounded-full text-[11px] border transition-all ${
              exerciseDoneLocked
                ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'
            }`}>
            했어요로 변경
          </button>
        </div>
        {/* 산책 */}
        <div className="border-t border-cream-500 mt-3 pt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
              <ClinicalMark label="WK" className="h-6 min-w-[24px] px-1.5 text-[9px]" />
            <span className="text-[11px] font-medium text-nature-900">산책</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => update('walk_done', log.walk_done === true ? null : true)} disabled={walkLocked}
              className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === true ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
              했어요
            </button>
            <button onClick={() => update('walk_done', log.walk_done === false ? null : false)} disabled={walkLocked}
              className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === false ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
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
        <div className="mb-3 rounded-lg bg-cream-400 px-3 py-2 text-[10px] text-neutral-400">
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
                  ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
                  : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-neutral-400 mb-2">운동 시간 (분)</div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => update('exercise_minutes', Math.max(0, (log.exercise_minutes || 0) - 10))} disabled={exerciseMinutesLocked}
          className="w-7 h-7 rounded-full border border-cream-500 bg-cream-400 text-neutral-400 flex items-center justify-center text-[12px] hover:bg-cream-500">−</button>
        <span className="text-[16px] font-semibold text-nature-900 min-w-[40px] text-center">{log.exercise_minutes || 0}</span>
        <span className="text-[10px] text-[var(--color-text-hint)]">분</span>
        <button onClick={() => update('exercise_minutes', Math.min(300, (log.exercise_minutes || 0) + 10))} disabled={exerciseMinutesLocked}
          className="w-7 h-7 rounded-full border border-cream-500 bg-cream-400 text-neutral-400 flex items-center justify-center text-[12px] hover:bg-cream-500">+</button>
      </div>

      {/* 산책 */}
      <div className="border-t border-cream-500 pt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ClinicalMark label="WK" className="h-6 min-w-[24px] px-1.5 text-[9px]" />
          <span className="text-[11px] font-medium text-nature-900">산책</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => update('walk_done', log.walk_done === true ? null : true)} disabled={walkLocked}
            className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === true ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
            했어요
          </button>
          <button onClick={() => update('walk_done', log.walk_done === false ? null : false)} disabled={walkLocked}
            className={`px-3 py-1 rounded-full text-[11px] transition-all ${log.walk_done === false ? 'bg-nature-500 text-white border border-nature-500' : walkLocked ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
            못했어요
          </button>
        </div>
      </div>

      <div className="border-t border-cream-500 mt-3 pt-2">
        <button onClick={() => save({ ...log, exercise_done: false, exercise_type: null, exercise_minutes: null })} disabled={exerciseDoneLocked}
          className={`text-[10px] transition-colors ${exerciseDoneLocked ? 'text-[var(--color-text-hint)] cursor-not-allowed' : 'text-neutral-400 hover:text-nature-900'}`}>
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
        <div className="mb-3 rounded-lg bg-cream-400 px-3 py-2 text-[10px] text-neutral-400">
          이미 저장된 수분 기록은 오늘 화면에서 다시 바꾸지 않아요.
        </div>
      )}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => update('water_cups', Math.max(0, log.water_cups - 1))} disabled={waterLocked}
          className="w-8 h-8 rounded-full border border-cream-500 bg-cream-400 text-neutral-400 flex items-center justify-center text-[14px] hover:bg-cream-500 transition-colors">−</button>
        <div className="text-center">
          <span className="text-[28px] font-semibold text-nature-900">{log.water_cups}</span>
          <span className="text-[12px] text-neutral-400 ml-1">/ 8잔</span>
        </div>
        <button onClick={() => update('water_cups', Math.min(12, log.water_cups + 1))} disabled={waterLocked}
          className="w-8 h-8 rounded-full border border-cream-500 bg-cream-400 text-neutral-400 flex items-center justify-center text-[14px] hover:bg-cream-500 transition-colors">+</button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <ClinicalMark label="WA" />
        <div className="flex-1 h-2 bg-cream-500 rounded-full overflow-hidden">
          <div className="h-full bg-nature-700 rounded-full transition-all" style={{ width: `${Math.min(100, log.water_cups / 8 * 100)}%` }}></div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-400 text-center">하루 권장 8잔 (240ml 기준)</div>
    </div>
  );
}

/* ═══════════ 도전 챌린지 섹션 ═══════════ */
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
      <h4 className="text-[16px] font-semibold text-nature-900 mb-3">도전 챌린지</h4>
      <div className="border-b border-cream-500 mb-4"></div>
      {challenges.length === 0 ? (
        <div className="bg-cream-300 rounded-xl p-4 text-center">
          <ClinicalMark label="CH" className="mx-auto mb-2 h-8 min-w-[32px]" />
          <div className="text-[16px] font-medium text-nature-900 mb-1.5">아직 참여 중인 챌린지가 없어요</div>
          <div className="text-[14px] leading-[1.55] text-neutral-400 mb-3.5">챌린지에 참여하면 여기에 진행 상황이 표시돼요</div>
          <a href="/app/challenge" className="inline-block px-4 py-2 rounded-full text-[14px] bg-nature-500 text-white hover:bg-nature-600 transition-colors">
            챌린지 둘러보기
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((item) => {
            // 주간 근사: current_streak 기준 min 7 · 7일 연속 달성 시 가득 참
            const weeklyDone = Math.min(7, Number(item.current_streak || 0));
            const weeklyPct = Math.round((weeklyDone / 7) * 100);
            const streak = Number(item.current_streak || 0);
            return (
              <div
                key={item.user_challenge_id ?? item.name}
                className="bg-cream-300 rounded-2xl p-4 border border-cream-500"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[16px] grayscale opacity-80"
                      style={{ filter: 'grayscale(1)' }}
                      aria-hidden="true"
                    >
                      {item.emoji || '🎯'}
                    </span>
                    <span className="text-[14px] font-semibold text-nature-900 truncate">
                      {stripDisplayEmoji(item.name || '')}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      item.today_checked
                        ? 'bg-nature-900 text-[var(--color-bg)]'
                        : 'bg-cream-400 text-neutral-500'
                    }`}
                    aria-label={`이번 주 ${weeklyDone}일 달성 중`}
                  >
                    {weeklyDone}/7
                  </span>
                </div>

                {/* 7칸 도트 진행바 */}
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-colors ${
                        i < weeklyDone ? 'bg-nature-900' : 'bg-cream-500'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[12px] text-neutral-400">
                  <span>이번 주 {weeklyPct}%</span>
                  <span>{streak}일 연속</span>
                </div>
              </div>
            );
          })}
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
          <ClinicalMark label="Q" className="mx-auto mb-2 h-8 min-w-[32px]" />
          <div className="text-[12px] font-medium text-nature-900 mb-1">지금 이어서 답할 질문은 없어요</div>
          <div className="text-[10px] text-neutral-400">새 질문이 생기면 답변 아래 카드에서 바로 기록할 수 있어요.</div>
        </div>
      ) : (
        <div className="bg-cream-300 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-nature-900">
                {stripDisplayEmoji(pendingSummary?.bundleName || '오늘 기록 보완')}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                질문형 기록은 채팅 본문 아래 카드에서 이어지고, 오른쪽 패널에서는 오늘 기록 상태를 바로 확인할 수 있어요.
              </div>
            </div>
            <span className="rounded-full bg-cream-400 px-2 py-1 text-[10px] text-neutral-400">
              {questions.length}개 남음
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {questions.map((question, index) => (
              <div key={question.field} className="rounded-lg bg-cream-400 px-3 py-2">
                <div className="text-[10px] text-neutral-400">질문 {index + 1}</div>
                <div className="text-[11px] font-medium text-nature-900 mt-0.5">{stripDisplayEmoji(question.text)}</div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onJumpToHealthCard}
            className="mt-3 w-full rounded-lg bg-nature-500 px-3 py-2 text-[11px] font-medium text-white hover:bg-nature-600 transition-colors"
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
    { key: 'running', label: '러닝' },
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

  const circleButtonClass = (locked) => `w-9 h-9 rounded-full border flex items-center justify-center text-[16px] transition-colors ${
    locked
      ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
      : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'
  }`;

  const pillClass = (active, locked) => `px-3.5 py-1.5 rounded-full text-[14px] transition-all ${
    active
      ? 'bg-nature-500 text-white border border-nature-500'
      : locked
        ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
        : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
  }`;

  if (log.exercise_done === null) {
    return (
      <div className="bg-cream-300 rounded-xl p-4.5 mb-4 text-center">
        <div className="text-[17px] mb-2.5">운동</div>
        <div className="text-[16px] font-medium text-nature-900 mb-3.5">오늘 운동 하셨어요?</div>
        <div className="flex justify-center gap-2">
          <button onClick={() => update('exercise_done', true)} disabled={exerciseDoneLocked} className={`px-4 py-2 rounded-full text-[14px] border transition-all ${exerciseDoneLocked ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-nature-500 text-white border-nature-500'}`}>
            했어요
          </button>
          <button onClick={() => update('exercise_done', false)} disabled={exerciseDoneLocked} className={`px-4 py-2 rounded-full text-[14px] border transition-all ${exerciseDoneLocked ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
            못 했어요
          </button>
        </div>
      </div>
    );
  }

  if (log.exercise_done === false) {
    return (
      <div className={`bg-cream-300 rounded-xl p-4.5 mb-4 ${panelLocked ? 'opacity-70' : ''}`}>
        {panelLocked && <div className="mb-3 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">이미 저장된 운동 기록은 오늘 화면에서 다시 바뀌지 않아요.</div>}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[16px]">운동</span>
          <span className="text-[15px] font-medium text-nature-900">오늘 운동은 하지 않았어요</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save({ ...log, exercise_done: true, exercise_type: null, exercise_minutes: null })} disabled={exerciseDoneLocked} className={`px-3.5 py-1.5 rounded-full text-[14px] border transition-all ${exerciseDoneLocked ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
            운동했어요로 바꾸기
          </button>
        </div>
        <div className="mt-4 border-t border-cream-500 pt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[16px]">걷기</span>
            <span className="text-[15px] font-medium text-nature-900">오늘 산책이나 걷기 하셨어요?</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => update('walk_done', true)} disabled={walkLocked} className={pillClass(log.walk_done === true, walkLocked)}>했어요</button>
            <button onClick={() => update('walk_done', false)} disabled={walkLocked} className={pillClass(log.walk_done === false, walkLocked)}>못 했어요</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-cream-300 rounded-xl p-4.5 mb-4 ${panelLocked ? 'opacity-70' : ''}`}>
      {panelLocked && <div className="mb-3 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">이미 저장된 운동 기록은 오늘 화면에서 다시 바뀌지 않아요.</div>}
      <div className="mb-2.5 text-[14px] text-neutral-400">운동 종류</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {types.map((type) => (
          <button key={type.key} onClick={() => update('exercise_type', type.key)} disabled={exerciseTypeLocked} className={`px-2.5 py-1.5 rounded-full text-[14px] transition-all ${log.exercise_type === type.key ? 'bg-nature-500 text-white border border-nature-500' : exerciseTypeLocked ? 'bg-cream-400/70 border border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed' : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'}`}>
            {type.label}
          </button>
        ))}
      </div>

      <div className="mb-2.5 text-[14px] text-neutral-400">운동 시간 (분)</div>
      <div className="mb-4 flex items-center gap-2.5">
        <button onClick={() => update('exercise_minutes', Math.max(0, (log.exercise_minutes || 0) - 5))} disabled={exerciseMinutesLocked} className={circleButtonClass(exerciseMinutesLocked)}>-</button>
        <input type="number" min="0" max="300" inputMode="numeric" value={log.exercise_minutes ?? 0} onChange={(e) => { const next = Number.parseInt(e.target.value || '0', 10); update('exercise_minutes', Number.isFinite(next) ? Math.max(0, Math.min(300, next)) : 0); }} disabled={exerciseMinutesLocked} className="h-10 w-[72px] rounded-xl border border-cream-500 bg-cream-400 px-3 text-center text-[18px] font-semibold text-nature-900 outline-none transition-colors focus:border-nature-500" />
        <span className="text-[14px] text-[var(--color-text-hint)]">분</span>
        <button onClick={() => update('exercise_minutes', Math.min(300, (log.exercise_minutes || 0) + 5))} disabled={exerciseMinutesLocked} className={circleButtonClass(exerciseMinutesLocked)}>+</button>
      </div>

      <div className="border-t border-cream-500 pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[16px]">걷기</span>
          <span className="text-[15px] font-medium text-nature-900">오늘 산책이나 걷기 하셨어요?</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => update('walk_done', true)} disabled={walkLocked} className={pillClass(log.walk_done === true, walkLocked)}>했어요</button>
          <button onClick={() => update('walk_done', false)} disabled={walkLocked} className={pillClass(log.walk_done === false, walkLocked)}>못 했어요</button>
        </div>
      </div>

      <div className="mt-4 border-t border-cream-500 pt-3">
        <button onClick={() => save({ ...log, exercise_done: false, exercise_type: null, exercise_minutes: null })} disabled={exerciseDoneLocked} className={`text-[14px] transition-colors ${exerciseDoneLocked ? 'text-[var(--color-text-hint)] cursor-not-allowed' : 'text-neutral-400 hover:text-nature-900'}`}>
          운동 안 했어요로 바꾸기
        </button>
      </div>
    </div>
  );
}

function WaterPanelV2({ log, update }) {
  const waterLocked = false;
  const waterCups = Number(log.water_cups || 0);

  return (
    <div className={`bg-cream-300 rounded-xl p-4.5 mb-4 ${waterLocked ? 'opacity-70' : ''}`}>
      {waterLocked && (
        <div className="mb-3 rounded-xl bg-cream-400 px-3.5 py-3 text-[14px] leading-[1.55] text-neutral-400">
          이미 저장된 수분 기록은 오늘 화면에서 다시 바뀌지 않아요.
        </div>
      )}
      <div className="flex items-center justify-center gap-3.5 mb-4">
        <button
          onClick={() => update('water_cups', Math.max(0, waterCups - 1))}
          disabled={waterLocked}
          className={`w-10 h-10 rounded-full border flex items-center justify-center text-[18px] transition-colors ${
            waterLocked
              ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
              : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'
          }`}
        >
          -
        </button>
        <div className="text-center">
          <span className="text-[32px] font-semibold leading-none text-nature-900">{waterCups}</span>
          <span className="text-[14px] text-neutral-400 ml-1">/ 8잔</span>
        </div>
        <button
          onClick={() => update('water_cups', Math.min(12, waterCups + 1))}
          disabled={waterLocked}
          className={`w-10 h-10 rounded-full border flex items-center justify-center text-[18px] transition-colors ${
            waterLocked
              ? 'bg-cream-400/70 border-cream-500 text-[var(--color-text-hint)] cursor-not-allowed'
              : 'bg-cream-400 border-cream-500 text-neutral-400 hover:bg-cream-500'
          }`}
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-[20px]">수분</span>
        <div className="flex-1 h-2 bg-cream-500 rounded-full overflow-hidden">
          <div className="h-full bg-[#64b5f6] rounded-full transition-all" style={{ width: `${Math.min(100, (waterCups / 8) * 100)}%` }}></div>
        </div>
      </div>
      <div className="text-[14px] leading-[1.55] text-neutral-400 text-center">하루 권장 8잔(240ml 기준)</div>
    </div>
  );
}

function MoodPanel({ log, update }) {
  const options = [
    { key: 'very_good', label: '아주 좋음' },
    { key: 'good', label: '좋음' },
    { key: 'normal', label: '보통' },
    { key: 'stressed', label: '스트레스' },
    { key: 'very_stressed', label: '많이 지침' },
  ];

  return (
    <div className="bg-cream-300 rounded-xl p-4.5 mb-4">
      <div className="text-[14px] text-neutral-400 mb-2.5">오늘 기분</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => update('mood_level', option.key)}
            className={`px-3 py-1.5 rounded-full text-[15px] transition-all ${
              log.mood_level === option.key
                ? 'bg-nature-500 text-white border border-nature-500'
                : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MedicationPanel({ log, update }) {
  return (
    <div className="bg-cream-300 rounded-xl p-4.5 mb-4">
      <div className="text-[14px] text-neutral-400 mb-2.5">오늘 약은 챙겨 드셨나요?</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => update('took_medication', true)}
          className={`px-3.5 py-1.5 rounded-full text-[15px] transition-all ${
            log.took_medication === true
              ? 'bg-nature-500 text-white border border-nature-500'
              : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
          }`}
        >
          복용했어요
        </button>
        <button
          type="button"
          onClick={() => update('took_medication', false)}
          className={`px-3.5 py-1.5 rounded-full text-[15px] transition-all ${
            log.took_medication === false
              ? 'bg-nature-500 text-white border border-nature-500'
              : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
          }`}
        >
          아직 못 먹었어요
        </button>
      </div>
    </div>
  );
}

function AlcoholPanel({ log, updateAlcoholToday, updateAlcoholAmount }) {
  const amountOptions = [
    { key: 'light', label: '가볍게' },
    { key: 'moderate', label: '보통' },
    { key: 'heavy', label: '많이' },
  ];

  return (
    <div className="bg-cream-300 rounded-xl p-4.5 mb-4">
      <div className="text-[14px] text-neutral-400 mb-2.5">오늘 음주 여부</div>
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          type="button"
          onClick={() => updateAlcoholToday(false)}
          className={`px-3.5 py-1.5 rounded-full text-[15px] transition-all ${
            log.alcohol_today === false
              ? 'bg-nature-500 text-white border border-nature-500'
              : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
          }`}
        >
          안 마셨어요
        </button>
        <button
          type="button"
          onClick={() => updateAlcoholToday(true)}
          className={`px-3.5 py-1.5 rounded-full text-[15px] transition-all ${
            log.alcohol_today === true
              ? 'bg-nature-500 text-white border border-nature-500'
              : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
          }`}
        >
          마셨어요
        </button>
      </div>

      {log.alcohol_today === true && (
        <>
          <div className="text-[14px] text-neutral-400 mb-2.5">얼마나 드셨나요?</div>
          <div className="flex gap-2 flex-wrap">
            {amountOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => updateAlcoholAmount(option.key)}
                className={`px-3 py-1.5 rounded-full text-[15px] transition-all ${
                  log.alcohol_amount_level === option.key
                    ? 'bg-nature-500 text-white border border-nature-500'
                    : 'bg-cream-400 border border-cream-500 text-neutral-400 hover:bg-cream-500'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
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
          <ClinicalMark label="Q" className="mx-auto mb-2 h-8 min-w-[32px]" />
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
            <span className="rounded-full bg-cream-400 px-2 py-1 text-[10px] text-neutral-400">
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
                      ? 'bg-nature-500 text-white'
                      : 'bg-cream-300 hover:bg-cream-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] opacity-70">
                        {bundle.unansweredCount || bundle.questions?.length || 0}개 질문
                      </div>
                      <div className="text-[11px] font-medium mt-0.5 truncate">{stripDisplayEmoji(bundle.name)}</div>
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
                <div key={`${label}-${index}`} className="rounded-lg bg-cream-400 px-3 py-2">
                  <div className="text-[10px] text-neutral-400">질문 {index + 1}</div>
                  <div className="text-[11px] font-medium text-nature-900 mt-0.5">{stripDisplayEmoji(label)}</div>
                </div>
              ))}
              {truncatedCount > 0 && (
                <div className="text-[10px] text-neutral-400 text-right">외 {truncatedCount}개</div>
              )}
            </div>
          )}

          {hasLiveHealthCard ? (
            <div className="mt-3 rounded-lg bg-cream-400 px-3 py-2 text-[10px] text-neutral-400">
              지금 화면 아래에 나온 카드에서 바로 이어서 기록할 수 있어요.
            </div>
          ) : (
            <button
              type="button"
              onClick={onJumpToHealthCard}
              className="mt-3 w-full rounded-lg bg-nature-500 px-3 py-2 text-[11px] font-medium text-white hover:bg-nature-600 transition-colors"
            >
              현재 카드 위치로 이동
            </button>
          )}
        </div>
      )}
    </div>
  );
}
