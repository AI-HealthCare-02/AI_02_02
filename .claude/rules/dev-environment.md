---
description: Docker 실행, 개발 서버, Python 가상환경 설정
paths:
  - "docker-compose*.yml"
  - "scripts/**"
  - "nginx/**"
  - "app/**"
  - "apps/web/**"
  - "tools/**"
  - "pyproject.toml"
---

# 개발 환경 설정 (자동 로드)

## Docker 실행

### 핵심 서비스 4개
- `mysql`, `redis`, `fastapi`, `nginx`
- `ai-worker`는 별도 (무거워서 필요할 때만 실행)

### 한글 경로 우회 필수 (Windows)
프로젝트 경로에 한글이 포함되어 Docker BuildKit이 오류를 낸다.
반드시 아래처럼 임시 드라이브로 우회해야 한다:

```powershell
subst X: "C:\Users\mal03\Desktop\레퍼런스\마지막 웹프로젝트"
Set-Location X:\
docker compose -p ai-health-local up -d mysql redis fastapi nginx
```

### 확인 주소
- Swagger UI: `http://localhost/api/docs`
- nginx가 `localhost:80` → FastAPI 컨테이너로 프록시함

## 개발 서버

```bash
# 프론트엔드 (apps/web/)
cd apps/web && npm run dev     # http://localhost:3000
# 백엔드는 Docker로 실행 (위 참고)
```

## Python 가상환경

- 루트 `.venv`: `uv sync --all-groups --frozen` 으로 생성 (FastAPI/백엔드용)
- `tools/python/.venv`: Python 3.11.9 독립 환경 (보조 스크립트용)

## 코드 품질 도구 (백엔드)

- 린트: `ruff check . --fix` (pyproject.toml 설정)
- 포맷: `ruff format .`
- 타입체크: `mypy .` (Python 3.13, strict)
- 테스트: `coverage run -m pytest app` (비동기 auto 모드)
