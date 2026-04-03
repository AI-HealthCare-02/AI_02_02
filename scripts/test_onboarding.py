"""다나아 온보딩 전체 흐름 자동 테스트.

사용법: python scripts/test_onboarding.py
매번 랜덤 이메일을 생성하므로 몇 번이든 반복 실행 가능합니다.
"""

from __future__ import annotations

import random
import sys
import uuid

try:
    import httpx
except ImportError:
    print("httpx가 설치되어 있지 않습니다.")
    print("설치 방법: pip install httpx")
    sys.exit(1)

BASE_URL = "http://localhost/api/v1"
PASSWORD = "Test1234!@"


def main() -> None:
    email = f"test_{uuid.uuid4().hex[:8]}@danaa.com"
    phone = f"010-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
    passed = 0
    total = 6

    print()
    print("=" * 45)
    print("  다나아 온보딩 전체 테스트")
    print("=" * 45)
    print()
    print(f"  테스트 계정: {email}")
    print()

    # ── 1. 회원가입 ──
    try:
        r = httpx.post(
            f"{BASE_URL}/auth/signup",
            json={
                "email": email,
                "password": PASSWORD,
                "name": "테스트유저",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": phone,
            },
            timeout=10,
        )
    except httpx.ConnectError:
        print("  [오류] 서버에 연결할 수 없습니다.")
        print("  Docker 컨테이너가 실행 중인지 확인하세요.")
        print("  (docker ps 명령어로 확인)")
        sys.exit(1)

    if r.status_code == 201:
        print(f"  [1/6] 회원가입 ............ OK {r.status_code}")
        passed += 1
    else:
        print(f"  [1/6] 회원가입 ............ FAIL {r.status_code}")
        print(f"        {r.text}")
        sys.exit(1)

    # ── 2. 로그인 ──
    r = httpx.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=10,
    )
    if r.status_code == 200:
        token = r.json()["access_token"]
        print(f"  [2/6] 로그인 .............. OK {r.status_code} (토큰 발급 완료)")
        passed += 1
    else:
        print(f"  [2/6] 로그인 .............. FAIL {r.status_code}")
        print(f"        {r.text}")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    # ── 3. 이용약관 동의 ──
    r = httpx.post(
        f"{BASE_URL}/auth/consent",
        json={
            "terms_of_service": True,
            "privacy_policy": True,
            "health_data_consent": True,
            "disclaimer_consent": True,
            "marketing_consent": False,
        },
        headers=headers,
        timeout=10,
    )
    if r.status_code == 201:
        print(f"  [3/6] 이용약관 동의 ....... OK {r.status_code}")
        passed += 1
    else:
        print(f"  [3/6] 이용약관 동의 ....... FAIL {r.status_code}")
        print(f"        {r.text}")
        sys.exit(1)

    # ── 4. 건강 설문 ──
    r = httpx.post(
        f"{BASE_URL}/onboarding/survey",
        json={
            "relation": "prevention",
            "gender": "MALE",
            "age_range": "45_54",
            "height_cm": 175.0,
            "weight_kg": 80.0,
            "family_history": "parents",
            "conditions": ["hypertension"],
            "exercise_frequency": "1_2_per_week",
            "diet_habits": ["irregular_meals"],
            "sleep_duration_bucket": "between_6_7",
            "alcohol_frequency": "sometimes",
            "smoking_status": "non_smoker",
            "goals": ["weight_management"],
            "ai_consent": "agreed",
        },
        headers=headers,
        timeout=10,
    )
    if r.status_code == 201:
        data = r.json()
        print(f"  [4/6] 건강 설문 ........... OK {r.status_code}")
        print(f"        -> 그룹: {data.get('user_group', '?')}")
        print(f"        -> BMI: {data.get('bmi', '?')}")
        score = data.get("initial_findrisc_score", "?")
        level = data.get("initial_risk_level", "?")
        print(f"        -> FINDRISC: {score}점 ({level})")
        passed += 1
    else:
        print(f"  [4/6] 건강 설문 ........... FAIL {r.status_code}")
        print(f"        {r.text}")
        sys.exit(1)

    # ── 5. 온보딩 상태 확인 ──
    r = httpx.get(
        f"{BASE_URL}/onboarding/status",
        headers=headers,
        timeout=10,
    )
    if r.status_code == 200:
        data = r.json()
        completed = data.get("is_completed", False)
        print(f"  [5/6] 온보딩 상태 확인 .... OK {r.status_code}")
        print(f"        -> 온보딩 완료: {completed}")
        passed += 1
    else:
        print(f"  [5/6] 온보딩 상태 확인 .... FAIL {r.status_code}")
        print(f"        {r.text}")
        sys.exit(1)

    # ── 6. 내 정보 확인 (인증 동작 추가 검증) ──
    r = httpx.get(
        f"{BASE_URL}/users/me",
        headers=headers,
        timeout=10,
    )
    if r.status_code == 200:
        print(f"  [6/6] 내 정보 조회 ........ OK {r.status_code}")
        passed += 1
    else:
        print(f"  [6/6] 내 정보 조회 ........ FAIL {r.status_code}")
        print(f"        {r.text}")
        sys.exit(1)

    # ── 결과 ──
    print()
    print("=" * 45)
    if passed == total:
        print(f"  전체 테스트 통과! ({passed}/{total})")
    else:
        print(f"  일부 실패: {passed}/{total}")
    print("=" * 45)
    print()


if __name__ == "__main__":
    main()
