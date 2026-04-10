# Handoff Memo

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
