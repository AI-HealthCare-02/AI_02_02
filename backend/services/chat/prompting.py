"""Prompt building helpers."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from backend.core import config
from backend.models.chat import MessageRole
from backend.models.enums import MessageRoute
from backend.services.chat.prep_types import PrepFlags, PromptPolicy
from backend.services.content_filter import FilterResult
from backend.services.health_question import HEALTH_QUESTION_BUNDLES

SYSTEM_PROMPT_TEMPLATE = """\
당신은 '다나아' AI 건강 생활 코치입니다.

## 역할
- 만성질환 관리가 필요한 사용자를 돕는 생활습관 코치입니다. 의사는 아닙니다.
- 공감은 먼저, 정보는 짧고 분명하게 전달합니다.
- 모든 답변은 일관되게 존댓말로 합니다. 사용자가 반말을 써도 반말로 바꾸지 않습니다.
- 이모지는 꼭 필요할 때만 가볍게 사용합니다.

## 사용자 정보
- 그룹: {user_group}

## 절대 금지
- 의료 진단, 처방, 치료 권유
- 단정적인 표현이나 과도한 확신

## 안전 문구
건강 관련 질문에 답할 때만 필요하면 짧게:
"참고로 저는 생활습관 코치예요. 정확한 진단이나 처방은 의료진 상담이 더 안전해요."
를 사용할 수 있습니다.

## 답변 스타일
- 공감 먼저, 대부분 2~3문장 이내
- 일반/생활습관 질문은 짧고 실용적으로
- 건강 수치나 주의가 필요한 경우에도 겁주지 말고 차분하게 설명
- 공감 후 바로 실천 가능한 조언으로 이어가기
{health_question_instruction}"""

HEALTH_QUESTION_INSTRUCTION = """
## 건강 질문 연결
아래 건강 질문 후보가 있으면 답변 끝에 흐름이 자연스러울 때만 부드럽게 이어 물어보세요.
질문을 기계적으로 나열하지 말고, 방금 대화 맥락에 맞는 질문 하나만 고르세요.

질문 목록:
{questions}
"""

PHASE1_SCOPE_BLOCK = """

## 답변 범위
- 수면, 식사, 운동, 수분, 스트레스, 기분 같은 일상 건강과 생활습관을 중심으로 돕습니다.
- 의료 진단, 처방, 치료 권유, 특정 약물 용량 안내, 응급 처치는 하지 않습니다.
- 다나아 앱의 UI·기능·화면 구성(사이드바, Today 패널, 리포트, 챌린지, 설정, 온보딩, 미응답 모달, 기록 카드 등) 질문에는 '앱 기능 참고' 또는 '현재 확인된 앱 상태' 섹션의 정보를 바탕으로 자세히 안내합니다.
- 다나아와 무관한 외부 실시간 정보(날씨, 뉴스, 주가, 스포츠)는 직접 확인이 필요하다고 안내합니다.
"""

PHASE1_FALLBACK_EXAMPLE_BLOCK = """

## 예시
사용자: 오늘 서울 날씨 어때?
답변: 저는 실시간 날씨를 직접 볼 수 없어요. 날씨 앱이나 기상 정보를 먼저 확인해 주세요. 대신 오늘 컨디션에 맞는 식사나 운동은 같이 정리해드릴 수 있어요.
"""

PHASE1_HEALTH_QUESTION_INSTRUCTION = """
## 건강 질문 연결
아래 건강 질문 후보가 있더라도 사용자가 건강, 생활습관, 오늘 컨디션을 이야기했을 때만 답변 끝에 자연스럽게 이어 물어보세요.
맥락과 무관한 일반 질문이거나 범위 밖 질문이면 건강 질문은 생략하세요.
사용자가 감정적으로 많이 흔들린 상황이면 질문보다 공감을 먼저 하고, 질문은 생략하거나 아주 짧게만 덧붙입니다.

질문 목록:
{questions}
"""

ROUTE_INSTRUCTIONS: dict[MessageRoute, str] = {
    MessageRoute.HEALTH_SPECIFIC: (
        "\n\n## 추가 지시 (구체적 건강 수치)\n"
        "사용자가 구체적인 건강 수치, 증상, 복용 정보를 물어봐도 확정적인 진단은 하지 말고 "
        "생활습관 범위의 안전한 다음 행동을 짧게 안내하세요. "
        "필요하면 의료진 상담 권고를 자연스럽게 덧붙이세요."
    ),
}

EMOTIONAL_INSTRUCTION = (
    "\n\n## 추가 지시 (감정 우선)\n"
    "사용자가 감정적으로 흔들린 상태입니다. "
    "공감과 안정 문장을 먼저 전달하고, 건강 관련 질문은 필요할 때만 아주 짧게 덧붙여 주세요."
)

_USER_CONTEXT_PREFACE = (
    "\n\n## 사용자 맥락 (답변 조정용)\n"
    "아래는 사용자의 생활습관 맥락입니다. "
    "정보를 직접 열거하지 말고, 답변 톤과 우선순위를 조정하는 데만 사용하세요.\n"
)

CONCISE_RESPONSE_INSTRUCTION = (
    "\n\n## 답변 길이 추가 지시\n"
    "- 사용자가 바로 이해할 수 있게 대부분 3~5문장 안에서 답하세요.\n"
    "- 먼저 핵심 1~3가지만 제안하고, 불필요한 장문 설명은 줄이세요.\n"
    "- 안전 안내가 필요한 경우에는 그 문구를 생략하지 마세요.\n"
)


@dataclass(frozen=True)
class PromptBuildResult:
    openai_messages: tuple[dict[str, str], ...]
    app_help_layer: str
    app_state_layer: str
    user_context_layer: str
    route_layer: str
    rag_layer: str
    filter_instruction_layer: str
    final_system_prompt: str


def _prompt_policy_instruction(prompt_policy: PromptPolicy) -> str:
    if prompt_policy == PromptPolicy.WARN:
        from backend.services.content_filter_patterns import WARN_PROMPT_INSTRUCTION

        return WARN_PROMPT_INSTRUCTION
    if prompt_policy == PromptPolicy.MEDICAL_NOTE:
        from backend.services.content_filter_patterns import MEDICAL_NOTE_PROMPT_INSTRUCTION

        return MEDICAL_NOTE_PROMPT_INSTRUCTION
    return ""


def _user_context_layer_text(user_context_text: str | None, flags: PrepFlags | None = None) -> str:
    should_apply = config.USER_CONTEXT_APPLY_ENABLED if flags is None else flags.user_context_apply_enabled
    if user_context_text and should_apply:
        return _USER_CONTEXT_PREFACE + user_context_text + "\n"
    return ""


def _route_layer_text(
    route: MessageRoute | None,
    emotional_priority: bool,
    flags: PrepFlags | None = None,
) -> str:
    should_apply = config.CONTENT_FILTER_ROUTING_APPLY_ENABLED if flags is None else flags.routing_apply_enabled
    if not should_apply or route is None:
        return ""

    layer = ""
    route_instruction = ROUTE_INSTRUCTIONS.get(route)
    if route_instruction:
        layer += route_instruction
    if emotional_priority:
        layer += EMOTIONAL_INSTRUCTION
    return layer


def _rag_layer_text(rag_context_text: str | None, flags: PrepFlags | None = None) -> str:
    should_apply = config.RAG_APPLY_ENABLED if flags is None else flags.rag_apply_enabled
    if rag_context_text and should_apply:
        return rag_context_text
    return ""


def _filter_instruction_layer_text(prompt_policy: PromptPolicy) -> str:
    return _prompt_policy_instruction(prompt_policy)


def _prompt_policy_from_filter_result(filter_result: FilterResult | None) -> PromptPolicy:
    if filter_result is None or not filter_result.prompt_instruction:
        return PromptPolicy.NONE
    if filter_result.medical_action.value == "medical_note":
        return PromptPolicy.MEDICAL_NOTE
    return PromptPolicy.WARN


def _canonicalize_eligible_bundles(eligible_bundles: list[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(eligible_bundles))


def _user_group_key(profile) -> str:
    if profile is None:
        return "C"
    user_group = getattr(profile, "user_group", "C")
    return str(user_group.value if hasattr(user_group, "value") else user_group)


def _user_group_label(user_group_key: str) -> str:
    labels = {
        "A": "A그룹(집중 관리 단계)",
        "B": "B그룹(주의 관리 단계)",
        "C": "C그룹(일반 관리 단계)",
    }
    return labels.get(user_group_key, user_group_key)


@lru_cache(maxsize=64)
def _build_cached_system_prompt(user_group_key: str, eligible_bundles_key: tuple[str, ...]) -> str:
    health_instruction = ""
    if eligible_bundles_key:
        question_texts: list[str] = []
        for bundle_key in eligible_bundles_key:
            bundle = HEALTH_QUESTION_BUNDLES.get(bundle_key)
            if not bundle:
                continue
            for question in bundle["questions"]:
                condition = question.get("condition")
                if condition == "group_A_only" and user_group_key != "A":
                    continue
                question_texts.append(f"- {question['text']}")
        if question_texts:
            health_instruction = PHASE1_HEALTH_QUESTION_INSTRUCTION.format(
                questions="\n".join(question_texts)
            )

    return (
        SYSTEM_PROMPT_TEMPLATE.format(
            user_group=_user_group_label(user_group_key),
            health_question_instruction=health_instruction,
        )
        + PHASE1_SCOPE_BLOCK
        + PHASE1_FALLBACK_EXAMPLE_BLOCK
    )


def _build_openai_messages_from_base_prompt(
    base_system_prompt: str,
    history: list,
    route: MessageRoute | None,
    emotional_priority: bool,
    prompt_policy: PromptPolicy,
    rag_context_text: str | None = None,
    user_context_text: str | None = None,
    flags: PrepFlags | None = None,
    message_text: str | None = None,
    app_help_text: str | None = None,
    app_state_text: str | None = None,
) -> PromptBuildResult:
    app_help_layer = app_help_text or ""
    app_state_layer = app_state_text or ""
    user_context_layer = _user_context_layer_text(user_context_text, flags)
    route_layer = _route_layer_text(route, emotional_priority, flags)
    rag_layer = _rag_layer_text(rag_context_text, flags)
    filter_instruction_layer = _filter_instruction_layer_text(prompt_policy)
    final_system_prompt = (
        base_system_prompt
        + (CONCISE_RESPONSE_INSTRUCTION if config.CHAT_OPENAI_SHORT_RESPONSE_ENABLED else "")
        + route_layer
        + filter_instruction_layer
        + app_help_layer
        + app_state_layer
        + user_context_layer
        + rag_layer
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": final_system_prompt}]
    for msg in history:
        role = msg.role if not isinstance(msg.role, MessageRole) else msg.role.value
        if role != MessageRole.SYSTEM.value:
            messages.append({"role": role, "content": msg.content})
    if message_text:
        messages.append({"role": MessageRole.USER.value, "content": message_text})

    return PromptBuildResult(
        openai_messages=tuple(messages),
        app_help_layer=app_help_layer,
        app_state_layer=app_state_layer,
        user_context_layer=user_context_layer,
        route_layer=route_layer,
        rag_layer=rag_layer,
        filter_instruction_layer=filter_instruction_layer,
        final_system_prompt=final_system_prompt,
    )


async def _build_system_prompt(profile, eligible_bundles: list[str]) -> str:
    return _build_cached_system_prompt(
        _user_group_key(profile),
        _canonicalize_eligible_bundles(eligible_bundles),
    )


async def _build_openai_messages(
    profile,
    history: list,
    eligible_bundles: list[str],
    filter_result: FilterResult | None = None,
    rag_result=None,
    user_context=None,
    message_text: str | None = None,
    base_system_prompt: str | None = None,
    app_help_text: str | None = None,
    app_state_text: str | None = None,
) -> list[dict[str, str]]:
    system_prompt = base_system_prompt or await _build_system_prompt(profile, eligible_bundles)
    build_result = _build_openai_messages_from_base_prompt(
        base_system_prompt=system_prompt,
        history=history,
        message_text=message_text,
        app_help_text=app_help_text,
        app_state_text=app_state_text,
        route=filter_result.message_route if filter_result else None,
        emotional_priority=filter_result.emotional_priority if filter_result else False,
        prompt_policy=_prompt_policy_from_filter_result(filter_result),
        rag_context_text=rag_result.prompt_context if rag_result and rag_result.has_context else None,
        user_context_text=user_context.summary if user_context and user_context.has_context else None,
        flags=None,
    )
    return [dict(message) for message in build_result.openai_messages]


def _build_question_data(eligible_bundles: list[str]) -> list[dict]:
    result = []
    for bundle_key in eligible_bundles:
        bundle = HEALTH_QUESTION_BUNDLES.get(bundle_key)
        if bundle:
            result.append(
                {
                    "bundle_key": bundle_key,
                    "name": bundle["name"],
                    "questions": [
                        {
                            "field": question["field"],
                            "text": question["text"],
                            "options": question.get("options"),
                            "input_type": question.get("input_type", "select"),
                            "condition": question.get("condition"),
                        }
                        for question in bundle["questions"]
                    ],
                }
            )
    return result
