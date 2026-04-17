# Shared Demo Account

공용 테스트 계정과 시드 데이터를 로컬 DB에 다시 만드는 용도입니다.

## 목적

- 팀원 모두가 같은 계정으로 리포트, 챌린지, 대시보드 흐름을 확인할 수 있게 합니다.
- 로컬 DB 상태가 달라도 같은 기준 데이터로 화면을 비교할 수 있게 합니다.

## 생성되는 계정

- email: `shared-demo@danaa.local`
- password: `DanaaDemo123!`

## 포함 데이터

- 최근 100일 `DailyHealthLog`
- 체중, 허리둘레, 혈압, 공복혈당, HbA1c `PeriodicMeasurement`
- 최근 12주 `RiskAssessment`
- 챌린지 템플릿 보정
- 활성/완료 챌린지와 체크인 예시 데이터

## 실행 방법

프로젝트 루트에서 아래 명령을 실행합니다.

```bash
docker compose exec fastapi uv run python backend/tasks/seed_shared_demo_account.py
```

## 동작 방식

- 같은 이메일 계정이 이미 있으면 기존 계정을 삭제하고 다시 만듭니다.
- 따라서 이 계정은 테스트 전용으로만 사용해야 합니다.
- 일반 사용자 계정 데이터는 건드리지 않습니다.

## 주의 사항

- 백엔드와 DB 컨테이너가 떠 있어야 합니다.
- `OPENAI_API_KEY` 가 설정되어 있으면 위험도 재계산 과정에서 AI 코칭 문구 생성까지 같이 실행될 수 있습니다.
- 로컬에서 `uv run python backend/tasks/seed_shared_demo_account.py` 를 직접 실행하면 Windows 호스트 환경에서는 `postgres` 호스트를 찾지 못할 수 있으니 컨테이너 안에서 실행하는 방식을 권장합니다.
