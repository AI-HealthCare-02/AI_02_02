# 다나아 프로젝트 — 팀원용 AI 협업 프롬프트

> **이 문서의 목적**: 팀원이 AI(Claude Code, Cursor, ChatGPT 등)에게 붙여넣기만 하면
> 프로젝트 맥락을 이해하고 바로 협업할 수 있도록 만든 프롬프트입니다.
>
> **사용법**: 아래 `---` 사이의 전체 텍스트를 복사해서 AI 채팅 첫 메시지로 보내세요.

---

## 🎯 프로젝트에 대해 알려줄게 — 이걸 읽고 나서 작업해줘

### 프로젝트 이름: 다나아 (DA-NA-A)
만성질환(당뇨·고혈압) 예방을 위한 **AI 건강 생활습관 코칭 웹 서비스**야.

핵심 기능 3가지:
1. **당뇨 위험도 예측** — FINDRISC 8변수 기반 점수 계산 (0~26점, 5단계 위험도)
2. **건강 추적 대시보드** — 매일 건강기록(수면·식사·운동·정서 등) 입력 + 시각화
3. **생활습관 챌린지** — 걷기·채소·수분 등 미니 챌린지 참여·체크인

---

### 기술 스택 (고정)

| 레이어 | 기술 | 버전/설정 |
|--------|------|-----------|
| 언어 | Python | 3.13 |
| 백엔드 프레임워크 | FastAPI | 0.128+ |
| ORM | Tortoise ORM | 0.25+ (비동기, asyncpg) |
| DB | PostgreSQL | 16 |
| 캐시/분산락 | Redis | 7+ (ConnectionPool, dev=20/prod=50) |
| AI | OpenAI API | gpt-4o-mini (SSE 스트리밍) |
| 리버스 프록시 | Nginx | alpine |
| 컨테이너 | Docker Compose | postgres, redis, fastapi, nginx |
| 패키지 관리 | uv | (pip 대신 uv 사용) |
| 린트 | ruff | (pyproject.toml에 설정) |
| 로깅 | structlog | (setup_logger() 인터페이스) |
| 에러추적 | Sentry | (DSN 비어있으면 비활성화) |
| Rate Limit | slowapi | (Redis 백엔드) |
| 프론트엔드 | Next.js 14 | frontend/ 폴더 (별도 작업) |

---

### 폴더 구조 — 어디에 뭐가 있는지

```
프로젝트루트/
├── backend/                    ← 🔥 FastAPI 백엔드 실소스
│   ├── apis/v1/                ← API 라우터 9개 (auth, chat, user, dashboard, ...)
│   ├── core/                   ← 설정(config.py), 로거, Redis, JWT, Sentry, 캐시
│   ├── db/                     ← Tortoise ORM 초기화 (databases.py)
│   ├── dependencies/           ← FastAPI 의존성 주입 (security.py = 인증)
│   ├── dtos/                   ← Pydantic 요청/응답 스키마
│   ├── middleware/             ← CORS, Rate Limiting
│   ├── models/                 ← DB 테이블 정의 (Tortoise Model) + enums.py
│   ├── repositories/           ← DB 접근 계층 (현재 user만)
│   ├── services/               ← 비즈니스 로직 11개 서비스 클래스
│   ├── tasks/                  ← 스케줄러 (APScheduler, 일간/주간 cron)
│   ├── tests/
│   │   ├── unit/               ← DB 없이 실행 가능 (31개 테스트)
│   │   └── integration/        ← DB 필요 (23개 테스트, conftest.py에 DB설정)
│   └── utils/                  ← 공통 유틸 (common.py, security.py)
│
├── workers/ai/                 ← AI 모델 추론 전용 워커 실소스
├── frontend/                   ← Next.js 프론트엔드
│
├── docs/
│   ├── QUICK_START.md          ← 처음 환경 구축 (15~20분)
│   ├── ARCHITECTURE.md         ← 시스템 구조 설명
│   ├── TROUBLESHOOTING.md      ← 에러 해결 모음
│   ├── DEVELOPMENT_WORKFLOWS.md ← Git 규칙, 커밋 컨벤션
│   ├── MEDICAL_COMPLIANCE.md   ← 의료 데이터 준수 규칙
│   ├── HANDOFF_MEMO.md         ← 프로젝트 전체 인수인계 메모
│   ├── collaboration/          ← API 명세, DB 명세 (팀 공유 확정안)
│   ├── planning/               ← 기획 문서 (참고용, 수정 금지)
│   └── prototypes/             ← HTML 시안/데모 (참고용, 수정 금지)
│
├── envs/                       ← 환경변수 예시 파일 (.env는 gitignore)
├── scripts/                    ← CI 스크립트, git hooks, 배포 스크립트
├── docker-compose.yml          ← 전체 서비스 실행
├── pyproject.toml              ← Python 의존성 (uv 기반)
├── CLAUDE.md                   ← AI 작업 규칙 (Claude Code 전용)
└── .claude/rules/              ← 프로젝트별 AI 규칙 (자동 로드)
```

---

### 코드 패턴 — 이 프로젝트의 규칙

#### 1. API 라우터 패턴
```python
# 파일: backend/apis/v1/{도메인}_routers.py
from backend.dependencies.security import get_request_user  # 인증

@router.post("/endpoint", status_code=status.HTTP_201_CREATED)
async def my_endpoint(
    request: MyRequest,                                    # Pydantic DTO
    user: Annotated[User, Depends(get_request_user)],      # 인증된 유저
    service: Annotated[MyService, Depends(MyService)],     # 서비스 주입
) -> Response:
    result = await service.do_something(user_id=user.id, data=request)
    return Response(content=result.model_dump(mode="json"), status_code=...)
```

#### 2. 서비스 클래스 패턴
```python
# 파일: backend/services/{도메인}.py
class MyService:
    async def do_something(self, user_id: int, data: MyRequest) -> MyResponse:
        # Tortoise ORM으로 DB 조작
        record = await MyModel.create(user_id=user_id, **data.model_dump())
        return MyResponse.from_orm(record)
```

#### 3. DB 모델 패턴 (Tortoise ORM)
```python
# 파일: backend/models/{도메인}.py
class MyModel(models.Model):
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name="my_records")
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "my_table"
```
- 새 모델 추가 시 `backend/db/databases.py`의 `TORTOISE_APP_MODELS` 리스트에 등록 필수

#### 4. DTO 패턴 (Pydantic)
```python
# 파일: backend/dtos/{도메인}.py
class MyRequest(BaseModel):
    field_name: str
    optional_field: int | None = None

class MyResponse(BaseModel):
    id: int
    field_name: str
    model_config = ConfigDict(from_attributes=True)
```

#### 5. Enum 패턴
```python
# 파일: backend/models/enums.py (한 곳에 모아둠, 38개 StrEnum)
class MyStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
```
- 모든 선택지/상태값은 `enums.py`에 StrEnum으로 정의
- DTO에서 `field_validator`로 enum 값 검증

#### 6. 인증 패턴
```python
# 모든 인증 필요 API에서:
user: Annotated[User, Depends(get_request_user)]
# 이 한 줄이면 JWT 검증 + 유저 조회 자동 처리
```

#### 7. 로깅 패턴
```python
from backend.core.logger import setup_logger
logger = setup_logger("모듈이름")
logger.info("메시지", key="value")  # structlog 기반
```

---

### API 엔드포인트 전체 목록 (25개)

| 도메인 | 메서드 | 경로 | 설명 |
|--------|--------|------|------|
| auth | POST | /api/v1/auth/signup | 회원가입 |
| auth | POST | /api/v1/auth/login | 로그인 |
| auth | GET | /api/v1/auth/token/refresh | 토큰 갱신 |
| auth | POST | /api/v1/auth/consent | 이용약관 동의 |
| user | GET | /api/v1/users/me | 내 정보 조회 |
| user | PATCH | /api/v1/users/me | 내 정보 수정 |
| chat | POST | /api/v1/chat/send | 메시지 전송 (SSE) |
| chat | GET | /api/v1/chat/history | 대화 기록 |
| chat | POST | /api/v1/chat/health-answer | 건강질문 답변 |
| onboarding | POST | /api/v1/onboarding/survey | 온보딩 설문 제출 |
| onboarding | GET | /api/v1/onboarding/status | 온보딩 상태 확인 |
| dashboard | GET | /api/v1/dashboard/init | 대시보드 초기 데이터 |
| health | GET | /api/v1/health/daily/missing | 미입력 날짜 조회 |
| health | GET | /api/v1/health/daily/{date} | 특정일 건강기록 |
| health | PATCH | /api/v1/health/daily/{date} | 건강기록 수정 |
| health | POST | /api/v1/health/daily/batch | 소급입력 (다건) |
| health | POST | /api/v1/health/measurements | 검사결과 등록 |
| health | GET | /api/v1/health/measurements | 검사결과 조회 |
| risk | GET | /api/v1/risk/latest | 최신 위험도 |
| risk | POST | /api/v1/risk/recalculate | 위험도 재계산 |
| analysis | GET | /api/v1/analysis/summary | 분석 요약 |
| challenge | GET | /api/v1/challenge/overview | 챌린지 목록 |
| challenge | POST | /api/v1/challenge/{id}/join | 챌린지 참여 |
| challenge | POST | /api/v1/challenge/{id}/checkin | 챌린지 체크인 |
| challenge | GET | /api/v1/challenge/{id}/calendar | 챌린지 캘린더 |

---

### DB 테이블 (13개)

| 테이블 | 모델 파일 | 핵심 |
|--------|-----------|------|
| users | users.py | 회원 정보 (email, name, gender, birthday) |
| user_consents | consents.py | 이용약관 동의 기록 |
| health_profiles | health.py | 온보딩 건강 프로필 (BMI, 가족력, FINDRISC) |
| daily_health_logs | health.py | 매일 건강기록 (18필드 + 18 source필드) |
| periodic_measurements | health.py | 정기 검사결과 (혈압, HbA1c 등) |
| risk_assessments | assessments.py | 위험도 평가 결과 |
| user_engagements | assessments.py | 참여 상태 (5단계 머신) |
| chat_sessions | chat.py | AI 채팅 세션 |
| chat_messages | chat.py | 채팅 메시지 (user/assistant/system) |
| challenge_templates | challenges.py | 챌린지 템플릿 (걷기, 채소, 수분 등) |
| user_challenges | challenges.py | 유저별 참여 챌린지 |
| challenge_checkins | challenges.py | 챌린지 체크인 기록 |
| user_settings | settings.py | 유저 설정 (알림, 시간대) |

---

### 환경 구축 방법

```bash
# 1. 의존성 설치
uv sync

# 2. 환경변수
cp envs/example.local.env envs/.local.env
# .local.env 안의 OPENAI_API_KEY 등을 실제 값으로 수정

# 3. Docker 실행 (Windows 한글 경로 우회 필수)
subst X: "실제경로"
cd X:\
docker compose -p ai-health-local up -d postgres redis fastapi nginx

# 4. 확인
# http://localhost/api/docs (Swagger UI)

# 5. 테스트
uv run pytest backend/tests/unit/ -v    # DB 없이 31개
```

---

### 커밋 컨벤션

```
<이모지> <타입>: <요약>

<본문>
```
| 이모지 | 타입 | 의미 |
|--------|------|------|
| ✨ | feat | 새 기능 |
| 🐛 | fix | 버그 수정 |
| ♻️ | refactor | 리팩토링 |
| 📝 | docs | 문서 |
| ✅ | test | 테스트 |
| 🚚 | build | 빌드/의존성 |
| 🎨 | style | 포매팅 |
| 💡 | chore | 잡일 |
| 🚑 | hotfix | 긴급 수정 |

`scripts/hooks/commit-msg`이 형식을 자동 검증함. 형식 틀리면 커밋 차단됨.

---

### 의료 도메인 필수 규칙

1. **의료 진단/처방 표현 절대 금지** — "~해야 합니다" 대신 "~을 권장합니다" / "전문가 상담을 추천합니다"
2. **AI 응답 면책조항 필수** — "교육 목적 / 생활습관 참고 / 전문가 상담 대체 아님"
3. **건강 데이터 = 민감정보** — 최소 수집, 최소 노출, 로그에 건강값 남기지 않기
4. **FINDRISC 8변수 변경 금지** — age, bmi, waist, activity, vegetable, hypertension, glucose, family_history

---

### 수정 금지 영역

| 경로 | 이유 |
|------|------|
| `docs/planning/` | 기획 확정 문서. 참고만 |
| `docs/prototypes/` | HTML 시안/데모. 참고만 |
| `docs/collaboration/` | API/DB 명세 확정안. 함부로 수정하면 팀 전체 꼬임 |

---

### 주요 참고 문서

| 상황 | 읽을 문서 |
|------|-----------|
| 처음 환경 세팅 | `docs/QUICK_START.md` |
| 프로젝트 구조 이해 | `docs/ARCHITECTURE.md` |
| Git/커밋 규칙 | `docs/DEVELOPMENT_WORKFLOWS.md` |
| 에러 발생 | `docs/TROUBLESHOOTING.md` |
| API 스펙 확인 | `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` |
| DB 구조 확인 | `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md` |
| 문서 동기화 규칙 | `docs/collaboration/doc-sync-map.md` |
| 문서 목록 대장 | `docs/DOCUMENT_REGISTRY.md` |
| 전체 인수인계 | `docs/HANDOFF_MEMO.md` |

---

### 새 기능 추가할 때 체크리스트

1. **API 추가**: `backend/apis/v1/` 라우터 파일 → `backend/apis/v1/__init__.py`에 등록
2. **DB 모델 추가**: `backend/models/` 모델 파일 → `backend/db/databases.py` MODELS 리스트에 등록
3. **DTO 추가**: `backend/dtos/` 요청/응답 스키마
4. **서비스 추가**: `backend/services/` 비즈니스 로직
5. **Enum 추가**: `backend/models/enums.py`에 StrEnum 클래스
6. **테스트 추가**: `backend/tests/unit/` (순수 로직) 또는 `backend/tests/integration/` (DB 필요)
7. **린트 확인**: `uv run ruff check backend/`

---

### Git 브랜치 규칙

```bash
# 새 작업 시작
git checkout main
git pull origin main
git checkout -b feature/기능이름

# 작업 완료 후
git push -u origin feature/기능이름
# GitHub에서 PR 생성 → 리뷰 → main에 머지
```

---

### 이 프로젝트의 `.claude/` 폴더에 대해

이 프로젝트에는 `.claude/rules/` 폴더에 AI 작업 규칙이 설정되어 있어.
Claude Code를 사용하면 이 규칙들이 자동으로 로드돼:
- `commit-convention.md` — 커밋 메시지 형식
- `medical-domain.md` — 의료 표현 가드레일
- `design-context.md` — 설계 문서 참조 기준
- `dev-environment.md` — Docker/개발환경 설정
- `doc-sync.md` — 문서 간 동기화 규칙
- `eval-criteria.md` — 코드 품질 기준

**다른 AI 도구(Cursor, ChatGPT)를 쓸 때는** 이 파일들을 직접 읽어서 참고해야 해.

---

## 마지막으로

이 프로젝트를 도와줄 때 지켜줘야 할 것:
1. **기존 코드 패턴을 따라가** — 새로 만들지 말고 기존 파일을 먼저 확인
2. **`enums.py`에 모든 선택지 정의** — 하드코딩 절대 금지
3. **Tortoise ORM 패턴 유지** — SQLAlchemy로 바꾸지 마
4. **인증 필요한 API는 `Depends(get_request_user)` 사용**
5. **건강 데이터 로그에 남기지 마** — Sentry에도 필터링됨
6. **`uv run ruff check backend/` 통과해야 커밋 가능**
7. **모르겠으면 `docs/` 안의 문서를 먼저 읽어**

이제 맥락이 잡혔으면, 내가 시키는 작업을 해줘!

---

> 📋 **프롬프트 끝** — 위 `---` 사이 전체를 복사해서 AI에게 보내세요.
