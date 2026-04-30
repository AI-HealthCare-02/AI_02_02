import { getCurrentUserId } from '../hooks/useApi';

// ⚠️ 베이스 키 — 직접 storage write/read에 사용하지 말 것.
// 사용자별 격리를 위해 항상 getThoughtsStorageKey() 등 동적 헬퍼를 사용한다.
export const STORAGE_KEY = 'danaa_doit_thoughts_v1';
export const STORAGE_RECOVERY_BACKUP_KEY = `${STORAGE_KEY}_recovery_backup_v1`;

// 레거시 격리 백업 키 — 수정 전 공유 키에 남아있던 데이터를 1회 옮겨두는 곳.
// 자동으로 특정 계정에 귀속하지 않는다 (개인정보 섞임 방지).
export const LEGACY_QUARANTINE_KEY = `${STORAGE_KEY}_legacy_quarantine_v1`;

const ANON_SCOPE = 'anon';

/** 사용자 스코프 suffix를 안전하게 만들어 주는 헬퍼. 토큰 없거나 디코드 실패 시 anon. */
function userScope() {
  const uid = getCurrentUserId();
  if (uid == null) return ANON_SCOPE;
  // userId는 정수 또는 문자열. 안전한 storage key 문자만 허용.
  const safe = String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
  return safe ? `u${safe}` : ANON_SCOPE;
}

/** 현재 사용자 기준 실제 저장 키. 로그인: `..._v1::u{userId}` / 비로그인: `..._v1::anon`. */
export function getThoughtsStorageKey() {
  return `${STORAGE_KEY}::${userScope()}`;
}

/** 현재 사용자 기준 복구 백업 키. */
export function getRecoveryBackupKey() {
  return `${STORAGE_RECOVERY_BACKUP_KEY}::${userScope()}`;
}

/** 가이드 첫 방문 flag — 사용자별. */
export function getGuideSeenKey() {
  return `danaa_doit_guide_seen_v1::${userScope()}`;
}

/** 레이아웃 보정 토스트 1회 flag — 사용자별. */
export function getLayoutToastKey() {
  return `danaa_doit_layout_toast_shown_v1::${userScope()}`;
}

/**
 * 레거시 공유 키(`danaa_doit_thoughts_v1` 등)를 1회 quarantine 백업 후 제거.
 * 이전 사용자 데이터를 자동으로 어떤 계정에도 귀속시키지 않는다 (개인정보 섞임 방지).
 *
 * idempotency: 모듈 인스턴스가 아니라 **storage 플래그**로 보장.
 * → SSR·Hot Reload·다중 import 안전. 테스트는 storage 초기화로 자연 reset.
 */
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
        // quarantine 백업 실패해도 정리는 진행 (개인정보 보호 우선).
      }
    }

    // 원본 공유 키 제거 — 화면에 절대 노출되지 않도록.
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_RECOVERY_BACKUP_KEY);
    window.localStorage.removeItem('danaa_doit_guide_seen_v1');
    window.localStorage.removeItem('danaa_doit_layout_toast_shown_v1');

    // idempotency 플래그 — 다음 호출부터는 즉시 return.
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

function backupRawStorage(raw, reason) {
  if (typeof window === 'undefined' || raw == null || raw === '') return;
  try {
    const recoveryKey = getRecoveryBackupKey();
    if (window.localStorage.getItem(recoveryKey)) return;
    window.localStorage.setItem(
      recoveryKey,
      JSON.stringify({
        backedUpAt: new Date().toISOString(),
        reason,
        sourceKey: getThoughtsStorageKey(),
        raw,
      }),
    );
  } catch {
    // 복구 백업도 실패하면 원래 저장 동작을 방해하지 않는다.
  }
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

// ── 정규화 ─────────────────────────────────────────
// Phase 6 이전 데이터와 Phase 7 nested 스키마를 한 결로 맞춘다.
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
    // Phase 7 추가 필드
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

export function loadThoughts() {
  if (typeof window === 'undefined') return [];
  ensureLegacyQuarantined();
  const key = getThoughtsStorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      backupRawStorage(raw, 'not_array');
      return [];
    }
    const normalized = normalizeThoughtList(list);
    if (normalized.length !== list.length) {
      backupRawStorage(raw, 'invalid_items_removed');
    }
    return normalized;
  } catch {
    backupRawStorage(window.localStorage.getItem(key), 'parse_error');
    return [];
  }
}

export function saveThoughts(thoughts) {
  if (typeof window === 'undefined') return;
  ensureLegacyQuarantined();
  try {
    const normalized = normalizeThoughtList(thoughts);
    window.localStorage.setItem(getThoughtsStorageKey(), JSON.stringify(normalized));
  } catch {
    // 용량 초과 등 — 조용히 실패 (저장 실패 시 사용자 UX 우선)
  }
}

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
          // Phase 7: classify flow에서 심은 필드 초기화
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

// ProjectPickerInline 등에서 활성 프로젝트 카드 목록을 최근순으로 반환.
// 분류 패널 외에서 호출되는 경우(드롭다운, 빠른 연결 등)에도 동일 헬퍼 재사용.
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
  // total은 "활성(버리지 않은·완료되지 않은)" 생각 기준.
  // 버린 건 전부 제외. 완료된 건 totalCompleted / byCategoryCompleted로 분리 집계.
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

// ── Phase 7.1: 완료 개념 ─────────────────────────────────
// todo·schedule만 완료 가능. note·health·project(=projectStatus)·waiting·someday 불가.
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

// ── 날짜 유틸 (공용화) ─────────────────────────────────────────
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 일정 투영 뷰 ────────────────────────────────────────────
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

// ── 프로젝트 단건 조회 ────────────────────────────────────────
export function getProjectById(thoughts, id) {
  return (
    normalizeThoughtList(thoughts).find(
      (t) => t.id === id && t.category === 'project' && !t.discardedAt,
    ) || null
  );
}

// ── 노트 단건 조회 ────────────────────────────────────────
export function getNoteById(thoughts, id) {
  return (
    normalizeThoughtList(thoughts).find(
      (t) => t.id === id && t.category === 'note' && !t.discardedAt,
    ) || null
  );
}

// ── 프로젝트 상태 상수 ────────────────────────────────────────
export const PROJECT_STATUS_OPTIONS = [
  { id: 'active', label: '진행 중' },
  { id: 'onhold', label: '잠시 중단' },
  { id: 'done', label: '완료' },
];

// ── Phase 7: Discard 재설계 ──────────────────────────────────
// ⭐ discardedAt만 찍고 category는 null로 되돌림 (노트 목록 오염 방지)
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

// 버린 생각 복구 — discardedAt만 null. 과거 category는 복원하지 않음 (단순성).
export function restoreDiscarded(list, id) {
  return normalizeThoughtList(list).map((t) =>
    t.id === id ? { ...t, discardedAt: null } : t,
  );
}

// ── Phase 7: 프로젝트 연결된 다음 행동 ────────────────────────
/**
 * History view — 프로젝트 상세에서 "연결된 다음 행동"으로 노출.
 * 의도적으로 **완료(completedAt) 항목도 포함**한다 (이력성 뷰).
 * 필터가 필요하면 caller에서 개별 처리.
 */
export function getLinkedNextActions(list, projectId) {
  return normalizeThoughtList(list).filter(
    (t) =>
      t.projectLinkId === projectId &&
      t.category &&
      t.id !== projectId &&
      !t.discardedAt,
  );
}

// ── Phase 7: 자기 전 리츄얼 헬퍼 ────────────────────────────
// 오늘 자기 전 리츄얼용: 오늘자 일정 중 미완료만. Phase 7.1 기준 이름과 동작 일치.
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

// 내일 하기 — plannedDate만 세팅, 카테고리는 유지
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

// 받은편지함 유지 — 카테고리 유지, 리츄얼 로그만
export function keepInInbox(list, id) {
  const today = todayIso();
  return normalizeThoughtList(list).map((t) =>
    t.id === id
      ? { ...t, endOfDay: { ritualDate: today, action: 'keep' } }
      : t,
  );
}

// 대기 중으로 이동 — classifyThought 재사용
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
