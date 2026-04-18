# 비당뇨 트랙 점수 설계 문서

## 1. 문서 목적

이 문서는 우리 프로젝트의 `비당뇨 트랙`에서 사용할 `0~100 위험 점수`와, 그 점수를 복원하는 `MLP 회귀 모델`의 설계 기준을 정리한 문서다.

핵심 목적은 두 가지다.

1. 사용자가 입력한 비침습 정보만으로 설명 가능한 위험 점수를 만든다.
2. 일부 문항이 비어 있거나 응답 품질이 들쭉날쭉한 상황에서도 점수를 안정적으로 추정할 수 있도록 회귀 모델을 둔다.

이 구조에서 중요한 점은 다음이다.

- 이 모델은 `질병 진단 모델`이 아니다.
- 이 모델은 `서비스용 위험 점수 추정·복원 모델`이다.
- 즉, 비당뇨 사용자에게 제공하는 생활습관 기반 리포트의 강건성을 높이기 위한 구조다.

## 2. 전체 설계 방향

비당뇨 트랙은 혈당, HbA1c, 중성지방처럼 의료기관 검사값이 없는 상황에서도 작동해야 한다. 따라서 사용자가 앱에서 직접 답할 수 있는 비침습 정보 중심으로 점수를 설계했다.

점수는 두 층으로 나눈다.

- `Core Score`
  - 의학적 근거가 강하고, 기존 선별도구에서도 반복적으로 쓰이는 요인
- `Lifestyle Score`
  - 서비스 개입 여지가 크고, 리포트 개인화에 직접 연결되는 요인

최종 점수는 아래처럼 계산한다.

```text
FinalScore = round(0.75 * CoreScore + 0.25 * LifestyleScore, 1)
```

이 비율을 둔 이유는 명확하다.

- 당뇨 위험도의 큰 축은 연령, 비만도, 가족력, 고혈압, 신체활동처럼 비교적 일관된 위험요인이 설명한다.
- 식습관, 수면, 흡연, 음주는 중요하지만 서비스적 개입 요인으로 보는 편이 더 자연스럽다.
- 그래서 `의학적 설명력은 Core에 더 크게 두고`, `서비스 차별화는 Lifestyle로 보정`하는 구조가 적절하다.

## 3. 현재 프로젝트에서 실제로 확보 가능한 입력

현재 코드와 서비스 입력 구조를 기준으로 비당뇨 트랙에서 활용 가능한 주요 컬럼은 아래와 같다.

- `age_range`
- `bmi`
- `family_history`
- `has_hypertension`
- `exercise_frequency`
- `diet_habits`
- `sleep_duration_bucket`
- `smoking_status`
- `alcohol_frequency`
- `gender`

관련 코드:

- [train_diabetic_track_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_diabetic_track_model.py)
- [backend/services/model_inference.py](/C:/PycharmProjects/DANAA_project/backend/services/model_inference.py)

## 4. 최종 채택 피처

### 4-1. 점수 공식에 직접 반영하는 피처

`Core Score`

- `age_bucket`
- `bmi`
- `family_history`
- `has_hypertension`
- `exercise_frequency`

`Lifestyle Score`

- `diet_risk`
- `sleep_duration_bucket`
- `smoking_status`
- `alcohol_frequency`

### 4-2. 회귀 모델 입력에 포함하는 피처

회귀 모델은 공식 점수를 더 안정적으로 복원해야 하므로, 공식 점수에 직접 들어가는 값 외에도 파생 변수를 함께 사용한다.

수치형:

- `age_midpoint`
- `bmi`
- `has_hypertension`
- `obesity_flag`
- `severe_obesity_flag`
- `family_history_flag`
- `inactivity_flag`
- `smoking_flag`
- `alcohol_risk_flag`
- `poor_sleep_flag`
- `diet_risk_flag`
- `lifestyle_burden_score`
- `bmi_age_interaction`

범주형:

- `dataset_source`
- `gender`
- `age_bucket`
- `family_history`
- `exercise_frequency`
- `sleep_duration_bucket`
- `diet_risk`
- `smoking_status`
- `alcohol_frequency`
- `bmi_class`

## 5. 성별(`gender`)을 이렇게 다루는 이유

성별은 당뇨 위험과 무관해서 빼는 것이 아니다. 실제로 성별에 따른 유병률, 비만 분포, 생활습관 패턴 차이는 존재한다. 다만 이번 설계에서는 `공식 점수`와 `모델 입력`을 분리해서 본다.

현재 원칙은 아래와 같다.

- `공식 점수`: 성별 가산점을 직접 두지 않음
- `모델 입력`: 성별을 포함함

이렇게 둔 이유는 다음과 같다.

1. 서비스 점수 공식은 최대한 단순하고 설명 가능해야 한다.
2. 성별을 공식에 직접 넣으려면 임신성 당뇨 병력, 복부비만 기준 차이, 폐경 여부처럼 추가 설명이 함께 필요해진다.
3. 현재 서비스 설문은 그런 임상 맥락까지 안정적으로 수집하지 못한다.
4. 따라서 `직접 점수 가산`은 보류하고, `MLP가 입력 패턴으로 학습`하게 두는 편이 현재 단계에서 더 타당하다.

즉, 성별을 무시하는 것이 아니라 `설명 가능한 공식에서는 절제하고`, `학습 모델에서는 활용`하는 구조다.

## 6. 전처리와 파생 변수

### 6-1. 전처리 원칙

서로 다른 공개 데이터셋을 하나의 서비스 입력 공간으로 맞추기 위해 다음 순서로 정렬한다.

1. 컬럼 이름을 서비스 기준 컬럼으로 통일한다.
2. 범주를 앱 설문 응답 기준으로 재매핑한다.
3. 결측과 불명확 응답은 `unknown` 또는 보수적 중간값으로 처리한다.
4. 최종적으로 같은 의미를 갖는 공통 피처 집합으로 병합한다.

예시:

- 나이 원본 값 -> `age_bucket`, `age_midpoint`
- BMI 연속값 -> `bmi`, `bmi_class`
- 운동 빈도 -> `exercise_frequency`
- 수면 시간 -> `sleep_duration_bucket`
- 식습관 -> `diet_risk`

여기서 중요한 점은 `원 데이터셋마다 없는 컬럼을 억지로 추정하지 않는다`는 것이다.  
없는 정보는 임의 생성 대신 `unknown`으로 남겨서, 이후 모델이 이를 하나의 응답 상태로 다루게 한다.

즉 전처리의 기본 원칙은 아래와 같다.

1. 의미가 같은 컬럼은 하나의 서비스 컬럼으로 통합한다.
2. 데이터셋에 실제로 없는 정보는 추정하지 않는다.
3. 결측은 먼저 `unknown` 범주나 결측값으로 보존한다.
4. 모델 파이프라인 단계에서 수치형/범주형에 맞는 방식으로 최종 보정한다.

### 6-2. 결측치 처리 원칙

현재 코드 기준 결측치 처리는 두 단계로 이루어진다.

#### 1) 데이터 정렬 단계

데이터셋마다 제공하지 않는 항목은 먼저 `unknown`으로 둔다.

예:

- NHIS에는 `family_history`, `exercise_frequency`, `sleep_duration_bucket`, `diet_risk`가 직접 없으므로 `unknown`
- BRFSS에는 `sleep_duration_bucket`, `fasting_glucose_range`, `bp_stage`, `waist_risk`가 직접 없으므로 `unknown`
- Mesra에는 `fasting_glucose_range`, `bp_stage`, `waist_risk`가 직접 없으므로 `unknown`

이렇게 하는 이유는 두 가지다.

1. 없는 정보를 임의 추정해 노이즈를 만들지 않기 위해서
2. 서비스 환경에서도 실제로 사용자가 미응답하는 상황이 있기 때문에, `unknown` 자체를 하나의 현실적인 입력 상태로 유지하기 위해서

#### 2) 모델 입력 단계

학습 파이프라인에서는 아래 규칙으로 최종 보정한다.

- 수치형 피처: `SimpleImputer(strategy="median")`
- 범주형 피처: `SimpleImputer(strategy="most_frequent")`
- 범주형 인코딩: `OneHotEncoder(handle_unknown="ignore")`

즉 결측 처리 구조는 아래처럼 요약할 수 있다.

```text
원시 결측 -> unknown 또는 NaN 보존 -> 모델 직전 imputer 적용
```

이 방식은 논문에서 특정 한 편을 그대로 복제한 것은 아니다.  
표형 데이터 기반 머신러닝에서 널리 쓰이는 안정적 전처리 규칙을, 우리 서비스 입력 구조에 맞게 적용한 엔지니어링 선택이다.

### 6-3. 이상치 처리 원칙

현재 코드에서 명시적으로 관리하는 대표 이상치는 `BMI`다.

처리 방식:

- BMI 계산 또는 변환 후 결측은 `dropna(subset=["bmi"])`
- BMI 값은 `10 <= bmi <= 80` 범위로 제한
- NHIS 쪽은 먼저 `between(10, 80)` 조건으로 비정상값을 제거
- 결합 데이터셋에서는 `clip(lower=10, upper=80)`로 최종 절단

이 기준은 임상 진단 기준이라기보다, 공개 데이터셋 결합 과정에서 발생할 수 있는 명백한 입력 오류와 극단값을 제거하기 위한 실무적 rule-based cleaning이다.

현재 단계에서 BMI 외의 변수는 별도 winsorizing, IQR trimming, z-score 제거 같은 강한 이상치 처리를 하지 않는다. 이유는 다음과 같다.

1. 대부분의 생활습관 변수는 이미 범주형으로 재매핑되어 있다.
2. 운동, 수면, 흡연, 음주 등은 극단 연속값보다 `범주 해석`이 중요하다.
3. 과도한 이상치 제거는 표본 수를 줄이고, 서비스 입력과 동떨어진 모델을 만들 수 있다.

### 6-4. 파생 변수 정의

- `obesity_flag`
  - BMI 25 이상 여부
- `severe_obesity_flag`
  - BMI 30 이상 여부
- `family_history_flag`
  - 가족력 존재 여부
- `inactivity_flag`
  - 운동이 거의 없는 상태 여부
- `smoking_flag`
  - 현재 흡연 여부
- `alcohol_risk_flag`
  - 잦은 음주 여부
- `poor_sleep_flag`
  - 짧은 수면 또는 과도한 수면 여부
- `diet_risk_flag`
  - 고위험 식습관 여부
- `lifestyle_burden_score`
  - 여러 생활습관 위험 신호의 단순 합
- `bmi_age_interaction`
  - BMI와 연령이 함께 높을 때의 누적 부담을 반영하는 상호작용 변수

### 6-5. 파생 변수를 쓰는 이유

파생 변수는 공식을 복잡하게 만들기 위한 것이 아니다. 공식은 단순하게 유지하고, 회귀 모델이 입력 패턴을 더 잘 복원하도록 돕기 위한 장치다.

즉:

- `공식 점수`는 설명 가능성 중심
- `MLP 입력`은 복원 안정성 중심

### 6-6. 파생변수별 근거 수준과 설계 이유

파생변수는 모두 같은 종류가 아니다.  
이번 프로젝트에서는 아래 세 층으로 구분하는 것이 정확하다.

#### A. 외부 의학 근거를 단순화한 변수

아래 변수들은 새 개념을 만든 것이 아니라, 기존 위험요인을 모델이 쓰기 쉬운 형태로 단순화한 것이다.

`obesity_flag`

- 의미: BMI 25 이상 여부
- 근거 수준: 외부 의학 근거 기반
- 설명: 비만/과체중은 제2형 당뇨 위험 증가와 연결된다는 근거가 강하므로, 이를 이진 신호로 단순화해 사용

`severe_obesity_flag`

- 의미: BMI 30 이상 여부
- 근거 수준: 외부 의학 근거 기반
- 설명: 더 높은 비만 수준을 별도 위험 신호로 분리하면 BMI 연속값만 쓸 때보다 단계성이 분명해진다

`family_history_flag`

- 의미: 가족력 존재 여부
- 근거 수준: 외부 의학 근거 기반
- 설명: 가족력은 대표적인 선별 요인이므로, 범주형 응답을 이진화해 보조 입력으로 사용

`inactivity_flag`

- 의미: 운동이 거의 없는 상태
- 근거 수준: 외부 의학 근거 기반
- 설명: 신체활동 부족은 당뇨 위험요인이므로, 운동 빈도 범주를 저활동 여부로 축약

`smoking_flag`

- 의미: 현재 흡연 여부
- 근거 수준: 외부 의학 근거 기반
- 설명: 흡연 상태를 현재 위험 신호 중심으로 압축

`poor_sleep_flag`

- 의미: 짧은 수면 또는 질적으로 불리한 수면 구간 여부
- 근거 수준: 외부 의학 근거 기반
- 설명: 짧은 수면은 위험 증가와 관련되므로 수면 범주를 고위험 신호로 단순화

`diet_risk_flag`

- 의미: 고위험 식습관 여부
- 근거 수준: 외부 의학 근거 기반 + 서비스 해석 규칙
- 설명: 식습관은 공개 데이터셋마다 정의가 달라서, 최종적으로는 서비스형 `diet_risk` 범주를 다시 이진 고위험 신호로 표현

`alcohol_risk_flag`

- 의미: 잦은 음주 여부
- 근거 수준: 외부 근거 + 보수적 엔지니어링 규칙
- 설명: 음주는 용량반응이 단순하지 않으므로, 서비스에서는 빈번한 음주만 별도 위험 신호로 압축

#### B. 해석 가능한 부담 요약 변수

이 변수들은 위험요인을 새로 발명한 것이 아니라, 여러 위험 신호를 하나의 요약지표로 묶은 것이다.

`lifestyle_burden_score`

- 정의: `inactivity_flag + smoking_flag + alcohol_risk_flag + poor_sleep_flag + diet_risk_flag`
- 근거 수준: 내부 feature engineering
- 설명: 여러 생활습관 위험이 동시에 존재할수록 전반적 부담이 커진다는 직관을 반영한 합산 변수
- 주의: 이 값 자체가 임상 점수는 아니며, 회귀 모델이 복합 생활습관 패턴을 더 쉽게 학습하도록 돕는 입력 변수다

#### C. 상호작용을 반영하는 모델링 변수

`bmi_age_interaction`

- 정의: `bmi * age_midpoint`
- 근거 수준: 내부 feature engineering
- 설명: BMI와 연령은 각각 중요한 위험요인이며, 둘이 함께 높을 때 부담이 누적될 수 있다는 점을 모델에 전달하기 위한 상호작용 변수
- 주의: 특정 논문 한 편에서 동일 식을 그대로 가져온 것은 아니다. 위험요인의 동시 작용을 모델이 더 잘 잡도록 하기 위한 일반적 상호작용 설계다

### 6-7. 파생변수에 대한 문서 표현 원칙

발표나 문서에서는 아래처럼 구분해 쓰는 것이 안전하다.

- `연령, BMI, 가족력, 운동, 수면, 흡연, 음주`는 외부 의학 근거 기반 피처
- `flag`, `burden_score`, `interaction` 계열은 해당 위험요인을 서비스 입력 구조에 맞게 재표현한 내부 파생변수

즉, 파생변수 전부를 “논문에서 직접 가져왔다”고 말하면 과한 표현이다.  
정확한 설명은 아래에 가깝다.

> 파생변수는 검증된 위험요인을 서비스형 표 데이터에 맞게 재구성하고, 결측 상황에서도 모델이 점수를 안정적으로 복원하도록 설계한 내부 feature engineering입니다.

## 7. 피처 선정 근거

아래 링크는 모두 실제 자료 링크다.

### 7-1. 연령

연령 증가는 제2형 당뇨 위험 증가와 직접 연결된다. 미국 CDC의 Prediabetes Risk Test와 NIDDK 자료 모두 연령을 핵심 위험요인으로 다룬다.

- CDC, About the Prediabetes Risk Test  
  https://www.cdc.gov/diabetes/takethetest/about-the-test.html
- NIDDK, Risk Factors for Type 2 Diabetes  
  https://www.niddk.nih.gov/health-information/diabetes/overview/risk-factors-type-2-diabetes

### 7-2. BMI

과체중과 비만은 제2형 당뇨 발생 위험과 매우 강하게 연결된다. NIDDK는 BMI를 대표 위험요인으로 제시하고, 아시아계에서는 더 낮은 BMI 기준에서도 위험 증가 가능성을 언급한다.

- NIDDK, Risk Factors for Type 2 Diabetes  
  https://www.niddk.nih.gov/health-information/diabetes/overview/risk-factors-type-2-diabetes
- NIDDK, Risk Factors for Diabetes / Prediabetes Screening  
  https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/diabetes/game-plan-preventing-type-2-diabetes/prediabetes-screening-how-why/risk-factors-diabetes

### 7-3. 가족력

가족력은 선별도구에서 지속적으로 사용되는 대표 요인이다. 유전적 소인과 가정 내 생활환경이 함께 반영된 변수로 볼 수 있다.

- CDC, About the Prediabetes Risk Test  
  https://www.cdc.gov/diabetes/takethetest/about-the-test.html

### 7-4. 고혈압

고혈압 또는 고혈압 치료 이력은 대사질환 위험군 선별에서 흔히 쓰이는 공존 질환 변수다.

- NIDDK, Risk Factors for Diabetes / Prediabetes Screening  
  https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/diabetes/game-plan-preventing-type-2-diabetes/prediabetes-screening-how-why/risk-factors-diabetes

### 7-5. 신체활동

신체활동 부족은 체중, 인슐린 저항성, 대사 건강 전반과 연결되므로 당뇨 위험 평가에서 중요한 생활 요인이다. CDC 위험 테스트에서도 운동 부족을 직접 묻는다.

- CDC, About the Prediabetes Risk Test  
  https://www.cdc.gov/diabetes/takethetest/about-the-test.html

### 7-6. 수면

짧은 수면과 과도한 수면 모두 제2형 당뇨 위험 증가와 연관된다는 코호트 및 리뷰 근거가 있다. 따라서 수면은 생활습관 점수에서 반영할 가치가 있다.

- Sleep duration and incidence of type 2 diabetes: the Multiethnic Cohort  
  https://pubmed.ncbi.nlm.nih.gov/29332675/
- Total Sleep Duration and Risk of Type 2 Diabetes: Evidence-Based On Clinical and Epidemiological Studies  
  https://pubmed.ncbi.nlm.nih.gov/29956620/

### 7-7. 흡연

흡연은 제2형 당뇨 발생 위험 증가와 관련된다는 메타분석이 있다. 따라서 생활습관 위험 항목으로 포함할 근거가 충분하다.

- Active Smoking and the Risk of Type 2 Diabetes: A Systematic Review and Meta-analysis  
  https://jamanetwork.com/journals/jama/fullarticle/209729
- Relation of active, passive, and quitting smoking with incident type 2 diabetes: a systematic review and meta-analysis  
  https://pubmed.ncbi.nlm.nih.gov/26388413/

### 7-8. 음주

음주와 당뇨 위험의 관계는 단순 직선형이 아니라 용량반응과 BMI, 성별에 따라 달라질 수 있다. 그래서 이번 설계에서는 큰 가중치를 주지 않고 보정 항목으로만 사용한다.

- Alcohol Consumption and the Risk of Type 2 Diabetes: A Systematic Review and Dose-Response Meta-analysis of More Than 1.9 Million Individuals From 38 Observational Studies  
  https://pubmed.ncbi.nlm.nih.gov/26294775/
- The Relationship Between Alcohol Consumption, BMI, and Type 2 Diabetes: A Systematic Review and Dose-Response Meta-analysis  
  https://pubmed.ncbi.nlm.nih.gov/37890103/

## 8. 점수 공식 초안

모든 하위 위험도는 `0~1` 범위로 매핑한 뒤 합산한다.

### 8-1. Core Score

```text
CoreScore = 100 * (
  0.30 * AgeRisk +
  0.30 * BmiRisk +
  0.15 * FamilyRisk +
  0.15 * HypertensionRisk +
  0.10 * InactivityRisk
)
```

`AgeRisk`

- `under_45` = `0.00`
- `45_54` = `0.33`
- `55_64` = `0.67`
- `65_plus` = `1.00`

`BmiRisk`

- `bmi < 23` = `0.00`
- `23 <= bmi < 25` = `0.33`
- `25 <= bmi < 30` = `0.67`
- `bmi >= 30` = `1.00`

`FamilyRisk`

- `none` = `0.00`
- `parents`, `siblings`, `both` = `1.00`
- `unknown` = `0.00`

`HypertensionRisk`

- `False` = `0.00`
- `True` = `1.00`

`InactivityRisk`

- `5_plus_per_week` = `0.00`
- `3_4_per_week` = `0.25`
- `1_2_per_week` = `0.60`
- `none` = `1.00`
- `unknown` = `0.50`

### 8-2. Lifestyle Score

```text
LifestyleScore = 100 * (
  0.40 * DietRisk +
  0.30 * SleepRisk +
  0.20 * SmokingRisk +
  0.10 * AlcoholRisk
)
```

`DietRisk`

- `supportive` = `0.00`
- `moderate_risk` = `0.50`
- `high_risk` = `1.00`
- `unknown` = `0.40`

`SleepRisk`

- `between_7_8` = `0.00`
- `between_6_7` = `0.25`
- `over_8` = `0.30`
- `between_5_6` = `0.70`
- `under_5` = `1.00`
- `unknown` = `0.40`

`SmokingRisk`

- `non_smoker` = `0.00`
- `former` = `0.40`
- `current` = `1.00`
- `unknown` = `0.30`

`AlcoholRisk`

- `none` = `0.00`
- `sometimes` = `0.25`
- `often` = `0.60`
- `daily` = `1.00`
- `unknown` = `0.20`

### 8-3. Final Score

```text
FinalScore = round(0.75 * CoreScore + 0.25 * LifestyleScore, 1)
```

## 9. 위험 구간

- `0~24`: 낮음
- `25~49`: 주의
- `50~74`: 높음
- `75~100`: 매우 높음

주의할 점:

- 이 구간은 의료 진단 기준이 아니다.
- 서비스형 위험 커뮤니케이션 구간이다.
- 발표나 문서에서는 `진단` 대신 `위험 추정`, `우선 개입 필요도`, `생활습관 개선 우선순위`라는 표현을 써야 한다.

## 10. 회귀 모델 연결 방식

비당뇨 트랙 회귀 모델은 아래 순서로 학습한다.

1. 공개 데이터셋을 서비스 피처 체계로 정렬한다.
2. 위 공식으로 각 행의 `non_diabetic_risk_score`를 생성한다.
3. 생성된 점수를 타깃으로 `MLPRegressor`를 학습한다.
4. 같은 입력으로 `CatBoostRegressor`도 함께 학습해 비교 기준을 확보한다.

## 11. 모델 선택 방향

현재 프로젝트의 채택 방향은 아래와 같다.

- 주모델: `MLPRegressor`
- 비교 기준: `CatBoostRegressor`

이유는 다음과 같다.

1. 현재 실험에서 두 모델 모두 점수 복원 성능은 매우 높다.
2. `MLP`는 향후 자체 서비스 데이터가 누적될수록 더 복합적인 패턴을 흡수할 여지가 있다.
3. 우리 프로젝트의 장기 핵심은 공개 데이터 복제보다 `우리 서비스 데이터 축적`에 있다.
4. 따라서 단기적으로 약간의 보수성을 잃더라도, 장기 확장성을 보고 `MLP`를 주모델로 가져가는 전략이 일관된다.

단, 현재 단계에서는 `CatBoost`를 완전히 버리지 않는다. 비교 기준 모델로 유지하면서 실제 서비스 데이터가 쌓였을 때 재평가한다.

## 12. 해석 원칙

이 설계는 `당뇨 진단 예측`이 아니라 `비당뇨 사용자용 위험 점수 복원`이다.

따라서 높은 R²는 아래 뜻으로 해석해야 한다.

- 모델이 실제 질병 발생을 거의 완벽하게 맞혔다
- 가 아니라,
- 모델이 우리가 정의한 서비스 점수 공식을 매우 안정적으로 재현했다

발표에서는 아래 문장을 그대로 써도 된다.

> 본 회귀 모델은 질병 자체를 진단하는 모델이 아니라, 비당뇨 사용자에게 제공되는 서비스형 위험 점수를 일부 결측 상황에서도 안정적으로 추정하기 위한 보조 모델입니다.

## 13. 구현 위치

- 점수 회귀 실험 스크립트: [train_non_diabetic_score_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_non_diabetic_score_model.py)
- 공통 데이터 정렬 및 당뇨 트랙 학습 스크립트: [train_diabetic_track_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_diabetic_track_model.py)
- 추론 서비스: [backend/services/model_inference.py](/C:/PycharmProjects/DANAA_project/backend/services/model_inference.py)
- 리포트 결합 로직: [backend/services/risk_analysis.py](/C:/PycharmProjects/DANAA_project/backend/services/risk_analysis.py)

## 14. 한 줄 정리

비당뇨 트랙은 `설명 가능한 위험 점수 공식 + 그 점수를 복원하는 MLP 보조 모델` 구조로 가져간다.
