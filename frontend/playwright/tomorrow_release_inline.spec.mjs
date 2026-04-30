import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'danaa_doit_thoughts_v1';

function makeSeed() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayIso = `${yyyy}-${mm}-${dd}`;
  return [
    {
      id: 't-seed-unclassified-1',
      text: '최종 프로젝트 마무리',
      createdAt: '2026-04-30T09:00:00.000Z',
      category: null,
      x: 100, y: 100, width: 200, height: 80, rotation: 0, color: null,
    },
    {
      id: 't-seed-schedule-1',
      text: '거래처 점심 미팅',
      createdAt: '2026-04-30T08:00:00.000Z',
      category: 'schedule',
      scheduledDate: todayIso,
      scheduledTime: '12:30',
      x: null, y: null, width: null, height: null, rotation: 0, color: null,
    },
  ];
}

async function gotoStep2(page) {
  await page.goto('/app/do-it-os/end-of-day');
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    ({ key, seed }) => { localStorage.setItem(key, JSON.stringify(seed)); },
    { key: STORAGE_KEY, seed: makeSeed() },
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('button', { hasText: '다음 · 내일 고르기' }).click();
  await page.waitForTimeout(200);
}

test.describe('내일 하기 자이가르닉 입력 (TomorrowReleaseInline)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/do-it-os/end-of-day');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  });

  test('미분류 row: 체크 → expand → 음각 ghost 한 줄("{원본}, 이거는 내일 하자") + 빈 input', async ({
    page,
  }) => {
    await gotoStep2(page);

    const expandLocator = page.locator(
      '[data-testid="tomorrow-release-inline-t-seed-unclassified-1"]',
    );
    await expect(expandLocator).toHaveCount(0);

    await page.locator('label', { hasText: '내일 하기' }).first().click();
    await expect(expandLocator).toBeVisible();

    // input 은 빈 상태 (음각은 textarea value 가 아니므로 인식되지 않음)
    const input = expandLocator.locator('[data-testid="tomorrow-release-input"]');
    await expect(input).toHaveValue('');

    // ghost overlay 한 줄로 합쳐진 텍스트
    const ghost = expandLocator.locator('[data-testid="tomorrow-release-ghost"]');
    await expect(ghost).toHaveText('최종 프로젝트 마무리, 이거는 내일 하자');
    await expect(expandLocator.getByText('💬 말하면서 따라 타이핑해 보세요')).toBeVisible();

    // ghost 의 첫 0글자가 invisible (입력 전)
    const invisibleLen = await ghost.evaluate((p) => p.querySelector('span').textContent.length);
    expect(invisibleLen).toBe(0);

    // 사용자 selection 가능
    const userSelect = await input.evaluate((el) => getComputedStyle(el).userSelect);
    expect(userSelect).not.toBe('none');
  });

  test('따라 타이핑: 입력 길이만큼 ghost prefix 차례로 invisible', async ({ page }) => {
    await gotoStep2(page);

    const expandLocator = page.locator(
      '[data-testid="tomorrow-release-inline-t-seed-unclassified-1"]',
    );
    await page.locator('label', { hasText: '내일 하기' }).first().click();
    await expect(expandLocator).toBeVisible();

    const input = expandLocator.locator('[data-testid="tomorrow-release-input"]');
    const ghost = expandLocator.locator('[data-testid="tomorrow-release-ghost"]');

    // 4글자 입력 → ghost 의 invisible span 이 4글자가 되어야 함
    await input.focus();
    await input.fill('내일은');
    expect(await input.inputValue()).toBe('내일은');
    const invLen3 = await ghost.evaluate((p) => p.querySelector('span').textContent.length);
    expect(invLen3).toBe(3);

    // 5글자(공백 포함)로 늘리면 invisible 도 5글자
    await input.fill('내일 일찍');
    const invLen5 = await ghost.evaluate((p) => p.querySelector('span').textContent.length);
    expect(invLen5).toBe(5);

    // 다 지우면 invisible 0
    await input.fill('');
    const invLen0 = await ghost.evaluate((p) => p.querySelector('span').textContent.length);
    expect(invLen0).toBe(0);
  });

  test('Enter 로 완료 → 닫힘 + 체크 유지', async ({ page }) => {
    await gotoStep2(page);

    const expandLocator = page.locator(
      '[data-testid="tomorrow-release-inline-t-seed-unclassified-1"]',
    );
    await page.locator('label', { hasText: '내일 하기' }).first().click();
    await expect(expandLocator).toBeVisible();

    const input = expandLocator.locator('[data-testid="tomorrow-release-input"]');
    await input.focus();
    await input.fill('내일 마저 마무리');
    await input.press('Enter');

    await expect(expandLocator).toHaveCount(0);
    await expect(
      page.locator('button', { hasText: '다음 · 버리기/보관 (1)' }),
    ).toBeVisible();
  });

  test('일정 row: 건너뛰기 흐름', async ({ page }) => {
    await gotoStep2(page);

    const expandLocator = page.locator(
      '[data-testid="tomorrow-release-inline-t-seed-schedule-1"]',
    );
    await page.locator('label', { hasText: '내일로' }).first().click();
    await expect(expandLocator).toBeVisible();

    await expect(
      expandLocator.locator('[data-testid="tomorrow-release-ghost"]'),
    ).toHaveText('거래처 점심 미팅, 이거는 내일 하자');

    await expandLocator.locator('button', { hasText: '건너뛰기' }).click();
    await expect(expandLocator).toHaveCount(0);
    await expect(
      page.locator('button', { hasText: '다음 · 버리기/보관 (1)' }),
    ).toBeVisible();
  });

  test('체크 재클릭: expand 닫힘 + 체크 해제 (기존 단순 흐름 보존)', async ({ page }) => {
    await gotoStep2(page);

    const expandLocator = page.locator(
      '[data-testid="tomorrow-release-inline-t-seed-unclassified-1"]',
    );
    const tomorrowLabel = page.locator('label', { hasText: '내일 하기' }).first();

    await tomorrowLabel.click();
    await expect(expandLocator).toBeVisible();

    await tomorrowLabel.click();
    await expect(expandLocator).toHaveCount(0);
    await expect(
      page.locator('button', { hasText: '다음 · 버리기/보관 (0)' }),
    ).toBeDisabled();
  });
});
