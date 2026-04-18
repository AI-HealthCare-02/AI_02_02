# Shared Demo Seed

공통 테스트용 비교 계정을 생성하는 시드 스크립트 사용 문서입니다.

## 대상 스크립트

- `backend/tasks/seed_shared_demo_account.py`

## 사전 준비

로컬 환경 변수 파일에 아래 값을 추가합니다.

```env
SHARED_DEMO_PASSWORD=change-me-for-team-demo
```

- 이 값은 저장소에 커밋하지 않습니다.
- 팀원들이 같은 공통 계정으로 로그인 테스트를 해야 하면 동일한 값을 각자 로컬 `.env` 또는 `envs/.local.env`에 넣어 사용합니다.

## 실행 방법

프로젝트 루트에서 아래 명령을 실행합니다.

```bash
uv run python backend/tasks/seed_shared_demo_account.py
```

## 생성되는 공통 계정

- `danaa1@danaa.com`
- `danaa2@danaa.com`

비밀번호는 코드 하드코딩이 아니라 `SHARED_DEMO_PASSWORD` 값을 사용합니다.

## 동작 방식

- 기존 동일 이메일 계정이 있으면 삭제 후 다시 생성합니다.
- 100일치 건강 로그, 측정값, 리스크 이력, 챌린지 이력을 함께 채웁니다.
- 팀원이 같은 테스트 상태를 맞춰야 할 때 공통 비교 계정으로 사용할 수 있습니다.
