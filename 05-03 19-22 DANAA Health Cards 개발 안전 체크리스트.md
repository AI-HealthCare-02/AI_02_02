# DANAA Health Cards 개발 안전 체크리스트

## 한 줄 결론

Claude Code와 Codex CLI에서 쓰는 외부 건강 체크인 통로를 만들되, 기존 채팅 API를 그대로 열지 않고 `외부 전용 인증 + 서버 발급 질문권 + 동의 검사`를 통과해야 저장되게 했다.

## 왜 이 변경이 필요한가

기존 `/chat/health-answer`는 DANAA 웹 채팅 안에서 쓰는 통로다. 외부 CLI가 이 API를 직접 쓰면 토큰 범위, 동의 확인, 중복 저장, 질문 위조 방어가 약해질 수 있다.

그래서 외부 도구 전용 API를 새로 만들었다.

## 현재 구조 확인

| 영역 | 확인 내용 | 판단 |
|---|---|---|
| 인증 | 기존 웹 사용자는 JWT, 외부 CLI는 새 device code 토큰 | 분리됨 |
| 저장 | 기존 `HealthQuestionService.save_health_answers` 재사용 | 중복 로직 줄임 |
| 출처 | `DataSource.AI_TOOL` 추가 | 웹 채팅과 CLI 저장 구분 가능 |
| 동의 | `UserConsent.health_data_consent` 없으면 403 차단 | 안전 |
| DB | 외부 토큰/질문권/멱등 요청 테이블 추가 | migration 필요 |
| API | `/api/v1/external-*` 신규 | 기존 클라이언트 영향 낮음 |

## DB 변경

새 테이블:

- `external_device_sessions`
- `external_client_tokens`
- `external_checkin_leases`
- `external_checkin_requests`

롤백 전략:

- migration downgrade에서 위 4개 테이블을 역순으로 삭제한다.
- 기존 `daily_health_logs` 데이터는 삭제하지 않는다.

호환성:

- 기존 `daily_health_logs` 컬럼은 유지한다.
- `DataSource.AI_TOOL = "ai_tool"`은 기존 source varchar 길이 안에 들어간다.

## API 변경

새 API:

- `POST /api/v1/external-auth/device/start`
- `POST /api/v1/external-auth/device/approve`
- `POST /api/v1/external-auth/device/token`
- `GET /api/v1/external/checkins/next`
- `POST /api/v1/external/checkins/answer`
- `GET /api/v1/external/settings`
- `PATCH /api/v1/external/settings`

기존 API:

- `/chat/health-answer`는 외부 CLI에서 쓰지 않는다.
- 기존 채팅 저장 흐름은 기본값 `DataSource.CHAT`로 유지했다.

## 보안 체크

| 항목 | 조치 | 결과 |
|---|---|---|
| 토큰 원문 저장 | 서버 DB에는 SHA-256 해시만 저장 | 통과 |
| 동의 없는 저장 | `CONSENT_REQUIRED` 403 | 통과 |
| 질문 위조 | 서버 발급 lease 없으면 저장 불가 | 통과 |
| 중복 저장 | `Idempotency-Key`로 같은 요청 재사용 | 통과 |
| 토큰/답변 로그 | Sentry 필터에 외부 API와 토큰 필드 추가 | 통과 |
| 계정 간 저장 | token.user_id와 lease.user_id 일치 강제 | 통과 |

## 테스트 결과

| 테스트 | 결과 | 쉬운 해석 |
|---|---|---|
| `python -m compileall ...` | 통과 | 새 Python 파일 문법 정상 |
| `uv run ruff check ...` | 통과 | 린트 규칙 위반 없음 |
| 외부 체크인 통합 테스트 5개 | 통과 | 토큰, 동의, lease, 저장, 설정 흐름 정상 |
| 기존 채팅 저장 회귀 2개 | 통과 | 기존 AI 채팅 건강질문 저장이 깨지지 않음 |
| 플러그인 `npm run typecheck` | 통과 | TypeScript 타입 오류 없음 |
| 플러그인 `npm test` | 통과 | 카드 표시/토큰 마스킹 테스트 정상 |
| 플러그인 `npm run build` | 통과 | 배포용 빌드 생성 가능 |

## 남은 출시 전 확인

- 실제 웹 설정 화면에 device code 승인 UI 연결
- 운영 DB에 migration 적용 전 백업
- 공개 저장소 생성 후 GitHub Actions에서 CI 재검증
- 토큰 환경변수 안내 문구를 README 기준으로 팀 검수
