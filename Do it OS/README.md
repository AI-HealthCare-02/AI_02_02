# Do it OS — 참고 전용 폴더

> **경고**: 이 폴더는 **디자인 시안·기획 문서 보관소**입니다. **실제 다나아 서비스 코드가 아닙니다.**

---

## 1. 이 폴더의 성격

- **참고 전용 (reference-only)**. AGENTS.md §6-3 문서 등급 규칙과 동일 취급.
- 이 폴더의 어떤 파일도 `frontend/`·`backend/` 코드에서 **import 되지 않는다.**
- 여기의 HTML·CSS·스크립트는 **사용자에게 배포되지 않는다.**
- `.gitignore` 여부와 무관하게, 이 폴더는 **디자인 이해용 자료** 로만 열린다.

---

## 2. 포함된 파일 (2026-04-21 기준)

| 파일 | 역할 |
|---|---|
| `do_it_os_1차플랜.md` | Do it OS 도입 1차 MVP Stage B1~B6 상세 플랜. **실행 대기** 문서 |
| `04-20 23-06 Do it OS 다나아 접목 클로드코드 문의 프롬프트.md` | 원본 요구서 · 12개 검토 질문 · 이론 배경 |
| `04-20 다나아 Do it OS 3안 비교 목업.html` | 보수형 / 통합형 / 확장형 3안 비교 시안 |
| `04-20 다나아 Do it OS 확장형 대시보드 V1.html` | 확장형 대시보드 초안 (9 섹션 + 5 스타일 변형) |
| `04-20 다나아 Do it OS 확장형 대시보드 V2.html` | V1 + 상단 "생각쏟기 캔버스"·"생각처리 하기" 추가. **최신** |
| `04-20 23-31 Claude Design 가이드 및 다나아 UI 스타일 정리 플랜.md` | 디자인 가이드 정리 계획 |

---

## 3. 허용되는 이용 방식

- ✅ 눈으로 **열어서 확인** (브라우저로 HTML 미리보기)
- ✅ `docs/design/` 아래 요약·비교 문서 작성 시 **링크/인용**
- ✅ 1차플랜 문서에 따라 **별도로 다시 코딩** 하는 기준점
- ✅ 사용자 승인 후 **다나아 톤앤매너에 맞춰 재설계** 하는 출발점

## 4. 금지되는 이용 방식

- 🚫 이 폴더의 HTML·CSS 를 `frontend/` 로 **그대로 복사**
- 🚫 이 폴더의 인라인 스타일을 컴포넌트에 **직접 이식**
- 🚫 ID / class 네이밍 (`scenario`·`panel-safe` 등) 을 다나아 코드에 **그대로 사용**
- 🚫 이 폴더의 고정 색(`#161616` 같은 하드코딩) 사용. **반드시** `docs/design/danaa_design_system.md` 토큰만 사용
- 🚫 목업에 있는 문구·숫자·샘플 데이터를 실제 앱 UI 에 **그대로 노출**
- 🚫 원본 Codex 참고 프로젝트(`C:\Users\mal03\Desktop\Codex\codex_NEW_DESKTOP_Dev_phase4`)의 코드와 **혼용**

---

## 5. 다나아 코드로 진입하는 올바른 흐름

```
Do it OS/ (여기, 참고 전용)
     │  ① 디자인 개념 이해
     ▼
docs/design/do_it_os_frontend_boundary.md
     │  ② 통합 원칙 · 허용 파일 경계 · 금지 목록
     ▼
frontend/app/app/do-it-os/** (실제 구현, 별도 브랜치에서)
     └ 토큰 = danaa_design_system.md
     └ 데이터 = localStorage (danaa_doit_* 네임스페이스)
     └ 백엔드 0 호출
```

---

## 6. 관련 공식 문서

| 문서 | 위치 |
|---|---|
| Do it OS 현재 상태 조사 리포트 | `docs/design/04-21 15-00 Do it OS 현재 상태 조사 리포트.md` |
| 다나아 디자인 시스템 (Single Source of Truth) | `docs/design/danaa_design_system.md` |
| 프론트 격리 원칙 | `docs/design/do_it_os_frontend_boundary.md` |
| 프로젝트 규칙 | `CLAUDE.md`, `AGENTS.md` |

---

## 7. 삭제·이동 시 주의

- 이 폴더의 파일을 삭제하거나 이동하지 마세요. 1차플랜과 조사 리포트가 이 파일들을 **경로로 참조**합니다.
- 새 시안을 추가할 때는 `MM-DD HH-mm 한글 제목.html` 네이밍 규칙을 지킵니다 (AGENTS.md §3).

---

_작성: 2026-04-21 / 이 README 는 사용자 명시 승인 없이는 수정하지 않는다._
