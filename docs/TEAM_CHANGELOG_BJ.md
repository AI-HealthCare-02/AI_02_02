# TEAM_CHANGELOG_BJ.md

## 목적

이 문서는 BJ 작업 이력을 기록하는 개인 changelog입니다.

---

## 2026-04-07

### clean-main 구조 기준 문서와 CI/CD 정리

- 작업자: BJ
- 요약:
  - 공용 기준 구조를 `backend/`, `workers/ai/`, `frontend/` 기준으로 재정리
  - `ghcr-build.yml`과 `backend/Dockerfile` 기준 경로 복구
  - `docker-compose.prod.yml`의 `FASTAPI_IMAGE` 기반 EC2 배포 흐름 정리
  - `README`, `ARCHITECTURE`, `DEVELOPMENT_WORKFLOWS`, `DOCUMENT_REGISTRY`, `TEAM_AI_PROMPT`를 현재 구조 기준으로 최신화
  - 개인 handoff 문서 `docs/HANDOFF_MEMO.md`는 로컬 추적용으로 제외하고 ignore 처리
- 변경 이유:
  - `clean-main`을 공통 기준 브랜치로 쓰면서 문서와 CI/CD 설명이 이전 구조를 계속 가리키고 있었음
- 영향 범위:
  - GitHub Actions 경로
  - 운영 배포 문서
  - 공용 구조 안내 문서
  - 개인 메모 추적 정책
- API/DB 영향:
  - 없음
- 확인 결과:
  - `uv run ruff check backend` 통과
  - `uv run python -m pytest backend/tests/unit -q` 통과 (`179 passed`)

## 2026-04-10

### auth/onboarding/frontend sync 정리

- 작업자: BJ
- 요약:
  - 프론트 `signup`을 백엔드 email verification 요청 스키마에 맞게 정리
  - 로그인 이후 온보딩 상태 분기를 `is_completed` 기준으로 수정
  - 온보딩 완료 페이지가 실제로 `consent`와 `survey`를 서버에 저장하도록 연결
  - 소셜 로그인과 이메일 인증 구경로가 동작하도록 백엔드 auth alias 추가
  - 사이드바 사용자명/온보딩 상태를 localStorage 대신 API 기준으로 로드하도록 수정
- 변경 이유:
  - main에 머지된 프론트와 로컬 백엔드 추가 기능이 일부 경로와 상태 필드에서 어긋나 있었고, 온보딩 완료가 화면상만 끝나고 DB에 저장되지 않는 구간이 있었음
- 영향 범위:
  - `backend/apis/v1/auth_routers.py`
  - `frontend/app/login/page.js`
  - `frontend/app/signup/page.js`
  - `frontend/app/onboarding/complete/page.js`
  - `frontend/components/Sidebar.js`
  - `docs/HANDOFF_MEMO.md`
- 확인 결과:
  - `npm run build` 통과
  - 백엔드 로그에서 `POST /api/v1/auth/consent` 201 확인
  - 백엔드 로그에서 `POST /api/v1/onboarding/survey` 201 확인
  - DB에서 `users.onboarding_completed = true` 및 `health_profiles` 생성 확인
