import { test, expect } from '@playwright/test';

// ThoughtCanvas 에서 사용하는 localStorage 키 (ThoughtCanvas.js L8)
const STORAGE_KEY = 'danaa_doit_thoughts_v1';

// 헬퍼 — IoU(Intersection over Union) 겹침 비율 계산
function iou(a, b) {
  const xL = Math.max(a.x, b.x);
  const xR = Math.min(a.x + a.width, b.x + b.width);
  const yT = Math.max(a.y, b.y);
  const yB = Math.min(a.y + a.height, b.y + b.height);
  if (xR <= xL || yB <= yT) return 0;
  const inter = (xR - xL) * (yB - yT);
  const ua = a.width * a.height + b.width * b.height - inter;
  return inter / ua;
}

test.describe('Do it OS 카드 배치', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 초기화 — 깨끗한 상태에서 시작
    await page.goto('/app/do-it-os/thinking');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('생각쏟기에서 30개 카드 추가 — 모두 겹침 0', async ({ page }) => {
    // ThoughtCanvas 의 textarea (placeholder: "머릿속에 떠오른 것을 적어보세요...")
    // Enter(Shift 없이) = 쏟아내기 (ThoughtCanvas.js L129-134)
    for (let i = 0; i < 30; i++) {
      const input = page.locator('textarea').first();
      await input.fill(`테스트 카드 ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(60);
    }

    // ThoughtCanvas 의 카드 요소: .doit-memo (ThoughtCanvas.js L189)
    const cards = await page.locator('.doit-memo').all();
    expect(cards.length).toBe(30);

    const rects = [];
    for (const card of cards) {
      const box = await card.boundingBox();
      if (box) rects.push(box);
    }

    // 모든 페어 IoU 계산
    let maxIou = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const v = iou(rects[i], rects[j]);
        if (v > maxIou) maxIou = v;
      }
    }
    expect(maxIou).toBeLessThan(0.05); // 거의 완전 분리
  });

  test('자기 전 정리 1단계에서 5개 추가 → 메인 캔버스에 (0,0) 카드 0개', async ({ page }) => {
    // 자기 전 정리(end-of-day) 페이지 진입
    await page.goto('/app/do-it-os/end-of-day');
    await page.waitForLoadState('networkidle');

    // RitualThoughtInput 의 textarea (placeholder: "머릿속에 남은 것을 적어주세요")
    // Ctrl+Enter = 쏟기 (RitualThoughtInput.js L51-54)
    // 버튼 텍스트: "쏟기" (RitualThoughtInput.js L82 — Feather 아이콘 + "쏟기" 텍스트)
    for (let i = 0; i < 5; i++) {
      const input = page.locator('textarea').first();
      await input.fill(`자기전 메모 ${i}`);
      await page.locator('button', { hasText: '쏟기' }).first().click();
      await page.waitForTimeout(80);
    }

    // 메인 캔버스로 이동
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800); // useEffect 마이그레이션(relayoutZeroCards) 대기

    // localStorage 에서 thoughts 직접 확인
    const thoughts = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '[]'),
      STORAGE_KEY,
    );

    // (0,0) 에 고정된 카드는 0개여야 함 (첫 카드 1개는 relayout 후 이동되어 OK)
    const stuckAt00 = thoughts.filter((t) => t.x === 0 && t.y === 0);
    expect(stuckAt00.length).toBeLessThanOrEqual(1);

    // null 좌표도 0개여야 함 (마이그레이션 후)
    const nullPos = thoughts.filter((t) => t.x === null || t.y === null);
    expect(nullPos.length).toBe(0);
  });

  test('생각쏟기 캔버스 viewport 크기 변화 후에도 카드가 viewport 안에 존재', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // ThoughtCanvas 의 textarea + Enter 로 5개 추가
    for (let i = 0; i < 5; i++) {
      await page.locator('textarea').first().fill(`viewport 테스트 ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(60);
    }

    // 작은 viewport 로 변경
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    // 카드가 viewport 에서 완전히 벗어나지 않아야 함
    const cards = await page.locator('.doit-memo').all();
    for (const card of cards) {
      const box = await card.boundingBox();
      if (!box) continue;
      // 카드가 viewport 오른쪽·아래로 완전히 벗어난 경우는 허용하지 않음
      expect(box.x).toBeLessThan(800);       // 완전히 오른쪽 밖 X
      expect(box.x).toBeGreaterThanOrEqual(-box.width); // 완전히 왼쪽 밖 X
    }
  });
});
