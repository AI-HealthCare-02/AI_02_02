# LangGraph PR 리뷰 게이트

## A. 아키텍처 / 경계 준수
- [x] `content_filter`, DB write, SSE는 graph 밖에 남겼다.
- [x] `chat_graph`는 prep 책임만 가진다.

## B. 데이터 무결성
- [x] crisis/block/consent early return 계약 유지
- [x] cooldown 상태는 `ChatService`가 계속 소유

## C. 보안 / 권한
- [x] raw message/prompt/context를 parity 로그에 남기지 않는다.
- [x] Sentry 민감정보 필드 목록에 prep raw 필드 추가

## D. API / DB 호환성
- [x] DB 변경 없음
- [x] `/chat/send` 응답 shape 유지
- [x] `backend.services.chat.ChatService` import 유지

## E. 테스트
- [x] unit 전체 green
- [ ] integration branch flow는 환경 미비로 미실행

## F. 운영 준비
- [x] `off/shadow/partial` 플래그 정의
- [x] timeout / fallback / kill switch 정리
- [x] rollout 문서와 면접 설명 스크립트 작성
