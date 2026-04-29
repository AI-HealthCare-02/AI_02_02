export const STORAGE_KEY = 'danaa_doit_thoughts_v1';

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

// ── 정규화 ─────────────────────────────────────────
// Phase 6 이전 데이터와 Phase 7 nested 스키마를 한 결로 맞춘다.
export function normalizeThought(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    text: raw.text ?? '',
    createdAt: raw.createdAt ?? new Date().toISOString(),
    category: raw.category ?? null,
    classifiedAt: raw.classifiedAt ?? null,
    scheduledDate: raw.scheduledDate ?? null,
    scheduledTime: raw.scheduledTime ?? null,
    description: raw.description ?? null,
    nextAction: raw.nextAction ?? null,
    projectStatus: raw.projectStatus ?? null,
    noteBody: raw.noteBody ?? null,
    projectLinkId: raw.projectLinkId ?? null,
    x: typeof raw.x === 'number' && !Number.isNaN(raw.x) ? raw.x : null,
    y: typeof raw.y === 'number' && !Number.isNaN(raw.y) ? raw.y : null,
    rotation: typeof raw.rotation === 'number' ? raw.rotation : 0,
    color: raw.color || null,
    width: typeof raw.width === 'number' && raw.width > 0 ? raw.width : null,
    height: typeof raw.height === 'number' && raw.height > 0 ? raw.height : null,
    urgency: raw.urgency ?? null,
    // Phase 7 추가 필드
    clarification: {
      actionable: raw.clarification?.actionable ?? null,
      decision: raw.clarification?.decision ?? null,
      source: raw.clarification?.source ?? null,
    },
    plannedDate: raw.plannedDate ?? null,
    waitingFor: raw.waitingFor ?? null,
    somedayReason: raw.somedayReason ?? null,
    discardedAt: raw.discardedAt ?? null,
    completedAt: raw.completedAt ?? null,
    endOfDay: {
      ritualDate: raw.endOfDay?.ritualDate ?? null,
      action: raw.endOfDay?.action ?? null,
    },
  };
}

export function loadThoughts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeThought) : [];
  } catch {
    return [];
  }
}

export function saveThoughts(thoughts) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = thoughts.map(normalizeThought);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 용량 초과 등 — 조용히 실패 (저장 실패 시 사용자 UX 우선)
  }
}

export function classifyThought(thoughts, id, category, meta = {}) {
  const now = new Date().toISOString();
  return thoughts.map((t) =>
    t.id === id
      ? { ...t, category, classifiedAt: now, ...meta }
      : t,
  );
}

export function unclassifyThought(thoughts, id) {
  return thoughts.map((t) =>
    t.id === id
      ? {
          ...t,
          category: null,
          classifiedAt: null,
          scheduledDate: null,
          scheduledTime: null,
          urgency: null,
          description: null,
          nextAction: null,
          projectStatus: null,
          noteBody: null,
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
  return thoughts.filter((t) => t.id !== id);
}

export function updateThoughtMeta(thoughts, id, meta) {
  return thoughts.map((t) =>
    t.id === id ? { ...t, ...meta } : t,
  );
}

// ⭐ 모든 공개 리스트 헬퍼는 !discardedAt 필터 필수 (노트 섞임 방지)
export function getUnclassified(thoughts) {
  return thoughts.filter((t) => t.category == null && !t.discardedAt);
}

export function getByCategory(thoughts, category) {
  return thoughts.filter(
    (t) => t.category === category && !t.discardedAt && !t.completedAt,
  );
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
  for (const t of thoughts) {
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
  return list.map((t) =>
    t.id === id && isCompletable(t) ? { ...t, completedAt: now } : t,
  );
}

export function reopenThought(list, id) {
  return list.map((t) => (t.id === id ? { ...t, completedAt: null } : t));
}

export function getCompleted(list, category) {
  return list.filter(
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
  return thoughts.filter(
    (t) =>
      t.category === 'schedule' &&
      t.scheduledDate === today &&
      !t.discardedAt &&
      !t.completedAt,
  );
}

export function getOverdueScheduled(thoughts) {
  const today = todayIso();
  return thoughts.filter(
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
    thoughts.find(
      (t) => t.id === id && t.category === 'project' && !t.discardedAt,
    ) || null
  );
}

// ── 노트 단건 조회 ────────────────────────────────────────
export function getNoteById(thoughts, id) {
  return (
    thoughts.find(
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
  return list.map((t) =>
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
  return list.map((t) =>
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
  return list.filter(
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
  return list.filter(
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
  return list.map((t) =>
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
  return list.map((t) =>
    t.id === id
      ? { ...t, endOfDay: { ritualDate: today, action: 'keep' } }
      : t,
  );
}

// 대기 중으로 이동 — classifyThought 재사용
export function moveToWaiting(list, id) {
  const today = todayIso();
  return list.map((t) => {
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
