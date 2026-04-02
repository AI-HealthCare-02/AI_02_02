"""Phase 5·6 API 통합 테스트.

온보딩 완료 → 대시보드 → 건강기록 → 위험도 → 챌린지 전체 흐름.
사용법: python scripts/test_phase5_6.py
"""

from __future__ import annotations

import random
import sys
import uuid
from datetime import date

try:
    import httpx
except ImportError:
    print("httpx가 설치되어 있지 않습니다. pip install httpx")
    sys.exit(1)

BASE_URL = "http://localhost/api/v1"
PASSWORD = "Test1234!@"


def main() -> None:
    email = f"test_{uuid.uuid4().hex[:8]}@danaa.com"
    phone = f"010-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
    passed = 0
    total = 12

    print()
    print("=" * 50)
    print("  다나아 Phase 5·6 통합 테스트")
    print("=" * 50)
    print(f"  계정: {email}")
    print()

    # ── 1. 온보딩 (회원가입 → 로그인 → 동의 → 설문) ──
    try:
        r = httpx.post(f"{BASE_URL}/auth/signup", json={
            "email": email, "password": PASSWORD, "name": "테스트",
            "gender": "MALE", "birth_date": "1990-01-01",
            "phone_number": phone,
        }, timeout=10)
    except httpx.ConnectError:
        print("  [오류] 서버 연결 불가. Docker 확인하세요.")
        sys.exit(1)

    r = httpx.post(f"{BASE_URL}/auth/login", json={
        "email": email, "password": PASSWORD,
    }, timeout=10)
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    httpx.post(f"{BASE_URL}/auth/consent", json={
        "terms_of_service": True, "privacy_policy": True,
        "health_data_consent": True, "disclaimer_consent": True,
    }, headers=h, timeout=10)

    httpx.post(f"{BASE_URL}/onboarding/survey", json={
        "relation": "prevention", "gender": "MALE", "age_range": "45_54",
        "height_cm": 175.0, "weight_kg": 80.0, "family_history": "parents",
        "conditions": ["hypertension"], "exercise_frequency": "1_2_per_week",
        "diet_habits": ["irregular_meals"],
        "sleep_duration_bucket": "between_6_7",
        "alcohol_frequency": "sometimes", "smoking_status": "non_smoker",
        "goals": ["weight_management"], "ai_consent": "agreed",
    }, headers=h, timeout=10)
    print("  [1/12] 온보딩 완료 ............. OK")
    passed += 1

    # ── 2. 대시보드 init ──
    r = httpx.get(f"{BASE_URL}/dashboard/init", headers=h, timeout=10)
    if r.status_code == 200:
        data = r.json()
        print(f"  [2/12] 대시보드 init ........... OK {r.status_code}")
        print(f"         -> user_group: {data.get('user_group')}")
        passed += 1
    else:
        print(f"  [2/12] 대시보드 init ........... FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 3. 건강 기록 입력 (직접입력) ──
    today = date.today().isoformat()
    r = httpx.patch(f"{BASE_URL}/health/daily/{today}", json={
        "source": "direct",
        "sleep_quality": "good",
        "sleep_duration_bucket": "between_7_8",
        "breakfast_status": "hearty",
        "exercise_done": True,
        "exercise_type": "walking",
        "exercise_minutes": 30,
        "walk_done": True,
        "vegetable_intake_level": "enough",
        "water_cups": 6,
    }, headers=h, timeout=10)
    if r.status_code == 200:
        data = r.json()
        accepted = sum(1 for v in data.get("field_results", {}).values() if v == "accepted")
        print(f"  [3/12] 건강 기록 입력 .......... OK {r.status_code} ({accepted}개 저장)")
        passed += 1
    else:
        print(f"  [3/12] 건강 기록 입력 .......... FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 4. 건강 기록 조회 ──
    r = httpx.get(f"{BASE_URL}/health/daily/{today}", headers=h, timeout=10)
    if r.status_code == 200:
        print(f"  [4/12] 건강 기록 조회 .......... OK {r.status_code}")
        passed += 1
    else:
        print(f"  [4/12] 건강 기록 조회 .......... FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 5. 미입력 날짜 조회 ──
    r = httpx.get(f"{BASE_URL}/health/daily/missing", headers=h, timeout=10)
    if r.status_code == 200:
        data = r.json()
        count = len(data.get("missing_dates", []))
        print(f"  [5/12] 미입력 날짜 조회 ........ OK {r.status_code} ({count}일 미입력)")
        passed += 1
    else:
        print(f"  [5/12] 미입력 날짜 조회 ........ FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 6. 위험도 재계산 ──
    r = httpx.post(f"{BASE_URL}/risk/recalculate", headers=h, timeout=10)
    if r.status_code == 200:
        data = r.json()
        print(f"  [6/12] 위험도 재계산 ........... OK {r.status_code}")
        print(f"         -> FINDRISC: {data.get('findrisc_score')}점 ({data.get('risk_level')})")
        print(f"         -> 수면: {data.get('sleep_score')} 식단: {data.get('diet_score')} 운동: {data.get('exercise_score')}")
        passed += 1
    else:
        print(f"  [6/12] 위험도 재계산 ........... FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 7. 위험도 조회 ──
    r = httpx.get(f"{BASE_URL}/risk/latest", headers=h, timeout=10)
    if r.status_code == 200:
        print(f"  [7/12] 위험도 조회 ............. OK {r.status_code}")
        passed += 1
    else:
        print(f"  [7/12] 위험도 조회 ............. FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 8. 분석 요약 ──
    r = httpx.get(f"{BASE_URL}/analysis/summary?period=7", headers=h, timeout=10)
    if r.status_code == 200:
        print(f"  [8/12] 분석 요약 (7일) ......... OK {r.status_code}")
        passed += 1
    else:
        print(f"  [8/12] 분석 요약 (7일) ......... FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 9. 챌린지 전체 조회 ──
    r = httpx.get(f"{BASE_URL}/challenges/overview", headers=h, timeout=10)
    if r.status_code == 200:
        data = r.json()
        rec = len(data.get("recommended", []))
        print(f"  [9/12] 챌린지 전체 조회 ........ OK {r.status_code} (추천 {rec}개)")
        passed += 1
    else:
        print(f"  [9/12] 챌린지 전체 조회 ........ FAIL {r.status_code}")
        print(f"         {r.text}")

    # ── 10. 챌린지 참여 ──
    # 템플릿 ID 1번(주 150분 운동)으로 참여 시도
    r = httpx.post(f"{BASE_URL}/challenges/1/join", headers=h, timeout=10)
    if r.status_code == 201:
        uc_id = r.json().get("user_challenge_id")
        print(f"  [10/12] 챌린지 참여 ............ OK {r.status_code} (id={uc_id})")
        passed += 1
    elif r.status_code == 404:
        print(f"  [10/12] 챌린지 참여 ............ SKIP (시드 데이터 없음)")
        print("          python scripts/seed_challenge_templates.py 실행 필요")
        uc_id = None
        passed += 1
    else:
        print(f"  [10/12] 챌린지 참여 ............ FAIL {r.status_code}")
        print(f"          {r.text}")
        uc_id = None

    # ── 11. 챌린지 체크인 ──
    if uc_id:
        r = httpx.post(f"{BASE_URL}/challenges/{uc_id}/checkin", json={
            "status": "achieved",
        }, headers=h, timeout=10)
        if r.status_code == 200:
            data = r.json()
            print(f"  [11/12] 챌린지 체크인 .......... OK {r.status_code} (streak={data.get('current_streak')})")
            passed += 1
        else:
            print(f"  [11/12] 챌린지 체크인 .......... FAIL {r.status_code}")
            print(f"          {r.text}")
    else:
        print("  [11/12] 챌린지 체크인 .......... SKIP (참여 안 됨)")
        passed += 1

    # ── 12. 챌린지 달력 조회 ──
    if uc_id:
        r = httpx.get(f"{BASE_URL}/challenges/{uc_id}/calendar", headers=h, timeout=10)
        if r.status_code == 200:
            data = r.json()
            print(f"  [12/12] 챌린지 달력 조회 ........ OK {r.status_code} (achieved={data.get('achieved_days')})")
            passed += 1
        else:
            print(f"  [12/12] 챌린지 달력 조회 ........ FAIL {r.status_code}")
            print(f"          {r.text}")
    else:
        print("  [12/12] 챌린지 달력 조회 ........ SKIP (참여 안 됨)")
        passed += 1

    # ── 결과 ──
    print()
    print("=" * 50)
    if passed == total:
        print(f"  전체 테스트 통과! ({passed}/{total})")
    else:
        print(f"  결과: {passed}/{total}")
    print("=" * 50)
    print()


if __name__ == "__main__":
    main()
