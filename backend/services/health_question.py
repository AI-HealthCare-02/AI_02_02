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

from backend.core import config
from backend.models.assessments import UserEngagement
from backend.models.enums import FIELD_TO_SOURCE, DataSource, EngagementState, UserGroup
from backend.models.health import DailyHealthLog, HealthProfile
from backend.models.settings import UserSettings

# ai_worker의 묶음 정의를 직접 참조하지 않고 여기서 매핑 정의
# (Docker 컨테이너 격리로 workers/ai/ 직접 import 불가)

# ── 묶음별 기본 체크 필드 (빠른 분기용) ──
BUNDLE_CHECK_FIELDS: dict[str, list[str]] = {
    "bundle_1": ["sleep_quality", "sleep_duration_bucket"],
    "bundle_2": ["breakfast_status", "took_medication"],
    "bundle_3": ["meal_balance_level", "sweetdrink_level"],
    "bundle_4": ["exercise_done", "exercise_type", "exercise_minutes"],
    "bundle_5": ["vegetable_intake_level", "walk_done"],
    "bundle_6": ["took_medication"],
    "bundle_7": ["mood_level", "alcohol_today", "alcohol_amount_level"],
}

NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 7
MAX_BUNDLES_PER_RESPONSE = 2
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
PUSH_TOUCHPOINT_BUNDLES: dict[str, list[str]] = {
    "morning": ["bundle_1", "bundle_2"],
    "lunch": ["bundle_3"],
    "evening": ["bundle_4", "bundle_5", "bundle_7"],
}

# ── 자동 카드 순서 정의 ──
AUTO_SEQUENCE_BUNDLES: tuple[str, ...] = (
    "bundle_1",
    "bundle_2",
    "bundle_3",
    "bundle_4",
    "bundle_5",
    "bundle_7",
)
MEAL_STATUS_FIELDS = {"breakfast_status", "lunch_status", "dinner_status"}
LEGACY_MEAL_STATUS_ALIASES = {
    "light": "hearty",
    "simple": "hearty",
}

# ── 묶음별 질문 데이터 (프론트엔드 전송 + 프롬프트 구성용) ──
# workers/ai/prompts/system.py에도 동일 데이터가 독립적으로 정의됨
HEALTH_QUESTION_BUNDLES: dict[str, dict] = {
    "bundle_1": {
        "name": "수면",
        "questions": [
            {"field": "sleep_quality", "text": "어젯밤 잠은 잘 주무셨나요? 😴",
             "options": ["very_good", "good", "normal", "bad", "very_bad"]},
            {"field": "sleep_duration_bucket", "text": "대략 몇 시간 정도 주무셨나요?",
             "options": ["under_5", "between_5_6", "between_6_7", "between_7_8", "over_8"]},
        ],
    },
    "bundle_2": {
        "name": "아침식사",
        "questions": [
            {"field": "breakfast_status", "text": "아침 드셨어요? 🍳",
             "options": ["hearty", "skipped"]},
            {"field": "took_medication", "text": "오늘 약은 챙겨 드셨나요? 💊",
             "options": [True, False], "condition": "group_A_only"},
        ],
    },
    "bundle_3": {
        "name": "식단",
        "questions": [
            {"field": "meal_balance_level", "text": "오늘 하루 식사가 주로 어떤 구성이었나요? (고르게 / 밥·빵·면 위주 / 고기·채소 위주)",
             "options": ["balanced", "carb_heavy", "protein_veg_heavy"]},
            {"field": "sweetdrink_level", "text": "오늘 단 음료나 달달한 간식 드셨나요? (커피음료·주스·과자 등)",
             "options": ["none", "one", "two_plus"]},
        ],
    },
    "bundle_4": {
        "name": "운동",
        "questions": [
            {"field": "exercise_done", "text": "오늘 운동은 하셨나요? 🏃",
             "options": [True, False]},
            {"field": "exercise_type", "text": "어떤 운동을 하셨나요?",
             "options": ["walking", "running", "cycling", "swimming",
                         "gym", "home_workout", "other"],
             "condition": "exercise_done_true"},
            {"field": "exercise_minutes", "text": "몇 분 정도 하셨나요?",
             "input_type": "number", "condition": "exercise_done_true"},
        ],
    },
    "bundle_5": {
        "name": "저녁습관",
        "questions": [
            {"field": "vegetable_intake_level", "text": "오늘 채소나 나물 반찬 드셨나요? (하루 2가지 이상이면 '충분'이에요)",
             "options": ["enough", "little", "none"]},
            {"field": "walk_done", "text": "오늘 산책이나 걷기 하셨나요? 🚶",
             "options": [True, False]},
        ],
    },
    "bundle_6": {
        "name": "복약",
        "questions": [
            {"field": "took_medication", "text": "오늘 약은 잘 챙겨 드셨나요? 💊",
             "options": [True, False]},
        ],
        "condition": "group_A_only",
    },
    "bundle_7": {
        "name": "정서+음주",
        "questions": [
            {"field": "mood_level", "text": "요즘 기분은 어떠신가요? 😊",
             "options": ["very_good", "good", "normal", "stressed", "very_stressed"]},
            {"field": "alcohol_today", "text": "최근에 술을 드신 적이 있으신가요? 🍺",
             "options": [True, False]},
            {"field": "alcohol_amount_level", "text": "어느 정도 드셨나요?",
             "options": ["light", "moderate", "heavy"],
             "condition": "alcohol_today_true"},
        ],
        "condition": "48h_since_last",
    },
}

SEQUENCE_START_HOUR = 4
MAX_DAILY_CHATS = 50

DAILY_MISSING_BUNDLE_LABELS: dict[str, str] = {
    "bundle_1": "수면",
    "bundle_2": "아침 식사",
    "bundle_3": "식사 균형",
    "bundle_4": "운동",
    "bundle_5": "생활 습관",
    "bundle_7": "기분과 음주",
}

DAILY_MISSING_QUESTION_RULES: tuple[dict[str, str], ...] = (
    {"field": "sleep_quality", "label": "수면의 질", "bundle_key": "bundle_1"},
    {"field": "sleep_duration_bucket", "label": "수면 시간", "bundle_key": "bundle_1"},
    {"field": "breakfast_status", "label": "아침 식사 여부", "bundle_key": "bundle_2"},
    {"field": "meal_balance_level", "label": "식사 균형", "bundle_key": "bundle_3"},
    {"field": "sweetdrink_level", "label": "당류 음료나 간식", "bundle_key": "bundle_3"},
    {"field": "exercise_done", "label": "운동 여부", "bundle_key": "bundle_4"},
    {"field": "exercise_type", "label": "운동 종류", "bundle_key": "bundle_4"},
    {"field": "exercise_minutes", "label": "운동 시간", "bundle_key": "bundle_4"},
    {"field": "vegetable_intake_level", "label": "채소 섭취", "bundle_key": "bundle_5"},
    {"field": "walk_done", "label": "걷기 여부", "bundle_key": "bundle_5"},
    {"field": "took_medication", "label": "복약 여부", "bundle_key": "bundle_2"},
    {"field": "mood_level", "label": "기분 상태", "bundle_key": "bundle_7"},
    {"field": "alcohol_today", "label": "음주 여부", "bundle_key": "bundle_7"},
    {"field": "alcohol_amount_level", "label": "음주량", "bundle_key": "bundle_7"},
)

QUESTION_LABEL_BY_FIELD: dict[str, str] = {
    rule["field"]: rule["label"] for rule in DAILY_MISSING_QUESTION_RULES
}


class HealthQuestionService:
    """건강질문 삽입 판단 + 답변 저장."""

    @staticmethod
    async def _get_settings(user_id: int) -> UserSettings:
        settings, _ = await UserSettings.get_or_create(user_id=user_id)
        return settings

    def _filter_unanswered(
        self,
        candidates: list[str],
        today_log: DailyHealthLog | None,
        user_group: UserGroup | str | None,
    ) -> list[str]:
        """미응답 묶음만 필터링 + 중복 제거."""
        eligible: list[str] = []
        for bundle_key in candidates:
            if not self._is_bundle_complete(
                bundle_key=bundle_key,
                today_log=today_log,
                user_group=user_group,
            ):
                eligible.append(bundle_key)

        # bundle_6의 took_medication이 bundle_2와 겹침
        if "bundle_6" in eligible and "bundle_2" in eligible:
            eligible.remove("bundle_6")

        return eligible

    @staticmethod
    def _get_user_group_value(user_group: UserGroup | str | None) -> str:
        if hasattr(user_group, "value"):
            return str(user_group.value)
        if user_group is None:
            return UserGroup.C.value
        return str(user_group)

    def _is_question_applicable(
        self,
        *,
        question: dict,
        today_log: DailyHealthLog | None,
        user_group: UserGroup | str | None,
    ) -> bool:
        condition = question.get("condition")
        if not condition:
            return True

        if condition == "group_A_only":
            return self._get_user_group_value(user_group) == UserGroup.A.value

        if condition.endswith("_true"):
            parent_field = condition[: -len("_true")]
            return bool(today_log and getattr(today_log, parent_field, None) is True)

        if condition == "48h_since_last":
            return True

        return True

    def _get_required_fields_for_bundle(  # noqa: C901
        self,
        *,
        bundle_key: str,
        today_log: DailyHealthLog | None,
        user_group: UserGroup | str | None,
    ) -> list[str]:
        if bundle_key == "bundle_1":
            return ["sleep_quality", "sleep_duration_bucket"]

        if bundle_key == "bundle_2":
            fields = ["breakfast_status"]
            if self._get_user_group_value(user_group) == UserGroup.A.value:
                fields.append("took_medication")
            return fields

        if bundle_key == "bundle_3":
            return ["meal_balance_level", "sweetdrink_level"]

        if bundle_key == "bundle_4":
            fields = ["exercise_done"]
            if today_log and today_log.exercise_done is True:
                fields.extend(["exercise_type", "exercise_minutes"])
            return fields

        if bundle_key == "bundle_5":
            return ["vegetable_intake_level", "walk_done"]

        if bundle_key == "bundle_6":
            return ["took_medication"]

        if bundle_key == "bundle_7":
            fields = ["mood_level", "alcohol_today"]
            if today_log and today_log.alcohol_today is True:
                fields.append("alcohol_amount_level")
            return fields

        return BUNDLE_CHECK_FIELDS.get(bundle_key, [])

    def _is_bundle_complete(
        self,
        *,
        bundle_key: str,
        today_log: DailyHealthLog | None,
        user_group: UserGroup | str | None,
    ) -> bool:
        required_fields = self._get_required_fields_for_bundle(
            bundle_key=bundle_key,
            today_log=today_log,
            user_group=user_group,
        )
        if not required_fields:
            return False
        if today_log is None:
            return False
        return all(getattr(today_log, field_name, None) is not None for field_name in required_fields)

    def _build_pending_bundle_payload(
        self,
        *,
        bundle_key: str,
        today_log: DailyHealthLog | None,
        user_group: UserGroup | str | None,
    ) -> dict | None:
        bundle = HEALTH_QUESTION_BUNDLES.get(bundle_key)
        if not bundle:
            return None

        questions: list[dict] = []
        unanswered_count = 0
        unanswered_fields: list[str] = []
        for question in bundle.get("questions", []):
            if not self._is_question_applicable(
                question=question,
                today_log=today_log,
                user_group=user_group,
            ):
                continue

            field_name = question["field"]
            value = getattr(today_log, field_name, None) if today_log else None
            required_fields = self._get_required_fields_for_bundle(
                bundle_key=bundle_key,
                today_log=today_log,
                user_group=user_group,
            )
            if field_name in required_fields and value is None:
                unanswered_count += 1
                unanswered_fields.append(field_name)

            questions.append(
                {
                    "field": field_name,
                    "summary_label": QUESTION_LABEL_BY_FIELD.get(field_name, question["text"]),
                    "text": question["text"],
                    "input_type": question.get("input_type", "select"),
                    "options": question.get("options", []),
                    "condition": question.get("condition"),
                }
            )

        if unanswered_count <= 0:
            return None

        return {
            "bundle_key": bundle_key,
            "name": bundle.get("name", bundle_key),
            "unanswered_count": unanswered_count,
            "unanswered_fields": unanswered_fields,
            "questions": questions,
        }

    async def get_daily_missing_summary(self, user_id: int) -> dict[str, object]:
        """Return today's missing question summary using canonical fields only."""
        today = datetime.now(tz=config.TIMEZONE).date()
        today_log = await DailyHealthLog.get_or_none(user_id=user_id, log_date=today)
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else UserGroup.C

        question_labels: list[str] = []
        missing_bundle_keys: list[str] = []
        seen_bundle_keys: set[str] = set()

        for rule in DAILY_MISSING_QUESTION_RULES:
            field_name = rule["field"]
            if not self._should_include_daily_missing_field(
                field_name=field_name,
                user_group=user_group,
                today_log=today_log,
            ):
                continue
            if today_log is not None and getattr(today_log, field_name, None) is not None:
                continue

            question_labels.append(rule["label"])
            bundle_key = rule["bundle_key"]
            if bundle_key not in seen_bundle_keys:
                seen_bundle_keys.add(bundle_key)
                missing_bundle_keys.append(bundle_key)

        ordered_bundle_names: list[str] = []
        seen_bundle_names: set[str] = set()
        for bundle_key in self._get_sequence_order(user_group):
            if bundle_key not in seen_bundle_keys:
                continue
            bundle_name = DAILY_MISSING_BUNDLE_LABELS[bundle_key]
            if bundle_name in seen_bundle_names:
                continue
            seen_bundle_names.add(bundle_name)
            ordered_bundle_names.append(bundle_name)

        return {
            "count": len(question_labels),
            "question_labels": question_labels,
            "bundle_names": ordered_bundle_names,
        }

    @staticmethod
    def _should_include_daily_missing_field(
        *,
        field_name: str,
        user_group: UserGroup | str,
        today_log: DailyHealthLog | None,
    ) -> bool:
        group_value = HealthQuestionService._get_user_group_value(user_group)
        if field_name == "took_medication":
            return group_value == UserGroup.A.value

        if field_name in {"exercise_type", "exercise_minutes"}:
            return bool(today_log and today_log.exercise_done is True)

        if field_name == "alcohol_amount_level":
            return bool(today_log and today_log.alcohol_today is True)

        return True

    async def get_eligible_bundles(
        self,
        user_id: int,
        *,
        now: datetime | None = None,
        include_current_message_anchor: bool = False,
        suppress_reason: str | None = None,
    ) -> list[str]:
        """현재 시점에 자동으로 붙일 다음 bundle 1개만 반환."""
        availability = await self.get_card_availability(
            user_id=user_id,
            now=now,
            include_current_message_anchor=include_current_message_anchor,
            suppress_reason=suppress_reason,
        )
        next_bundle_key = availability.get("next_bundle_key")
        if not availability.get("is_available") or not next_bundle_key:
            return []
        return [str(next_bundle_key)]

    async def get_card_availability(
        self,
        user_id: int,
        *,
        now: datetime | None = None,
        include_current_message_anchor: bool = False,
        suppress_reason: str | None = None,
    ) -> dict[str, object]:
        current_time = now or datetime.now(tz=config.TIMEZONE)
        settings = await self._get_settings(user_id)

        if not settings.chat_notification:
            return self._build_card_availability_payload(
                blocked_reason="notification_off",
                blocked_reason_text="질문카드 알림이 꺼져 있어요.",
            )

        if self._is_before_sequence_start(current_time):
            return self._build_card_availability_payload(
                blocked_reason="daily_reset_wait",
                blocked_reason_text="새날 첫 설문은 새벽 4시부터 시작돼요.",
                available_after=self._sequence_start_at(current_time),
            )

        first_question_at = await self._get_first_sequence_message_time(
            user_id=user_id,
            current_time=current_time,
        )
        sequence_started_at = first_question_at
        if sequence_started_at is None and include_current_message_anchor:
            sequence_started_at = current_time

        if sequence_started_at is None:
            return self._build_card_availability_payload(
                blocked_reason="waiting_for_first_question",
                blocked_reason_text="오늘 첫 질문을 보내면 그때부터 설문카드 순서가 시작돼요.",
            )

        today_log = await DailyHealthLog.get_or_none(
            user_id=user_id,
            log_date=current_time.date(),
        )
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else UserGroup.C
        next_bundle_key = self._get_next_incomplete_bundle(
            today_log=today_log,
            user_group=user_group,
        )

        if suppress_reason:
            return self._build_card_availability_payload(
                sequence_started_at=sequence_started_at,
                next_bundle_key=next_bundle_key,
                blocked_reason=suppress_reason,
                blocked_reason_text="지금 메시지는 감정/위험 상황 안내를 우선해야 해서 설문카드를 붙이지 않았어요.",
            )

        if next_bundle_key is None:
            return self._build_card_availability_payload(
                sequence_started_at=sequence_started_at,
                blocked_reason="all_completed",
                blocked_reason_text="오늘 자동 질문카드는 다 끝났어요. 필요한 항목은 오른쪽 패널에서 바로 수정할 수 있어요.",
            )

        last_card_at = await self._get_last_health_question_card_time(
            user_id=user_id,
            current_time=current_time,
        )
        interval_minutes = settings.health_question_interval_minutes
        if interval_minutes is None:
            interval_minutes = 90
        if last_card_at is not None and interval_minutes > 0:
            available_after = last_card_at + timedelta(minutes=interval_minutes)
            if current_time < available_after:
                return self._build_card_availability_payload(
                    sequence_started_at=sequence_started_at,
                    next_bundle_key=next_bundle_key,
                    blocked_reason="cooldown",
                    blocked_reason_text="다음 질문은 약 1시간 30분 간격으로 보여드려요.",
                    available_after=available_after,
                )

        return self._build_card_availability_payload(
            sequence_started_at=sequence_started_at,
            is_available=True,
            next_bundle_key=next_bundle_key,
        )

    @staticmethod
    def _is_before_sequence_start(current_time: datetime) -> bool:
        return current_time.hour < SEQUENCE_START_HOUR

    @staticmethod
    def _sequence_start_at(current_time: datetime) -> datetime:
        return current_time.replace(hour=SEQUENCE_START_HOUR, minute=0, second=0, microsecond=0)

    async def _get_first_sequence_message_time(
        self,
        *,
        user_id: int,
        current_time: datetime,
    ) -> datetime | None:
        from backend.models.chat import ChatMessage, MessageRole

        first_message = await ChatMessage.filter(
            session__user_id=user_id,
            role=MessageRole.USER,
            created_at__gte=self._sequence_start_at(current_time),
        ).order_by("created_at", "id").first()
        return first_message.created_at if first_message else None

    async def _get_last_health_question_card_time(
        self,
        *,
        user_id: int,
        current_time: datetime,
    ) -> datetime | None:
        from backend.models.chat import ChatMessage, MessageRole

        last_message = await ChatMessage.filter(
            session__user_id=user_id,
            role=MessageRole.ASSISTANT,
            has_health_questions=True,
            created_at__gte=self._sequence_start_at(current_time),
        ).order_by("-created_at", "-id").first()
        return last_message.created_at if last_message else None

    def _get_sequence_order(self, user_group: UserGroup | str | None) -> tuple[str, ...]:
        del user_group
        return AUTO_SEQUENCE_BUNDLES

    def _get_next_incomplete_bundle(
        self,
        *,
        today_log: DailyHealthLog | None,
        user_group: UserGroup | str | None,
    ) -> str | None:
        for bundle_key in self._get_sequence_order(user_group):
            if not self._is_bundle_complete(
                bundle_key=bundle_key,
                today_log=today_log,
                user_group=user_group,
            ):
                return bundle_key
        return None

    @staticmethod
    def _has_time_window_ended(touchpoint: str, current_time: datetime) -> bool:
        window = TIME_WINDOWS.get(touchpoint)
        if not window:
            return False
        _, _, end_hour, end_minute = window
        window_end = current_time.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
        return current_time >= window_end

    def _get_elapsed_touchpoint_bundle_keys(self, current_time: datetime) -> list[str]:
        bundle_keys: list[str] = []
        for touchpoint in ("morning", "lunch", "evening"):
            if not self._has_time_window_ended(touchpoint, current_time):
                continue
            bundle_keys.extend(PUSH_TOUCHPOINT_BUNDLES.get(touchpoint, []))
        return bundle_keys

    async def get_due_push_bundle(
        self,
        user_id: int,
        *,
        now: datetime | None = None,
        allow_initial_prompt: bool = False,
    ) -> dict[str, object] | None:
        """Return the oldest unanswered bundle whose intended time window already ended."""
        current_time = now or datetime.now(tz=config.TIMEZONE)
        if self._is_before_sequence_start(current_time):
            return None

        elapsed_bundle_keys = set(self._get_elapsed_touchpoint_bundle_keys(current_time))
        today_log = await DailyHealthLog.get_or_none(user_id=user_id, log_date=current_time.date())
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else UserGroup.C

        if not elapsed_bundle_keys and allow_initial_prompt:
            for bundle_key in self._get_sequence_order(user_group):
                payload = self._build_pending_bundle_payload(
                    bundle_key=bundle_key,
                    today_log=today_log,
                    user_group=user_group,
                )
                if payload:
                    return payload
            return None

        if not elapsed_bundle_keys:
            return None

        for bundle_key in self._get_sequence_order(user_group):
            if bundle_key not in elapsed_bundle_keys:
                continue
            payload = self._build_pending_bundle_payload(
                bundle_key=bundle_key,
                today_log=today_log,
                user_group=user_group,
            )
            if payload:
                return payload
        return None

    @staticmethod
    def _build_card_availability_payload(
        *,
        sequence_started_at: datetime | None = None,
        is_available: bool = False,
        next_bundle_key: str | None = None,
        blocked_reason: str | None = None,
        blocked_reason_text: str | None = None,
        available_after: datetime | None = None,
    ) -> dict[str, object]:
        next_bundle_name = None
        if next_bundle_key:
            next_bundle_name = HEALTH_QUESTION_BUNDLES.get(next_bundle_key, {}).get("name") or next_bundle_key

        return {
            "mode": "auto_sequential",
            "sequence_started_at": sequence_started_at,
            "is_available": is_available,
            "next_bundle_key": next_bundle_key,
            "next_bundle_name": next_bundle_name,
            "blocked_reason": blocked_reason,
            "blocked_reason_text": blocked_reason_text,
            "available_after": available_after,
        }

    async def get_daily_pending_questions(self, user_id: int) -> dict[str, object]:
        """오늘 아직 비어 있는 질문 묶음을 순차 정책과 맞춘 catch-up 목록으로 반환."""
        today = datetime.now(tz=config.TIMEZONE).date()
        today_log = await DailyHealthLog.get_or_none(user_id=user_id, log_date=today)
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else UserGroup.C

        bundles: list[dict] = []
        for bundle_key in self._get_sequence_order(user_group):
            payload = self._build_pending_bundle_payload(
                bundle_key=bundle_key,
                today_log=today_log,
                user_group=user_group,
            )
            if payload:
                bundles.append(payload)

        return {
            "count": sum(bundle["unanswered_count"] for bundle in bundles),
            "bundles": bundles,
        }

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
            if field_name in MEAL_STATUS_FIELDS and isinstance(value, str):
                value = LEGACY_MEAL_STATUS_ALIASES.get(value, value)

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
        cooldown_until = None
        if saved_fields:
            engagement, _ = await UserEngagement.get_or_create(
                user_id=user_id,
                defaults={"state": EngagementState.ACTIVE},
            )
            engagement.last_response_at = now
            engagement.total_responses += 1
            await engagement.save()

        return {
            "saved_fields": saved_fields,
            "skipped_fields": skipped_fields,
            "cooldown_until": cooldown_until,
        }
