/**
 * 다중 계정 격리 검증 — fix/doit-os-localstorage 핵심 시나리오.
 *
 * 같은 브라우저(localStorage)에서 user_id 가 바뀌어도 Do it OS 데이터가
 * 섞이지 않는지 검증. 카카오 ↔ 구글 계정 전환 시나리오 모방.
 */

import { test, expect } from '@playwright/test';
import {
  loginAs,
  thoughtsKey,
  recoveryBackupKey,
  TOKEN_KEY,
  STORAGE_KEY as LEGACY_STORAGE_KEY,
} from './helpers/auth_storage.mjs';

/** localStorage에 있는 raw thoughts 배열 읽기. */
async function readThoughts(page, userId) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, thoughtsKey(userId));
}

/** localStorage에 thoughts 배열 강제 주입 (테스트 setup 용). */
async function writeThoughts(page, userId, thoughts) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: thoughtsKey(userId), value: thoughts },
  );
}

const SAMPLE = (label) => ({
  id: `sample-${label}`,
  text: `${label} 카드`,
  createdAt: new Date().toISOString(),
  category: 'todo',
  x: 50,
  y: 50,
  width: 200,
  height: 120,
  rotation: 0,
  color: 'cream',
});

test.describe('다중 계정 격리', () => {
  test('user1과 user2의 thoughts는 완전히 분리되어 보임', async ({ page }) => {
    // user1로 로그인 → 카드 1개 추가
    await loginAs(page, 1);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await writeThoughts(page, 1, [SAMPLE('user1')]);

    // 검증: user1의 키에 데이터 있음
    const u1Data = await readThoughts(page, 1);
    expect(u1Data.length).toBe(1);
    expect(u1Data[0].id).toBe('sample-user1');

    // 검증: user2의 키에는 데이터 없음 (격리 ✅)
    const u2Empty = await readThoughts(page, 2);
    expect(u2Empty).toEqual([]);

    // 검증: 레거시 공유 키에도 데이터 없음 (격리 후 화면에 노출 X)
    const legacyData = await page.evaluate(
      (k) => localStorage.getItem(k),
      LEGACY_STORAGE_KEY,
    );
    expect(legacyData).toBeNull();
  });

  test('user2 로그인 후에도 user1의 카드가 보이지 않음', async ({ page }) => {
    // user1으로 카드 추가
    await loginAs(page, 1);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await writeThoughts(page, 1, [SAMPLE('user1-only')]);

    // user2로 전환 (토큰 교체 → 같은 브라우저, 다른 계정 시뮬)
    await page.evaluate(
      ({ key }) => localStorage.removeItem(key),
      { key: TOKEN_KEY },
    );
    await loginAs(page, 2);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // user2 화면에는 빈 캔버스 — DOM에 카드 0개
    const cards = await page.locator('.doit-memo').count();
    expect(cards).toBe(0);

    // user1의 데이터는 자기 키에 그대로 영속
    const u1DataPersisted = await readThoughts(page, 1);
    expect(u1DataPersisted.length).toBe(1);
    expect(u1DataPersisted[0].id).toBe('sample-user1-only');
  });

  test('레거시 공유 키 데이터는 quarantine으로 옮겨지고 어떤 계정에도 자동 귀속하지 않음', async ({ page }) => {
    // 수정 전 환경 시뮬: 레거시 공유 키에 데이터 보유
    await loginAs(page, 1);
    await page.goto('/app/do-it-os/thinking');
    await page.evaluate(
      ({ key, raw }) => localStorage.setItem(key, raw),
      {
        key: LEGACY_STORAGE_KEY,
        raw: JSON.stringify([SAMPLE('legacy-orphan')]),
      },
    );

    // 페이지 reload — loadThoughts 첫 호출 시 ensureLegacyQuarantined 발동
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // user1 키에 자동 귀속되지 않음
    const u1Data = await readThoughts(page, 1);
    expect(u1Data).toEqual([]);

    // 레거시 공유 키는 제거됨
    const legacyAfter = await page.evaluate(
      (k) => localStorage.getItem(k),
      LEGACY_STORAGE_KEY,
    );
    expect(legacyAfter).toBeNull();

    // quarantine 백업 키에 보관됨
    const quarantineRaw = await page.evaluate(
      () => localStorage.getItem('danaa_doit_thoughts_v1_legacy_quarantine_v1'),
    );
    expect(quarantineRaw).toBeTruthy();
    const quarantine = JSON.parse(quarantineRaw);
    expect(quarantine.reason).toBe('pre_per_user_isolation');
    expect(quarantine.keys[LEGACY_STORAGE_KEY]).toContain('legacy-orphan');
  });

  test('user2가 카드 추가 후 user1으로 복귀해도 user1 카드만 보임 (reverse 시나리오)', async ({ page }) => {
    // user1으로 카드 1개 추가
    await loginAs(page, 1);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await writeThoughts(page, 1, [SAMPLE('user1-original')]);

    // user2로 전환 → 카드 다른 거 추가
    await page.evaluate(({ key }) => localStorage.removeItem(key), { key: TOKEN_KEY });
    await loginAs(page, 2);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await writeThoughts(page, 2, [SAMPLE('user2-different')]);

    // user1로 복귀
    await page.evaluate(({ key }) => localStorage.removeItem(key), { key: TOKEN_KEY });
    await loginAs(page, 1);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // user1 키에는 자기 데이터만 (user2 데이터 안 섞임)
    const u1Final = await readThoughts(page, 1);
    expect(u1Final.length).toBe(1);
    expect(u1Final[0].id).toBe('sample-user1-original');

    // user2 키에는 user2 데이터 그대로 (영속·격리)
    const u2Final = await readThoughts(page, 2);
    expect(u2Final.length).toBe(1);
    expect(u2Final[0].id).toBe('sample-user2-different');
  });

  test('layout toast flag도 사용자별로 격리됨', async ({ page }) => {
    // user1 layout toast 본 표시
    await loginAs(page, 1);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('danaa_doit_layout_toast_shown_v1::u1', '1');
    });

    // user2로 전환
    await page.evaluate(({ key }) => localStorage.removeItem(key), { key: TOKEN_KEY });
    await loginAs(page, 2);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');

    // user2의 layout toast flag는 별도로 비어있음
    const u2Toast = await page.evaluate(() =>
      localStorage.getItem('danaa_doit_layout_toast_shown_v1::u2'),
    );
    expect(u2Toast).toBeNull();

    // user1의 flag는 그대로
    const u1Toast = await page.evaluate(() =>
      localStorage.getItem('danaa_doit_layout_toast_shown_v1::u1'),
    );
    expect(u1Toast).toBe('1');
  });

  test('가이드 본 적 flag도 사용자별로 격리됨', async ({ page }) => {
    // user1 가이드 본 표시
    await loginAs(page, 1);
    await page.goto('/app/do-it-os');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.setItem('danaa_doit_guide_seen_v1::u1', '1');
    });

    // user2로 전환
    await page.evaluate(
      ({ key }) => localStorage.removeItem(key),
      { key: TOKEN_KEY },
    );
    await loginAs(page, 2);
    await page.goto('/app/do-it-os');
    await page.waitForLoadState('networkidle');

    // user2의 guide_seen flag는 별도로 비어있음
    const u2GuideSeen = await page.evaluate(
      () => localStorage.getItem('danaa_doit_guide_seen_v1::u2'),
    );
    expect(u2GuideSeen).toBeNull();

    // user1의 flag는 그대로 유지
    const u1GuideSeen = await page.evaluate(
      () => localStorage.getItem('danaa_doit_guide_seen_v1::u1'),
    );
    expect(u1GuideSeen).toBe('1');
  });

  test('토큰 없으면 anon 스코프로 떨어지고 user1 데이터와 섞이지 않음', async ({ page }) => {
    // user1 카드 저장
    await loginAs(page, 1);
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await writeThoughts(page, 1, [SAMPLE('user1-private')]);

    // 토큰 제거 (로그아웃 상태)
    await page.evaluate(
      ({ key }) => localStorage.removeItem(key),
      { key: TOKEN_KEY },
    );
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // 익명 스코프 키에 데이터 없음 (anon은 자기 키만 봄)
    const anonData = await page.evaluate(
      (k) => localStorage.getItem(k),
      thoughtsKey(null),
    );
    expect(anonData).toBeNull();

    // 화면에도 카드 0개
    const cards = await page.locator('.doit-memo').count();
    expect(cards).toBe(0);

    // user1 데이터는 보존 (격리)
    const u1DataPersisted = await readThoughts(page, 1);
    expect(u1DataPersisted.length).toBe(1);
  });
});
