# 다나아 (DA-NA-A) -- AI 건강 생활습관 코칭 웹 서비스

만성질환(당뇨/고혈압) 예방을 위한 AI 건강관리 웹 서비스입니다.
**당뇨 위험도 예측** + **건강 추적 대시보드** + **생활습관 챌린지** 3가지 핵심 기능을 제공합니다.

---

## 처음이라면 여기부터

| 문서 | 내용 |
|------|------|
| **[QUICK_START.md](docs/QUICK_START.md)** | 내 컴퓨터에서 서버 켜기 (처음 15~20분) |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | 프로젝트 구조 이해하기 |
| **[DEVELOPMENT_WORKFLOWS.md](docs/DEVELOPMENT_WORKFLOWS.md)** | Git 사용법, 커밋 규칙 |
| **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | 에러 해결 모음 |
| **[MEDICAL_COMPLIANCE.md](docs/MEDICAL_COMPLIANCE.md)** | 의료 데이터 준수 가이드 |

---

## 주요 특징

- **FastAPI Framework**: 고성능 비동기 API 서버 (Python 3.13)
- **AI Worker**: `workers/ai/`에서 별도 추론 작업 관리
- **Tortoise ORM + PostgreSQL 16**: 비동기 DB 모델링 + asyncpg
- **Redis**: 캐시, 분산 락, 세션 관리
- **Docker Compose**: PostgreSQL, Redis, Nginx 포함 전체 스택 실행
- **OpenAI GPT-4o-mini**: SSE 스트리밍 AI 채팅
- **검증 도구**: Ruff, Pytest, Mypy, Aerich 기반 점검 스크립트 사용

---

## 프로젝트 구조

```text
.
├── frontend/               # Next.js 14 프론트엔드
│   ├── app/                # 페이지 라우터 (App Router)
│   ├── components/         # 공통 UI 컴포넌트
│   ├── hooks/              # 커스텀 훅 (useApi 등)
│   ├── contexts/           # React Context (테마 등)
│   ├── lib/                # 채팅 유틸, i18n
│   └── public/             # 정적 파일
├── backend/                # FastAPI 서버 코드
│   ├── apis/v1/            # API 라우터 (v1 버전 관리)
│   ├── core/               # 서버 설정, JWT, Redis, Sentry
│   ├── db/                 # DB 초기화 및 Aerich 마이그레이션
│   ├── dependencies/       # FastAPI 의존성 주입 (인증 등)
│   ├── dtos/               # 데이터 전송 객체 (Pydantic models)
│   ├── middleware/         # CORS, Rate Limit
│   ├── models/             # DB 테이블 정의 (Tortoise ORM)
│   ├── repositories/       # DB 쿼리 레이어
│   ├── services/           # 비즈니스 로직 (chat, RAG, 위험도 등)
│   ├── tasks/              # 스케줄러, daily/weekly cron
│   ├── tests/              # 통합/유닛 테스트
│   ├── utils/              # 공통 유틸
│   ├── validators/         # 입력값 검증
│   └── main.py             # FastAPI 애플리케이션 진입점
├── workers/ai/             # AI Worker (별도 컨테이너)
│   ├── core/               # 워커 설정 및 로거
│   ├── prompts/            # 시스템 프롬프트
│   ├── tasks/              # 실제 처리할 작업 정의
│   └── main.py             # 워커 진입점
├── tools/
│   └── ml_artifacts/       # 학습된 모델 파일
│       ├── diabetic_track/     # 당뇨/전단계 트랙 (CatBoost)
│       └── non_diabetic_track/ # 비당뇨 트랙 (MLP Regressor)
├── scripts/
│   ├── ci/                 # 린트, 테스트, 타입 검사 스크립트
│   ├── hooks/              # Git 훅 (pre-push 등)
│   ├── ml/                 # 모델 학습 스크립트
│   ├── certbot.sh          # SSL 인증서 발급
│   └── deployment.sh       # EC2 배포 자동화
├── shared/                 # 팀 공유 산출물 (제품 가이드 등)
├── envs/                   # 환경 변수 설정 파일
├── nginx/                  # Nginx 설정 (리버스 프록시)
├── .github/workflows/      # GitHub Actions CI/CD
├── docker-compose.yml      # 로컬 전체 스택 실행
├── docker-compose.prod.yml # 프로덕션 스택 실행
└── pyproject.toml          # uv 기반 의존성 관리
```

---

## 사전 준비 사항

| 프로그램 | 필요 버전 | 설치 링크 |
|---------|----------|----------|
| Python | 3.13 이상 | https://python.org |
| uv | 최신 | https://github.com/astral-sh/uv |
| Docker Desktop | 4.x 이상 (WSL2 필수) | https://docker.com |
| Node.js | 18 이상 | https://nodejs.org |
| Git | 2.x 이상 | https://git-scm.com |

> **Windows 한글 경로 사용자**: Docker 빌드 시 `subst X:` 우회가 필요합니다.
> 자세한 방법은 [QUICK_START.md](docs/QUICK_START.md#2-한글-경로-우회-windows-필수)를 참고하세요.

---

## 🛠️ 설치 및 설정

### 1. 가상환경 구축 및 의존성 설치

`uv`를 사용하여 프로젝트에 필요한 패키지를 설치합니다.

```bash
# 의존성 설치 (가상환경 자동 생성)
uv sync

# 특정 그룹의 의존성만 설치하려는 경우
uv sync --group app  # API 서버용
uv sync --group ai   # AI 워커용
```

### 2. 환경 변수 설정

`envs/` 디렉토리에 있는 예시 파일을 복사하여 `.env` 파일을 생성합니다.
- 로컬용 
    ```bash
    cp envs/example.local.env envs/.local.env
    ```
- 배포용 
    ```bash
    cp envs/example.prod.env envs/.prod.env
    ```

생성된 `env` 파일 내의 환경변수들은 프로젝트 상황에 맞게 수정하세요.

---

## 🏃 실행 방법

### 1. 로컬 및 개발 환경

#### Docker Compose로 전체 스택 실행

모든 서비스(API, Worker, DB, Redis, Nginx)를 한 번에 실행합니다.

```bash
docker compose up -d --build
```

실행 후 다음 주소로 접속 가능합니다:
- **Swagger UI (Nginx 경유)**: [http://localhost/api/docs](http://localhost/api/docs)
- **Swagger UI (FastAPI 직접)**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Nginx**: 80 포트를 통해 API 서버로 요청을 전달합니다.

#### 로컬에서 개별 실행 (개발용)

**FastAPI 서버 실행:**
```bash
uv run uvicorn backend.main:app --reload
# or
docker compose up -d --build fastapi
```

**AI Worker 실행:**
```bash
uv run python -m workers.ai.main
# or
docker compose up -d --build ai-worker
```

### 2. EC2 배포 환경 (Production)

현재 운영 배포 기준은 `main` 머지 후 GitHub Actions가 FastAPI 이미지를 GHCR에 빌드하고, EC2에서 최신 이미지를 pull 받아 수동 반영하는 방식입니다.

#### 사전 준비
- EC2 인스턴스 (Ubuntu 권장)
- SSH 키 페어
- GHCR 접근 가능한 GitHub 계정
- 운영용 `.env`
- `docker-compose.prod.yml`에서 사용할 `FASTAPI_IMAGE`

#### 운영 반영 순서

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

배포 상세 절차는 `docs/EC2_GHCR_MANUAL_DEPLOY.md`를 참고하세요.

---

## 🧪 테스트 및 품질 관리

제공된 스크립트를 사용하여 코드의 품질을 검증할 수 있습니다.

```bash
# 테스트 실행
./scripts/ci/run_test.sh

# 코드 포맷팅 확인 (Ruff)
./scripts/ci/code_fommatting.sh

# 정적 타입 검사 (Mypy)
./scripts/ci/check_mypy.sh
```

---

## 개발 가이드

- **API 추가**: `backend/apis/v1/` 아래에 새로운 라우터 파일을 생성하고 라우터 등록을 확인하세요.
- **DB 모델 추가**: `backend/models/`에 Tortoise 모델을 정의하고 현재 Aerich 설정과 `TORTOISE_APP_MODELS` 등록을 함께 확인하세요.
- **AI 로직 추가**: `workers/ai/tasks/`에 새로운 처리 로직을 작성하고 `python -m workers.ai.main`에서 호출되도록 구성하세요.

---

## 상세 문서

| 문서 | 내용 |
|------|------|
| [docs/collaboration/](docs/collaboration/) | API/DB 명세 확정안 |
