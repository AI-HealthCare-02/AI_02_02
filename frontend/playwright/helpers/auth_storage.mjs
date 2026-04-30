// Playwright spec용 헬퍼 — mock JWT + 사용자별 storage key 생성.
// 단위 테스트(__tests__/doit_store.test.js)의 makeMockToken과 동일한 형식.

const TOKEN_KEY = 'danaa_token';
const STORAGE_KEY = 'danaa_doit_thoughts_v1';

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** 테스트용 JWT — 서명 검증 안 하므로 형식만 맞으면 됨. */
export function makeMockToken(userId) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ user_id: userId, type: 'access' });
  return `${header}.${payload}.fake-signature`;
}

/** 사용자별 thoughts storage key. */
export function thoughtsKey(userId) {
  return userId == null ? `${STORAGE_KEY}::anon` : `${STORAGE_KEY}::u${userId}`;
}

/** 사용자별 recovery backup key. */
export function recoveryBackupKey(userId) {
  const base = `${STORAGE_KEY}_recovery_backup_v1`;
  return userId == null ? `${base}::anon` : `${base}::u${userId}`;
}

/**
 * 페이지 로드 전 mock JWT 주입. 모든 page.goto 전에 호출해야 한다.
 * page.addInitScript는 매 navigation마다 실행되어 일관된 인증 상태 유지.
 */
export async function loginAs(page, userId) {
  const token = makeMockToken(userId);
  const ttKey = TOKEN_KEY;
  await page.addInitScript(
    ({ token, key }) => {
      window.localStorage.setItem(key, token);
    },
    { token, key: ttKey },
  );
}

export { TOKEN_KEY, STORAGE_KEY };
