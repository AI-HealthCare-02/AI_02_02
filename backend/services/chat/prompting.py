"""Prompt building helpers."""

from backend.core import config
from backend.models.chat import MessageRole
from backend.models.enums import MessageRoute
from backend.services.content_filter import FilterResult
from backend.services.health_question import HEALTH_QUESTION_BUNDLES

SYSTEM_PROMPT_TEMPLATE = """\
당신은 '다나아'의 AI 건강 생활습관 코치입니다.

## 역할
- 친절한 건강 생활습관 코치 (의사가 아님)
- 반말 사용, 자연스럽고 따뜻한 톤
- 이모지를 적절히 사용

## 사용자 정보
- 그룹: {user_group}

## 절대 금지
- 의료적 진단, 처방, 약물 추천
- "~해야 합니다" 같은 단정적 표현

## 면책조항
건강 관련 질문에 답할 때 맨 끝에 자연스럽게
"참고로 저는 생활습관 코치예요 🙂 정확한 진단이 필요하면 전문가 상담을 추천해요!"

## 응답 스타일
- 짧고 실용적으로 (3-4문장 이내)
- 공감 먼저, 정보는 그다음
- 차분하고 격려하는 어조
{health_question_instruction}"""

HEALTH_QUESTION_INSTRUCTION = """
## 건강질문 전달
아래 건강질문을 답변 끝에 자연스럽게 이어서 물어봐줘.
"그건 그렇고?", "아 맞다!", "참 오늘은 어때?" 같은 전환 멘트를 곁들여,
기계적으로 나열하지 말고 대화처럼 자연스럽게

질문 목록:
{questions}
"""

ROUTE_INSTRUCTIONS: dict[MessageRoute, str] = {
    MessageRoute.HEALTH_SPECIFIC: (
        "\n\n## 추가 지시 (구체적 건강 수치)\n"
        "사용자가 구체적인 수치, 증상, 약 복용을 언급했어. "
        "의학적 판단이나 진단은 하지 말고, 생활습관 범위에서만 답해줘. "
        "필요하면 '전문 의료진 상담을 권장해요'를 자연스럽게 포함해줘."
    ),
}

EMOTIONAL_INSTRUCTION = (
    "\n\n## 추가 지시 (감정 우선)\n"
    "사용자가 감정적으로 힘들어하는 표현이 있어. "
    "공감과 위로를 최우선으로 답변하고, "
    "건강 질문보다 감정 인정이 먼저 오게 해줘. "
    "이번 답변에서는 건강 관련 질문은 하지 마."
)

_USER_CONTEXT_PREFACE = (
    "\n\n## 사용자 맥락 (톤 조정용)\n"
    "아래는 사용자의 생활습관 맥락이야. "
    "이 정보를 직접 언급하거나 나열하지 말고, "
    "진단명·수치·복약 정보를 추론해서 말하지도 말고, "
    "답변 톤을 자연스럽게 조정하는 데만 사용해.\n"
)


def _apply_user_context_layer(system_prompt: str, user_context) -> str:
    if user_context and user_context.has_context and config.USER_CONTEXT_APPLY_ENABLED:
        system_prompt += _USER_CONTEXT_PREFACE + user_context.summary + "\n"
    return system_prompt


def _apply_route_layer(system_prompt: str, filter_result: FilterResult | None) -> str:
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
    return system_prompt


def _apply_rag_layer(system_prompt: str, rag_result) -> str:
    if rag_result and rag_result.has_context and config.RAG_APPLY_ENABLED:
        system_prompt += rag_result.prompt_context
    return system_prompt


def _apply_filter_instruction_layer(system_prompt: str, filter_result: FilterResult | None) -> str:
    if filter_result and filter_result.prompt_instruction:
        system_prompt += filter_result.prompt_instruction
    return system_prompt


async def _build_system_prompt(profile, eligible_bundles: list[str]) -> str:
    user_group = profile.user_group if profile else "C"

    health_instruction = ""
    if eligible_bundles:
        question_texts: list[str] = []
        for bundle_key in eligible_bundles:
            bundle = HEALTH_QUESTION_BUNDLES.get(bundle_key)
            if not bundle:
                continue
            for question in bundle["questions"]:
                condition = question.get("condition")
                if condition == "group_A_only" and user_group != "A":
                    continue
                question_texts.append(f"- {question['text']}")
        if question_texts:
            health_instruction = HEALTH_QUESTION_INSTRUCTION.format(
                questions="\n".join(question_texts)
            )

    return SYSTEM_PROMPT_TEMPLATE.format(
        user_group=user_group,
        health_question_instruction=health_instruction,
    )


async def _build_openai_messages(
    profile,
    history: list,
    eligible_bundles: list[str],
    filter_result: FilterResult | None = None,
    rag_result=None,
    user_context=None,
) -> list[dict[str, str]]:
    system_prompt = await _build_system_prompt(profile, eligible_bundles)
    system_prompt = _apply_user_context_layer(system_prompt, user_context)
    system_prompt = _apply_route_layer(system_prompt, filter_result)
    system_prompt = _apply_rag_layer(system_prompt, rag_result)
    system_prompt = _apply_filter_instruction_layer(system_prompt, filter_result)

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        if msg.role != MessageRole.SYSTEM:
            messages.append({"role": msg.role, "content": msg.content})
    return messages


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
