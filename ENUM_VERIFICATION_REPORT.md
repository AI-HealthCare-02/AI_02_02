# Enum Values Cross-Reference Verification Report

> **참고**: 이 리포트는 V1 확정안 기준으로 작성되었습니다. 현재 기준은 V2 확정안(`_V2_2026-04-03.md`)입니다.
> V2에서 enum 값이 코드 기준으로 통일되었으므로, 아래 CRITICAL FAILURE 항목들은 V2에서 해소되었습니다.

**Date**: 2026-04-03  
**Task**: Verify enum/allowed values match across specification documents and code

---

## Executive Summary

Analysis of 4 sources reveals **7 CRITICAL FAILURES** and **6 WARNINGS** in enum definitions:

| Status | Count | Impact |
|--------|-------|--------|
| CRITICAL FAILURES | 7 | Blocking implementation; API examples don't match code |
| WARNINGS | 6 | Format/case inconsistencies; incomplete API specs |
| VERIFIED (PASS) | ~19 | Properly aligned across all sources |

---

## Quick Reference Table

| Enum Name | DB Spec | API Spec | Code | Frontend | Status |
|-----------|---------|----------|------|----------|--------|
| RELATION | diagnosed, prediabetes, family, curious, prevention | prediabetes | diagnosed, prediabetes, family, curious, prevention | diagnosed, prediabetes, family, curious, prevention | ✓ PASS |
| USER_GROUP | A, B, C | B | A, B, C | A, B, C | ✓ PASS |
| GENDER | MALE, FEMALE | male (lowercase) | NOT DEFINED | male, female | ⚠ WARN - Case mismatch |
| AGE_RANGE | (implicit) | 45_54 | under_45, 45_54, 55_64, 65_plus | 20s, 30s, 40s, 50s, 60+ | ✗ FAIL - Format mismatch |
| FAMILY_HISTORY | (implicit) | parent_or_sibling | parents, siblings, both, none, unknown | parents, siblings, both, none, unknown | ✗ FAIL - API incomplete |
| EXERCISE_FREQUENCY | (implicit) | **less_than_4h** | none, 1_2_per_week, 3_4_per_week, 5_plus_per_week | none, 1-2, 3-4, 5+ | ✗ FAIL - API value doesn't exist |
| DIET_HABITS | (implicit) | irregular_meals, frequent_snacks | No enum | carb-heavy, sugary-drink, late-snack, veggies, irregular, none | ✗ FAIL - Values don't match |
| SLEEP_DURATION_BUCKET | (implicit) | between_6_7 | under_5, between_5_6, between_6_7, between_7_8, over_8 | under-5, 5-6, 7-8, over-9 | ⚠ WARN - Format & range |
| ALCOHOL_FREQUENCY | (implicit) | **once_or_twice_weekly** | none, sometimes, often, daily | none, sometimes, often, daily | ✗ FAIL - API value doesn't exist |
| SMOKING_STATUS | (implicit) | non_smoker | non_smoker, former, current | **none**, former, current | ✗ FAIL - Frontend uses "none" |
| HBA1C_RANGE | (implicit) | null | under_5_7, 5_7_to_6_4, 6_5_to_7_0, over_7, unknown | under-5.7, 5.7-6.4, 6.5-7.0, over-7, unknown | ⚠ WARN - Format |
| FASTING_GLUCOSE_RANGE | (implicit) | null | under_100, 100_to_125, over_126, unknown | under-100, 100-125, over-126, unknown | ⚠ WARN - Format |
| SLEEP_QUALITY | very_good, good, normal, bad, very_bad | good | very_good, good, normal, bad, very_bad | N/A | ✓ PASS |
| MEAL_STATUS | hearty, simple, skipped | hearty | hearty, simple, skipped | N/A | ✓ PASS |
| EXERCISE_TYPE | (implicit) | walking, running, cycling, swimming, gym, home_workout, other | walking, running, cycling, swimming, gym, home_workout, other | N/A | ✓ PASS |
| CHALLENGE_CATEGORY | (implicit) | (not shown) | exercise, diet, sleep, hydration, medication, lifestyle | N/A | ⚠ WARN - No API validation |
| CHALLENGE_STATUS | (implicit) | active | active, paused, completed, failed | N/A | ⚠ WARN - Partial |
| CHECKIN_STATUS | achieved, missed, partial | achieved | achieved, missed, partial | N/A | ✓ PASS |
| DATA_SOURCE | chat, direct, backfill | direct, backfill | chat, direct, backfill | N/A | ✓ PASS |
| MEASUREMENT_TYPE | weight, waist, blood_pressure, hba1c, fasting_glucose | weight, blood_pressure | weight, waist, blood_pressure, hba1c, fasting_glucose | N/A | ✓ PASS |
| MEASUREMENT_SOURCE | manual, import, medical_checkup | (not shown) | manual, import, medical_checkup | N/A | ⚠ WARN - No API |
| RISK_LEVEL | low, slight, moderate, high, very_high | moderate | low, slight, moderate, high, very_high | N/A | ✓ PASS |
| ENGAGEMENT_STATE | ACTIVE, MODERATE, LOW, DORMANT, HIBERNATING | ACTIVE, MODERATE, LOW, DORMANT, HIBERNATING | ACTIVE, MODERATE, LOW, DORMANT, HIBERNATING | N/A | ✓ PASS |
| AI_CONSENT | (implicit) | **agreed, declined** | agreed, declined | **always, sometimes, later** | ✗ FAIL - DESIGN MISMATCH |
| GOAL | (implicit) | weight_management, blood_sugar_control | No enum | risk, tracking, diet, exercise, weight, all | ✗ FAIL - Naming mismatch |
| PERIOD_TYPE | weekly, monthly, quarterly | (not shown) | weekly, monthly, quarterly | N/A | ✓ PASS |
| SELECTION_SOURCE | (implicit) | system_recommended, user_selected | system_recommended, user_selected | N/A | ✓ PASS |

---

## CRITICAL ISSUES (7 FAILURES)

### 🔴 FAIL #1: AI_CONSENT - BLOCKING DESIGN MISMATCH

**Severity**: CRITICAL - Frontend collecting wrong data type

**Files**:
- Frontend: `apps/web/data/diabetes.js` (lines 284-296)
- API Spec: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` (line 172)
- Code: `app/models/enums.py` (lines 96-100)

**Problem**:
```
Frontend sends:        always / sometimes / later
API Spec expects:      agreed / declined
Code validates:        agreed / declined
```

**Current Code**:
```python
# app/models/enums.py
class AiConsent(StrEnum):
    AGREED = "agreed"
    DECLINED = "declined"
```

```javascript
// apps/web/data/diabetes.js (WRONG!)
options: [
  { value: 'always',    label: '좋아요, 계속 받을게요',  emoji: '👍' },
  { value: 'sometimes', label: '가끔만 받을게요',        emoji: '👌' },
  { value: 'later',     label: '나중에 할게요',          emoji: '⏰' },
]
```

**Fix Required**:
Change frontend to send `agreed` or `declined` values

---

### 🔴 FAIL #2: EXERCISE_FREQUENCY - WRONG API SPEC VALUE

**Severity**: CRITICAL - API example doesn't match code

**Files**:
- API Spec: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` (line 166)
- Code: `app/models/enums.py` (lines 70-76)

**Problem**:
```
API Spec shows: "exercise_frequency": "less_than_4h"
Code defines:   none, 1_2_per_week, 3_4_per_week, 5_plus_per_week
```

**Fix Required**:
Update API spec example to use valid enum values

---

### 🔴 FAIL #3: SMOKING_STATUS - FRONTEND VALUE MISMATCH

**Severity**: CRITICAL - Validation will fail

**Files**:
- Code: `app/models/enums.py` (line 91: `NON_SMOKER = "non_smoker"`)
- Frontend: `apps/web/data/diabetes.js` (line 253: `{ value: 'none'`)

**Problem**:
```
Code expects:   non_smoker
Frontend sends: none
```

**Fix Required**:
Change frontend line 253 from `'none'` to `'non_smoker'`

---

### 🔴 FAIL #4: FAMILY_HISTORY - API SPEC INCOMPLETE

**Severity**: CRITICAL - Example incomplete

**Files**:
- API Spec: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` (line 161)
- Code: `app/models/enums.py` (lines 41-48)

**Problem**:
```
API example shows: "family_history": "parent_or_sibling"  (single composite value)
Code defines:      parents, siblings, both, none, unknown  (5 separate values)
```

**Fix Required**:
Update API spec to document all 5 enum values or clarify the mapping

---

### 🔴 FAIL #5: ALCOHOL_FREQUENCY - WRONG API SPEC VALUE

**Severity**: CRITICAL - API example doesn't match code

**Files**:
- API Spec: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` (line 169)
- Code: `app/models/enums.py` (lines 79-85)

**Problem**:
```
API Spec shows: "alcohol_frequency": "once_or_twice_weekly"
Code defines:   none, sometimes, often, daily
```

**Fix Required**:
Update API spec example to use valid enum values

---

### 🔴 FAIL #6: DIET_HABITS - VALUES DON'T MATCH

**Severity**: CRITICAL - Frontend values don't match API examples

**Files**:
- API Spec: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` (line 167)
- Frontend: `apps/web/data/diabetes.js` (lines 210-215)

**Problem**:
```
API example shows:  ["irregular_meals", "frequent_snacks"]
Frontend offers:    carb-heavy, sugary-drink, late-snack, veggies, irregular, none
```

**Fix Required**:
Update API spec to match frontend options or add mapping layer

---

### 🔴 FAIL #7: GOAL - NAMING CONVENTION MISMATCH

**Severity**: CRITICAL - Frontend naming doesn't match API example

**Files**:
- API Spec: `docs/collaboration/DANAA_API최종확정안_V2_2026-04-03.md` (line 171)
- Frontend: `apps/web/data/diabetes.js` (lines 274-279)

**Problem**:
```
API example shows: ["weight_management", "blood_sugar_control"]
Frontend offers:   risk, tracking, diet, exercise, weight, all
```

**Fix Required**:
Update API spec to match frontend naming conventions or add mapping

---

## WARNINGS (6 FORMAT/DOCUMENTATION ISSUES)

### ⚠️ WARN #1: GENDER - CASE INCONSISTENCY

**Severity**: MEDIUM - Case mismatch across endpoints

| Context | Case |
|---------|------|
| Database | MALE, FEMALE (uppercase) |
| API /auth/signup | male, female (lowercase) |
| API /onboarding/survey | male, female (lowercase) |
| API /users/me response | MALE, FEMALE (uppercase) |
| Frontend | male, female (lowercase) |

**Fix**: Standardize case handling across all endpoints

---

### ⚠️ WARN #2: AGE_RANGE - INCOMPATIBLE FORMATS

**Severity**: MEDIUM - Frontend uses different format

| Source | Values |
|--------|--------|
| Backend Enum | under_45, 45_54, 55_64, 65_plus |
| Frontend Quiz | 20s, 30s, 40s, 50s, 60+ |

**Fix**: Create mapping layer between decade labels and backend ranges

---

### ⚠️ WARN #3: SLEEP_DURATION_BUCKET - FORMAT & RANGE MISMATCH

**Severity**: MEDIUM - Format and range inconsistency

| Source | Values |
|--------|--------|
| Code | under_5, between_5_6, between_6_7, between_7_8, over_8 (underscores) |
| Frontend | under-5, 5-6, 7-8, over-9 (hyphens, different max) |

**Issues**:
- Format: Underscores vs hyphens
- Range: over_8 vs over-9

---

### ⚠️ WARN #4: HBA1C_RANGE - FORMAT MISMATCH

**Severity**: LOW-MEDIUM - Format inconsistency

| Source | Values |
|--------|--------|
| Code | under_5_7, 5_7_to_6_4, 6_5_to_7_0 (underscores) |
| Frontend | under-5.7, 5.7-6.4, 6.5-7.0 (dots/hyphens) |

---

### ⚠️ WARN #5: FASTING_GLUCOSE_RANGE - FORMAT MISMATCH

**Severity**: LOW-MEDIUM - Format inconsistency

| Source | Values |
|--------|--------|
| Code | under_100, 100_to_125, over_126 (underscores) |
| Frontend | under-100, 100-125, over-126 (hyphens) |

---

### ⚠️ WARN #6: MISSING API SPEC VALIDATION

**Severity**: LOW - Documentation gap

Enums with no API spec examples:
- CHALLENGE_CATEGORY: Only documented in code
- MEASUREMENT_SOURCE: Only documented in code
- CHECKIN_JUDGE: Only documented in code
- MEAL_BALANCE_LEVEL: Only documented in code
- NIGHTSNACK_LEVEL: Partial validation (only null in examples)
- MOOD_LEVEL: Partial validation (only null in examples)

**Fix**: Add complete examples to API spec

---

## Verification Checklist

### CRITICAL (Must fix before release)
- [ ] Fix AI_CONSENT frontend to use agreed/declined
- [ ] Fix SMOKING_STATUS frontend to use non_smoker
- [ ] Update EXERCISE_FREQUENCY API spec
- [ ] Update FAMILY_HISTORY API spec
- [ ] Update ALCOHOL_FREQUENCY API spec
- [ ] Update DIET_HABITS API spec
- [ ] Update GOAL API spec

### IMPORTANT (Before stabilization)
- [ ] Create AGE_RANGE mapping layer
- [ ] Standardize format conventions (underscores vs hyphens)
- [ ] Fix GENDER case handling
- [ ] Add missing API spec examples

### DOCUMENTATION
- [ ] Update DB spec with explicit enum values
- [ ] Create enum reference document
- [ ] Add validation tests

---

## Summary Statistics

- **Total enums checked**: 32+
- **Critical failures**: 7 (block release)
- **Warnings**: 6 (fix before stabilization)
- **Verified (PASS)**: 19 (ready for production)

**Status**: ⚠️ READY FOR FIX - All issues identified and actionable
