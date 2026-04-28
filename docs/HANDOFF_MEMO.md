# Handoff Memo

## 2026-04-25 Local Workspace Consolidation Handoff

### Current Branch / Workspace State

- Current local branch:
  - `fix/bj_health-question-panel-polish`
- The local workspace is no longer limited to the original health-question-panel polish scope.
- Report dashboard/detail redesign work is currently mixed into this branch locally.
- This means the branch name no longer reflects the actual working-tree contents.

### Current Modified Files

Tracked modified files:

- `backend/dtos/onboarding.py`
- `backend/services/onboarding.py`
- `docs/HANDOFF_MEMO.md`
- `docs/collaboration/model/design/NON_DIABETIC_TRACK_SCORE_DESIGN.md`
- `frontend/app/app/challenge/page.js`
- `frontend/app/app/report/detail/page.js`
- `frontend/app/app/report/page.js`
- `frontend/components/Sidebar.js`

Untracked files currently present:

- `.aerich_models_state.txt`
- `frontend/app/app/report/detail/page.backup-before-report-redesign.js`
- `frontend/app/app/report/page.backup-before-report-redesign.js`
- `frontend/public/body-anatomy.png`
- `frontend/public/human-body.jpg`
- `frontend/public/report-dashboard.png`
- `human.eps`
- `human.jpg`
- several root-level image reference files with Korean names

### What Changed Since The 2026-04-24 Memo

#### 1. Report Dashboard (`frontend/app/app/report/page.js`)

- The dashboard was iterated further beyond the earlier human-centered composition pass.
- Left-side content was reworked again toward:
  - editable profile card
  - optional profile image upload preview
  - health prediction score section
  - FINDRISC score section
  - lifestyle score section with hover insight popups
- Additional helper components and legacy in-file variants remain present.
- The file is now very large and contains multiple generations of dashboard implementations:
  - `LegacyBodyInsightPanel`
  - `LegacySummarySection`
  - `LegacySummarySectionCompact`
  - current `SummarySection`

#### 2. Report Detail (`frontend/app/app/report/detail/page.js`)

- The detail page was also heavily redesigned.
- The diff indicates a broader rewrite rather than minor follow-up edits.
- Newer structure includes:
  - session cache support for detail data
  - one-screen detail dashboard treatment
  - reorganized summary/trend/lifestyle/challenge sections
  - use of `DashboardOneScreen` style composition
- This file should be treated as an active redesign surface and reviewed visually before any commit.

#### 3. Onboarding DTO / Service

- `backend/dtos/onboarding.py`
- `backend/services/onboarding.py`

Added profile fields to onboarding status response:

- `height_cm`
- `weight_kg`

This appears intended to support richer report/profile presentation in the frontend.

#### 4. Challenge / Sidebar

- `frontend/app/app/challenge/page.js`
  - tab/header wrapper styling adjusted to align with the newer report/dashboard visual language
- `frontend/components/Sidebar.js`
  - newline-only / formatting-level change

### Verification Status

Frontend production build passed during the report redesign session:

```bash
cd frontend
npm run build
```

No current backend-specific test verification was re-run in this handoff step.

### Important Risk Notes

1. Branch mismatch risk

- The current branch name suggests a focused UX polish PR, but the working tree now contains large report redesign work.
- Do not push/merge this branch casually without deciding whether to:
  - split report work into a new branch, or
  - intentionally expand the existing PR scope

2. Large in-file legacy accumulation

- `frontend/app/app/report/page.js` now contains multiple legacy/current variants in one file.
- Before final merge, it would be safer to:
  - visually approve the chosen implementation
  - remove dead/legacy variants if possible

3. Untracked local artifacts

- `.aerich_models_state.txt` must still remain uncommitted.
- Root-level local reference images should be reviewed before commit.
- Backup JS files under `frontend/app/app/report/` should only be committed if intentionally preserved.

### Recommended Next Action

1. Decide branch strategy first.
   - safest option: move report redesign work to a dedicated branch
2. Visually verify both:
   - `/app/report`
   - `/app/report/detail`
3. Review whether the new profile-card pattern is actually the intended final UX.
4. Clean or isolate untracked assets before staging.
5. Only then prepare commit(s) and PR description.

## 2026-04-24 Report Dashboard Human-Centered Composition Handoff

### Current Working State

- The `/app/report` dashboard was further reworked after the one-screen redesign.
- Main edited file:
  - `frontend/app/app/report/page.js`
- Supporting image asset now used by the center visual:
  - `frontend/public/human-body.jpg`
- Older in-file versions remain present as fallback/reference components:
  - `LegacyBodyInsightPanel`
  - `LegacySummarySection`
- Local Aerich artifact remains untracked and should not be committed:
  - `.aerich_models_state.txt`

### User Goal

The user no longer wanted a simple three-column dashboard with a body image in the middle.

Target UX for `/app/report` is now:

- The human visual should feel like the main product feature.
- Left/right cards should support the body visual, not compete with it.
- The dashboard should feel like a clean medical SaaS product, not a report page or demo mockup.
- The center visual should support:
  - hover tooltip on body points
  - click selection state
  - selected region detail card
- Avoid duplicated score cards in the center.
- Avoid overly flashy effects; prefer restrained depth and product polish.

### What Was Changed

- Reworked `SummarySection` into a more composition-driven layout:
  - left: health risk score, diabetes risk, trend preview
  - center: enlarged body insight panel
  - right: lifestyle cards and recommended actions
- Added a new `BodyInsightPanel` implementation and kept the previous one in-file as:
  - `LegacyBodyInsightPanel`
- Added a new summary layout implementation and kept the previous one in-file as:
  - `LegacySummarySection`
- Center body visual now uses the existing raster asset:
  - `/human-body.jpg`
- Body visual interaction supports:
  - hover-only tooltip
  - click-to-select point state
  - selected region detail card
- Increased body image prominence:
  - image height set around `560px`
  - center panel min height increased
- Added stronger but then toned-down UI treatment after user feedback:
  - soft radial background glow
  - body image drop shadow
  - point ring/glow/dot structure
- Final pass reduced the effect intensity after the user reported it looked worse:
  - glow strength reduced
  - point scale/glow reduced
  - selected region card moved back below the body visual for a calmer layout
- Left-side hierarchy was improved:
  - main risk card shadow increased
  - graph card background differentiated slightly

### Verification Already Done

Frontend production build passed after the latest 2026-04-24 changes:

```bash
cd frontend
npm run build
```

Build result:

- `/app/report` compiled successfully.
- No Next.js build errors.

### Important Follow-Up Checks

Manual browser validation is still required. This work is highly visual and the final quality depends on real viewport inspection.

Check `/app/report` at:

- desktop width around 1280-1440px
- laptop height around 720-900px
- at least one narrower layout breakpoint

Specific things to verify:

- The human visual reads as the main focal element.
- Left/right cards feel attached to the central composition instead of three isolated columns.
- Tooltip position feels anchored to the body points.
- Selected region card spacing below the image feels intentional.
- Glow and marker effects are visible but not distracting.
- The body image does not feel boxed in by an obvious rectangular panel.
- No awkward overlap between center visual and surrounding cards.

### Known Risk / Likely Next Fix

This is much closer to the target direction, but it is still likely to need a final visual polish pass.

Most likely next fixes:

- fine-tune point coordinates by 1-2%
- reduce or increase body image height slightly depending on actual viewport fit
- tighten spacing between the body visual and the selected-region card
- further normalize card density if left/right columns still feel heavier than the center

Do not add more visual effects by default. The latest feedback was that the previous pass became too flashy and less product-like. The correct direction now is restraint and spacing polish, not more decoration.

### Dev Environment Note

During this session, a `ChunkLoadError` appeared in local dev for:

- `components/RightPanelV2`

Error shape:

```text
ChunkLoadError: Loading chunk _app-pages-browser_components_RightPanelV2_js failed.
(error: http://localhost:3000/_next/undefined)
```

This did **not** come from a broken import introduced in report code. It appears to be a local Next.js dev-server/browser chunk cache mismatch.

Recommended local recovery:

```bash
cd frontend
npm run dev
```

Then fully reload the browser tab. If needed, clear localhost site data and restart the dev server again.

### Suggested Next Action

1. Run the frontend locally and inspect `/app/report` in browser.
2. Do one final polish pass focused only on:
   - spacing
   - point coordinates
   - effect intensity
3. Avoid structural rewrites unless the user changes direction again.
4. After visual approval, remove or clean up legacy in-file components if desired.
5. Commit the finalized report dashboard changes deliberately after checking `git status --short`.

## 2026-04-23 Report Dashboard One-Screen Redesign Handoff

### Current Working State

- Dashboard redesign work is in progress on the local workspace.
- Main edited file:
  - `frontend/app/app/report/page.js`
- Related files still marked modified from the broader report redesign session:
  - `frontend/app/app/report/detail/page.js`
  - `frontend/components/Sidebar.js`
- Backup files created before the redesign:
  - `frontend/app/app/report/page.backup-before-report-redesign.js`
  - `frontend/app/app/report/detail/page.backup-before-report-redesign.js`
- Local Aerich artifact remains untracked and should not be committed:
  - `.aerich_models_state.txt`

### User Goal

The report dashboard should feel like a single-screen health dashboard, not a long report page.

Target UX:

- No long page scroll on `/app/report`.
- Top dashboard fits into one screen below header/tabs.
- Three-column layout:
  - left: risk score, key signals, recent change
  - center: larger human/body visual with health dots
  - right: recommended actions and challenges
- Human/body dots must show detail on hover or click.
- Lower details should be inside tabs/accordion-like panel:
  - risk trend
  - lifestyle
  - challenge
- Text must not be cut off. Prefer two-line clamping or compact wrapping over hard truncation.

### What Was Changed

- Replaced long stacked dashboard rendering with a one-screen wrapper:
  - `DashboardOneScreen`
  - `DashboardDetailTabs`
- `/app/report` now renders:
  - `SummarySection`
  - `DashboardDetailTabs`
- Removed dashboard calls to the long sections from the main render path:
  - `TrendSection`
  - `FactorSection`
  - `LifestyleSection`
  - `ChallengeSection`
- The old section components are still present in the file but are no longer used by the dashboard page.
- Page container changed to avoid long scroll:
  - dashboard page body uses `overflow-hidden`
  - main area uses full height flex layout
- Added hover/click/focus popups to body visual dots:
  - FINDRISC
  - Danaa model
  - exercise
  - diet
  - sleep
- Increased lower tab content height:
  - from `h-[150px] overflow-hidden`
  - to `h-[190px] overflow-visible`
- Replaced some hard `truncate` usage in the lower challenge/action panel with `line-clamp-2`.

### Verification Already Done

Frontend production build passed:

```bash
cd frontend
npm run build
```

Build result:

- `/app/report` compiled successfully.
- No Next.js build errors.

### Important Follow-Up Checks

Manual browser check is still required because this is layout-heavy work.

Check `/app/report` at:

- desktop width around 1200-1440px
- smaller laptop height around 720-800px
- mobile/tablet if the page must remain usable there

Specific things to verify:

- No vertical page scroll in the intended desktop viewport.
- Header and report tabs remain visible.
- Human/body dots show a popup on hover.
- Human/body dots also toggle popup on click.
- Popup does not escape awkwardly or cover critical text.
- Lower tab labels are readable.
- Challenge/action text is not cut off.
- Lower panel does not overlap the main dashboard card.
- If viewport height is too small, decide whether to allow internal panel scroll rather than page scroll.

### Known Risk / Likely Next Fix

The current design forces a one-screen layout. On short laptop screens, one of these may still be necessary:

- reduce vertical padding in `SummarySection`
- reduce `BodyInsight` SVG height again
- lower `DashboardDetailTabs` height
- allow only the lower tab content to scroll internally

Do not reintroduce a long full-page scroll unless the user approves it. The user's stated preference is a compact dashboard with details behind hover/click/tabs.

### Current Git Status Notes

Before committing, inspect and stage deliberately:

```bash
git status --short
```

Expected relevant changes:

- `frontend/app/app/report/page.js`
- `frontend/app/app/report/detail/page.js`
- `frontend/components/Sidebar.js`
- backup files under `frontend/app/app/report/`

Do not commit:

- `.aerich_models_state.txt`

### Suggested Next Action

1. Run the app locally and visually inspect `/app/report`.
2. If the dashboard still feels cramped:
   - shrink body visual slightly
   - convert right/left panel long lists into hover/click detail popovers
   - keep only 2 visible action/challenge rows, with a "more" popup.
3. After visual approval, clean up unused old section components if desired.
4. Commit the final dashboard redesign on a dedicated branch.

---

## 2026-04-22 Next-Day Handoff: Web Push Prod Setup After Merge

### Current Branch / PR

- Working branch: `feat/bJ_health-engagement-ux`
- PR target should use the renamed branch, not the old temporary branch.
- Old remote branch `feat/bj_적절한문구` was deleted from both `origin` and `upstream`.

### Tomorrow's First Task

After the PR is merged and the new FastAPI image is deployed, set up production Web Push env on EC2.

Do **not** generate the production VAPID key from the current old container. The current deployed image does not include `py_vapid` yet, so it fails with:

```bash
/app/.venv/bin/python3: No module named py_vapid
```

Wait until the new image from this PR is deployed, then generate the key inside the updated `fastapi` container.

### EC2 Commands After Merge/Deploy

```bash
cd ~/project
docker compose ps
docker compose exec fastapi uv run --group app python -m py_vapid --gen --json
```

Copy the generated `Application Server Key` into:

```dotenv
WEB_PUSH_VAPID_PUBLIC_KEY=
```

Then convert the generated private key:

```bash
docker compose exec fastapi sh -lc "base64 -w 0 private_key.pem"
```

Put that output into:

```dotenv
WEB_PUSH_VAPID_PRIVATE_KEY_B64=
```

Production env values to add/update in `~/project/envs/.prod.env` or the active production env file:

```dotenv
WEB_PUSH_ENABLED=true
WEB_PUSH_VAPID_PUBLIC_KEY=<Application Server Key>
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY_B64=<base64 private key>
WEB_PUSH_VAPID_SUBJECT=mailto:<team-email>
WEB_PUSH_ACTION_API_BASE=https://<production-domain>
```

After storing the base64 value, remove PEM files from the container:

```bash
docker compose exec fastapi sh -lc "rm -f private_key.pem public_key.pem"
```

Then restart FastAPI so env is loaded:

```bash
docker compose up -d fastapi
```

Apply migrations:

```bash
docker compose exec fastapi uv run aerich fix-migrations
docker compose exec fastapi uv run aerich upgrade
```

### Verification Checklist

- `push_subscriptions` table exists.
- Settings page shows "브라우저 백그라운드 알림" toggle.
- Turning the toggle on creates a row in `push_subscriptions`.
- Browser notification permission is allowed.
- Notification click opens `/app/chat?from=push&bundle_key=...`.
- Chat page shows the relevant unanswered question card.

### Important Notes

- Do not commit actual VAPID keys.
- Local team members generate their own local VAPID keys.
- Production uses one server-side VAPID key pair stored only in EC2 env.
- `.aerich_models_state.txt` is a local Aerich artifact and should remain uncommitted.

---

## 2026-04-21 Main Sync / Report PR Merge / Aerich Migration Format Handoff

### Current State
- Personal repo `origin/main` now includes the stacked report/chat changes that were previously under review:
  - report cache user scoping fix (`#28` equivalent branch)
  - chat app knowledge / app-context help enhancements (`#30` equivalent branch)
- Local working directory is now on `main` and synced to `origin/main` at:
  - `2653081` `Merge remote-tracking branch 'origin/feat/chat-app-knowledge' into merge-test-main`
- No local commits are ahead of `origin/main`.
- Current local uncommitted changes are:
  - migration hotfixes in:
    - `backend/db/migrations/models/7_20260418220000_add_unique_risk_assessment_period.py`
    - `backend/db/migrations/models/8_20260420000000_user_settings_theme_default_light.py`
    - `backend/db/migrations/models/9_20260420000100_translate_challenge_templates_ko.py`
  - docs:
    - `docs/HANDOFF_MEMO.md`
    - `docs/TROUBLESHOOTING.md`
  - temp investigation artifact:
    - `.aerich_models_state.txt` (safe to delete; generated while debugging Aerich)

### What Was Confirmed About The PR Stack
- Reviewed and confirmed the stacked relationship:
  1. performance/report loading change
  2. user-scoped report cache follow-up
  3. UX/theme/i18n follow-up
  4. chat app knowledge follow-up
- `perf/report-loading` by itself was not safe to merge because the frontend session cache keys were global.
- The user-scoped cache fix branch included the required follow-up, so the safe effective merge order was:
  1. merge the user-scoped report cache branch
  2. merge the chat app knowledge branch on top
- Those branches were test-merged in a temporary git worktree first to confirm no text merge conflicts.

### What Was Done
- Created a temporary git worktree to avoid disturbing the user's existing dirty workspace.
- Merged the stacked report/cache/chat branches there with no merge conflicts.
- Pushed the merged result to personal repo `main`.
- Switched the main working directory from `feat/deployment-setup` to `main` after removing the temporary worktree lock.
- Confirmed the current local working directory is now:
  - branch: `main`
  - commit: `2653081`
  - ahead/behind vs `origin/main`: `0 / 0`

### Important Migration Problem Found On Latest Main
- Even after syncing to the latest `main`, Docker + Aerich failed on:
  - `docker compose exec fastapi uv run aerich upgrade`
- Error:
  - `RuntimeError: Old format of migration file detected, run aerich fix-migrations to upgrade format`
- Root cause:
  - migration files `7`, `8`, and `9` were merged into `main` without `MODELS_STATE`
  - current Aerich expects `MODELS_STATE` in migration files (0.9.2+ style)
  - `aerich fix-migrations` did **not** repair them because the local Aerich table had no matching records for those versions
- This is not a frontend issue and not a `.venv` activation issue.
- This is also not mainly “new DB schema broke things”; the blocking problem was migration file metadata/format.

### Local Hotfix Applied
- Added minimal valid `MODELS_STATE` blocks to:
  - `backend/db/migrations/models/7_20260418220000_add_unique_risk_assessment_period.py`
  - `backend/db/migrations/models/8_20260420000000_user_settings_theme_default_light.py`
  - `backend/db/migrations/models/9_20260420000100_translate_challenge_templates_ko.py`
- After that, Aerich upgrade succeeded:
  - `Success upgrading to 7_20260418220000_add_unique_risk_assessment_period.py`
  - `Success upgrading to 8_20260420000000_user_settings_theme_default_light.py`
  - `Success upgrading to 9_20260420000100_translate_challenge_templates_ko.py`

### Why This Likely Happened
- Most likely combination:
  - migration files were created/applied in an environment where the problem did not surface
  - `fix-migrations` was attempted against a DB whose Aerich table did not contain matching rows for `7/8/9`
  - therefore the files stayed old-format even though the team thought they had been normalized
- In practice, this means:
  - developers with already-advanced local DB state may not notice the issue
  - anyone upgrading from a fresher/local rebuilt environment can hit the blocker immediately

### Local Run Notes
- Latest local code now matches GitHub personal repo `main`.
- Backend rebuild + Aerich upgrade should now work **with the local migration hotfix present**.
- `CHAT_APP_CONTEXT_MODE=live_state` is **not** required to fix migration errors.
- That env var is only needed if local chat testing should include live DB-backed answers such as:
  - current challenge count
  - current pending question count
  - other app-context live-state responses
- Without that env var, chat app help/UI explanations still work under the default `help_only` mode.

### Recommended Next Step
1. Commit and push the migration file hotfix so other teammates do not hit the same Aerich blocker.
2. Delete `.aerich_models_state.txt` if it is no longer needed.
3. Re-run local smoke checks:
   - backend container up
   - `aerich upgrade`
   - frontend local dev server
   - report dashboard/detail entry
   - chat app-context questions with and without `CHAT_APP_CONTEXT_MODE=live_state`

### Relevant Files
- Main report router/service:
  - `backend/apis/v1/risk_routers.py`
  - `backend/services/risk_analysis.py`
  - `backend/services/report_coaching.py`
- Report frontend:
  - `frontend/app/app/report/page.js`
  - `frontend/app/app/report/detail/page.js`
  - `frontend/app/app/settings/page.js`
- Chat app-context:
  - `backend/services/chat/app_context.py`
  - `backend/services/chat/intent.py`
  - `backend/services/chat/service.py`
  - `shared/danaa_product_guide.v1.json`
- Migration files needing repo fix:
  - `backend/db/migrations/models/7_20260418220000_add_unique_risk_assessment_period.py`
  - `backend/db/migrations/models/8_20260420000000_user_settings_theme_default_light.py`
  - `backend/db/migrations/models/9_20260420000100_translate_challenge_templates_ko.py`

---

## 2026-04-20 PR Review / Merge Guidance Handoff

### Scope Reviewed
- Reviewed two remote branches against `origin/main`:
  - `origin/codex/report-detail-reference-lines`
  - `origin/perf/report-loading`
- Confirmed branch relationship:
  - `perf/report-loading` is a stacked PR on top of `codex/report-detail-reference-lines`
  - extra commit on top of the stacked base: `4c18fbb`

### Merge Recommendation
- `codex/report-detail-reference-lines`
  - merge looks acceptable based on code review
  - no blocking text-conflict risk found relative to current `origin/main`
- `perf/report-loading`
  - **do not merge as-is**
  - reason: report session cache is not user-scoped, so a different user on the same browser session can briefly see or retain the previous user's report data

### Important Risk Found In `perf/report-loading`
- New session cache keys are global:
  - dashboard cache key: `danaa:report:dashboard:v1`
  - detail cache key: `danaa:report:detail:v1:${periodDays}`
- These caches are restored before the current logged-in user is fully revalidated.
- Resulting regression:
  - user A logs in and opens report
  - user A logs out on the same browser
  - user B logs in soon after
  - user B can briefly see user A's cached report data
- In the non-onboarded path, cached report/detail state is rewritten but not fully cleared from React state, so stale data can persist instead of only flashing briefly.

### Practical Team Guidance
- Safe merge order if proceeding:
  1. merge `codex/report-detail-reference-lines`
  2. rebase `perf/report-loading` if needed
  3. fix user-scoped report cache issue
  4. only then merge `perf/report-loading`
- If PR #1 is squash-merged, PR #2 should be rebased before review/merge because it is a stacked branch.

### Files To Recheck Before Merging `perf/report-loading`
- `frontend/app/app/report/page.js`
- `frontend/app/app/report/detail/page.js`
- `backend/services/risk_analysis.py`
- `backend/apis/v1/risk_routers.py`

### Required Follow-up Fix For `perf/report-loading`
- Scope report cache keys by current user identity, not just page type / period.
- Clear report state immediately on:
  - logout
  - user switch
  - onboarding incomplete path
- Re-test same-browser account switching:
  - A login -> report view -> logout -> B login -> report view

---

## 2026-04-19 배포 환경 정비 및 소셜 로그인 완성 핸즈오프

### 현재 상태
- 백엔드: EC2 (`15.165.1.254`, Elastic IP 고정) + GHCR 자동 배포 완료
- 프론트: Vercel 자동 배포 완료 (`https://danaa-project.vercel.app`)
- 도메인: `https://danaa.r-e.kr` (SSL 인증서 발급 완료, 만료일 2026-07-17)
- nginx HTTPS(443) 정상 동작 확인
- 구글/카카오/네이버 소셜 로그인 배포 환경에서 정상 동작 확인
- 이메일 회원가입 인증코드 발송 정상 동작 확인
- Google OAuth 앱 게시 완료 (프로덕션, 누구나 로그인 가능)
- Google 브랜딩 인증 완료 (`다나아 (DA-NA-A)` 앱 이름 표시)

### env 파일 구조 정리
| 파일 | 용도 | 참조하는 곳 |
|------|------|------------|
| 루트 `.env` | 로컬 직접 실행용 (uvicorn, pytest) | `config.py` 하드코딩 |
| `envs/.local.env` | 로컬 Docker용 | `docker-compose.yml` |
| `envs/.prod.env` | EC2 프로덕션용 | `docker-compose.prod.yml` |

### EC2 배포 시 주의사항
- `docker-compose.prod.yml` 실행 시 반드시 `--env-file envs/.prod.env` 옵션 필요
  ```bash
  docker compose -f docker-compose.prod.yml --env-file envs/.prod.env up -d --no-deps fastapi
  ```
- EC2 루트 `~/project/.env`도 존재하며 `config.py`가 이를 읽을 수 있음 → 주소 변경 시 이 파일도 함께 수정 필요
- EC2 루트 `.env` 소셜 콜백 URI는 `https://danaa.r-e.kr/...`로 수정 완료

### 소셜 로그인 설정 현황
| 제공자 | 콜백 URI | 상태 |
|--------|----------|------|
| Google | `https://danaa.r-e.kr/api/v1/auth/social/callback/google` | ✅ 앱 게시 완료 |
| Kakao | `https://danaa.r-e.kr/api/v1/auth/social/callback/kakao` | ✅ (팀원 테스터 등록 필요할 수 있음) |
| Naver | `https://danaa.r-e.kr/api/v1/auth/social/callback/naver` | ✅ (팀원 테스터 등록 필요할 수 있음) |

### 추가된 프론트 페이지
- `frontend/app/privacy/page.js` - 개인정보처리방침 (`/privacy`)
- `frontend/app/terms/page.js` - 서비스 이용약관 (`/terms`)
- `frontend/public/googled218112ca89bc379.html` - Google Search Console 인증 파일

### Google Search Console 인증
- `danaa.r-e.kr` - DNS TXT 레코드 방식으로 인증 완료
- `danaa-project.vercel.app` - HTML 태그 방식으로 인증 완료 (`layout.js`에 메타태그 추가)

### nginx 설정
- 현재 HTTP(80)만 동작 중
- HTTPS(443) 설정 파일: `nginx/prod_https.conf` (도메인 치환 완료)
- SSL 인증서 및 `options-ssl-nginx.conf`, `ssl-dhparams.pem` EC2에 존재 확인
- HTTPS 전환 시: `nginx/prod_https.conf`를 EC2 `~/project/nginx/default.conf`로 교체 후 nginx 재시작

### 수동 배포 명령어 (EC2)
```bash
cd ~/project
docker compose -f docker-compose.prod.yml --env-file envs/.prod.env up -d --no-deps fastapi
docker compose -f docker-compose.prod.yml --env-file envs/.prod.env restart nginx
```

---

## 2026-04-19 배포 자동화 완료 핸즈오프

### 현재 상태
- 백엔드: EC2 (`43.202.56.216`) + GHCR 자동 배포 완료
- 프론트: Vercel 자동 배포 완료 (`https://danaa-project.vercel.app`)
- 도메인: `https://danaa.r-e.kr` (SSL 인증서 발급 완료, 만료일 2026-07-17)
- 비당뇨 트랙 모델: CatBoost → MLP Regressor 교체 완료

### 배포 자동화 흐름
```
로컬 코드 수정
      ↓
git push origin main (개인 레포)
      ↓
GitHub Actions 자동 실행 (.github/workflows/ghcr-build.yml)
      ↓
GHCR에 이미지 빌드 & 푸시 (ghcr.io/bijeng/danaa-fastapi:latest)
      ↓
EC2 SSH 자동 접속 → docker compose pull fastapi → up
      ↓
프론트: Vercel이 frontend/ 폴더 감지 → 자동 빌드 & 배포
```

### EC2 서버 구성
- IP: `15.165.1.254` (Elastic IP 고정)
- 프로젝트 경로: `~/project/`
- SSH 키: `C:\.ssh\DANAA_ssh_key.pem`
- 실행 중인 컨테이너: fastapi, postgres, redis, nginx, certbot
- 모델 파일 위치: `~/project/tools/ml_artifacts/` (docker-compose.yml에 볼륨 마운트)

### EC2 접속 방법
```bash
ssh -i C:\.ssh\DANAA_ssh_key.pem ubuntu@15.165.1.254
```

### EC2 주요 명령어
```bash
# 컨테이너 상태 확인
docker ps

# FastAPI 로그 확인
docker logs fastapi --tail=30

# 마이그레이션 실행
docker exec fastapi uv run --no-sync aerich upgrade

# 시드 데이터 재생성
docker exec fastapi uv run --no-sync python backend/tasks/seed_shared_demo_account.py

# 수동 배포 (자동 배포 실패 시)
cd ~/project
docker compose pull fastapi
docker compose up -d --no-deps fastapi
```

### GitHub Secrets (개인 레포: BIJENG/DANAA_project)
| 이름 | 설명 |
|------|------|
| EC2_HOST | 15.165.1.254 |
| EC2_USER | ubuntu |
| EC2_SSH_KEY | pem 키 내용 |

### 시드 계정
| 이메일 | 비밀번호 | 시나리오 |
|--------|---------|----------|
| danaa1@danaa.com | EKskdk1! | 당뇨 고위험 |
| danaa2@danaa.com | EKskdk1! | 건강 예방 |

### 모델 구성
| 트랙 | 모델 | 대상 |
|------|------|------|
| diabetic_track | CatBoost (분류) | 당뇨/전단계 (A/B 그룹) |
| non_diabetic_track | MLP Regressor (회귀) | 비당뇨 예방 (C 그룹) |

- 모델 파일은 깃허브 미포함 → EC2에 SCP로 직접 전송
- EC2 경로: `~/project/tools/ml_artifacts/`
- 로컬 경로: `C:\PycharmProjects\DANAA_project\tools\ml_artifacts\`

### CORS 허용 도메인
- `http://localhost:3000`
- `https://danaa-project.vercel.app`
- `https://danaa.r-e.kr`

### 주의사항
- EC2 디스크 용량 주의 (8GB, 현재 약 84% 사용 중) → 추후 AWS 콘솔에서 30GB로 확장 권장
- 이미지 업데이트 시 디스크 부족하면 `docker system prune -af` 후 재시도
- SSL 인증서 만료일: 2026-07-17 (certbot 자동 갱신 컨테이너 실행 중)
- oz 공식 레포(`AI-HealthCare-02/AI_02_02`)에도 동일하게 push 필요 시: `git push upstream main`

---

## 2026-04-15 Report Sync / Main Merge / Migration Recovery Handoff

### Current State
- Local work is now based on latest `origin/main` after the teammate PR merge was brought in first and the report work was re-applied on top.
- Current working branch is a main-synced report branch and still needs final rename/commit/push for sharing.
- Report pages were reorganized so the user sees:
  - dashboard = recent 7-day summary
  - detail report = selectable `1일 / 7일 / 30일` deep analysis
- Diabetes risk output now separates:
  - model-based risk stage
  - lifestyle-based FINDRISC score
- Backend schema support for model prediction fields is included in repo migration file:
  - `backend/db/migrations/models/5_20260415113000_add_model_prediction_fields_to_risk_assessments.py`

### What Was Done
- Synced local work onto latest `origin/main` after teammate main-screen/chat-flow PR landed.
- Recovered and reapplied local report changes after sync without discarding report ownership changes.
- Added risk assessment model output fields and corresponding backend DTO/model/service handling:
  - `predicted_score_pct`
  - `predicted_risk_level`
  - `predicted_risk_label`
  - `predicted_stage_label`
  - `model_track`
- Added model inference / report coaching service files and related routing logic for report outputs.
- Added report dashboard copy so the user understands what screen they are looking at and what period is being summarized.
- Reworked report detail page to support:
  - default `7일`
  - quick period switch `1일 / 7일 / 30일`
  - current vs previous same-length comparison
  - combined overview graph plus focused category view
- Improved trend visualization so previous-period data is distinguishable from current-period data instead of blending together.
- Adjusted 30-day chart labeling density so axis labels remain readable.
- Seeded local challenge templates into DB for manual verification because the local DB had no template rows and the screen would otherwise appear empty.

### Migration Status
- Aerich initially failed with:
  - `Old format of migration file detected, run aerich fix-migrations to upgrade format`
- Root cause was the new migration file format/state mismatch during local upgrade flow.
- The migration file itself is now present in repo and local upgrade was eventually confirmed working:
  - `docker compose exec fastapi uv run aerich upgrade`
  - result: `Success upgrading to 5_20260415113000_add_model_prediction_fields_to_risk_assessments.py`
- Team guidance:
  - teammates should only need to pull the branch and run `docker compose exec fastapi uv run aerich upgrade`
  - no manual `ALTER TABLE` should be needed if their migration state is normal

### Runtime / UX Notes
- Dashboard copy is intended to explain:
  - this screen summarizes recent 7-day records
  - risk trend below is for recent flow, not a full-history medical report
- Detail report is intended to explain:
  - period-based deeper analysis
  - `1일 / 7일 / 30일` selection without changing the overall structure
- AI coaching is moving toward:
  - data-based feedback first
  - optional LLM wording polish for 1-3 short lines
- Challenge area can still look empty if the database has no `challenge_templates` rows.

### Verified
- `npm run build` passed after the dashboard/detail report UI changes.
- Frontend report pages compile with the period selector and updated graph components.
- Local DB challenge template seeding produced non-empty challenge overview responses for manual verification.
- Local migration upgrade succeeded after the migration format issue was corrected.

### Remaining Caveats
- Local challenge template seeding was a DB-only action for verification and is not yet represented as a committed seed/migration workflow.
- If a user truly has no earlier comparison-period records, the previous-period line/bar can still appear absent because there is nothing to render.
- Model artifacts under `tools/ml_artifacts/diabetic_track/` and `tools/ml_artifacts/non_diabetic_track/` are intentionally excluded from the repo and must be supplied separately for full AI prediction output.
- If those model artifacts are missing, backend/frontend now fall back to FINDRISC-based report rendering and expose the model section as disabled instead of showing a half-enabled feature.
- Additional end-to-end browser verification is still recommended for:
  - report dashboard
  - detail period switching
  - challenge sidebar/main sync behavior

### Relevant Files
- Report dashboard: [frontend/app/app/report/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/report/page.js)
- Report detail: [frontend/app/app/report/detail/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/report/detail/page.js)
- Risk DTOs: [backend/dtos/risk.py](/C:/PycharmProjects/DANAA_project/backend/dtos/risk.py)
- Dashboard DTOs: [backend/dtos/dashboard.py](/C:/PycharmProjects/DANAA_project/backend/dtos/dashboard.py)
- Risk model: [backend/models/assessments.py](/C:/PycharmProjects/DANAA_project/backend/models/assessments.py)
- Prediction service: [backend/services/prediction.py](/C:/PycharmProjects/DANAA_project/backend/services/prediction.py)
- Risk analysis: [backend/services/risk_analysis.py](/C:/PycharmProjects/DANAA_project/backend/services/risk_analysis.py)
- Model inference: [backend/services/model_inference.py](/C:/PycharmProjects/DANAA_project/backend/services/model_inference.py)
- Report coaching: [backend/services/report_coaching.py](/C:/PycharmProjects/DANAA_project/backend/services/report_coaching.py)
- Migration: [backend/db/migrations/models/5_20260415113000_add_model_prediction_fields_to_risk_assessments.py](/C:/PycharmProjects/DANAA_project/backend/db/migrations/models/5_20260415113000_add_model_prediction_fields_to_risk_assessments.py)

## 2026-04-13 Main Sync / Fix Branch / Tutorial Runtime Handoff

### Current State
- Local `main` was synced to latest `origin/main` successfully via fast-forward.
- A new working branch was created for service fixes only:
  - `fix/onboarding-settings-tutorial-flow`
- This branch was pushed to GitHub and includes auth/onboarding/settings/tutorial-related fixes only.
- ML-related work was intentionally excluded from the branch and remains local-only:
  - `scripts/train_diabetes_screening_model.py`
  - `scripts/train_diabetes_optimized_model.py`
  - `tools/ml_artifacts/`
  - `catboost_info/`
  - NHIS raw files under `docs/collaboration/`
- `docs/HANDOFF_MEMO.md` itself is still locally modified and not committed in the current fix branch.

### Branch / PR Status
- Current branch:
  - `fix/onboarding-settings-tutorial-flow`
- Pushed remote branch:
  - `origin/fix/onboarding-settings-tutorial-flow`
- PR creation URL:
  - `https://github.com/BIJENG/DANAA_project/pull/new/fix/onboarding-settings-tutorial-flow`

### What Was Done
- Pulled latest GitHub `main` and rebased workflow by creating a clean fix branch on top of it.
- Re-applied service fixes after main sync without including ML artifacts or public health dataset files.
- Resolved GitHub Actions failure on this branch:
  - `backend/services/auth.py` had `ruff` failures
  - import order issue fixed
  - `get_or_create_social_user` complexity reduced by splitting helper methods
- Re-ran local checks:
  - `uv run ruff check backend` -> passed
  - `uv run python -m pytest backend/tests/unit -q` -> `216 passed`

### Runtime Issue Found After Push
- After onboarding completion and entering `/app/chat`, the browser hit:
  - `ReferenceError: setTutorialKey is not defined`
- Root cause:
  - tutorial re-open logic was added in [frontend/app/app/chat/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/chat/page.js)
  - but `tutorialKey` / `setTutorialKey` state declaration was missing
- Local fix already applied but **not yet committed/pushed**:
  - added:
    - `const [tutorialKey, setTutorialKey] = useState(0);`
- Current local modified file because of this:
  - [frontend/app/app/chat/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/chat/page.js)

### Important Current Local Status
- Tracked but uncommitted:
  - [docs/HANDOFF_MEMO.md](/C:/PycharmProjects/DANAA_project/docs/HANDOFF_MEMO.md)
  - [frontend/app/app/chat/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/chat/page.js)
- Untracked and intentionally excluded from PR:
  - `docs/collaboration/diabetesNet.pdf`
  - NHIS raw data files
  - ML scripts
  - ML artifact outputs

### Recommended Next Step
1. Commit the local tutorial runtime fix in `frontend/app/app/chat/page.js`.
2. Push the branch again so the onboarding -> main chat flow no longer throws `setTutorialKey` runtime error.
3. Re-test:
   - signup or social login
   - onboarding completion
   - `/app/chat` first entry
   - tutorial render and close behavior

### Relevant Files
- Auth service: [backend/services/auth.py](/C:/PycharmProjects/DANAA_project/backend/services/auth.py)
- Chat page: [frontend/app/app/chat/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/chat/page.js)
- Settings page: [frontend/app/app/settings/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/settings/page.js)
- Onboarding completion: [frontend/app/onboarding/complete/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/onboarding/complete/page.js)
- Tutorial component: [frontend/components/Tutorial.js](/C:/PycharmProjects/DANAA_project/frontend/components/Tutorial.js)

## 2026-04-10 Main Sync After Kwanju Chat Merge

### Current State
- `main` now includes the newer chat/LangGraph/TTFT work on top of the earlier auth/onboarding sync.
- Chat backend was heavily refactored under `backend/services/chat/*` and a new `backend/services/chat_graph/*` package was added.
- Frontend chat page was updated again on latest main, so chat behavior should now be validated against this newer main, not the earlier auth-only main.
- Auth/onboarding/email-signup/social-login work from the earlier merge is still present in main.
- Local verification should now be done against:
  - latest pulled `main`
  - rebuilt FastAPI container
  - migrated DB schema
  - fresh test users after DB cleanup

### What Changed In Main After The Earlier Auth Merge
- Added LangGraph prep-only experiment code and adapter/state/node structure.
- Added TTFT benchmark/probe scripts and related tests.
- Updated chat router, streaming, prompting, enrich, and service layers.
- Updated frontend chat SSE handling and chat page flow.
- Added more architecture/setup docs and benchmark notes.

### Safe Re-Test Procedure
1. Pull latest main.
2. Rebuild backend container:
   - `docker compose up -d --build fastapi`
3. Apply migrations:
   - `docker compose exec fastapi uv run aerich upgrade`
4. Reset test user data if needed:
   - `docker compose exec postgres psql -U postgres -d ai_health`
   - `BEGIN;`
   - `TRUNCATE TABLE users RESTART IDENTITY CASCADE;`
   - `COMMIT;`
5. Restart frontend dev server if needed:
   - `cd frontend`
   - `npm run dev`
6. Re-test browser flows:
   - email signup
   - social login
   - onboarding completion
   - logout/login direct main route
   - `/app/chat` message send and SSE response

### Verified / Observed On Latest Main
- Latest `main` pulled successfully after `kwanju` merge.
- No text merge conflict was observed between latest `main` and `origin/kwanju`; the branch had already landed in main.
- `users` table still correctly shows onboarding state through `onboarding_completed` and `onboarding_completed_at`.
- Email signup verification still uses the request email as the recipient and the configured SMTP account as the sender.
- Onboarding completion persistence was confirmed previously at the DB level, but latest main should be re-checked because chat/frontend files changed again after that point.

### Current Important Files
- Chat router: [backend/apis/v1/chat_routers.py](/C:/PycharmProjects/DANAA_project/backend/apis/v1/chat_routers.py)
- Chat service: [backend/services/chat/service.py](/C:/PycharmProjects/DANAA_project/backend/services/chat/service.py)
- Chat graph adapter: [backend/services/chat_graph/adapter.py](/C:/PycharmProjects/DANAA_project/backend/services/chat_graph/adapter.py)
- Chat frontend: [frontend/app/app/chat/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/chat/page.js)
- Auth routes: [backend/apis/v1/auth_routers.py](/C:/PycharmProjects/DANAA_project/backend/apis/v1/auth_routers.py)
- Onboarding completion: [frontend/app/onboarding/complete/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/onboarding/complete/page.js)

### Remaining Caveats
- `frontend/app/onboarding/complete/page.js` had a local fix under review for a stuck "saving" state; latest main should be checked again before assuming it is resolved.
- Social auth token storage keys and shared token helper behavior should still be rechecked end-to-end on latest main.
- Because latest main now changes chat deeply, earlier auth/onboarding validation is not enough; browser chat must be re-verified again.

## 2026-04-10 Frontend/Auth/Onboarding Sync Handoff

### Current State
- Frontend signup now follows backend email verification contract instead of the old email-only request body.
- Frontend login now routes by `GET /api/v1/onboarding/status` using `is_completed`.
- Onboarding completion now actually persists consent and survey data to the backend before allowing the user into main chat.
- Sidebar now hydrates user name and onboarding state from backend APIs instead of relying only on local storage.
- Backend still exposes legacy auth aliases so the merged main frontend and the newer auth backend remain compatible.

### What Was Fixed Today
- Added legacy auth route aliases for:
  - `/api/v1/auth/email-verify/send`
  - `/api/v1/auth/email-verify/confirm`
  - `/api/v1/auth/{provider}/start`
  - `/api/v1/auth/social/{provider}/callback`
- Reworked signup UI so email verification sends:
  - `email`
  - `password`
  - `name`
  - `birth_date`
- Restored the frontend social auth bridge page required by backend OAuth callbacks.
- Fixed onboarding wizard runtime error caused by `STEPS` reference drift.
- Fixed onboarding completion so it now calls:
  - `POST /api/v1/auth/consent`
  - `POST /api/v1/onboarding/survey`
- Fixed login redirect check from `status.completed` to `status.is_completed`.
- Fixed sidebar bottom profile block so it stays in the footer area and shows DB-backed user state.

### Verified
- `npm run build` passes after the frontend fixes.
- Backend logs show:
  - `POST /api/v1/auth/consent` -> `201 Created`
  - `POST /api/v1/onboarding/survey` -> `201 Created`
- DB confirms onboarding persistence:
  - `users.onboarding_completed = true`
  - `health_profiles` row exists for the test user
- After onboarding completion, logout/login routes to `/app/chat`.

### Remaining Caveats
- `frontend/app/app/settings/page.js` still has some local-storage-driven profile summary behavior. Core auth/onboarding is fixed, but settings should be fully normalized to backend API data in a follow-up cleanup.
- Onboarding completion summary text still shows raw enum-like values such as `curious` and `none`. This is cosmetic, not a persistence bug.
- `frontend/app/app/chat/page.js` still uses `NEXT_PUBLIC_AUTH_TOKEN` for chat send instead of the shared token helper, so auth consistency there should be reviewed separately.

### Current Important Files
- Auth routes: [backend/apis/v1/auth_routers.py](/C:/PycharmProjects/DANAA_project/backend/apis/v1/auth_routers.py)
- Onboarding backend: [backend/services/onboarding.py](/C:/PycharmProjects/DANAA_project/backend/services/onboarding.py)
- Login page: [frontend/app/login/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/login/page.js)
- Signup page: [frontend/app/signup/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/signup/page.js)
- Onboarding completion: [frontend/app/onboarding/complete/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/onboarding/complete/page.js)
- Sidebar: [frontend/components/Sidebar.js](/C:/PycharmProjects/DANAA_project/frontend/components/Sidebar.js)

## 2026-04-09 Auth / Profile / Consent / Account Link Handoff

### Current State
- Social login is wired for Kakao, Naver, and Google.
- OAuth start/callback flows are implemented in the backend and route back to the frontend social auth bridge.
- Login success still routes by onboarding state:
  - completed -> `/app/chat`
  - incomplete -> `/onboarding/diabetes`
- Email signup is implemented with real email verification via Gmail SMTP when SMTP env vars are present.
- Passwords are stored as bcrypt hashes, not plaintext.
- DB now stores:
  - `users.email_verified`
  - `users.email_verified_at`
  - `email_signup_sessions` for temporary signup verification state
- Settings/profile now hydrate from DB for the logged-in user and can write back to DB.
- Health consent is stored in `user_consents.health_data_consent`.
- Account linking UI now shows a preview of duplicate accounts and requires a selected `keep_user_id`.

### What Was Fixed Today
- Added Naver and Google OAuth start/callback flows to the existing Kakao pattern.
- Kept social account identity keyed by `provider + provider_user_id`.
- Added email signup verification flow with:
  - request
  - code confirmation
  - temporary session storage
  - actual SMTP sending when configured
- Added `email_verified` support to the user model.
- Wired settings/profile to read current DB values for the authenticated user.
- Made profile fields editable so values can be updated back into the DB.
- Added health consent persistence for onboarding and settings.
- Added duplicate-email preview/link flow so the user can choose which account to keep.
- Removed the old automatic social-to-email merging behavior that was collapsing duplicate accounts into one row.
- Fixed preview serialization so datetime fields are returned as JSON safely.

### Important Runtime Notes
- Backend is running in Docker.
- Postgres is running in Docker.
- Frontend is running locally with `npm run dev`.
- Docker backend expects `DB_HOST=postgres`.
- If `.env` changes, recreate the backend container so it reads the new env values.
- For browser testing, stale `localStorage` access tokens and cookies can cause confusing auth behavior. If a flow looks wrong, clear the token/cookie or use a fresh browser session.

### Current Important Files
- Auth flows: [backend/services/auth.py](/C:/PycharmProjects/DANAA_project/backend/services/auth.py)
- Auth routes: [backend/apis/v1/auth_routers.py](/C:/PycharmProjects/DANAA_project/backend/apis/v1/auth_routers.py)
- User profile updates: [backend/services/users.py](/C:/PycharmProjects/DANAA_project/backend/services/users.py)
- User repository helpers: [backend/repositories/user_repository.py](/C:/PycharmProjects/DANAA_project/backend/repositories/user_repository.py)
- Consent / onboarding: [backend/services/onboarding.py](/C:/PycharmProjects/DANAA_project/backend/services/onboarding.py)
- Settings UI: [frontend/app/app/settings/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/app/settings/page.js)
- Signup UI: [frontend/app/signup/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/signup/page.js)
- Social auth bridge: [frontend/app/social-auth/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/social-auth/page.js)

### Verified
- `python -m py_compile` passes for the auth / user / onboarding changes.
- `npm run build` passes for the frontend.
- Email signup verification sends real mail when Gmail SMTP is configured.
- Profile/settings pages can load and update from DB.
- Health consent updates are persisted in DB.
- Duplicate account preview returns a list of candidate accounts.

### Notes / Caveats
- Existing merged test rows in the DB are not automatically split back into separate accounts. If a test row already has both email-password and social fields, delete and recreate it to test the new split behavior.
- `health_data_consent=false` currently blocks onboarding survey submission. The onboarding flow is effectively first-run only, so this is mainly a defensive guard.
- Account linking currently requires the user to pick a `keep_user_id` first. The flow is intentionally not automatic to avoid unsafe account merges.

## 2026-04-08 Social Login / Onboarding Handoff

### Current State
- Kakao social login is wired through backend OAuth start/callback.
- First social login routes to onboarding.
- After onboarding completion, subsequent logins should route directly to `/app/chat`.
- Onboarding completion is now persisted in DB via `users.onboarding_completed` and `users.onboarding_completed_at`.
- Frontend onboarding completion now submits:
  - consent to `POST /api/v1/auth/consent`
  - survey to `POST /api/v1/onboarding/survey`
- `user_consents` save is now effectively idempotent for dev-mode double submit.

### What Was Fixed Today
- Added onboarding completion fields to `users`.
- Added backend persistence for onboarding completion.
- Wired login redirects to use onboarding status.
- Wired onboarding completion page to submit consent + survey before redirecting to main.
- Fixed the double-submit issue from React dev mode by guarding the completion effect.

### Important Runtime Notes
- Backend is running in Docker.
- Postgres is also running in Docker.
- Frontend is running locally with `npm run dev`.
- Docker backend expects `DB_HOST=postgres`.
- Local uvicorn with the same env will fail on Windows because `postgres` is not a local hostname.

### Current Important Files
- Backend onboarding flow: [backend/services/onboarding.py](/C:/PycharmProjects/DANAA_project/backend/services/onboarding.py)
- Backend social auth callback: [backend/apis/v1/auth_routers.py](/C:/PycharmProjects/DANAA_project/backend/apis/v1/auth_routers.py)
- Onboarding completion page: [frontend/app/onboarding/complete/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/onboarding/complete/page.js)
- Onboarding wizard local storage payload: [frontend/app/onboarding/[condition]/page.js](/C:/PycharmProjects/DANAA_project/frontend/app/onboarding/[condition]/page.js)

### Verified
- Frontend production build passes.
- Kakao login reaches the backend and onboarding status routing works.
- Onboarding submission now persists server-side.

### Next Work If Continuing Tomorrow
1. Re-test the full flow:
   - login -> onboarding -> complete -> logout/login -> direct main route
2. If needed, backfill `onboarding_completed` for old accounts that already have `health_profiles`.
3. Consider cleaning up the onboarding wizard mapping if product wants stricter server-side survey typing.
# 2026-04-22 PR handoff: health engagement UX

## Branch naming

- 최종 PR 브랜치명: `feat/bJ_health-engagement-ux`
- 이전 임시 브랜치명 `feat/bj_적절한문구`는 의미가 불명확해 새 브랜치명으로 교체한다.

## Reviewer checklist

- FastAPI 재빌드 후 Aerich 마이그레이션 10, 11 적용 확인
- 프론트 재빌드 후 서비스 워커(`/sw.js`) 갱신 확인
- 설정 > 브라우저 백그라운드 알림 토글 확인
- 오른쪽 Today 패널 식사/수면 표시 문구 확인
- 미입력 항목 모달에서 드롭다운 선택 후 `기록 저장하기` 동작 확인
- 챌린지 `수행 완료`/`완료 취소` 토글 확인
- 리포트 신규/기록 부족 상태에서 fallback 카드 확인
- YouTube 추천 카드의 검색어가 최근 대화 기반으로 바뀌는지 확인

## Known local artifact

- `.aerich_models_state.txt`는 Aerich 로컬 상태 파일로 커밋하지 않는다.
