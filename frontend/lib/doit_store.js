import { getCurrentUserId } from '../hooks/useApi';
import { doitBulkSync, doitCreate, doitDelete, doitFetchAll, doitUpdate } from './doit_api';

// Storage keys — kept only for legacy quarantine + migration detection.
// Active data now lives in DB, not localStorage.
export const STORAGE_KEY = 'danaa_doit_thoughts_v1';
export const LEGACY_QUARANTINE_KEY = `${STORAGE_KEY}_legacy_quarantine_v1`;

const STORAGE_RECOVERY_BACKUP_KEY = `${STORAGE_KEY}_recovery_backup_v1`;

const ANON_SCOPE = 'anon';

function userScope() {
  const uid = getCurrentUserId();
  if (uid == null) return ANON_SCOPE;
  const safe = String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
  return safe ? `u${safe}` : ANON_SCOPE;
}

export function getThoughtsStorageKey() {
  return `${STORAGE_KEY}::${userScope()}`;
}

function getRecoveryBackupKey() {
  return `${STORAGE_RECOVERY_BACKUP_KEY}::${userScope()}`;
}

export function getGuideSeenKey() {
  return `danaa_doit_guide_seen_v1::${userScope()}`;
}

export function getLayoutToastKey() {
  return `danaa_doit_layout_toast_shown_v1::${userScope()}`;
}

const LEGACY_QUARANTINE_DONE_FLAG = `${STORAGE_KEY}_legacy_quarantined`;

function ensureLegacyQuarantined() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(LEGACY_QUARANTINE_DONE_FLAG) === '1') return;

    const legacyThoughts = window.localStorage.getItem(STORAGE_KEY);
    const legacyBackup = window.localStorage.getItem(STORAGE_RECOVERY_BACKUP_KEY);
    const legacyGuideSeen = window.localStorage.getItem('danaa_doit_guide_seen_v1');
    const legacyLayoutToast = window.localStorage.getItem('danaa_doit_layout_toast_shown_v1');

    const hasLegacy =
      legacyThoughts != null ||
      legacyBackup != null ||
      legacyGuideSeen != null ||
      legacyLayoutToast != null;

    if (hasLegacy && !window.localStorage.getItem(LEGACY_QUARANTINE_KEY)) {
      try {
        window.localStorage.setItem(
          LEGACY_QUARANTINE_KEY,
          JSON.stringify({
            quarantinedAt: new Date().toISOString(),
            reason: 'pre_per_user_isolation',
            keys: {
              [STORAGE_KEY]: legacyThoughts,
              [STORAGE_RECOVERY_BACKUP_KEY]: legacyBackup,
              danaa_doit_guide_seen_v1: legacyGuideSeen,
              danaa_doit_layout_toast_shown_v1: legacyLayoutToast,
            },
          }),
        );
      } catch {
        // quarantine 백업 실패해도 정리는 진행.
      }
    }

    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_RECOVERY_BACKUP_KEY);
    window.localStorage.removeItem('danaa_doit_guide_seen_v1');
    window.localStorage.removeItem('danaa_doit_layout_toast_shown_v1');

    window.localStorage.setItem(LEGACY_QUARANTINE_DONE_FLAG, '1');
  } catch {
    // 어떤 단계에서 실패해도 앱 흐름을 막지 않는다.
  }
}

export const CATEGORIES = [
  { id: 'todo', label: '할 일', tone: 'blue', primary: true },
  { id: 'schedule', label: '일정', tone: 'yellow', primary: true },
  { id: 'project', label: '프로젝트', tone: 'brown', primary: true },
  { id: 'note', label: '노트', tone: 'gray', primary: true },
  { id: 'health', label: '건강 단서', tone: 'green', primary: true },
  { id: 'waiting', label: '대기 중', tone: 'violet', primary: false },
  { id: 'someday', label: '언젠가', tone: 'mist', primary: false },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanCategory(category) {
  return CATEGORY_IDS.has(category) ? category : null;
}

function cleanNumber(value, fallback = null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cleanPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function cleanString(value, fallback = null) {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeThought(raw) {
  if (!isObject(raw)) return null;
  const id = cleanString(raw.id);
  if (!id) return null;
  return {
    id,
    text: cleanString(raw.text, ''),
    createdAt: cleanString(raw.createdAt, new Date().toISOString()),
    category: cleanCategory(raw.category),
    classifiedAt: cleanString(raw.classifiedAt),
    scheduledDate: cleanString(raw.scheduledDate),
    scheduledTime: cleanString(raw.scheduledTime),
    scheduleNote: cleanString(raw.scheduleNote),
    description: cleanString(raw.description),
    nextAction: cleanString(raw.nextAction),
    projectStatus: cleanString(raw.projectStatus),
    noteBody: cleanString(raw.noteBody),
    projectLinkId: cleanString(raw.projectLinkId),
    x: cleanNumber(raw.x),
    y: cleanNumber(raw.y),
    rotation: cleanNumber(raw.rotation, 0),
    color: cleanString(raw.color),
    width: cleanPositiveNumber(raw.width),
    height: cleanPositiveNumber(raw.height),
    urgency: raw.urgency ?? null,
    clarification: {
      actionable: raw.clarification?.actionable ?? null,
      decision: cleanString(raw.clarification?.decision),
      source: cleanString(raw.clarification?.source),
    },
    plannedDate: cleanString(raw.plannedDate),
    waitingFor: cleanString(raw.waitingFor),
    somedayReason: cleanString(raw.somedayReason),
    discardedAt: cleanString(raw.discardedAt),
    completedAt: cleanString(raw.completedAt),
    endOfDay: {
      ritualDate: cleanString(raw.endOfDay?.ritualDate),
      action: cleanString(raw.endOfDay?.action),
    },
  };
}

export function normalizeThoughtList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeThought).filter(Boolean);
}

// ── Module-level store state (replaces localStorage as active data store) ──

let _cache = null;          // null = not yet initialized
let _initPromise = null;    // singleton init guard
let _syncTimer = null;      // debounce handle for diff-based API sync
let _prevBeforeSync = null; // snapshot captured before the current pending diff batch
let _needsMigration = false;
let _bc = undefined;        // undefined = not set up; null = not available; BroadcastChannel = active

function _ensureBroadcastChannel() {
  if (_bc !== undefined) return _bc;
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
    _bc = null;
    return null;
  }
  _bc = new window.BroadcastChannel('danaa_doit_store_v1');
  _bc.onmessage = (event) => {
    if (event.data?.type === 'cache_update' && Array.isArray(event.data.cache)) {
      _cache = normalizeThoughtList(event.data.cache);
      window.dispatchEvent(new CustomEvent('doit-store-update'));
    }
  };
  return _bc;
}

// ── Public store API ──

/** 현재 캐시된 Thought 배열 반환. initDoitStore() 완료 전이면 []. */
export function loadThoughts() {
  return _cache ?? [];
}

/** Thought 배열 전체를 저장. 캐시 갱신 → 이벤트 dispatch → 다른 탭 동기화 → diff API sync 예약. */
export function saveThoughts(thoughts) {
  if (_cache === null) return; // initDoitStore 완료 전 저장 무시
  const prev = _cache ?? [];
  const normalized = normalizeThoughtList(thoughts);
  _cache = normalized;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('doit-store-update'));
  }
  // 같은 origin의 다른 탭에 즉시 반영 (크로스-탭 동기화)
  _ensureBroadcastChannel()?.postMessage({ type: 'cache_update', cache: normalized });
  _scheduleDiff(prev, normalized);
}

/**
 * 앱 마운트 시 1회 호출. DB에서 전체 로드 후 캐시를 채운다.
 * 두 번 이상 호출해도 같은 Promise를 반환한다 (singleton).
 */
export async function initDoitStore() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    ensureLegacyQuarantined();
    try {
      const remote = await doitFetchAll();
      _cache = normalizeThoughtList(remote);
      _checkMigrationNeeded();
    } catch {
      if (_cache === null) _cache = [];
    }
  })();
  return _initPromise;
}

/** DB가 비어있고 localStorage에 데이터가 남아있으면 true. */
export function needsMigration() {
  return _needsMigration;
}

/**
 * localStorage → DB 1회 이전.
 * 반환: { success: true } 또는 { success: false, error: string }
 */
export async function runMigration() {
  if (!_needsMigration || typeof window === 'undefined') return { success: false };
  try {
    const raw = window.localStorage.getItem(getThoughtsStorageKey());
    if (!raw) { _needsMigration = false; return { success: true }; }
    const local = JSON.parse(raw);
    if (!Array.isArray(local) || local.length === 0) { _needsMigration = false; return { success: true }; }
    const normalized = normalizeThoughtList(local);
    await doitBulkSync(normalized);
    _cache = normalized;
    _needsMigration = false;
    window.dispatchEvent(new CustomEvent('doit-store-update'));
    return { success: true };
  } catch (err) {
    // _needsMigration은 true 유지 → 다음 방문 시 재시도 가능.
    return { success: false, error: err?.message ?? '알 수 없는 오류' };
  }
}

// ── Private helpers ──

function _checkMigrationNeeded() {
  if (!_cache || _cache.length > 0 || typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(getThoughtsStorageKey());
    if (!raw) return;
    const local = JSON.parse(raw);
    if (Array.isArray(local) && local.length > 0) _needsMigration = true;
  } catch {
    // ignore parse errors
  }
}

function _scheduleDiff(prev, next) {
  if (typeof window === 'undefined') return;
  // 첫 번째 변경의 prev를 "배치 시작 전 상태"로 고정.
  _prevBeforeSync = _prevBeforeSync ?? prev;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    const before = _prevBeforeSync;
    const after = _cache ?? [];
    _prevBeforeSync = null;
    _syncTimer = null;
    await _doApiDiff(before, after);
  }, 500);
}

async function _doApiDiff(prev, next) {
  const prevMap = new Map(prev.map((t) => [t.id, t]));
  const nextMap = new Map(next.map((t) => [t.id, t]));

  const creates = [];
  const updates = [];
  const deletes = [];

  for (const [id, t] of nextMap) {
    if (!prevMap.has(id)) {
      creates.push(t);
    } else if (JSON.stringify(prevMap.get(id)) !== JSON.stringify(t)) {
      updates.push(t);
    }
  }
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) deletes.push(id);
  }

  if (creates.length === 0 && updates.length === 0 && deletes.length === 0) return;

  const results = await Promise.allSettled([
    ...creates.map((t) => doitCreate(t)),
    ...updates.map((t) => doitUpdate(t.id, t)),
    ...deletes.map((id) => doitDelete(id)),
  ]);

  // 실패한 항목이 있으면 DB에서 재조회해 캐시를 DB 상태로 복구한다.
  if (results.some((r) => r.status === 'rejected')) {
    try {
      const fresh = await doitFetchAll();
      _cache = normalizeThoughtList(fresh);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('doit-store-update'));
        // 다른 탭도 복구된 상태로 맞춘다.
        _ensureBroadcastChannel()?.postMessage({ type: 'cache_update', cache: _cache });
      }
    } catch {
      // 재조회도 실패 — 다음 initDoitStore 호출 시 복구됨.
    }
  }
}

// ── Thought mutation helpers (pure — do not call saveThoughts) ──

export function classifyThought(thoughts, id, category, meta = {}) {
  const now = new Date().toISOString();
  return normalizeThoughtList(thoughts).map((t) =>
    t.id === id
      ? { ...t, category, classifiedAt: now, ...meta }
      : t,
  );
}

export function unclassifyThought(thoughts, id) {
  return normalizeThoughtList(thoughts).map((t) =>
    t.id === id
      ? {
          ...t,
          category: null,
          classifiedAt: null,
          scheduledDate: null,
          scheduledTime: null,
          scheduleNote: null,
          urgency: null,
          description: null,
          nextAction: null,
          projectStatus: null,
          noteBody: null,
          projectLinkId: null,
          waitingFor: null,
          somedayReason: null,
          plannedDate: null,
          completedAt: null,
          clarification: {
            actionable: t.clarification?.actionable ?? null,
            decision: null,
            source: null,
          },
        }
      : t,
  );
}

export function removeThought(thoughts, id) {
  return normalizeThoughtList(thoughts).filter((t) => t.id !== id);
}

export function updateThoughtMeta(thoughts, id, meta) {
  return normalizeThoughtList(thoughts).map((t) =>
    t.id === id ? { ...t, ...meta } : t,
  );
}

// ⭐ 모든 공개 리스트 헬퍼는 !discardedAt 필터 필수 (노트 섞임 방지)
export function getUnclassified(thoughts) {
  return normalizeThoughtList(thoughts).filter((t) => t.category == null && !t.discardedAt);
}

export function getByCategory(thoughts, category) {
  return normalizeThoughtList(thoughts).filter(
    (t) => t.category === category && !t.discardedAt && !t.completedAt,
  );
}

export function getProjectsList(thoughts) {
  return thoughts
    .filter((t) => t.category === 'project' && !t.discardedAt && !t.completedAt)
    .sort((a, b) => {
      const aTs = a.classifiedAt || a.createdAt || '';
      const bTs = b.classifiedAt || b.createdAt || '';
      return bTs.localeCompare(aTs);
    });
}

export function getSummary(thoughts) {
  const summary = {
    total: 0,
    totalCompleted: 0,
    unclassified: 0,
    byCategory: {},
    byCategoryCompleted: {},
  };
  for (const c of CATEGORIES) {
    summary.byCategory[c.id] = 0;
    summary.byCategoryCompleted[c.id] = 0;
  }
  for (const t of normalizeThoughtList(thoughts)) {
    if (t.discardedAt) continue;
    if (t.completedAt) {
      summary.totalCompleted += 1;
      if (t.category && summary.byCategoryCompleted[t.category] !== undefined) {
        summary.byCategoryCompleted[t.category] += 1;
      }
      continue;
    }
    summary.total += 1;
    if (t.category && summary.byCategory[t.category] !== undefined) {
      summary.byCategory[t.category] += 1;
    } else {
      summary.unclassified += 1;
    }
  }
  return summary;
}

// ── Phase 7.1: 완료 개념 ──
const COMPLETABLE_CATEGORIES = new Set(['todo', 'schedule']);

export function isCompletable(thought) {
  return !!thought && COMPLETABLE_CATEGORIES.has(thought.category);
}

export function completeThought(list, id) {
  const now = new Date().toISOString();
  return normalizeThoughtList(list).map((t) =>
    t.id === id && isCompletable(t) ? { ...t, completedAt: now } : t,
  );
}

export function reopenThought(list, id) {
  return normalizeThoughtList(list).map((t) => (t.id === id ? { ...t, completedAt: null } : t));
}

export function getCompleted(list, category) {
  return normalizeThoughtList(list).filter(
    (t) => t.category === category && !!t.completedAt && !t.discardedAt,
  );
}

// ── 날짜 유틸 ──
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 일정 투영 뷰 ──
export function getTodayScheduled(thoughts) {
  const today = todayIso();
  return normalizeThoughtList(thoughts).filter(
    (t) =>
      t.category === 'schedule' &&
      t.scheduledDate === today &&
      !t.discardedAt &&
      !t.completedAt,
  );
}

export function getOverdueScheduled(thoughts) {
  const today = todayIso();
  return normalizeThoughtList(thoughts).filter(
    (t) =>
      t.category === 'schedule' &&
      t.scheduledDate &&
      t.scheduledDate < today &&
      !t.discardedAt &&
      !t.completedAt,
  );
}

export function getProjectById(thoughts, id) {
  return (
    normalizeThoughtList(thoughts).find(
      (t) => t.id === id && t.category === 'project' && !t.discardedAt,
    ) || null
  );
}

export function getNoteById(thoughts, id) {
  return (
    normalizeThoughtList(thoughts).find(
      (t) => t.id === id && t.category === 'note' && !t.discardedAt,
    ) || null
  );
}

export const PROJECT_STATUS_OPTIONS = [
  { id: 'active', label: '진행 중' },
  { id: 'onhold', label: '잠시 중단' },
  { id: 'done', label: '완료' },
];

// ── Phase 7: Discard ──
export function discardThought(list, id, source = 'end_of_day') {
  const now = new Date().toISOString();
  const today = todayIso();
  return normalizeThoughtList(list).map((t) =>
    t.id === id
      ? {
          ...t,
          category: null,
          classifiedAt: null,
          discardedAt: now,
          clarification: {
            ...(t.clarification ?? {}),
            decision: 'discard',
            source,
          },
          endOfDay:
            source === 'end_of_day'
              ? { ritualDate: today, action: 'discard' }
              : t.endOfDay ?? { ritualDate: null, action: null },
        }
      : t,
  );
}

export function restoreDiscarded(list, id) {
  return normalizeThoughtList(list).map((t) =>
    t.id === id ? { ...t, discardedAt: null } : t,
  );
}

// ── Phase 7: 프로젝트 연결된 다음 행동 ──
export function getLinkedNextActions(list, projectId) {
  return normalizeThoughtList(list).filter(
    (t) =>
      t.projectLinkId === projectId &&
      t.category &&
      t.id !== projectId &&
      !t.discardedAt,
  );
}

// ── Phase 7: 자기 전 리츄얼 헬퍼 ──
export function getTodayUnfinishedSchedule(list) {
  const today = todayIso();
  return normalizeThoughtList(list).filter(
    (t) =>
      t.category === 'schedule' &&
      t.scheduledDate === today &&
      !t.discardedAt &&
      !t.completedAt,
  );
}

export function planForTomorrow(list, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return list;
  const tomorrow = tomorrowIso();
  const today = todayIso();
  const idSet = new Set(ids);
  return normalizeThoughtList(list).map((t) =>
    idSet.has(t.id)
      ? {
          ...t,
          plannedDate: tomorrow,
          endOfDay: { ritualDate: today, action: 'plan_tomorrow' },
        }
      : t,
  );
}

export function keepInInbox(list, id) {
  const today = todayIso();
  return normalizeThoughtList(list).map((t) =>
    t.id === id
      ? { ...t, endOfDay: { ritualDate: today, action: 'keep' } }
      : t,
  );
}

export function moveToWaiting(list, id) {
  const today = todayIso();
  return normalizeThoughtList(list).map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      category: 'waiting',
      classifiedAt: new Date().toISOString(),
      clarification: {
        ...(t.clarification ?? {}),
        decision: 'waiting',
        source: 'end_of_day',
      },
      endOfDay: { ritualDate: today, action: 'waiting' },
    };
  });
}

// ── 테스트 전용 (test 파일 외 사용 금지) ──
export function _resetStoreForTest() {
  _cache = null;
  _initPromise = null;
  _syncTimer = null;
  _prevBeforeSync = null;
  _needsMigration = false;
  if (_bc) { try { _bc.close(); } catch {} }
  _bc = undefined;
}
