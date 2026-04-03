# 다나아(DA-NA-A) 프로젝트 Handoff 메모

> **목적**: 이 문서는 다른 AI 또는 개발자가 프로젝트 전체를 파악하고 리뷰할 수 있도록 작성된 상세 인수인계 메모입니다.
> **작성일**: 2026-04-03
> **작성자**: Claude Opus 4.6 (AI 페어 프로그래밍)

---

## 1. 프로젝트 개요

**다나아(DA-NA-A)**는 만성질환(당뇨·고혈압) 예방을 위한 **AI 건강 생활습관 코칭 웹 서비스**입니다.

### 핵심 3기능 (평가 기준)
1. **당뇨 위험도 예측 모델** — FINDRISC 8변수 점수 (0-26점, 5단계)
2. **건강 추적 대시보드** — 오늘 기록 + 위험도 + 챌린지 + 참여상태 통합 API
3. **생활습관 챌린지** — 6카테고리, 최대 2개 동시, 스트릭 + 진행률

### 기술 스택
| 계층 | 기술 |
|------|------|
| 백엔드 프레임워크 | FastAPI (Python 3.13, async) |
| ORM | Tortoise ORM (async-first) + Aerich 마이그레이션 |
| DB | PostgreSQL 16 |
| 캐시/잠금 | Redis (분산 락, 세션) |
| AI | OpenAI GPT-4o-mini (SSE 스트리밍) |
| 스케줄러 | APScheduler 3.x (크론 작업) |
| 인프라 | Docker Compose, Nginx (리버스 프록시) |
| 프론트엔드 | Next.js 14 (**미완성** — 별도 팀원 담당) |

### 프로젝트 규모
| 지표 | 수치 |
|------|------|
| Python 파일 | 83개 |
| Python 코드 | ~6,629줄 |
| API 엔드포인트 | 25개 (인증 4 + 인증필요 21) |
| DB 모델 | 13개 테이블 |
| Enum 정의 | 38개 StrEnum 클래스 (enums.py 35 + 산재 3) |
| Service 모듈 | 12개 (클래스 11 + 함수 모듈 1) |
| 테스트 케이스 | 54개 (unit 31 + integration 23) |
| 크론 작업 | 2개 (일간 + 주간) |

---

## 2. 프로젝트 구조

```
프로젝트루트/
├── app/                          ← FastAPI 백엔드 (핵심)
│   ├── main.py                   ← FastAPI 앱 초기화, 미들웨어, lifespan
│   ├── apis/v1/                  ← 라우터 10개 파일
│   │   ├── auth_routers.py       ← 인증 (signup, login, refresh, consent)
│   │   ├── onboarding_routers.py ← 온보딩 (survey, status)
│   │   ├── health_routers.py     ← 건강데이터 (daily, batch, measurements)
│   │   ├── chat_routers.py       ← AI 채팅 (send SSE, history, health-answer)
│   │   ├── challenge_routers.py  ← 챌린지 (overview, join, checkin, calendar)
│   │   ├── dashboard_routers.py  ← 대시보드 (init 통합 API)
│   │   ├── risk_routers.py       ← 위험도 (latest, recalculate)
│   │   ├── analysis_routers.py   ← 분석 (summary)
│   │   └── user_routers.py       ← 사용자 (me GET/PATCH)
│   ├── models/                   ← Tortoise ORM 모델 8개 파일
│   │   ├── users.py              ← User (12필드)
│   │   ├── consents.py           ← UserConsent (9필드)
│   │   ├── health.py             ← HealthProfile(68필드) + DailyHealthLog(42필드) + PeriodicMeasurement
│   │   ├── assessments.py        ← RiskAssessment + UserEngagement
│   │   ├── challenges.py         ← ChallengeTemplate + UserChallenge + ChallengeCheckin
│   │   ├── chat.py               ← ChatSession + ChatMessage
│   │   ├── settings.py           ← UserSettings
│   │   └── enums.py              ← 31개 Enum 정의 (311줄)
│   ├── services/                 ← 비즈니스 로직 12개 파일 (2,161줄)
│   │   ├── auth.py               ← 회원가입/로그인/JWT
│   │   ├── onboarding.py         ← 설문 제출, 그룹 분류, FINDRISC 초기 계산
│   │   ├── health_daily.py       ← 건강데이터 CRUD, First Answer Wins
│   │   ├── health_question.py    ← 건강질문 묶음 정의, 4대 삽입 조건, 쿨다운
│   │   ├── chat.py               ← 9단계 AI 파이프라인, SSE 스트리밍
│   │   ├── challenge.py          ← 챌린지 참여/체크인/스트릭/달력
│   │   ├── dashboard.py          ← 5개 컴포넌트 통합 조회
│   │   ├── risk_analysis.py      ← 생활습관 점수 + FINDRISC + 요인 분석
│   │   ├── prediction.py         ← FINDRISC 8변수 점수 공식
│   │   ├── measurement.py        ← 측정값(체중/허리/혈압 등) CRUD
│   │   ├── jwt.py                ← JWT 발급/검증
│   │   └── users.py              ← 사용자 정보 수정
│   ├── dtos/                     ← Pydantic 요청/응답 스키마 (623줄)
│   ├── tasks/                    ← 크론 작업 (480줄)
│   │   ├── scheduler.py          ← APScheduler 설정 + 분산 락
│   │   ├── daily_cron.py         ← 매일 00:00 FINDRISC + 참여상태
│   │   └── weekly_cron.py        ← 매주 월 01:00 주간 리포트
│   ├── core/                     ← 설정, 로거, Redis
│   ├── dependencies/             ← JWT 인증 의존성
│   ├── utils/                    ← 비밀번호 해싱, JWT 유틸
│   ├── tests/                    ← 테스트 54개 (828줄)
│   └── db/                       ← Tortoise 설정 + Aerich 마이그레이션
├── apps/web/                     ← Next.js 14 프론트엔드 (미완성)
├── ai_worker/                    ← AI Worker (미실행)
├── nginx/                        ← Nginx 설정 (HTTP/HTTPS)
├── envs/                         ← 환경변수 예시 파일
├── docker-compose.yml            ← 개발용 (postgres, redis, fastapi, nginx)
├── docker-compose.prod.yml       ← 프로덕션용
├── docs/                         ← 설계 문서 + 프로토타입 HTML
└── pyproject.toml                ← 의존성 + 도구 설정
```

---

## 3. Phase별 구현 내역

### Phase 0-1: 인증 + JWT + DB 기초
- **API 6개**: signup, login, token/refresh, consent, GET /me, PATCH /me
- bcrypt 비밀번호 해싱, JWT access/refresh 토큰 발급
- Tortoise ORM 설정, Aerich 마이그레이션
- HTTPBearer 인증 의존성 (`get_request_user`)

### Phase 2: 온보딩 + FINDRISC 위험도
- **API 3개**: consent, survey(+새 JWT 발급), status (총 9개 누적)
- 14개 설문 항목으로 HealthProfile 생성
- `relation → user_group` 자동 매핑: diagnosed→A, prediabetes→B, 나머지→C
- 자동 BMI 계산 + FINDRISC 8변수 초기 점수 산출
- UserEngagement 레코드 생성 (state=ACTIVE)

### Phase 3-4: 건강 데이터 수집 (듀얼 채널)
- **API 6개**: daily GET/PATCH, batch, missing, measurements POST/GET (총 15개 누적)
- DailyHealthLog: 18개 건강 필드 + 14개 _source 출처 추적 필드
- **First Answer Wins**: 먼저 응답한 채널(AI 채팅 or 직접입력)이 우선
- **소급입력**: 3일 이내만 허용 (MAX_BACKFILL_DAYS=3)
- 조건부 필드: exercise_done=false면 type/minutes 무시, alcohol_today=false면 amount 무시

### Phase 5: AI 채팅 (LLM + SSE 스트리밍)
- **API 3개**: send(SSE), history, health-answer (총 18개 누적)
- **9단계 채팅 파이프라인** (상세는 §5 참조)
- **7개 건강질문 묶음**: 시간대별 배분 (아침/점심/저녁/수시)
- **4대 삽입 조건**: 90분 쿨다운 + 시간 윈도우 + 미응답 + 비야간
- SSE W3C 표준 포맷: `event: {type}\ndata: {json}\n\n`
- 의료 가드레일: 진단/처방 금지, 면책조항 자동 삽입

### Phase 6: 챌린지 + 대시보드 + 위험도
- **API 7개**: overview, join, checkin, calendar, dashboard/init, risk/latest, recalculate, analysis/summary (총 25개 누적)
- 챌린지: 6카테고리, 최대 2개 동시, 스트릭 + 진행률 자동 계산
- 대시보드: 5개 컴포넌트 통합 init API (1 request로 모든 데이터)
- 위험도: 생활습관 점수(수면25%+식단30%+운동30%+음주15%) + FINDRISC 재계산

### Phase 7: 스케줄러 + 크론 작업
- **내부 작업 2개** (API 없음)
- 매일 자정(00:00): FINDRISC 재계산 + 5단계 참여 상태 갱신
- 매주 월요일(01:00): 주간 위험도 리포트 생성
- Redis 분산 락 (SETNX + Lua 원자적 해제, TTL 30-60분)
- APScheduler 3.x (coalesce=True, max_instances=1)

### Phase 8: 테스트 + 버그 수정 + 보안 강화
- **버그 수정 7건**: RefreshToken 55년 만료 버그, 쿠키 만료 미설정, 기타
- **보안 강화 6건**:
  1. 쿠키 `samesite="Lax"` (CSRF 방어)
  2. 프로덕션 OpenAPI/Swagger 비활성화
  3. Nginx 보안 헤더 (HSTS, X-Frame-Options, X-Content-Type-Options)
  4. 비활성 계정 JWT 차단 (is_active=false → 403)
  5. 로거 통일 (setup_logger)
  6. Raw SQL → Tortoise ORM 변환 (SQL injection 방지)
- **테스트 54개**:
  - test_findrisc.py (15개): 경계값, null 보수적 처리, 성별 차이
  - test_engagement_state.py (11개): 5단계 상태 전환 + 경계값
  - test_onboarding_flow.py (8개): 전체 흐름 + JWT + 그룹분류
  - test_health_daily.py (6개): 날짜 제한, First Answer Wins
  - test_sse_format.py (5개): W3C 표준 준수, 한글 미이스케이프
  - API 통합 테스트 (9개): 로그인, 회원가입, 토큰, 사용자

---

## 4. 전체 API 엔드포인트 (25개)

### 인증 (비인증)
| # | Method | URL | 설명 |
|---|--------|-----|------|
| 1 | POST | `/api/v1/auth/signup` | 회원가입 (이메일, bcrypt 해싱) |
| 2 | POST | `/api/v1/auth/login` | 로그인 (JWT access + refresh 쿠키) |
| 3 | GET | `/api/v1/auth/token/refresh` | 토큰 갱신 (refresh 쿠키 → 새 access) |

### 온보딩 (JWT 필요)
| # | Method | URL | 설명 |
|---|--------|-----|------|
| 4 | POST | `/api/v1/auth/consent` | 동의 저장 |
| 5 | POST | `/api/v1/onboarding/survey` | 설문 제출 (→ 그룹분류 + FINDRISC) |
| 6 | GET | `/api/v1/onboarding/status` | 온보딩 완료 여부 |

### 건강 데이터 (JWT 필요)
| # | Method | URL | 설명 |
|---|--------|-----|------|
| 7 | GET | `/api/v1/health/daily/{log_date}` | 특정일 건강 기록 조회 |
| 8 | PATCH | `/api/v1/health/daily/{log_date}` | 건강 기록 수정 (First Answer Wins) |
| 9 | GET | `/api/v1/health/daily/missing` | 미입력 날짜 목록 |
| 10 | POST | `/api/v1/health/daily/batch` | 일괄 소급입력 (최대 7일, 3일 제한) |
| 11 | POST | `/api/v1/health/measurements` | 측정값 등록 (체중/허리/혈압 등) |
| 12 | GET | `/api/v1/health/measurements` | 측정값 목록 조회 |

### AI 채팅 (JWT 필요)
| # | Method | URL | 설명 |
|---|--------|-----|------|
| 13 | POST | `/api/v1/chat/send` | 메시지 전송 (SSE 스트리밍 응답) |
| 14 | GET | `/api/v1/chat/history` | 대화 기록 (커서 페이지네이션) |
| 15 | POST | `/api/v1/chat/health-answer` | 건강질문 답변 저장 |

### 챌린지 (JWT 필요)
| # | Method | URL | 설명 |
|---|--------|-----|------|
| 16 | GET | `/api/v1/challenges/overview` | 전체 챌린지 현황 |
| 17 | POST | `/api/v1/challenges/{id}/join` | 챌린지 참여 (최대 2개) |
| 18 | POST | `/api/v1/challenges/{id}/checkin` | 일일 체크인 |
| 19 | GET | `/api/v1/challenges/{id}/calendar` | 체크인 달력 |

### 대시보드·위험도·분석 (JWT 필요)
| # | Method | URL | 설명 |
|---|--------|-----|------|
| 20 | GET | `/api/v1/dashboard/init` | 대시보드 통합 데이터 |
| 21 | GET | `/api/v1/risk/latest` | 최신 위험도 조회 |
| 22 | POST | `/api/v1/risk/recalculate` | 위험도 수동 재계산 |
| 23 | GET | `/api/v1/analysis/summary` | 기간별 분석 요약 |
| 24 | GET | `/api/v1/users/me` | 내 정보 조회 |
| 25 | PATCH | `/api/v1/users/me` | 내 정보 수정 |

---

## 5. LLM 파이프라인 상세 (멘토 핵심 관심사)

### 9단계 순차 처리 (Chain 패턴)
`app/services/chat.py` — `send_message_stream()` 메서드

```
Step 1: _validate_request(user_id, session_id) → str | None
        API 키 확인 + 일 50회 제한 체크

Step 2: _prepare_session(user_id, message, session_id) → ChatSession
        기존 세션 조회 or 새 세션 생성

Step 3: ChatMessage.create(role=USER, content=message)
        사용자 메시지 DB 저장

Step 4: get_eligible_bundles(user_id) → list[str]
        4대 조건으로 건강질문 삽입 판단 (라우터 역할)

Step 5: _build_system_prompt(user_id, eligible_bundles) → str
        그룹별 + 건강질문 지시문 동적 조합

Step 6: _build_openai_messages(user_id, history, bundles) → list[dict]
        system + 이전대화10개 + 현재메시지 조립

Step 7: _stream_openai(messages) → AsyncGenerator[str]
        GPT-4o-mini 호출, stream=True, max_tokens=1024, temperature=0.7

Step 8: _save_response(session, full_response, bundles) → None
        AI 응답 DB 저장 + bundle_keys 메타데이터

Step 9: _build_done_data(session_id, bundles) → dict
        SSE done 이벤트로 session_id + 건강질문 UI 데이터 전달
```

### 3가지 파이프라인 분기 (Router 개념)
1. **일반 질문**: 시스템 프롬프트(코치 역할) → OpenAI → 면책조항 포함 응답
2. **건강 질문 삽입**: 시스템 프롬프트 + 질문 지시문 → OpenAI가 자연스럽게 질문 → 응답 + 질문 UI 데이터
3. **건강 답변 저장**: POST /health-answer → DailyHealthLog 저장 (First Answer Wins) → 90분 쿨다운

### 건강질문 4대 삽입 조건 (`app/services/health_question.py`)
1. **90분 쿨다운 경과**: 마지막 건강질문 응답으로부터 90분 이상
2. **시간 윈도우 내**: 아침(07-09), 점심(11:30-13:30), 저녁(17-20)
3. **해당 묶음 미응답**: 오늘 아직 답하지 않은 질문
4. **야간 아님**: 22:00~07:00에는 질문 삽입 안 함

### 건강질문 7개 묶음
| 묶음 | 이름 | 시간대 | 필드 | 그룹 조건 |
|------|------|--------|------|-----------|
| bundle_1 | 수면 | 07:00-09:00 | sleep_quality, sleep_duration_bucket | 전체 |
| bundle_2 | 아침식사 | 07:00-09:00 | breakfast_status, took_medication | 복약은 A그룹만 |
| bundle_3 | 식단 질 | 11:30-13:30 | meal_balance_level, sweetdrink_level | 전체 |
| bundle_4 | 운동 | 17:00-20:00 | exercise_done, type, minutes | 전체 (서브 조건부) |
| bundle_5 | 채소+산책 | 17:00-20:00 | vegetable_intake_level, walk_done | 전체 |
| bundle_6 | 복약 확인 | Anytime | took_medication | A그룹 전용 |
| bundle_7 | 기분+음주 | Anytime (48h) | mood_level, alcohol_today | 전체 |

### SSE 이벤트 포맷 (W3C 표준)
```
event: token
data: {"content": "안녕"}

event: done
data: {"session_id": 42, "health_questions": [...]}

event: error
data: {"message": "대화를 찾을 수 없어요."}
```

### 시스템 프롬프트 구조
- 역할: "다나아" AI 건강 생활습관 코치 (의사 아님)
- 반말 사용, 이모지 활용, 3-4문장 이내
- 그룹(A/B/C) 동적 삽입
- 건강질문 삽입 시: "그건 그렇고~", "아 맞다!" 같은 전환 멘트
- 절대 금지: 의료 진단/처방, "~해야 합니다"
- 면책조항: "저는 생활습관 코치예요 😊 의학적 판단이 필요하면 전문가 상담을 추천해요!"

---

## 6. DB 모델 상세 (13 테이블)

### 핵심 테이블 관계도
```
User (1) ──── (1) HealthProfile      ← 온보딩 설문 결과
  │  ├────── (1) UserConsent         ← 동의 내역
  │  ├────── (1) UserEngagement      ← 참여 상태 + 쿨다운
  │  ├────── (1) UserSettings        ← 알림 설정
  │  ├────── (N) DailyHealthLog      ← 일별 건강 기록 (unique: user+date)
  │  ├────── (N) PeriodicMeasurement ← 체중/허리/혈압 등
  │  ├────── (N) RiskAssessment      ← FINDRISC + 생활습관 점수
  │  ├────── (N) ChatSession         ← AI 대화방
  │  │           └── (N) ChatMessage ← 대화 메시지
  │  └────── (N) UserChallenge       ← 참여 중인 챌린지
  │               └── (N) ChallengeCheckin ← 일별 체크인
  │
ChallengeTemplate (글로벌) ← 챌린지 템플릿 정의
```

### 주요 모델 필드 수
| 모델 | 필드 수 | 특징 |
|------|---------|------|
| User | 12 | email, hashed_password, is_active, last_login |
| HealthProfile | 68 | 설문 원본 + 계산값(BMI, FINDRISC, user_group) |
| DailyHealthLog | 42 | 18 데이터필드 + 14 _source 필드 + unique(user,date) |
| RiskAssessment | 22 | FINDRISC 8변수 개별 점수 + 생활습관 4영역 점수 |
| UserEngagement | 12 | 5단계 상태머신 + 쿨다운 + 응답 통계 |
| ChallengeTemplate | 12 | 코드, 카테고리, 그룹 조건, 증거 요약 |
| UserChallenge | 15 | 스트릭, 진행률, 상태(active/completed/failed) |
| ChatMessage | 7 | role, content, has_health_questions, bundle_keys |

---

## 7. 핵심 비즈니스 로직

### FINDRISC 점수 계산 (`app/services/prediction.py`)
8개 변수, 0-26점:

| 변수 | 최대점 | 계산 방식 |
|------|--------|-----------|
| 나이 | 4 | <45→0, 45-54→2, 55-64→3, 65+→4 |
| BMI | 3 | <25→0, 25-30→1, >30→3 |
| 허리둘레 | 4 | 남: <94→0, 94-102→3, >102→4 / 여: <80→0, 80-88→3, >88→4 |
| 운동 | 2 | 없음→2, 매일 30분+→0 |
| 채소 | 1 | 안먹음→1, 매일→0 |
| 고혈압 | 2 | 약 복용→2, 아님→0 |
| 고혈당 이력 | 5 | 있음→5, 없음→0 |
| 가족력 | 5 | 부모/형제→5, 없음→0 |

위험도: 0-3 LOW, 4-8 SLIGHT, 9-12 MODERATE, 13-20 HIGH, 21-26 VERY_HIGH

**Null 처리 원칙 (보수적)**:
- 운동=null → 2점 (비활동 가정)
- 채소=null → 1점 (안 먹는 것 가정)
- 고혈압=null → 0점 (약 복용 가정 절대 불가)

### 생활습관 점수 (`app/services/risk_analysis.py`)
가중 평균: 수면25% + 식단30% + 운동30% + 음주15% = 0~100점

- **수면**: quality 기본점(10-100) + duration 보정(-20~+10)
- **식단**: 채소(30) + 균형(30) + 단음료(20) + 야식(20)
- **운동**: 빈도(50) + 시간(30, 주150분 기준) + 산책(20)

### 참여 상태 머신 (`app/tasks/daily_cron.py`)
```
ACTIVE (응답률 ≥ 80%)
  ↓
MODERATE (50% ≤ 응답률 < 80%)
  ↓
LOW (20% ≤ 응답률 < 50%)
  ↓
DORMANT (응답률 < 20% AND 마지막 응답 > 7일)
  ↓
HIBERNATING (마지막 응답 > 30일)
```

### First Answer Wins 규칙
- AI 채팅과 직접입력 두 채널로 건강 데이터 수집
- 어느 채널이든 먼저 답한 값이 저장됨
- 이미 값이 있는 필드는 "skipped(already_answered)"
- 출처 추적: `_source` 필드에 CHAT / DIRECT / BACKFILL 기록

---

## 8. 보안 조치

| 조치 | 파일 | 내용 |
|------|------|------|
| bcrypt 해싱 | `utils/security.py` | passlib CryptContext, deprecated="auto" |
| JWT access + refresh | `services/jwt.py` | HS256, access 60분, refresh 14일 |
| HTTPBearer | `dependencies/security.py` | Authorization 헤더 검증 |
| is_active 체크 | `dependencies/security.py` | 비활성 계정 403 차단 |
| samesite 쿠키 | `auth_routers.py`, `onboarding_routers.py` | samesite="Lax" CSRF 방어 |
| Prod docs 비활성 | `main.py` | ENV==PROD → /docs, /redoc, /openapi.json 숨김 |
| Nginx 보안 헤더 | `nginx/prod_*.conf` | HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff |
| Raw SQL 제거 | `daily_cron.py` | Tortoise ORM 쿼리로 변환 |
| 분산 락 | `tasks/scheduler.py` | Redis SETNX + Lua (UUID 토큰, TTL) |

---

## 9. 크론 작업

### 매일 00:00 KST (`daily_cron.py`)
1. FINDRISC 재계산: 전체 활성 사용자, 배치 100명, RiskAnalysisService.recalculate_risk()
2. 참여 상태 갱신: 7일 응답률 + 마지막 응답 격차 → 5단계 상태 결정
3. 분산 락: "daily-cron" (TTL 30분)

### 매주 월 01:00 KST (`weekly_cron.py`)
1. 주간 위험도 리포트 생성: period_type=WEEKLY, 중복 방지
2. 분산 락: "weekly-cron" (TTL 60분)

---

## 10. 테스트 현황

| 파일 | 테스트 수 | 검증 내용 |
|------|-----------|-----------|
| `test_findrisc.py` | 15 | 경계값(0-3-4-8-9-12-13-20-21), null 보수적 처리, 성별 허리, 초기 FINDRISC |
| `test_engagement_state.py` | 11 | 5단계 상태 전환, 경계값(gap 30/31), rate+gap 조합 |
| `test_onboarding_flow.py` | 8 | A/B/C 그룹분류, FINDRISC 응답, JWT 발급, 동의 없이 설문→403, BMI 계산 |
| `test_health_daily.py` | 6 | 오늘/3일전/4일전/미래 날짜, First Answer Wins, 운동 조건부 |
| `test_sse_format.py` | 5 | W3C 포맷, 한글 미이스케이프, type 키 미포함 |
| `auth_apis/` (3파일) | 6 | 로그인, 회원가입, 토큰 갱신 통합 테스트 |
| `user_apis/` (1파일) | 3 | 사용자 정보 조회/수정 통합 테스트 |
| **합계** | **54** | |

---

## 11. 설계 문서 계층 (참조 순서)

```
[계층 1: 원천]
  매일수집질문_DB설계.md (뭘 모을지)
  docs/planning/다나아_당뇨_온보딩_설문_플랜.md (UX)
       ↓
[계층 2: 파생]
  docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md
       ↓
[계층 3: 계약]
  docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md
       ↓
[계층 4: 참조]
  docs/prototypes/다나아_데이터수집_설계가이드V3.html (10탭)
  docs/prototypes/다나아_LLM파트_가이드.html
  docs/prototypes/다나아_Phase0-8_팀발표자료.html (5탭, 시각화)
       ↓
[계층 5: 코드]
  app/models/, app/dtos/, app/apis/, app/services/
```

---

## 12. 커밋 이력

```
750978c 📝 docs: Phase 0-8 팀발표자료 HTML 시각화 문서 추가
d989c12 ✅ test: Phase 8 단위·통합 테스트 6개 파일 추가
c079a65 🐛 fix: Phase 8 버그 7개 수정 + 보안 강화 6건
2758e69 🚚 build: uv.lock 갱신 — apscheduler 의존성 반영
b0a457e ✨ feat: Phase 7 크론 작업 구현 — FINDRISC 재계산 + 참여 상태 + 주간 리포트
dddee70 ♻️ refactor: CLAUDE.md 207→141줄 최적화 + 규칙 파일 분리
050bbd9 🚚 build: Git hooks(pre-commit, commit-msg) 및 설치 스크립트 추가
f767d9c feat: 다나아 프로젝트 초기 커밋 — 전체 구조 + Phase 5/6 구현물 포함
```

---

## 13. 현재 상태 & 미구현 항목

### 완료된 것 ✅
- 백엔드 API 25개 전체 구현
- FINDRISC 8변수 위험도 예측
- AI 채팅 9단계 파이프라인 + SSE 스트리밍
- 건강질문 듀얼 채널 + First Answer Wins
- 챌린지 + 대시보드 + 위험도 분석
- 크론 작업 2개 (분산 락)
- 테스트 54개
- 보안 강화 6건
- Docker Compose 풀스택 (PostgreSQL + Redis + FastAPI + Nginx)

### 미구현 ⚠️
| 항목 | 상태 | 비고 |
|------|------|------|
| Next.js 프론트엔드 | ❌ 미완성 | 별도 팀원 담당 |
| RAG (검색 증강 생성) | ❌ 미구현 | 벡터 DB + 문서 임베딩 파이프라인 |
| 욕설 필터 | ❌ 미구현 | OpenAI Moderation API 또는 키워드 필터 필요 |
| 질문 유형 자동 분류기 | ❌ 미구현 | 라우터 개념, 질문 종류별 자동 분기 |
| 자체 ML 학습 모델 | ❌ 미구현 | Phase 2 목표 AUC 0.82-0.85 |
| AWS EC2 배포 | ❌ 미완료 | docker-compose.prod.yml은 준비됨 |

---

## 14. 의료 도메인 규칙 (반드시 준수)

- **의료 진단/처방 표현 절대 금지**: "~을 권장합니다" / "전문가 상담을 추천합니다"
- **민감정보 최소 수집**: 혈압·혈당·건강기록은 최소 수집·최소 노출
- **AI 면책조항 필수**: "교육 목적 / 생활습관 참고 / 전문가 상담 대체 아님"
- **질문 추가 시 논문 근거 필수**: 근거 없는 질문 추가 불가
- **현재 10문항이 최소이자 충분**: FINDRISC 8변수 100% 커버
- **복약 가정 절대 불가**: null → 0점 (가정하면 위험)

### 핵심 논문 근거
| 묶음 | 근거 | 효과 |
|------|------|------|
| 수면 | Cappuccio 2010 | 6시간 이하 → 당뇨 위험 28%↑ |
| 운동 | DPP 2002 NEJM | 주 150분 → 당뇨 위험 **58%↓** |
| 식단 | Hu 2012 BMJ | 백미 최고섭취 → 55%↑ |
| 복약 | Cramer 2004 | 비순응 → 35-65%↑ |
| 정서 | Mezuk 2008 | 우울 → 당뇨 60%↑ |

---

## 15. 리뷰 시 중점 확인 요청 사항

1. **코드 품질**: 서비스 계층 분리, 에러 처리, N+1 쿼리 방지
2. **보안**: JWT 흐름, 쿠키 설정, 입력 검증, SQL injection 방지
3. **비즈니스 로직 정합성**: FINDRISC 계산 정확성, 참여 상태 머신, First Answer Wins
4. **테스트 커버리지**: 누락된 엣지 케이스, 핵심 비즈니스 로직 테스트 충분성
5. **아키텍처**: 비동기 처리, 분산 락 구현, 크론 작업 안정성
6. **확장성**: RAG/ML 추가 시 현재 구조가 수용 가능한지
7. **의료 도메인 준수**: 가드레일, 면책조항, 민감정보 처리

---

## 16. 로컬 실행 방법

```bash
# 한글 경로 우회 (Windows)
subst X: "C:\Users\mal03\Desktop\레퍼런스\마지막 웹프로젝트"
cd X:\

# Docker 실행
docker compose -p ai-health-local up -d postgres redis fastapi nginx

# Swagger UI 확인
# http://localhost/api/docs

# 테스트 실행
docker exec -it fastapi pytest app/tests/ -v

# 린트
ruff check . --fix
```

---

> 이 메모는 프로젝트의 모든 구현 내역, 설계 결정, 비즈니스 로직, 보안 조치를 포함합니다.
> 코드를 직접 읽을 때는 `app/services/` → `app/models/` → `app/apis/v1/` → `app/tests/` 순서로 읽는 것을 권장합니다.
