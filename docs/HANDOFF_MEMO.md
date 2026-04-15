# Handoff Memo

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
