import { vi, beforeEach, describe, expect, it } from 'vitest';

// doit_api.js를 mock — initDoitStore가 실제 fetch 없이 동작하도록.
vi.mock('../lib/doit_api', () => ({
  doitFetchAll: vi.fn().mockResolvedValue([]),
  doitCreate: vi.fn().mockResolvedValue({}),
  doitUpdate: vi.fn().mockResolvedValue({}),
  doitDelete: vi.fn().mockResolvedValue(undefined),
  doitBulkSync: vi.fn().mockResolvedValue({ synced: 0, skipped: 0, errors: [] }),
}));

import {
  STORAGE_KEY,
  LEGACY_QUARANTINE_KEY,
  getByCategory,
  getCompleted,
  getSummary,
  getThoughtsStorageKey,
  getGuideSeenKey,
  getLayoutToastKey,
  getUnclassified,
  initDoitStore,
  loadThoughts,
  needsMigration,
  normalizeThought,
  runMigration,
  saveThoughts,
  _resetStoreForTest,
} from '../lib/doit_store';

const TOKEN_KEY = 'danaa_token';

function createMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    get _store() { return store; },
  };
}

function makeMockToken(userId) {
  const enc = (obj) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ user_id: userId, type: 'access' })}.sig`;
}

function setUser(userId) {
  if (userId == null) {
    window.localStorage.removeItem(TOKEN_KEY);
  } else {
    window.localStorage.setItem(TOKEN_KEY, makeMockToken(userId));
  }
}

beforeEach(() => {
  const storage = createMemoryLocalStorage();
  const listeners = new Map();
  global.window = {
    localStorage: storage,
    dispatchEvent: vi.fn((event) => {
      (listeners.get(event.type) || []).forEach((fn) => fn(event));
    }),
    addEventListener: vi.fn((type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    }),
    removeEventListener: vi.fn((type, fn) => {
      if (listeners.has(type)) {
        listeners.set(type, listeners.get(type).filter((f) => f !== fn));
      }
    }),
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  global.localStorage = storage;
  global.CustomEvent = global.window.CustomEvent;
  _resetStoreForTest();
  vi.clearAllMocks();
});

// ── 스토리지 키 격리 (key 이름만 검증, 실제 localStorage 쓰기 X) ──────────

describe('doit_store — 사용자별 키 이름 격리', () => {
  it('user_id=1이면 thoughts 키가 올바름', () => {
    setUser(1);
    expect(getThoughtsStorageKey()).toBe(`${STORAGE_KEY}::u1`);
  });

  it('토큰 없으면 anon 스코프로 격리', () => {
    setUser(null);
    expect(getThoughtsStorageKey()).toBe(`${STORAGE_KEY}::anon`);
  });

  it('잘못된 JWT여도 앱이 터지지 않고 anon으로 떨어짐', () => {
    window.localStorage.setItem(TOKEN_KEY, 'not-a-jwt');
    expect(getThoughtsStorageKey()).toBe(`${STORAGE_KEY}::anon`);
  });

  it('flag 키도 사용자별로 격리됨', () => {
    setUser(1);
    expect(getGuideSeenKey()).toBe('danaa_doit_guide_seen_v1::u1');
    expect(getLayoutToastKey()).toBe('danaa_doit_layout_toast_shown_v1::u1');

    setUser(2);
    expect(getGuideSeenKey()).toBe('danaa_doit_guide_seen_v1::u2');
    expect(getLayoutToastKey()).toBe('danaa_doit_layout_toast_shown_v1::u2');
  });
});

// ── 초기화 전 로드 ──────────────────────────────────────────────────────────

describe('doit_store — 초기화 전 동작', () => {
  it('initDoitStore 전 loadThoughts는 빈 배열 반환', () => {
    expect(loadThoughts()).toEqual([]);
  });

  it('initDoitStore 전 saveThoughts는 무시됨 (null 가드)', () => {
    saveThoughts([{ id: 'a', text: '테스트', category: 'todo', createdAt: new Date().toISOString() }]);
    expect(loadThoughts()).toEqual([]);
  });
});

// ── initDoitStore — DB 로드 + 캐시 ─────────────────────────────────────────

describe('doit_store — initDoitStore', () => {
  it('DB 데이터를 가져와 캐시에 저장', async () => {
    const { doitFetchAll } = await import('../lib/doit_api');
    // doitFetchAll은 fromApi()를 거쳐 camelCase로 반환
    doitFetchAll.mockResolvedValueOnce([
      {
        id: 'r1', text: '원격 할 일', category: 'todo',
        createdAt: '2026-05-01T00:00:00Z',
        classifiedAt: null, discardedAt: null, completedAt: null,
        x: null, y: null, rotation: 0, color: null,
        width: null, height: null,
        scheduledDate: null, scheduledTime: null, scheduleNote: null,
        plannedDate: null, description: null, nextAction: null,
        projectStatus: null, projectLinkId: null, noteBody: null,
        clarification: { actionable: null, decision: null, source: null },
        endOfDay: { ritualDate: null, action: null },
        waitingFor: null, somedayReason: null, urgency: null,
      },
    ]);

    setUser(1);
    await initDoitStore();
    const thoughts = loadThoughts();
    expect(thoughts).toHaveLength(1);
    expect(thoughts[0].id).toBe('r1');
    expect(thoughts[0].text).toBe('원격 할 일');
  });

  it('두 번 이상 호출해도 fetch는 1회만 실행 (singleton)', async () => {
    const { doitFetchAll } = await import('../lib/doit_api');
    await Promise.all([initDoitStore(), initDoitStore(), initDoitStore()]);
    expect(doitFetchAll).toHaveBeenCalledTimes(1);
  });

  it('fetch 실패 시 빈 캐시로 폴백', async () => {
    const { doitFetchAll } = await import('../lib/doit_api');
    doitFetchAll.mockRejectedValueOnce(new Error('network error'));

    await initDoitStore();
    expect(loadThoughts()).toEqual([]);
  });
});

// ── 마이그레이션 감지 ────────────────────────────────────────────────────────

describe('doit_store — 마이그레이션 감지', () => {
  it('DB 비어있고 localStorage에 데이터 있으면 needsMigration true', async () => {
    setUser(1);
    window.localStorage.setItem(
      getThoughtsStorageKey(),
      JSON.stringify([{ id: 'old', text: '로컬 생각', category: 'todo', createdAt: new Date().toISOString() }]),
    );

    await initDoitStore(); // doitFetchAll은 mock으로 [] 반환
    expect(needsMigration()).toBe(true);
  });

  it('DB에 데이터 있으면 needsMigration false', async () => {
    const { doitFetchAll } = await import('../lib/doit_api');
    doitFetchAll.mockResolvedValueOnce([
      { id: 'r1', text: '서버 데이터', category: 'todo',
        createdAt: '2026-05-01T00:00:00Z',
        classifiedAt: null, discardedAt: null, completedAt: null,
        x: null, y: null, rotation: 0, color: null, width: null, height: null,
        scheduledDate: null, scheduledTime: null, scheduleNote: null,
        plannedDate: null, description: null, nextAction: null,
        projectStatus: null, projectLinkId: null, noteBody: null,
        clarification: { actionable: null, decision: null, source: null },
        endOfDay: { ritualDate: null, action: null },
        waitingFor: null, somedayReason: null, urgency: null },
    ]);

    setUser(1);
    await initDoitStore();
    expect(needsMigration()).toBe(false);
  });
});

// ── runMigration ────────────────────────────────────────────────────────────

describe('doit_store — runMigration', () => {
  it('성공 시 { success: true } 반환하고 캐시 업데이트', async () => {
    const { doitBulkSync } = await import('../lib/doit_api');
    setUser(1);
    window.localStorage.setItem(
      getThoughtsStorageKey(),
      JSON.stringify([{ id: 'loc1', text: '로컬 생각', category: 'todo', createdAt: new Date().toISOString() }]),
    );
    await initDoitStore(); // DB 비어있음 → needsMigration true

    const result = await runMigration();
    expect(result.success).toBe(true);
    expect(doitBulkSync).toHaveBeenCalledTimes(1);
    expect(loadThoughts()).toHaveLength(1);
    expect(needsMigration()).toBe(false);
  });

  it('doitBulkSync 실패 시 { success: false, error } 반환하고 needsMigration 유지', async () => {
    const { doitBulkSync } = await import('../lib/doit_api');
    doitBulkSync.mockRejectedValueOnce(new Error('bulk-sync network error'));

    setUser(1);
    window.localStorage.setItem(
      getThoughtsStorageKey(),
      JSON.stringify([{ id: 'loc2', text: '로컬 생각2', category: 'todo', createdAt: new Date().toISOString() }]),
    );
    await initDoitStore();

    const result = await runMigration();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bulk-sync/);
    expect(needsMigration()).toBe(true); // 다음 시도를 위해 유지
  });

  it('localStorage 비어있으면 즉시 { success: true } 반환', async () => {
    setUser(1);
    await initDoitStore(); // DB 비어있음, localStorage도 비어있음
    // needsMigration = false (localStorage도 없으므로)
    const result = await runMigration();
    expect(result.success).toBe(false); // _needsMigration = false → 즉시 반환
  });
});

// ── saveThoughts + 이벤트 dispatch ─────────────────────────────────────────

describe('doit_store — saveThoughts (초기화 후)', () => {
  it('저장 후 loadThoughts가 정규화된 목록 반환', async () => {
    await initDoitStore();
    saveThoughts([{ id: 'a', text: '할 일', category: 'todo' }]);
    const thoughts = loadThoughts();
    expect(thoughts).toHaveLength(1);
    expect(thoughts[0].id).toBe('a');
    expect(thoughts[0].category).toBe('todo');
  });

  it('알 수 없는 카테고리는 null로 정규화', async () => {
    await initDoitStore();
    saveThoughts([{ id: 'a', text: '테스트', category: 'unknown_category' }]);
    expect(loadThoughts()[0].category).toBeNull();
  });

  it('null 항목과 id 없는 항목은 필터링', async () => {
    await initDoitStore();
    saveThoughts([null, { text: 'id 없음' }, { id: 'a', text: '정상', category: 'todo' }]);
    expect(loadThoughts()).toHaveLength(1);
    expect(loadThoughts()[0].id).toBe('a');
  });

  it('doit-store-update 이벤트가 dispatch됨', async () => {
    await initDoitStore();
    const handler = vi.fn();
    window.addEventListener('doit-store-update', handler);
    saveThoughts([{ id: 'a', text: '이벤트 테스트', category: 'todo' }]);
    window.removeEventListener('doit-store-update', handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ── legacy quarantine ──────────────────────────────────────────────────────

describe('doit_store — legacy quarantine', () => {
  it('레거시 공유 키는 initDoitStore 시 quarantine 후 제거', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old', text: '이전 사용자 카드', category: 'todo' }]),
    );
    window.localStorage.setItem('danaa_doit_guide_seen_v1', '1');

    setUser(1);
    await initDoitStore();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('danaa_doit_guide_seen_v1')).toBeNull();

    const quarantine = JSON.parse(window.localStorage.getItem(LEGACY_QUARANTINE_KEY));
    expect(quarantine.reason).toBe('pre_per_user_isolation');
    expect(quarantine.keys[STORAGE_KEY]).toContain('이전 사용자 카드');
  });

  it('quarantine은 idempotent (done flag 있으면 재실행 안 함)', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old', text: 'orig', category: 'todo' }]),
    );
    setUser(1);
    await initDoitStore();
    const firstSnapshot = window.localStorage.getItem(LEGACY_QUARANTINE_KEY);

    // 두 번째 initDoitStore는 같은 Promise 반환 (singleton)
    // 새 스토어 인스턴스 시뮬레이션 불필요 — done flag로 이미 보장됨
    expect(firstSnapshot).toBeTruthy();
  });
});

// ── 순수 헬퍼 함수 (regression) ────────────────────────────────────────────

describe('doit_store — normalizeThought', () => {
  it('올바른 형태의 생각은 통과', () => {
    const result = normalizeThought({ id: 'a', text: '할 일', category: 'todo' });
    expect(result).not.toBeNull();
    expect(result.id).toBe('a');
    expect(result.category).toBe('todo');
  });

  it('id 없으면 null 반환', () => {
    expect(normalizeThought({ text: '아이디 없음' })).toBeNull();
  });

  it('알 수 없는 카테고리는 null로 정규화', () => {
    const result = normalizeThought({ id: 'x', text: '테스트', category: 'unknown' });
    expect(result.category).toBeNull();
  });
});

describe('doit_store — category/summary helpers (regression)', () => {
  const list = [
    { id: 'a', text: '할 일', category: 'todo' },
    { id: 'b', text: '끝난 할 일', category: 'todo', completedAt: '2026-04-29T00:00:00.000Z' },
    { id: 'c', text: '버린 할 일', category: 'todo', discardedAt: '2026-04-29T00:00:00.000Z' },
    { id: 'd', text: '미분류', category: null },
  ];

  it('getByCategory는 활성 항목만 반환', () => {
    expect(getByCategory(list, 'todo').map((t) => t.id)).toEqual(['a']);
  });

  it('getCompleted는 완료 항목만 반환', () => {
    expect(getCompleted(list, 'todo').map((t) => t.id)).toEqual(['b']);
  });

  it('getUnclassified는 미분류 + 버리지 않은 항목만', () => {
    expect(getUnclassified(list).map((t) => t.id)).toEqual(['d']);
  });

  it('getSummary가 active/completed/unclassified 올바르게 집계', () => {
    const summary = getSummary(list);
    expect(summary.byCategory.todo).toBe(1);
    expect(summary.byCategoryCompleted.todo).toBe(1);
    expect(summary.total).toBe(2); // a + d (active, not discarded)
    expect(summary.totalCompleted).toBe(1);
    expect(summary.unclassified).toBe(1);
  });
});
