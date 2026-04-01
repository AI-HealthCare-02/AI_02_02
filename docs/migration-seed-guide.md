# 마이그레이션과 시드 가이드

## 핵심 원칙

마이그레이션은 서비스 실행 테스트가 아니라 DB 스키마 반영 작업입니다.

- 모델 구조 변경
- 테이블 생성/수정
- 컬럼/제약/인덱스 반영

즉:

- 마이그레이션 = DB 구조 반영
- Docker 실행 확인 = 서비스 기동 확인

## 현재 상태

- PostgreSQL 기준 초기 마이그레이션 적용 완료
- 기준 파일: [app/db/migrations/models/0_20260401182144_init.py](/abs/path/C:/PycharmProjects/DANAA_project/app/db/migrations/models/0_20260401182144_init.py)
- 현재 모델 기준 추가 마이그레이션 없음

## 로컬에서 중요한 점

로컬 터미널에서 `aerich`를 실행할 때는 `DB_HOST=localhost`여야 합니다.

이 저장소는 아래처럼 동작하도록 맞춰져 있습니다.

- `.env` 기본값: `DB_HOST=localhost`
- `docker compose` 안의 `fastapi`, `ai-worker`: 자동으로 `DB_HOST=postgres` override

즉, 팀원은 `.env`를 로컬 기준으로 두고 그대로 써도 됩니다.

## 대표 1명이 먼저 할 작업

```bash
docker compose up -d postgres redis
uv sync --group app --group dev --frozen
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
uv run pytest app/tests -q
```

## 새 모델 변경이 생겼을 때

```bash
docker compose up -d postgres redis
uv run aerich migrate --name <change_name>
uv run aerich upgrade
```

예:

```bash
uv run aerich migrate --name add_health_indexes
```

## 챌린지 시드

시드 위치:

- [app/db/seeds/challenge_templates.py](/abs/path/C:/PycharmProjects/DANAA_project/app/db/seeds/challenge_templates.py)

실행:

```bash
uv run python -m app.db.seeds.challenge_templates
```

## 팀원이 pull 받은 뒤 해야 하는 것

```bash
uv sync --group app --group dev --frozen
docker compose up -d postgres redis
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
uv run pytest app/tests -q
```

## 체크 포인트

1. `docker ps`에 `postgres`, `redis`가 떠 있는지 확인
2. `uv run aerich upgrade`가 `No upgrade items found` 또는 정상 적용으로 끝나는지 확인
3. Swagger가 `http://localhost/api/docs`에서 열리는지 확인
4. 테스트가 로컬에서 통과하는지 확인
