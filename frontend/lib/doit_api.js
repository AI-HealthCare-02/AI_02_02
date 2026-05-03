/**
 * Do it OS API 래퍼 — 백엔드 snake_case ↔ 프론트 camelCase 변환 포함.
 * api() 함수는 자동으로 Bearer 토큰을 포함한다.
 */
import { api } from '../hooks/useApi';

const BASE = '/api/v1/doit';

/** 백엔드 응답(snake_case) → 프론트 Thought 객체(camelCase) */
export function fromApi(t) {
  return {
    id: t.id,
    text: t.text ?? '',
    category: t.category ?? null,
    createdAt: t.created_at,
    classifiedAt: t.classified_at ?? null,
    discardedAt: t.discarded_at ?? null,
    completedAt: t.completed_at ?? null,
    x: t.canvas_x ?? null,
    y: t.canvas_y ?? null,
    rotation: t.rotation ?? 0,
    color: t.color ?? null,
    width: t.card_width ?? null,
    height: t.card_height ?? null,
    scheduledDate: t.scheduled_date ?? null,
    scheduledTime: t.scheduled_time ?? null,
    scheduleNote: t.schedule_note ?? null,
    plannedDate: t.planned_date ?? null,
    description: t.description ?? null,
    nextAction: t.next_action ?? null,
    projectStatus: t.project_status ?? null,
    projectLinkId: t.project_link_id ?? null,
    noteBody: t.note_body ?? null,
    clarification: t.clarification ?? { actionable: null, decision: null, source: null },
    endOfDay: t.end_of_day ?? { ritualDate: null, action: null },
    waitingFor: t.waiting_for ?? null,
    somedayReason: t.someday_reason ?? null,
    urgency: t.urgency ?? null,
  };
}

/** 프론트 Thought 객체(camelCase) → 백엔드 요청(snake_case) */
function toApi(t) {
  return {
    id: t.id,
    text: t.text ?? '',
    category: t.category ?? null,
    created_at: t.createdAt,
    classified_at: t.classifiedAt ?? null,
    discarded_at: t.discardedAt ?? null,
    completed_at: t.completedAt ?? null,
    canvas_x: t.x ?? null,
    canvas_y: t.y ?? null,
    rotation: t.rotation ?? 0,
    color: t.color ?? null,
    card_width: t.width ?? null,
    card_height: t.height ?? null,
    scheduled_date: t.scheduledDate ?? null,
    scheduled_time: t.scheduledTime ?? null,
    schedule_note: t.scheduleNote ?? null,
    planned_date: t.plannedDate ?? null,
    description: t.description ?? null,
    next_action: t.nextAction ?? null,
    project_status: t.projectStatus ?? null,
    project_link_id: t.projectLinkId ?? null,
    note_body: t.noteBody ?? null,
    clarification: t.clarification ?? {},
    end_of_day: t.endOfDay ?? {},
    waiting_for: t.waitingFor ?? null,
    someday_reason: t.somedayReason ?? null,
    urgency: t.urgency ?? null,
  };
}

export async function doitFetchAll() {
  const res = await api(`${BASE}/thoughts`);
  if (!res.ok) throw new Error(`thoughts load failed: ${res.status}`);
  return (await res.json()).map(fromApi);
}

export async function doitCreate(thought) {
  const res = await api(`${BASE}/thoughts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApi(thought)),
  });
  if (!res.ok) throw new Error(`create failed: ${res.status}`);
  return fromApi(await res.json());
}

export async function doitUpdate(id, thought) {
  const res = await api(`${BASE}/thoughts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApi(thought)),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status}`);
  return fromApi(await res.json());
}

export async function doitDelete(id) {
  const res = await api(`${BASE}/thoughts/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`delete failed: ${res.status}`);
}

export async function doitBulkSync(thoughts) {
  const res = await api(`${BASE}/thoughts/bulk-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thoughts: thoughts.map(toApi) }),
  });
  if (!res.ok) throw new Error(`bulk-sync failed: ${res.status}`);
  return res.json();
}

export async function doitAiSummary() {
  const res = await api(`${BASE}/thoughts/ai-summary`);
  if (!res.ok) throw new Error(`ai-summary failed: ${res.status}`);
  return res.json();
}
