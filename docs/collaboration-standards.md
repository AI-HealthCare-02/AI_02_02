# 다나아 협업 공용 기준

## 런타임 / 설치

- Python: `3.13.x`
- 설치: `uv sync --group app --group dev --frozen`
- 기준 파일:
  - [/.python-version](/abs/path/C:/PycharmProjects/DANAA_project/.python-version)
  - [pyproject.toml](/abs/path/C:/PycharmProjects/DANAA_project/pyproject.toml)

## 브랜치 전략

- `main`: private 저장소 기준 안정 브랜치
- 모든 작업은 브랜치에서 시작
- `main` 직접 push 금지
- 머지는 PR 기준

브랜치 이름 규칙:

- `feat/<기능명>`
- `fix/<버그명>`
- `docs/<문서명>`
- `refactor/<대상>`
- `test/<대상>`
- 공용 GitHub 공개용 브랜치: `public/<주제>`

예시:

- `feat/onboarding-survey`
- `feat/health-daily-patch`
- `fix/postgres-test-host`
- `docs/api-contract-v1-1`
- `public/milestone-1`

## 원격 저장소 운영

- `private`: 팀 내부 작업용 private 저장소
- `origin`: 외부 공유용 공용 저장소

규칙:

1. 평소 작업은 `private`에만 push
2. 공용 저장소는 필요할 때만 명시적으로 push
3. 전략 문서, 실험 브랜치, 중간 커밋은 `origin`에 올리지 않음
4. 공용 반영은 `public/*` 브랜치로 정리 후 진행

## 폴더 구조 기준

신규 코드 위치:

- 건강 데이터: `app/domains/health`
- 챌린지: `app/domains/challenges`
- API: `app/apis/v1`
- 내부 연동 경계: `app/integrations`

기존 auth/user 구조는 당분간 유지:

- `app/dtos`
- `app/services`
- `app/repositories`
- `app/models`

## 환경 변수 원칙

- 예시 파일: [/.env.example](/abs/path/C:/PycharmProjects/DANAA_project/.env.example)
- 실제 값은 각자 `.env`에 작성
- 비밀값은 커밋 금지

중요:

- 로컬 터미널 기준 `DB_HOST=localhost`
- Docker 컨테이너 내부 `fastapi`, `ai-worker`는 compose에서 `DB_HOST=postgres` override

공용 문서화 대상:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SECRET_KEY`
- `COOKIE_DOMAIN`

## 마이그레이션 규칙

1. 모델/enum/API 계약 확정 전 마이그레이션 생성 금지
2. 공용 모델/enum/컬럼명 변경은 PR로만 반영
3. 마이그레이션 생성 후 팀 전체에 즉시 공지
4. 팀원은 pull 후 `uv run aerich upgrade` 먼저 실행

## 팀 공통 시작 명령

```bash
docker compose up -d postgres redis
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
uv run pytest app/tests -q
```

## 현재 기준 합의된 상태

- PostgreSQL 기준 초기 마이그레이션 완료
- 챌린지 시드 파일 준비 완료
- API 계약 v1.1 기준 스켈레톤 반영 완료
- 실제 비즈니스 로직은 단계적으로 채워야 함
