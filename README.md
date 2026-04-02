# DANAA Backend

당뇨/생활습관 관리 서비스 `DANAA`의 백엔드 저장소입니다.

현재 이 저장소는 아래 목표에 맞춰 정리되어 있습니다.

- 최종 확정 DB/API 문서를 기준으로 협업 가능한 골격 유지
- FastAPI + PostgreSQL + Redis 기반 개발 환경 통일
- 도메인별 작업 위치와 책임 분리
- 실제 구현 전에도 팀원이 같은 기준으로 문서, 코드, 마이그레이션을 볼 수 있게 정리

## 기준 문서

- DB 기준: [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- API 기준: [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- 엑셀 기준: [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)
- 구조/스택 근거: [backend-baseline-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-baseline-2026-04-02.md)
- 구조 변경 요약: [backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)
- 입문 가이드: [backend-start-guide-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-start-guide-2026-04-02.md)

## 현재 스택

- Python 3.13
- FastAPI
- Pydantic v2
- Tortoise ORM
- Aerich
- PostgreSQL
- Redis
- Docker Compose
- uv
- pytest / Ruff

## 왜 지금은 이 스택을 유지하나

현재 코드, 테스트, 마이그레이션이 이미 `FastAPI + Tortoise + Aerich`를 기준으로 움직이고 있습니다.  
지금 단계에서 ORM까지 교체하면 협업 골격을 만드는 대신 마이그레이션 자체가 프로젝트가 됩니다.

그래서 이번 정리는 아래 원칙으로 갔습니다.

- 앱 실행 스택은 유지
- 대신 도메인 경계와 작업 위치를 명확하게 재정리
- 리포지토리/서비스 레이어를 추가할 수 있는 골격부터 먼저 고정
- 추후 ORM 전환이 필요하면 그때 도메인 레이어를 기준으로 교체

## 프로젝트 구조

```text
app/
  api/                  # 현재 기준 API 진입점
  apis/v1/              # 실제 FastAPI 라우터
  core/                 # 설정, 로깅
  db/                   # DB 연결, 모델 레지스트리, migrations, seeds
  dependencies/         # FastAPI dependency
  domains/
    common/             # 공용 base model
    health/             # 건강 데이터 도메인
    challenges/         # 챌린지 도메인
    onboarding/         # 온보딩 서비스/리포지토리 작업 위치
    reports/            # 위험도/리포트 서비스 작업 위치
    settings/           # 설정 서비스 작업 위치
  dtos/                 # 기존 auth/user DTO
  models/               # 기존 공용 User 모델
  repositories/         # 기존 auth/user repository
  services/             # 기존 auth/user service
  tests/                # 테스트
  bootstrap.py          # 앱 팩토리
  main.py               # uvicorn 진입점
docs/
  DANAA_DB명세최종확정안_2026-04-02.md
  DANAA_API최종확정안_2026-04-02.md
  DANAA_DB명세확정안_엑셀_2026-04-02.xlsx
  backend-baseline-2026-04-02.md
  handoff.md
  collaboration-standards.md
  migration-seed-guide.md
```

## 빠른 시작

### 1. 의존성 설치

```bash
uv sync --group app --group dev --frozen
```

### 2. 인프라 실행

```bash
docker compose up -d postgres redis
```

### 3. 마이그레이션 적용

```bash
uv run aerich upgrade
```

### 4. 시드 입력

```bash
uv run python -m app.db.seeds.challenge_templates
```

### 5. 테스트

```bash
uv run pytest app/tests -q
```

### 6. 앱 실행

```bash
uv run uvicorn app.main:app --reload
```

접속:

- Swagger: `http://localhost:8000/api/docs`
- OpenAPI: `http://localhost:8000/api/openapi.json`

## 협업 시작 전에 읽을 문서

1. [docs/collaboration-standards.md](/C:/PycharmProjects/DANAA_project/docs/collaboration-standards.md)
2. [docs/migration-seed-guide.md](/C:/PycharmProjects/DANAA_project/docs/migration-seed-guide.md)
3. [docs/handoff.md](/C:/PycharmProjects/DANAA_project/docs/handoff.md)
4. [docs/backend-baseline-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-baseline-2026-04-02.md)
5. [docs/backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)
6. [docs/backend-start-guide-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-start-guide-2026-04-02.md)

## 다음 구현 우선순위

1. 온보딩 저장 로직을 실제 DB에 연결
2. `daily_health_logs` patch/batch 검증 규칙 구현
3. 챌린지 overview/join/checkin/calendar 서비스 구현
4. risk / analysis / settings / internal cron 서비스 구현
5. 문서 기준값과 모델/스키마 동기화
