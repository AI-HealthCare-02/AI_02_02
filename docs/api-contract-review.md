# API 계약 문서 리뷰

검토 대상: `api-contract.md`  
검토 목적: 팀 공용 API 계약으로 바로 채택 가능한지 확인하고, 수정이 필요한 부분을 정리

## 결론

전체 방향은 좋습니다.  
특히 아래 항목은 현재 프로젝트와 잘 맞습니다.

- 온보딩, 대시보드, 건강 로그, 챌린지, 분석 API가 기능 기준으로 잘 나뉘어 있음
- 웹 우선 구조이면서도 앱/외부 연동까지 고려한 URL 설계가 되어 있음
- `dashboard/init`, `challenges/overview`처럼 화면 단위 집계 API를 둔 점이 실서비스에 적합함
- `PATCH /health/daily/{date}` 중심으로 건강 입력 흐름을 단순화한 점이 좋음

다만 현재 문서를 그대로 팀 표준으로 확정하면 위험한 부분이 있어서, 수정 후 채택이 맞습니다.

권장 결론:

- `api-contract.md`를 기본안으로 채택
- 아래 수정사항 반영 후 `v1.1`로 확정

## 주요 피드백

### 1. JWT의 `user_group` 사용 방식은 수정이 필요

문서에서는 JWT에 `user_id`, `user_group`를 담는다고 되어 있고,  
온보딩 후에는 "다음 토큰 갱신 시 반영"이라고 적혀 있습니다.

문제:

- 온보딩 직후 같은 세션에서 `user_group` 값이 바로 안 바뀔 수 있음
- 그런데 그룹 제한 필드 검증은 즉시 정확해야 함
- 그러면 `took_medication` 같은 필드 처리에서 오동작 가능

권장 수정:

- 온보딩 성공 시 access token을 즉시 재발급하거나
- `user_group`는 JWT가 아니라 DB/Redis에서 조회

추천안:

- `user_id`만 JWT에 유지
- `user_group`, `engagement_state`는 서버에서 조회

이유:

- 그룹은 가입 후 바뀔 수 있는 값이라 토큰에 고정하기 애매함
- 모바일/웹/외부 연동까지 고려하면 서버 기준 단일 판정이 더 안전함

## 2. cron이 미입력 데이터를 기본값으로 채우는 설계는 비추천

문서에는 미응답 건강 데이터에 대해 아래처럼 기본값을 넣는다고 되어 있습니다.

- `exercise = "none"`
- `veggie = false`
- `breakfast = "skipped"`

문제:

- 사용자가 답하지 않은 것과 실제로 안 한 것을 구분할 수 없게 됨
- 건강데이터 원본이 왜곡됨
- `First Answer Wins`와 결합되면 나중 실제 입력도 막을 수 있음

권장 수정:

- 원본 `DailyHealthLog`에는 `null` 유지
- 기본값 보정은 분석/리포트 계층에서만 계산
- 즉, "저장"과 "해석"을 분리

추천안:

- 수집 DB는 사실 그대로 저장
- 분석 API에서만 보수적 해석 규칙 적용

이유:

- 의료/건강 데이터는 원본 보존이 우선
- 나중에 모델 수정, 리포트 규칙 변경, AI 분석 개선이 쉬워짐

## 3. 혈압 측정 API는 2번 호출 방식보다 1번 호출이 더 좋음

문서에는 혈압 수축기/이완기를 각각 따로 보내는 방식이 들어 있습니다.

문제:

- 한쪽만 저장될 수 있음
- 측정 시각이 달라질 수 있음
- 리포트나 차트에서 한 쌍으로 묶기 불편함

권장 수정:

- 혈압은 전용 요청 구조로 한 번에 받기

예시:

```json
{
  "measurement_type": "blood_pressure",
  "systolic": 128,
  "diastolic": 82,
  "measured_at": "2026-04-01T08:00:00"
}
```

추천안:

- 일반 측정 API와 별도 스키마를 두거나
- `measurement_type`별 유효성 검사를 강화

이유:

- 혈압은 하나의 측정 이벤트로 다루는 게 자연스러움
- 추후 앱 연동, 차트 처리, 이상치 검증에 유리함

## 4. `PATCH /health/daily/{date}`의 `fields` 자유 맵 구조는 약함

문서에서는 아래처럼 `fields`에 자유롭게 넣는 방식입니다.

```json
{
  "source": "chat",
  "fields": {
    "sleep": "good",
    "sleep_hours": 7.5,
    "breakfast": "hearty"
  }
}
```

문제:

- Swagger/OpenAPI에서 타입 계약이 약해짐
- 프론트, 앱, MCP, 외부 챗봇이 붙을 때 자동 검증 이점이 줄어듦
- 필드 오타를 문서 단계에서 잡기 어려움

권장 수정:

- 엔드포인트는 유지
- 다만 `fields: dict` 대신 "모든 필드가 optional인 명시적 schema" 사용

예시 방향:

- `DailyHealthLogPatchRequest`
- 내부에 `sleep`, `sleep_hours`, `breakfast` 등이 optional로 명시

이유:

- 클라이언트 계약이 강해짐
- Swagger 기반 협업이 쉬워짐
- 앱/외부 연동 확장성에 유리함

## 5. 예시 JSON은 실제 파싱 가능한 형태로 정리 필요

문서의 `challenges/overview` 예시 일부는 문자열/따옴표가 깨져 있습니다.

문제:

- 문서를 기준으로 자동 생성, 테스트, mock 작업이 어려움
- 팀원이 문서 그대로 복붙해 테스트하면 실패 가능

권장 수정:

- 모든 예시 JSON을 실제 JSON validator 기준으로 다시 점검
- 특히 `badges` 배열 예시 정리 필요

이유:

- API 계약 문서는 "읽는 문서"이면서 동시에 "실행 가능한 예시"여야 함

## 채택해도 좋은 부분

아래는 그대로 유지해도 좋습니다.

- `/api/v1/onboarding/survey`
- `/api/v1/onboarding/status`
- `/api/v1/dashboard/init`
- `/api/v1/health/daily/{date}`
- `/api/v1/health/daily/missing`
- `/api/v1/health/daily/batch`
- `/api/v1/chat/sessions`
- `/api/v1/chat/messages` SSE 구조
- `/api/v1/risk/latest`
- `/api/v1/analysis/*`
- `/api/v1/challenges/overview`
- `/api/v1/challenges/{template_id}/join`
- `/api/v1/challenges/{user_challenge_id}/checkin`
- `/api/v1/challenges/{user_challenge_id}/calendar`
- `/api/v1/settings`

즉, URL 구조와 기능 분해는 전반적으로 좋습니다.

## 최종 권장안

팀 기준으로는 아래처럼 정리하는 것을 추천합니다.

1. 현재 `api-contract.md`를 기본안으로 채택
2. 아래 5개만 수정
- JWT의 `user_group` 처리 방식
- cron 기본값 자동 삽입 제거
- 혈압 측정 요청 구조 변경
- `PATCH /health/daily/{date}`를 명시적 schema 기반으로 변경
- 깨진 예시 JSON 정리
3. 수정본을 `v1.1`로 확정
4. 그 기준으로 FastAPI Swagger 뼈대 생성

## 한 줄 요약

이 문서는 방향이 좋고 실서비스형 구조로 잘 설계되어 있습니다.  
다만 그대로 확정하지 말고, 핵심 5개를 수정한 뒤 팀 표준 API 계약으로 채택하는 것이 가장 안전합니다.
