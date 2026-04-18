# 비당뇨 트랙 점수 회귀 실험 결과

## 1. 실험 목적

이번 실험의 목적은 기존 비당뇨 트랙의 이진 분류 프레임을 그대로 유지하는 대신, 서비스용 `0~100 위험 점수`를 타깃으로 두었을 때 회귀 모델이 점수를 얼마나 안정적으로 복원할 수 있는지 확인하는 것이다.

중요한 해석 원칙은 아래와 같다.

- 이 실험은 `당뇨 진단 예측 성능`을 측정하는 실험이 아니다.
- 이 실험은 `우리 서비스 점수 체계를 얼마나 안정적으로 복원하느냐`를 보는 실험이다.
- 따라서 이 모델의 역할은 `점수 추정·보정`이다.

## 2. 비교한 모델

- `MLPRegressor`
- `CatBoostRegressor`

실험 스크립트:

- [train_non_diabetic_score_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_non_diabetic_score_model.py)

## 3. 데이터셋 구성

- 원천 데이터:
  - NHIS 2024
  - BRFSS 2015
  - Mesra 2019
- 위 데이터셋을 서비스 입력 피처 체계로 정렬한 뒤, 비당뇨 트랙 점수 공식으로 `non_diabetic_risk_score`를 생성했다.
- 학습에 사용한 행 수: `120,000`

## 4. 사용 피처

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

## 5. 타깃 점수 공식

```text
FinalScore = 0.75 * CoreScore + 0.25 * LifestyleScore
```

`Core Score` 내부 가중치:

- `age_risk`: `0.30`
- `bmi_risk`: `0.30`
- `family_risk`: `0.15`
- `hypertension_risk`: `0.15`
- `inactivity_risk`: `0.10`

`Lifestyle Score` 내부 가중치:

- `diet_risk`: `0.40`
- `sleep_risk`: `0.30`
- `smoking_risk`: `0.20`
- `alcohol_risk`: `0.10`

## 6. 결과 요약

### Validation

`MLPRegressor`

- MAE: `0.0464`
- RMSE: `0.1820`
- R²: `0.9998`

`CatBoostRegressor`

- MAE: `0.1354`
- RMSE: `0.2068`
- R²: `0.9997`

### Test

`MLPRegressor`

- MAE: `0.0479`
- RMSE: `0.2397`
- R²: `0.9997`

`CatBoostRegressor`

- MAE: `0.1361`
- RMSE: `0.2045`
- R²: `0.9998`

## 7. 결과 해석

해석은 이렇게 해야 한다.

1. `MLP`는 검증셋에서 더 낮은 MAE, RMSE를 보였다.
2. `CatBoost`는 테스트셋 RMSE가 약간 더 낮았다.
3. 두 모델의 차이는 매우 크지 않다.
4. 둘 다 점수 복원 자체는 충분히 가능하다는 신호를 준다.

다만 이 수치는 `질병 발생을 얼마나 잘 맞히는가`가 아니라, `우리가 만든 점수 공식을 얼마나 잘 따라가느냐`에 더 가깝다.

즉, 여기서 높은 R²는 다음 의미다.

- 좋은 해석: 점수 체계 복원력이 높다.
- 잘못된 해석: 실제 당뇨 진단 성능이 거의 완벽하다.

후자는 틀린 해석이다.

## 8. 왜 이 실험이 의미가 있는가

이 실험의 가치는 `예측 모델 자랑`보다 `서비스 강건성 확보`에 있다.

핵심은 아래다.

- 사용자가 설문을 일부 비워도 점수를 복원할 수 있다.
- 응답 품질이 다소 불완전해도 점수 체계를 유지할 수 있다.
- 리포트에서 위험도 설명이 갑자기 깨지지 않는다.

즉, 이 모델은 `진단 모델`이라기보다 `점수 복원기`에 가깝다.

## 9. 현재 프로젝트 의사결정

현재 프로젝트 방향은 아래처럼 정리하는 것이 적절하다.

- 주모델: `MLPRegressor`
- 비교 기준: `CatBoostRegressor`

이렇게 두는 이유:

1. 멀티레이어 퍼셉트론 구조가 향후 자체 서비스 데이터 축적 시 확장성이 더 크다.
2. 현재 실험에서 성능 차이가 결정적으로 벌어지지 않았다.
3. 우리 프로젝트 핵심은 장기적으로 `우리만의 사용자 데이터`를 반영하는 것이다.
4. 따라서 단기 안정성만 보면 CatBoost도 강하지만, 전략적 방향성은 `MLP 우선`이 더 일관된다.

정리하면:

- `지금 당장 절대 우월한 모델`을 주장하는 것이 아니라
- `현재도 충분히 가능한 MLP를 먼저 채택하고, CatBoost를 비교 기준으로 유지`하는 전략이다.

## 10. 발표/면접용 설명 문장

아래 문장으로 설명하는 것이 가장 안전하다.

> 본 회귀 모델은 질병 자체를 예측하는 모델이 아니라, 비당뇨 사용자에게 제공되는 서비스형 위험 점수를 일부 결측 상황에서도 안정적으로 추정하기 위한 보조 모델입니다.

추가로 이렇게 이어서 설명할 수 있다.

> 현재는 공개 데이터 기반으로 설계 점수를 복원하는 단계이며, 향후 자체 사용자 데이터가 축적되면 MLP 기반 구조가 더 다양한 응답 패턴과 결측 상황을 학습할 수 있도록 확장할 계획입니다.

## 11. 주의사항

- 이번 실험의 타깃은 실제 임상 outcome이 아니라 서비스형 점수다.
- 입력 피처와 점수 공식이 상당 부분 연결되어 있으므로, 높은 수치를 `공식 재현력`으로 해석해야 한다.
- 발표 자료에서는 `진단`, `확진`, `발병 예측 정확도` 같은 표현을 쓰지 않는 편이 안전하다.

## 12. 산출물

- 데이터셋 스냅샷: [score_regression_dataset.csv](/C:/PycharmProjects/DANAA_project/tools/ml_artifacts/non_diabetic_track/score_regression_dataset.csv)
- 실험 리포트: [score_regression_report.md](/C:/PycharmProjects/DANAA_project/tools/ml_artifacts/non_diabetic_track/score_regression_report.md)
- 메타데이터: [metadata.json](/C:/PycharmProjects/DANAA_project/tools/ml_artifacts/non_diabetic_track/metadata.json)
