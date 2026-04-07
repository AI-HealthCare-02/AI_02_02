# TEAM_CHANGELOG_BJ.md

## 목적

이 문서는 BJ 작업 이력을 기록하는 개인 changelog입니다.

---

## 2026-04-07

### clean-main 구조 기준 문서와 CI/CD 정렬

- 작업자: BJ
- 요약:
  - 공용 기준 구조를 `backend/`, `workers/ai/`, `frontend/` 기준으로 재정리
  - `ghcr-build.yml`을 `backend/Dockerfile` 기준으로 복구
  - `docker-compose.prod.yml`을 `FASTAPI_IMAGE` 기반 EC2 수동 반영 흐름으로 정리
  - `README`, `ARCHITECTURE`, `DEVELOPMENT_WORKFLOWS`, `DOCUMENT_REGISTRY`, `TEAM_AI_PROMPT`를 현재 구조 기준으로 최신화
  - 개인 handoff 문서 `docs/HANDOFF_MEMO.md`는 저장소 추적에서 제외하고 ignore 처리
- 변경 이유:
  - `clean-main`을 팀 공통 구조 기준으로 삼으면서 문서와 CI/CD 설명이 예전 `app/`, `ai_worker/`, 개인 AI 파일 기준에 머물러 있었기 때문
- 영향 범위:
  - GitHub Actions 경로
  - 운영 배포 문서
  - 공용 구조 안내 문서
  - 개인 메모 추적 정책
- API/DB 영향:
  - 없음
- 확인 결과:
  - `uv run ruff check backend` 통과
  - `uv run python -m pytest backend/tests/unit -q` 통과 (`179 passed`)
