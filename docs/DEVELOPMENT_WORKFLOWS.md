# 개발 작업 방법 가이드

> Git 사용법, 커밋 규칙, PR 흐름, 현재 검증 방법을 정리한 문서입니다.

---

## 1. Git이 뭔가요?

비유하면 Git은 "게임 세이브 시스템"입니다.

- `commit` = 현재 상태 저장
- `branch` = 다른 세이브 슬롯
- `push` = 원격 저장소에 업로드
- `pull` = 원격 저장소 변경 가져오기
- `PR(Pull Request)` = 내 작업을 합칠지 리뷰 요청

---

## 2. 브랜치 규칙

### 브랜치 이름 예시

```text
feature/기능이름
fix/버그이름
docs/문서이름
refactor/정리이름
```

### 기본 원칙

- `main`에서 직접 작업하지 않습니다.
- 새 작업은 항상 새 브랜치에서 시작합니다.

### 예시

```bash
git checkout main
git pull origin main
git checkout -b feature/dashboard-api
```

---

## 3. 커밋 메시지 규칙

### 형식

```text
타입: 한 줄 요약
```

### 예시

- `feat: 온보딩 설문 저장 API 구현`
- `fix: 로그인 토큰 만료 처리 수정`
- `docs: QUICK_START 실행 순서 최신화`
- `refactor: JWT 유틸 경로를 core로 이동`

### 자주 쓰는 타입

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `build`
- `style`
- `chore`

---

## 4. 기본 작업 순서

```bash
git status
git add 파일경로
git commit -m "feat: 작업 요약"
git push -u origin 브랜치이름
```

주의:

- `git add .`는 정말 의도한 경우에만 사용합니다.
- `.env`, 개인 메모, 임시 파일이 섞이지 않도록 확인합니다.

---

## 5. Git Hook

이 프로젝트에는 커밋 전에 형식 검사를 도와주는 hook 스크립트가 있습니다.

처음 한 번:

```bash
bash scripts/setup-hooks.sh
```

---

## 6. PR 만들기

### 순서

1. 브랜치 작업 완료
2. `git push`
3. GitHub에서 `Compare & pull request`
4. 제목과 설명 작성
5. 리뷰 후 `main`에 병합

### PR 전 체크리스트

- [ ] `main`이 아닌 작업 브랜치에서 작업했는가
- [ ] `ruff check`가 통과하는가
- [ ] 필요한 테스트를 실행했는가
- [ ] `.env` 같은 로컬 파일이 포함되지 않았는가
- [ ] 문서 변경이 필요한 작업이면 문서도 같이 수정했는가

---

## 7. 현재 검증 명령

### 린트

```bash
uv run ruff check .
```

### 포맷 확인

```bash
uv run ruff format . --check
```

### 테스트

```bash
uv run coverage run -m pytest backend
uv run coverage report -m
```

### 마이그레이션 확인

```bash
.\.venv\Scripts\python.exe -m aerich migrate
.\.venv\Scripts\python.exe -m aerich upgrade
```

---

## 8. 현재 CI/CD 상태

현재 저장소에는 GitHub Actions 기반 CI/CD가 설정되어 있습니다.

- `checks.yml`
  - `uv sync --group app --group dev`
  - `uv run ruff check backend`
  - `uv run python -m pytest backend/tests/unit -q`
- `ghcr-build.yml`
  - `main` push 시 `backend/Dockerfile` 기준 FastAPI 이미지를 GHCR에 빌드/푸시

운영 배포는 완전 자동 배포가 아니라, EC2에서 `docker compose -f docker-compose.prod.yml up -d`로 수동 반영하는 방식입니다.

---

## 9. 이번 main 반영 이후 권장 방식

이번에는 팀 공용 뼈대 정리를 위해 `main` 반영이 먼저 필요할 수 있습니다.

하지만 그 이후부터는 아래 방식으로 관리하는 것을 권장합니다.

1. `main`은 기준 브랜치로 유지
2. 새 작업은 `feature/*`, `fix/*`, `refactor/*` 브랜치에서 진행
3. 작업 후 PR로 `main`에 병합

---

## 10. 참고 문서

- `docs/QUICK_START.md`
- `docs/ARCHITECTURE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/TEAM_CHANGELOG.md`
- `docs/collaboration/`
