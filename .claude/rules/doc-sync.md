---
paths:
  - "docs/**"
  - "매일수집질문*"
  - "apps/web/data/**"
  - "app/models/**"
  - "app/dtos/**"
  - "app/services/**"
  - "app/apis/**"
  - "app/tests/**"
---

# 설계 문서 동기화 규칙

이 규칙은 설계 문서 또는 관련 코드 파일 작업 시 자동으로 로드됩니다.

## 문서 계층 구조 (위에서 아래로 전파)

```
[계층 1: 원천] ← 항상 여기를 먼저 수정
  매일수집질문_DB설계.md (뭘 모을지)
  docs/planning/다나아_당뇨_온보딩_설문_플랜.md (스크린별 UX)
       ▼
[계층 2: 파생]
  docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md (어떻게 저장할지)
  docs/collaboration/DANAA_DB명세확정안_엑셀_2026-04-02.xlsx
       ▼
[계층 3: 계약]
  docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md (어떻게 주고받을지)
       ▼
[계층 4: 참조]
  docs/prototypes/다나아_데이터수집_설계가이드V3.html
  docs/prototypes/다나아_LLM파트_가이드.html
  .claude/rules/design-context.md, medical-domain.md
       ▼
[계층 5: 코드]
  app/models/, app/dtos/, app/services/, app/apis/, apps/web/data/diabetes.js
  app/tests/, scripts/ (테스트)
```

**핵심 규칙**: 하위 계층을 먼저 수정하지 않는다. 원천 → 파생 → 계약 → 코드 순서로 전파.

---

## 동기화 체크 실행 타이밍

IMPORTANT: 아래 2가지 시점에 설계 문서가 변경되었으면 동기화 체크를 실행한다:

1. **`/commit-push-pr` 실행 시**: 변경 파일 중 위 paths에 해당하는 것이 있으면 커밋 전 동기화 체크
2. **`/checkpoint` 실행 시**: 해당 세션에서 수정된 설계 문서가 있으면 동기화 체크
3. **수동 요청**: 사용자가 "동기화해줘" 또는 "동기화 체크해줘"라고 하면 즉시 실행

---

## 동기화 체크 프로세스 (6단계)

```
Step 1: git diff (또는 대화 내 수정 이력)로 바뀐 파일과 내용 확인
Step 2: 바뀐 파일이 어느 계층인지 파악
Step 3: 변경 유형(A~F) 판별 → 해당 체크리스트 로드
Step 4: 하위 계층 문서에서 영향받는 부분을 Grep으로 검색
Step 5: 불일치 발견 시 → 수정 제안 (사용자 확인 후 실행)
Step 6: 결과를 PASS/WARN/FAIL로 보고
```

---

## 변경 유형별 체크리스트

### 유형 A: 필드 이름 변경

영향 범위: 가장 넓음. 모든 문서 + 코드에서 이름을 바꿔야 함.

**문서:**
- [ ] 매일수집질문_DB설계.md의 필드명
- [ ] DANAA_DB명세최종확정안 V2 테이블 필드명
- [ ] DB엑셀 해당 열 이름
- [ ] DANAA_API최종확정안 V2 요청/응답 JSON 키 + 허용값 표
- [ ] docs/TEAM_AI_PROMPT.md 필드명 언급 (FINDRISC 변수 목록 등)

**코드 (서버가 깨지는 영역):**
- [ ] app/models/ SQLAlchemy 컬럼명
- [ ] app/dtos/ Pydantic 필드명
- [ ] app/services/ 비즈니스 로직 (onboarding, prediction, risk_analysis 등)
- [ ] app/apis/v1/ 라우터 코드
- [ ] apps/web/data/diabetes.js의 id/value (해당 필드가 있을 때만)

**테스트:**
- [ ] app/tests/ 유닛·통합 테스트 데이터
- [ ] scripts/ 테스트 스크립트

**최종 검증:**
- [ ] **Grep으로 옛 이름이 프로젝트 전체에 안 남았는지 확인** → 0건이어야 PASS

### 유형 B: 필드 추가/삭제

**문서:**
- [ ] 매일수집질문_DB설계.md (스크린 번호 조정, "총 N스크린" 숫자)
- [ ] 온보딩설문플랜.md (스크린 추가/삭제, 분기 로직 다이어그램, 그룹별 화면수)
- [ ] DANAA_DB명세최종확정안 V2 (테이블 필드 추가/삭제, "N개 필드" 숫자)
- [ ] DB엑셀 해당 시트 열
- [ ] DANAA_API최종확정안 V2 (요청/응답 JSON, _source 개수)
- [ ] 3기능 매핑표 (위험도/대시보드/챌린지)
- [ ] FINDRISC 8변수 영향 여부
- [ ] medical-domain.md "현재 N문항" 숫자

**코드:**
- [ ] app/models/ SQLAlchemy 컬럼 추가/삭제
- [ ] app/dtos/ Pydantic 필드 추가/삭제
- [ ] app/services/ 비즈니스 로직 (새 필드 처리)
- [ ] apps/web/data/diabetes.js 질문 객체
- [ ] app/tests/ 테스트 데이터 업데이트

### 유형 C: 선택지 변경

**문서:**
- [ ] 매일수집질문_DB설계.md (N지 숫자 + 선택지 목록)
- [ ] 온보딩설문플랜.md (선택지 목록)
- [ ] DANAA_API최종확정안 V2 (허용값 enum + 요청 예시 JSON)
- [ ] DANAA_DB명세최종확정안 V2 필드 설명

**코드:**
- [ ] app/models/enums.py Enum 클래스 값
- [ ] app/dtos/ 허용값 validator
- [ ] app/services/prediction.py FINDRISC 점수 로직 영향 확인
- [ ] apps/web/data/diabetes.js (options 배열)
- [ ] app/tests/ 테스트 데이터의 선택지 값

### 유형 D: 스크린/단계 번호 변경

- [ ] 매일수집질문_DB설계.md (Screen N)
- [ ] 온보딩설문플랜.md (Screen N)
- [ ] DANAA_DB명세최종확정안 V2 (Step N, FINDRISC 표의 Step 참조)
- [ ] 분기 로직 다이어그램
- [ ] 그룹별 화면수 표

### 유형 E: 테이블/모델 구조 변경

- [ ] DANAA_DB명세최종확정안 V2 (테이블 설명, "N개 테이블" 숫자)
- [ ] DB엑셀 시트
- [ ] DANAA_API최종확정안 V2 (새 엔드포인트)
- [ ] LLM파트가이드 빌드순서

### 유형 F: API 엔드포인트 변경

**문서:**
- [ ] DANAA_API최종확정안 V2 (URL, 메서드, 스키마)
- [ ] LLM-파트-시작-가이드.md API 예시
- [ ] docs/TEAM_AI_PROMPT.md API 관련 예시

**코드:**
- [ ] app/apis/v1/ 라우터 코드
- [ ] app/dtos/ DTO 스키마
- [ ] app/services/ 서비스 레이어 (라우터가 호출하는 함수)
- [ ] app/tests/ API 테스트

### 유형 G: 확정안 버전 업 (V2→V3 등)

새 버전 확정안 생성 시 아래 전부 갱신 필요:

- [ ] 신규 V(N+1) 파일 생성 (날짜 + 버전 명시)
- [ ] 구 V(N) 파일 첫 줄에 **DEPRECATED** 헤더 추가
- [ ] `docs/DOCUMENT_REGISTRY.md` "현재 기준 버전" 테이블 갱신
- [ ] `docs/TEAM_AI_PROMPT.md` "주요 참고 문서" 테이블 갱신
- [ ] `docs/HANDOFF_MEMO.md` 계층도 파일명 갱신
- [ ] `docs/ARCHITECTURE.md` 계층도 + 참조 링크 갱신
- [ ] `매일수집질문_DB설계.md` 하단 참조 갱신
- [ ] `docs/collaboration/doc-sync-map.md` 파일명 갱신
- [ ] `.claude/rules/doc-sync.md` 계층도 파일명 갱신
- [ ] Grep으로 구 파일명 잔존 확인 → deprecated 파일 자체 외 0건이어야 PASS

### 유형 H: 데모 버전 업 (V8-8→V8-9 등)

새 데모 HTML 생성 시:

- [ ] `.claude/rules/design-context.md` 최신 데모 + 버전 히스토리 갱신
- [ ] `docs/DOCUMENT_REGISTRY.md` 데모 버전 갱신
- [ ] Grep으로 구 버전 문자열(예: "V8-8") 잔존 확인

### 유형 I: 팀 문서 갱신 트리거

계층 2(DB 명세) 또는 계층 3(API 명세) 확정안의 **내용이 변경**되었을 때:

- [ ] `docs/TEAM_AI_PROMPT.md` — 엔드포인트 수, 테이블 수, enum 값 예시 확인
- [ ] `docs/HANDOFF_MEMO.md` — 프로젝트 숫자 통계, 계층도 확인
- [ ] `docs/ARCHITECTURE.md` — 테이블/라우터/서비스 수 확인

---

## Grep 검증 패턴

동기화 체크 Step 4~5에서 사용하는 검증:

1. **필드명 잔존**: 바뀐 필드의 옛 이름으로 프로젝트 전체 Grep → 0건이어야 PASS
2. **숫자 일관성**: "N스크린", "N테이블", "N개 필드" 등을 Grep → 문서마다 같아야 PASS
3. **선택지 수**: 특정 필드명으로 Grep → 각 문서에서 선택지 수가 같아야 PASS
4. **API 필드 누락**: 원천 문서의 필드 목록 vs API 요청 JSON의 키 비교 → 누락 0건이어야 PASS
5. **폐기 파일 참조 잔존**: 구버전 파일명(예: `_2026-04-02.md`)으로 Grep → deprecated 파일 자체와 V2 변경이력 외 0건이어야 PASS
