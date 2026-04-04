"""AI 채팅 서비스 — 메시지 전송, 스트리밍, 건강질문 삽입 오케스트레이션.

흐름: 사용자 메시지 → 콘텐츠 필터 → 분기(CRISIS/BLOCK/WARN/ALLOW) → DB 저장 → OpenAI 스트리밍 → 응답 저장 → SSE
"""

import json
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

from fastapi import HTTPException, status

from app.core import config
from app.core.logger import setup_logger
from app.dtos.chat import ChatHistoryResponse, ChatMessageDTO, HealthAnswerResponse
from app.models.chat import ChatMessage, ChatSession, MessageRole
from app.models.enums import AiConsent, FilterExpressionVerdict, FilterMedicalAction, MessageRoute
from app.models.health import HealthProfile
from app.services.content_filter import ContentFilterService, FilterResult
from app.services.health_question import (
    BUNDLE_CHECK_FIELDS,
    HEALTH_QUESTION_BUNDLES,
    MAX_DAILY_CHATS,
    HealthQuestionService,
)

logger = setup_logger(__name__)

# 위기 후 건강질문 삽입 금지 기간 (24시간)
CRISIS_COOLDOWN_HOURS = 24

# 대화 기록 최대 로드 수 (OpenAI 컨텍스트 윈도우 관리)
MAX_HISTORY_MESSAGES = 10

# ai_worker의 시스템 프롬프트를 직접 정의
# (Docker 컨테이너 격리로 ai_worker/ 직접 import 불가)
SYSTEM_PROMPT_TEMPLATE = """\
당신은 '다나아'의 AI 건강 생활습관 코치입니다.

## 역할
- 친근한 건강 생활습관 코치 (의사가 아님)
- 반말 사용, 자연스럽고 따뜻한 한국어
- 이모지를 적절히 활용

## 사용자 정보
- 그룹: {user_group}

## 절대 금지
- 의료적 진단, 처방, 약물 추천
- "~해야 합니다" 대신 "~해보는 건 어때?" / "~을 추천해요"

## 면책조항
건강 관련 질문에 답할 때 끝에 자연스럽게:
"참고로 저는 생활습관 코치예요 😊 의학적 판단이 필요하면 전문가 상담을 추천해요!"

## 응답 스타일
- 짧고 핵심적으로 (3-4문장 이내)
- 공감 먼저, 정보는 그다음
- 칭찬과 격려를 자주
{health_question_instruction}"""

HEALTH_QUESTION_INSTRUCTION = """
## 건강질문 전달
아래 건강질문을 답변 끝에 자연스럽게 이어서 물어봐줘.
"그건 그렇고~", "아 맞다!", "참, 오늘은 어때?" 같은 전환 멘트를 쓰되,
기계적으로 나열하지 말고 대화처럼 자연스럽게.

질문 목록:
{questions}
"""

# ──────────────────────────────────────────────
# 메시지 라우팅 지시문
# ──────────────────────────────────────────────

ROUTE_INSTRUCTIONS: dict[MessageRoute, str] = {
    MessageRoute.HEALTH_SPECIFIC: (
        "\n\n## 추가 지시 (구체적 건강 수치)\n"
        "사용자가 구체적 수치, 증상, 약 복용을 언급했어. "
        "의학적 판단을 절대 하지 말고, 생활습관 범위에서만 답변해. "
        "필요하면 '전문 의료진 상담을 권장해요'를 자연스럽게 포함해줘."
    ),
}

EMOTIONAL_INSTRUCTION = (
    "\n\n## 추가 지시 (감정 우선)\n"
    "사용자가 감정적 어려움을 표현했어. "
    "공감과 위로를 최우선으로 응답해. "
    "건강 정보보다 감정 인정이 먼저야. "
    "이번 응답에서 건강 관련 질문은 하지 마."
)


class ChatService:
    """AI 채팅 서비스."""

    def __init__(self):
        self.health_question_service = HealthQuestionService()
        self.content_filter = ContentFilterService()
        # 위기 발생 시각 기록 (세션 레벨 메모리 — DB 저장 아님)
        self._last_crisis_at: dict[int, datetime] = {}

    async def send_message_stream(
        self,
        user_id: int,
        message: str,
        session_id: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """사용자 메시지를 받아 AI 응답을 SSE 스트리밍으로 반환."""
        # [1] 사전 검증 (API key + 일일 제한)
        error = await self._validate_request(user_id, session_id)
        if error:
            yield _sse_event("error", {"message": error})
            return

        # [2] 채팅 접근 검증 (ai_consent + HealthProfile 반환)
        profile, consent_error = await self._validate_chat_access(user_id)

        # [3] 콘텐츠 필터 — ai_consent 무관하게 항상 실행 (위기 감지 의무)
        filter_result = self.content_filter.check_message(message)

        # verdict/action 로깅 (원문은 절대 기록하지 않음)
        logger.info(
            "content_filter",
            user_id=user_id,
            verdict=filter_result.expression_verdict.value,
            action=filter_result.medical_action.value,
        )

        # [분기: CRISIS_ESCALATE] — 동의 여부와 무관
        if filter_result.medical_action == FilterMedicalAction.CRISIS_ESCALATE:
            async for event in self._handle_crisis(user_id, message, session_id):
                yield event
            return

        # [분기: BLOCK]
        if filter_result.expression_verdict == FilterExpressionVerdict.BLOCK:
            yield _sse_event(
                "error",
                {
                    "code": "content_blocked",
                    "message": filter_result.user_facing_message or "부적절한 표현이 포함되어 있어요.",
                },
            )
            return

        # [분기: ai_consent=declined] — 위기가 아니면 동의 필요
        if consent_error:
            yield _sse_event("error", {"code": "ai_consent_required", "message": consent_error})
            return

        # [통과: ALLOW 또는 WARN]
        session = await self._prepare_session(user_id, message, session_id)
        if not session:
            yield _sse_event("error", {"message": "대화를 찾을 수 없어요."})
            return

        await ChatMessage.create(session=session, role=MessageRole.USER, content=message)

        # 건강질문 — 위기 쿨링오프 + emotional_priority 억제
        eligible_bundles: list[str] = []
        suppress_emotional = (
            config.CONTENT_FILTER_ROUTING_APPLY_ENABLED
            and filter_result.emotional_priority
        )
        if not self._is_in_crisis_cooldown(user_id) and not suppress_emotional:
            eligible_bundles = await self.health_question_service.get_eligible_bundles(user_id)

        # 컨텍스트 구성 (WARN/MEDICAL_NOTE 시 추가 지시문 포함)
        history = await ChatMessage.filter(session=session).order_by("created_at").limit(MAX_HISTORY_MESSAGES).all()
        openai_messages = await self._build_openai_messages(
            user_id,
            history,
            eligible_bundles,
            filter_result,
        )

        # OpenAI 스트리밍 + 응답 저장
        full_response = ""
        async for chunk in self._stream_openai(openai_messages):
            if chunk is None:
                yield _sse_event("error", {"message": "AI 응답 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."})
                return
            full_response += chunk
            yield _sse_event("token", {"content": chunk})

        # 응답 저장 + done 이벤트
        await self._save_response(session, full_response, eligible_bundles)
        yield _sse_event("done", self._build_done_data(session.id, eligible_bundles))

    async def _validate_request(self, user_id: int, session_id: int | None) -> str | None:
        """사전 검증 — API key + 일일 제한. 에러 메시지 반환 (None이면 통과)."""
        if not config.OPENAI_API_KEY:
            return "AI 서비스가 아직 설정되지 않았어요."

        today_count = await ChatMessage.filter(
            session__user_id=user_id,
            role=MessageRole.USER,
            created_at__gte=datetime.now(tz=config.TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0),
        ).count()
        if today_count >= MAX_DAILY_CHATS:
            return "오늘 대화 횟수를 초과했어요. 내일 다시 대화해요! 😊"

        return None

    async def _validate_chat_access(self, user_id: int) -> tuple[HealthProfile | None, str | None]:
        """ai_consent 확인 — HealthProfile + 에러 메시지 반환."""
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if profile and profile.ai_consent == AiConsent.DECLINED:
            return profile, "AI 채팅 이용에 동의가 필요해요. 설정에서 AI 이용 동의를 확인해주세요."
        return profile, None

    async def _handle_crisis(self, user_id: int, message: str, session_id: int | None) -> AsyncGenerator[str, None]:
        """위기 경로 — 세션+메시지 저장, 고정 응답 스트리밍, OpenAI 미호출."""
        from app.services.content_filter import CRISIS_RESPONSE

        # 세션 생성/조회
        if session_id:
            session = await ChatSession.get_or_none(id=session_id, user_id=user_id)
        else:
            session = None
        if not session:
            session = await ChatSession.create(user_id=user_id, title=message[:50])

        # 사용자 메시지 저장
        await ChatMessage.create(session=session, role=MessageRole.USER, content=message)

        # 고정 응답을 80자 청크로 스트리밍
        for i in range(0, len(CRISIS_RESPONSE), 80):
            yield _sse_event("token", {"content": CRISIS_RESPONSE[i : i + 80]})

        # 고정 응답 DB 저장
        await ChatMessage.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=CRISIS_RESPONSE,
            has_health_questions=False,
        )

        # 쿨링오프 시각 기록
        self._last_crisis_at[user_id] = datetime.now(tz=config.TIMEZONE)

        # done 이벤트 — health_questions 미포함
        yield _sse_event("done", {"session_id": session.id})

    def _is_in_crisis_cooldown(self, user_id: int) -> bool:
        """위기 후 24시간 쿨링오프 확인."""
        last = self._last_crisis_at.get(user_id)
        if last is None:
            return False
        now = datetime.now(tz=config.TIMEZONE)
        return (now - last) < timedelta(hours=CRISIS_COOLDOWN_HOURS)

    async def _prepare_session(self, user_id: int, message: str, session_id: int | None) -> ChatSession | None:
        """세션 get_or_create."""
        if session_id:
            return await ChatSession.get_or_none(id=session_id, user_id=user_id)
        return await ChatSession.create(user_id=user_id, title=message[:50])

    async def _build_openai_messages(
        self,
        user_id: int,
        history: list,
        eligible_bundles: list[str],
        filter_result: FilterResult | None = None,
    ) -> list[dict[str, str]]:
        """OpenAI 메시지 리스트 구성. route/emotional/filter 지시문 순서대로 append."""
        system_prompt = await self._build_system_prompt(user_id, eligible_bundles)

        # 프롬프트 순서: BASE → 건강질문 → route 지시문 → emotional 지시문 → filter 지시문
        if (
            filter_result
            and config.CONTENT_FILTER_ROUTING_APPLY_ENABLED
            and filter_result.message_route
        ):
            route_instruction = ROUTE_INSTRUCTIONS.get(filter_result.message_route)
            if route_instruction:
                system_prompt += route_instruction
            if filter_result.emotional_priority:
                system_prompt += EMOTIONAL_INSTRUCTION

        # 기존 filter instruction 항상 마지막 (의료안전 최우선)
        if filter_result and filter_result.prompt_instruction:
            system_prompt += filter_result.prompt_instruction
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for msg in history:
            if msg.role != MessageRole.SYSTEM:
                messages.append({"role": msg.role, "content": msg.content})
        return messages

    async def _stream_openai(self, messages: list[dict[str, str]]) -> AsyncGenerator[str | None, None]:
        """OpenAI 스트리밍 호출. 에러 시 None yield."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
            response = await client.chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
                stream=True,
            )
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception:
            logger.exception("OpenAI API 호출 실패")
            yield None

    async def _save_response(self, session: ChatSession, content: str, eligible_bundles: list[str]) -> None:
        """AI 응답을 DB에 저장."""
        has_hq = len(eligible_bundles) > 0
        await ChatMessage.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=content,
            has_health_questions=has_hq,
            bundle_keys=eligible_bundles if has_hq else None,
        )

    def _build_done_data(self, session_id: int, eligible_bundles: list[str]) -> dict:
        """최종 done 이벤트 데이터."""
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
    ) -> ChatHistoryResponse:
        """대화 기록 조회 (커서 기반 페이지네이션)."""
        session = await ChatSession.get_or_none(id=session_id, user_id=user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="대화를 찾을 수 없습니다.",
            )

        query = ChatMessage.filter(session=session)
        if before_id:
            query = query.filter(id__lt=before_id)

        messages = await query.order_by("-created_at").limit(limit + 1).all()

        has_more = len(messages) > limit
        if has_more:
            messages = messages[:limit]

        # 시간순 정렬 (최신→과거로 가져온 것을 뒤집기)
        messages.reverse()

        return ChatHistoryResponse(
            session_id=session_id,
            messages=[
                ChatMessageDTO(
                    id=msg.id,
                    role=msg.role,
                    content=msg.content,
                    has_health_questions=msg.has_health_questions,
                    bundle_keys=msg.bundle_keys,
                    created_at=msg.created_at,
                )
                for msg in messages
            ],
            has_more=has_more,
        )

    async def save_health_answer(
        self,
        user_id: int,
        bundle_key: str,
        answers: dict[str, str | int | bool],
    ) -> HealthAnswerResponse:
        """건강질문 답변 저장 (HealthQuestionService 위임)."""
        # 유효한 묶음 키인지 확인
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

    async def _build_system_prompt(self, user_id: int, eligible_bundles: list[str]) -> str:
        """시스템 프롬프트 구성."""
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else "C"

        health_instruction = ""
        if eligible_bundles:
            question_texts = []
            for bk in eligible_bundles:
                bundle = HEALTH_QUESTION_BUNDLES.get(bk)
                if bundle:
                    for q in bundle["questions"]:
                        # 조건부 질문 필터링
                        condition = q.get("condition")
                        if condition == "group_A_only" and user_group != "A":
                            continue
                        question_texts.append(f"- {q['text']}")

            if question_texts:
                health_instruction = HEALTH_QUESTION_INSTRUCTION.format(questions="\n".join(question_texts))

        return SYSTEM_PROMPT_TEMPLATE.format(
            user_group=user_group,
            health_question_instruction=health_instruction,
        )

    def _build_question_data(self, eligible_bundles: list[str]) -> list[dict]:
        """프론트엔드용 건강질문 구조화 데이터 생성."""
        result = []
        for bk in eligible_bundles:
            bundle = HEALTH_QUESTION_BUNDLES.get(bk)
            if bundle:
                result.append(
                    {
                        "bundle_key": bk,
                        "name": bundle["name"],
                        "questions": [
                            {
                                "field": q["field"],
                                "text": q["text"],
                                "options": q.get("options"),
                                "input_type": q.get("input_type", "select"),
                                "condition": q.get("condition"),
                            }
                            for q in bundle["questions"]
                        ],
                    }
                )
        return result


def _sse_event(event_type: str, data: dict) -> str:
    """SSE 이벤트 포맷 — W3C 권장: event: type\\ndata: JSON\\n\\n."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
