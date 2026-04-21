# 다나아 디자인 시스템 공식 가이드

> **문서 역할**: 다나아(DA-NA-A) 서비스 UI/프론트엔드 스타일·톤앤매너의 **단일 진실(Single Source of Truth)** 문서. 새로운 화면·컴포넌트·시안 제작 시 반드시 참조.
>
> **버전**: v1 (2026-04-21)
> **기준 코드**: `frontend/app/globals.css`, `frontend/tailwind.config.js`
> **Last synced**: 2026-04-21 (기준 코드와 수동 동기화. 코드 변경 시 이 문서도 갱신 필요)

---

## 1. 개요 · 톤앤매너

**다나아는 만성질환(당뇨·고혈압) 사용자를 위한 생활 습관 AI 건강 코치입니다.** 의료 진단·처방을 하지 않는 "친구 같은 생활 도우미" 톤을 유지합니다.

### 1-1. 톤 키워드 5가지

1. **따뜻한 건강 코치** — 의료적 엄격함보다 일상적 친숙함. 존댓말 기본, 딱딱하지 않게.
2. **부드러운 곡선** — 모든 모서리가 12~24px로 동글동글. 각진 모서리 금지.
3. **차분한 크림·스톤** — 중성적인 베이지·회색 팔레트로 신뢰·안정감.
4. **미니멀한 공간감** — 여백 존중. 정보 과부하 X. 카드와 카드 사이 충분한 gap.
5. **부드러운 피드백** — 즉시적이지 않은 0.15~0.3s 여유로운 전환. 급한 UX 아님.

### 1-2. 피해야 할 인상

- 병원·의료 앱의 차가운 흰색·파란색 일색
- 피트니스 앱의 네온·고채도·강한 그라디언트
- 생산성 툴(Notion 등)의 정보 과밀

---

## 2. 색상 팔레트

### 2-1. 라이트 테마 (기본, `html[data-theme="light"]`)

| 역할 | CSS 변수 | Hex | 용도 |
|---|---|---|---|
| Primary | `--color-primary` | `#121212` | 강조·CTA·선택 상태 |
| Primary hover | `--color-primary-hover` | `#333333` | 버튼 hover |
| Primary accent | `--color-primary-accent` | `#121212` | 체크박스·라디오 |
| Text | `--color-text` | `#111111` | 본문 |
| Text secondary | `--color-text-secondary` | `#333333` | 보조 텍스트 |
| Text muted | `--color-text-muted` | `#4A4A4A` | 메타·힌트 |
| Text hint | `--color-text-hint` | `#5A5A5A` | placeholder 위계 |
| Background | `--color-bg` | `#F8F8F6` | **페이지 배경 (크림)** |
| Surface | `--color-surface` | `#FFFFFF` | 카드·모달 배경 |
| Surface hover | `--color-surface-hover` | `#F0F0EE` | 카드 hover |
| Border | `--color-border` | `#EDEDEB` | 기본 보더 |
| Border focus | `--color-border-focus` | `#121212` | 포커스 outline |
| CTA bg | `--color-cta-bg` | `#121212` | 검은 버튼 배경 |
| CTA text | `--color-cta-text` | `#FFFFFF` | 검은 버튼 텍스트 |
| Sidebar top | `--sidebar-top` | `#F7F7F5` | 사이드바 상단 |
| Sidebar bottom | `--sidebar-bottom` | `#F7F7F4` | 사이드바 본문 |
| Nav active | `--color-nav-active` | `#EDEAE2` | 사이드바 활성 메뉴 |
| Card surface subtle | `--color-card-surface-subtle` | `#F2F2F0` | 카드 내부 약한 음영 |
| Panel divider | `--color-panel-divider` | `#D8D2C7` | 구역 분리선 |

### 2-2. 다크 테마 (`html[data-theme="dark"]`, 기본 루트 셀렉터)

| 역할 | CSS 변수 | Hex | 용도 |
|---|---|---|---|
| Primary | `--color-primary` | `#FFFFFF` | 강조·CTA |
| Primary hover | `--color-primary-hover` | `#D4D4D4` | hover |
| Text | `--color-text` | `#ECECEC` | 본문 |
| Text secondary | `--color-text-secondary` | `#A0A0A0` | 보조 |
| Text muted | `--color-text-muted` | `#888888` | 메타 |
| Background | `--color-bg` | `#1F1F1E` | 페이지 배경 |
| Surface | `--color-surface` | `#2A2A2A` | 카드 배경 |
| Surface hover | `--color-surface-hover` | `#2E2E2E` | hover |
| Border | `--color-border` | `#3A3A3A` | 보더 |
| Border focus | `--color-border-focus` | `#FFFFFF` | 포커스 |

### 2-3. 상태 표현 — 미응답 셀 (`--color-missed`)
Today 패널 미응답 배경색. 두 테마 모두 **노란 크림 톤** (`rgba(230, 195, 70, ...)`).

---

## 3. 시맨틱 색상 (tailwind.config.js 정의)

각 색상은 `light · DEFAULT · dark` 3단계 변형.

| 카테고리 | Light | DEFAULT | Dark | 사용 |
|---|---|---|---|---|
| `success` | `#EBF7ED` | `#3D7C3F` | `#2D5E2F` | 긍정 피드백, 챌린지 달성 |
| `danger` | `#FEECEC` | `#C43C3C` | `#9B2C2C` | 오류, 삭제 경고 |
| `warning` | `#FFF5EB` | `#E07800` | `#B86200` | 주의, 제한 알림 |
| `info` | `#E8F1FD` | `#4A7FB5` | `#3A6694` | 정보성 툴팁 |

**텍스트는 항상 `DEFAULT` 사용, 배경은 `light` 사용**. `text-danger-light` 같은 위임은 금지 (메모리 `feedback` 규칙).

### 3-1. 소셜 로그인 브랜드 색
| 브랜드 | DEFAULT | Text |
|---|---|---|
| Kakao | `#FEE500` | `#3C1E1E` |
| Naver | `#03C75A` | `#FFFFFF` |
| Google | (white bg) | `#333333` |

---

## 4. 타이포그래피

### 4-1. 폰트 패밀리
```
Primary:  Pretendard Variable
Fallback: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif
```
`--font-ui` CSS 변수 경유. 한글·영문 모두 Pretendard 기본.

### 4-2. 크기 단계 (Tailwind 확장)

| 클래스 | 크기 | Line-height | 용도 |
|---|---|---|---|
| `text-xs` | 11px | 1.5 | 배지, 메타 |
| `text-sm` | 12px | 1.5 | 라벨, 힌트 |
| `text-md` | 13px | 1.6 | UI 보조 텍스트 |
| `text-base` | 14px | 1.6 | **컴포넌트 기본** |
| `text-lg` | 16px | 1.5 | 섹션 헤더 |
| `text-xl` | 20px | 1.4 | 큰 제목 |
| `text-2xl` | 22px | 1.3 | 페이지 타이틀 |
| `text-3xl` | 30px | 1.2 | 강조 헤드 |
| `text-4xl` | 38px | 1.2 | 랜딩 헤드 |

**body 전역**은 **15px** (globals.css:119). Tailwind `text-base`(14px)와 구분 필요 — 페이지 최상위에는 15px, 컴포넌트 내부에는 14px 기본.

### 4-3. 굵기 · 자간

- Body: `font-weight: 450`
- Heading h1~h3: `700` (bold)
- Heading h4~h6: `600` (semibold)
- Button · Input: `500` (medium)
- Strong: `650`
- Letter-spacing: 일반 `-0.01em`, Heading `-0.02em`

---

## 5. 간격 · 레이아웃

### 5-1. 주요 고정 치수

| 구성 | 값 | 인용 |
|---|---|---|
| Sidebar 열림 | `w-[300px]` | Sidebar.js:183 |
| Sidebar 닫힘 | `w-[48px]` | Sidebar.js:183 |
| Sidebar 상단 헤더 | `h-12` (48px) | Sidebar.js:188 |
| Sidebar 메뉴 항목 | `h-10 gap-2.5 px-2` | Sidebar.js:213 |
| 메인 레이아웃 | `flex h-screen flex-1 flex-col` | app/layout.js:21 |
| 기본 카드 padding | 16~18px | RightPanelV2·globals.css |
| 카드 간 gap | 12~20px | Today 패널 패턴 |

### 5-2. 확장 spacing
- `spacing.18` = `4.5rem` (72px)
- `spacing.88` = `22rem` (352px)

---

## 6. 코너 · 그림자

### 6-1. Border Radius (Tailwind)
| 클래스 | 값 | 용도 |
|---|---|---|
| `rounded-sm` | 8px | 입력 필드, 배지 |
| `rounded-md` | 12px | 버튼, 메뉴 |
| `rounded-lg` | 16px | 일반 카드 |
| `rounded-xl` | 20px | 큰 카드 |
| `rounded-2xl` | 24px | 모달, 상단 hero |
| `rounded-full` | 999px | 필 버튼, 아바타 |

**각진 모서리 금지**. 필요 시 최소 8px.

### 6-2. Box Shadow
| 클래스 | 정의 | 용도 |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,.20)` | 미세 구분 |
| `shadow-soft` | `0 1px 3px rgba(0,0,0,.24), 0 1px 2px rgba(0,0,0,.16)` | 카드 기본 |
| `shadow-float` | `0 4px 12px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.16)` | hover 부상 |
| `shadow-lift` | `0 8px 24px rgba(0,0,0,.32), 0 2px 8px rgba(0,0,0,.16)` | 드롭다운 |
| `shadow-modal` | `0 16px 48px rgba(0,0,0,.40), 0 4px 12px rgba(0,0,0,.20)` | 모달 |

---

## 7. 인터랙션 · 모션

| 대상 | 속성 | 값 |
|---|---|---|
| 기본 전환 | `transition` | `all 0.15s ease` |
| 호버·포커스 | `transition` | `background/color 0.15s ease` |
| 입력 라인 | `transition` | `all 0.3s cubic-bezier(.25,.46,.45,.94)` |
| Toast·Modal | `animation` | `fadeIn 0.2s / Rise 0.24s` |
| Focus outline | `outline` | `2px solid var(--color-border-focus)`, `outline-offset: 2px` |

### 7-1. 커스텀 이징 (Tailwind 확장)
- `ease-out-expo`: `cubic-bezier(.25,.46,.45,.94)` — 부드럽게 끝맺음
- `ease-spring`: `cubic-bezier(.34,1.56,.64,1)` — 톡 튀는 느낌 (메모 등장 등)

---

## 8. 테마 강제 경로 (FORCE_LIGHT_PREFIXES)

아래 경로는 `localStorage` 값과 무관하게 **항상 라이트**로 렌더 (`contexts/ThemeContext.js:15-21`):
- `/` (루트 랜딩)
- `/login`
- `/signup`
- `/onboarding`
- `/social-auth`
- `/landing-new`

이유: D 로고·로그인 버튼 등이 다크 모드에서 배경과 동색화되어 안 보임.
**신규 공개 페이지 만들 때** 이 목록에 추가 검토 필수.

---

## 9. 사용 금지 패턴

| 금지 | 이유 | 메모리 출처 |
|---|---|---|
| `text-neutral-300` | Border 매핑 → 라이트 모드에서 안 보임 | `feedback_neutral300_ban.md` |
| `text-danger-light` 본문 텍스트 | `#FEECEC` 거의 흰색, 가독성 0 | UX 7건 이슈 |
| CSS 변수 아닌 직접 Hex 하드코딩 | 다크/라이트 전환 깨짐 | globals.css 주석 |
| `!!field` falsy 체크 (boolean 응답) | `false`도 기록된 값 | `feedback_ux_boolean_semantics.md` |
| border-radius 0 (각진 모서리) | 톤앤매너 위배 | 본 문서 §6 |

---

## 10. 스크린샷 레퍼런스

*(향후 추가 예정 — 현재는 다음 파일들이 시각 참고)*
- `docs/prototypes/다나아_웹서비스_데모V8-8.html` — 통합 시안
- `output/audit_01_login.png` 외 — 페이지별 감사 스크린샷
- `output/cd_02_prototype.png` — Claude Design 인터페이스 참조

---

## 11. Claude Design `Set up design system` JSON

Claude Design(`claude.ai/design`)에서 "Set up design system"을 누르고 아래 JSON을 붙여넣으면 다나아 톤이 자동 적용됩니다. 별도 파일: `docs/design/danaa_claude_design_system.json`.

### 핵심 매핑
```json
{
  "displayName": "DANAA v1 — Warm Health Coach",
  "colorMode": "LIGHT",
  "headlineFont": "PRETENDARD",
  "bodyFont": "PRETENDARD",
  "primary": "#121212",
  "secondary": "#A0A0A0",
  "surface": "#FFFFFF",
  "background": "#F8F8F6",
  "border": "#EDEDEB",
  "roundness": "ROUND_TWELVE"
}
```

---

## 12. 변경 이력

| 날짜 | 작성자 | 내용 |
|---|---|---|
| 2026-04-21 | Claude Code + 사용자 | v1 초안. Agent 조사 + 4파일 Read 팩트 재확증 |

---

## 13. Truth 계층 정책

다나아 디자인 값은 여러 곳에 복사본이 존재합니다. 각 파일의 역할:

| 파일 | 계층 | 역할 |
|---|---|---|
| `frontend/app/globals.css` | **TRUTH** (원본) | 실제 렌더에 쓰이는 CSS 변수 정의 |
| `frontend/tailwind.config.js` | **TRUTH** (원본) | Tailwind 확장 토큰 |
| `docs/design/danaa_design_system.md` | **Mirror** | 이 문서. 인간 가독 복사본. 수동 동기화 |
| `docs/design/danaa_claude_design_system.json` | **Export** | Claude Design 복붙 전용 |
| `.claude/skills/danaa-visual-style/tokens.json` | **Skill cache** | 스킬 내부 렌더링용 캐시 |

**갱신 규칙**: `globals.css` 또는 `tailwind.config.js` 수정 시 이 문서도 함께 갱신. 역방향(이 문서만 바꾸고 코드 안 고침) 금지.
