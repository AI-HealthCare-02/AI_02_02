# 스택 결정 기록

## 결론

이 프로젝트의 기본 DB는 MySQL보다 PostgreSQL이 더 적합합니다.

## 왜 PostgreSQL인가

### 1. JSON 필드가 이미 많음

현재 모델에는 JSON 기반 필드가 여러 개 있습니다.

- `conditions`
- `diet_habits`
- `goals`
- `goal_criteria`
- `for_groups`
- `daily_log`
- `source_field_keys`
- `context`

이 프로젝트는 정형 데이터만 다루는 구조가 아니라 반정형 데이터도 함께 다룹니다.
이 경우 PostgreSQL이 장기적으로 더 유리합니다.

### 2. 리포트와 분석성 쿼리가 늘어날 가능성이 큼

다나아는 앞으로 아래 쿼리가 늘어날 가능성이 높습니다.

- 기간별 집계
- 사용자 상태 변화 분석
- 챌린지 달성 추적
- 질문 응답 로그 분석

이런 성격의 서비스는 PostgreSQL이 더 잘 맞습니다.

### 3. 지금 바꾸는 비용이 가장 낮음

아직 프로젝트 초기라 MySQL 종속 지점이 적습니다.

- 드라이버
- compose
- 테스트 설정
- CI 설정
- 초기 마이그레이션

지금 전환하는 것이 가장 안전합니다.

## 최종 선택

- Python: 3.13.x
- API: FastAPI
- ORM: Tortoise ORM
- Migration: Aerich
- DB: PostgreSQL 17
- Cache/Broker: Redis
- Worker: 별도 Python 프로세스
