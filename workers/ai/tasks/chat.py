"""OpenAI 스트리밍 채팅 래퍼.

순수 유틸리티 — DB 접근 없음, 프레임워크 의존성 없음.
FastAPI 서비스와 ai_worker 양쪽에서 모두 사용 가능.
"""

from collections.abc import AsyncGenerator

from openai import AsyncOpenAI


async def stream_chat_completion(
    messages: list[dict[str, str]],
    *,
    api_key: str,
    model: str = "gpt-4o-mini",
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> AsyncGenerator[str, None]:
    """OpenAI ChatCompletion 스트리밍 호출.

    Args:
        messages: OpenAI 형식 메시지 리스트 [{"role": ..., "content": ...}]
        api_key: OpenAI API 키
        model: 사용할 모델 (기본: gpt-4o-mini)
        temperature: 생성 온도 (0.0~2.0)
        max_tokens: 최대 토큰 수

    Yields:
        AI 응답의 텍스트 청크
    """
    client = AsyncOpenAI(api_key=api_key)

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )

    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
