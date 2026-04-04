# 승인된 건강 문서 코퍼스 (Approved Corpus)

## 목적
다나아 AI 챗봇의 생활습관 코칭 답변에 근거를 보강하기 위한 운영 문서 저장소.

## 문서 규칙

### Frontmatter (필수)
모든 `.md` 파일은 아래 형식의 frontmatter를 포함해야 합니다:

```markdown
---
doc_id: diet_general_001
title: 당뇨 환자의 식단 관리
category: diet_nutrition
review_status: approved
version: 1
---
```

### 필수 필드
| 필드 | 설명 |
|------|------|
| `doc_id` | 고유 식별자 (영문+숫자+언더스코어) |
| `title` | 문서 제목 (한국어) |
| `category` | 허용 카테고리 중 하나 |
| `review_status` | `approved`만 로드됨 |
| `version` | 정수 버전 번호 |

### 허용 카테고리
- `diabetes_lifestyle` — 당뇨 생활습관
- `hypertension_lifestyle` — 고혈압 생활습관
- `medication_compliance` — 복약 순응
- `diet_nutrition` — 식단/영양
- `exercise_activity` — 운동/활동
- `sleep_mental` — 수면/정신건강

## 문체 규칙
- 권유형, 비처방형, 생활습관 중심
- "~해보는 건 어때요?", "~을 권장해요" 사용
- "~해야 합니다", "~하세요" 같은 의무형 금지

## 금지 사항
- 진단, 처방, 약물 용량, 수치 기반 판정
- 내부 운영 메모 (TODO, FIXME, NOTE)
- 내부 경로/파일명 (app/, docs/, .py, .md)
- "MVP 이후", "향후", "v2에서" 같은 로드맵 표현
- assistant 대상 명령문 ("반드시 포함하세요", "이렇게 답변하세요")

## 출처
- planning/prototype 문서를 그대로 복사하지 않음
- 검수된 내용만 운영 문서로 재작성하여 등록
