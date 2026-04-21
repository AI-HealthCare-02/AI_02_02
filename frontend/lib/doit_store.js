export const STORAGE_KEY = 'danaa_doit_thoughts_v1';

export const CATEGORIES = [
  { id: 'todo', label: '할 일', tone: 'blue' },
  { id: 'schedule', label: '일정', tone: 'yellow' },
  { id: 'project', label: '프로젝트', tone: 'brown' },
  { id: 'note', label: '노트', tone: 'gray' },
  { id: 'health', label: '건강 단서', tone: 'green' },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

export function loadThoughts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveThoughts(thoughts) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(thoughts));
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
          urgency: null,
          description: null,
          nextAction: null,
          projectStatus: null,
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

export function getUnclassified(thoughts) {
  return thoughts.filter((t) => !t.category);
}

export function getByCategory(thoughts, category) {
  return thoughts.filter((t) => t.category === category);
}

export function getSummary(thoughts) {
  const summary = {
    total: thoughts.length,
    unclassified: 0,
    byCategory: {},
  };
  for (const c of CATEGORIES) summary.byCategory[c.id] = 0;
  for (const t of thoughts) {
    if (t.category && summary.byCategory[t.category] !== undefined) {
      summary.byCategory[t.category] += 1;
    } else {
      summary.unclassified += 1;
    }
  }
  return summary;
}

// ── 날짜 유틸 (공용화) ─────────────────────────────────────────
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 일정 투영 뷰 ────────────────────────────────────────────
export function getTodayScheduled(thoughts) {
  const today = todayIso();
  return thoughts.filter(
    (t) => t.category === 'schedule' && t.scheduledDate === today,
  );
}

export function getOverdueScheduled(thoughts) {
  const today = todayIso();
  return thoughts.filter(
    (t) =>
      t.category === 'schedule' &&
      t.scheduledDate &&
      t.scheduledDate < today,
  );
}

// ── 프로젝트 단건 조회 ────────────────────────────────────────
export function getProjectById(thoughts, id) {
  return (
    thoughts.find((t) => t.id === id && t.category === 'project') || null
  );
}

// ── 프로젝트 상태 상수 ────────────────────────────────────────
export const PROJECT_STATUS_OPTIONS = [
  { id: 'active', label: '진행 중' },
  { id: 'onhold', label: '잠시 중단' },
  { id: 'done', label: '완료' },
];
