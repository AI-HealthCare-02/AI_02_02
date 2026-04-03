# 다나아 문서 관리 대장 (Document Registry)

> **이 문서는 뭔가요?** 프로젝트의 모든 문서를 한곳에서 찾을 수 있는 목차예요.
> "이 문서 최신 맞아?" 궁금하면 여기를 확인하세요.

---

## 현재 기준 버전 (한눈에 보기)

| 항목 | 현재 버전 | 파일명 | 갱신일 |
|------|----------|--------|--------|
| DB 명세 | **V2** | `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md` | 2026-04-03 |
| API 명세 | **V2** | `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` | 2026-04-03 |
| 웹 데모 | **V8-8** | `docs/prototypes/다나아_웹서비스_데모V8-8.html` | 2026-03-31 |
| 설계가이드 | **V3** | `docs/prototypes/다나아_데이터수집_설계가이드V3.html` | 2026-03-31 |

> 새 버전이 나오면 이 표를 가장 먼저 업데이트하세요.

---

## 계층 1: 원천 (Source) — "뭘 수집할지"

| 파일 | 역할 | 수정 가능? | 변경 시 동기화 |
|------|------|-----------|---------------|
| `매일수집질문_DB설계.md` | 수집 질문 정의 (10탭, 13테이블) | YES | 계층 2→3→5 전부 |
| `docs/planning/다나아_당뇨_온보딩_설문_플랜.md` | 스크린별 UX 설계 | NO (읽기전용) | — |

## 계층 2: DB 스키마 (Schema) — "어떻게 저장할지"

| 파일 | 역할 | 수정 가능? | 변경 시 동기화 |
|------|------|-----------|---------------|
| `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md` | DB 테이블/필드 정의 (13테이블) | YES | 계층 3 + 계층 5 코드 |
| `docs/collaboration/DANAA_DB명세확정안_엑셀_2026-04-02.xlsx` | 같은 내용 엑셀 버전 | YES | DB 명세 V2와 동일하게 |

## 계층 3: API 계약 (Contract) — "어떻게 주고받을지"

| 파일 | 역할 | 수정 가능? | 변경 시 동기화 |
|------|------|-----------|---------------|
| `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` | 28개 엔드포인트 정의 | YES | 계층 5 코드 + 팀문서 |

## 계층 4: 참조 (Reference) — "디자인/규칙"

### 프로토타입 (읽기전용 참고)

| 파일 | 역할 | 상태 |
|------|------|------|
| `docs/prototypes/다나아_웹서비스_데모V8-8.html` | **유일한 UI 구현 기준** | CURRENT |
| `docs/prototypes/다나아_데이터수집_설계가이드V3.html` | 10탭 구현 가이드 | CURRENT |
| `docs/prototypes/다나아_LLM파트_가이드.html` | LLM 연동 가이드 | CURRENT |
| `docs/prototypes/다나아_질문설계_가이드.html` | V1 원본 규칙 (참고용) | Reference |
| `docs/prototypes/다나아_프로젝트_아키텍처_가이드.html` | 시스템 아키텍처 | Reference |

> V8-7 이하 데모, V2 이하 설계가이드는 **구현 시 참조 금지**. 이력 확인용으로만 보세요.

### 규칙 파일 (자동 로딩)

| 파일 | 역할 |
|------|------|
| `.claude/rules/design-context.md` | V8-8 기준 확정 규칙 (90분 쿨다운, 5색 등) |
| `.claude/rules/medical-domain.md` | 의료 안전 가드레일 |
| `.claude/rules/doc-sync.md` | 문서 동기화 규칙 (유형 A~I) |
| `.claude/rules/eval-criteria.md` | 기술 평가 기준 |
| `.claude/rules/commit-convention.md` | 커밋 메시지 규칙 |
| `.claude/rules/skill-usage.md` | 스킬 사용 규칙 |
| `.claude/rules/dev-environment.md` | 개발 환경 설정 |

## 계층 5: 코드 (Code) — "구현"

| 영역 | 경로 | 동기화 기준 |
|------|------|------------|
| DB 모델 (ORM) | `app/models/*.py` | DB 명세 V2 |
| Enum 정의 | `app/models/enums.py` | API 명세 V2 허용값 |
| DTO (요청/응답) | `app/dtos/*.py` | API 명세 V2 JSON 스키마 |
| 서비스 로직 | `app/services/*.py` | DB 명세 V2 + API 명세 V2 |
| API 라우터 | `app/apis/v1/*.py` | API 명세 V2 엔드포인트 |
| 프론트 질문 데이터 | `apps/web/data/diabetes.js` | 매일수집질문_DB설계.md |
| 테스트 | `app/tests/`, `scripts/test_*.py` | 위 코드와 동일 기준 |

---

## 팀 공유/운영 문서

| 파일 | 역할 | 비고 |
|------|------|------|
| `CLAUDE.md` | AI 실행 가이드 (마스터 규칙) | 프로젝트 루트 |
| `docs/TEAM_AI_PROMPT.md` | 팀원 AI 협업 프롬프트 | **확정안 변경 시 같이 갱신** |
| `docs/HANDOFF_MEMO.md` | 인수인계 메모 | **확정안 변경 시 같이 갱신** |
| `docs/ARCHITECTURE.md` | 시스템 아키텍처 개요 | **확정안 변경 시 같이 갱신** |
| `docs/QUICK_START.md` | 8단계 환경 설정 가이드 | |
| `docs/DEVELOPMENT_WORKFLOWS.md` | Git/CI/CD 워크플로 | |
| `docs/TROUBLESHOOTING.md` | 에러 해결 가이드 | |
| `docs/MEDICAL_COMPLIANCE.md` | 의료 데이터 컴플라이언스 | |
| `LLM-파트-시작-가이드.md` | LLM 파트 구현 시작 가이드 | 프로젝트 루트 |
| `docs/collaboration/doc-sync-map.md` | 문서 동기화 안내 (비개발자용) | |

---

## 기획 문서 (읽기전용 — 수정 금지)

| 파일 | 역할 |
|------|------|
| `docs/planning/다나아_프로젝트_브리핑.md` | 프로젝트 요구사항 정의 |
| `docs/planning/다나아_기능정의_요구서.md` | 기능 상세 요구사항 |
| `docs/planning/다나아_당뇨_온보딩_설문_플랜.md` | 온보딩 UX 플로우 |
| `docs/planning/DANA-A_Data_Collection_Research.md` | 데이터 수집 리서치 |
| `docs/planning/03-23 13-51 만성질환 프로젝트 평가 대응 체크리스트.md` | 평가 체크리스트 |

---

## 폐기(Deprecated) 문서

| 파일 | 대체 문서 | 폐기일 |
|------|----------|--------|
| `docs/collaboration/DANAA_API최종확정안_2026-04-02.md` | V2 (`_V2_2026-04-03.md`) | 2026-04-03 |
| `docs/collaboration/DANAA_DB명세최종확정안_2026-04-02.md` | V2 (`_V2_2026-04-03.md`) | 2026-04-03 |

> 폐기 파일은 삭제하지 않고 첫 줄에 "DEPRECATED" 표시가 있습니다. V2 변경이력 비교용으로만 참고하세요.

---

## 문서 변경 시 체크리스트

1. 확정안(DB/API) 내용 수정 → `.claude/rules/doc-sync.md` 유형 A~F 체크리스트 따르기
2. 확정안 버전 업 (V2→V3) → 유형 G 체크리스트
3. 데모 버전 업 (V8-8→V8-9) → 유형 H 체크리스트
4. 확정안 변경 후 팀 문서 → 유형 I 체크리스트

상세 규칙: `.claude/rules/doc-sync.md` | 비개발자 가이드: `docs/collaboration/doc-sync-map.md`

---

*갱신일: 2026-04-03 | 이 문서 자체의 갱신은 확정안 버전 업(유형 G) 시 자동 포함됩니다.*
