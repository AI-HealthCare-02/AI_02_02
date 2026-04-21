# Do it OS 정리 명료화 v1/v2 — 반영 범위 · 한계 · Phase 6+ 예약 목록

> **작성**: 2026-04-21 (v1) · 2026-04-21 (v2 업데이트)
> **대상 범위**: `frontend/components/doit/*`, `frontend/lib/doit_store.js`, 각 투영 뷰 페이지 + `/project/[id]`
> **왜 있는 문서인가**: Codex 원본(`codex_NEW_DESKTOP_Dev_phase4`)이 **001~010 마이그레이션**을 거쳐 도달한 "점진적 명료화(progressive clarify)" 설계와 비교해 우리가 **무엇을 의도적으로 건너뛰었는지** 기록. 나중에 확장할 때 트리거 기준 제공.
> **원칙**: 플랜 과잉설계 방지 (`feedback_plan_quality.md`). 실 사용 피드백 없이 이론적 완성도만 올리지 않는다.

## v2 → v3 변경점 (Phase 6 · 2026-04-21)

### 새로 해결된 것
- ✅ **5 카테고리 일관성** — `ClassifiedBoard` 카드가 Link 래핑되어 클릭 시 카테고리 페이지로 이동 (todo·health는 대시보드로 폴백). `CategoryListView` 의 `CATEGORIES_WITH_DETAIL = {project, note}` 확장으로 노트 카드도 상세 진입.
- ✅ **점진 분류 패널 (B안)** — `ClassifySlidePanel`. 일정 카테고리만 2단계 (날짜 → 시간, skip 가능). 다른 카테고리는 0단계 "저장" 버튼만. ESC·배경 클릭·[취소] 시 localStorage 변경 0.
- ✅ **노트 상세 페이지** — `/app/do-it-os/note/[id]` dynamic route. `NoteDetailView` 에 제목·본문(textarea resize-y) 700ms debounce 저장. ProjectDetailView 60% 재사용.
- ✅ **프로젝트 "다음 행동" 카드 프리셋** — `NextActionCardGrid` 10개 (할 일 추가·일정 잡기·노트 작성·회의 준비·연락하기·조사·학습·결정하기·피드백·리뷰·마감 연장). 클릭 → 새 thought 자동 생성 + 토스트 `[label] 생성됐어요 [보기] [되돌리기]`. 자유 입력은 `<details>` 접힘으로 보존.
- ✅ **일정 시간 (`scheduledTime`)** — TimeChip 신규. 리스트 뷰·달력 선택 패널에 인라인 편집, 달력 우측 패널은 시간 오름차순 정렬.

### 데이터 스키마 확장 (하위호환)
- `scheduledTime: 'HH:MM' | null` (일정 전용)
- `noteBody: string | null` (노트 상세 본문)
- `projectLinkId: string | null` (G6이 만드는 thought에 예약. UI는 Phase 7+)
- `getNoteById(list, id)` 유틸 신설
- `unclassifyThought` → 위 3필드 동시 nullify (dangling 방지)

### 연계 매트릭스 (v3)

| 작업 | 반영되는 화면 |
|---|---|
| 일정 패널 저장(오늘 + 14:30) | 캔버스(사라짐) · 명료화 리스트(사라짐) · 정리 결과 보드 · 대시보드 오늘 일정 · 일정 리스트(시간 뱃지) · 달력 우측 패널(14:30 정렬) |
| 패널 [취소] / ESC / 배경 | localStorage 변경 0, thought 여전히 미분류 |
| 프로젝트 다음 행동 "할 일 추가" | 새 thought 자동 생성 + 토스트 + 대시보드 todo/정리 결과 보드 반영 |
| 노트 상세 body 편집 | 리스트 카드 미리보기(Phase 7+ 예약 — 현재 카드엔 본문 미표시) |

### 여전히 남은 한계 (Phase 7+)

---

## v1 → v2 변경점 (Phase 5 · 2026-04-21)

### 새로 해결된 것
- ✅ **대시보드 "오늘 일정" 실데이터 연동** — `getTodayScheduled(thoughts)` + `getOverdueScheduled(thoughts)` 유틸. 상위 3건 + "+N개 더" + "기한 지남 N" 배지.
- ✅ **정리 명료화 토스트 내 인라인 날짜 피커** — 일정 분류 시 기본값 오늘 자동 세팅, 토스트 내 `DateChip(variant="dark")` 즉시 편집. 포커스·hover 중에는 타이머 정지, Escape/되돌리기 즉시 취소.
- ✅ **프로젝트 상세 페이지** — `/app/do-it-os/project/[id]` dynamic route. 제목·설명·다음 행동 textarea/input debounce(700ms) 자동 저장, 상태 토글 3단계(진행 중·잠시 중단·완료), "분류 해제" confirm.
- ✅ **일정 페이지 리스트 ↔ 달력 뷰 토글** — 순수 React 7×6 그리드, 월 내비 + "오늘" 버튼, 셀별 도트 최대 3 + "+", 우측 선택 날짜 패널(인라인 DateChip, Inbox로 되돌리기). 모바일은 세로 스택 폴백.

### 데이터 스키마 확장 (하위호환)
- `description: string | null` — 프로젝트 설명
- `nextAction: string | null` — 프로젝트 다음 행동
- `projectStatus: 'active'|'onhold'|'done'|null` — 프로젝트 상태
- `classifyThought(list, id, category, meta={})` — 시그니처에 meta 추가, 기존 호출 100% 호환
- 공용 유틸: `todayIso`, `getTodayScheduled`, `getOverdueScheduled`, `getProjectById`, `PROJECT_STATUS_OPTIONS`

### 연계 매트릭스 (v2 기준)

| 작업 | 영향받는 화면 | 반영? |
|---|---|---|
| 일정 분류 + 오늘 날짜(자동) | 캔버스(사라짐) · 명료화 리스트(사라짐) · 정리 결과 보드 · **대시보드 오늘 일정** · 일정 리스트 버킷 · 달력 셀 도트 | ✅ 전 화면 동기 |
| 날짜 변경 (리스트 DateChip) | 달력 뷰 · 대시보드 오늘 일정 | ✅ |
| 날짜 변경 (달력 우측 패널) | 리스트 뷰 · 대시보드 오늘 일정 | ✅ |
| 프로젝트 상세에서 description/상태 편집 | 프로젝트 리스트 카드 미리보기 + "완료" 취소선 + 상태 뱃지 | ✅ |
| 프로젝트 분류 해제 | description/nextAction/projectStatus 동시 null 초기화 (dangling 방지) | ✅ |

### 여전히 남은 한계 (Phase 6+)

---

## 1. 이번(v1)에 반영된 것

### 1-1. 핵심 UX
- **5카테고리 분류** — 할 일(todo) · 일정(schedule) · 프로젝트(project) · 노트(note) · 건강 단서(health)
- **한 번의 클릭 = 분류** (카드 1장, 5버튼 중 선택)
- **분류 후 영수증 토스트** — 3.2초, "○○에 저장됐어요 [되돌리기]"
- **분류 해제 (Undo)** — 카테고리별 보드·투영 뷰·토스트에서 모두 가능
- **투영 뷰 3개** — `/project`, `/schedule`, `/note` 각각 실제 리스트 표시
- **일정 날짜 편집** — 메모 카드 인라인 날짜 피커 + 자동 정렬 (기한 지남 / 오늘 / 내일 / 앞으로 / 날짜 미정)
- **대시보드 연동** — "정리 결과 보드"에 카테고리별 미니 카드 표시

### 1-2. 데이터 스키마 (localStorage `danaa_doit_thoughts_v1`)

| 필드 | 추가 시점 | 비고 |
|---|---|---|
| `id`, `text`, `createdAt` | 생각 쏟기 MVP | Thought 기본 |
| `x`, `y`, `rotation`, `color`, `width`, `height` | 생각 쏟기 MVP | 캔버스 배치 |
| `category` | v1 (2026-04-21) | `null | 'todo' | 'schedule' | 'project' | 'note' | 'health'` |
| `classifiedAt` | v1 | ISOString · undo 시 null |
| `scheduledDate` | v1 | `YYYY-MM-DD` · 일정 투영 뷰에서만 편집 |
| `urgency` | v1 (필드만 예약) | `'normal' | 'urgent'` · UI는 Phase 4에서 |

---

## 2. 명시적으로 놓친 것 (Phase 6+ 예약 목록)

### 2-1. 할 일(todo) 세분화 · 할 일 전용 페이지 (⭐ 최우선)

| Codex에 있는 것 | 우리 v1 | Phase 4 필요성 |
|---|---|---|
| `clarify_type: next_action / scheduled / delegated / someday / tickler` | 없음 (할 일은 평면) | 🔶 "할 일"이 많아지면 "지금 할 것 vs 나중" 구분 필수 |
| 긴급도 · 우선순위 | 필드만 예약, UI 없음 | 🔶 |
| 할 일 전용 페이지 (`/todo` 또는 `/today`) | 없음 (정리 결과 보드에서만) | ⭐ 사용자 수요 크면 신규 |
| 맡길 일(delegated) 별도 뷰 | 없음 | 🔵 |

### 2-2. 카테고리 내부 세분화

| 영역 | Codex | 우리 v1 |
|---|---|---|
| note classification | `draft / watch_later / reference / development` | 없음 |
| project status | `not_started / active / done / stopped` | 없음 |
| area_resources (영역·자원) 최상위 계층 | 있음 | **없음 (의도적)** |
| goal 엔티티 | 있음 | 없음 |

### 2-3. 관계·연결

| 관계 | Codex | 우리 v1 |
|---|---|---|
| project ↔ task (할 일) | junction table | **없음** |
| note ↔ task | `note_task_links` | 없음 |
| note ↔ project | `note_project_links` | 없음 |

→ 현재 모든 메모가 **평면 리스트**. 프로젝트 "사업 준비"와 할 일 "병원 예약" 사이에 연결고리 없음.

### 2-4. 워크플로우 원칙 (Codex에서 강조, 우리가 건너뜀)

| 원칙 | Codex | 우리 v1 |
|---|---|---|
| **한 카드 · 한 질문** 단계적 명료화 | 적용 | ❌ 5버튼 한 번에 결정 |
| **중간 클릭은 저장 아님** | 드래프트 → 최종 확인 | ❌ 즉시 저장 |
| **최종 확인에서 한 번만 저장** | 커밋 단계 존재 | ❌ |
| **저장 직후 반영 위치 영수증** | Placement receipt | 🔶 부분 반영 (토스트만, 세부 위치 링크 X) |
| **capture session 묶음** | `capture_session_id` | ❌ 없음 |

### 2-5. 아이스박스 · 아카이브 · 리뷰 뷰

- `/icebox` (언젠가), `/archive` (아카이브), `/review` (점검) 페이지 → 없음
- 우리 v1 철학: 다나아는 Do it OS가 **보조 레이어**. 본체 UX에 집중.

---

## 3. 왜 이걸 지금 안 하는가 (정량 근거)

| 근거 | 내용 |
|---|---|
| **Codex는 수개월 · 수차례 재작성** | docs 폴더에 "생각쏟기 재설계 체크리스트" 12번 반복, 마이그레이션 10개 단계적 확장 |
| **다나아의 Do it OS 포지션** | 주 기능 = AI 채팅·리포트·챌린지. Do it OS는 보조 레이어. Codex급 정교도 투입 시 본체 자원 잠식 |
| **바이브코더 유지 가능성** | 복잡도↑ = 바이브코더 단독 유지 보수 어려워짐 |
| **사용자 피드백 기반 진화** | 실 사용 없이 이론적 완성도 추구 = 불필요 기능 양산 위험 |

---

## 4. Phase 4+ 진입 트리거 (언제 해야 하는가)

다음 상황이 발생하면 해당 항목 구현:

| 항목 | 트리거 |
|---|---|
| 할 일 세분화 (clarify_type) | 사용자가 "할 일이 섞여서 뭐부터 할지 모르겠다" 요청 / 할 일 50개 이상 누적 |
| 할 일 전용 페이지 | 동일 |
| 프로젝트 ↔ 할 일 연결 | "이 프로젝트 하위 할 일은 어디 있어?" 같은 질문 반복 |
| note classification | 노트 20개 이상 누적 시 자동 검토 |
| capture session 묶음 | 하루 30개 이상 입력 사용자 등장 |
| 중간 저장 원칙 (드래프트) | "실수로 분류했는데 확인 없이 저장됐다" 피드백 |
| 아이스박스 / 아카이브 | "옛날 것 보관"이 필요해지는 시점 |
| area_resources 계층 | 현재 5 카테고리로 부족하다는 피드백 |

각 트리거 발생 시 **별도 MVP 사이클** 진행 (v1 → v2 → ...). 한 번에 전부 X.

---

## 5. 참고 경로

| 자료 | 위치 |
|---|---|
| Codex 원본 | `C:\Users\mal03\Desktop\Codex\codex_NEW_DESKTOP_Dev_phase4\` |
| Codex 핵심 설계 문서 | `docs/03-07 02-17 세컨드 브레인 OS 구조 분석 및 JustDoIt 전면 재구성 설계.md` |
| Codex 생각쏟기 UX 인수인계 | `docs/03-08 12-57 생각쏟기 중심 UX 재설계 1단계 인수인계.md` |
| Codex 마이그레이션 | `supabase/migrations/001~010` (특히 `010_thought_dump_progressive_clarify.sql`) |
| 다나아 현재 코드 | `frontend/lib/doit_store.js`, `frontend/components/doit/` |
| 관련 플랜 문서 | `docs/design/do_it_os_frontend_boundary.md`, `docs/design/do_it_os_undecided_resolved.md` |

---

_작성 원칙: 본 문서는 "현재 우리가 어디에 있고 무엇을 건너뛰었는지"의 기록. 확장 시점에 다시 열람._
