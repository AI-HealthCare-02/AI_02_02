# DANAA_project

다나아 서비스의 백엔드 프로젝트입니다.

이 저장소는 팀원이 바로 개발을 시작할 수 있도록 만든 기본 뼈대입니다.
처음 보는 사람은 이 `README`부터 끝까지 읽고, 필요한 경우 아래 문서로 내려가면 됩니다.

## 이 프로젝트가 뭐예요?

쉽게 말하면:

- 건강 데이터를 기록하고
- 위험도와 습관을 분석하고
- 챌린지 기능으로 행동 변화를 돕는
- FastAPI 기반 백엔드 프로젝트입니다.

현재는 다음 상태입니다.

- 프로젝트 구조 정리 완료
- PostgreSQL 기준 DB 모델/초기 마이그레이션 완료
- 챌린지 시드 데이터 준비 완료
- API 계약 v1.1 기준 스켈레톤 반영 완료
- 팀원이 바로 실행하고 개발 시작할 수 있는 환경 정리 완료

주의:

- 지금은 "기본 뼈대 + API 계약 스켈레톤" 상태입니다.
- 즉, 라우터/스키마/DB 구조는 많이 잡혀 있지만, 실제 서비스 로직은 기능별로 계속 채워야 합니다.

## 기술 스택

### Backend

- Python 3.13
- FastAPI
- Pydantic
- Tortoise ORM
- Aerich

### Database / Cache

- PostgreSQL
- Redis

### Infra / Tooling

- Docker Compose
- uv
- pytest
- Ruff
- GitHub Actions

## 프로젝트 구조

```text
DANAA_project/
├── ai_worker/                  # AI 워커 뼈대
├── app/
│   ├── apis/                   # FastAPI 라우터
│   ├── core/                   # 설정, 공통 유틸
│   ├── db/                     # DB 연결, 마이그레이션, 시드
│   ├── dependencies/           # 인증 등 FastAPI 의존성
│   ├── domains/                # 핵심 도메인 로직
│   │   ├── health/             # 건강 데이터 도메인
│   │   └── challenges/         # 챌린지 도메인
│   ├── dtos/                   # 기존 auth/user DTO
│   ├── models/                 # 기존 공통 모델(User)
│   ├── repositories/           # 기존 auth/user repository
│   ├── services/               # 기존 auth/user service
│   ├── tests/                  # 테스트
│   └── main.py                 # FastAPI 앱 진입점
├── docs/                       # 팀 문서
├── envs/                       # 환경변수 예시
├── nginx/                      # Nginx 설정
├── scripts/                    # 보조 스크립트
├── docker-compose.yml
├── docker-compose.prod.yml
└── pyproject.toml
```

처음에는 이렇게 이해하면 충분합니다.

- API 추가: `app/apis/v1`
- DB 모델 확인: `app/domains/*/models.py`
- 요청/응답 스키마 확인: `app/domains/*/schemas.py`
- 테스트 확인: `app/tests`

## 팀원이 가장 먼저 읽어야 하는 문서

1. [README.md](/abs/path/C:/PycharmProjects/DANAA_project/README.md)
2. [docs/collaboration-standards.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/collaboration-standards.md)
3. [docs/migration-seed-guide.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/migration-seed-guide.md)
4. [docs/project-structure.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/project-structure.md)
5. [docs/handoff.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/handoff.md)

## 개발 시작 전에 꼭 알아야 하는 것

### 1. 로컬 실행과 Docker 실행은 DB_HOST가 다릅니다

이 프로젝트는 의도적으로 이렇게 나뉘어 있습니다.

- 로컬 터미널에서 `uv run`, `pytest`, `aerich` 실행할 때: `DB_HOST=localhost`
- Docker 컨테이너 안의 `fastapi`, `ai-worker`: `DB_HOST=postgres`

이건 이미 설정해두었습니다.

- `.env`와 `.env.example`은 로컬 기준
- `docker-compose.yml`에서 컨테이너용 `DB_HOST=postgres` override

즉, 팀원은 `.env`를 로컬 기준 그대로 써도 됩니다.

### 2. 현재 AI worker는 선택사항입니다

기본 개발 흐름에서는 `postgres`, `redis`, `fastapi`만 쓰면 됩니다.
`ai-worker`는 아직 실제 태스크 연결 전이라 필요할 때만 별도 profile로 실행합니다.

### 3. API는 전부 완성된 상태가 아닙니다

현재 많이 반영되어 있는 것은:

- 라우터 경로
- 요청/응답 스키마
- 기본 응답 구조
- DB 모델

아직 기능별로 더 구현해야 하는 것은:

- 실제 DB 저장/조회 로직
- 검증 규칙
- 분석 계산 로직
- 챌린지 자동판정
- AI worker 실제 작업

## 처음 실행하는 방법

처음 받았을 때는 아래 순서대로 하면 됩니다.

### 1. 의존성 설치

```bash
uv sync --group app --group dev --frozen
```

### 2. 환경 변수 파일 준비

`.env.example`을 참고해서 `.env`를 준비합니다.

기본적으로 필요한 값:

- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_USER=postgres`
- `DB_PASSWORD=...`
- `DB_NAME=ai_health`
- `SECRET_KEY=...`

### 3. PostgreSQL / Redis 실행

```bash
docker compose up -d postgres redis
```

### 4. 마이그레이션 적용

```bash
uv run aerich upgrade
```

### 5. 챌린지 시드 입력

```bash
uv run python -m app.db.seeds.challenge_templates
```

### 6. 테스트 실행

```bash
uv run pytest app/tests -q
```

현재 기준 테스트 상태:

- `12 passed`

### 7. 서버 실행

로컬에서 FastAPI만 실행:

```bash
uv run uvicorn app.main:app --reload
```

접속:

- Swagger: `http://localhost/api/docs`
- OpenAPI JSON: `http://localhost/api/openapi.json`

### 8. 전체 Docker 실행이 필요할 때

```bash
docker compose up -d --build
```

AI worker까지 띄우고 싶으면:

```bash
docker compose --profile ai up -d --build ai-worker
```

## 브랜치 전략

자세한 내용은 [docs/collaboration-standards.md](/abs/path/C:/PycharmProjects/DANAA_project/docs/collaboration-standards.md)에 있지만, 처음에는 이것만 기억하면 됩니다.

- `main`: 안정 브랜치
- 모든 작업은 새 브랜치에서 시작
- `main` 직접 push 금지
- 작업 후 PR로 반영

브랜치 이름 예시:

- `feat/onboarding-survey`
- `feat/health-daily-patch`
- `fix/postgres-test-host`
- `docs/readme-update`
- `refactor/auth-service`
- `test/health-router`

## 커밋 메시지 규칙

간단히 아래 형식을 사용합니다.

- `feat: 새로운 기능`
- `fix: 버그 수정`
- `docs: 문서 수정`
- `refactor: 리팩토링`
- `test: 테스트 추가/수정`
- `chore: 설정, 빌드, 환경 정리`

예시:

- `feat: add onboarding survey skeleton`
- `fix: align local postgres host for tests`
- `docs: rewrite beginner onboarding guide`

## 지금 팀원이 어디부터 작업하면 되나요?

처음 개발하는 사람은 보통 아래 순서가 편합니다.

1. `README` 읽기
2. `docs/collaboration-standards.md` 읽기
3. 로컬 실행 성공시키기
4. Swagger 열어보기
5. 본인 담당 도메인 폴더 확인
6. 관련 테스트 파일 보기
7. 본인 브랜치 생성 후 작업 시작

## 자주 헷갈리는 질문

### Q1. 왜 `.env`는 localhost인데 Docker는 잘 돌아가나요?

`docker-compose.yml`에서 컨테이너 내부 환경변수로 `DB_HOST=postgres`를 따로 넣어주기 때문입니다.

### Q2. 마이그레이션이 새로 생성되지 않아요

현재 모델 기준으로는 이미 초기 마이그레이션이 반영되어 있어서 정상일 수 있습니다.
이 경우 `No changes detected`가 뜹니다.

### Q3. 테스트가 DB 연결 에러로 실패해요

보통 아래 둘 중 하나입니다.

- `docker compose up -d postgres redis`를 안 했음
- `.env`의 `DB_HOST`가 `localhost`가 아님

### Q4. AI worker는 꼭 실행해야 하나요?

아직 아닙니다.
지금은 선택사항입니다.

## 현재 구현 상태 한 줄 요약

이 저장소는 팀원이 바로 받아서 실행하고 작업을 시작할 수 있는 백엔드 기본 골격이며, 이제 각 기능을 브랜치 단위로 실제 구현해 나가면 됩니다.
