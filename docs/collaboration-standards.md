# Collaboration Standards

이 문서는 DANAA 백엔드 팀이 같은 기준으로 작업하기 위한 협업 규칙입니다.

## 1. 기본 원칙

1. 기준 문서 없이 모델/API를 임의로 바꾸지 않습니다.
2. `router -> service -> repository -> model` 순서를 지킵니다.
3. 라우터에서 ORM 직접 접근을 늘리지 않습니다.
4. DB 필드명과 API 필드명이 달라질 경우 문서와 alias 정책을 먼저 정합니다.

## 2. 현재 기준 문서

- DB: [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- API: [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- 엑셀: [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)
- 구조/근거: [backend-baseline-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-baseline-2026-04-02.md)
- 변경 요약: [backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)

## 3. 브랜치 규칙

- `main` 직접 push 금지
- 모든 작업은 브랜치에서 시작
- PR 리뷰 후 병합

권장 브랜치명:

- `feat/onboarding-save`
- `feat/health-daily-validation`
- `feat/challenge-checkin-service`
- `refactor/api-router-baseline`
- `docs/backend-baseline`

## 4. 커밋 규칙

- `feat: 기능 추가`
- `fix: 버그 수정`
- `refactor: 구조 개선`
- `docs: 문서 수정`
- `test: 테스트 추가/수정`
- `chore: 설정/도구/환경 정리`

## 5. 작업 위치 규칙

- 라우터: `app/apis/v1`
- 도메인 모델/스키마: `app/domains/<domain>`
- 도메인 서비스: `app/domains/<domain>/service.py`
- 도메인 저장소: `app/domains/<domain>/repository.py`
- DB 설정/마이그레이션: `app/db`

## 6. 바꾸기 전에 공유해야 하는 항목

아래 항목은 혼자 바꾸지 않습니다.

- DB 컬럼명
- enum 값
- nullable 규칙
- unique / index / FK 정책
- API request/response shape
- JWT payload 구조

## 7. 구현 우선순위

현재 우선순위는 아래 순서입니다.

1. 온보딩 저장
2. 건강 기록 patch/batch 검증
3. 챌린지 서비스
4. 리포트/위험도/분석
5. 설정/export/internal cron
