"""OpenAI streaming and SSE helpers."""

import json
from collections.abc import AsyncGenerator

from backend.core import config
from backend.core.logger import setup_logger

logger = setup_logger(__name__)


async def _stream_openai(messages: list[dict[str, str]]) -> AsyncGenerator[str | None, None]:
    """OpenAI 스트리밍 호출. 오류 시 None yield."""
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


def _sse_event(event_type: str, data: dict) -> str:
    """SSE 이벤트 포맷."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
