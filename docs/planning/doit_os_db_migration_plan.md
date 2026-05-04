# Do it OS 저장 구조 전환 설계 플랜

> 작성일: 2026-05-03  
> 작성자: BJ (Claude Code 분석 보조)  
> 상태: **방향 확정 — 구현 준비 중**  
> 관련 파일: `frontend/lib/doit_store.js`, `frontend/components/doit/`, `backend/services/chat/`

## 확정된 방향 (2026-05-03)

| 질문 | 결정 |
|------|------|
| 저장 구조 | **전면 DB 전환** (localStorage 완전 제거, 하이브리드 없음) |
| "서버에 저장 안 됨" 문구 | **변경** — DB 전환 완료 시점에 문구 교체 |
| AI 도움 모드 MVP 범위 | **"이번 대화에만 허용"** — 영구 허용은 추후 별도 PR |

---

## 1. 현재 구조 요약

### 쉬운 설명

Do it OS는 현재 "사용자 브라우저의 메모장"처럼 작동합니다. 모든 데이터는 해당 기기의 브라우저에만 존재하고, 서버는 전혀 모릅니다. 최근 PR에서 계정별 분리(A가 쓰면 A 서랍에, B가 쓰면 B 서랍에)는 완성했지만, 서랍 자체가 각 기기에만 있는 상황입니다.

### 기술 요약

**저장 위치:** `localStorage` 100% — 서버 없음 (전환 전 현재)

**핵심 파일 목록:**

| 파일 | 역할 |
|------|------|
| `frontend/lib/doit_store.js` | 모든 읽기/쓰기 + 정규화 로직 (~540줄) |
| `frontend/lib/doit_canvas_layout.js` | 카드 위치 계산 (겹침 방지, 뷰포트 clamp) |
| `frontend/components/doit/` | 22개 컴포넌트 |
| `frontend/app/app/do-it-os/` | 9개 페이지 라우트 |

**localStorage 키 구조 (현재, 전환 후 제거 대상):**

```
danaa_doit_thoughts_v1::u{userId}                       ← 메인 데이터
danaa_doit_thoughts_v1_recovery_backup_v1::u{userId}    ← 파싱 오류 시 자동 백업
danaa_doit_thoughts_v1_legacy_quarantine_v1             ← 계정 분리 전 격리본 (1회용)
danaa_doit_guide_seen_v1::u{userId}
danaa_doit_layout_toast_shown_v1::u{userId}
```

**단일 배열 + "God Object" Thought 구조:**

```javascript
{
  id: 't-{timestamp}-{random}',
  text: string,
  createdAt: ISO8601,
  category: null | 'todo' | 'schedule' | 'project' | 'note' | 'health' | 'waiting' | 'someday',
  classifiedAt: ISO8601 | null,
  discardedAt: ISO8601 | null,
  completedAt: ISO8601 | null,

  // 캔버스 UI 전용
  x: number | null,
  y: number | null,
  rotation: number,       // -4 ~ +4도
  color: 'cream' | 'stone' | 'mint' | 'lavender' | 'blush',
  width: number,          // 200 / 240 / 280 (텍스트 길이 기반)
  height: number,         // 120 / 140 / 160

  // todo / schedule 전용
  scheduledDate: 'YYYY-MM-DD' | null,
  scheduledTime: 'HH:MM' | null,
  scheduleNote: string | null,
  plannedDate: 'YYYY-MM-DD' | null,

  // project 전용
  description: string | null,
  nextAction: string | null,
  projectStatus: 'active' | 'onhold' | 'done' | null,
  projectLinkId: string | null,  // 다른 thought의 id를 참조

  // note 전용
  noteBody: string | null,

  // 분류 흐름 전용 (clarification gate)
  clarification: {
    actionable: boolean | null,
    decision: 'todo' | 'schedule' | 'project' | 'note' | 'discard' | 'waiting' | 'someday' | null,
    source: 'classify' | 'end_of_day' | null,
  },

  // 자기 전 리추얼 전용
  endOfDay: {
    ritualDate: 'YYYY-MM-DD' | null,
    action: 'discard' | 'plan_tomorrow' | 'keep' | 'waiting' | null,
  },

  // 기타
  waitingFor: string | null,
  somedayReason: string | null,
  urgency: null,
}
```

**페이지 라우트:**

| 경로 | 역할 |
|------|------|
| `/app/do-it-os` | 대시보드 (미분류 받은편지함, 오늘 일정, 성과판) |
| `/app/do-it-os/thinking` | ThoughtCanvas — 자유 입력, 카드 배치 |
| `/app/do-it-os/classify` | ClassifyView — 2단계 분류 게이트 |
| `/app/do-it-os/schedule` | 일정 목록/캘린더 |
| `/app/do-it-os/project` | 프로젝트 목록 |
| `/app/do-it-os/project/[id]` | 프로젝트 상세 |
| `/app/do-it-os/note` | 노트 목록 |
| `/app/do-it-os/note/[id]` | 노트 상세 |
| `/app/do-it-os/end-of-day` | 자기 전 리추얼 (3단계: 쏟기 → 내일 계획 → 버리기/유지) |

**백엔드 현황:**
- Do it OS 관련 DB 테이블/API 전혀 없음
- `backend/models/` 에 `doit` 관련 파일 없음

**AI 채팅 연결 현황:**
- `backend/services/chat/prompting.py` 기준 AI가 현재 참고하는 데이터: challenge 진행도, health profile, risk level, user_group
- Do it OS 데이터는 AI에게 전혀 전달되지 않음

**인증/user_id 흐름:**
- `frontend/hooks/useApi.js` > `getCurrentUserId()` — JWT payload를 base64url 디코드해 `user_id` 추출
- 현재는 localStorage 키 스코핑에만 사용, API 인증과 무관

---

## 2. 문제 정의

| # | 문제 | 현재 영향 | 미래 위험 |
|---|------|-----------|-----------|
| 1 | 다기기 동기화 불가 | 데스크탑 작성 내용이 노트북에 없음 | 사용자 이탈 |
| 2 | 브라우저 데이터 유실 | 캐시 지우면 모든 데이터 삭제 | 핵심 기능 신뢰도 하락 |
| 3 | AI와 단절 | AI가 "오늘 뭐할까?" 물으면 Do it OS 내용 모름 | 앱 차별화 포인트 미실현 |
| 4 | 용량 한계 | localStorage 5~10MB 제한, MAX_THOUGHTS=5000 | 헤비유저 데이터 유실 |
| 5 | 리포트 연결 불가 | Do it OS ↔ 건강 리포트 연동 불가 | 통합 건강관리 플로우 미실현 |
| 6 | 백업이 같은 브라우저에만 | recovery_backup도 localStorage에 저장 | 동일 기기 내 백업이라 의미 제한 |

---

## 3. 선택지 비교 (검토 완료)

| 항목 | A: localStorage 유지 + AI 주입 | B: 하이브리드 opt-in | **C: 전면 DB 전환 ← 선택** |
|------|-------------------------------|---------------------|--------------------------|
| 구현 범위 | 최소 | 중간 | 최대 |
| 다기기 동기화 | ✗ | opt-in 후만 | ✓ 완전 지원 |
| 데이터 유실 위험 | ✗ | opt-in 후만 | ✓ 완전 해결 |
| AI 연동 | △ (클라이언트 측) | △ | ✓ 서버에서 직접 |
| 코드 복잡도 | 낮음 | 높음 (두 경로 유지) | 중간 (단일 경로) |
| 기존 문구 변경 | 불필요 | 일부 필요 | ✓ 전면 변경 |

**선택 이유:** 하이브리드는 두 저장 경로를 영구히 유지해야 해서 코드 복잡도가 계속 높아짐. 전면 전환이 장기적으로 더 단순하고 AI 연동도 서버에서 직접 처리 가능.

---

## 4. 확정 아키텍처: 전면 DB 전환

```
┌────────────────────────────────────────────────────────┐
│                      Do it OS                          │
│                                                        │
│  모든 사용자: DB 저장 (로그인 필수)                       │
│  "Do it OS는 계정에 연결됩니다."                         │
│  "여러 기기에서 이어서 사용할 수 있어요."                  │
│                                                        │
│        ↕  doit_store.js → API 호출로 교체               │
└────────────────────────────────────────────────────────┘
                 ↓ 모든 쓰기/읽기
┌────────────────────────────────────────────────────────┐
│  backend/apis/v1/doit_routers.py                       │
│  모든 엔드포인트: Depends(get_request_user) 필수         │
│  GET/POST/PUT/DELETE  /api/v1/doit/thoughts            │
│  POST                 /api/v1/doit/thoughts/bulk-sync  │
│  GET                  /api/v1/doit/thoughts/ai-summary │
└────────────────────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────┐
│  PostgreSQL: doit_thoughts 테이블                      │
│  (user_id FK, 단일 테이블, sparse 필드)                 │
└────────────────────────────────────────────────────────┘
                 ↓ AI 도움 모드 (이번 대화에만 허용)
┌────────────────────────────────────────────────────────┐
│  POST /api/v1/chat/send                                │
│  body에 doit_context 포함 (요약본만, 원본 JSON 금지)     │
│  {unclassified_count, today_todos, active_projects}    │
└────────────────────────────────────────────────────────┘
```

**전환 후 제품 문구 변경:**

| 현재 | 변경 후 |
|------|---------|
| "Do it OS는 이 브라우저 안에만 저장됩니다." | "Do it OS는 계정에 안전하게 저장됩니다." |
| "서버에 저장되지 않습니다." | "여러 기기에서 이어서 사용할 수 있어요." |
| (없음) | "AI는 사용자가 허용한 내용만 참고합니다." |

---

## 5. 단계별 PR 계획

### PR 1 — DB 모델 + API 뼈대 (백엔드만)

**목표:** 백엔드에 테이블과 CRUD API 추가. 프론트는 전혀 건드리지 않음. 이 PR만으로는 사용자 경험 변화 없음.

**신규 파일:**
```
backend/models/doit.py
backend/dtos/doit.py
backend/repositories/doit.py
backend/services/doit.py
backend/apis/v1/doit_routers.py
backend/db/migrations/models/XX_add_doit_thoughts.py
```

**테스트 범위:**
- CRUD API 단위 테스트 (생성/조회/수정/삭제)
- 다른 user_id 데이터 접근 시 403 반환 확인
- bulk-sync upsert 동작 — 동일 ID 존재 시 updated_at 최신 우선 병합 확인

---

### PR 2 — 프론트 저장 로직 API 전환 + 마이그레이션 플로우

**목표:** `doit_store.js`의 `loadThoughts`/`saveThoughts`를 API 호출로 교체. 첫 진입 시 기존 localStorage 데이터를 DB로 자동 이전.

**수정/신규 파일:**
```
frontend/lib/doit_store.js          ← loadThoughts/saveThoughts → API 호출로 교체
frontend/lib/doit_api.js            ← 신규: API 호출 래퍼 (GET/POST/PUT/DELETE)
frontend/components/doit/MigrationBanner.js  ← 신규: 이전 진행 상태 표시
```

**마이그레이션 플로우 (로그인 후 Do it OS 첫 진입 시):**
1. DB에 해당 user_id의 thought 0개 + localStorage에 데이터 있음 → 이전 배너 표시
2. 배너: "이전에 작성한 메모 N개를 계정에 연결할게요." → 자동 bulk POST
3. 성공 → localStorage 키 삭제, DB 기반으로 전환 완료
4. 실패 → 배너에 재시도 버튼, localStorage는 그대로 유지 (다음 진입 시 재시도)

**optimistic update 전략 (이 PR):**
- 쓰기 시: UI 즉시 반영(낙관적) → API 호출 → 실패 시 롤백 + toast "저장에 실패했어요"
- 읽기 시: API 응답 기다린 후 렌더 (스켈레톤 UI 표시)

---

### PR 3 — localStorage 코드 완전 제거 + 문구 변경

**목표:** PR 2가 안정화된 후 레거시 localStorage 코드, 복구 백업 로직, 계정 분리 격리 로직 제거. 가이드 문구 변경.

**수정 파일:**
```
frontend/lib/doit_store.js          ← localStorage 관련 코드 전부 제거
frontend/components/doit/ActionableGate.js  ← 가이드 문구 변경
frontend/app/app/do-it-os/page.js   ← 가이드 문구 변경
```

**제거 대상 localStorage 키:**
```
danaa_doit_thoughts_v1::u{userId}
danaa_doit_thoughts_v1_recovery_backup_v1::u{userId}
danaa_doit_thoughts_v1_legacy_quarantine_v1
danaa_doit_guide_seen_v1::u{userId}
danaa_doit_layout_toast_shown_v1::u{userId}
danaa_doit_thoughts_v1_legacy_quarantined
```

---

### PR 4 — AI 도움 모드 MVP ("이번 대화에만 허용")

**목표:** 채팅 입력창에 "Do it OS 참고" 버튼 추가. 누르면 이번 메시지 1회에만 Do it OS 요약을 AI에 전달.

**수정/신규 파일:**
```
frontend/components/chat/DoitContextButton.js  ← 신규: 채팅 입력창 하단 버튼
frontend/lib/doit_ai_summary.js                ← 신규: 요약 생성 (DB에서 ai-summary 호출)
backend/services/chat/service.py               ← doit_context 수신 + 프롬프트 삽입
backend/services/chat/prompting.py             ← doit_context 섹션 추가
backend/apis/v1/chat_routers.py               ← SendMessageRequest에 doit_context 필드 추가
```

**이번 대화에만 허용 동작:**
- 버튼 클릭 → 범위 선택 모달 (미분류/오늘 할 일/일정 등 체크박스)
- 확인 → `/api/v1/doit/thoughts/ai-summary` 호출 → 요약본 생성
- 해당 메시지 전송 시 body에 `doit_context` 포함
- 다음 메시지부터는 자동으로 비활성화 (1회성)
- 버튼 재클릭 시 다시 활성화 가능

---

### PR 5 — 고급 동기화 (conflict resolution + 멀티탭)

**목표:** `updatedAt` 기반 최신 우선 병합, `BroadcastChannel`로 같은 계정 멀티탭 실시간 반영

*PR 2 배포 후 실사용 데이터와 충돌 패턴이 확인되면 진행.*

---

## 6. DB Schema 초안

```sql
-- 단일 테이블 전략 (category별 sparse 필드)
CREATE TABLE doit_thoughts (
    -- 기존 't-{timestamp}-{random}' 형식 유지 → 마이그레이션 ID 충돌 없음
    id              VARCHAR(40) PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 공통 필드
    text            TEXT NOT NULL DEFAULT '',
    category        VARCHAR(20),
    -- null | todo | schedule | project | note | health | waiting | someday
    created_at      TIMESTAMPTZ NOT NULL,
    classified_at   TIMESTAMPTZ,
    discarded_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- 캔버스 UI (서버에서 계산하지 않음, 저장만)
    canvas_x        FLOAT,
    canvas_y        FLOAT,
    rotation        SMALLINT DEFAULT 0,
    color           VARCHAR(20),
    card_width      SMALLINT,
    card_height     SMALLINT,

    -- schedule / todo 전용
    scheduled_date  DATE,
    scheduled_time  TIME,
    schedule_note   TEXT,
    planned_date    DATE,

    -- project 전용
    description     TEXT,
    next_action     TEXT,
    project_status  VARCHAR(20),
    project_link_id VARCHAR(40),  -- 자기 참조 (느슨한 FK, ON DELETE 없음)

    -- note 전용
    note_body       TEXT,

    -- 분류 흐름 (JSONB)
    clarification   JSONB DEFAULT '{}',
    -- { actionable: bool|null, decision: string|null, source: string|null }

    -- 자기 전 리추얼 (JSONB)
    end_of_day      JSONB DEFAULT '{}',
    -- { ritualDate: 'YYYY-MM-DD'|null, action: string|null }

    -- 기타
    waiting_for     TEXT,
    someday_reason  TEXT,
    urgency         JSONB,

    -- 동기화 메타
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doit_thoughts_user_id
    ON doit_thoughts(user_id);
CREATE INDEX idx_doit_thoughts_user_category
    ON doit_thoughts(user_id, category);
CREATE INDEX idx_doit_thoughts_user_updated
    ON doit_thoughts(user_id, updated_at DESC);
```

**단일 테이블을 선택한 이유:**
- 기존 localStorage JSON 구조가 "하나의 배열"이라 직접 매핑 가능
- 마이그레이션이 단순: JSON 배열의 각 항목 → 행 1개 삽입
- JOIN 없이 모든 뷰를 `category` 컬럼 필터 하나로 처리
- 나중에 필요하면 `category='project'`만 별도 파티션 또는 뷰로 분리 가능

---

## 7. API 초안

```
# 기본 CRUD
GET    /api/v1/doit/thoughts
       ?category=todo              ← 카테고리 필터 (없으면 전체)
       &since={iso}                ← 마지막 sync 이후 변경분만
       → [Thought, ...]

POST   /api/v1/doit/thoughts
       body: ThoughtCreateDTO
       → Thought

PUT    /api/v1/doit/thoughts/{id}
       body: ThoughtUpdateDTO      ← 변경된 필드만 (partial update)
       → Thought

DELETE /api/v1/doit/thoughts/{id}
       → 204

# 초기 마이그레이션용 bulk
POST   /api/v1/doit/thoughts/bulk-sync
       body: { thoughts: [...] }
       → 동일 ID 존재 시 updated_at 최신 우선 병합
       → { synced: N, skipped: N, errors: [...] }

# AI 요약 (사용자가 AI 도움 버튼 눌렀을 때만 호출)
GET    /api/v1/doit/thoughts/ai-summary
       → {
            unclassified_count: 5,
            today_todos: ["운동하기", "병원 전화"],
            overdue_schedules: 2,
            active_projects: ["다나아 리디자인"],
            recent_notes_count: 3
         }
       ※ 원본 text 전체 미포함 — 항목명(title 수준)만 반환
       ※ category='health' 는 기본적으로 미포함 (민감 정보 보호)
```

**인증/권한 (전 엔드포인트 공통):**
- `Depends(get_request_user)` 필수
- `thought.user_id != current_user.id` → 403 즉시 반환

---

## 8. AI 도움 모드 UX 초안

### 채팅 입력창 하단 버튼 (비활성 상태)

```
┌────────────────────────────────────────────────────┐
│ 오늘 뭐부터 할까요?                                   │
│                                    [전송]            │
├────────────────────────────────────────────────────┤
│ [ 🗂 Do it OS 참고하기 ]                             │
│   누르면 이번 메시지에만 참고해요                       │
└────────────────────────────────────────────────────┘
```

### 버튼 클릭 → 범위 선택 모달

```
┌─────────────────────────────────────┐
│  AI가 참고할 내용 선택               │
│  이번 메시지에만 적용돼요             │
│                                     │
│  ☑ 미분류 생각 (5개)                │
│  ☑ 오늘 할 일 (2개)                 │
│  ☑ 오늘 일정 지난 항목 (1개)         │
│  ☐ 노트 (개인 내용 포함될 수 있음)   │
│  ☐ 건강 단서                        │
│                                     │
│  [취소]          [이번에만 참고하기]  │
└─────────────────────────────────────┘
```

### 활성화 후 입력창 상태

```
┌────────────────────────────────────────────────────┐
│ 오늘 뭐부터 할까요?                                   │
│                                    [전송]            │
├────────────────────────────────────────────────────┤
│ ✓ Do it OS 참고 중  미분류 5개·할 일 2개  [취소]      │
└────────────────────────────────────────────────────┘
```

### LLM에 전달되는 컨텍스트 (원본 JSON 아님)

```
## Do it OS 현황 (사용자 이번 메시지 한정 허용)
- 미분류 생각: 5개 ("병원 예약", "이메일 답장", "운동 루틴 정하기", ...)
- 오늘 할 일: 2개 ("혈당 체크", "저녁 산책")
- 지난 일정 미완료: 1개
※ 사용자가 이번 메시지에만 허용한 데이터입니다. AI는 읽기만 가능하며 직접 수정할 수 없습니다.
```

### 핵심 규칙

| 규칙 | 내용 |
|------|------|
| 기본값 | 꺼짐 (버튼 비활성, AI가 Do it OS 모름) |
| 허용 범위 | 이번 메시지 1회에만 — 전송 후 자동 비활성화 |
| AI 권한 | 읽기(요약본)만 가능, 직접 수정 불가 |
| 수정 제안 | AI가 "할 일 추가할까요?" 제안 → 사용자 확인 버튼 클릭 후에만 저장 |
| 금지 | AI가 원본 JSON 전체 읽기 / AI가 자동 분류·완료 처리 |
| `health` 카테고리 | 기본 미포함 (민감 건강 단서 보호) |

---

## 9. 보안/프라이버시 체크리스트

| 항목 | 전환 후 조치 |
|------|-------------|
| 다른 사용자 데이터 접근 | API에서 `user_id` 필터 필수, 불일치 시 403 즉시 |
| AI가 전체 데이터 무단 읽기 | `/ai-summary` 엔드포인트만 노출, 원본 text 미포함 |
| LLM provider 전송 고지 | AI 도움 버튼 모달에 동의 문구 포함 |
| 민감 건강 단서 처리 | `category='health'` 기본 미포함, 사용자가 명시적으로 체크 시만 포함 |
| 채팅 로그에 개인 생각 기록 | `doit_context` 필드 ChatMessage 저장 여부 결정 필요 (마스킹 권장) |
| 계정 탈퇴 시 데이터 삭제 | `ON DELETE CASCADE` → users 삭제 시 doit_thoughts 자동 삭제 |
| 비로그인(anon) 데이터 귀속 | 로그인 완료 후 anon localStorage → bulk-sync로 이전, 이전 후 anon 키 삭제 |

**AI 도움 모드 동의 문구 (모달 하단):**

> "선택한 항목의 요약만 AI에 전달됩니다. Anthropic 서버로 전송되며, AI 학습에는 사용되지 않습니다."

---

## 10. 예상 작업 기간

| PR | 내용 | 난이도 | 예상 기간 |
|----|------|--------|-----------|
| PR 1 | DB 모델 + API 뼈대 | 중 | 3~4일 |
| PR 2 | 프론트 API 전환 + 마이그레이션 플로우 | 상 | 5~7일 |
| PR 3 | localStorage 코드 제거 + 문구 변경 | 하 | 1~2일 |
| PR 4 | AI 도움 모드 MVP | 중 | 3~4일 |
| PR 5 | 고급 동기화 | 상 | 1~2주 |

**PR 1~4 합계: 약 3주** (단독 개발 기준, 리뷰/QA 포함)  
**PR 5: 실사용 데이터 확보 후 필요에 따라 진행**

---

## 11. 잔여 기술 결정 사항

제품 방향(1~3번)은 확정됨. 아래는 구현 시작 전 확인이 필요한 기술 결정만 남음.

**4. 기존 사용자 localStorage 데이터를 언제 어떻게 이전할 것인가?**
- PR 2에서 "첫 진입 시 자동 이전 + 배너 안내"로 진행 예정
- 이전 실패 시 localStorage 유지하고 재시도 → 완전 실패 시 수동 내보내기 제공 여부 결정 필요

**5. optimistic update 수준은?**
- PR 2: UI 즉시 반영 + 실패 시 toast + 롤백 (기본)
- PR 5: conflict resolution (같은 계정 멀티탭/멀티기기 동시 편집)

**6. `canvas_x/y`를 DB에 저장할 것인가?**
- 저장하면: 같은 기기에서 카드 위치 유지
- 새 기기나 다른 해상도: `relayoutZeroCards()` 자동 재배치
- **현재 방향: 저장하되 새 기기 진입 시 자동 재배치**

---

## 현재 상태 (2026-05-03)

- 코드 분석 완료
- 방향 확정: 전면 DB 전환 + AI 이번 대화 허용
- 구현 미시작
- 다음 스텝: PR 1 브랜치 생성 후 백엔드 모델/API 작업 시작
