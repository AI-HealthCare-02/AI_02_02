---
paths:
  - "docs/**"
  - "매일수집질문*"
  - "apps/web/data/**"
  - "app/models/**"
  - "app/dtos/**"
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
  docs/collaboration/DANAA_DB명세최종확정안_2026-04-02.md (어떻게 저장할지)
  docs/collaboration/DANAA_DB명세확정안_엑셀_2026-04-02.xlsx
       ▼
[계층 3: 계약]
  docs/collaboration/DANAA_API최종확정안_2026-04-02.md (어떻게 주고받을지)
       ▼
[계층 4: 참조]
  docs/prototypes/다나아_데이터수집_설계가이드V3.html
  docs/prototypes/다나아_LLM파트_가이드.html
  .claude/rules/design-context.md, medical-domain.md
       ▼
[계층 5: 코드]
  app/models/, app/dtos/, app/apis/, apps/web/data/diabetes.js
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

- [ ] 매일수집질문_DB설계.md의 필드명
- [ ] 온보딩설문플랜.md 해당 필드 언급
- [ ] DANAA_DB명세최종확정안.md 테이블 필드명
- [ ] DB엑셀 해당 열 이름
- [ ] DANAA_API최종확정안.md 요청/응답 JSON 키 + 허용값 표
- [ ] apps/web/data/diabetes.js의 id/value
- [ ] app/models/ SQLAlchemy 컬럼명
- [ ] app/dtos/ Pydantic 필드명
- [ ] .claude/rules/ 해당 필드 언급
- [ ] **Grep으로 옛 이름이 프로젝트 전체에 안 남았는지 확인**

### 유형 B: 필드 추가/삭제

- [ ] 매일수집질문_DB설계.md (스크린 번호 조정, "총 N스크린" 숫자)
- [ ] 온보딩설문플랜.md (스크린 추가/삭제, 분기 로직 다이어그램, 그룹별 화면수)
- [ ] DANAA_DB명세최종확정안.md (테이블 필드 추가/삭제, "N개 필드" 숫자)
- [ ] DB엑셀 해당 시트 열
- [ ] DANAA_API최종확정안.md (요청/응답 JSON, _source 개수)
- [ ] diabetes.js 질문 객체
- [ ] 3기능 매핑표 (위험도/대시보드/챌린지)
- [ ] FINDRISC 8변수 영향 여부
- [ ] medical-domain.md "현재 N문항" 숫자

### 유형 C: 선택지 변경

- [ ] 매일수집질문_DB설계.md (N지 숫자 + 선택지 목록)
- [ ] 온보딩설문플랜.md (선택지 목록)
- [ ] DANAA_API최종확정안.md (허용값 enum + 요청 예시 JSON)
- [ ] diabetes.js (options 배열)
- [ ] DANAA_DB명세최종확정안.md 필드 설명
- [ ] FINDRISC 점수 로직 영향 확인

### 유형 D: 스크린/단계 번호 변경

- [ ] 매일수집질문_DB설계.md (Screen N)
- [ ] 온보딩설문플랜.md (Screen N)
- [ ] DANAA_DB명세최종확정안.md (Step N, FINDRISC 표의 Step 참조)
- [ ] 분기 로직 다이어그램
- [ ] 그룹별 화면수 표

### 유형 E: 테이블/모델 구조 변경

- [ ] DANAA_DB명세최종확정안.md (테이블 설명, "N개 테이블" 숫자)
- [ ] DB엑셀 시트
- [ ] DANAA_API최종확정안.md (새 엔드포인트)
- [ ] LLM파트가이드 빌드순서

### 유형 F: API 엔드포인트 변경

- [ ] DANAA_API최종확정안.md (URL, 메서드, 스키마)
- [ ] LLM-파트-시작-가이드.md API 예시
- [ ] app/apis/v1/ 라우터 코드
- [ ] app/dtos/ DTO 스키마

---

## Grep 검증 패턴

동기화 체크 Step 4~5에서 사용하는 검증:

1. **필드명 잔존**: 바뀐 필드의 옛 이름으로 프로젝트 전체 Grep → 0건이어야 PASS
2. **숫자 일관성**: "N스크린", "N테이블", "N개 필드" 등을 Grep → 문서마다 같아야 PASS
3. **선택지 수**: 특정 필드명으로 Grep → 각 문서에서 선택지 수가 같아야 PASS
4. **API 필드 누락**: 원천 문서의 필드 목록 vs API 요청 JSON의 키 비교 → 누락 0건이어야 PASS
