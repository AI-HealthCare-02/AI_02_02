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
- **AI Worker**: 모델 추론 작업을 API 서버와 분리하여 처리
- **Tortoise ORM + PostgreSQL 16**: 비동기 DB 모델링 + asyncpg
- **Redis**: 캐시, 분산 락, 세션 관리
- **Docker Compose**: PostgreSQL, Redis, Nginx 포함 전체 스택 실행
- **OpenAI GPT-4o-mini**: SSE 스트리밍 AI 채팅
- **검증 도구**: Ruff, Pytest, Mypy, Aerich 기반 점검 스크립트 사용

---

## 📂 프로젝트 구조

```text
.
├── workers/ai/         # AI 모델 추론 및 학습 관련 코드 (Worker)
│   ├── core/           # 워커 설정 및 로거
│   ├── models/         # AI 모델 파일 보관 (PyTorch 등)
│   ├── tasks/          # 실제 처리할 작업 정의
│   └── main.py         # 워커 진입점
├── backend/            # FastAPI 서버 코드
│   ├── apis/           # API 라우터 (v1 버전 관리)
│   ├── core/           # 서버 설정 (pydantic-settings)
│   ├── db/             # 데이터베이스 초기화 및 마이그레이션 (Tortoise ORM)
│   ├── dtos/           # 데이터 전송 객체 (Pydantic models)
│   ├── models/         # DB 테이블 정의
│   ├── services/       # 비즈니스 로직
│   └── main.py         # FastAPI 애플리케이션 진입점
├── envs/               # 환경 변수 설정 파일 (.env)
├── nginx/              # Nginx 설정 파일 (리버스 프록시)
├── scripts/            # 배포 및 CI용 쉘 스크립트
├── docker-compose.yml  # 전체 서비스 실행 설정
└── pyproject.toml      # uv 기반 의존성 관리 설정
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

제공된 쉘 스크립트를 사용하여 AWS EC2 환경에 이미지를 빌드, 푸시 및 배포할 수 있습니다.

#### 사전 준비
- EC2 인스턴스 (Ubuntu 권장)
- SSH 키 페어 (`~/.ssh/` 경로에 위치)
- 도커 허브(Docker Hub) 계정 및 Personal Access Token
- 배포용 환경 변수 설정 (`envs/.prod.env`)
- 도메인 구매 (Gabia, GoDaddy, AWS Route53 등)

#### 자동 배포 스크립트 실행
`scripts/deployment.sh`는 도커 이미지 빌드, 레포지토리 푸시, EC2 접속 및 컨테이너 실행 과정을 자동화합니다.

```bash
chmod +x scripts/deployment.sh
./scripts/deployment.sh
```
스크립트 실행 시 다음 정보를 입력해야 합니다:
1. 도커 허브 계정 정보 (Username, PAT)
2. 이미지를 업로드할 레포지토리 이름
3. 배포할 서비스 선택 (FastAPI, AI-Worker) 및 버전(Tag)
4. SSH 키 파일명 및 EC2 IP 주소
5. https 사용여부
   - 5-1. https인 경우 도메인 추가 입력  

#### SSL(HTTPS) 설정 (Certbot)
도메인을 연결하고 HTTPS를 적용하려면 `scripts/certbot.sh`를 사용합니다.

```bash
chmod +x scripts/certbot.sh
./scripts/certbot.sh
```
1. 도메인 주소 및 이메일 입력
2. SSH 키 파일명 및 EC2 IP 주소 입력
3. Let's Encrypt를 통한 인증서 발급 및 Nginx 설정 자동 갱신 적용

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
| [docs/HANDOFF_MEMO.md](docs/HANDOFF_MEMO.md) | 프로젝트 전체 인수인계 메모 |
| [docs/collaboration/](docs/collaboration/) | API/DB 명세 확정안 |
