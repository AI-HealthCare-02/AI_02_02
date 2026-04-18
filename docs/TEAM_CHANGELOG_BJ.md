# TEAM_CHANGELOG_BJ.md

## 목적

BJ 작업 이력을 기록하는 개인 changelog입니다.

---

## 2026-04-07

### clean-main 구조 기준 문서와 CI/CD 정리

- 작업자: BJ
- 요약:
  - 공용 기준 구조를 `backend/`, `workers/ai/`, `frontend/` 기준으로 재정리
  - `ghcr-build.yml`과 `backend/Dockerfile` 기준 경로 복구
  - `docker-compose.prod.yml`의 `FASTAPI_IMAGE` 기반 EC2 배포 흐름 정리
  - `README`, `ARCHITECTURE`, `DEVELOPMENT_WORKFLOWS`, `DOCUMENT_REGISTRY`, `TEAM_AI_PROMPT`를 현재 구조 기준으로 최신화
  - 개인 handoff 문서 `docs/HANDOFF_MEMO.md`를 로컬 추적용으로 분리
- 확인 결과:
  - `uv run ruff check backend` 통과
  - `uv run python -m pytest backend/tests/unit -q` 통과

## 2026-04-10

### auth / onboarding / frontend sync 정리

- 작업자: BJ
- 요약:
  - `signup`을 백엔드 email verification 요청 스키마에 맞게 정리
  - 로그인 이후 온보딩 상태 분기를 `is_completed` 기준으로 수정
  - 온보딩 완료 페이지가 실제로 `consent`, `survey`를 서버에 저장하도록 연결
  - 소셜 로그인과 이메일 인증 경로 동작 보완
  - 사이드바 사용자명 / 온보딩 상태를 localStorage 대신 API 기준으로 로드
- 영향 범위:
  - `backend/apis/v1/auth_routers.py`
  - `frontend/app/login/page.js`
  - `frontend/app/signup/page.js`
  - `frontend/app/onboarding/complete/page.js`
  - `frontend/components/Sidebar.js`
  - `docs/HANDOFF_MEMO.md`
- 확인 결과:
  - `npm run build` 통과

## 2026-04-17

### theme/light reset + contrast cleanup + sidebar palette recovery

- 작업자: BJ
- 요약:
  - 앱 기본 테마를 `light`로 전환
  - 로그인 화면을 white/light 기준으로 재구성
  - 메인 랜딩의 흐린 텍스트를 직접 진한 색으로 정리
  - 사이드바 배경색을 메인 브랜치 화이트톤으로 복구
  - 하단 질환 선택은 위로 펼치고 `당뇨` 외 선택을 막도록 수정
  - handoff 문서에 theme/contrast/sidebar 변경 내역 추가
- 영향 범위:
  - `frontend/app/layout.js`
  - `frontend/contexts/ThemeContext.js`
  - `frontend/app/globals.css`
  - `frontend/app/login/page.js`
  - `frontend/app/page.js`
  - `frontend/components/Sidebar.js`
  - `docs/HANDOFF_MEMO.md`
- 확인 결과:
  - `npm run build` 통과
