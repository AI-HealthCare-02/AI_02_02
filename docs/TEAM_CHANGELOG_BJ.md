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
# 2026-04-22

## health engagement UX 개선

- 작업자: BJ
- 요약:
  - 메인 채팅 화면에 사용자 대화 기반 영상 추천 기능 추가
  - Web Push 기반 백그라운드 건강 질문 알림 추가
  - 오른쪽 Today 패널의 식사/수면 문구와 저장 피드백 정리
  - 미입력 항목 모달을 드롭다운 선택 후 일괄 저장하는 방식으로 개선
  - 챌린지 수행 버튼을 `수행 완료`/`완료 취소` 토글로 변경
  - 신규/기록 부족 사용자를 위한 리포트 fallback 카드와 점수 영향 요인 카드 추가
  - 로그인 실패 사유를 사용자 기준 문구로 세분화
- DB/API 영향:
  - `user_settings.health_question_interval_minutes` 추가
  - `push_subscriptions` 테이블 추가
  - `/api/v1/push/*`, `/api/v1/recommendations/videos` 라우터 추가
- 배포 체크:
  - FastAPI 재빌드
  - Aerich `fix-migrations` 후 `upgrade`
  - 프론트 재빌드
  - Web Push 사용 환경은 VAPID env 설정 필요
- 확인 결과:
  - `uv run ruff check backend frontend` 통과
  - backend unit tests `278 passed`
  - 주요 프론트 파일 `node --check` 통과
