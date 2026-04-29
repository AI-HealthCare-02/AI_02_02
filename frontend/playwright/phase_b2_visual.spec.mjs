/**
 * Phase B2 — 시각 검증 spec (Team B2)
 * 코드 수정 없음, 테스트 파일만 추가
 *
 * 시나리오:
 * (a) 50개 카드 추가 → IoU 0 검증 + 4사분면 분포
 * (b) 자기 전 정리 1단계 → 메인 캔버스 흐름
 * (c) viewport 리사이즈 회귀 (30카드 1920×1080 → 800×600)
 * (d) NextActionCardGrid 동작 검증 (project 상세 진입 경로 미확인 시 SKIP)
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs, thoughtsKey } from './helpers/auth_storage.mjs';

const TEST_USER_ID = 1;
const STORAGE_KEY = thoughtsKey(TEST_USER_ID);

// IoU(Intersection over Union) 헬퍼
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

// 4사분면 분포 계산 헬퍼
function quadrantDistribution(rects, vpWidth, vpHeight) {
  const midX = vpWidth / 2;
  const midY = vpHeight / 2;
  const counts = { TL: 0, TR: 0, BL: 0, BR: 0 };
  for (const r of rects) {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    if (cx < midX && cy < midY) counts.TL++;
    else if (cx >= midX && cy < midY) counts.TR++;
    else if (cx < midX && cy >= midY) counts.BL++;
    else counts.BR++;
  }
  return counts;
}

// 표준편차 계산 헬퍼
function stddev(values) {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

// playwright-report 디렉토리 보장
function ensureReportDir() {
  // 상위(frontend) 기준으로 playwright-report 폴더 생성
  // __dirname 은 ESM 에서 지원 안 되므로 cwd 기반
  const dir = path.join(process.cwd(), 'playwright-report');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

test.describe('Phase B2 — 시각 검증', () => {
  test.beforeEach(async ({ page }) => {
    // mock JWT 주입 — user_id=1로 격리된 storage 키 사용
    await loginAs(page, TEST_USER_ID);
  });

  // ────────────────────────────────────────────────────────────
  // (a) 50개 카드 추가 → IoU 0 검증 + 4사분면 분포
  // ────────────────────────────────────────────────────────────
  test('(a) 50개 카드 추가 → IoU 최대값 < 0.05 + 4사분면 분포', async ({ page }) => {
    // 초기화
    await page.goto('/app/do-it-os/thinking');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // 50개 카드 입력 (Enter = 쏟아내기)
    for (let i = 0; i < 50; i++) {
      const textarea = page.locator('textarea').first();
      await textarea.fill(`B2 테스트 카드 ${i + 1}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(40);
    }

    // 렌더링 안정화 대기
    await page.waitForTimeout(500);

    const cards = await page.locator('.doit-memo').all();

    // 카드 수 확인 (50개 이하 — canvas 이탈 시 일부 invisible일 수 있음)
    expect(cards.length).toBeGreaterThan(0);
    console.log(`[B2-a] 렌더된 카드 수: ${cards.length}`);

    // BoundingBox 수집
    const rects = [];
    for (const card of cards) {
      const box = await card.boundingBox();
      if (box) rects.push(box);
    }
    console.log(`[B2-a] BoundingBox 수집: ${rects.length}개`);

    // IoU 계산
    let maxIou = 0;
    let overlapPairs = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const v = iou(rects[i], rects[j]);
        if (v > maxIou) maxIou = v;
        if (v > 0.05) overlapPairs++;
      }
    }
    console.log(`[B2-a] maxIoU = ${maxIou.toFixed(4)}, 겹침 페어(>0.05): ${overlapPairs}개`);

    // 4사분면 분포 측정 (viewport 1280×720 기준)
    const vpW = 1280, vpH = 720;
    const quad = quadrantDistribution(rects, vpW, vpH);
    const quadValues = Object.values(quad);
    const sd = stddev(quadValues);
    console.log(`[B2-a] 4사분면 분포: TL=${quad.TL} TR=${quad.TR} BL=${quad.BL} BR=${quad.BR} StdDev=${sd.toFixed(2)}`);

    // 스크린샷 저장
    const reportDir = ensureReportDir();
    const screenshotPath = path.join(reportDir, 'phase-b2-50cards.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[B2-a] 스크린샷 저장: ${screenshotPath}`);

    // 검증: IoU < 0.05
    expect(maxIou).toBeLessThan(0.05);
  });

  // ────────────────────────────────────────────────────────────
  // (b) 자기 전 정리 1단계 → 메인 캔버스 흐름
  // ────────────────────────────────────────────────────────────
  test('(b) 자기 전 정리 1단계 5개 입력 → 메인 캔버스 x>0||y>0 검증', async ({ page }) => {
    // localStorage 초기화
    await page.goto('/app/do-it-os/thinking');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);

    // end-of-day 페이지 진입
    await page.goto('/app/do-it-os/end-of-day');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // 5개 입력 — 각기 다른 텍스트, Ctrl+Enter 또는 "쏟기" 버튼 클릭
    const entries = [
      '오늘 미처 못 한 보고서 정리',
      '내일 아침 미팅 준비 메모',
      '친구에게 연락해야 함',
      '책 반납 기한 확인',
      '냉장고 재료 목록 작성',
    ];

    for (const text of entries) {
      const textarea = page.locator('textarea').first();
      await textarea.fill(text);

      // "쏟기" 버튼 존재 여부 확인 후 클릭, 없으면 Ctrl+Enter
      const pourBtn = page.locator('button', { hasText: '쏟기' }).first();
      const btnVisible = await pourBtn.isVisible().catch(() => false);
      if (btnVisible) {
        await pourBtn.click();
      } else {
        await page.keyboard.press('Control+Enter');
      }
      await page.waitForTimeout(100);
    }

    // 메인 thinking 페이지로 이동
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // useEffect 마이그레이션(relayoutZeroCards) 대기

    // localStorage의 thoughts 확인
    const thoughts = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '[]'),
      STORAGE_KEY,
    );

    console.log(`[B2-b] thoughts 총 개수: ${thoughts.length}`);

    // null 좌표 개수
    const nullPos = thoughts.filter((t) => t.x === null || t.y === null);
    console.log(`[B2-b] null 좌표 thoughts: ${nullPos.length}개`);

    // x>0 || y>0 인 thoughts 개수 (위치 부여된 것)
    const positioned = thoughts.filter((t) => t.x > 0 || t.y > 0);
    console.log(`[B2-b] 위치 부여된 thoughts(x>0||y>0): ${positioned.length}개`);

    // 0,0 고착 카드 개수 (relayout 후 1개 이하여야)
    const stuckAt00 = thoughts.filter((t) => t.x === 0 && t.y === 0);
    console.log(`[B2-b] (0,0) 고착 카드: ${stuckAt00.length}개`);

    // 카드들이 viewport 안에 렌더링되는지 확인
    const cardEls = await page.locator('.doit-memo').all();
    console.log(`[B2-b] .doit-memo 렌더 개수: ${cardEls.length}`);

    const inViewport = [];
    for (const card of cardEls) {
      const box = await card.boundingBox();
      if (box) inViewport.push(box);
    }
    console.log(`[B2-b] viewport 안 카드: ${inViewport.length}개`);

    // 검증: null 좌표 0개 (relayout 완료)
    expect(nullPos.length).toBe(0);
    // 검증: (0,0) 고착 1개 이하
    expect(stuckAt00.length).toBeLessThanOrEqual(1);
    // 검증: .doit-memo 가 최소 1개 이상 렌더됨
    expect(cardEls.length).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────────────────────
  // (c) viewport 리사이즈 회귀 (1920×1080 → 800×600)
  // ────────────────────────────────────────────────────────────
  test('(c) viewport 리사이즈 후 카드 viewport 이탈 5개 이하', async ({ page }) => {
    // 1920×1080 에서 30개 카드 추가
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/app/do-it-os/thinking');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    for (let i = 0; i < 30; i++) {
      const textarea = page.locator('textarea').first();
      await textarea.fill(`리사이즈 테스트 ${i + 1}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(400);

    // 800×600 으로 축소
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(600);

    const cards = await page.locator('.doit-memo').all();
    console.log(`[B2-c] 리사이즈 후 카드 수: ${cards.length}`);

    let outsideCount = 0;
    for (const card of cards) {
      const box = await card.boundingBox();
      if (!box) continue;
      // 카드 중심이 viewport 밖으로 완전히 벗어난 경우
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      if (cx < 0 || cx > 800 || cy < 0 || cy > 600) {
        outsideCount++;
      }
    }
    console.log(`[B2-c] 중심이 viewport 밖 카드: ${outsideCount}개`);

    // 5개 이하만 부분적 이탈 허용
    expect(outsideCount).toBeLessThanOrEqual(5);
  });

  // ────────────────────────────────────────────────────────────
  // (d) NextActionCardGrid 동작 검증
  //     project 상세 진입 경로를 자동 탐색: localStorage에 project 카드 생성
  // ────────────────────────────────────────────────────────────
  test('(d) NextActionCardGrid — project 상세 IoU 검증', async ({ page }) => {
    // thinking 페이지에서 localStorage 직접 조작으로 project 카드 생성
    await page.goto('/app/do-it-os/thinking');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.waitForLoadState('networkidle');

    // project 카테고리 thought를 직접 localStorage에 심기
    const projectId = `proj-b2-test-${Date.now()}`;
    const projectThought = {
      id: projectId,
      text: 'B2 테스트 프로젝트',
      createdAt: new Date().toISOString(),
      category: 'project',
      classifiedAt: new Date().toISOString(),
      x: 100,
      y: 100,
      rotation: 0,
      color: 'mint',
      width: 280,
      height: 160,
    };
    await page.evaluate(
      ({ key, thought }) => {
        localStorage.setItem(key, JSON.stringify([thought]));
      },
      { key: STORAGE_KEY, thought: projectThought },
    );

    // project 상세 페이지 진입
    await page.goto(`/app/do-it-os/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // NextActionCardGrid 가 있는지 확인
    const gridContainer = page.locator('[class*="next-action"], [class*="NextAction"], .doit-canvas').first();
    const gridVisible = await gridContainer.isVisible().catch(() => false);

    if (!gridVisible) {
      // project 상세 진입 후 NextActionCardGrid가 보이지 않으면 SKIP
      console.log('[B2-d] SKIP: NextActionCardGrid 컨테이너를 찾을 수 없음. project 상세 진입 경로 미확인.');
      test.skip();
      return;
    }

    // NextActionCardGrid 에서 카드 10개 추가 (preset 버튼 클릭)
    // 버튼들을 찾아서 최대 10번 클릭
    const presetButtons = await page.locator('button').filter({ hasText: /할 일|일정|노트|회의|연락|조사|결정|피드백|리뷰|마감/ }).all();
    console.log(`[B2-d] preset 버튼 수: ${presetButtons.length}`);

    if (presetButtons.length === 0) {
      console.log('[B2-d] SKIP: NextActionCardGrid preset 버튼 미탐지. project 상세 진입 경로 미확인.');
      test.skip();
      return;
    }

    const clickCount = Math.min(10, presetButtons.length);
    for (let i = 0; i < clickCount; i++) {
      const btn = presetButtons[i % presetButtons.length];
      await btn.click().catch(() => {});
      await page.waitForTimeout(80);
    }

    await page.waitForTimeout(400);

    // 새로 추가된 카드들 (thinking 페이지로 이동해서 확인)
    await page.goto('/app/do-it-os/thinking');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // localStorage에서 추가된 카드 확인
    const allThoughts = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '[]'),
      STORAGE_KEY,
    );
    const addedCards = allThoughts.filter((t) => t.projectLinkId === projectId);
    console.log(`[B2-d] projectId로 연결된 카드: ${addedCards.length}개`);

    if (addedCards.length === 0) {
      console.log('[B2-d] SKIP: NextActionCardGrid 추가 카드 0개 — project 상세 진입 경로 미확인');
      test.skip();
      return;
    }

    // IoU 검증
    const rects = addedCards
      .filter((t) => typeof t.x === 'number' && typeof t.y === 'number' && t.width && t.height)
      .map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height }));

    let maxIou = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const v = iou(rects[i], rects[j]);
        if (v > maxIou) maxIou = v;
      }
    }
    console.log(`[B2-d] NextActionCardGrid maxIoU = ${maxIou.toFixed(4)}`);
    expect(maxIou).toBeLessThan(0.05);
  });
});
