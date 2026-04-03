# 욕설 필터 최종 구현 플랜 (PARTIAL #2)

> **저장일**: 2026-04-04
> **상태**: 승인 완료 → 구현 진행 중
> **리뷰 이력**: 원안 → 5개 에이전트 리뷰 → 보정 플랜 → 3관점 evaluate → 오탐 분석(100+문장) → 최종안

이 파일은 `.claude/plans/async-beaming-gem.md`의 승인된 플랜과 동일합니다.
전체 내용은 해당 파일을 참조하세요.

---

## 핵심 변경 요약 (이전 플랜 대비)

1. **위기 판정: 키워드 → 문맥 기반** — "죽겠다" 단독 매칭 금지, 관용구 예외 15개 패턴
2. **MEDICAL_NOTE: 질문 vs 선언 구분** — 물음표/의문형 어미 → ALLOW, 의도 표현 → MEDICAL_NOTE
3. **좌절감 WARN: 긍정 표현 제외** — "잘 나왔다", "노력하겠다" → ALLOW
4. **정규식 범위 제한** — `.*` → `.{0,15}` 또는 `.{0,20}`
5. **진짜 위기 표현 추가** — "다 끝내고 싶어", "차라리 죽", "과다복용" 등
6. **위기 감지 = 동의와 무관** — ai_consent=declined여도 위기는 반드시 감지
7. **24시간 쿨링오프** — 위기 후 건강질문 삽입 금지
8. **한국 위기 상담전화** — 1393, 109, 119

---

## 구현 순서

| Phase | 내용 | 파일 |
|-------|------|------|
| P1 | korcen smoke test + fallback | pyproject.toml |
| P2 | enum 추가 | app/models/enums.py |
| P3 | ContentFilterService 생성 | app/services/content_filter.py |
| P4 | ChatService 수정 | app/services/chat.py |
| P5 | Config + Sentry 강화 | app/core/config.py, sentry.py |
| P6 | 테스트 작성 + 실행 | app/tests/ |
| P7 | ruff check + format | 전체 |
| P8 | 자기검증 + /evaluate | — |

---

## 이전 계획

이전 플랜 (2026-04-03, 보정 전)은 `c:\Users\mal03\Downloads\욕설PLAN.md`에 보관됨.
주요 차이: 키워드 단독 매칭, `.*` 와일드카드 무제한, 관용구 예외 없음, 질문/선언 미구분.
