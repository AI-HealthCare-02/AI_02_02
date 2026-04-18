# DANAA 모델 구조 정리

이 문서는 현재 프로젝트에서 실제로 쓰는 모델 구조를 팀원이 빠르게 이해할 수 있게 정리한 요약 문서다.

## 1. 지금 최종 구조

현재 모델은 두 트랙으로 나뉜다.

1. `당뇨 트랙`
2. `비당뇨 트랙`

하지만 두 트랙이 같은 방식은 아니다.

### 당뇨 트랙

- 목적: 당뇨/전당뇨 사용자에게서 `관리 필요도`를 분류
- 모델 방식: `CatBoost 분류`
- 출력 해석: 관리 우선순위에 가까운 위험 확률

### 비당뇨 트랙

- 목적: 일반 사용자에게 `0~100 서비스형 위험 점수`를 제공
- 모델 방식: `MLP 회귀`
- 출력 해석: 진단 확률이 아니라 서비스 점수의 추정값

핵심 차이는 아래 한 줄로 정리된다.

> 당뇨 트랙은 `분류`, 비당뇨 트랙은 `점수 회귀`다.

## 2. 왜 이렇게 나눴나

### 당뇨 트랙은 왜 CatBoost 분류인가

당뇨/전당뇨 사용자는 이미 위험 신호가 더 강하다. 그래서 혈당 구간, 혈압 단계, 허리둘레 위험 같은 피처를 바탕으로 `누가 더 관리가 필요한지` 분류하는 구조가 맞다.

이 트랙에서는 현재 실험상 `CatBoost`가 가장 안정적으로 나왔고, 표형 데이터와 범주형 처리에도 잘 맞는다.

### 비당뇨 트랙은 왜 MLP 회귀인가

비당뇨 사용자는 검사값 없이도 서비스가 작동해야 한다. 그래서 연령, BMI, 가족력, 운동, 식습관, 수면, 흡연, 음주 같은 비침습 정보를 바탕으로 `설명 가능한 위험 점수`를 먼저 만들고, 그 점수를 `MLP`로 복원하는 구조가 더 잘 맞는다.

이 구조의 장점은 두 가지다.

- 설문 일부가 비어도 점수를 복원할 수 있다.
- 앞으로 우리 서비스 데이터가 쌓일수록 MLP가 더 복합적인 패턴을 흡수할 수 있다.

## 3. 각 트랙을 어떻게 설명하면 되는가

### 당뇨 트랙 설명 문장

> 당뇨 트랙은 진단받았거나 전당뇨 상태인 사용자에 대해, 현재 관리 우선순위를 분류하는 CatBoost 기반 위험 분류 모델입니다.

### 비당뇨 트랙 설명 문장

> 비당뇨 트랙은 비침습 설문 정보를 바탕으로 서비스형 위험 점수를 계산하고, 일부 결측 상황에서도 그 점수를 안정적으로 추정하기 위한 MLP 기반 점수 회귀 모델입니다.

## 4. 파일 구조

### 문서

- 전체 요약: [README.md](/C:/PycharmProjects/DANAA_project/docs/collaboration/model/README.md)
- 당뇨 트랙 상세: [DIABETIC_TRACK_MODEL_GUIDE.md](/C:/PycharmProjects/DANAA_project/docs/collaboration/model/design/DIABETIC_TRACK_MODEL_GUIDE.md)
- 비당뇨 점수 설계: [NON_DIABETIC_TRACK_SCORE_DESIGN.md](/C:/PycharmProjects/DANAA_project/docs/collaboration/model/design/NON_DIABETIC_TRACK_SCORE_DESIGN.md)
- 비당뇨 회귀 결과: [NON_DIABETIC_SCORE_REGRESSION_RESULTS.md](/C:/PycharmProjects/DANAA_project/docs/collaboration/model/design/NON_DIABETIC_SCORE_REGRESSION_RESULTS.md)

### 학습 스크립트

- 당뇨 트랙 학습: [train_diabetic_track_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_diabetic_track_model.py)
- 당뇨 트랙 ablation: [evaluate_diabetic_track_ablation.py](/C:/PycharmProjects/DANAA_project/scripts/ml/evaluate_diabetic_track_ablation.py)
- 비당뇨 점수 학습: [train_non_diabetic_score_model.py](/C:/PycharmProjects/DANAA_project/scripts/ml/train_non_diabetic_score_model.py)

### 런타임 산출물

- 당뇨 트랙: [tools/ml_artifacts/diabetic_track](/C:/PycharmProjects/DANAA_project/tools/ml_artifacts/diabetic_track)
- 비당뇨 트랙: [tools/ml_artifacts/non_diabetic_track](/C:/PycharmProjects/DANAA_project/tools/ml_artifacts/non_diabetic_track)

## 5. 정리하면서 제거한 것

이번 정리에서 아래는 정리 대상이었다.

- 구형 비당뇨 이진분류 산출물
- 챌린저용 개별 모델 파일들
- `two_track_project_models` 아래에 섞여 있던 혼합 산출물 구조
- `scripts/` 루트에 흩어져 있던 모델 학습 스크립트
- 실행 스크립트 폴더에 있던 참고용 노트북

즉, 지금은 `당뇨 = diabetic_track`, `비당뇨 = non_diabetic_track`으로 폴더 구조가 바로 읽히게 정리했다.
