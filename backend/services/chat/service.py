"""ChatService orchestration and crisis state ownership."""

from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

from fastapi import HTTPException, status

from backend.core import config
from backend.core.logger import setup_logger
from backend.dtos.chat import HealthAnswerResponse
from backend.models.chat import ChatMessage, ChatSession, MessageRole
from backend.models.enums import AiConsent, FilterExpressionVerdict, FilterMedicalAction
from backend.models.health import HealthProfile
from backend.services.chat.enrich import (
    _get_rag_service as get_rag_service,
)
from backend.services.chat.enrich import (
    _get_user_context_service as get_user_context_service,
)
from backend.services.chat.enrich import (
    _has_factual_intent as has_factual_intent,
)
from backend.services.chat.enrich import (
    _is_lifestyle_query as is_lifestyle_query,
)
from backend.services.chat.enrich import (
    _rag_top_k as rag_top_k,
)
from backend.services.chat.enrich import (
    _select_topic_hint as select_topic_hint,
)
from backend.services.chat.enrich import (
    _should_build_user_context as should_build_user_context,
)
from backend.services.chat.enrich import (
    _should_run_rag as should_run_rag,
)
from backend.services.chat.enrich import (
    _try_rag_search as try_rag_search,
)
from backend.services.chat.persistence import (
    _prepare_session as prepare_session,
)
from backend.services.chat.persistence import (
    _save_response as save_response,
)
from backend.services.chat.persistence import (
    get_history as load_history,
)
from backend.services.chat.prompting import (
    _build_openai_messages as build_openai_messages,
)
from backend.services.chat.prompting import (
    _build_question_data as build_question_data,
)
from backend.services.chat.prompting import (
    _build_system_prompt as build_system_prompt,
)
from backend.services.chat.streaming import _sse_event, _stream_openai
from backend.services.content_filter import ContentFilterService, FilterResult
from backend.services.health_question import (
    BUNDLE_CHECK_FIELDS,
    MAX_DAILY_CHATS,
    HealthQuestionService,
)

logger = setup_logger(__name__)

CRISIS_COOLDOWN_HOURS = 24
MAX_HISTORY_MESSAGES = 10


class ChatService:
    """AI 채팅 서비스."""

    def __init__(self):
        self.health_question_service = HealthQuestionService()
        self.content_filter = ContentFilterService()
        self._last_crisis_at: dict[int, datetime] = {}
        self._rag_service = None
        self._user_context_service = None

    def _get_rag_service(self):
        return get_rag_service(self)

    def _should_run_rag(self, message: str, filter_result: FilterResult) -> bool:
        return should_run_rag(message, filter_result)

    def _has_factual_intent(self, message: str) -> bool:
        return has_factual_intent(message)

    def _is_lifestyle_query(self, message: str) -> bool:
        return is_lifestyle_query(message)

    def _rag_top_k(self, filter_result: FilterResult) -> int:
        return rag_top_k(filter_result)

    def _try_rag_search(self, message: str, filter_result: FilterResult):
        return try_rag_search(self, message, filter_result)

    def _get_user_context_service(self):
        return get_user_context_service(self)

    def _should_build_user_context(self, filter_result: FilterResult, profile) -> bool:
        return should_build_user_context(filter_result, profile)

    def _select_topic_hint(self, message: str) -> str | None:
        return select_topic_hint(message)

    async def send_message_stream(  # noqa: C901
        self,
        user_id: int,
        message: str,
        session_id: int | None = None,
    ) -> AsyncGenerator[str, None]:
        error = await self._validate_request(user_id, session_id)
        if error:
            yield _sse_event("error", {"message": error})
            return

        profile, consent_error = await self._validate_chat_access(user_id)
        filter_result = self.content_filter.check_message(message)

        logger.info(
            "content_filter",
            user_id=user_id,
            verdict=filter_result.expression_verdict.value,
            action=filter_result.medical_action.value,
        )

        if filter_result.medical_action == FilterMedicalAction.CRISIS_ESCALATE:
            async for event in self._handle_crisis(user_id, message, session_id):
                yield event
            return

        if filter_result.expression_verdict == FilterExpressionVerdict.BLOCK:
            yield _sse_event(
                "error",
                {
                    "code": "content_blocked",
                    "message": filter_result.user_facing_message or "부적절한 표현이 포함되어 있어요.",
                },
            )
            return

        if consent_error:
            yield _sse_event("error", {"code": "ai_consent_required", "message": consent_error})
            return

        session = await self._prepare_session(user_id, message, session_id)
        if not session:
            yield _sse_event("error", {"message": "세션을 찾을 수 없어요."})
            return

        await ChatMessage.create(session=session, role=MessageRole.USER, content=message)

        eligible_bundles: list[str] = []
        suppress_emotional = (
            config.CONTENT_FILTER_ROUTING_APPLY_ENABLED
            and filter_result.emotional_priority
        )
        if not self._is_in_crisis_cooldown(user_id) and not suppress_emotional:
            eligible_bundles = await self.health_question_service.get_eligible_bundles(user_id)

        rag_result = self._try_rag_search(message, filter_result)

        user_context = None
        if self._should_build_user_context(filter_result, profile):
            uc_svc = self._get_user_context_service()
            if uc_svc:
                try:
                    topic_hint = self._select_topic_hint(message)
                    user_context = uc_svc.build_context(profile, topic_hint=topic_hint)
                    if user_context and user_context.has_context:
                        logger.info("user_context_built")
                    else:
                        logger.info("user_context_none")
                except Exception:
                    logger.warning("user_context_failed")
        else:
            logger.info("user_context_skipped")

        history = await ChatMessage.filter(session=session).order_by("created_at").limit(MAX_HISTORY_MESSAGES).all()
        openai_messages = await self._build_openai_messages(
            profile,
            history,
            eligible_bundles,
            filter_result,
            rag_result,
            user_context,
        )

        full_response = ""
        async for chunk in self._stream_openai(openai_messages):
            if chunk is None:
                yield _sse_event("error", {"message": "AI 응답 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."})
                return
            full_response += chunk
            yield _sse_event("token", {"content": chunk})

        await self._save_response(session, full_response, eligible_bundles)
        yield _sse_event("done", self._build_done_data(session.id, eligible_bundles))

    async def _validate_request(self, user_id: int, session_id: int | None) -> str | None:
        del session_id
        if not config.OPENAI_API_KEY:
            return "AI 서비스가 아직 설정되지 않았어요."

        today_count = await ChatMessage.filter(
            session__user_id=user_id,
            role=MessageRole.USER,
            created_at__gte=datetime.now(tz=config.TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0),
        ).count()
        if today_count >= MAX_DAILY_CHATS:
            return "오늘 대화 횟수를 초과했어요. 내일 다시 대화해줘 🙂"

        return None

    async def _validate_chat_access(self, user_id: int) -> tuple[HealthProfile | None, str | None]:
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if profile and profile.ai_consent == AiConsent.DECLINED:
            return profile, "AI 채팅 이용에는 동의가 필요해요. 설정에서 AI 이용 동의를 확인해주세요."
        return profile, None

    async def _handle_crisis(
        self,
        user_id: int,
        message: str,
        session_id: int | None,
    ) -> AsyncGenerator[str, None]:
        from backend.services.content_filter import CRISIS_RESPONSE

        if session_id:
            session = await ChatSession.get_or_none(id=session_id, user_id=user_id)
        else:
            session = None
        if not session:
            session = await ChatSession.create(user_id=user_id, title=message[:50])

        await ChatMessage.create(session=session, role=MessageRole.USER, content=message)

        for index in range(0, len(CRISIS_RESPONSE), 80):
            yield _sse_event("token", {"content": CRISIS_RESPONSE[index : index + 80]})

        await ChatMessage.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=CRISIS_RESPONSE,
            has_health_questions=False,
        )

        self._last_crisis_at[user_id] = datetime.now(tz=config.TIMEZONE)
        yield _sse_event("done", {"session_id": session.id})

    def _is_in_crisis_cooldown(self, user_id: int) -> bool:
        last = self._last_crisis_at.get(user_id)
        if last is None:
            return False
        now = datetime.now(tz=config.TIMEZONE)
        return (now - last) < timedelta(hours=CRISIS_COOLDOWN_HOURS)

    async def _prepare_session(self, user_id: int, message: str, session_id: int | None) -> ChatSession | None:
        return await prepare_session(user_id, message, session_id)

    async def _build_openai_messages(
        self,
        profile,
        history: list,
        eligible_bundles: list[str],
        filter_result: FilterResult | None = None,
        rag_result=None,
        user_context=None,
    ) -> list[dict[str, str]]:
        return await build_openai_messages(
            profile,
            history,
            eligible_bundles,
            filter_result,
            rag_result,
            user_context,
        )

    async def _stream_openai(self, messages: list[dict[str, str]]) -> AsyncGenerator[str | None, None]:
        async for chunk in _stream_openai(messages):
            yield chunk

    async def _save_response(self, session: ChatSession, content: str, eligible_bundles: list[str]) -> None:
        await save_response(session, content, eligible_bundles)

    def _build_done_data(self, session_id: int, eligible_bundles: list[str]) -> dict:
        data: dict = {"session_id": session_id}
        if eligible_bundles:
            data["health_questions"] = self._build_question_data(eligible_bundles)
        return data

    async def get_history(
        self,
        user_id: int,
        session_id: int,
        limit: int = 50,
        before_id: int | None = None,
    ):
        return await load_history(user_id, session_id, limit=limit, before_id=before_id)

    async def save_health_answer(
        self,
        user_id: int,
        bundle_key: str,
        answers: dict[str, str | int | bool],
    ) -> HealthAnswerResponse:
        if bundle_key not in BUNDLE_CHECK_FIELDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"유효하지 않은 묶음 키: {bundle_key}",
            )

        result = await self.health_question_service.save_health_answers(
            user_id=user_id,
            bundle_key=bundle_key,
            answers=answers,
        )
        return HealthAnswerResponse(
            saved_fields=result["saved_fields"],
            skipped_fields=result["skipped_fields"],
            cooldown_until=result["cooldown_until"],
        )

    async def _build_system_prompt(self, profile, eligible_bundles: list[str]) -> str:
        return await build_system_prompt(profile, eligible_bundles)

    def _build_question_data(self, eligible_bundles: list[str]) -> list[dict]:
        return build_question_data(eligible_bundles)
