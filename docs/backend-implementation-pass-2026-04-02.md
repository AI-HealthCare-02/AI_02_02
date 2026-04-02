# Backend Implementation Pass

- 작성일: 2026-04-02
- 목적: 구조 개편 이후, 최종 DB/API 문서를 기준으로 실제 코드에 반영한 첫 정렬 범위를 기록

## 1. 이번 패스에서 반영한 범위

### health

- [app/domains/health/enums.py](/C:/PycharmProjects/DANAA_project/app/domains/health/enums.py)
  - 최종 문서 기준 enum 재정의
  - `sleep_quality`, `sleep_duration_bucket`, `meal_balance_level`, `exercise_type`, `ai_consent` 등 정렬
- [app/domains/health/models.py](/C:/PycharmProjects/DANAA_project/app/domains/health/models.py)
  - `HealthProfile`, `DailyHealthLog`, `PeriodicMeasurement`, `RiskAssessment`, `UserEngagement` 필드명 정렬
  - 예전 `sleep`, `foodcomp`, `walk` 같은 이름 제거
- [app/domains/health/schemas.py](/C:/PycharmProjects/DANAA_project/app/domains/health/schemas.py)
  - 온보딩, daily, measurements, risk, settings, internal 응답 스키마 정렬

### onboarding

- [app/domains/onboarding/repository.py](/C:/PycharmProjects/DANAA_project/app/domains/onboarding/repository.py)
  - 서비스 계층이 호출할 저장 경계 추가
- [app/domains/onboarding/service.py](/C:/PycharmProjects/DANAA_project/app/domains/onboarding/service.py)
  - `relation -> user_group` 계산
  - BMI 계산
  - 기본 FINDRISC 점수 계산
  - 초기 위험도 계산
- [app/apis/v1/onboarding_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/onboarding_routers.py)
  - request에서 `user_group` 제거
  - service 통해 응답 생성

### challenge

- [app/domains/challenges/enums.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/enums.py)
  - `selection_source`, `phase` 등 최종 구조에 필요한 enum 정렬
- [app/domains/challenges/models.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/models.py)
  - `default_duration_days`, `selection_source`, `ends_at`, `source_period` 반영
  - `UserBadge` 제거
- [app/domains/challenges/schemas.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/schemas.py)
  - overview/join/checkin/calendar 응답 정렬
- [app/apis/v1/challenge_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/challenge_routers.py)
  - 대표 응답 예시를 최종 문서 기준으로 정렬

### supporting routers

- [app/apis/v1/dashboard_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/dashboard_routers.py)
- [app/apis/v1/health_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/health_routers.py)
- [app/apis/v1/risk_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/risk_routers.py)
- [app/apis/v1/settings_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/settings_routers.py)
- [app/apis/v1/analysis_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/analysis_routers.py)
- [app/apis/v1/internal_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/internal_routers.py)

## 2. 왜 이렇게 바꿨는가

이번 패스의 핵심은 "문서 이름과 코드 이름을 일치시키는 것"이었습니다.

기존 코드 문제:

- DB 최종 문서와 모델 필드명이 다름
- API 최종 문서와 request/response 필드명이 다름
- `relation`과 `user_group` 역할이 섞여 있음
- `sleep`, `foodcomp`, `walk` 같은 구버전 필드명이 남아 있음
- settings/challenge 응답 구조가 최종 문서와 다름

이번 패스에서는 이 이름 충돌을 먼저 줄였습니다.

## 3. 이번 패스에서 일부러 남겨둔 것

이번 수정은 "실제 저장/조회 로직 완성"이 아니라 "명세 정렬 1차"입니다.

아직 남아 있는 것:

- repository 실제 DB 저장 구현
- 서비스 로직과 ORM 연결
- 라우터 mock 응답 제거
- Aerich migration 재생성
- 기존 테스트를 새 API 계약 기준으로 교체

## 4. 다음 구현 우선순위

1. onboarding repository 실제 저장 구현
2. health service/repository 구현 후 `PATCH /health/daily/{date}` 검증 로직 연결
3. measurements 조회/저장 ORM 연결
4. challenge join/checkin/calendar 실제 로직 연결
5. migration 생성 후 테스트 업데이트
