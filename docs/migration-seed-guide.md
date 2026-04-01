# 마이그레이션 / 시드 가이드

이 문서는 DB 관련 작업이 처음인 팀원을 위한 가이드입니다.

## 먼저 이해할 것

### 마이그레이션이 뭐예요?

쉽게 말하면:

- Python 코드에 있는 DB 모델 구조를
- 실제 PostgreSQL 테이블 구조에 반영하는 작업입니다.

예를 들면 이런 것들입니다.

- 테이블 만들기
- 컬럼 추가/수정
- unique 제약 추가
- 인덱스 반영

즉:

- 모델 변경 = 코드 변경
- 마이그레이션 = DB 반영

### 시드(seed)가 뭐예요?

처음 개발할 때 필요한 기본 데이터를 DB에 넣는 작업입니다.

이 프로젝트에서는 대표적으로 챌린지 템플릿 데이터를 넣습니다.

## 현재 상태

현재 이 프로젝트는 아래 상태입니다.

- PostgreSQL 기준 초기 마이그레이션 적용 완료
- 기준 마이그레이션 파일 존재
- 챌린지 시드 파일 준비 완료

기준 파일:

- [app/db/migrations/models/0_20260401182144_init.py](/abs/path/C:/PycharmProjects/DANAA_project/app/db/migrations/models/0_20260401182144_init.py)
- [app/db/seeds/challenge_templates.py](/abs/path/C:/PycharmProjects/DANAA_project/app/db/seeds/challenge_templates.py)

## 처음 세팅할 때 순서

### 1. DB와 Redis 켜기

```bash
docker compose up -d postgres redis
```

### 2. 마이그레이션 적용

```bash
uv run aerich upgrade
```

### 3. 챌린지 시드 넣기

```bash
uv run python -m app.db.seeds.challenge_templates
```

### 4. 테스트로 확인

```bash
uv run pytest app/tests -q
```

## 새 모델을 추가하거나 모델을 바꿨을 때

코드에서 DB 모델이 바뀌면 아래 순서로 진행합니다.

### 1. 새 마이그레이션 생성

```bash
uv run aerich migrate --name <change_name>
```

예시:

```bash
uv run aerich migrate --name add_risk_indexes
```

### 2. 마이그레이션 적용

```bash
uv run aerich upgrade
```

## 로컬에서 자주 헷갈리는 부분

### 왜 `.env`는 localhost인데 Docker는 postgres를 쓰나요?

로컬 터미널과 Docker 컨테이너의 네트워크 기준이 다르기 때문입니다.

- 로컬 터미널에서 실행: `DB_HOST=localhost`
- Docker 컨테이너 내부에서 실행: `DB_HOST=postgres`

이 프로젝트는 이미 그렇게 동작하도록 맞춰져 있습니다.

즉, 팀원은 로컬에서 그냥 `.env` 기준대로 써도 됩니다.

## 문제가 생기면 먼저 볼 것

### 1. `aerich upgrade`가 실패할 때

먼저 아래를 확인합니다.

- `docker compose up -d postgres redis`를 했는지
- `.env`의 `DB_HOST`가 `localhost`인지
- PostgreSQL 컨테이너가 healthy 상태인지

### 2. `No changes detected`가 뜰 때

항상 문제는 아닙니다.

의미:

- 현재 모델과 기존 마이그레이션이 이미 일치한다는 뜻일 수 있습니다.

### 3. 시드 실행이 안 될 때

보통은 아래 둘 중 하나입니다.

- DB가 아직 안 떠 있음
- 마이그레이션 적용 전 시드를 넣으려고 함

## 팀원이 pull 받은 뒤 해야 하는 명령

```bash
uv sync --group app --group dev --frozen
docker compose up -d postgres redis
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
uv run pytest app/tests -q
```

## 마지막 체크

정상이라면 아래가 확인되어야 합니다.

1. `postgres`, `redis` 컨테이너가 떠 있음
2. `uv run aerich upgrade`가 정상 종료됨
3. 시드가 정상 입력됨
4. 테스트가 통과함
5. Swagger가 `http://localhost/api/docs`에서 열림
