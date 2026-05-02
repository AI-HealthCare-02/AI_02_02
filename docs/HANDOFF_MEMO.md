# Handoff Memo

## 2026-05-02 최신 핸즈오프 / V4 랜딩페이지 머지·배포 완료

### 현재 저장소/브랜치 상태

- 현재 브랜치: `main` (작업 브랜치 없음, 모든 작업 머지 완료)
- `origin/main` 최신 커밋: `5d24f75 feat: V4 랜딩페이지 production 통합`
- 로컬 `main` = `origin/main` 동기화 완료
- `upstream` (공식레포)은 아직 이번 V4 랜딩 변경 미반영 상태

### 이번에 완료된 작업

#### 1. V4 랜딩페이지 PR (#45) 충돌 해결 및 머지

- PR 작성자: `LAP-TIME2`
- 충돌 파일: `frontend/app/page.js`
- 충돌 원인: `main`에 이미 머지된 PR #43의 반응형 수정(구버전 클라이언트 컴포넌트)과 V4 서버 컴포넌트가 동일 파일 충돌
- 해결 방법: V4 버전 채택 (구버전 랜딩 전체 교체가 목적이므로 반응형 패치는 불필요)
- 머지 커밋: `5d24f75`
- 421 테스트 통과 (Windows TMPDIR 권한 이슈 `.tmp/` 우회 적용)

#### 2. V4 랜딩페이지 내용

- `frontend/app/page.js` → 서버 컴포넌트로 교체, V4 metadata(og/twitter/canonical) export
- `frontend/app/AuthRedirectGate.jsx` → 인증 분기 클라이언트 컴포넌트 (`?preview=1` 우회 지원)
- `frontend/app/landing.css` → V4 CSS 2000줄 `.danaa-landing` 스코프 캡슐화
- `frontend/components/landing/*` → 14개 컴포넌트 (8섹션 + Nav/Footer + SymbolDefs/Icon/HeroOmni)
- `frontend/hooks/landing/*` → 7개 훅 (Reduced motion · Scroll progress · Sticky nav · Reveal · Mouse tracking · Magnetic · Deck nav)
- 4가지 핵심 효과: 벤토 박스, 옴니 원형, 인터랙티브 비교표, 3D 입체 덱
- `/` First Load JS **99.6 kB** (외부 라이브러리 추가 없음)
- 인증 사용자는 마운트 후 `/app/chat` 또는 `/onboarding/diabetes` 자동 이동 (보존)

#### 3. 배포 완료 (CI/CD 자동)

- 머지 트리거로 GitHub Actions 배포 파이프라인 자동 실행
- Docker 이미지 빌드: `ghcr.io/bijeng/danaa-fastapi:main-5d24f75`
- 서버 배포 절차: pull → aerich upgrade (`No upgrade items found`) → 컨테이너 재시작 → 구 이미지 prune (402.8MB 회수)
- 배포 결과: `✅ Successfully executed commands to all host.`
- 참고: CI 로그의 `err:` 접두사는 Docker가 진행 상황을 stderr로 출력하는 정상 동작 (에러 아님)

### 현재 `origin/main` 커밋 히스토리 (최근 5개)

```
5d24f75 feat: V4 랜딩페이지 production 통합 (Airtable 벤치마크 기반 4가지 효과)
fa1ba96 Merge branch 'main' into feat/doit-os-guide-update-2026-05-01
1d3161c feat: V4 랜딩페이지 production 통합 — Airtable 벤치마크 기반 4가지 효과
0914d3b Merge pull request #44 from BIJENG/feat/doit-os-guide-update-2026-05-01
15f51dd Merge pull request #43 from BIJENG/feat/bj_account-recovery-responsive-challenge
```

### 미반영/잔여 사항

- `docker-compose.prod.yml` 로컬 수정사항 있음 (unstaged) — 내용 확인 후 커밋 또는 복구 필요
- `upstream` (공식레포 `AI-HealthCare-02/AI_02_02`)에 PR #43(계정찾기·반응형·챌린지 배지), V4 랜딩 변경 아직 미제출
- reviewer 1440px·360px 시각 확인 체크리스트 미완료 (PR #45 체크리스트 잔여)

### 다음 액션

1. `docker-compose.prod.yml` 로컬 변경사항 확인 및 처리
2. 공식레포(`upstream`)에 계정찾기·반응형·챌린지 배지 PR 제출 (핸즈오프 2026-05-01 참고)
3. V4 랜딩 실제 브라우저 확인: `/` 비로그인 접근, `?preview=1` 우회, 인증 후 자동 리다이렉트

---

## 2026-05-01 최신 핸즈오프 / 계정찾기·반응형·챌린지 배지 PR 준비

### 현재 저장소/브랜치 상태

- 현재 브랜치: `feat/bj_account-recovery-responsive-challenge`
- 기준 main:
  - 로컬 `main`, 개인레포 `origin/main`, 공식레포 `upstream/main` 모두 `f450f17 docs: 최신 핸즈오프 메모 갱신` 기준으로 동기화되어 있었음.
- 이번 작업 커밋:
  - `bb44798 feat: add account recovery responsive UI and challenge badges`
- 동일 커밋을 개인레포와 공식레포 양쪽에 푸시 완료:
  - `origin/feat/bj_account-recovery-responsive-challenge`
  - `upstream/feat/bj_account-recovery-responsive-challenge`
- PR 생성 링크:
  - 개인레포: https://github.com/BIJENG/DANAA_project/pull/new/feat/bj_account-recovery-responsive-challenge
  - 공식레포: https://github.com/AI-HealthCare-02/AI_02_02/pull/new/feat/bj_account-recovery-responsive-challenge
- 이 핸즈오프 업데이트 전 기준 작업트리는 clean 상태였음.

### 이번에 완료된 주요 작업

#### 1. 아이디 찾기 / 비밀번호 재설정 기능

- 백엔드:
  - `backend/dtos/auth.py`
  - `backend/services/auth.py`
  - `backend/services/email.py`
  - `backend/apis/v1/auth_routers.py`
- 추가된 주요 API:
  - `POST /api/v1/auth/account/find-email`
  - `POST /api/v1/auth/password/reset/request`
  - `POST /api/v1/auth/password/reset/confirm`
- 동작 개요:
  - 이름 + 생년월일로 가입 이메일 후보를 마스킹하여 반환.
  - 이메일 + 이름 + 생년월일 확인 후 비밀번호 재설정 인증코드 발송.
  - 인증코드 확인 후 새 비밀번호 저장.
- 프론트:
  - 신규 페이지 `frontend/app/account-recovery/page.js`
  - 로그인 화면에서 아이디 찾기 / 비밀번호 찾기 링크 추가.
- 테스트:
  - `backend/tests/integration/auth_apis/test_login_api.py`에 계정 찾기/비밀번호 재설정 API 테스트 추가.

#### 2. 프론트 전체 반응형 보정

- 주요 보정 범위:
  - 랜딩, 로그인, 회원가입, 계정찾기, 온보딩, 리포트, 설정, 챌린지, Do it OS 주요 화면.
- 대표 변경:
  - `100vh` 계열을 모바일 주소창에 강한 `100dvh`로 조정.
  - 고정폭 카드/폼/그리드를 `w-full`, `max-w`, `sm/md/lg` 기준으로 보정.
  - 모바일에서 버튼/입력 행이 화면 밖으로 밀리지 않도록 `flex-col sm:flex-row`, `min-w-0` 적용.
  - `/landing-new` 푸터 태블릿 overflow 수정 및 어두운 푸터 배경으로 가독성 개선.
  - `frontend/app/layout.js`에 viewport/PWA 설정 추가.
  - `frontend/public/manifest.webmanifest` 신규 추가.
- 깨진 문자 점검:
  - `frontend/app`, `frontend/components`, `frontend/lib` 기준 `�`, `뷁`, `Ã`, `Â`, `ì`, `í`, `ê`, `ë` 패턴 스캔 결과 없음.
  - PowerShell 기본 출력에서 일부 한글이 깨져 보인 경우가 있었으나, `Get-Content -Encoding UTF8` 기준 파일 내용은 정상.

#### 3. 챌린지 중복 제거

- 중복으로 판단한 챌린지:
  - `주 3회 유산소 운동` vs `주 150분 운동`
  - `음주 줄이기` vs `음주 주 2회 이하`
- 유지:
  - `exercise_150min` / `주 150분 운동`
  - `drink_less_alcohol` / `음주 주 2회 이하`
- 비활성화:
  - `exercise_3x_week`
  - `alcohol_limit`
- 신규 마이그레이션:
  - `backend/db/migrations/models/17_20260501_deactivate_duplicate_challenges.py`
- 마이그레이션은 중복 템플릿을 `is_active=false`로 바꾸고, 해당 템플릿으로 진행 중인 `user_challenges`는 `cancelled`로 전환.
- 현재 로컬 Docker DB에도 같은 처리를 직접 반영했고 확인 결과:
  - 활성 챌린지: 14개
  - 중복 템플릿으로 진행 중인 active user challenge: 0개

#### 4. 챌린지 배지 실제 구현

- 기존 상태:
  - 프론트는 `overview.badges`, `badge_tier`, `next_badge_label` 등을 기대하고 있었으나 백엔드 응답에는 없었음.
  - 따라서 배지 색상 UI는 일부 준비되어 있었지만 실제 누적 완료 기반 배지는 연결되지 않은 상태였음.
- 백엔드 구현:
  - `backend/dtos/challenges.py`
  - `backend/services/challenge.py`
- 기준:
  - 브론즈: 10-29회
  - 실버: 30-59회
  - 골드: 60-99회
  - 다이아: 100-199회
  - 마스터: 200회 이상
- 응답에 추가된 주요 필드:
  - `badges`
  - `lifetime_completed_count`
  - `badge_tier`
  - `badge_label`
  - `next_badge_tier`
  - `next_badge_label`
  - `remaining_to_next_badge`
  - `stats.earned_badge_count`
- 검증:
  - 테스트 계정에 `daily_walk_30min` 누적 완료 10회를 넣어 API가 `bronze`, `브론즈`, 다음 등급 `실버`, `20회 남음`을 반환하는 것 확인.
  - 테스트 계정은 확인 후 삭제.

#### 5. 챌린지 배지현황 UI / 아이콘 조정

- `frontend/app/app/challenge/page.js`
- 배지현황 오른쪽에 등급 기준 설명 추가:
  - 브론즈 10-29회
  - 실버 30-59회
  - 골드 60-99회
  - 다이아 100-199회
  - 마스터 200회 이상
- 챌린지 아이콘 중복 완화:
  - `매일 스트레칭 10분`은 기존 운동 아이콘과 겹치지 않게 `Timer` 아이콘 사용.

### 검증 이력

- 커밋 전:
  - `python -m py_compile backend/dtos/auth.py backend/dtos/challenges.py backend/services/auth.py backend/services/challenge.py backend/services/email.py backend/tasks/seed_shared_demo_account.py backend/db/migrations/models/17_20260501_deactivate_duplicate_challenges.py`
  - `node --check frontend/app/app/challenge/page.js`
  - `npm run build`
  - `git diff --cached --check`
- 반응형 브라우저 자동 점검:
  - Playwright Chromium으로 14개 주요 경로 × 4개 뷰포트 = 56개 조합 검사.
  - 검사 뷰포트: 320, 390, 768, 1366px.
  - 최종 결과: 가로 overflow 0건, 깨진 텍스트 패턴 0건.
- pre-commit:
  - staged Python 파일 ruff check 통과.
- pre-push:
  - backend lint 통과.
  - backend unit test:

```text
421 passed, 2 warnings
```

- push 중 Windows 환경 이슈:
  - 최초 pre-push에서 `TMPDIR=C:\Users\Public\Documents\ESTsoft\CreatorTemp` 권한 문제로 pytest `tmp_path` 생성 실패.
  - 코드 실패가 아니라 로컬 임시폴더 권한 문제였음.
  - `TMP`, `TEMP`, `TMPDIR`을 프로젝트 내부 `.tmp`로 지정하여 재실행했고 정상 통과.
  - 임시 `.tmp/`는 푸시 후 삭제.

### PR 설명 초안

```md
## ✅ PR 요약
- 작업 요약: 아이디/비밀번호 찾기 기능을 추가하고, 주요 프론트 화면을 반응형으로 보정했으며, 챌린지 중복 제거 및 누적 완료 기반 배지 시스템을 구현했습니다.

## 📄 상세 내용
- [x] 로그인 화면에 아이디 찾기/비밀번호 찾기 진입점을 추가하고, 계정 찾기 전용 페이지 및 백엔드 API를 구현했습니다.
- [x] 랜딩, 로그인, 회원가입, 온보딩, 앱 주요 화면의 모바일/태블릿 반응형 UI를 보정하고 PWA manifest/viewport 설정을 추가했습니다.
- [x] 중복 챌린지를 비활성화하고, 챌린지 누적 완료 횟수에 따라 브론즈/실버/골드/다이아/마스터 배지가 표시되도록 구현했습니다.

## 📸 스크린샷 (선택)
- 필요 시 로그인/계정 찾기 화면, 챌린지 배지 현황 화면 캡처를 첨부합니다.

## 📝 기타 참고 사항
- 챌린지 중복 제거를 위해 신규 DB 마이그레이션이 포함되어 있습니다.
- 배지 기준은 브론즈 10회, 실버 30회, 골드 60회, 다이아 100회, 마스터 200회 이상입니다.
- 프론트만이 아니라 백엔드/API 변경도 포함되어 있어 배포 시 백엔드 반영이 필요합니다.

## 🧪 PR Checklist
- [x] 커밋 메시지 컨벤션에 맞게 작성했습니다.
- [x] 변경 사항에 대한 테스트를 했습니다.(버그 수정/기능에 대한 테스트).
  - `npm run build` 통과
  - pre-push backend lint 통과
  - backend unit test `421 passed`
```

### 배포/머지 주의사항

1. 이번 PR은 프론트만이 아니라 백엔드/API/DB 마이그레이션을 포함한다.
   - 배포 후 FastAPI 재시작/이미지 반영 필요.
   - Aerich 마이그레이션 `17_20260501_deactivate_duplicate_challenges.py` 적용 필요.
2. 중복 챌린지 비활성화가 포함되어 있으므로 기존 진행 중인 중복 챌린지는 `cancelled`로 전환된다.
3. `backend/tasks/seed_shared_demo_account.py`에서도 `exercise_3x_week` 씨드 항목을 제거했으므로 데모 재시드 시 14개 기준으로 정리된다.
4. PR 범위가 크다:
   - account recovery
   - responsive UI
   - PWA manifest
   - challenge duplicate cleanup
   - challenge badges
   리뷰 시 섹션별로 확인하는 것이 좋다.
5. 현재 기준 개인/공식 main과 브랜치 베이스는 같아 충돌 위험은 낮지만, 누군가 먼저 새 `17_...` 마이그레이션을 main에 추가하면 파일명/번호 충돌 가능성이 있다.

### 다음 액션

1. GitHub에서 개인레포/공식레포 PR 생성.
2. PR에 위 설명 초안 붙여넣기.
3. 리뷰 전 브라우저에서 최소 확인:
   - `/login` → 아이디/비밀번호 찾기 링크
   - `/account-recovery`
   - `/app/challenge` 배지현황 등급 기준
   - 모바일 폭에서 랜딩/로그인/회원가입 화면 overflow 없음
4. 머지 후 백엔드 배포와 DB 마이그레이션 적용 확인.

---

## 2026-04-30 최신 핸즈오프 / 리포트·챌린지·배포 동기화

### 현재 저장소 상태

- 로컬 `main`, 개인레포 `BIJENG/DANAA_project:main`, 공식레포 `AI-HealthCare-02/AI_02_02:main` 모두 같은 커밋까지 동기화됨.
- 최신 커밋:
  - `8702262 Merge remote-tracking branch 'upstream/main'`
  - 실제 UI 수정 커밋: `147eba5 fix: 리포트 요약과 챌린지 배지 표시 보정`
  - 자동배포 수정 커밋: `79f4c25 fix: EC2 자동배포 컨테이너 교체 보정`
- 현재 작업트리는 이 문서 수정 전 기준으로 clean 상태였음.

### 이번에 완료된 주요 작업

#### 1. 리포트 대시보드 UI 보정

- `frontend/app/app/report/page.js`
- 대시보드 오른쪽 생활습관 카드에 `수면`, `식습관`, `운동` 제목 아래 짧은 상태 설명을 다시 표시하도록 복구.
- 이전 반응형 수정 과정에서 점수 원형 그래프만 남고 설명 텍스트가 빠져 보이던 문제를 보정.
- 검증:
  - `node --check frontend/app/app/report/page.js`
  - `npm run build`

#### 2. 챌린지 배지 표시/매핑 문구 보정

- `frontend/app/app/challenge/page.js`
- `badge_label`, `next_badge_label`, `remaining_to_next_badge`가 없는 항목을 무조건 "현재 최고 등급입니다."로 표시하던 로직을 수정.
- 새 표시 로직:
  - 배지 라벨이 있으면 그대로 표시.
  - `unranked`는 `미획득`.
  - 완료일이 있으면 `진행 중`.
  - 아직 기록이 없으면 `시작 전`.
  - 다음 배지 정보가 없으면 최고 등급으로 단정하지 않고 `N일 더 완료하면 완주 배지에 가까워져요.` 또는 `현재 달성한 배지입니다.`로 표시.
- 사용자에게 보이는 문구는 `뱃지` 대신 `배지`로 정리.
- 검증:
  - `node --check frontend/app/app/challenge/page.js`
  - `npm run build`

#### 3. EC2 자동배포 실패 원인 확인 및 수정

- FastAPI 백엔드 자동배포는 개인레포 `BIJENG/DANAA_project`의 `main` push 기준으로 동작.
- 공식레포 `AI-HealthCare-02/AI_02_02`의 `ghcr-build`는 아래 조건 때문에 의도적으로 skipped:

```yaml
if: github.repository == 'BIJENG/DANAA_project'
```

- 기존 EC2 자동배포 문제:
  - GitHub Actions는 success로 보였지만 EC2 로그 안에서 컨테이너 교체가 실패했음.
  - 원인 로그:

```text
Conflict. The container name "/redis" is already in use
Conflict. The container name "/fastapi" is already in use
```

- 원인:
  - EC2 기존 컨테이너/볼륨은 compose project `project` 기준으로 떠 있었음.
  - 워크플로우는 `COMPOSE_PROJECT_NAME=danaa_project`로 실행되어 기존 `fastapi` 컨테이너를 제대로 잡지 못하고 새로 만들려다 이름 충돌.

- 수정 파일:
  - `.github/workflows/ghcr-build.yml`

- 수정 내용:

```yaml
script_stop: true
script: |
  set -eu
  cd ~/project
  export FASTAPI_IMAGE=ghcr.io/bijeng/danaa-fastapi:latest
  export COMPOSE_PROJECT_NAME=project
  docker compose -f docker-compose.prod.yml pull fastapi
  docker compose -f docker-compose.prod.yml run --rm --no-deps fastapi uv run --no-sync aerich upgrade
  docker compose -f docker-compose.prod.yml stop fastapi
  docker compose -f docker-compose.prod.yml rm -f fastapi
  docker compose -f docker-compose.prod.yml up -d --no-deps fastapi
  docker image prune -af
```

- 효과:
  - 기존 EC2 compose project와 맞춤.
  - `script_stop: true`, `set -eu`로 배포 명령 실패 시 Actions가 실패하도록 보정.
  - migration 실행 시 `--no-deps`로 redis/postgres 재생성 시도를 피함.

- 실제 배포 확인 로그:

```text
Image ghcr.io/bijeng/danaa-fastapi:latest Pulled
Success upgrading to 16_20260429_refresh_challenge_copy.py
Container fastapi Stopped
Container fastapi Removed
Container fastapi Created
Container fastapi Started
```

#### 4. 개인레포/공식레포 동기화

- 개인레포 `main`에는 UI 수정과 자동배포 수정 모두 직접 반영 완료.
- 공식레포 `main`은 기존 PR merge commit이 있어 non-fast-forward가 발생했으나, 로컬에서 `upstream/main`을 정상 merge 후 다시 양쪽 main에 푸시 완료.
- 최종 확인:

```text
HEAD          87022624a5a0f5ca2935c8bbca46fa95c548727e
origin/main   87022624a5a0f5ca2935c8bbca46fa95c548727e
upstream/main 87022624a5a0f5ca2935c8bbca46fa95c548727e
```

### 검증 이력

- `npm run build` 통과.
- pre-push backend lint 통과.
- backend unit test 통과:

```text
421 passed, 2 warnings
```

### 남은 확인 포인트

- Vercel 프론트 자동배포는 Vercel Dashboard에서 확인 필요:
  - 연결된 GitHub repo가 개인레포인지 공식레포인지.
  - Production Branch가 `main`인지.
  - Root Directory가 `frontend`인지.
  - 최신 Deployments의 commit이 `8702262` 또는 최소 `147eba5` 이후인지.
- 백엔드는 개인레포 `main` push 기준 EC2 자동배포가 동작함. 공식레포 main 머지는 현재 설정상 EC2에 직접 배포하지 않음.

---

## 2026-04-29 사이트 피드백 반영 / Codex+Claude 통합 정리

### 작업 배경

사이트 운영 중 수집한 피드백 5건을 Codex + Claude 두 에이전트로 나눠 처리했다.
이후 세션에서 변경사항 전체를 검토·정리하고 Do-it-os 관련 부분만 선택적으로 롤백했다.

---

### 현재 워크스페이스 상태

- 브랜치: `main`
- 커밋되지 않은 변경 파일 (트래킹됨):
  - `backend/apis/v1/user_routers.py`
  - `backend/dtos/users.py`
  - `backend/services/challenge.py`
  - `backend/services/health_daily.py`
  - `backend/services/risk_analysis.py`
  - `backend/tasks/seed_shared_demo_account.py`
  - `backend/tests/integration/test_settings_and_reports.py`
  - `frontend/app/app/challenge/page.js`
  - `frontend/app/app/chat/page.js`
  - `frontend/app/app/report/detail/page.js`
  - `frontend/app/app/report/page.js`
  - `frontend/app/globals.css`
  - `frontend/components/AppGuideModal.js`
  - `frontend/components/MissedQuestionsModal.js`
  - `frontend/components/RightPanelV2.js`
  - `frontend/hooks/useApi.js`
  - `frontend/app/app/layout.js`
  - `frontend/app/app/settings/page.js`
  - `frontend/app/login/page.js`
  - `frontend/app/onboarding/complete/page.js`
  - `frontend/app/page.js`
  - `frontend/app/social-auth/SocialAuthClient.js`
  - `frontend/contexts/ThemeContext.js`
- 미트래킹 신규 파일:
  - `backend/db/migrations/models/14_20260428_add_more_challenge_templates.py`
  - `backend/db/migrations/models/15_20260429_add_active_user_challenge_unique_index.py`
  - `frontend/lib/healthOptionLabels.js`
  - `frontend/public/3d_man.png`, `body-female.png`, `body-man.png`, `man_shadow.png`, `woman_shadow.png`
  - `.codex-review-pr35/`, `.codex-review-pr36/`, `.codex-review-pr37/` (커밋 불필요)
  - 루트 레벨 이미지 파일들 (커밋 불필요)

---

### 피드백 항목별 처리 결과

#### 1. 리포트 대시보드 빈 공간 / 호버 상시 표시 — ✅ Codex 처리

- 좌측 컬럼 292px → 320px, 우측 278px → 314px 확장
- 카드 최소 높이 152px → 182px, 전체 텍스트 크기 9–12px → 10–13px 향상
- `defaultRegionId` 도입: 가장 점수가 낮은 항목이 마우스 호버 없이도 항상 강조됨
  - `focusRegion = hoveredRegion || defaultRegionId`
- 구역 태그(머리/복부/가슴 영역, 연결 상태) 상시 표시로 빈 공간 해소

#### 2. 이메일 인증 오류 — ✅ 코드 버그 수정 + 환경 원인 특정

- **코드 버그**: `formatEmailVerificationError()` 함수가 추가됐으나 실제 에러 표시에서 미사용 →
  `frontend/app/app/settings/page.js` line 485 수정 완료 (SMTP 인증 실패 등이 이제 한국어로 표시됨)
- **환경 원인 (코드 외)**: Gmail 앱 비밀번호(`SMTP_PASSWORD`) 만료 가능성 높음.
  Google 계정 → 보안 → 앱 비밀번호에서 새로 발급 후 `.env` 교체 + 컨테이너 재시작 필요.
  서버 환경에서 587 포트 아웃바운드가 막힌 경우 `SMTP_PORT=465`, `SMTP_USE_SSL=true`로 전환.

#### 3. 동일 브라우저 계정 전환 시 세션 유지 — ✅ Codex 처리

- `useApi.js`에 `syncSessionIdentity()` 추가: 로그인마다 `/api/v1/users/me`로 유저 ID 확인
- 이전 유저 ID와 다르면 `ACCOUNT_SCOPED_LOCAL_KEYS` 전부 삭제
  - 포함 키: `danaa_onboarding`, `danaa_risk`, `danaa_tutorial_pending`, `danaa_challenges`, `danaa_conversations`
  - `danaa_doit_thoughts_v1`는 제외 (Do-it-os 팀원 처리 예정 → 아래 항목 참고)
- `clearToken` → `clearClientSession`으로 교체: 로그아웃 시 계정 스코프 데이터 전부 초기화

#### 4. 비로그인 시 메인화면 접근 — ✅ Codex 처리

- `frontend/components/AppAuthGate.js` 신규 추가
- `frontend/app/app/layout.js`에서 전체 `/app` 경로를 `AppAuthGate`로 감쌈
- 미인증 상태 → `/login?next=현재경로` 자동 리다이렉트
- 인증 완료 후 `syncSessionIdentity()` 호출로 계정 전환 감지

#### 5. Do-it-os 계정 격리 — 🔄 팀원 처리 예정 (롤백 완료)

- Codex가 `useApi.js`의 `ACCOUNT_SCOPED_LOCAL_KEYS`에 `danaa_doit_thoughts_v1` 추가
- 팀원이 Do-it-os 기능 전담 처리 예정 → `danaa_doit_thoughts_v1` 항목 제거로 롤백 완료
- Do-it-os 관련 파일(`frontend/app/app/do-it-os/`, `frontend/components/doit/`, `frontend/lib/doit_store.js`)은
  이번 세션에서 수정하지 않았음

---

### Claude가 이번 세션에서 수정한 것

| 파일 | 내용 |
|------|------|
| `frontend/app/app/report/page.js` | 바디 점 삼각 배치, 점 크기 확대(10→14px 기본 / 14→20px 활성), 범례(관리필요/주의/양호) 항상 표시, 범례 점 색상 인라인 스타일로 고정(globals.css 우선순위 우회), 이미지 overflow 수정, 챌린지 아이콘 코드-이름 매핑 추가 |
| `frontend/app/app/challenge/page.js` | `challengeVisual()` 완전 재작성 — 챌린지별 고유 아이콘 적용(14종 각각 다른 아이콘), `PhoneOff`·`Activity`·`Clock`·`Coffee`·`Leaf` 임포트 추가 |
| `backend/dtos/challenges.py` | `ChallengeRecommendedItem`에 `code: str = ""` 필드 추가 |
| `backend/services/challenge.py` | `_get_recommended()`에서 `code=t.code` 전달 |
| `frontend/app/app/settings/page.js` | `formatEmailVerificationError()` 실제 적용 (에러 메시지 한국어화) |
| `frontend/hooks/useApi.js` | Do-it-os 롤백: `ACCOUNT_SCOPED_LOCAL_KEYS`에서 `danaa_doit_thoughts_v1` 제거 |

---

### Codex가 수정한 것 (유지 중)

| 파일 | 내용 |
|------|------|
| `frontend/hooks/useApi.js` | `clearClientSession`, `syncSessionIdentity`, `establishSession`, `ACCOUNT_SCOPED_LOCAL_KEYS`, `SESSION_USER_KEY` 추가 |
| `frontend/components/AppAuthGate.js` | 신규 — 미인증 시 로그인 리다이렉트 |
| `frontend/app/app/layout.js` | `AppAuthGate` 래퍼 적용 |
| `frontend/app/app/settings/page.js` | 키·체중 입력 필드, 이메일 정규화, SMTP 에러 한국어 함수 추가 |
| `frontend/app/app/report/detail/page.js` | X축 라벨 개선, 날짜 input `max` 속성, 미래 날짜 유효성 검사 |
| `frontend/app/app/report/page.js` | 컬럼 너비 확장, 카드 크기 향상, `defaultRegionId/focusRegion` 추가 |
| `frontend/app/app/challenge/page.js` | `CHALLENGE_COPY` / `challengeCopy()` — 챌린지 이름·설명·cadence·target 태그 |
| `frontend/app/login/page.js` | `setToken` → `establishSession` |
| `frontend/app/onboarding/complete/page.js` | `setToken` → `establishSession` |
| `frontend/app/page.js` | `syncSessionIdentity` 호출 |
| `frontend/app/social-auth/SocialAuthClient.js` | `bootstrap()` 비동기 패턴 |
| `frontend/contexts/ThemeContext.js` | `hasStoredThemePreference()`로 서버 테마 override 방지 |
| `backend/tasks/seed_shared_demo_account.py` | 챌린지 씨드 이름 변경 (물 6→8잔, 채소→끼니마다, 음주줄이기→주2회이하) |

---

### 주요 위험 사항

1. **이메일 인증 환경 이슈**: 코드는 정상이나 Gmail 앱 비밀번호 만료 또는 서버 포트 차단이 원인일 수 있음.
   배포 서버 로그에서 SMTP 에러를 확인하고 앱 비밀번호 재발급 필요.

2. **Do-it-os 계정 격리 미완성**: `danaa_doit_thoughts_v1` 키를 `ACCOUNT_SCOPED_LOCAL_KEYS`에서 제거했으므로
   현재 계정 전환 시 Do-it-os 데이터는 자동 삭제되지 않음. 팀원이 별도 처리 예정.

3. **커밋 전 제외 대상**:
   - `.codex-review-pr35/36/37/` 디렉터리
   - 루트 레벨 이미지 파일들(`3d_man.png`, `female.png`, `male.jpg` 등)
   - `man_shadow.png`, `woman_shadow.png` (루트 위치 사본)

4. **마이그레이션 파일 신규 추가**: `14_`, `15_` 두 개 미트래킹 상태 → 커밋 전 포함 여부 확인 필요

---

### 권장 다음 액션

1. Gmail 앱 비밀번호 재발급 → `.env` 교체 → 컨테이너 재시작 → 이메일 인증 재테스트
2. 브라우저에서 `/app/report` 확인:
   - 좌/우 패널 빈 공간 해소 여부
   - 항상 강조된 상태(가장 위험한 항목)가 올바른지
3. 계정 전환 테스트 (카카오 → 구글):
   - 기존 캐시 데이터 정상 초기화 여부
   - Do-it-os 데이터는 유지되는지 (현재 의도적)
4. 챌린지 페이지 아이콘 확인 — 14종 챌린지 각각 다른 아이콘 표시되는지
5. 커밋 준비 시 `git status --short`로 루트 이미지/codex 리뷰 디렉터리 제외하고 스테이징

---

## 2026-04-28 Report/Text Recovery + 3D Body Asset Handoff

### Current Branch / Workspace State

- Current local branch:
  - `main`
- `origin/main` and local `main` were previously synced, but the current working tree now contains new uncommitted frontend/report/chat updates.
- The largest active surface is no longer backend or onboarding; it is:
  - report dashboard
  - report detail
  - chat right-panel exercise card
  - guide modal sizing/text

### Current Modified Files

Tracked modified files:

- `backend/apis/v1/user_routers.py`
- `backend/dtos/users.py`
- `backend/tasks/seed_shared_demo_account.py`
- `frontend/app/app/challenge/page.js`
- `frontend/app/app/chat/page.js`
- `frontend/app/app/report/detail/page.js`
- `frontend/app/app/report/page.js`
- `frontend/app/globals.css`
- `frontend/components/AppGuideModal.js`
- `frontend/components/MissedQuestionsModal.js`
- `frontend/components/RightPanelV2.js`

Important untracked files currently present:

- `.codex-review-pr35/`
- `.codex-review-pr36/`
- `.codex-review-pr37/`
- `backend/db/migrations/models/14_20260428_add_more_challenge_templates.py`
- `frontend/lib/healthOptionLabels.js`
- `frontend/public/3d_man.png`
- `frontend/public/body-female.png`
- `frontend/public/body-man.png`
- multiple root-level local image references:
  - `3d_man.png`
  - `female.png`
  - `male.jpg`
  - `man.png`
  - several Korean-named screenshot/image files

### What Changed In This 2026-04-28 Pass

#### 1. App Guide Modal (`frontend/components/AppGuideModal.js`)

- The service-guide popup was normalized so tab changes no longer resize the whole modal.
- The `오늘 기록` tab previously expanded the popup differently from `채팅 / 리포트 / 챌린지`.
- The modal now uses:
  - fixed overall height
  - scrollable body section
  - consistent layout regardless of active tab
- Visible guide text was also rewritten into readable Korean.

#### 2. Chat Exercise Panel (`frontend/app/app/chat/page.js`)

- The right-panel exercise section had severe text corruption and displayed question marks.
- The `ExercisePanelV2` block was repaired and normalized.
- Restored visible Korean labels include:
  - 운동
  - 오늘 운동 하셨어요?
  - 했어요 / 못 했어요
  - 걷기
  - 오늘 산책이나 걷기 하셨어요?
  - 운동 종류
  - 운동 시간 (분)
  - 운동 안 했어요로 바꾸기
- Direct numeric minute input remains enabled.

#### 3. Report Dashboard (`frontend/app/app/report/page.js`)

- The dashboard had mixed issues:
  - broken Korean text in the center body-visual section
  - missing/unclear hover feedback text
  - request to replace the center body asset with a 3D figure
- The center visual was updated to use:
  - `frontend/public/3d_man.png`
- The top body card image was also pointed to `3d_man.png`.
- Hover-point feedback was reworked so body-point tooltips are based on lifestyle score status:
  - sleep
  - exercise
  - diet
- Status labels were normalized back to Korean:
  - 관리 필요
  - 주의
  - 양호
  - 참고
- Point titles were normalized to:
  - 수면 · 회복
  - 운동 · 활동량
  - 식습관 · 혈당

#### 4. Report Detail (`frontend/app/app/report/detail/page.js`)

- The detail page had widespread text corruption and displayed `??` across most UI labels.
- Rather than incremental replacement, the file was rewritten into a clean readable Korean version.
- The current rebuilt detail page includes:
  - summary header
  - 3 lifestyle cards
  - trend graph
  - `7일 / 30일 / 직접 선택` range control
  - detail modal for each category
  - action suggestions section
- Visible Korean labels were restored across:
  - headers
  - graph labels
  - button labels
  - empty/loading/error states
  - modal section labels

### Verification Status

The following checks passed after the latest 2026-04-28 recovery pass:

```bash
node --check frontend/app/app/chat/page.js
node --check frontend/app/app/report/page.js
node --check frontend/app/app/report/detail/page.js

cd frontend
npm run build
```

Build status:

- Next.js production build passed successfully.
- `/app/report` compiled successfully.
- `/app/report/detail` compiled successfully.
- `/app/chat` compiled successfully.

### Important Risk Notes

1. Encoding / console-display confusion risk

- Some PowerShell output still renders Korean as mojibake or `??` in console views.
- This can be misleading during review.
- The important signal is:
  - actual file contents
  - browser rendering
  - successful Next.js build

2. Report dashboard file still contains older accumulated logic

- `frontend/app/app/report/page.js` remains a large file with older and newer variants coexisting.
- Even after text recovery, this file should still be treated as a high-risk visual surface.

3. Root-level image clutter remains

- `3d_man.png` was copied into `frontend/public/3d_man.png` for actual app usage.
- The original root-level image file still remains untracked.
- Several other root-level image references also remain untracked and should be cleaned before commit.

4. Backend changes are present but not part of this recovery pass

- There are still tracked backend changes in the workspace.
- They were not revalidated in this handoff step.
- If preparing a PR, do not assume the workspace is frontend-only.

### Recommended Next Action

1. Manually open and visually verify:
   - `/app/chat`
   - `/app/report`
   - `/app/report/detail`
2. Confirm whether `3d_man.png` is the final intended dashboard body asset.
3. Clean or isolate root-level untracked image files before staging.
4. Decide whether to commit this as:
   - one frontend recovery commit, or
   - split report/chat/guide-modal commits.

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

## 2026-04-29 Report / Challenge PR cleanup handoff

### Final asset decision
- Report dashboard body images are finalized as:
  - `frontend/public/3d_blue_man.png`
  - `frontend/public/3d_blue_woman.png`
- `frontend/app/app/report/page.js` now points only to those two files.
- Older experimental body assets such as `3d_man.png`, `body-man.png`, `body-female.png`, `man_shadow.png`, and `woman_shadow.png` are not intended for the PR payload.

### Branch packaging rule
- Include only files actually referenced by the current app code.
- Exclude review scratch directories and root-level loose images:
  - `.codex-review-pr35/`
  - `.codex-review-pr36/`
  - `.codex-review-pr37/`
  - root `3d_blue_man.png`
  - root `3d_blue_woman.png`

### Current PR scope
- Challenge duplicate join protection and icon cleanup
- Chat/right-panel health input text fixes
- Report dashboard/detail rendering and dark-mode adjustments
- Risk recalculation / missed-input reflection updates
- Supporting backend migrations, DTO/service updates, and integration coverage

### Verification before merge
- `frontend`: `npm run build`
- backend pre-push checks:
  - `ruff check`
  - unit tests (`421 passed` when this handoff was written)

### Merge note
- This cleanup is prepared for a personal-repo branch PR targeting personal `main`.
- There was no detected upstream-side conflicting change at packaging time, but only the cleaned branch contents should be merged, not loose local artifacts.

## 2026-04-30 Session Isolation / Push Audit handoff

### Current state
- Same-browser account switching was audited with the rule that user-scoped data must not leak across accounts.
- `/app/*` is behind `AppAuthGate`.
- `/onboarding/*` is now also behind `AppAuthGate` via `frontend/app/onboarding/layout.js`.
- Personal `origin/main` had already been merged into the current work branch before these follow-up changes.

### What changed today
- Added account-scoped client storage helpers in `frontend/hooks/useApi.js`:
  - `syncSessionIdentity`
  - `establishSession`
  - `clearClientSession`
  - `getScopedStorageKey`
- Account-specific frontend state was moved off shared keys and onto `::<userId>`-scoped keys for:
  - onboarding draft
  - risk snapshot
  - tutorial pending / done flags
  - conversations
  - daily chat log cache / schema version
  - missed-questions modal draft
- Updated affected files:
  - `frontend/hooks/useConversations.js`
  - `frontend/app/onboarding/[condition]/page.js`
  - `frontend/app/onboarding/complete/page.js`
  - `frontend/app/app/chat/page.js`
  - `frontend/components/Tutorial.js`
  - `frontend/components/MissedQuestionsModal.js`
- Added auth guard components/files:
  - `frontend/components/AppAuthGate.js`
  - `frontend/app/onboarding/layout.js`
- `frontend/app/app/layout.js` now wraps the app shell with `AppAuthGate`.

### Do it OS note
- Do it OS was explicitly inspected but not modified.
- Existing Do it OS storage keys in `frontend/lib/doit_store.js` were already user-scoped (`getGuideSeenKey`, `getLayoutToastKey`, `getThoughtsStorageKey`).
- Per request, no Do it OS files were edited.

### Background push notification audit
- Browser push flow exists end-to-end in code:
  - frontend registration/subscription:
    - `frontend/lib/pushNotifications.js`
    - `frontend/public/sw.js`
    - `frontend/app/app/settings/page.js`
  - backend routes/service/scheduler:
    - `backend/apis/v1/push_routers.py`
    - `backend/services/push.py`
    - `backend/tasks/push_notifications.py`
    - `backend/tasks/scheduler.py`
- Environment keys for Web Push are present in env templates/local envs:
  - `WEB_PUSH_ENABLED`
  - `WEB_PUSH_VAPID_PUBLIC_KEY`
  - `WEB_PUSH_VAPID_PRIVATE_KEY` / `_B64`
  - `WEB_PUSH_VAPID_SUBJECT`
  - `WEB_PUSH_ACTION_API_BASE`
- `pywebpush` is present in project dependencies / lockfile.
- Important runtime behavior:
  - push tick runs every 10 seconds
  - actual send still requires:
    - browser permission granted
    - valid subscription row
    - `chat_notification=true`
    - `health_question_interval_minutes > 0`
    - onboarding completed
    - due health-question bundle exists
- No dedicated integration test or in-app “send test push now” tool exists yet, so final confirmation still requires a real browser/device check.

### Verification completed
- `node --check` passed for the touched session-isolation files during the work.
- `frontend`: `npm run build` passed after the session-isolation changes.
- Port 3000 stale `node` listener was killed during debugging.

### Remaining manual verification
1. Same browser:
   - login as account A
   - create onboarding/chat/daily/missed-draft state
   - logout
   - login as account B
   - confirm A state does not appear
2. Login-less access:
   - direct-hit `/app/chat`
   - direct-hit `/onboarding/diabetes`
   - confirm redirect to `/login`
3. Background push:
   - enable browser push in settings
   - keep permission granted and OS notifications enabled
   - confirm a due health-question bundle results in a push notification

### Current local worktree notes
- Modified files still include unrelated in-progress UI/auth work:
  - login/signup/settings/report/challenge/theme/chat files
- New files currently present:
  - `frontend/components/AppAuthGate.js`
  - `frontend/app/onboarding/layout.js`
  - `backend/db/migrations/models/16_20260429_refresh_challenge_copy.py`
- Separate review/worktree folders are still present locally:
  - `.pr40-mergecheck/`
  - `.pr40-review-worktree/`
