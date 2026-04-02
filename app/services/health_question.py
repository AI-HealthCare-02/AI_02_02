"""건강질문 삽입 판단 + 답변 저장 서비스.

4대 삽입 조건:
1. 마지막 건강질문으로부터 90분 경과
2. 현재 시각이 해당 터치포인트 유효 윈도우 안
3. 해당 묶음을 아직 응답하지 않음
4. 야간 침묵(22:00~07:00)이 아님

핵심 규칙:
- AI 응답당 최대 2묶음
- First Answer Wins (채팅 vs 직접입력)
- exercise_done=false → type/minutes null 강제
- alcohol_today=false → amount_level null 강제
"""

from datetime import date, datetime, timedelta

from app.core import config
from app.models.assessments import UserEngagement
from app.models.enums import DataSource, EngagementState, UserGroup
from app.models.health import DailyHealthLog, HealthProfile

# ai_worker의 묶음 정의를 직접 참조하지 않고 여기서 매핑 정의
# (Docker 컨테이너 격리로 ai_worker/ 직접 import 불가)

# ── 묶음별 체크 필드 (미응답 판단용) ──
BUNDLE_CHECK_FIELDS: dict[str, list[str]] = {
    "bundle_1": ["sleep_quality"],
    "bundle_2": ["breakfast_status"],
    "bundle_3": ["meal_balance_level"],
    "bundle_4": ["exercise_done"],
    "bundle_5": ["vegetable_intake_level"],
    "bundle_6": ["took_medication"],
    "bundle_7": ["mood_level"],
}

# ── 묶음별 저장 필드 → _source 필드 매핑 ──
FIELD_TO_SOURCE: dict[str, str] = {
    "sleep_quality": "sleep_quality_source",
    "sleep_duration_bucket": "sleep_quality_source",
    "breakfast_status": "breakfast_status_source",
    "lunch_status": "lunch_status_source",
    "dinner_status": "dinner_status_source",
    "vegetable_intake_level": "vegetable_intake_level_source",
    "meal_balance_level": "meal_balance_level_source",
    "sweetdrink_level": "sweetdrink_level_source",
    "exercise_done": "exercise_done_source",
    "exercise_type": "exercise_done_source",
    "exercise_minutes": "exercise_done_source",
    "walk_done": "walk_done_source",
    "water_cups": "water_cups_source",
    "nightsnack_level": "nightsnack_level_source",
    "took_medication": "took_medication_source",
    "mood_level": "mood_level_source",
    "alcohol_today": "alcohol_today_source",
    "alcohol_amount_level": "alcohol_today_source",
}

# ── 시간 윈도우 정의 (시, 분, 시, 분) ──
TIME_WINDOWS: dict[str, tuple[int, int, int, int]] = {
    "morning": (7, 0, 9, 0),
    "lunch": (11, 30, 13, 30),
    "evening": (17, 0, 20, 0),
}

TOUCHPOINT_BUNDLES: dict[str, list[str]] = {
    "morning": ["bundle_1", "bundle_2"],
    "lunch": ["bundle_3"],
    "evening": ["bundle_4", "bundle_5"],
}

# ── 묶음별 질문 데이터 (프론트엔드 전송 + 프롬프트 구성용) ──
# ai_worker/prompts/system.py에도 동일 데이터가 독립적으로 정의됨
HEALTH_QUESTION_BUNDLES: dict[str, dict] = {
    "bundle_1": {
        "name": "수면",
        "questions": [
            {"field": "sleep_quality", "text": "어젯밤 잠은 잘 잤어? 😴",
             "options": ["very_good", "good", "normal", "bad", "very_bad"]},
            {"field": "sleep_duration_bucket", "text": "대략 몇 시간 정도 잔 것 같아?",
             "options": ["under_5", "between_5_6", "between_6_7", "between_7_8", "over_8"]},
        ],
    },
    "bundle_2": {
        "name": "아침식사",
        "questions": [
            {"field": "breakfast_status", "text": "아침은 먹었어? 🍳",
             "options": ["hearty", "simple", "skipped"]},
            {"field": "took_medication", "text": "오늘 약은 챙겨 먹었어? 💊",
             "options": [True, False], "condition": "group_A_only"},
        ],
    },
    "bundle_3": {
        "name": "식단질",
        "questions": [
            {"field": "meal_balance_level", "text": "오늘 식사 구성은 어땠어? 🥗",
             "options": ["balanced", "carb_heavy", "protein_veg_heavy"]},
            {"field": "sweetdrink_level", "text": "단 음료나 간식은?",
             "options": ["none", "one", "two_plus"]},
        ],
    },
    "bundle_4": {
        "name": "운동",
        "questions": [
            {"field": "exercise_done", "text": "오늘 운동은 했어? 🏃",
             "options": [True, False]},
            {"field": "exercise_type", "text": "어떤 운동을 했어?",
             "options": ["walking", "running", "cycling", "swimming",
                         "gym", "home_workout", "other"],
             "condition": "exercise_done_true"},
            {"field": "exercise_minutes", "text": "몇 분 정도 했어?",
             "input_type": "number", "condition": "exercise_done_true"},
        ],
    },
    "bundle_5": {
        "name": "저녁습관",
        "questions": [
            {"field": "vegetable_intake_level", "text": "오늘 채소는 충분히 먹었어? 🥦",
             "options": ["enough", "little", "none"]},
            {"field": "walk_done", "text": "오늘 산책은 했어? 🚶",
             "options": [True, False]},
        ],
    },
    "bundle_6": {
        "name": "복약",
        "questions": [
            {"field": "took_medication", "text": "오늘 약은 잘 챙겨 먹었어? 💊",
             "options": [True, False]},
        ],
        "condition": "group_A_only",
    },
    "bundle_7": {
        "name": "정서+음주",
        "questions": [
            {"field": "mood_level", "text": "요즘 기분은 어때? 😊",
             "options": ["very_good", "good", "normal", "stressed", "very_stressed"]},
            {"field": "alcohol_today", "text": "최근에 술 마신 적 있어? 🍺",
             "options": [True, False]},
            {"field": "alcohol_amount_level", "text": "얼마나 마셨어?",
             "options": ["light", "moderate", "heavy"],
             "condition": "alcohol_today_true"},
        ],
        "condition": "48h_since_last",
    },
}

COOLDOWN_MINUTES = 90
MAX_BUNDLES_PER_RESPONSE = 2
MAX_DAILY_CHATS = 50
NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 7


class HealthQuestionService:
    """건강질문 삽입 판단 + 답변 저장."""

    async def get_eligible_bundles(self, user_id: int) -> list[str]:
        """4조건을 모두 만족하는 묶음 키 리스트 반환 (최대 2개)."""
        now = datetime.now(tz=config.TIMEZONE)

        # 조건 4: 야간 침묵 (22:00~07:00)
        if now.hour >= NIGHT_START_HOUR or now.hour < NIGHT_END_HOUR:
            return []

        # 조건 1: 쿨다운 체크
        engagement = await self._get_engagement(user_id, now)
        if engagement.cooldown_until and engagement.cooldown_until > now:
            return []

        # 조건 2+3: 시간 윈도우 후보 → 미응답 필터
        today_log = await DailyHealthLog.get_or_none(user_id=user_id, log_date=now.date())
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else UserGroup.C

        candidates = self._get_time_candidates(now, user_group, engagement)
        eligible = self._filter_unanswered(candidates, today_log)

        return eligible[:MAX_BUNDLES_PER_RESPONSE]

    async def _get_engagement(self, user_id: int, now: datetime) -> UserEngagement:
        """UserEngagement 로드 + 일일 리셋."""
        engagement, _ = await UserEngagement.get_or_create(
            user_id=user_id,
            defaults={"state": EngagementState.ACTIVE},
        )
        if engagement.updated_at and engagement.updated_at.date() < now.date():
            engagement.today_bundle_count = 0
        return engagement

    def _get_time_candidates(
        self, now: datetime, user_group: str, engagement: UserEngagement
    ) -> list[str]:
        """현재 시각 기반 묶음 후보 수집."""
        candidates: list[str] = []
        current_minutes = now.hour * 60 + now.minute

        for touchpoint, (sh, sm, eh, em) in TIME_WINDOWS.items():
            if sh * 60 + sm <= current_minutes < eh * 60 + em:
                candidates.extend(TOUCHPOINT_BUNDLES[touchpoint])

        # anytime 묶음
        if user_group == UserGroup.A:
            candidates.append("bundle_6")
        if engagement.last_response_at is None or (
            now - engagement.last_response_at >= timedelta(hours=48)
        ):
            candidates.append("bundle_7")

        return candidates

    def _filter_unanswered(
        self, candidates: list[str], today_log: DailyHealthLog | None
    ) -> list[str]:
        """미응답 묶음만 필터링 + 중복 제거."""
        eligible: list[str] = []
        for bundle_key in candidates:
            check_fields = BUNDLE_CHECK_FIELDS.get(bundle_key, [])
            if today_log is None or all(
                getattr(today_log, f, None) is None for f in check_fields
            ):
                eligible.append(bundle_key)

        # bundle_6의 took_medication이 bundle_2와 겹침
        if "bundle_6" in eligible and "bundle_2" in eligible:
            eligible.remove("bundle_6")

        return eligible

    async def save_health_answers(
        self,
        user_id: int,
        bundle_key: str,
        answers: dict[str, str | int | bool],
    ) -> dict:
        """건강질문 답변 저장.

        First Answer Wins: 이미 값이 있는 필드는 skip.
        exercise_done=false → type/minutes null 강제.
        alcohol_today=false → amount_level null 강제.

        Returns:
            {"saved_fields": [...], "skipped_fields": [...], "cooldown_until": datetime}
        """
        now = datetime.now(tz=config.TIMEZONE)
        today: date = now.date()

        # DailyHealthLog get_or_create
        log, _ = await DailyHealthLog.get_or_create(
            user_id=user_id,
            log_date=today,
        )

        saved_fields: list[str] = []
        skipped_fields: list[str] = []

        # exercise_done=false 조건부 로직
        if "exercise_done" in answers and not answers["exercise_done"]:
            answers.pop("exercise_type", None)
            answers.pop("exercise_minutes", None)

        # alcohol_today=false 조건부 로직
        if "alcohol_today" in answers and not answers["alcohol_today"]:
            answers.pop("alcohol_amount_level", None)

        for field_name, value in answers.items():
            # 필드 존재 확인
            if not hasattr(log, field_name):
                skipped_fields.append(field_name)
                continue

            # First Answer Wins: 이미 값이 있으면 skip
            current_value = getattr(log, field_name)
            if current_value is not None:
                skipped_fields.append(field_name)
                continue

            # 값 저장
            setattr(log, field_name, value)
            saved_fields.append(field_name)

            # _source 필드 설정
            source_field = FIELD_TO_SOURCE.get(field_name)
            if source_field and hasattr(log, source_field):
                setattr(log, source_field, DataSource.CHAT)

        await log.save()

        # UserEngagement 업데이트
        engagement, _ = await UserEngagement.get_or_create(
            user_id=user_id,
            defaults={"state": EngagementState.ACTIVE},
        )
        cooldown_until = now + timedelta(minutes=COOLDOWN_MINUTES)
        engagement.cooldown_until = cooldown_until
        engagement.today_bundle_count += 1
        engagement.last_bundle_key = bundle_key
        engagement.last_response_at = now
        engagement.total_responses += 1
        await engagement.save()

        return {
            "saved_fields": saved_fields,
            "skipped_fields": skipped_fields,
            "cooldown_until": cooldown_until,
        }
