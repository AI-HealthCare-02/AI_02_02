# DANAA 프론트엔드 구조 정리

## 폴더 구조

```
frontend/
├── app/
│   ├── layout.js              ← 루트 레이아웃 (폰트, 메타)
│   ├── globals.css            ← 디자인 시스템 (색상, 폰트, 공통 스타일)
│   ├── page.js                ← 랜딩 페이지
│   │
│   ├── login/
│   │   └── page.js            ← 로그인
│   ├── signup/
│   │   └── page.js            ← 회원가입
│   │
│   ├── onboarding/
│   │   ├── layout.js          ← 온보딩 공통 레이아웃 (프로그레스바)
│   │   └── [condition]/
│   │       └── page.js        ← 설문 (diabetes 등)
│   │
│   └── app/                   ← 로그인 후 메인 앱
│       ├── layout.js          ← 사이드바 + 하단탭 레이아웃
│       ├── chat/
│       │   └── page.js        ← AI 채팅
│       ├── report/
│       │   └── page.js        ← 대시보드/리포트
│       ├── challenge/
│       │   └── page.js        ← 챌린지
│       └── settings/
│           └── page.js        ← 설정
│
├── components/                ← 재사용 컴포넌트
│   ├── common/                ← 공통 (Button, Card, Modal)
│   ├── layout/                ← 네비게이션, 사이드바, 푸터
│   └── onboarding/            ← 설문 관련
│
├── services/
│   └── api.js                 ← API 호출 래퍼
│
└── data/
    └── diabetes.js            ← 온보딩 설문 데이터
```

## 프론트 페이지 ↔ 백엔드 API 매핑

| 프론트 페이지 | 사용할 API | 설명 |
|---|---|---|
| `/login`, `/signup` | `POST /auth/login`, `/auth/signup` | 인증 |
| `/onboarding/diabetes` | `POST /onboarding/survey`, `GET /onboarding/status` | 온보딩 설문 |
| `/app/chat` | `POST /chat/send`, `GET /chat/history` | AI 채팅 |
| `/app/report` | `GET /dashboard/init`, `/analysis/summary`, `/health/*` | 대시보드 + 리포트 |
| `/app/challenge` | `GET /challenge/overview`, `POST /challenge/checkin` | 챌린지 |
| `/app/settings` | `GET /user/me`, `PATCH /user/me` | 사용자 설정 |

## 분업 단위

| 영역 | 페이지 | 주요 작업 |
|---|---|---|
| 랜딩 | `/` | 디자인 + 반응형 |
| 인증 | 로그인/회원가입 | 폼 + API 연동 |
| 온보딩 | `/onboarding` | 설문 플로우 + API |
| 채팅 | `/app/chat` | SSE 스트리밍 + UI |
| 리포트 | `/app/report` | 차트 + 데이터 시각화 |
| 챌린지 | `/app/challenge` | 체크인 + 진행률 |
| 설정 | `/app/settings` | 프로필 + 알림 |

## 백엔드 개발자에게 확인할 것

1. 위 API 엔드포인트가 현재 코드와 맞는지
2. 응답 형식(response) 예시 공유
3. 인증 방식 (JWT 토큰 어디에 담아서 보내는지)

## 참고 문서

- API 명세: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md`
- DB 명세: `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md`
- 와이어프레임: `danaa_fullflow_v33.html`
