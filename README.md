# DANAA_project

다나아 서비스의 백엔드 기본 저장소입니다. 현재 기준 기본 스택은 `FastAPI + Tortoise ORM + PostgreSQL + Redis + Docker Compose`입니다.

## 현재 상태

- PostgreSQL 기준 초기 마이그레이션 적용 완료
- 챌린지 시드 준비 완료
- API 계약 v1.1 기준 라우터 스켈레톤 반영 완료
- 팀원이 바로 붙을 수 있도록 로컬/도커 DB 호스트 설정 분리 완료

주의:
- 현재 `app/apis/v1/*`의 상당수 엔드포인트는 계약 스켈레톤입니다.
- 응답 구조와 경로는 맞췄지만, 실제 서비스 로직은 아직 순차 구현이 필요합니다.

## 구조

```text
.
├── ai_worker/
├── app/
│   ├── apis/
│   ├── core/
│   ├── db/
│   ├── dependencies/
│   ├── domains/
│   │   ├── health/
│   │   └── challenges/
│   ├── dtos/
│   ├── models/
│   ├── repositories/
│   ├── services/
│   ├── tests/
│   └── main.py
├── docs/
├── envs/
├── nginx/
├── scripts/
├── docker-compose.yml
├── docker-compose.prod.yml
└── pyproject.toml
```

## 팀 시작 순서

### 1. 의존성 설치

```bash
uv sync --group app --group dev --frozen
```

### 2. 환경 변수 준비

```bash
cp .env.example .env
```

기본 로컬 기준값:

- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_USER=postgres`
- `DB_NAME=ai_health`

중요:
- 로컬 터미널에서 `uv run`, `pytest`, `aerich`를 돌릴 때는 `DB_HOST=localhost`가 맞습니다.
- `docker compose` 안의 `fastapi`, `ai-worker` 컨테이너는 compose 파일에서 자동으로 `DB_HOST=postgres`로 override 됩니다.

### 3. DB/캐시 실행

```bash
docker compose up -d postgres redis
```

### 4. 마이그레이션 적용

```bash
uv run aerich upgrade
```

현재 기준:
- 새 설계 반영 후 추가 마이그레이션은 없고, `0_20260401182144_init.py`가 기준입니다.

### 5. 챌린지 시드 입력

```bash
uv run python -m app.db.seeds.challenge_templates
```

### 6. API 실행

앱만 로컬 실행:

```bash
uv run uvicorn app.main:app --reload
```

전체 실행:

```bash
docker compose up -d --build
```

AI 워커까지 필요할 때만:

```bash
docker compose --profile ai up -d --build ai-worker
```

접속:

- Swagger: `http://localhost/api/docs`
- FastAPI 직접 포트: `http://localhost:8000`

## 테스트

로컬 PostgreSQL 컨테이너가 떠 있어야 합니다.

```bash
docker compose up -d postgres redis
uv run pytest app/tests -q
```

테스트 설정은 `DB_HOST=postgres`가 들어 있어도 자동으로 `localhost`를 fallback 하도록 맞춰뒀습니다.

## 문서

팀원이 먼저 읽어야 할 문서:

1. [docs/project-structure.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/project-structure.md)
2. [docs/collaboration-standards.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/collaboration-standards.md)
3. [docs/migration-seed-guide.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/migration-seed-guide.md)
4. [docs/platform-architecture.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/platform-architecture.md)
5. [docs/phase1-contract.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/phase1-contract.md)
6. [docs/handoff.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/handoff.md)

## 현재 남은 구현 작업

- 온보딩/건강데이터/챌린지의 실제 DB 저장 로직 연결
- First Answer Wins, 그룹 제한, 야간 차단 등 계약 규칙 구현
- 분석/설정/채팅/cron API의 실제 서비스 계층 구현
- AI worker 태스크 연결
