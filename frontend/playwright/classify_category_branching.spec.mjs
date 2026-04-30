import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'danaa_doit_thoughts_v1';

function makeSeed() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayIso = `${yyyy}-${mm}-${dd}`;
  return [
    // 분류 대상 미분류 카드 (todo 시나리오용)
    {
      id: 't-todo-1',
      text: '코드 리뷰 끝내기',
      createdAt: '2026-04-30T09:00:00.000Z',
      category: null,
      x: 100, y: 100, width: 200, height: 80, rotation: 0, color: null,
    },
    // schedule 시나리오용
    {
      id: 't-schedule-1',
      text: '거래처 점심 미팅',
      createdAt: '2026-04-30T08:00:00.000Z',
      category: null,
      x: 110, y: 110, width: 200, height: 80, rotation: 0, color: null,
    },
    // project 시나리오용 (신규)
    {
      id: 't-project-new-1',
      text: '블로그 리뉴얼',
      createdAt: '2026-04-30T07:30:00.000Z',
      category: null,
      x: 120, y: 120, width: 200, height: 80, rotation: 0, color: null,
    },
    // project 시나리오용 (기존 연결)
    {
      id: 't-project-existing-1',
      text: '신규 포스트 카피 작성',
      createdAt: '2026-04-30T07:00:00.000Z',
      category: null,
      x: 130, y: 130, width: 200, height: 80, rotation: 0, color: null,
    },
    // 이미 존재하는 프로젝트 (기존 연결 후보)
    {
      id: 'p-existing-1',
      text: '모바일 앱 v2',
      createdAt: '2026-04-25T09:00:00.000Z',
      classifiedAt: '2026-04-25T10:00:00.000Z',
      category: 'project',
      x: null, y: null, width: null, height: null, rotation: 0, color: null,
    },
  ];
}

async function gotoClassify(page) {
  await page.goto('/app/do-it-os/classify');
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    ({ key, seed }) => { localStorage.setItem(key, JSON.stringify(seed)); },
    { key: STORAGE_KEY, seed: makeSeed() },
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('정리 명료화 카테고리별 분기', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/do-it-os/classify');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  });

  test('todo 칩 → 게이트 워딩 "실행 가능?" → Yes → TwoMinuteHint → 저장', async ({ page }) => {
    await gotoClassify(page);

    // 미분류 카드 "코드 리뷰 끝내기" 우측의 "할 일" 칩 클릭
    const card = page.locator('li.doit-classify-row').filter({ hasText: '코드 리뷰 끝내기' });
    await card.locator('button', { hasText: '할 일' }).first().click();

    // 게이트 워딩 — todo default
    await expect(page.getByText('실행할 수 있는 일인가요?')).toBeVisible();
    await page.locator('button', { hasText: '예, 실행할 수 있어요' }).click();

    // category_input — TwoMinuteHint 텍스트
    await expect(page.getByText('2분 안에 끝날')).toBeVisible();

    await page.locator('button', { hasText: '저장' }).click();
    await page.waitForTimeout(400);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEY);
    const card1 = stored.find((t) => t.id === 't-todo-1');
    expect(card1.category).toBe('todo');
  });

  test('schedule 칩 → 게이트 워딩 "날짜·시간 정해진 일?" → Yes → 메모 입력 → 저장 → scheduleNote 보존', async ({ page }) => {
    await gotoClassify(page);

    const card = page.locator('li.doit-classify-row').filter({ hasText: '거래처 점심 미팅' });
    await card.locator('button', { hasText: '일정' }).first().click();

    await expect(page.getByText('날짜·시간이 정해진 일인가요?')).toBeVisible();
    await page.locator('button', { hasText: '예, 일정으로 잡을게요' }).click();

    // 메모 입력
    const noteInput = page.locator('[data-testid="schedule-note-input"]');
    await expect(noteInput).toBeVisible();
    await noteInput.fill('자료 챙겨가기');

    await page.locator('button', { hasText: '저장' }).click();
    await page.waitForTimeout(400);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEY);
    const c = stored.find((t) => t.id === 't-schedule-1');
    expect(c.category).toBe('schedule');
    expect(c.scheduleNote).toBe('자료 챙겨가기');
    expect(c.scheduledDate).toBeTruthy();
  });

  test('project 칩 → 게이트 워딩 "프로젝트 단위?" → Yes → 신규 모드 default → 저장 → category=project', async ({ page }) => {
    await gotoClassify(page);

    const card = page.locator('li.doit-classify-row').filter({ hasText: '블로그 리뉴얼' });
    await card.locator('button', { hasText: '프로젝트' }).first().click();

    await expect(page.getByText('여러 단계가 필요한 프로젝트 단위 일인가요?')).toBeVisible();
    await page.locator('button', { hasText: '예, 프로젝트로 다룰게요' }).click();

    // ProjectPickerInline — 기존 프로젝트 1개 있으므로 토글 노출, default = new
    await expect(page.locator('[data-testid="project-picker-mode-new"]')).toBeChecked();

    await page.locator('button', { hasText: '저장' }).click();
    await page.waitForTimeout(400);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEY);
    const c = stored.find((t) => t.id === 't-project-new-1');
    expect(c.category).toBe('project');
    expect(c.projectLinkId).toBeNull();
  });

  test('project 칩 → 기존 프로젝트 선택 → 카드=todo + projectLinkId', async ({ page }) => {
    await gotoClassify(page);

    const card = page.locator('li.doit-classify-row').filter({ hasText: '신규 포스트 카피 작성' });
    await card.locator('button', { hasText: '프로젝트' }).first().click();

    await page.locator('button', { hasText: '예, 프로젝트로 다룰게요' }).click();

    // 기존 모드 토글
    await page.locator('[data-testid="project-picker-mode-existing"]').check();

    // 기존 프로젝트 라디오 선택 (p-existing-1 = "모바일 앱 v2")
    await page.locator('[data-testid="project-picker-option-p-existing-1"]').check();

    await page.locator('button', { hasText: '저장' }).click();
    await page.waitForTimeout(400);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEY);
    const c = stored.find((t) => t.id === 't-project-existing-1');
    expect(c.category).toBe('todo');
    expect(c.projectLinkId).toBe('p-existing-1');
  });
});
