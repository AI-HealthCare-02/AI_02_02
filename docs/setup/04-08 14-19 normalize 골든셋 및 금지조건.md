# normalize 골든셋 및 금지조건

## 목적
- `_normalize_text()`를 우회 방어에 강하게 만들되
- 의료 수치/범위/단위 표현은 깨지지 않게 보호한다

## 구현 방식
1. zero-width 제거
2. NFKC 정규화
3. 숫자/범위/단위 토큰 placeholder 보호
4. 남은 텍스트에 구두점/우회 분리자 정리
5. placeholder 복원

## 보호 대상
- `6.5`
- `100-120`
- `6~7`
- `140/90`
- `95mg/dL`
- `140/90 mmHg`

## no-go
- crisis false negative 증가 금지
- idiom false positive 증가 금지
- medical question이 medical note/block으로 승격 금지
- 숫자/범위/단위 표현 route/safety 회귀 금지
- 원문 저장/표시 텍스트 변경 금지

## 산출물
- snapshot:
  - `backend/tests/unit/fixtures/normalize_golden.json`
- characterization test:
  - `backend/tests/unit/test_normalize_characterization.py`
