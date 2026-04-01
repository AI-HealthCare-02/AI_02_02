# 다나아 협업 가이드

이 문서는 팀원이 "어떻게 같이 개발할지"를 정리한 문서입니다.

처음 보는 사람은 아래 4가지만 먼저 기억하면 됩니다.

1. `main`에 직접 push하지 않는다
2. 작업은 항상 새 브랜치에서 시작한다
3. 작업이 끝나면 PR로 올린다
4. 공용 모델/DB/API 규칙은 혼자 임의로 바꾸지 않는다

## 개발 환경

- Python: `3.13.x`
- 패키지 설치:

```bash
uv sync --group app --group dev --frozen
```

기준 파일:

- [/.python-version](/abs/path/C:/PycharmProjects/DANAA_project/.python-version)
- [pyproject.toml](/abs/path/C:/PycharmProjects/DANAA_project/pyproject.toml)

## 브랜치 전략

### 기본 원칙

- `main`은 비교적 안정 상태를 유지하는 브랜치입니다.
- 모든 개발은 작업 브랜치에서 합니다.
- 직접 `main`에 push하지 않습니다.
- 작업 후 PR로 리뷰를 받고 머지합니다.

### 브랜치 이름 규칙

아래 형식을 사용합니다.

- `feat/<기능명>`
- `fix/<버그명>`
- `docs/<문서명>`
- `refactor/<대상>`
- `test/<대상>`
- `chore/<설정명>`

예시:

- `feat/onboarding-survey`
- `feat/challenge-overview-api`
- `fix/postgres-local-host`
- `docs/readme-onboarding`
- `refactor/auth-token-flow`

### 공용 저장소 반영 규칙

이 프로젝트는 remote가 2개일 수 있습니다.

- `private`: 팀 내부 작업용 private 저장소
- `origin`: 외부 공유용 공용 저장소

원칙:

1. 평소 작업은 `private`에만 push
2. 전략 문서나 중간 작업은 공용 저장소에 올리지 않음
3. 공용 저장소에 올릴 때는 공개용 브랜치로 정리 후 올림

공개용 브랜치 예시:

- `public/milestone-1`
- `public/api-baseline`

## 커밋 메시지 규칙

아래 형식으로 쓰면 됩니다.

- `feat: 새로운 기능 추가`
- `fix: 버그 수정`
- `docs: 문서 수정`
- `refactor: 구조 개선`
- `test: 테스트 추가/수정`
- `chore: 설정, 패키지, 인프라 정리`

예시:

- `feat: add onboarding survey api skeleton`
- `fix: align local postgres host for pytest`
- `docs: rewrite beginner collaboration guide`

## 작업 순서

기본적인 작업 흐름은 아래와 같습니다.

1. 최신 코드 pull
2. 새 브랜치 생성
3. 기능 개발
4. 테스트
5. 커밋
6. push
7. PR 생성

예시:

```bash
git switch main
git pull
git switch -c feat/health-daily-patch
```

## 폴더 구조를 어떻게 보면 되나요?

신규 기능은 주로 아래 위치를 보면 됩니다.

- 건강 데이터: `app/domains/health`
- 챌린지: `app/domains/challenges`
- API: `app/apis/v1`
- 테스트: `app/tests`

기존 auth/user는 현재 구조 유지 중입니다.

- `app/dtos`
- `app/services`
- `app/repositories`
- `app/models`

즉, 새 기능은 도메인 중심으로 보고, 기존 인증/유저는 예전 구조를 참고하면 됩니다.

## 환경 변수 규칙

예시 파일:

- [/.env.example](/abs/path/C:/PycharmProjects/DANAA_project/.env.example)

원칙:

- 비밀값은 커밋하지 않음
- 실제 값은 각자 `.env`에 작성
- 로컬과 Docker의 DB_HOST가 다를 수 있다는 점을 기억

중요:

- 로컬 터미널: `DB_HOST=localhost`
- Docker 컨테이너 내부: `DB_HOST=postgres`

이 부분은 프로젝트에서 이미 설정을 맞춰두었습니다.

## DB / 마이그레이션 규칙

아래 항목은 혼자 바로 바꾸지 말고 팀과 먼저 공유해야 합니다.

- 모델 필드명
- enum 값
- nullable 여부
- unique 제약
- 인덱스
- API request/response 형태

이유:

- 이런 변경은 다른 팀원의 작업을 쉽게 깨뜨립니다.
- 특히 마이그레이션이 걸리면 전원이 영향을 받습니다.

## 팀 공통 시작 명령

```bash
docker compose up -d postgres redis
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
uv run pytest app/tests -q
```

## 지금 단계에서 기억하면 좋은 것

- 현재는 API 계약 스켈레톤이 많이 잡혀 있는 상태입니다.
- 즉, "경로와 응답 구조"는 맞아가고 있지만 "실제 로직"은 기능별로 계속 구현해야 합니다.
- 그래서 작업할 때는 문서, 스키마, 테스트를 함께 보면서 진행하는 것이 가장 안전합니다.
