---
description: 스킬/명령어 상세 규칙 — UI 스킬, 보안 검증, 금지 스킬
---

# 스킬/명령어 상세 규칙

## 추가 명령어 (필요 시)
- `/tdd` — 테스트 작성 (RED-GREEN-REFACTOR)
- `/handoff-verify` — PR 머지 직전 fresh-context 최종 검증
- `/code-review` 또는 `/security-review` — 인증/건강 데이터 API 수정 시

## UI 스킬 규칙
- Tailwind 설치 전: `ui-ux-pro-max`만 사용
- Tailwind 설치 후: `baseline-ui`로 컴포넌트 스타일링
- `frontend-design`: **사용 금지** (baseline-ui와 직접 충돌, 의료 앱 부적합)
- `cache-components`: **사용 금지** (Next.js 14.2에서 'use cache' 미지원)

## 보안 필수 검증 시점
- `app/apis/`, `app/services/auth.py` 수정 시 `/code-review` 필수
- PR 머지 전 `/handoff-verify` 실행 필수

## 사용 금지 스킬 (충돌·레거시·미설치 의존성)
`pi-planning-with-files`, `verify-loop`, `frontend-design`, `cache-components`, `executing-plans`
