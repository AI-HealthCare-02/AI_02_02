# 프로젝트 구조 최신화 제안

## 결론

현재 템플릿은 FastAPI 시작점으로는 괜찮지만, 이 프로젝트를 끝까지 끌고 가기에는 너무 범용 레이어 중심 구조입니다.
이번 프로젝트의 핵심 복잡도는 인증보다 아래 영역에 있습니다.

- 건강 프로필 온보딩
- 하루 1행 건강 로그
- 주기 측정 데이터
- 위험도 계산
- 참여 상태 제어
- 챌린지 달성 판정
- 뱃지/보상

이 상태에서 계속 `models/`, `services/`, `dtos/` 아래로만 기능을 늘리면 도메인 규칙이 여러 폴더로 흩어집니다.
그래서 인프라는 유지하고, 제품 로직은 `app/domains` 아래로 모으는 방향이 더 적합합니다.

## 이번에 반영한 구조 방향

```text
app/
  apis/
    v1/
      auth_routers.py
      user_routers.py
  core/
  db/
    databases.py
    migrations/
  domains/
    health/
      enums.py
      models.py
      schemas.py
    challenges/
      enums.py
      models.py
      schemas.py
  dependencies/
  dtos/
  models/
    users.py
  repositories/
  services/
  tests/
```

## 왜 이렇게 바꾸는가

### 1. 설계서의 9개 테이블이 도메인 기준으로 깔끔하게 나뉨

`health` 도메인

- `HealthProfile`
- `DailyHealthLog`
- `PeriodicMeasurement`
- `RiskAssessment`
- `UserEngagement`

`challenges` 도메인

- `ChallengeTemplate`
- `UserChallenge`
- `ChallengeCheckin`
- `UserBadge`

이렇게 나누면 DB 설계서, API 설계, 서비스 로직, 테스트 기준이 같은 경계로 움직입니다.

### 2. WBS와도 맞음

업무가 실제로는 "회원/인증"보다 아래 기능 단위로 쪼개집니다.
이번 WBS도 온보딩, 대시보드, 수집, 리포트, 챌린지처럼 기능 축으로 읽히기 때문에 도메인 패키지 구조가 더 자연스럽습니다.

### 3. 이후 확장 포인트가 명확함

- 건강 질문 묶음 로직은 `health`
- FINDRISC/KDRS 계산은 `health`
- 챌린지 추천/참여/체크인은 `challenges`
- 뱃지/리워드는 `challenges`

새 기능이 들어와도 어느 폴더에 넣을지 바로 판단할 수 있습니다.

## 유지한 것

아래 폴더는 그대로 유지하는 게 맞습니다.

- `ai_worker/`
- `nginx/`
- `scripts/`
- `app/core/`
- `app/db/`

이 영역은 인프라/실행환경 성격이 강해서 도메인 분리 대상이 아닙니다.

## 당장 다 옮기지 않은 것

아래 폴더는 현재 auth/user 템플릿이 이미 쓰고 있어서 우선 유지했습니다.

- `app/dtos/`
- `app/services/`
- `app/repositories/`
- `app/dependencies/`
- `app/validators/`

즉, 지금 구조는 "전체 갈아엎기"가 아니라 "새 기능부터 올바른 위치로 들어가게 만드는 전환 단계"입니다.

이 판단이 좋은 이유는:

- 기존 인증 코드 리스크를 줄일 수 있고
- 지금 바로 건강 데이터 뼈대를 붙일 수 있고
- 이후 auth/user도 필요하면 같은 방식으로 점진 이동할 수 있기 때문입니다.

## 이번에 실제로 추가한 뼈대

### `app/domains/health`

- 건강 데이터 관련 enum 정의
- Phase 1 기준 핵심 Tortoise 모델 골격
- 요청/응답 스키마 출발점

### `app/domains/challenges`

- 챌린지/체크인/뱃지 enum 정의
- Phase 1 기준 핵심 Tortoise 모델 골격
- 챌린지 스키마 출발점

### `app/db/databases.py`

- 새 도메인 모델 모듈을 Tortoise 등록 목록에 추가

## 이 구조가 현재 자료와 맞는 이유

업로드 자료에서 공통으로 드러난 점은 아래입니다.

1. 데이터 수집 흐름이 온보딩, 일상 로그, 측정값, 리스크 계산, 챌린지 판정으로 이어짐
2. 하루 1행 로그와 필드별 source 추적이 핵심 제약임
3. 챌린지는 단순 UI가 아니라 별도 원천 테이블과 판정 로직이 필요한 기능임
4. 참여 상태와 쿨다운도 독립적인 규칙 집합임

이건 일반 CRUD 구조보다 "도메인 응집"이 더 중요한 프로젝트라는 뜻입니다.

## 추천하는 다음 단계

1. 팀에서 컬럼명과 enum 값을 1회 확정
2. nullable 규칙과 unique 제약 다시 점검
3. Aerich 마이그레이션 생성
4. `ChallengeTemplate` 시드 데이터 작성
5. `health`와 `challenges` 라우터/서비스 구현 시작
