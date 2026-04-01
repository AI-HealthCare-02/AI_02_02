# DANAA_project Handoff

작성일: 2026-04-01  
목적: 새 프롬프트/새 세션에서도 지금까지의 결정사항과 진행 상태를 바로 이어가기 위한 인수인계 문서

## 프로젝트 방향

- 프로젝트명: `DANAA_project`
- 배포 우선순위: 웹 우선
- 확장 방향: Android, iOS, MCP, 외부 챗봇 연동까지 고려
- 아키텍처 방향: 도메인 중심 구조
- DB 방향: MySQL이 아니라 PostgreSQL 채택

## 현재 확정된 기본 스택

- FastAPI
- Tortoise ORM
- PostgreSQL
- Redis
- Docker Compose
- Aerich
- uv
- Python 3.13

관련 문서:

- [README.md](/abs/path/C:/PycharmProjects/final_project_template/README.md)
- [docs/stack-decision.md](/abs/path/C:/PycharmProjects/final_project_template/docs/stack-decision.md)
- [docs/platform-architecture.md](/abs/path/C:/PycharmProjects/final_project_template/docs/platform-architecture.md)

## 현재 프로젝트 구조

핵심 구조는 기존 템플릿 중심 구조에서 도메인 중심 구조로 변경됨.

- `app/domains/health`
- `app/domains/challenges`
- `app/integrations/mobile`
- `app/integrations/chatbots`
- `app/integrations/mcp`
- `app/apis/v1/*`

구조 설명 문서:

- [docs/project-structure.md](/abs/path/C:/PycharmProjects/final_project_template/docs/project-structure.md)

## 현재 반영된 도메인

### Health

- `HealthProfile`
- `DailyHealthLog`
- `PeriodicMeasurement`
- `RiskAssessment`
- `UserEngagement`

### Challenges

- `ChallengeTemplate`
- `UserChallenge`
- `ChallengeCheckin`
- `UserBadge`

관련 코드:

- [app/domains/health/models.py](/abs/path/C:/PycharmProjects/final_project_template/app/domains/health/models.py)
- [app/domains/health/enums.py](/abs/path/C:/PycharmProjects/final_project_template/app/domains/health/enums.py)
- [app/domains/challenges/models.py](/abs/path/C:/PycharmProjects/final_project_template/app/domains/challenges/models.py)
- [app/domains/challenges/enums.py](/abs/path/C:/PycharmProjects/final_project_template/app/domains/challenges/enums.py)

## DB/API 계약 관련 상태

기존 설계서 기반으로 아래 문서를 정리해둠.

- [docs/phase1-contract.md](/abs/path/C:/PycharmProjects/final_project_template/docs/phase1-contract.md)
- [docs/collaboration-standards.md](/abs/path/C:/PycharmProjects/final_project_template/docs/collaboration-standards.md)

추가로 팀원이 작성한 `api-contract.md`를 리뷰한 결과:

- 전체 방향은 좋음
- 그대로 확정하지 말고 수정 후 채택 권장

리뷰 문서:

- [docs/api-contract-review.md](/abs/path/C:/PycharmProjects/final_project_template/docs/api-contract-review.md)

핵심 수정 권고 5개:

1. JWT에 `user_group`를 넣는 방식 재검토
2. cron이 미입력 건강데이터를 기본값으로 채우는 설계 제거
3. 혈압 측정은 2회 호출이 아니라 1회 이벤트로 묶기
4. `PATCH /health/daily/{date}`는 자유 dict보다 명시적 schema 사용
5. `challenges/overview` 등 예시 JSON 파싱 가능 형태로 정리

## 챌린지 상태

추천 챌린지 10종을 기준으로 시드 파일 준비됨.

파일:

- [app/db/seeds/challenge_templates.py](/abs/path/C:/PycharmProjects/final_project_template/app/db/seeds/challenge_templates.py)

## 프로젝트명 변경 상태

내부 식별자는 상당수 `DANAA_project` 기준으로 변경함.

반영된 항목:

- [pyproject.toml](/abs/path/C:/PycharmProjects/final_project_template/pyproject.toml)
- [README.md](/abs/path/C:/PycharmProjects/final_project_template/README.md)
- [.env](/abs/path/C:/PycharmProjects/final_project_template/.env)
- [/.env.example](/abs/path/C:/PycharmProjects/final_project_template/.env.example)
- [uv.lock](/abs/path/C:/PycharmProjects/final_project_template/uv.lock)
- `DOCKER_REPOSITORY=danaa-project`

주의:

- 현재 로컬 폴더명은 아직 `final_project_template`
- 폴더명 자체 변경은 사용자가 직접 해야 함

권장 순서:

1. PyCharm 종료
2. `C:\PycharmProjects\final_project_template`를 `C:\PycharmProjects\DANAA_project`로 변경
3. PyCharm에서 새 폴더 다시 열기
4. 필요하면 `.idea` 재생성
5. 새 세션에서 남은 경로 참조 재점검

## 환경변수 관련 상태

문제 원인:

- `.env`는 PostgreSQL로 이미 바뀌어 있었음
- 그런데 현재 PyCharm/터미널 세션에 예전 MySQL 환경변수가 남아 있어서 실행이 계속 `mysql:3306`을 참조했음

확인된 예전 세션 값:

- `DB_HOST=mysql`
- `DB_PORT=3306`
- `DB_USER=ozcoding`
- `DB_PASSWORD=pw1234`
- `DB_NAME=ai_health`
- `DB_EXPOSE_PORT=3306`
- `DOCKER_REPOSITORY=ai-health`

정리 결과:

- Windows User 레벨 환경변수에는 해당 값이 없었음
- 즉 PC 전체 설정 문제가 아니라 현재 실행 세션 문제였음

실무 메모:

- 새 터미널 또는 PyCharm 재시작 후 재확인 필요
- 새 세션에서 `DB_*`가 다시 mysql이면 Run Configuration 또는 IDE 환경변수 주입 설정 확인 필요

## Docker / DB / 테스트 검증 상태

실제 검증 완료:

- Docker daemon 정상 확인
- PostgreSQL 컨테이너 실행 성공
- Redis 실행 성공
- PostgreSQL 기준 Aerich 초기 마이그레이션 생성 성공
- DB 스키마 반영 성공
- 챌린지 시드 실행 성공
- 테스트 성공

생성된 마이그레이션:

- [app/db/migrations/models/0_20260401182144_init.py](/abs/path/C:/PycharmProjects/final_project_template/app/db/migrations/models/0_20260401182144_init.py)

테스트 결과:

- `9 passed`

## PostgreSQL 전환 시 수정된 주요 파일

- [app/db/databases.py](/abs/path/C:/PycharmProjects/final_project_template/app/db/databases.py)
- [app/core/config.py](/abs/path/C:/PycharmProjects/final_project_template/app/core/config.py)
- [docker-compose.yml](/abs/path/C:/PycharmProjects/final_project_template/docker-compose.yml)
- [docker-compose.prod.yml](/abs/path/C:/PycharmProjects/final_project_template/docker-compose.prod.yml)
- [app/tests/conftest.py](/abs/path/C:/PycharmProjects/final_project_template/app/tests/conftest.py)
- [.github/workflows/checks.yml](/abs/path/C:/PycharmProjects/final_project_template/.github/workflows/checks.yml)

추가 수정 메모:

- `asyncpg`와 맞지 않는 `connect_timeout` 옵션은 제거함

## 현재 남은 추천 작업

우선순위 기준:

1. 프로젝트 폴더명을 `DANAA_project`로 변경
2. 팀원 API 문서를 기준으로 `최종 API 계약서 v1.1` 작성
3. 그 계약서 기준으로 FastAPI router/schema 뼈대 반영
4. 팀원용 협업 시작 가이드 공유
5. git 커밋 및 원격 푸시

## 팀원 공유 시 안내할 명령

```bash
uv sync --group app --group dev --frozen
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
```

개발 실행:

```bash
docker compose up -d postgres redis
uv run uvicorn app.main:app --reload
```

## 새 세션에서 먼저 확인할 것

1. 현재 루트 폴더명이 바뀌었는지 확인
2. 새 터미널에서 `DB_HOST`, `DB_PORT`, `DB_USER`가 postgres 기준인지 확인
3. Docker가 붙는지 확인
4. `uv run pytest app/tests -q` 재실행
5. `api-contract.md` 수정본 작업 시작

## 새 세션용 한 줄 요약

이 프로젝트는 `DANAA_project`로 전환 중이며, PostgreSQL 기반 구조/마이그레이션/시드/테스트는 이미 통과했다. 다음 핵심 작업은 폴더명 변경 후 팀 API 설계안을 수정 반영하여 최종 계약서와 라우터 뼈대를 만드는 것이다.
