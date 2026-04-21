# Do it OS 프론트엔드 격리 원칙

> **문서 역할**: Do it OS MVP 를 다나아 프론트엔드에 안전하게 붙이기 위한 **경계선·허용·금지** 를 못박는 문서. 구현·리뷰 단계에서 이 문서의 규칙을 벗어나면 PR 머지 불가.
> **버전**: v1 (2026-04-21)
> **기준**: `docs/design/04-21 15-00 Do it OS 현재 상태 조사 리포트.md`, `Do it OS/do_it_os_1차플랜.md`

---

## 1. 기본 원칙 (우선순위 순)

1. **기존 다나아 기능 회귀 0건**. AI 채팅·리포트·챌린지는 눈에 띄는 변화 없어야 한다.
2. **백엔드 0 호출**. MVP 는 localStorage 로만 동작. `fetch`/`api()` 함수 어떤 형태로도 Do it OS 쪽에서 호출 금지.
3. **건강 기록 DB 분리**. Do it OS "건강 단서" 는 리포트/챌린지 집계와 다른 저장소·다른 네임스페이스.
4. **AI 자동 저장 금지**. 사용자가 수동 확인한 항목만 저장.
5. **디자인 토큰만 사용**. 하드코딩 색·폰트·radius 금지. `docs/design/danaa_design_system.md` 토큰만.
6. **원본 Codex 코드 이식 금지**. UX 개념만 참고, 파일 import·복사 불가.

---

## 2. 폴더·파일 경계

### 2-1. Do it OS MVP 에서 **생성 가능한 파일**

```
frontend/app/app/do-it-os/
├─ page.js                   # 대시보드 (3열 그리드 + 하단 strip)
├─ thinking/page.js          # 생각넣기 캔버스
├─ classify/page.js          # 생각정리 (MVP 는 "준비 중")
├─ project/page.js           # 프로젝트 (MVP 는 "준비 중")
├─ schedule/page.js          # 일정 (MVP 는 "준비 중")
└─ note/page.js              # 노트 (MVP 는 "준비 중")

frontend/components/doit/
├─ ThoughtCanvas.js          # 캔버스 + 메모 카드
├─ MemoCard.js               # 개별 메모 렌더
└─ DoitSidebarItem.js        # 사이드바 nested 항목 (선택)

frontend/doit_mvp_test.mjs   # Playwright E2E (6 시나리오 이내)
```

### 2-2. Do it OS MVP 에서 **수정 가능한 파일**

| 파일 | 허용 변경 | 금지 변경 |
|---|---|---|
| `frontend/components/Sidebar.js` | `navItems` 에 Do it OS 항목 추가 · subitems 렌더 추가 | 기존 3개 메뉴(`AI 채팅`·`리포트`·`챌린지`) 순서·label·href 변경 금지. `categories` 드롭다운·`useConversations` 훅 수정 금지 |
| `frontend/app/globals.css` | `.doit-*` 네임스페이스 신규 섹션 추가 | 기존 변수·기존 `.sidebar-*`·기존 `.chat-*` 섹션 수정 금지 |

### 2-3. 절대 건드리지 않는 파일

```
backend/**                                # 전체 (DB · API · 헬스 레코드 · 서비스 레이어)
frontend/app/app/chat/**
frontend/app/app/report/**
frontend/app/app/challenge/**
frontend/app/app/layout.js                # 구조 안전. 건드릴 필요 없음
frontend/components/RightPanelV2.js
frontend/components/MissedQuestions*
frontend/hooks/useConversations.js
frontend/hooks/useApi.js
backend/services/chat/**
backend/services/health*
shared/danaa_product_guide.v1.json

# Gemma 관련 (다른 브랜치)
backend/services/chat/openai_client.py
backend/services/chat/streaming.py
backend/services/chat/intent.py
envs/*.env
docker-compose.yml

# 참고 자료
archive/**
docs/planning/**
Do it OS/*.html                           # 참고 전용. 복사 금지
Do it OS/*.md                             # README·플랜 문서. 수정 금지
```

---

## 3. 데이터 경계

### 3-1. 허용 저장소
- **`window.localStorage`** 만 사용.

### 3-2. 키 네임스페이스
| 키 | 내용 |
|---|---|
| `danaa_doit_thoughts_v1` | 생각넣기 메모 배열 `[{ id, text, createdAt, x, y, rotation, color }]` |
| `danaa_doit_preferences_v1` | 사용자 설정 (다크 변형 등) |
| `danaa_doit_session_v1` | 현재 세션 상태 (undo 스택 등) |

### 3-3. 금지 저장소·금지 통신
- `sessionStorage` — 허용되나 MVP 불필요
- **`fetch('/api/...')` · `api(...)` 훅** — **금지** (Do it OS 파일 전체에서)
- WebSocket · SSE · Supabase SDK — 금지
- 기존 건강 기록 테이블 · 챌린지 테이블 접근 — 금지

### 3-4. 저장 용량 가드
- 메모당 1KB 가정 → 최대 5000개. 초과 시 경고 배너 표시 + 오래된 항목 수동 정리 안내.
- 직렬화 실패 시 저장 스킵 + 콘솔 경고. 사용자 데이터 손실 방지 우선.

---

## 4. 라우트 경계

### 4-1. 신규 라우트 (전부 `/app/do-it-os` 하위)
- `/app/do-it-os` — 대시보드
- `/app/do-it-os/thinking`
- `/app/do-it-os/classify`
- `/app/do-it-os/project`
- `/app/do-it-os/schedule`
- `/app/do-it-os/note`

### 4-2. 라우트 네이밍 확정
- `/app/do-it` 또는 `/app/life` 대신 **`/app/do-it-os`** 사용 (문의 프롬프트 §149 후보 중 선택).
- 이유: 폴더명 `Do it OS` 와 일치하여 가독성 ↑, 사용자가 "Do it OS" 라는 고유 브랜드로 부름.

### 4-3. RightPanelV2 비노출
- `frontend/app/app/layout.js` 는 `<Sidebar /> + {children}` 구조. RightPanelV2 는 `chat/page.js:12, 1764` 에서만 import.
- 결과: `/app/do-it-os/*` 경로에서 RightPanelV2 **자동 미노출**. 별도 제거 코드 불필요.

---

## 5. 디자인 경계

### 5-1. 허용
- `docs/design/danaa_design_system.md` v1 의 CSS 변수만 사용
- Pretendard 폰트 (`globals.css` 에 이미 로드됨)
- `lucide-react` 아이콘 (추가 패키지 설치 없이)
- Tailwind 기본 유틸리티 + 다나아 확장 (`cream-*`, `nature-*` 등)

### 5-2. 금지
- 하드코딩 색(`#161616`·`#F8F8F6` 등 직접 쓰기 금지, **항상** `var(--color-*)`)
- 외부 패키지 새로 설치 (`react-beautiful-dnd`·`framer-motion`·`zustand` 등)
- inline `style={{ background: '#ffffff' }}` 같은 고정 스타일
- `!important` 남발
- 애니메이션 지속시간 > 0.3s (AGENTS 톤 "부드러운 피드백" 원칙)

### 5-3. 메모 카드 파스텔 5색 (2026-04-21 확정 · 버전 B 색상 변경안)
| 역할 | 라이트 | 다크 | 특성 | 대비 (vs `#ECECEC`) |
|---|---|---|---|---|
| 크림 (황토) | `#FFF5E6` | `#544327` | 웜 황토 | ~ 8.0 : 1 ✅ AAA |
| 스톤 (샌드) | `#F0EDE8` | `#4D4538` | 웜 베이지 샌드 | ~ 7.9 : 1 ✅ AAA |
| 민트 (세이지) | `#EBF4EF` | `#374F40` | 세이지 그린 | ~ 7.5 : 1 ✅ AAA |
| 라벤더 (더스티) | `#EDE8F4` | `#423C54` | 더스티 퍼플 | ~ 8.8 : 1 ✅ AAA |
| 블러시 (로즈) | `#F7E9E9` | `#544040` | 로즈 브라운 | ~ 8.0 : 1 ✅ AAA |

상세 근거·CSS 변수 네이밍·보더 처리: `docs/design/do_it_os_undecided_resolved.md §2`.
메모 카드는 **반드시** `var(--doit-memo-*)` 변수만 사용. 하드코딩 hex 금지.

---

## 6. 상호작용 경계

### 6-1. 허용
- 메모 입력 (Enter 로 추가, Shift+Enter 줄바꿈)
- 메모 삭제 (hover 시 × 버튼)
- 메모 자동 배치 (랜덤 위치 + 회전 ±4°)
- 페이지 진입 시 localStorage 복원
- 우상단 "정리하러 가기" 버튼 → `/app/do-it-os/classify`

### 6-2. MVP 에서 **제외** (2026-04-21 확정)
- 메모 드래그 / 이동 / 리사이즈 → Phase 2
- Ctrl+Z 되돌리기 → Phase 2 (삭제 후 3초 undo 토스트 정도로 대체 검토)
- 전역 단축키 팝업 → Phase 2

상세 근거: `docs/design/do_it_os_undecided_resolved.md` 항목 2·3.

### 6-3. 절대 금지
- Do it OS 화면에서 **AI 채팅 호출**
- Do it OS 입력을 **리포트 · 챌린지 · 건강 기록에 자동 반영**
- Do it OS 에 의료 조언 · 처방 · 약물 안내 · 투자 조언 출력

---

## 7. 접근성·반응형

- `aria-expanded`, `aria-label` (사이드바 nested)
- 키보드 Tab · Enter · Arrow 이동
- 모바일(`< 768px`)은 MVP 에서 "모바일 준비 중" 안내 배너 표시
- 다크·라이트 양쪽에서 테스트

---

## 8. 브랜치·커밋 경계

- **Do it OS 는 반드시 별도 브랜치**에서 진행. 권장: `feat/do-it-os-mvp`
- 분기점: `main` (가장 안전). `feat/chat-app-knowledge` 위에 쌓기 **금지** (Gemma 작업 섞여 있음)
- 커밋 컨벤션은 CLAUDE.md 기존 규칙 준수
- AI 설정 파일 (`.claude/`, `CLAUDE.md`, `AGENTS.md`) 제외 (사용자 feedback: `feedback_commit_scope.md`)

---

## 9. 테스트 경계

### 9-1. 필수
- `npm run build` 통과
- `doit_mvp_test.mjs` E2E 6 시나리오 이내:
  1. 로그인 → 사이드바 Do it OS 펼침 → 6 subitems 확인
  2. 생각넣기 경로 이동 → 메모 3개 입력 → 렌더 확인
  3. 새로고침 → localStorage 복원
  4. 기존 3대 메뉴(AI 채팅·리포트·챌린지) 정상 클릭 (회귀)
  5. 다크·라이트 토글 시 Do it OS 정상
  6. 모바일 뷰포트 "준비 중" 배너 표시

### 9-2. 금지
- 백엔드 테스트 신규 (Do it OS 는 백엔드 0 터치)
- E2E 가 실제 DB에 쓰기

---

## 10. 리뷰 게이트 (PR 머지 조건)

- [ ] 이 문서 §2-3 "절대 건드리지 않는 파일" 중 **변경 0건** (git diff 재확인)
- [ ] 백엔드 변경 0건
- [ ] `fetch`/`api` 호출 Do it OS 파일에서 Grep 0건
- [ ] 하드코딩 색 Grep — `#[0-9a-fA-F]{6}` 매치 0건 (`frontend/app/app/do-it-os/**`)
- [ ] `docs/design/danaa_design_system.md` 토큰만 사용
- [ ] Codex 원본 경로·파일명 Grep 0건
- [ ] 기존 Playwright 테스트 **회귀 0건**
- [ ] 다크·라이트 스크린샷 첨부
- [ ] `do_it_os_1차플랜.md` §8 미결정 6건 확정 반영
- [ ] 사용자 "구현해줘" 승인 증적

---

_이 문서는 Do it OS MVP 가 머지되기 전까지 v1 로 동결. 변경 시 사용자 승인 필수._
