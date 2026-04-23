# Do it OS 다나아 통합 1차 MVP 플랜 (보류 — 별도 세션 실행용)

> **저장 시각**: 2026-04-21
> **상태**: **미실행, 계획 문서로만 저장.** 다음 세션에서 이 파일을 읽고 이어받아 실행.
> **연관 문서**:
> - 원본 요구: `Do it OS/04-20 23-06 Do it OS 다나아 접목 클로드코드 문의 프롬프트.md`
> - 목업 1: `Do it OS/04-20 다나아 Do it OS 3안 비교 목업.html`
> - 목업 2: `Do it OS/04-20 다나아 Do it OS 확장형 대시보드 V1.html`
> - 목업 스크린샷: `c:\Users\mal03\Documents\Lightshot\Screenshot_1065.png`
> - 디자인 시스템: `docs/design/danaa_design_system.md` (이번 세션에서 생성 예정)

---

## 1. Context

다나아는 AI 채팅·리포트·챌린지 기반 건강 관리 서비스. Do it OS는 **생활 관리 레이어**로, 사용자가 머릿속 생각·할 일·걱정을 "꺼내고 정리"하도록 돕는 보조 기능. 브레인덤프·GTD·PARA·Second Brain·자이가르닉 효과를 다나아 톤에 맞게 재해석.

**제품 방향 고정 제약** (원본 문서 §3):
- 다나아 중심 UX(AI 채팅)는 유지. 기존 3대 메뉴(AI 채팅·리포트·챌린지) 구조 불변.
- 오른쪽 Today 패널은 건강 기록 입력 역할 유지.
- Do it OS는 건강 기록을 **대체하지 않음**. 보조 레이어.
- AI 자동 건강 기록 저장 금지. 저장 후보만 제시, 사용자 수동 확인 시에만 저장.
- 의료 진단·처방·약물 안내 금지.

---

## 2. 사용자 확정 결정 (2026-04-21 최종)

| 항목 | 결정 | 근거 |
|---|---|---|
| 사이드바 메뉴 이름 | **Do it OS** (영문 유지) | 사용자 직접 선택 |
| 생각넣기 진입 방식 | **별도 전용 페이지** `/app/do-it-os/thinking` | 사용자 확정 (2026-04-21) |
| 메모 드래그·리사이즈 | **MVP 제외** (자동 배치 + 삭제만) | 사용자 확정 (2026-04-21) |
| Ctrl+Z 되돌리기 | **MVP 제외** | 사용자 확정 (2026-04-21) |
| 브랜치 분기점 | **`main` 에서 분기** (`feat/do-it-os-mvp`) | 사용자 확정 (2026-04-21) |
| MVP 1차 범위 | **프론트 목업만 + localStorage** | 사용자 선택. 백엔드 수정 없음 |
| 메뉴 펼침 UX | Screenshot_1065 "세로 바 + 원형 dot + 들여쓰기" | 목업 스크린샷 기준 |
| 다크 메모 5색 | **버전 B (색상 변경안)** — 크림(황토) `#544327`, 스톤(샌드) `#4D4538`, 민트(세이지) `#374F40`, 라벤더(더스티) `#423C54`, 블러시(로즈) `#544040` | 사용자 확정 (2026-04-21) |
| i18n / 번역 | **한글 고정** (MVP), Phase 2 에서 i18n 검토 | Claude 제안 — 사용자 추가 확정 권장 |

→ §8 의 미결정 6건 **전원 확정 완료**. 상세: `docs/design/do_it_os_undecided_resolved.md`.

---

## 3. 조사 결과 (2026-04-21 Explore agent + 본인 Read)

### 3-1. 다나아 Sidebar 구조 (`frontend/components/Sidebar.js`)
- 25-29줄: 하드코딩 `navItems` 배열 (평면, nested 미지원)
  ```js
  navItems = [
    { icon: MessageSquare, label: 'AI 채팅', href: '/app/chat' },
    { icon: BarChart3, label: '리포트', href: '/app/report' },
    { icon: Target, label: '챌린지', href: '/app/challenge' },
  ]
  ```
- 31-36줄: `categories` 배열 토글 드롭다운(catOpen) 패턴 — nested 구현 참고
- 너비: 열림 300px, 닫힘 48px
- 아이콘: `lucide-react`. Do it OS 후보: `Zap` / `Brain` / `NotebookPen`

### 3-2. 라우트·레이아웃
- `frontend/app/app/layout.js:21-27`: `flex h-screen flex-1 flex-col`
- RightPanelV2는 `chat/page.js`에서만 조건부 렌더 → `/app/do-it-os/*`에는 자동 미노출 ✅
- 신규 경로: `/app/do-it-os`, `/app/do-it-os/thinking`, `/app/do-it-os/classify`, `/app/do-it-os/project`, `/app/do-it-os/schedule`, `/app/do-it-os/note`

### 3-3. 디자인 토큰 (요약)
- 색상 라이트: primary `#121212`, surface `#FFFFFF`, bg `#F8F8F6`(크림), border `#EDEDEB`
- 색상 다크: primary `#FFFFFF`, surface `#2A2A2A`, bg `#1F1F1E`
- 폰트: Pretendard Variable, body 14px/1.6
- 코너: 12/16/20/24px
- 모션: 0.15s ease, 입력 0.3s cubic-bezier, 스프링 `cubic-bezier(.34, 1.56, .64, 1)`
- 상세: `docs/design/danaa_design_system.md` 참조

### 3-4. 목업 확장형 V1 구조
- 3열 그리드: 생각넣기 Inbox / 정리 결과 보드 / 오늘 일정
- 하단 strip: 프로젝트 / 노트 / 건강 단서 / 저장 원칙 (4 카드)
- 하위 메뉴: 대시보드 / 생각넣기 / 분류확인 / 프로젝트 / 일정 / 노트 (6개)

---

## 4. 실행 순서 (Stage B1~B6)

### Stage B1. Sidebar 확장 (nested 메뉴 지원)
**수정**: `frontend/components/Sidebar.js`
- `navItems`에 `subitems` optional 필드 추가
- Do it OS 항목 + 6 subitems
- 로컬 state `expanded: Set<string>` 펼침 추적
- subitem 렌더: "세로 바(2px) + 원형 dot + 들여쓰기 28px" CSS
- 접근성: `aria-expanded`, 키보드 Tab·Enter·Arrow
- 다크·라이트 양쪽 토큰 사용, 하드코딩 색상 금지

### Stage B2. 대시보드 페이지
**신규**: `frontend/app/app/do-it-os/page.js`
- 상단: 타이틀 "Do it OS" + 부제 "오늘 머릿속을 꺼내서 정리해요"
- 3열 그리드 (flex-basis ~33%, gap 20px):
  1. 생각넣기 Inbox: 최근 5개 미리보기 + "더 추가하러 가기" 버튼
  2. 정리 결과 보드: To Do / Doing / Done 3 레인 (MVP 빈 카드)
  3. 오늘 일정: 타임라인 (MVP "준비 중")
- 하단 strip 4 카드: 프로젝트 / 노트 / 건강 단서 / 저장 원칙
- 데이터: `localStorage.danaa_doit_thoughts_v1`

### Stage B3. 생각넣기 캔버스 (핵심 기능)
**신규**: 
- `frontend/app/app/do-it-os/thinking/page.js`
- `frontend/components/doit/ThoughtCanvas.js`

**UX 사양**:
- 중앙 하단 고정 입력창 (placeholder: "머릿속에 떠오른 것을 적어보세요. Enter 누르면 위로 쏟아져요")
- Enter 입력 시:
  1. 메모 `{ id, text, createdAt, x, y, rotation, color }` 생성
  2. 캔버스 상단 flex-1 영역에 **랜덤 위치 + 회전(-4°~+4°) + 랜덤 색상**으로 추가
  3. 등장 애니메이션: 0.24s scale(0.8→1) + fade + spring `cubic-bezier(.34, 1.56, .64, 1)`
  4. 입력창 즉시 비움
- 메모 크기: min 180×120px, max 280×160px (내용 길이 기반)
- 색상 팔레트 (다나아 톤 5색 랜덤):
  - 크림 `#FFF5E6`
  - 스톤 `#F0EDE8`
  - 민트 `#EBF4EF`
  - 라벤더 `#EDE8F4`
  - 블러시 `#F7E9E9`
- 메모 액션: 호버 시 `×` 삭제 (MVP는 삭제만)
- Shift+Enter: 줄바꿈
- Ctrl+Z: 마지막 메모 되돌리기 (옵션)
- 캔버스 빈 상태: "아직 아무것도 없어요. 떠오르는 것부터 적어보세요"
- 우상단 "정리하러 가기" 버튼 → `/app/do-it-os/classify`
- localStorage 자동 저장 (매 입력) + 페이지 진입 복원

**충돌 방지 알고리즘**: 새 메모가 기존 메모와 너무 가까우면 10px씩 밀어 겹침 완화 (간단 격자)

**라이브러리**: 추가 없음. 순수 React state + CSS transform.

### Stage B4. 준비 중 4개 페이지
**신규**: 각 30줄 이내 동일 템플릿
- `frontend/app/app/do-it-os/classify/page.js` — "생각정리 — 준비 중"
- `frontend/app/app/do-it-os/project/page.js` — "프로젝트 — 준비 중"
- `frontend/app/app/do-it-os/schedule/page.js` — "일정 — 준비 중"
- `frontend/app/app/do-it-os/note/page.js` — "노트 — 준비 중"

### Stage B5. 레이아웃 점검
- RightPanelV2가 do-it-os에 미노출 확인만 (코드 수정 없음)
- 메인 너비 `max-w-[1400px] mx-auto`

### Stage B6. E2E 검증
**신규**: `frontend/doit_mvp_test.mjs` (Playwright)
1. 로그인 → Sidebar에 "Do it OS" 보임 → 클릭 → 6 subitems 펼침
2. "생각넣기" → `/app/do-it-os/thinking` → 3번 입력+Enter → 3개 메모 렌더·위치 겹침 없음
3. 새로고침 → localStorage 복원 → 3개 유지

**시각 점검**: 스크린샷 3장(`output/doit_mvp_*.png`) + 다나아 톤 육안 확인

---

## 5. Critical Files

### 수정 대상
- `frontend/components/Sidebar.js`
- `frontend/app/globals.css` (`.subnav`·메모 카드 스타일 섹션 추가)

### 신규 생성
- `frontend/app/app/do-it-os/page.js`
- `frontend/app/app/do-it-os/thinking/page.js`
- `frontend/app/app/do-it-os/classify/page.js`
- `frontend/app/app/do-it-os/project/page.js`
- `frontend/app/app/do-it-os/schedule/page.js`
- `frontend/app/app/do-it-os/note/page.js`
- `frontend/components/doit/ThoughtCanvas.js`
- `frontend/doit_mvp_test.mjs`

### 읽기 전용 참조
- `Do it OS/04-20 다나아 Do it OS 확장형 대시보드 V1.html`
- `Do it OS/04-20 다나아 Do it OS 3안 비교 목업.html`
- `frontend/app/app/layout.js`
- `frontend/app/app/chat/page.js` (RightPanelV2 렌더 로직 패턴)
- `frontend/tailwind.config.js`
- `docs/design/danaa_design_system.md`

---

## 6. 위험 / 완화

| 위험 | 완화 |
|---|---|
| 메모 카드 50개 초과 시 캔버스 성능 저하 | 가장 오래된 메모 자동 스택(상단 축소) |
| localStorage 5MB 한도 초과 | 메모당 1KB 가정 → 5000개 허용. 초과 시 경고 배너 |
| Sidebar nested 확장이 기존 categories 드롭다운과 충돌 | 독립 state, 기존 categories 건드리지 않음 |
| 모바일 캔버스 UX 저하 | MVP는 데스크톱 우선, 768px 이하 "모바일 준비 중" 안내 |
| RightPanelV2 실수 렌더 | chat/page.js에서만 import되므로 구조적 분리 확인만 |
| AI 자동 저장 혼동 (요구사항 위반) | MVP에는 AI 연동 전혀 없음. 사용자 수동 입력만 |
| 다크 모드에서 메모 색상(5색 파스텔) 가독성 저하 | 각 색상의 다크 변형도 정의 필요 (설계 추가 항목) |

---

## 7. 검증 계획

### 자기검증 5단계 (CLAUDE.md §5)
- git diff 리뷰
- Grep: Sidebar·navItems 사용처 전수
- 패턴 일관성 (기존 카드·버튼 스타일 준수)
- 도메인 규칙 (건강 기록 자동 저장 금지)
- `npm run build` 통과

### 3팀 병렬 리뷰 (구현 완료 후)

**Team 최적화**:
- 메모 카드 리렌더 최적화 (`React.memo`·`key`)
- localStorage 디바운스
- SSR·CSR 경계 ('use client' 위치)

**Team 고도화**:
- 향후 DB 연동(POST /thoughts) 확장 포인트
- 메모 드래그·크기 조절 추가 가능 구조
- AI 채팅 답변 아래 "Do it OS에 저장할까요?" 카드 연계 가능성

**Team 안정성**:
- Screenshot_1065 vs 실제 구현 시각 비교
- 기존 3대 메뉴 회귀 없음 (AI 채팅·리포트·챌린지)
- 모바일 사이드바 토글 정상
- 다크·라이트 양쪽 정상 (토큰만 사용)
- 자동 저장 금지 원칙 준수
- 건강 기록과 건강 단서 분리 원칙 유지

### Fresh-context evaluate
새 서브에이전트 호출, 전달:
- git diff + Screenshot_1065 + 실제 구현 스크린샷 3장
- 평가 기준 5개:
  1. 다나아 톤앤매너 일치
  2. 목업 의도 반영 (메뉴명·순서·펼침 UX)
  3. 생각넣기 "빠르게 쏟아내는" 느낌
  4. 건강 기록 자동 저장 금지 준수
  5. 기존 기능 회귀 없음

---

## 8. 미결정 항목 — **✅ 확정 완료 (2026-04-21)**

| # | 항목 | 확정값 |
|---|---|---|
| 1 | 생각넣기 진입 방식 | **별도 전용 페이지** `/app/do-it-os/thinking` |
| 2 | 메모 드래그·이동·크기 조절 | **MVP 제외** (Phase 2 후보) |
| 3 | Ctrl+Z 되돌리기 | **MVP 제외** (Phase 2 후보) |
| 4 | 다크 모드 메모 색상 5색 | **버전 B** · 크림(황토) `#544327`·스톤(샌드) `#4D4538`·민트(세이지) `#374F40`·라벤더(더스티) `#423C54`·블러시(로즈) `#544040` |
| 5 | 브랜치 전략 | **`main` 에서 분기** (`feat/do-it-os-mvp`) |
| 6 | i18n / 번역 | **한글 고정** (MVP), Phase 2 에서 i18n 검토 |

상세·근거·CSS 변수 정의: `docs/design/do_it_os_undecided_resolved.md`.

---

## 9. 실행 이어받기 프롬프트 (다음 세션용)

다음 세션에서 사용자가 Claude Code에 이렇게 말하면 바로 이어 실행 가능:

```
Do it OS/do_it_os_1차플랜.md 읽고 1차 MVP 실행해줘. 
docs/design/danaa_design_system.md 의 토큰만 써서 다나아 톤 유지하고,
§8 미결정 항목은 AskUserQuestion으로 먼저 확정한 뒤 진행해.
```

실행 순서 자동:
1. 이 파일 읽기 + `docs/design/danaa_design_system.md` 읽기
2. 미결정 Q2·드래그·Ctrl+Z·다크 메모 색상·브랜치 AskUserQuestion 일괄 확정
3. Stage B1→B6 구현
4. 3팀 리뷰 + evaluate
5. 사용자 보고 → 허가 후 commit/push/PR
