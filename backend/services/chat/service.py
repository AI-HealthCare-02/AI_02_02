"""ChatService orchestration and crisis state ownership."""

from __future__ import annotations

import asyncio
import hashlib
import time
from collections.abc import AsyncGenerator
from contextlib import suppress
from datetime import datetime, timedelta

from fastapi import HTTPException, status

from backend.core import config
from backend.core.config import ChatAppContextMode
from backend.core.logger import setup_logger
from backend.dtos.chat import HealthAnswerResponse
from backend.models.chat import ChatMessage, ChatSession, MessageRole
from backend.models.enums import AiConsent, FilterExpressionVerdict, FilterMedicalAction
from backend.models.health import HealthProfile
from backend.models.users import User
from backend.services.challenge import ChallengeService
from backend.services.chat.app_context import (
    ChatAppChallengeStateItem,
    ChatAppContext,
    ChatAppStateSnapshot,
    build_app_help_layer,
    build_app_state_layer,
    build_default_help_snapshot,
)
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
from backend.services.chat.intent import classify_chat_app_intent, select_app_state_domains
from backend.services.chat.openai_client import has_any_llm_target
from backend.services.chat.persistence import (
    _prepare_session as prepare_session,
)
from backend.services.chat.persistence import (
    _save_response as save_response,
)
from backend.services.chat.persistence import (
    delete_session as remove_session,
)
from backend.services.chat.persistence import (
    get_history as load_history,
)
from backend.services.chat.persistence import (
    list_sessions as load_sessions,
)
from backend.services.chat.prep_types import HistoryTurnSnapshot
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
from backend.services.chat.token_budget import (
    estimate_message_tokens,
    estimate_text_tokens,
    record_bench_budget_snapshot,
)
from backend.services.chat_graph.adapter import (
    prepare_openai_messages as prepare_langgraph_messages,
)
from backend.services.chat_graph.adapter import (
    should_enter_langgraph_adapter,
)
from backend.services.content_filter import ContentFilterService, FilterResult
from backend.services.doit import DoitService
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
        self.challenge_service = ChallengeService()
        self.doit_service = DoitService()
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

    @staticmethod
    def _hash_user_id(user_id: int) -> str:
        return hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()[:12]

    async def _build_chat_app_context(
        self,
        *,
        user_id: int,
        message_text: str,
        profile: HealthProfile | None,
        suppress_reason: str | None = None,
    ) -> ChatAppContext | None:
        mode = config.CHAT_APP_CONTEXT_MODE
        if mode == ChatAppContextMode.OFF:
            return None

        intent = classify_chat_app_intent(message_text)
        if intent.value == "none":
            return None

        help_snapshot = build_default_help_snapshot()
        if mode != ChatAppContextMode.LIVE_STATE:
            return ChatAppContext(intent=intent, help_snapshot=help_snapshot)

        if not await self._can_use_live_app_state(user_id=user_id, profile=profile):
            return ChatAppContext(intent=intent, help_snapshot=help_snapshot)

        # state_domains 게이트: 실제 필요한 도메인이 없으면 help만 반환해 DB 조회 스킵
        state_domains = select_app_state_domains(message_text, intent)
        if not state_domains:
            return ChatAppContext(intent=intent, help_snapshot=help_snapshot)

        state_snapshot = await self._build_chat_app_state_snapshot(
            user_id=user_id,
            profile=profile,
            intent=intent,
            suppress_reason=suppress_reason,
            domains=state_domains,
        )
        return ChatAppContext(
            intent=intent,
            help_snapshot=help_snapshot,
            state_snapshot=state_snapshot,
            has_live_state=state_snapshot is not None,
        )

    async def _can_use_live_app_state(
        self,
        *,
        user_id: int,
        profile: HealthProfile | None,
    ) -> bool:
        if profile is None or profile.ai_consent != AiConsent.AGREED:
            return False
        user = await User.get_or_none(id=user_id)
        return bool(user and user.onboarding_completed)

    async def _build_chat_app_state_snapshot(
        self,
        *,
        user_id: int,
        profile: HealthProfile | None,
        intent,
        suppress_reason: str | None = None,
        domains: list[str] | None = None,
    ) -> ChatAppStateSnapshot | None:
        if profile is None:
            return None

        # domains가 명시되면 해당 영역만 조회. 미지정(None)이면 기존 intent 기반 호환 동작.
        if domains is None:
            should_load_challenge = intent.value in {"challenge_state", "mixed"}
            should_load_pending = intent.value in {"pending_surveys", "mixed"}
            should_load_doit = intent.value in {"doit_os_state", "mixed"}
        else:
            should_load_challenge = "challenge" in domains
            should_load_pending = "pending" in domains
            should_load_doit = "doit_os" in domains

        snapshot = ChatAppStateSnapshot(
            onboarding_completed=True,
            user_group=str(profile.user_group.value if hasattr(profile.user_group, "value") else profile.user_group),
            initial_risk_level=(
                str(profile.initial_risk_level.value)
                if getattr(profile, "initial_risk_level", None) is not None
                and hasattr(profile.initial_risk_level, "value")
                else str(profile.initial_risk_level) if getattr(profile, "initial_risk_level", None) is not None else None
            ),
        )

        if should_load_challenge:
            overview = await self.challenge_service.get_overview(user_id=user_id)
            snapshot = ChatAppStateSnapshot(
                onboarding_completed=snapshot.onboarding_completed,
                user_group=snapshot.user_group,
                initial_risk_level=snapshot.initial_risk_level,
                active_count=overview.stats.get("active_count"),
                remaining_active_slots=overview.stats.get("remaining_active_slots"),
                active_challenges=tuple(
                    ChatAppChallengeStateItem(
                        name=item.name,
                        progress_pct=float(item.progress_pct),
                        today_checked=item.today_checked,
                        current_streak=item.current_streak,
                    )
                    for item in overview.active
                ),
            )

        if should_load_pending:
            summary = await self.health_question_service.get_daily_missing_summary(user_id=user_id)
            card_availability = await self.health_question_service.get_card_availability(
                user_id=user_id,
                suppress_reason=suppress_reason,
            )
            snapshot = ChatAppStateSnapshot(
                onboarding_completed=snapshot.onboarding_completed,
                user_group=snapshot.user_group,
                initial_risk_level=snapshot.initial_risk_level,
                active_count=snapshot.active_count,
                remaining_active_slots=snapshot.remaining_active_slots,
                active_challenges=snapshot.active_challenges,
                pending_count=int(summary["count"]),
                pending_question_labels=tuple(summary.get("question_labels") or ()),
                pending_bundle_names=tuple(summary.get("bundle_names") or ()),
                card_is_available=bool(card_availability.get("is_available")),
                card_next_bundle_key=card_availability.get("next_bundle_key"),
                card_next_bundle_name=card_availability.get("next_bundle_name"),
                card_blocked_reason=card_availability.get("blocked_reason"),
                card_blocked_reason_text=card_availability.get("blocked_reason_text"),
                card_available_after=card_availability.get("available_after"),
                card_sequence_started_at=card_availability.get("sequence_started_at"),
            )

        if should_load_doit:
            ai_summary = await self.doit_service.get_ai_summary(user_id=user_id)
            snapshot = ChatAppStateSnapshot(
                onboarding_completed=snapshot.onboarding_completed,
                user_group=snapshot.user_group,
                initial_risk_level=snapshot.initial_risk_level,
                active_count=snapshot.active_count,
                remaining_active_slots=snapshot.remaining_active_slots,
                active_challenges=snapshot.active_challenges,
                pending_count=snapshot.pending_count,
                pending_question_labels=snapshot.pending_question_labels,
                pending_bundle_names=snapshot.pending_bundle_names,
                card_is_available=snapshot.card_is_available,
                card_next_bundle_key=snapshot.card_next_bundle_key,
                card_next_bundle_name=snapshot.card_next_bundle_name,
                card_blocked_reason=snapshot.card_blocked_reason,
                card_blocked_reason_text=snapshot.card_blocked_reason_text,
                card_available_after=snapshot.card_available_after,
                card_sequence_started_at=snapshot.card_sequence_started_at,
                doit_unclassified_count=ai_summary.unclassified_count,
                doit_today_todos=tuple(ai_summary.today_todos),
                doit_overdue_schedules=ai_summary.overdue_schedules,
                doit_active_projects=tuple(ai_summary.active_projects),
                doit_recent_notes_count=ai_summary.recent_notes_count,
            )

        return snapshot

    @staticmethod
    def _app_context_state_keys(context: ChatAppContext | None) -> tuple[str, ...]:
        if context is None or context.state_snapshot is None:
            return ()
        return context.state_snapshot.state_keys()

    async def send_message_stream(  # noqa: C901
        self,
        user_id: int,
        message: str,
        session_id: int | None = None,
        chat_req_id: str | None = None,
        doit_context: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        request_started_at = time.perf_counter()
        first_token_at: float | None = None
        logger.info("chat_request_total", chat_req_id=chat_req_id, user_id=user_id)

        request_validation_task = asyncio.create_task(self._validate_request(user_id, session_id))
        chat_access_task = asyncio.create_task(self._validate_chat_access(user_id))
        filter_result = self.content_filter.check_message(message)

        request_error = await request_validation_task
        if request_error:
            if not chat_access_task.done():
                chat_access_task.cancel()
                with suppress(asyncio.CancelledError):
                    await chat_access_task
            yield _sse_event("error", {"message": request_error})
            logger.info("chat_terminal_total", chat_req_id=chat_req_id, outcome="request_rejected", first_token_emitted=False)
            return

        profile, consent_error = await chat_access_task

        logger.info(
            "content_filter",
            user_id=user_id,
            verdict=filter_result.expression_verdict.value,
            action=filter_result.medical_action.value,
        )

        if filter_result.medical_action == FilterMedicalAction.CRISIS_ESCALATE:
            async for event in self._handle_crisis(user_id, message, session_id):
                yield event
            logger.info("chat_terminal_total", chat_req_id=chat_req_id, outcome="crisis_escalate", first_token_emitted=True)
            return

        if filter_result.expression_verdict == FilterExpressionVerdict.BLOCK:
            yield _sse_event(
                "error",
                {
                    "code": "content_blocked",
                    "message": filter_result.user_facing_message or "부적절한 표현이 포함되어 있어요.",
                },
            )
            logger.info("chat_terminal_total", chat_req_id=chat_req_id, outcome="content_blocked", first_token_emitted=False)
            return

        if consent_error:
            yield _sse_event("error", {"code": "ai_consent_required", "message": consent_error})
            logger.info("chat_terminal_total", chat_req_id=chat_req_id, outcome="ai_consent_required", first_token_emitted=False)
            return

        session = await self._prepare_session(user_id, message, session_id)
        if not session:
            yield _sse_event("error", {"message": "세션을 찾을 수 없어요."})
            logger.info("chat_terminal_total", chat_req_id=chat_req_id, outcome="session_missing", first_token_emitted=False)
            return

        # history는 "과거 대화"만, message_text는 "현재 질문"만 담당하게 순서를 고정한다.
        # USER 저장과 history 조회를 겹치면 현재 질문이 history와 message_text에
        # 동시에 들어가 prompt가 중복될 수 있어 overlap 최적화는 제거한다.
        suppress_emotional = config.CONTENT_FILTER_ROUTING_APPLY_ENABLED and filter_result.emotional_priority
        history = await self._get_prompt_history(session)
        if not self._is_in_crisis_cooldown(user_id) and not suppress_emotional:
            eligible_bundles = await self.health_question_service.get_eligible_bundles(
                user_id,
                include_current_message_anchor=True,
            )
        else:
            eligible_bundles = []

        await ChatMessage.create(session=session, role=MessageRole.USER, content=message)

        base_system_prompt = await self._build_system_prompt(profile, eligible_bundles)
        app_context_started_at = time.perf_counter()
        app_context: ChatAppContext | None = None
        app_help_text = ""
        app_state_text = ""
        if config.CHAT_APP_CONTEXT_MODE != ChatAppContextMode.OFF:
            try:
                app_context = await self._build_chat_app_context(
                    user_id=user_id,
                    message_text=message,
                    profile=profile,
                    suppress_reason="suppressed_by_chat_route" if suppress_emotional else None,
                )
            except Exception as exc:
                logger.warning(
                    "chat_app_context_unavailable",
                    chat_req_id=chat_req_id,
                    user_id_hash=self._hash_user_id(user_id),
                    mode=config.CHAT_APP_CONTEXT_MODE.value,
                    error=type(exc).__name__,
                )
            else:
                app_help_text = build_app_help_layer(app_context)
                app_state_text = build_app_state_layer(app_context)

            state_domains_log: list[str] = []
            if app_context is not None and app_context.has_live_state:
                state_domains_log = list(select_app_state_domains(message, app_context.intent))
            logger.info(
                "chat_app_context",
                chat_req_id=chat_req_id,
                user_id_hash=self._hash_user_id(user_id),
                mode=config.CHAT_APP_CONTEXT_MODE.value,
                intent=app_context.intent.value if app_context is not None else "none",
                state_domains=state_domains_log,
                had_help=bool(app_help_text),
                had_state=bool(app_context and app_context.has_live_state and app_state_text),
                state_keys=self._app_context_state_keys(app_context),
                assemble_ms=round((time.perf_counter() - app_context_started_at) * 1000, 2),
                prompt_tokens_added=estimate_text_tokens(app_help_text + app_state_text),
                schema_version=(
                    app_context.state_snapshot.schema_version
                    if app_context and app_context.state_snapshot is not None
                    else "chat_app_context_v1"
                ),
            )

        prep_started_at = time.perf_counter()
        openai_messages = await self._build_openai_messages(
            profile,
            history,
            eligible_bundles,
            filter_result,
            user_id=user_id,
            message_text=message,
            base_system_prompt=base_system_prompt,
            app_help_text=app_help_text,
            app_state_text=app_state_text,
            chat_req_id=chat_req_id,
            doit_context=doit_context,
        )
        logger.info("chat_prep_ms", chat_req_id=chat_req_id, prep_ms=round((time.perf_counter() - prep_started_at) * 1000, 2))
        bench_budget_enabled = config.CHAT_BENCH_BUDGET_ENABLED
        bench_prompt_messages = tuple(dict(message) for message in openai_messages) if bench_budget_enabled else ()
        bench_route = filter_result.message_route.value if filter_result.message_route else None

        full_response = ""
        try:
            stream_iter = self._stream_openai(openai_messages, chat_req_id=chat_req_id)
        except TypeError:
            stream_iter = self._stream_openai(openai_messages)

        async for chunk in stream_iter:
            if chunk is None:
                yield _sse_event("error", {"message": "AI 응답 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."})
                logger.info(
                    "chat_terminal_total",
                    chat_req_id=chat_req_id,
                    outcome="stream_error",
                    first_token_emitted=first_token_at is not None,
                )
                return
            if first_token_at is None:
                first_token_at = time.perf_counter()
                logger.info(
                    "chat_server_ttft_ms",
                    chat_req_id=chat_req_id,
                    ttft_ms=round((first_token_at - request_started_at) * 1000, 2),
                )
            full_response += chunk
            yield _sse_event("token", {"content": chunk})

        await self._save_response(session, full_response, eligible_bundles)
        yield _sse_event("done", self._build_done_data(session.id, eligible_bundles))
        if bench_budget_enabled:
            prompt_tokens_estimate = estimate_message_tokens(bench_prompt_messages)
            completion_tokens_estimate = estimate_text_tokens(full_response)
            record_bench_budget_snapshot(
                chat_req_id,
                prompt_tokens_estimate=prompt_tokens_estimate,
                openai_message_count=len(bench_prompt_messages),
                route=bench_route,
                emotional_priority=filter_result.emotional_priority,
                completion_chars=len(full_response),
                completion_tokens_estimate=completion_tokens_estimate,
            )
            logger.info(
                "chat_prompt_budget",
                chat_req_id=chat_req_id,
                prompt_tokens_estimate=prompt_tokens_estimate,
                openai_message_count=len(bench_prompt_messages),
                route=bench_route,
                emotional_priority=filter_result.emotional_priority,
                prompt_instruction_present=bool(filter_result.prompt_instruction),
                langgraph_mode=config.CHAT_LANGGRAPH_MODE.value,
            )
            logger.info(
                "chat_completion_budget",
                chat_req_id=chat_req_id,
                completion_chars=len(full_response),
                completion_tokens_estimate=completion_tokens_estimate,
            )
        logger.info("chat_terminal_total", chat_req_id=chat_req_id, outcome="completed", first_token_emitted=first_token_at is not None)
        if first_token_at is not None:
            logger.info("chat_stream_tail_ms", chat_req_id=chat_req_id, tail_ms=round((time.perf_counter() - first_token_at) * 1000, 2))

    async def _validate_request(self, user_id: int, session_id: int | None) -> str | None:
        del session_id
        if not has_any_llm_target():
            return "AI 서비스가 아직 설정되지 않았어요."

        return await self._validate_daily_limit(user_id)

    async def _validate_daily_limit(self, user_id: int) -> str | None:
        today_count = await ChatMessage.filter(
            session__user_id=user_id,
            role=MessageRole.USER,
            created_at__gte=datetime.now(tz=config.TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0),
        ).count()
        if today_count >= MAX_DAILY_CHATS:
            return "오늘 대화 가능 횟수를 초과했어요. 내일 다시 대화해 주세요."

        return None

    async def _validate_chat_access(self, user_id: int) -> tuple[HealthProfile | None, str | None]:
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if profile and profile.ai_consent == AiConsent.DECLINED:
            return profile, "AI 채팅 이용에는 동의가 필요해요. 설정에서 AI 이용 동의를 확인해 주세요."
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

    async def _get_prompt_history(self, session: ChatSession) -> list[HistoryTurnSnapshot]:
        query = ChatMessage.filter(session=session).order_by("-created_at", "-id").limit(MAX_HISTORY_MESSAGES)
        if not hasattr(query, "values"):
            messages = list(await query.all())
            messages.reverse()
            return [
                HistoryTurnSnapshot(
                    role=str(message.role.value if hasattr(message.role, "value") else message.role),
                    content=str(message.content),
                )
                for message in messages
            ]
        rows = list(await query.values("role", "content"))
        rows.reverse()
        return [
            HistoryTurnSnapshot(
                role=str(row["role"].value if hasattr(row["role"], "value") else row["role"]),
                content=str(row["content"]),
            )
            for row in rows
        ]

    async def _build_openai_messages(
        self,
        profile,
        history: list,
        eligible_bundles: list[str],
        filter_result: FilterResult | None = None,
        rag_result=None,
        user_context=None,
        *,
        user_id: int | None = None,
        message_text: str | None = None,
        base_system_prompt: str | None = None,
        app_help_text: str | None = None,
        app_state_text: str | None = None,
        chat_req_id: str | None = None,
        doit_context: dict | None = None,
    ) -> list[dict[str, str]]:
        if (
            user_id is not None
            and message_text is not None
            and filter_result is not None
            and base_system_prompt is not None
            and self._should_use_langgraph_prep(user_id, filter_result)
        ):
            return await prepare_langgraph_messages(
                user_id=user_id,
                message_text=message_text,
                base_system_prompt=base_system_prompt,
                history=history,
                filter_result=filter_result,
                profile=profile,
                app_help_text=app_help_text,
                app_state_text=app_state_text,
                chat_req_id=chat_req_id,
            )
        return await build_openai_messages(
            profile,
            history,
            eligible_bundles,
            filter_result,
            rag_result,
            user_context,
            message_text=message_text,
            base_system_prompt=base_system_prompt,
            app_help_text=app_help_text,
            app_state_text=app_state_text,
            doit_context=doit_context,
        )

    def _should_use_langgraph_prep(self, user_id: int, filter_result: FilterResult) -> bool:
        return should_enter_langgraph_adapter(user_id, filter_result)

    async def _stream_openai(
        self,
        messages: list[dict[str, str]],
        *,
        chat_req_id: str | None = None,
    ) -> AsyncGenerator[str | None, None]:
        async for chunk in _stream_openai(messages, chat_req_id=chat_req_id):
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

    async def get_sessions(self, user_id: int, limit: int = 20):
        return await load_sessions(user_id, limit=limit)

    async def delete_session(self, user_id: int, session_id: int) -> None:
        await remove_session(user_id, session_id)

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
        from backend.services.health_daily import HealthDailyService

        today_snapshot = await HealthDailyService().get_daily_log(
            user_id=user_id,
            log_date=datetime.now(tz=config.TIMEZONE).date(),
        )
        return HealthAnswerResponse(
            saved_fields=result["saved_fields"],
            skipped_fields=result["skipped_fields"],
            cooldown_until=result["cooldown_until"],
            daily_log=today_snapshot,
            pending_questions=today_snapshot.pending_questions,
            card_availability=today_snapshot.card_availability,
        )

    async def _build_system_prompt(self, profile, eligible_bundles: list[str]) -> str:
        return await build_system_prompt(profile, eligible_bundles)

    def _build_question_data(self, eligible_bundles: list[str]) -> list[dict]:
        return build_question_data(eligible_bundles)
