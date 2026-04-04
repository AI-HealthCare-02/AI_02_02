# TEAM_CHANGELOG.md

## 목적

이 문서는 팀 공용 변경 이력 문서입니다.
구조 변경, API/DB 변경, 실행 환경 변경, 문서 기준 변경, 자동화 추가 같은 중요한 작업을 기록합니다.

이 문서를 보면 아래를 빠르게 파악할 수 있어야 합니다.

- 무엇이 바뀌었는지
- 왜 바뀌었는지
- 어디에 영향이 있는지
- 추가로 확인해야 할 것이 무엇인지

---

## 2026-04-03

### 팀원 인프라 브랜치 기준으로 프로젝트 뼈대 통일

- 작업자: Codex
- 요약:
  - 작업 디렉토리를 팀원 브랜치 `private/refactor/infrastructure` 기준으로 맞춤
  - 현재 기본 구조를 `app/apis/v1`, `app/models`, `app/services`, `app/dtos`, `app/core`, `app/middleware` 기준으로 정리
- 변경 이유:
  - 팀 전체가 같은 뼈대를 기준으로 작업할 수 있게 맞추기 위해
- 영향 범위:
  - 백엔드 폴더 구조
  - 라우터, 서비스, 모델, DTO 위치
- API/DB 영향:
  - 구조 기준 변경
  - API/DB 계약 자체를 새로 확정한 것은 아님
- 확인 필요 사항:
  - 이후 API/DB 명세는 팀 합의 기준 문서와 계속 맞춰야 함

### AI 공통 작업 지침 파일 추가

- 작업자: Codex
- 요약:
  - 루트에 `AGENTS.md` 추가
  - 현재 팀 구조, V2 방향, DB/API 변경 시 사전 고지 원칙을 문서화
- 변경 이유:
  - 이후 프로젝트 질문과 작업 시 공통 기준을 유지하기 위해
- 영향 범위:
  - AI 작업 방식
  - 설명 기준
  - DB/API 변경 고지 방식
- API/DB 영향:
  - 없음

### 마이그레이션 소스 복구 및 Aerich 재작동 확인

- 작업자: Codex
- 요약:
  - `app/db/migrations/models/`에 실제 migration 소스가 없는 상태를 정리
  - 현재 모델 기준 초기 migration 파일 `0_20260403200603_init.py` 생성
  - `aerich upgrade`, `aerich migrate` 정상 동작 확인
- 변경 이유:
  - 배포, 테스트, CI/CD 전에 DB migration이 실제로 되는 상태인지 먼저 확보해야 했기 때문
- 영향 범위:
  - DB migration 실행 경로
  - 이후 schema 변경 시 `aerich migrate`, `aerich upgrade` 사용 가능
- API/DB 영향:
  - migration 소스 복구
  - DB에 migration 기록 반영
- 확인 필요 사항:
  - 운영/공용 DB 적용 전 migration 이력 정책은 팀에서 한 번 더 확인 필요

### 도커 실행 환경을 팀원 기준으로 재정렬

- 작업자: Codex
- 요약:
  - 기존 로컬 PostgreSQL 17 볼륨 제거
  - 팀원 기준 `postgres:16-alpine`으로 재생성
  - `fastapi`, `postgres`, `redis` 재기동
  - 빈 DB에 migration 재적용
- 변경 이유:
  - 팀원 Docker 스택과 로컬 PostgreSQL 버전이 달라 컨테이너가 unhealthy 상태였기 때문
- 영향 범위:
  - 로컬 Docker 개발 환경
  - PostgreSQL 버전
  - 로컬 DB 데이터
- API/DB 영향:
  - 로컬 PostgreSQL 데이터 초기화
  - 새 `postgres:16` 환경에 테이블 재생성
- 확인 필요 사항:
  - 기존 로컬 테스트 데이터는 삭제됨

### 핵심 실행 검증 1차 완료

- 작업자: Codex
- 요약:
  - Swagger 접속 확인
  - `signup -> consent -> onboarding` 흐름 성공 확인
  - BMI, FINDRISC, risk level 계산 응답 확인
  - PostgreSQL에서 `health_profiles`, `user_consents` 저장 확인
- 변경 이유:
  - 현재 팀원 구조와 Docker 환경이 실제로 동작하는지 수동 검증이 필요했기 때문
- 영향 범위:
  - 인증 흐름
  - 동의 저장 흐름
  - 온보딩 저장 흐름
- API/DB 영향:
  - `users`, `user_consents`, `health_profiles`에 테스트 데이터 생성
- 확인 결과:
  - `POST /api/v1/auth/signup` 성공
  - `POST /api/v1/auth/consent` 성공
  - `POST /api/v1/onboarding/survey` 성공
  - 응답값:
    - `health_profile_id = 1`
    - `user_group = C`
    - `bmi = 26.1`
    - `initial_findrisc_score = 13`
    - `initial_risk_level = high`
  - DB 저장 확인:
    - `health_profiles` 1건
    - `user_consents` 1건

### 문서 정합성 및 기본 품질 점검

- 작업자: Codex
- 요약:
  - `README`, `QUICK_START`, `DEVELOPMENT_WORKFLOWS`, `TEAM_AI_PROMPT`를 현재 실행 기준에 맞게 정리
  - 자동 CI가 있는 것처럼 보이던 설명을 현재 상태에 맞게 수정
  - 챌린지 API 경로를 실제 라우터 기준으로 `/api/v1/challenges/...`로 수정
- 변경 이유:
  - main 반영 전에 공용 문서와 실제 코드가 어긋나는 부분을 줄이기 위해
- 영향 범위:
  - 팀 온보딩 문서
  - 작업 흐름 문서
  - AI 참고 문서
- API/DB 영향:
  - 없음
- 확인 결과:
  - `pytest app/tests/unit -q` 통과 (`31 passed`)
  - `ruff check app` 통과

### GitHub Actions 기본 CI 추가

- 작업자: Codex
- 요약:
  - `.github/workflows/checks.yml` 추가
  - `push`, `pull_request` 시 Python 3.13 환경에서 기본 검사 실행
- 변경 이유:
  - main 반영 이후 최소한의 자동 검증 체계를 바로 쓰기 위해
- 영향 범위:
  - GitHub push / PR 자동 검사
- API/DB 영향:
  - 없음
- 현재 자동화 범위:
  - `uv sync --group app --group dev`
  - `uv run ruff check app`
  - `uv run pytest app/tests/unit -q`
- 확인 필요 사항:
  - integration 테스트와 migration 검증은 아직 수동 점검 범위
