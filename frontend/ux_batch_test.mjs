import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const OUT = resolve(process.argv[2] || './');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:3000';
const USER_EMAIL = `test-ux-${Date.now()}@example.com`;
const USER_PASS = 'TestPass1234!';

function log(...args) {
  console.log('[TEST]', ...args);
}

async function signupViaApi() {
  const req = await fetch(`http://localhost:8000/api/v1/auth/email/signup/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: USER_EMAIL,
      password: USER_PASS,
      name: 'tester',
      birth_date: '1990-01-01',
    }),
  });
  const body = await req.json();
  if (!req.ok) throw new Error(`signup request failed: ${JSON.stringify(body)}`);
  const code = body.dev_verification_code;

  const conf = await fetch(`http://localhost:8000/api/v1/auth/email/signup/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, code }),
  });
  if (!conf.ok) throw new Error(`signup confirm failed: ${await conf.text()}`);
  log(`Created user ${USER_EMAIL} (code=${code})`);
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

  // --- Test 3: Signup error color ---
  log('Test 3: signup error color');
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'invalid-email');
  await page.getByRole('button', { name: /인증코드 받기/ }).click();
  await page.waitForSelector('text=올바른 이메일', { timeout: 5000 });
  const errorEl = page.locator('text=올바른 이메일').first();
  const errorColor = await errorEl.evaluate((el) => getComputedStyle(el).color);
  const errorBg = await errorEl.evaluate((el) => {
    // Walk up to find first opaque bg
    let cur = el;
    while (cur) {
      const bg = getComputedStyle(cur).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      cur = cur.parentElement;
    }
    return 'none';
  });
  await page.screenshot({ path: `${OUT}/test3_signup_error.png`, fullPage: false });
  results.push({
    test: '3. 회원가입 오류 텍스트 색',
    error_text_color: errorColor,
    surrounding_bg: errorBg,
    expected: 'rgb(196, 60, 60) (text-danger)',
    pass: errorColor === 'rgb(196, 60, 60)',
  });

  // --- Test 1: Signup → Login → Onboarding → AI Chat: light theme ---
  log('Test 1: theme default light flow');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', USER_EMAIL);
  await page.fill('input[type="password"]', USER_PASS);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL(/onboarding|\/app\//, { timeout: 15000 });
  await page.waitForTimeout(1500);

  const onboardingTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  const onboardingUrl = page.url();
  await page.screenshot({ path: `${OUT}/test1a_after_login.png`, fullPage: false });
  log(`After login: url=${onboardingUrl} theme=${onboardingTheme}`);

  // Skip through onboarding by navigating directly to /app/chat
  await page.goto(`${BASE}/app/chat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const chatTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  const chatBgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.screenshot({ path: `${OUT}/test1b_chat_page.png`, fullPage: false });
  log(`Chat page: theme=${chatTheme} bg=${chatBgColor}`);

  results.push({
    test: '1a. 로그인 후 초기 페이지 테마',
    url: onboardingUrl,
    data_theme: onboardingTheme,
    expected: 'light',
    pass: onboardingTheme === 'light',
  });
  results.push({
    test: '1b. /app/chat 페이지 테마',
    data_theme: chatTheme,
    body_bg: chatBgColor,
    expected: 'light (bg: 밝은색)',
    pass: chatTheme === 'light',
  });

  // --- Test 2: Challenge page Korean labels + "미획득" ---
  log('Test 2: challenge page');
  await page.goto(`${BASE}/app/challenge`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/test2_challenge_page.png`, fullPage: true });

  // Extract all challenge card names
  const challengeNames = await page.evaluate(() => {
    const names = [];
    document.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="name"]').forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length < 40 && t.length > 1) names.push(t);
    });
    return names;
  });

  const hasEnglish = challengeNames.some((n) => /^[A-Za-z0-9 ]+$/.test(n) && n.length > 3);
  const hasUnrankedEng = challengeNames.some((n) => n === 'UNRANKED' || n.includes('UNRANKED'));
  const hasUnrankedKor = await page.locator('text=미획득').count();

  results.push({
    test: '2. 챌린지 카드 한글화',
    has_english_names: hasEnglish,
    has_UNRANKED_english: hasUnrankedEng,
    miheukduk_count: hasUnrankedKor,
    sample_titles: challengeNames.slice(0, 15),
    expected: '영어 이름 없음, "미획득" 한글 뱃지 있음',
    pass: !hasEnglish && !hasUnrankedEng && hasUnrankedKor > 0,
  });

  await browser.close();

  console.log('\n========== RESULTS ==========');
  for (const r of results) {
    console.log(JSON.stringify(r, null, 2));
    console.log('---');
  }
  const allPass = results.every((r) => r.pass);
  console.log(allPass ? '✅ ALL PASS' : '⚠️  SOME FAIL');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
