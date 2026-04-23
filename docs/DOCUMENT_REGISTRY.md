# 다나아 문서 관리 대장 (Document Registry)

> **이 문서는 뭔가요?** 프로젝트의 모든 문서를 한곳에서 찾을 수 있는 목차예요.
> "이 문서 최신 맞아?" 궁금하면 여기를 확인하세요.

---

## 현재 기준 버전 (한눈에 보기)

| 항목     | 현재 버전    | 파일명                                                   | 갱신일        |
| ------ | -------- | ----------------------------------------------------- | ---------- |
| DB 명세  | **V2**   | `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-07.md` | 2026-04-07 |
| API 명세 | **V2**   | `docs/collaboration/DANAA_API최종확정안_V2_2026-04-07.md`  | 2026-04-07 |
| 웹 데모   | **V8-8** | `docs/prototypes/다나아_웹서비스_데모V8-8.html`                | 2026-03-31 |
| 설계가이드  | **V3**   | `docs/prototypes/다나아_데이터수집_설계가이드V3.html`              | 2026-03-31 |

> 새 버전이 나오면 이 표를 가장 먼저 업데이트하세요.

---

## 계층 1: 원천 (Source) — "뭘 수집할지"

| 파일                                  | 역할                    | 수정 가능?    | 변경 시 동기화    |
| ----------------------------------- | --------------------- | --------- | ----------- |
| `매일수집질문_DB설계.md`                    | 수집 질문 정의 (10탭, 13테이블) | YES       | 계층 2→3→5 전부 |
| `docs/planning/다나아_당뇨_온보딩_설문_플랜.md` | 스크린별 UX 설계            | NO (읽기전용) | —           |

## 계층 2: DB 스키마 (Schema) — "어떻게 저장할지"

| 파일                                                            | 역할                   | 수정 가능? | 변경 시 동기화       |
| ------------------------------------------------------------- | -------------------- | ------ | -------------- |
| `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-07.md`         | DB 테이블/필드 정의 (13테이블) | YES    | 계층 3 + 계층 5 코드 |
| `docs/collaboration/archive/DANAA_DB명세확정안_엑셀_2026-04-02.xlsx` | 구버전 엑셀 (archive)     | NO     | 참고용, V2 명세 우선  |

## 계층 3: API 계약 (Contract) — "어떻게 주고받을지"

| 파일                                                   | 역할           | 수정 가능? | 변경 시 동기화      |
| ---------------------------------------------------- | ------------ | ------ | ------------- |
| `docs/collaboration/DANAA_API최종확정안_V2_2026-04-07.md` | 31개 엔드포인트 정의 | YES    | 계층 5 코드 + 팀문서 |

## 계층 4: 참조 (Reference) — "디자인/규칙"

### 프로토타입 (읽기전용 참고)

| 파일                                       | 역할               | 상태        |
| ---------------------------------------- | ---------------- | --------- |
| `docs/prototypes/다나아_웹서비스_데모V8-8.html`   | **유일한 UI 구현 기준** | CURRENT   |
| `docs/prototypes/다나아_데이터수집_설계가이드V3.html` | 10탭 구현 가이드       | CURRENT   |
| `docs/prototypes/다나아_LLM파트_가이드.html`     | LLM 연동 가이드       | CURRENT   |
| `docs/prototypes/다나아_질문설계_가이드.html`      | V1 원본 규칙 (참고용)   | Reference |
| `docs/prototypes/다나아_프로젝트_아키텍처_가이드.html` | 시스템 아키텍처         | Reference |

> V8-7 이하 데모, V2 이하 설계가이드는 **구현 시 참조 금지**. 이력 확인용으로만 보세요.

### 로컬 AI 도구 파일

아래 파일들은 개인 AI 도구 설정/메모 성격이라 저장소 정본으로 관리하지 않습니다.

- `.claude/`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/HANDOFF_MEMO.md`

## 계층 5: 코드 (Code) — "구현"

| 영역          | 경로                                    | 동기화 기준               |
| ----------- | ------------------------------------- | -------------------- |
| DB 모델 (ORM) | `backend/models/*.py`                 | DB 명세 V2             |
| Enum 정의     | `backend/models/enums.py`             | API 명세 V2 허용값        |
| DTO (요청/응답) | `backend/dtos/*.py`                   | API 명세 V2 JSON 스키마   |
| 서비스 로직      | `backend/services/*.py`               | DB 명세 V2 + API 명세 V2 |
| API 라우터     | `backend/apis/v1/*.py`                | API 명세 V2 엔드포인트      |
| 프론트 질문 데이터  | `frontend/data/diabetes.js`           | 매일수집질문_DB설계.md       |
| 테스트         | `backend/tests/`, `scripts/test_*.py` | 위 코드와 동일 기준          |

---

## 팀 공유/운영 문서

| 파일                                       | 역할                         | 비고                    |
| ---------------------------------------- | -------------------------- | --------------------- |
| `docs/TEAM_AI_PROMPT.md`                 | 팀원 AI 협업 프롬프트              | **확정안 변경 시 같이 갱신**    |
| `docs/ARCHITECTURE.md`                   | 시스템 아키텍처 개요                | **확정안 변경 시 같이 갱신**    |
| `docs/QUICK_START.md`                    | 8단계 환경 설정 가이드              |                       |
| `docs/DEVELOPMENT_WORKFLOWS.md`          | Git/CI/CD 워크플로             |                       |
| `docs/TROUBLESHOOTING.md`                | 에러 해결 가이드                  |                       |
| `docs/MEDICAL_COMPLIANCE.md`             | 의료 데이터 컴플라이언스              |                       |
| `docs/collaboration/doc-sync-map.md`     | 문서 동기화 안내 (비개발자용)          |                       |
| `docs/setup/04-07 15-04 프론트 계약 변경 메모.md` | 프론트 적용용 계약 변경 메모           | **API/DB 변경 시 같이 갱신** |
| `docs/setup/04-07 15-04 개발 안전 체크리스트.md`  | 이번 DB/API 변경의 개발 게이트 기록    |                       |
| `docs/setup/04-07 15-04 PR 리뷰 게이트.md`    | 이번 DB/API 변경의 PR 리뷰 게이트 기록 |                       |
| `docs/setup/04-08 12-06 채팅 멘토링 후속 검토.md` | 채팅 흐름 순서도, content_filter decision table, LangGraph 현재 비도입 판단 | **채팅 구조 검토 시 우선 참고** |

---

## 기획 문서 (읽기전용 — 수정 금지)

| 파일                                                   | 역할           |
| ---------------------------------------------------- | ------------ |
| `docs/planning/다나아_프로젝트_브리핑.md`                      | 프로젝트 요구사항 정의 |
| `docs/planning/다나아_기능정의_요구서.md`                      | 기능 상세 요구사항   |
| `docs/planning/다나아_당뇨_온보딩_설문_플랜.md`                  | 온보딩 UX 플로우   |
| `docs/planning/DANA-A_Data_Collection_Research.md`   | 데이터 수집 리서치   |
| `docs/planning/03-23 13-51 만성질환 프로젝트 평가 대응 체크리스트.md` | 평가 체크리스트     |

---

## 폐기(Deprecated) 문서

| 파일                                                            | 대체 문서                    | 폐기일        |
| ------------------------------------------------------------- | ------------------------ | ---------- |
| `docs/collaboration/archive/DANAA_API최종확정안_2026-04-02.md`     | V2 (`_V2_2026-04-07.md`) | 2026-04-07 |
| `docs/collaboration/archive/DANAA_DB명세최종확정안_2026-04-02.md`    | V2 (`_V2_2026-04-07.md`) | 2026-04-07 |
| `docs/collaboration/archive/DANAA_DB명세최종확정안_2026-04-03.md`    | V2 (`_V2_2026-04-07.md`) | 2026-04-07 |
| `docs/collaboration/archive/DANAA_DB명세확정안_엑셀_2026-04-02.xlsx` | V2 (`_V2_2026-04-07.md`) | 2026-04-07 |

> 폐기 파일은 `docs/collaboration/archive/` 로 이동했습니다. V2 변경이력 비교용으로만 참고하세요.

---

## 문서 변경 시 체크리스트

1. 확정안(DB/API) 내용 수정 → `docs/collaboration/doc-sync-map.md` 기준으로 관련 문서 동기화
2. 확정안 버전 업 (V2→V3) → 유형 G 체크리스트
3. 데모 버전 업 (V8-8→V8-9) → 유형 H 체크리스트
4. 확정안 변경 후 팀 문서 → 유형 I 체크리스트

비개발자 가이드: `docs/collaboration/doc-sync-map.md`

---

*갱신일: 2026-04-08 | 이 문서 자체의 갱신은 확정안 버전 업(유형 G) 시 자동 포함됩니다.*

---

## 2026-04-08 추가 작업 문서

| 파일 | 역할 |
|------|------|
| `docs/setup/04-08 14-19 채팅 3트랙 구현 기록.md` | reason_codes enum, normalize option C, chat 패키지 전환 구현 요약 |
| `docs/setup/04-08 14-19 reason codes 인벤토리.md` | reason code producer/consumer와 타입 규칙 |
| `docs/setup/04-08 14-19 normalize 골든셋 및 금지조건.md` | normalize golden snapshot, 보호 대상, no-go 조건 |
# 2026-04-22 문서 최신화 메모

이번 health engagement UX 브랜치에서 아래 문서를 최신 기준으로 확인/갱신했습니다.

- `README.md`: 영상 추천, Web Push, 오른쪽 패널/챌린지/리포트 개선 요약과 배포 전 체크 추가
- `docs/TROUBLESHOOTING.md`: Web Push, daily log 저장 실패, 영상 추천, 리포트 빈 화면 대응 추가
- `docs/TEAM_CHANGELOG_BJ.md`: BJ 작업 변경 이력 추가
- `docs/HANDOFF_MEMO.md`: 현재 구현/배포 주의사항 기록 유지

이번 변경은 API/DB에도 영향이 있으므로 PR 리뷰 시 아래 마이그레이션을 함께 확인해야 합니다.

- `10_20260422000000_add_health_question_interval_setting.py`
- `11_20260422001000_add_push_subscriptions.py`
