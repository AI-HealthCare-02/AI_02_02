"""다나아 AI 건강 코치 시스템 프롬프트 + 건강질문 묶음 정의."""

SYSTEM_PROMPT_TEMPLATE = """\
당신은 '다나아'의 AI 건강 생활습관 코치입니다.

## 역할
- 친근한 건강 생활습관 코치 (의사가 아님)
- 반말 사용, 자연스럽고 따뜻한 한국어
- 이모지를 적절히 활용해서 친근감을 줌

## 사용자 정보
- 이름: {user_name}
- 그룹: {user_group}
- 목표: {goals}

## 절대 금지 사항
- 의료적 진단, 처방, 약물 추천 금지
- "~해야 합니다" 대신 "~해보는 건 어때?" / "~을 추천해요" 사용
- 구체적 수치(혈당 수치 등)를 기반으로 의학적 판단을 내리는 것
- 특정 약물이나 치료법을 권하는 것

## 면책조항 삽입 규칙
- 건강에 대한 질문을 받으면 답변 끝에 자연스럽게 포함:
  "참고로 저는 생활습관 코치예요 😊 의학적 판단이 필요하면 전문가 상담을 추천해요!"
- 매 3번째 대화마다 또는 민감한 건강 질문(혈당, 혈압, 약 관련) 시 반드시 포함

## 건강질문 삽입 시 규칙
건강질문이 포함될 때는:
1. 먼저 사용자 질문에 자연스럽게 답변
2. 부드러운 전환 멘트로 연결 (예: "그건 그렇고~", "아 맞다!", "참, 오늘 하루는 어때?")
3. 건강질문을 자연스럽게 이어감
4. 절대 기계적으로 질문을 나열하지 않음

## 응답 스타일
- 짧고 핵심적으로 (3-4문장 이내)
- 공감 먼저, 정보는 그다음
- 칭찬과 격려를 자주
"""

DISCLAIMER_TEXT = (
    "참고로 저는 생활습관 코치예요 😊 "
    "의학적 판단이 필요하면 전문가 상담을 추천해요!"
)

# ──────────────────────────────────────────────
# 건강질문 묶음 (Bundle) 정의
# ──────────────────────────────────────────────

HEALTH_QUESTION_BUNDLES: dict[str, dict] = {
    "bundle_1": {
        "name": "수면",
        "touchpoint": "morning",
        "window": (7, 0, 9, 0),  # 07:00-09:00
        "check_fields": ["sleep_quality"],  # 이 필드가 null이면 미응답
        "questions": [
            {
                "field": "sleep_quality",
                "text": "어젯밤 잠은 잘 잤어? 😴",
                "options": ["very_good", "good", "normal", "bad", "very_bad"],
            },
            {
                "field": "sleep_duration_bucket",
                "text": "대략 몇 시간 정도 잔 것 같아?",
                "options": ["under_5", "between_5_6", "between_6_7", "between_7_8", "over_8"],
            },
        ],
        "source_field": "sleep_quality_source",
    },
    "bundle_2": {
        "name": "아침식사",
        "touchpoint": "morning",
        "window": (7, 0, 9, 0),
        "check_fields": ["breakfast_status"],
        "questions": [
            {
                "field": "breakfast_status",
                "text": "아침은 먹었어? 🍳",
                "options": ["hearty", "simple", "skipped"],
            },
            {
                "field": "took_medication",
                "text": "오늘 약은 챙겨 먹었어? 💊",
                "options": [True, False],
                "condition": "group_A_only",
            },
        ],
        "source_field": "breakfast_status_source",
    },
    "bundle_3": {
        "name": "식단질",
        "touchpoint": "lunch",
        "window": (11, 30, 13, 30),  # 11:30-13:30
        "check_fields": ["meal_balance_level"],
        "questions": [
            {
                "field": "meal_balance_level",
                "text": "오늘 식사 구성은 어땠어? 🥗",
                "options": ["balanced", "carb_heavy", "protein_veg_heavy"],
            },
            {
                "field": "sweetdrink_level",
                "text": "단 음료나 간식은?",
                "options": ["none", "one", "two_plus"],
            },
        ],
        "source_field": "meal_balance_level_source",
    },
    "bundle_4": {
        "name": "운동",
        "touchpoint": "evening",
        "window": (17, 0, 20, 0),  # 17:00-20:00
        "check_fields": ["exercise_done"],
        "questions": [
            {
                "field": "exercise_done",
                "text": "오늘 운동은 했어? 🏃",
                "options": [True, False],
            },
            {
                "field": "exercise_type",
                "text": "어떤 운동을 했어?",
                "options": [
                    "walking", "running", "cycling", "swimming",
                    "gym", "home_workout", "other",
                ],
                "condition": "exercise_done_true",
            },
            {
                "field": "exercise_minutes",
                "text": "몇 분 정도 했어?",
                "input_type": "number",
                "condition": "exercise_done_true",
            },
        ],
        "source_field": "exercise_done_source",
    },
    "bundle_5": {
        "name": "저녁습관",
        "touchpoint": "evening",
        "window": (17, 0, 20, 0),
        "check_fields": ["vegetable_intake_level"],
        "questions": [
            {
                "field": "vegetable_intake_level",
                "text": "오늘 채소는 충분히 먹었어? 🥦",
                "options": ["enough", "little", "none"],
            },
            {
                "field": "walk_done",
                "text": "오늘 산책은 했어? 🚶",
                "options": [True, False],
            },
        ],
        "source_field": "vegetable_intake_level_source",
    },
    "bundle_6": {
        "name": "복약",
        "touchpoint": "anytime",
        "window": None,  # 시간 무관
        "check_fields": ["took_medication"],
        "questions": [
            {
                "field": "took_medication",
                "text": "오늘 약은 잘 챙겨 먹었어? 💊",
                "options": [True, False],
            },
        ],
        "source_field": "took_medication_source",
        "condition": "group_A_only",
    },
    "bundle_7": {
        "name": "정서+음주",
        "touchpoint": "anytime",
        "window": None,
        "check_fields": ["mood_level"],
        "questions": [
            {
                "field": "mood_level",
                "text": "요즘 기분은 어때? 😊",
                "options": ["very_good", "good", "normal", "stressed", "very_stressed"],
            },
            {
                "field": "alcohol_today",
                "text": "최근에 술 마신 적 있어? 🍺",
                "options": [True, False],
            },
            {
                "field": "alcohol_amount_level",
                "text": "얼마나 마셨어?",
                "options": ["light", "moderate", "heavy"],
                "condition": "alcohol_today_true",
            },
        ],
        "source_field": "mood_level_source",
        "condition": "48h_since_last",
    },
}

# 묶음 키 → 시간대 매핑 (빠른 조회용)
TOUCHPOINT_BUNDLES: dict[str, list[str]] = {
    "morning": ["bundle_1", "bundle_2"],
    "lunch": ["bundle_3"],
    "evening": ["bundle_4", "bundle_5"],
    "anytime": ["bundle_6", "bundle_7"],
}
