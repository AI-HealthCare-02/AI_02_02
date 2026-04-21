/**
 * Do it OS MVP 시나리오 E2E 테스트
 * 실행: frontend/  에서 `node doit_mvp_test.mjs ./doit_output`
 * 선행 조건: backend(8000) + frontend dev server(3000) 실행 중.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const OUT = resolve(process.argv[2] || './doit_output');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8000';
const USER_EMAIL = `test-doit-${Date.now()}@example.com`;
const USER_PASS = 'TestPass1234!';

function log(...args) { console.log('[DOIT]', ...args); }

async function signupViaApi() {
  const req = await fetch(`${API}/api/v1/auth/email/signup/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: USER_EMAIL,
      password: USER_PASS,
      name: 'doit-tester',
      birth_date: '1990-01-01',
    }),
  });
  const body = await req.json();
  if (!req.ok) throw new Error(`signup failed: ${JSON.stringify(body)}`);
  const code = body.dev_verification_code;
  const conf = await fetch(`${API}/api/v1/auth/email/signup/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, code }),
  });
  if (!conf.ok) throw new Error(`signup confirm failed: ${await conf.text()}`);
  log(`Created ${USER_EMAIL}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', USER_EMAIL);
  await page.fill('input[type="password"]', USER_PASS);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL(/\/app/, { timeout: 15000 });
}

async function main() {
  await signupViaApi();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  const results = [];

  try {
    await login(page);
  } catch (e) {
    log('Login failed, skipping tests:', e.message);
    await browser.close();
    writeFileSync(`${OUT}/doit_results.json`, JSON.stringify({ error: e.message }, null, 2));
    process.exit(1);
  }

  // --- 1. Sidebar에 Do it OS 메뉴 + 6 subitems 확인 ---
  log('1. Sidebar Do it OS + subitems');
  await page.waitForSelector('aside nav');
  const doitMenuExists = await page.getByRole('link', { name: /Do it OS/ }).first().isVisible();
  const expandButton = page.getByRole('button', { name: /Do it OS 하위 메뉴/ });
  const initiallyExpanded = (await expandButton.getAttribute('aria-expanded')) === 'true';
  if (!initiallyExpanded) await expandButton.click();
  await page.waitForTimeout(200);
  const subitemLabels = ['대시보드', '생각 쏟기', '정리 명료화', '프로젝트', '일정', '노트'];
  const visibleSubs = [];
  for (const label of subitemLabels) {
    const v = await page.getByRole('link', { name: label }).first().isVisible().catch(() => false);
    if (v) visibleSubs.push(label);
  }
  await page.screenshot({ path: `${OUT}/01_sidebar_doit.png`, fullPage: false });
  results.push({
    test: '1. Sidebar Do it OS 메뉴 + 6 subitems',
    doit_menu_visible: doitMenuExists,
    subitems_visible: visibleSubs,
    pass: doitMenuExists && visibleSubs.length === 6,
  });

  // --- 2. 생각넣기 진입 + 메모 3개 입력 ---
  log('2. 생각넣기 → 3 memos');
  await page.getByRole('link', { name: '생각넣기' }).first().click();
  await page.waitForURL(/\/app\/do-it-os\/thinking/);
  await page.waitForSelector('textarea');
  const messages = ['내일 혈당 체크하기', '약 리필 받아오기', '오늘 운동 30분'];
  for (const msg of messages) {
    await page.fill('textarea', msg);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
  const memoCount = await page.locator('.doit-memo').count();
  await page.screenshot({ path: `${OUT}/02_thinking_3memos.png`, fullPage: false });
  results.push({
    test: '2. 생각넣기 3개 입력 후 렌더',
    memo_count: memoCount,
    pass: memoCount === 3,
  });

  // --- 3. 새로고침 → localStorage 복원 ---
  log('3. 새로고침 후 복원');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.doit-memo');
  const memoCountAfterReload = await page.locator('.doit-memo').count();
  await page.screenshot({ path: `${OUT}/03_thinking_reload.png`, fullPage: false });
  results.push({
    test: '3. 새로고침 후 localStorage 복원',
    memo_count_after_reload: memoCountAfterReload,
    pass: memoCountAfterReload === 3,
  });

  // --- 4. 기존 3대 메뉴 정상 클릭 (회귀) ---
  log('4. 기존 3대 메뉴 회귀');
  const regression = {};
  for (const [label, urlFragment] of [
    ['AI 채팅', '/app/chat'],
    ['리포트', '/app/report'],
    ['챌린지', '/app/challenge'],
  ]) {
    await page.getByRole('link', { name: label }).first().click();
    await page.waitForURL(new RegExp(urlFragment));
    regression[label] = page.url().includes(urlFragment);
  }
  results.push({
    test: '4. 기존 3대 메뉴 회귀 없음',
    regression,
    pass: Object.values(regression).every(Boolean),
  });

  // --- 5. 다크/라이트 토글 시 Do it OS 정상 ---
  log('5. 다크 ↔ 라이트 토글');
  await page.goto(`${BASE}/app/do-it-os`, { waitUntil: 'networkidle' });
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.evaluate(() => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('danaa_theme', next);
  });
  await page.waitForTimeout(200);
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.screenshot({ path: `${OUT}/05_theme_toggle.png`, fullPage: false });
  results.push({
    test: '5. 라이트 ↔ 다크 토글 반영',
    light_bg: lightBg,
    dark_bg: darkBg,
    pass: lightBg !== darkBg,
  });

  // --- 6. 모바일 뷰포트 렌더 안전 ---
  log('6. 모바일 뷰포트');
  await context.newPage();
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: 'ko-KR',
    storageState: await context.storageState(),
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${BASE}/app/do-it-os`, { waitUntil: 'networkidle' });
  const mobileTitle = await mobilePage.getByRole('heading', { name: 'Do it OS' }).isVisible();
  await mobilePage.screenshot({ path: `${OUT}/06_mobile_dashboard.png`, fullPage: false });
  await mobile.close();
  results.push({
    test: '6. 모바일 뷰포트에서 대시보드 렌더',
    title_visible: mobileTitle,
    pass: mobileTitle,
  });

  await browser.close();

  writeFileSync(`${OUT}/doit_results.json`, JSON.stringify(results, null, 2));
  const pass = results.filter((r) => r.pass).length;
  log(`결과: ${pass}/${results.length} 통과`);
  for (const r of results) {
    log(` ${r.pass ? '✅' : '❌'} ${r.test}`);
  }
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('[DOIT] Fatal:', err);
  process.exit(1);
});
