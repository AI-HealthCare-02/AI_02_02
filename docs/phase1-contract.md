# 다나아 Phase 1 공용 계약

이 문서는 아래 자료를 기준으로 정리했습니다.

- 다나아 건강데이터 DB모델 설계서
- 다나아 DB모델 팀공유 프롬프트
- 다나아 데이터수집 설계가이드 V3
- 현재 저장소 구조

목적은 "설명"이 아니라 팀이 바로 개발에 들어갈 수 있는 공용 계약 초안을 만드는 것입니다.

## 1. 도메인 테이블 확정

### Health

- `health_profiles`
- `daily_health_logs`
- `periodic_measurements`
- `risk_assessments`
- `user_engagements`

### Challenges

- `challenge_templates`
- `user_challenges`
- `challenge_checkins`
- `user_badges`

## 2. 컬럼명 기준

아래 컬럼은 우선 공용 기준으로 삼아도 됩니다.

### `health_profiles`

- `id`
- `user_id`
- `user_group`
- `relation`
- `age_range`
- `height_cm`
- `weight_kg`
- `bmi`
- `family_history`
- `conditions`
- `has_hypertension`
- `has_high_glucose_history`
- `exercise_frequency`
- `has_daily_vegetables`
- `diet_habits`
- `sleep_habit`
- `smoking_status`
- `alcohol_frequency`
- `goals`
- `initial_findrisc_score`
- `onboarding_completed_at`
- `created_at`
- `updated_at`

### `daily_health_logs`

- `id`
- `user_id`
- `log_date`
- `sleep`
- `sleep_hours`
- `breakfast`
- `took_medication`
- `foodcomp`
- `sweetdrink`
- `exercise`
- `exercise_type`
- `exercise_minutes`
- `veggie`
- `walk`
- `nightsnack`
- `mood`
- `alcohol_today`
- `alcohol_amount`
- `lunch`
- `dinner`
- `water_cups`
- `sleep_source`
- `breakfast_source`
- `took_medication_source`
- `foodcomp_source`
- `sweetdrink_source`
- `exercise_source`
- `exercise_minutes_source`
- `veggie_source`
- `walk_source`
- `nightsnack_source`
- `mood_source`
- `alcohol_today_source`
- `alcohol_amount_source`
- `is_backfill`
- `backfilled_at`
- `created_at`
- `updated_at`

### `periodic_measurements`

- `id`
- `user_id`
- `measurement_type`
- `measured_date`
- `numeric_value`
- `secondary_value`
- `unit`
- `source`
- `note`
- `created_at`
- `updated_at`

### `risk_assessments`

- `id`
- `user_id`
- `period_type`
- `period_start`
- `period_end`
- `findrisc_score`
- `risk_level`
- `sleep_score`
- `diet_score`
- `exercise_score`
- `lifestyle_score`
- `score_age`
- `score_bmi`
- `score_waist`
- `score_exercise`
- `score_vegetable`
- `score_hypertension`
- `score_glucose_history`
- `score_family`
- `calculated_at`
- `created_at`
- `updated_at`

### `user_engagements`

- `id`
- `user_id`
- `state`
- `seven_day_response_rate`
- `last_question_bundle_at`
- `bundles_today`
- `cooldown_until`
- `last_bundle_key`
- `last_answered_at`
- `is_on_vacation`
- `created_at`
- `updated_at`

### `challenge_templates`

- `id`
- `name`
- `category`
- `description`
- `goal_criteria`
- `duration_days`
- `evidence_summary`
- `risk_factor`
- `for_groups`
- `is_active`
- `created_at`
- `updated_at`

### `user_challenges`

- `id`
- `user_id`
- `template_id`
- `status`
- `started_at`
- `target_end_date`
- `completed_at`
- `current_streak`
- `best_streak`
- `progress_pct`
- `daily_log`
- `notes`
- `created_at`
- `updated_at`

### `challenge_checkins`

- `id`
- `user_challenge_id`
- `checkin_date`
- `status`
- `judged_by`
- `source_field_keys`
- `note`
- `created_at`
- `updated_at`

### `user_badges`

- `id`
- `user_id`
- `badge_type`
- `earned_at`
- `context`

## 3. enum 값 기준

설계서에서 사실상 확정 가능한 값은 아래입니다.

### Health

`user_group`
- `A`
- `B`
- `C`

`family_history`
- `none`
- `second_degree`
- `first_degree`

`sleep`
- `great`
- `good`
- `average`
- `poor`
- `very_poor`

`breakfast`, `lunch`, `dinner`
- `none`
- `light`
- `balanced`
- `heavy`

`foodcomp`
- `balanced`
- `carb_heavy`
- `protein_heavy`
- `vegetable_heavy`
- `fast_food`
- `skipped`

`took_medication`, `sweetdrink`, `exercise`, `veggie`, `walk`, `nightsnack`, `alcohol_today`
- `yes`
- `no`
- `unknown`

`exercise_type`
- `walking`
- `cardio`
- `strength`
- `sports`
- `stretching`
- `other`

`mood`
- `very_good`
- `good`
- `neutral`
- `low`
- `very_low`

`*_source`
- `chat`
- `direct`
- `backfill`

`measurement_type`
- `weight`
- `waist`
- `blood_pressure`
- `hba1c`
- `fasting_glucose`
- `cholesterol`
- `smoking_change`
- `medication_change`

`period_type`
- `weekly`
- `monthly`
- `quarterly`

`risk_level`
- `low`
- `slight`
- `moderate`
- `high`
- `very_high`

`state`
- `ACTIVE`
- `MODERATE`
- `LOW`
- `DORMANT`
- `HIBERNATING`

### Challenges

`category`
- `exercise`
- `diet`
- `sleep`
- `lifestyle`
- `medication`
- `weight`

`status`
- `active`
- `completed`
- `failed`
- `paused`

`checkin.status`
- `achieved`
- `missed`
- `partial`

`judged_by`
- `auto`
- `manual`

`badge_type`
- `first_log`
- `week_streak`
- `month_streak`
- `first_challenge`
- `five_challenges`
- `exercise_master`
- `diet_champion`
- `sleep_hero`
- `risk_improver`
- `perfect_week`
- `comeback`
- `onboarding_complete`

## 4. nullable 규칙 기준

설계서에 명시된 목적과 화면 흐름을 기준으로 정리한 기본 규칙입니다.

### `health_profiles`

필수:
- `user_id`
- `user_group`
- `relation`
- `age_range`
- `height_cm`
- `weight_kg`
- `bmi`
- `family_history`
- `conditions`
- `has_hypertension`
- `has_high_glucose_history`
- `has_daily_vegetables`
- `diet_habits`
- `goals`
- `initial_findrisc_score`

nullable 허용:
- `exercise_frequency`
- `sleep_habit`
- `smoking_status`
- `alcohol_frequency`
- `onboarding_completed_at`

### `daily_health_logs`

필수:
- `user_id`
- `log_date`
- `is_backfill`

nullable 허용:
- 대부분의 건강응답 필드
- 모든 `*_source`
- `backfilled_at`

조건부 필수:
- `exercise_minutes`: `exercise=yes`일 때 권장
- `alcohol_amount`: `alcohol_today=yes`일 때 권장
- `took_medication`: A그룹 사용자에서만 질문 대상

### `periodic_measurements`

필수:
- `user_id`
- `measurement_type`
- `measured_date`

nullable 허용:
- `numeric_value`
- `secondary_value`
- `unit`
- `note`

조건부:
- 혈압은 `numeric_value`, `secondary_value` 둘 다 사용 가능
- 체중/HbA1c/허리둘레는 보통 `numeric_value`만 사용

### `risk_assessments`

필수:
- `user_id`
- `period_type`
- `period_start`
- `period_end`
- `findrisc_score`
- `risk_level`
- `calculated_at`

필수 기본값 사용:
- 각 score 필드 0 허용

### `user_engagements`

필수:
- `user_id`
- `state`
- `seven_day_response_rate`
- `bundles_today`
- `is_on_vacation`

nullable 허용:
- `last_question_bundle_at`
- `cooldown_until`
- `last_bundle_key`
- `last_answered_at`

### `challenge_templates`

필수:
- `name`
- `category`
- `description`
- `goal_criteria`
- `duration_days`
- `for_groups`
- `is_active`

nullable 허용:
- `evidence_summary`
- `risk_factor`

### `user_challenges`

필수:
- `user_id`
- `template_id`
- `status`
- `started_at`
- `current_streak`
- `best_streak`
- `progress_pct`

nullable 허용:
- `target_end_date`
- `completed_at`
- `daily_log`
- `notes`

### `challenge_checkins`

필수:
- `user_challenge_id`
- `checkin_date`
- `status`
- `judged_by`
- `source_field_keys`

nullable 허용:
- `note`

### `user_badges`

필수:
- `user_id`
- `badge_type`
- `earned_at`

nullable 허용:
- `context`

## 5. unique 제약과 인덱스 기준

설계서에서 확정 가능하거나 강하게 필요한 항목입니다.

### unique

- `health_profiles.user_id` unique
- `user_engagements.user_id` unique
- `daily_health_logs (user_id, log_date)` unique
- `risk_assessments (user_id, period_type, period_start, period_end)` unique
- `challenge_checkins (user_challenge_id, checkin_date)` unique

### 권장 인덱스

- `daily_health_logs (user_id, log_date)`
- `periodic_measurements (user_id, measurement_type, measured_date)`
- `risk_assessments (user_id, period_end)`
- `user_challenges (user_id, status)`
- `challenge_checkins (user_challenge_id, checkin_date)`
- `user_badges (user_id, earned_at)`

## 6. API 계약 초안

설계서와 팀공유 프롬프트에 나온 API를 기준으로 Phase 1 최소 계약을 정리합니다.

### 6-1. 건강 프로필 생성/수정

`POST /api/v1/health-profile`

request:

```json
{
  "user_group": "B",
  "relation": "prediabetes",
  "age_range": "40-49",
  "height_cm": 168,
  "weight_kg": 72.5,
  "family_history": "first_degree",
  "conditions": ["hypertension"],
  "goals": ["risk", "diet", "exercise"]
}
```

response:

```json
{
  "id": 1,
  "user_id": 12,
  "user_group": "B",
  "bmi": 25.69,
  "initial_findrisc_score": 11,
  "onboarding_completed_at": "2026-04-01T10:30:00+09:00"
}
```

### 6-2. 일일 로그 수정

`PATCH /api/v1/daily-log/{log_date}`

request:

```json
{
  "breakfast": "balanced",
  "exercise": "yes",
  "exercise_minutes": 35,
  "veggie": "yes",
  "mood": "good",
  "source": "direct"
}
```

response:

```json
{
  "log_date": "2026-04-01",
  "saved_fields": ["breakfast", "exercise", "exercise_minutes", "veggie", "mood"],
  "ignored_fields": [],
  "is_backfill": false
}
```

주의:
- `First Answer Wins` 정책 때문에 이미 `_source`가 있으면 일부 필드는 저장 거부 가능

### 6-3. 대시보드 오늘 정보

`GET /api/v1/dashboard/today`

response:

```json
{
  "date": "2026-04-01",
  "today_log": {
    "sleep": "good",
    "breakfast": "balanced",
    "exercise": "yes",
    "exercise_minutes": 35,
    "veggie": "yes"
  },
  "risk_summary": {
    "findrisc_score": 11,
    "risk_level": "moderate"
  },
  "health_scores": {
    "sleep_score": 78,
    "diet_score": 82,
    "exercise_score": 70,
    "lifestyle_score": 75
  }
}
```

### 6-4. 최신 위험도

`GET /api/v1/risk-assessment/latest`

response:

```json
{
  "period_type": "weekly",
  "period_start": "2026-03-26",
  "period_end": "2026-04-01",
  "findrisc_score": 11,
  "risk_level": "moderate",
  "calculated_at": "2026-04-01T23:50:00+09:00"
}
```

### 6-5. 챌린지 참여

`POST /api/v1/challenges/{template_id}/join`

request:

```json
{
  "started_at": "2026-04-01T09:00:00+09:00"
}
```

response:

```json
{
  "id": 7,
  "template_id": 3,
  "status": "active",
  "current_streak": 0,
  "best_streak": 0,
  "progress_pct": 0.0,
  "target_end_date": "2026-04-08"
}
```

### 6-6. 챌린지 목록

`GET /api/v1/challenges`

response:

```json
[
  {
    "id": 1,
    "name": "주 150분 운동",
    "category": "exercise",
    "description": "주간 운동 시간을 150분 이상 채우는 챌린지",
    "duration_days": 7
  }
]
```

## 7. 아직 팀 합의가 더 필요한 것

아래는 설계서에 방향은 있지만, 최종 확정은 팀 회의가 한 번 더 필요합니다.

1. 뱃지 조건의 이벤트 발생 시점
2. `QuestionBundleEvent` 같은 운영 로그 테이블을 Phase 1에 넣을지 여부

## 8. 구현 시작 전에 해야 할 일

1. 이 문서를 팀이 함께 읽고 수정
2. 컬럼명/enum 확정
3. 첫 마이그레이션 생성
4. Swagger용 껍데기 API 라우터 생성
5. 프론트/AI 팀에 JSON 계약 공유

## 9. 추천 확정안

### 9-1. `foodcomp`는 무엇인가

`foodcomp`는 `food composition`의 줄임말입니다.
점심/저녁 식사의 "구성 질"을 간단히 분류하는 필드입니다.

즉, "먹었냐/안 먹었냐"가 아니라,
"이번 식사가 어떤 구성에 가까웠냐"를 보는 값입니다.

추천 이유:
- 식단 질을 대시보드와 챌린지에 연결하기 좋음
- 자유문자로 두면 프론트/백엔드/AI가 값을 제각각 저장할 위험이 큼
- enum으로 고정해야 통계와 필터가 쉬움

추천 확정값:
- `balanced`: 탄단지와 채소가 비교적 균형 잡힘
- `carb_heavy`: 밥/면/빵 위주
- `protein_heavy`: 단백질 비중이 높음
- `vegetable_heavy`: 채소 비중이 높음
- `fast_food`: 패스트푸드/가공식 중심
- `skipped`: 식사를 거름

결론:
- `foodcomp`는 자유 문자열이 아니라 enum으로 고정하는 것을 추천

### 9-2. `breakfast/lunch/dinner`는 4단계 유지

추천값:
- `none`
- `light`
- `balanced`
- `heavy`

이유:
- 사용자 입력 부담이 낮음
- AI 응답에서도 분류하기 쉬움
- 식사 여부와 대략적인 질/양을 동시에 담을 수 있음

### 9-3. 허리둘레는 왜 나왔는가

허리둘레는 설계서의 FINDRISC 8변수 중 하나라서 나왔습니다.

- FINDRISC #3 = 허리둘레
- 위험도 계산에 직접 연결됨

다만 현재 온보딩 질문 흐름에는 허리둘레 입력이 없으므로,
Phase 1에서는 온보딩에 억지로 넣지 말고 `PeriodicMeasurement`에서만 받는 것을 추천합니다.

추천 정책:
- Phase 1: 허리둘레는 `periodic_measurements`에서만 입력
- 온보딩에는 넣지 않음
- 사용자가 줄자 없이 바로 답하기 어렵기 때문

즉:
- 왜 필요하냐: 위험도 계산 변수라서
- 왜 온보딩에 안 넣냐: 사용성 저하가 크기 때문

### 9-4. 챌린지 10종 추천 확정안

Phase 1 추천 10종은 아래로 가는 것을 추천합니다.

1. `exercise_150_weekly`
   - 이름: 주 150분 운동
   - 카테고리: `exercise`
   - 기간: 7일
   - 조건: 주간 운동시간 150분 이상

2. `walk_after_meal`
   - 이름: 식후 산책
   - 카테고리: `exercise`
   - 기간: 7일
   - 조건: `walk=yes` 주 5회 이상

3. `breakfast_streak`
   - 이름: 아침 챙겨먹기
   - 카테고리: `diet`
   - 기간: 7일
   - 조건: `breakfast != none` 5일 이상

4. `vegetable_daily`
   - 이름: 매일 채소 먹기
   - 카테고리: `diet`
   - 기간: 7일
   - 조건: `veggie=yes` 5일 이상

5. `sweetdrink_zero`
   - 이름: 당음료 줄이기
   - 카테고리: `diet`
   - 기간: 7일
   - 조건: `sweetdrink=no` 6일 이상

6. `night_snack_zero`
   - 이름: 야식 끊기
   - 카테고리: `diet`
   - 기간: 7일
   - 조건: `nightsnack=no` 6일 이상

7. `sleep_before_11`
   - 이름: 11시 전 수면 루틴
   - 카테고리: `sleep`
   - 기간: 7일
   - 조건: 수면 관련 입력 기준 충족 5일 이상
   - 주의: 취침시각 필드가 없으면 Phase 1에서는 `sleep` 품질 기반 대체 운영

8. `sleep_quality_up`
   - 이름: 숙면 점수 올리기
   - 카테고리: `sleep`
   - 기간: 7일
   - 조건: `sleep in [great, good]` 5일 이상

9. `medication_check`
   - 이름: 복약 체크
   - 카테고리: `medication`
   - 기간: 7일
   - 조건: `took_medication=yes` 5일 이상
   - 대상: A그룹만 추천

10. `weight_log_weekly`
   - 이름: 주간 체중 기록
   - 카테고리: `weight`
   - 기간: 14일
   - 조건: 기간 내 체중 입력 2회 이상

추천 이유:
- 현재 수집 필드만으로 자동판정 가능해야 함
- 프론트 데모와 연결되기 쉬워야 함
- 위험도/대시보드와 연결되는 행동 위주여야 함
- A그룹 전용 복약 챌린지 1개는 반드시 포함하는 것이 좋음

### 9-5. 바로 구현용 결론

이 문서 기준으로는 아래를 추천 확정안으로 봐도 됩니다.

- `foodcomp`는 enum 고정
- `breakfast/lunch/dinner`는 4단계 유지
- 허리둘레는 Phase 1에서 주기측정 전용
- 챌린지는 위 10종으로 시작
