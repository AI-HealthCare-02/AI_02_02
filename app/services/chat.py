"""AI 채팅 서비스 — 메시지 전송, 스트리밍, 건강질문 삽입 오케스트레이션.

흐름: 사용자 메시지 → DB 저장 → 건강질문 판단 → OpenAI 스트리밍 → 응답 저장 → SSE
"""

import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime

from fastapi import HTTPException, status

from app.core import config
from app.dtos.chat import ChatHistoryResponse, ChatMessageDTO, HealthAnswerResponse
from app.models.chat import ChatMessage, ChatSession, MessageRole
from app.models.health import HealthProfile
from app.services.health_question import (
    BUNDLE_CHECK_FIELDS,
    HEALTH_QUESTION_BUNDLES,
    MAX_DAILY_CHATS,
    HealthQuestionService,
)

logger = logging.getLogger(__name__)

# 대화 기록 최대 로드 수 (OpenAI 컨텍스트 윈도우 관리)
MAX_HISTORY_MESSAGES = 20

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


class ChatService:
    """AI 채팅 서비스."""

    def __init__(self):
        self.health_question_service = HealthQuestionService()

    async def send_message_stream(
        self,
        user_id: int,
        message: str,
        session_id: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """사용자 메시지를 받아 AI 응답을 SSE 스트리밍으로 반환."""
        # 사전 검증
        error = await self._validate_request(user_id, session_id)
        if error:
            yield _sse_event("error", {"message": error})
            return

        # 세션 준비 + 메시지 저장
        session = await self._prepare_session(user_id, message, session_id)
        if not session:
            yield _sse_event("error", {"message": "대화를 찾을 수 없어요."})
            return

        await ChatMessage.create(session=session, role=MessageRole.USER, content=message)

        # 컨텍스트 구성
        history = await ChatMessage.filter(session=session).order_by("created_at").limit(MAX_HISTORY_MESSAGES).all()
        eligible_bundles = await self.health_question_service.get_eligible_bundles(user_id)
        openai_messages = await self._build_openai_messages(user_id, history, eligible_bundles)

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
        """사전 검증 — 에러 메시지 반환 (None이면 통과)."""
        if not config.OPENAI_API_KEY:
            return "AI 서비스가 아직 설정되지 않았어요."

        today_count = await ChatMessage.filter(
            session__user_id=user_id,
            role=MessageRole.USER,
            created_at__gte=datetime.now(tz=config.TIMEZONE).replace(
                hour=0, minute=0, second=0, microsecond=0
            ),
        ).count()
        if today_count >= MAX_DAILY_CHATS:
            return "오늘 대화 횟수를 초과했어요. 내일 다시 대화해요! 😊"

        return None

    async def _prepare_session(
        self, user_id: int, message: str, session_id: int | None
    ) -> ChatSession | None:
        """세션 get_or_create."""
        if session_id:
            return await ChatSession.get_or_none(id=session_id, user_id=user_id)
        return await ChatSession.create(user_id=user_id, title=message[:50])

    async def _build_openai_messages(
        self, user_id: int, history: list, eligible_bundles: list[str]
    ) -> list[dict[str, str]]:
        """OpenAI 메시지 리스트 구성."""
        system_prompt = await self._build_system_prompt(user_id, eligible_bundles)
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for msg in history:
            if msg.role != MessageRole.SYSTEM:
                messages.append({"role": msg.role, "content": msg.content})
        return messages

    async def _stream_openai(
        self, messages: list[dict[str, str]]
    ) -> AsyncGenerator[str | None, None]:
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

    async def _save_response(
        self, session: ChatSession, content: str, eligible_bundles: list[str]
    ) -> None:
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
                health_instruction = HEALTH_QUESTION_INSTRUCTION.format(
                    questions="\n".join(question_texts)
                )

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
                result.append({
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
                })
        return result


def _sse_event(event_type: str, data: dict) -> str:
    """SSE 이벤트 포맷."""
    payload = {"type": event_type, **data}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
