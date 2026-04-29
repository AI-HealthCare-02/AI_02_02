/**
 * Phase B3 — localStorage 마이그레이션 안정성 시뮬레이션
 * (0,0) 누적 데이터를 가진 v1 사용자가 thinking 페이지 진입 시
 * 자동 재배치가 발동하고 새로고침 후에도 유지되는지 확인.
 */

import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'danaa_doit_thoughts_v1';
const MIGRATION_FLAG = 'danaa_doit_layout_migrated_v1';

/** (0,0) 카드 N개를 localStorage에 강제 주입 */
function makeStuckCards(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `stuck-${i}`,
    text: `테스트 메모 ${i + 1}`,
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
    category: null,
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    rotation: 0,
    color: 'cream',
  }));
}

test.describe('Phase B3: 마이그레이션 안정성', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 초기화
    await page.goto('http://localhost:3002/app/do-it-os/thinking');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.evaluate((key) => localStorage.removeItem(key), MIGRATION_FLAG);
  });

  test('(0,0) 카드 5개 → thinking 진입 → 재배치 확인', async ({ page }) => {
    // 1. (0,0) 카드 5개 강제 주입
    const stuckCards = makeStuckCards(5);
    await page.evaluate(
      ({ key, cards }) => localStorage.setItem(key, JSON.stringify(cards)),
      { key: STORAGE_KEY, cards: stuckCards },
    );

    // 2. thinking 페이지 진입 (캔버스 크기 확정 + useEffect 대기)
    await page.reload();
    await page.waitForTimeout(1500); // canvasSize useEffect + relayoutZeroCards 완료 대기

    // 3. localStorage 다시 읽기 → (0,0) 카드가 0개여야 함
    const afterMigration = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    }, STORAGE_KEY);

    const stuckAfter = afterMigration.filter(
      (t) => t.x === 0 && t.y === 0 && afterMigration.length > 1,
    );
    expect(stuckAfter.length).toBe(0);

    // 4. 새로고침 후에도 정상 위치 유지 확인
    await page.reload();
    await page.waitForTimeout(800);

    const afterReload = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    }, STORAGE_KEY);

    const stuckAfterReload = afterReload.filter(
      (t) => t.x === 0 && t.y === 0 && afterReload.length > 1,
    );
    expect(stuckAfterReload.length).toBe(0);

    // 5. 모든 카드가 양수 좌표를 가지는지 확인
    for (const card of afterReload) {
      expect(typeof card.x).toBe('number');
      expect(typeof card.y).toBe('number');
      expect(card.x).toBeGreaterThan(0);
      expect(card.y).toBeGreaterThan(0);
    }
  });

  test('카드가 1개일 때 (0,0) 유지 허용 — 단일 카드 예외', async ({ page }) => {
    // ThoughtCanvas는 all.length > 1 조건에서만 0,0을 stuck으로 봄
    const singleCard = makeStuckCards(1);
    await page.evaluate(
      ({ key, cards }) => localStorage.setItem(key, JSON.stringify(cards)),
      { key: STORAGE_KEY, cards: singleCard },
    );

    await page.reload();
    await page.waitForTimeout(1500);

    const after = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    }, STORAGE_KEY);

    // 카드 1개면 재배치 스킵 (stuckCount === 0 으로 판정) → 그냥 통과
    expect(after.length).toBe(1);
  });

  test('null/NaN 좌표 카드도 재배치됨', async ({ page }) => {
    const nanCards = [
      { id: 'nan-1', text: 'null 좌표', createdAt: new Date().toISOString(), category: null, x: null, y: null, width: 200, height: 120, rotation: 0, color: 'mint' },
      { id: 'nan-2', text: 'NaN 좌표', createdAt: new Date().toISOString(), category: null, x: NaN, y: NaN, width: 200, height: 120, rotation: 0, color: 'stone' },
      { id: 'nan-3', text: '정상 카드', createdAt: new Date().toISOString(), category: null, x: 50, y: 50, width: 200, height: 120, rotation: 0, color: 'lavender' },
    ];
    await page.evaluate(
      ({ key, cards }) => localStorage.setItem(key, JSON.stringify(cards)),
      { key: STORAGE_KEY, cards: nanCards },
    );

    await page.reload();
    await page.waitForTimeout(1500);

    const after = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    }, STORAGE_KEY);

    // null/NaN → JSON 직렬화 후 null이 되므로 재배치 대상
    const stuck = after.filter(
      (t) => t.x === null || t.y === null || typeof t.x !== 'number',
    );
    expect(stuck.length).toBe(0);
  });
});
