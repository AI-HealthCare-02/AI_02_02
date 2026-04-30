import { beforeEach, describe, expect, it } from 'vitest';

// 주의: useApi.js의 DEV_TOKEN 단축 경로가 mock JWT를 우회하지 않도록
// vitest.config.mjs의 `test.env.NEXT_PUBLIC_AUTH_TOKEN = ''` 설정 필수.

import {
  STORAGE_KEY,
  STORAGE_RECOVERY_BACKUP_KEY,
  LEGACY_QUARANTINE_KEY,
  getByCategory,
  getCompleted,
  getSummary,
  getThoughtsStorageKey,
  getRecoveryBackupKey,
  getGuideSeenKey,
  getLayoutToastKey,
  getUnclassified,
  loadThoughts,
  saveThoughts,
} from '../lib/doit_store';

const TOKEN_KEY = 'danaa_token';

function createMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get _store() {
      return store;
    },
  };
}

/**
 * 테스트용 mock JWT 생성. payload에 user_id 박음.
 * 서명은 검증 안 하므로 형식만 맞으면 됨 (header.payload.sig).
 */
function makeMockToken(userId) {
  const enc = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_'); // base64url
  const header = enc({ alg: 'HS256', typ: 'JWT' });
  const payload = enc({ user_id: userId, type: 'access' });
  return `${header}.${payload}.fake-signature`;
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
  global.window = { localStorage: storage };
  // useApi.js는 bare localStorage 사용, doit_store.js는 window.localStorage 사용 → 동일 인스턴스로 통일
  global.localStorage = storage;
});

describe('doit_store — per-user storage key isolation', () => {
  it('user_id=1이면 저장 키가 `danaa_doit_thoughts_v1::u1`', () => {
    setUser(1);
    expect(getThoughtsStorageKey()).toBe(`${STORAGE_KEY}::u1`);
  });

  it('토큰 없으면 anon 스코프로 격리', () => {
    setUser(null);
    expect(getThoughtsStorageKey()).toBe(`${STORAGE_KEY}::anon`);
  });

  it('잘못된 JWT여도 앱이 터지지 않고 anon으로 떨어짐', () => {
    window.localStorage.setItem(TOKEN_KEY, 'this-is-not-a-jwt');
    expect(getThoughtsStorageKey()).toBe(`${STORAGE_KEY}::anon`);
    expect(loadThoughts()).toEqual([]);
  });

  it('user1 데이터가 user2 화면에 보이지 않음', () => {
    setUser(1);
    saveThoughts([{ id: 'a', text: 'user1 카드', category: 'todo' }]);
    expect(loadThoughts().map((t) => t.id)).toEqual(['a']);

    setUser(2);
    expect(loadThoughts()).toEqual([]);

    saveThoughts([{ id: 'b', text: 'user2 카드', category: 'note' }]);
    expect(loadThoughts().map((t) => t.id)).toEqual(['b']);

    setUser(1);
    expect(loadThoughts().map((t) => t.id)).toEqual(['a']);
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

describe('doit_store — legacy quarantine', () => {
  it('레거시 공유 키는 첫 loadThoughts 호출 시 quarantine + 제거', () => {
    // 수정 전 환경: 레거시 공유 키에 데이터 보유
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old', text: '이전 사용자 카드', category: 'todo' }]),
    );
    window.localStorage.setItem('danaa_doit_guide_seen_v1', '1');

    setUser(1);
    expect(loadThoughts()).toEqual([]); // 자동 귀속 X

    // 레거시 키들이 모두 제거되고 화면에 노출 안 됨
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('danaa_doit_guide_seen_v1')).toBeNull();

    // quarantine 백업에 원본 보존
    const quarantine = JSON.parse(
      window.localStorage.getItem(LEGACY_QUARANTINE_KEY),
    );
    expect(quarantine.reason).toBe('pre_per_user_isolation');
    expect(quarantine.keys[STORAGE_KEY]).toContain('이전 사용자 카드');
    expect(quarantine.keys.danaa_doit_guide_seen_v1).toBe('1');
  });

  it('레거시 공유 키가 화면 데이터로 읽히지 않음 (격리 후 user1·user2 모두 빈 상태)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'orphan', text: '주인 모를 데이터', category: 'todo' }]),
    );

    setUser(1);
    expect(loadThoughts()).toEqual([]);

    setUser(2);
    expect(loadThoughts()).toEqual([]);
  });

  it('quarantine은 idempotent (여러 번 호출해도 백업 덮어쓰지 않음)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old', text: 'orig', category: 'todo' }]),
    );

    setUser(1);
    loadThoughts(); // 1회차 quarantine
    const firstSnapshot = window.localStorage.getItem(LEGACY_QUARANTINE_KEY);

    // 새 데이터를 legacy 키에 강제로 다시 쓴다고 가정 (이론적으로는 발생 X)
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'new', text: 'tampered', category: 'todo' }]),
    );

    loadThoughts(); // 2회차 — 이미 done flag 있으므로 quarantine 스킵
    const secondSnapshot = window.localStorage.getItem(LEGACY_QUARANTINE_KEY);

    expect(secondSnapshot).toBe(firstSnapshot); // 첫 백업 유지
  });
});

describe('doit_store — recovery backup is per-user', () => {
  it('깨진 JSON은 빈 목록으로 읽고 사용자별 복구 백업에 남긴다', () => {
    setUser(1);
    window.localStorage.setItem(getThoughtsStorageKey(), '{bad-json');

    expect(loadThoughts()).toEqual([]);

    const backup = JSON.parse(
      window.localStorage.getItem(getRecoveryBackupKey()),
    );
    expect(backup.reason).toBe('parse_error');
    expect(backup.raw).toBe('{bad-json');
    expect(backup.sourceKey).toBe(getThoughtsStorageKey());
  });

  it('배열이 아닌 저장값은 복구 백업을 사용자별로 남긴다', () => {
    setUser(2);
    window.localStorage.setItem(
      getThoughtsStorageKey(),
      JSON.stringify({ id: 'wrong-shape' }),
    );

    expect(loadThoughts()).toEqual([]);

    const backup = JSON.parse(
      window.localStorage.getItem(getRecoveryBackupKey()),
    );
    expect(backup.reason).toBe('not_array');
    expect(backup.raw).toContain('wrong-shape');
  });

  it('잘못된 항목은 제거하고, 알 수 없는 카테고리는 미분류로 되돌린다', () => {
    setUser(1);
    window.localStorage.setItem(
      getThoughtsStorageKey(),
      JSON.stringify([
        null,
        { text: 'id가 없는 항목' },
        { id: 'a', text: '알 수 없는 분류', category: 'unknown' },
        { id: 'b', text: '버린 생각', category: null, discardedAt: '2026-04-29T00:00:00.000Z' },
        { id: 'c', text: '할 일', category: 'todo' },
      ]),
    );

    const thoughts = loadThoughts();

    expect(thoughts.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(thoughts.find((t) => t.id === 'a').category).toBeNull();
    expect(getUnclassified(thoughts).map((t) => t.id)).toEqual(['a']);
    expect(getByCategory(thoughts, 'todo').map((t) => t.id)).toEqual(['c']);
    expect(window.localStorage.getItem(getRecoveryBackupKey())).toBeTruthy();
  });

  it('저장할 때도 잘못된 항목은 사용자별 키에 정규화 후 쓴다', () => {
    setUser(1);
    saveThoughts([
      null,
      { id: 'a', text: 123, category: 'not-real' },
      { id: 'b', text: '정상 할 일', category: 'todo' },
    ]);

    const saved = JSON.parse(
      window.localStorage.getItem(getThoughtsStorageKey()),
    );

    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ id: 'a', text: '', category: null });
    expect(saved[1]).toMatchObject({ id: 'b', text: '정상 할 일', category: 'todo' });
  });
});

describe('doit_store — summary/category helpers (regression)', () => {
  it('완료된 항목은 활성 목록과 완료 목록으로 분리해서 계산한다', () => {
    const list = [
      { id: 'a', text: '아직 할 일', category: 'todo' },
      { id: 'b', text: '끝난 할 일', category: 'todo', completedAt: '2026-04-29T00:00:00.000Z' },
      { id: 'c', text: '버린 할 일', category: 'todo', discardedAt: '2026-04-29T00:00:00.000Z' },
    ];

    expect(getByCategory(list, 'todo').map((t) => t.id)).toEqual(['a']);
    expect(getCompleted(list, 'todo').map((t) => t.id)).toEqual(['b']);

    const summary = getSummary(list);
    expect(summary.byCategory.todo).toBe(1);
    expect(summary.byCategoryCompleted.todo).toBe(1);
    expect(summary.total).toBe(1);
    expect(summary.totalCompleted).toBe(1);
  });
});
