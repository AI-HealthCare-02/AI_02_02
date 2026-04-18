# 당뇨 트랙 모델 가이드

## 1. 이 모델은 무엇인가

당뇨 트랙 모델은 `당뇨` 또는 `전당뇨` 사용자에게서 현재 관리 필요도가 얼마나 높은지를 분류하는 모델이다.

이 모델의 역할은 아래에 가깝다.

- 관리 우선순위 분류
- 생활습관 개입 필요도 판별
- 추가 측정 및 상담 유도

이 모델은 아래와는 다르다.

- 확진 진단 모델
- 장기 합병증 예후 예측 모델

즉, `의료 진단`보다는 `서비스형 관리 우선순위 분류기`로 이해하는 것이 맞다.

## 2. 왜 CatBoost를 유지하나

현재 당뇨 트랙에서는 `CatBoost 분류 모델`을 유지한다.

이유는 다음과 같다.

1. 범주형 피처가 많다.
2. NHIS에서 변환한 위험 구간 피처와 서비스 설문 피처가 섞여 있다.
3. 현재 실험에서 MLP보다 CatBoost가 더 안정적인 ROC-AUC와 F1을 보였다.
4. 당뇨 트랙은 장기 확장성보다 당장 서비스 적용 안정성이 더 중요하다.

즉, 비당뇨 트랙은 장기 확장성을 보고 `MLP`를 채택했지만, 당뇨 트랙은 현재 시점 성능과 안정성을 보고 `CatBoost`를 유지하는 전략이다.

## 3. 어떤 데이터를 쓰나

주요 데이터 원천:

- NHIS 2024 건강검진 데이터
- Mesra 2019

설계 포인트는 `공단 데이터를 버리지 않고 서비스형 피처로 변환했다`는 점이다.

예를 들면:

- 공복혈당 수치 -> `fasting_glucose_range`
- 혈압 수치 -> `bp_stage`
- 허리둘레 -> `waist_risk`

즉, 병원 검사값을 그대로 모델에 밀어 넣는 것이 아니라, 서비스에서도 설명 가능한 위험 구간으로 바꿔 사용했다.

## 4. 주요 입력 피처

수치형:

- `age_midpoint`
- `bmi`
- `has_hypertension`
- `glucose_risk_flag`
- `bp_stage_flag`
- `obesity_flag`
- `severe_obesity_flag`
- `family_history_flag`
- `inactivity_flag`
- `smoking_flag`
- `alcohol_risk_flag`
- `poor_sleep_flag`
- `diet_risk_flag`
- `waist_risk_flag`
- `lifestyle_burden_score`
- `metabolic_burden_score`
- `bmi_age_interaction`
- `htn_obesity_interaction`

범주형:

- `dataset_source`
- `track_relation`
- `gender`
- `age_bucket`
- `family_history`
- `exercise_frequency`
- `sleep_duration_bucket`
- `diet_risk`
- `smoking_status`
- `alcohol_frequency`
- `bmi_class`
- `fasting_glucose_range`
- `bp_stage`
- `waist_risk`

## 5. 전처리, 결측치, 이상치 처리

당뇨 트랙도 비당뇨 트랙과 같은 원칙을 공유한다. 다만 당뇨 트랙은 혈당, 혈압, 허리둘레처럼 직접 위험 신호가 되는 측정 기반 피처가 추가된다.

### 5-1. 결측치 처리

데이터셋마다 없는 컬럼은 먼저 `unknown`으로 둔다.

예:

- BRFSS와 Mesra에 직접 없는 `fasting_glucose_range`, `bp_stage`, `waist_risk`는 `unknown`
- NHIS에 직접 없는 일부 생활습관 컬럼은 `unknown`

그 다음 모델 입력 단계에서 아래 규칙을 적용한다.

- 수치형: `median imputation`
- 범주형: `most_frequent imputation`
- 범주형 인코딩: `handle_unknown="ignore"`

즉, 당뇨 트랙도 “없는 정보는 먼저 `unknown`으로 남기고, 모델 직전 안정적으로 보정한다”는 구조다.

### 5-2. 이상치 처리

당뇨 트랙에서도 BMI는 명시적으로 정리한다.

- BMI 결측은 제외
- BMI는 `10~80` 범위로 제한

나머지 측정값은 대부분 위험 구간으로 재매핑되기 때문에, 연속형 극단값을 직접 다루기보다 `구간화`로 흡수하는 방식에 가깝다.

예:

- 공복혈당 수치 -> `under_100`, `100_to_125`, `over_126`
- 혈압 수치 -> `normal`, `elevated`, `stage1`, `stage2`

즉 당뇨 트랙의 이상치 완화는 강한 trimming보다 `의미 있는 위험 구간 변환`을 중심으로 한다.

### 5-3. 파생변수의 성격

당뇨 트랙의 파생변수도 두 종류로 나뉜다.

1. 기존 위험요인의 단순화
- `obesity_flag`
- `severe_obesity_flag`
- `family_history_flag`
- `inactivity_flag`
- `smoking_flag`
- `alcohol_risk_flag`
- `poor_sleep_flag`
- `diet_risk_flag`
- `waist_risk_flag`
- `glucose_risk_flag`
- `bp_stage_flag`

2. 복합 부담을 요약하는 내부 설계 변수
- `lifestyle_burden_score`
- `metabolic_burden_score`
- `bmi_age_interaction`
- `htn_obesity_interaction`

즉, 당뇨 트랙에서도 파생변수는 “새로운 임상 변수”라기보다, 기존 위험 신호를 서비스형 표 데이터에 맞게 재구성한 내부 feature engineering으로 보는 것이 맞다.

## 6. 현재 결과를 어떻게 해석해야 하나

현재 메타데이터 기준 주요 테스트 성능은 대략 아래 수준이다.

- ROC-AUC: `0.9763`
- F1: `0.8806`

하지만 이 수치를 `임상 예측이 거의 완벽하다`고 해석하면 안 된다.

이 모델의 타깃은 실제 임상 outcome이 아니라 `관리 필요도 proxy label`이다. 따라서 올바른 해석은 아래다.

- 누가 더 관리가 필요한지 잘 가른다
- 생활습관 코칭과 follow-up 우선순위를 정하는 데 의미가 있다

## 7. 발표에서 쓰기 좋은 설명

> 당뇨 트랙은 당뇨 및 전당뇨 사용자의 혈당·혈압·복부비만 등 위험 구간과 생활습관 신호를 함께 반영해, 현재 관리 우선순위를 분류하는 CatBoost 기반 모델입니다.

## 8. 관련 파일

- 학습 스크립트: [train_diabetic_track_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_diabetic_track_model.py)
- 추론 서비스: [model_inference.py](/C:/PycharmProjects/DANAA_project/backend/services/model_inference.py)
- 산출물 폴더: [tools/ml_artifacts/diabetic_track](/C:/PycharmProjects/DANAA_project/tools/ml_artifacts/diabetic_track)
