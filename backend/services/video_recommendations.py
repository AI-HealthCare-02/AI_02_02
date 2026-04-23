from __future__ import annotations

import json
import re
from datetime import datetime
from urllib.parse import quote_plus

import httpx

from backend.core import config
from backend.core.cache import get_cached, set_cached
from backend.core.logger import setup_logger
from backend.dtos.video_recommendations import VideoRecommendationItem, VideoRecommendationsResponse
from backend.models.chat import ChatMessage, MessageRole
from backend.services.chat.openai_client import get_llm_target, get_openai_client

logger = setup_logger(__name__)

MAX_RECENT_USER_MESSAGES = 40
MAX_CONTEXT_CHARS = 4000
RECENT_PRIORITY_MESSAGE_COUNT = 10
DEFAULT_TOPICS = [
    "당뇨 예방 가벼운 운동",
    "혈당 관리 식습관",
    "식후 걷기 효과",
]

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


APP_INTERNAL_TOPIC_PATTERNS = (
    "오른쪽패널",
    "우측패널",
    "today패널",
    "사이드바",
    "다나아",
    "danaa",
    "오늘기록",
    "미응답질문",
    "리포트화면",
    "챌린지화면",
)

APP_INTERNAL_MESSAGE_PATTERNS = APP_INTERNAL_TOPIC_PATTERNS + (
    "뭐하는거야",
    "뭐 하는거야",
    "어디서봐",
    "어디서 봐",
)


def _compact_text(value: str) -> str:
    return re.sub(r"\s+", "", value or "").lower()


def _is_app_internal_topic(value: str) -> bool:
    compacted = _compact_text(value)
    return any(pattern in compacted for pattern in APP_INTERNAL_TOPIC_PATTERNS)


def _is_app_internal_message(value: str) -> bool:
    compacted = _compact_text(value)
    return any(pattern in compacted for pattern in APP_INTERNAL_MESSAGE_PATTERNS)


def _cache_key(user_id: int) -> str:
    return f"video_recommendations:{user_id}:v4"


def _clean_topic(value: str) -> str:
    topic = re.sub(r"\s+", " ", value or "").strip()
    topic = topic.replace("#", "").strip(" .,!?:;\"'")
    return topic[:40]


def _dedupe_topics(topics: list[str], *, limit: int = 3) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw_topic in topics:
        topic = _clean_topic(raw_topic)
        if not topic:
            continue
        if _is_app_internal_topic(topic):
            continue
        key = topic.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(topic)
        if len(result) >= limit:
            break
    return result


def _fallback_topics_from_text(text: str, *, include_defaults: bool = True) -> list[str]:
    lowered = text.lower()
    candidates: list[str] = []
    keyword_map = [
        (("잠", "수면", "불면", "피곤"), "잠 안 올 때 수면 루틴"),
        (("집중", "공부", "계획", "시간"), "집중력 높이는 방법"),
        (("운동", "걷기", "헬스", "근력"), "초보자 운동 루틴"),
        (("식사", "요리", "아침", "자취"), "간단한 건강 식사"),
        (("스트레스", "불안", "생각", "멘탈"), "스트레스 완화 루틴"),
        (("면접", "취업", "자소서"), "면접 준비 방법"),
        (("파이썬", "코딩", "개발", "프로그래밍"), "파이썬 기초 강의"),
        (("당뇨", "혈당", "공복혈당", "식후혈당"), "당뇨 예방 생활습관"),
    ]
    for keywords, topic in keyword_map:
        if any(keyword in lowered or keyword in text for keyword in keywords):
            candidates.append(topic)
    if include_defaults:
        candidates += DEFAULT_TOPICS
    return _dedupe_topics(candidates)


def _extract_json_object(content: str) -> dict | None:
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        match = _JSON_BLOCK_RE.search(content)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None


class VideoRecommendationService:
    async def get_recommendations(
        self,
        *,
        user_id: int,
        user_name: str | None = None,
        refresh: bool = False,
    ) -> VideoRecommendationsResponse:
        if not refresh:
            cached = await self._get_cached(user_id=user_id)
            if cached is not None:
                cached.user_name = user_name
                cached.source = "cache"
                return cached

        context = await self._load_recent_user_context(user_id=user_id)
        topics = await self._build_topics(context)
        videos = await self._search_youtube(topics)
        source = "youtube_api" if config.YOUTUBE_API_KEY and videos else "youtube_search"

        if not videos:
            videos = self._build_search_links(topics)

        response = VideoRecommendationsResponse(
            user_name=user_name,
            source=source,
            topics=topics,
            videos=videos[: max(1, config.YOUTUBE_RECOMMENDATION_MAX_RESULTS)],
            generated_at=datetime.now(tz=config.TIMEZONE).isoformat(),
            message=None if config.YOUTUBE_API_KEY else "YOUTUBE_API_KEY가 없어 검색 링크로 대체했어요.",
        )
        await self._set_cached(user_id=user_id, response=response)
        return response

    async def _get_cached(self, *, user_id: int) -> VideoRecommendationsResponse | None:
        try:
            cached = await get_cached(_cache_key(user_id))
            if cached is None:
                return None
            return VideoRecommendationsResponse.model_validate(cached)
        except Exception:
            logger.warning("video_recommendation_cache_read_failed", user_id=user_id)
            return None

    async def _set_cached(self, *, user_id: int, response: VideoRecommendationsResponse) -> None:
        try:
            await set_cached(
                _cache_key(user_id),
                response.model_dump(mode="json"),
                ttl_seconds=config.YOUTUBE_RECOMMENDATION_CACHE_TTL_SECONDS,
            )
        except Exception:
            logger.warning("video_recommendation_cache_write_failed", user_id=user_id)

    async def _load_recent_user_context(self, *, user_id: int) -> dict[str, str]:
        messages = await (
            ChatMessage.filter(session__user_id=user_id, role=MessageRole.USER)
            .order_by("-created_at", "-id")
            .limit(MAX_RECENT_USER_MESSAGES)
        )
        ordered = list(reversed(messages))
        user_messages = [
            message.content.strip()
            for message in ordered
            if message.content.strip() and not _is_app_internal_message(message.content)
        ]
        priority_messages = user_messages[-RECENT_PRIORITY_MESSAGE_COUNT:]
        background_messages = user_messages[:-RECENT_PRIORITY_MESSAGE_COUNT]
        priority_text = "\n".join(priority_messages)[-MAX_CONTEXT_CHARS:]
        background_text = "\n".join(background_messages)[-MAX_CONTEXT_CHARS:]
        combined_text = "\n".join(user_messages)[-MAX_CONTEXT_CHARS:]
        return {
            "priority": priority_text,
            "background": background_text,
            "combined": combined_text,
        }

    async def _build_topics(self, context: dict[str, str]) -> list[str]:
        priority_text = context.get("priority", "")
        background_text = context.get("background", "")
        combined_text = context.get("combined", "")
        if not combined_text.strip():
            return DEFAULT_TOPICS[:3]

        llm_topics = await self._build_topics_with_llm(
            priority_text=priority_text,
            background_text=background_text,
        )
        if llm_topics:
            return llm_topics
        priority_topics = _fallback_topics_from_text(priority_text, include_defaults=False)
        if priority_topics:
            return priority_topics
        return _fallback_topics_from_text(combined_text)

    async def _build_topics_with_llm(self, *, priority_text: str, background_text: str) -> list[str]:
        target = get_llm_target("primary") or get_llm_target("fallback")
        if target is None:
            return []

        system_prompt = (
            "너는 사용자의 최근 대화에서 관심사와 어려움을 읽고 유튜브 검색어를 만드는 추천 기획자다. "
            "의료 진단, 약물, 치료법, 자극적인 키워드는 피하고 생활관리, 학습, 생산성, 수면, 운동, 식사, 스트레스처럼 "
            "일상에 도움이 되는 주제로 만든다. "
            "다나아 앱 사용법, 오른쪽 패널, 사이드바, 리포트 화면, 챌린지 화면처럼 서비스 내부 기능을 묻는 말은 "
            "유튜브 추천 관심사로 보지 말고 무시한다. "
            "가장 최근 대화 맥락을 최우선으로 반영하고, 이전 대화는 반복 관심사를 확인하는 보조 근거로만 사용한다. "
            "분석할 만한 사용자 관심사가 부족하면 당뇨 예방, 혈당 관리 식습관, 식후 걷기처럼 다나아 서비스 목적에 맞는 "
            "기본 생활관리 검색어를 만든다. 반드시 JSON만 출력한다."
        )
        user_prompt = (
            "최근 대화 우선 맥락(가장 중요):\n"
            f"{priority_text or '(없음)'}\n\n"
            "이전 대화 보조 맥락(반복 관심사 확인용):\n"
            f"{background_text or '(없음)'}\n\n"
            "이 사용자가 관심 있어 할 만한 한국어 유튜브 검색어 3개를 만들어라. "
            '출력 형식: {"topics":["검색어1","검색어2","검색어3"]}'
        )

        try:
            client = get_openai_client(target.role)
            response = await client.chat.completions.create(
                model=target.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=180,
                temperature=0.2,
                stream=False,
                user="video-recommendations",
            )
            content = response.choices[0].message.content or ""
            parsed = _extract_json_object(content)
            if not parsed:
                return []
            topics = parsed.get("topics")
            if not isinstance(topics, list):
                return []
            return _dedupe_topics([str(topic) for topic in topics])
        except Exception:
            logger.warning("video_recommendation_llm_topics_failed")
            return []

    async def _search_youtube(self, topics: list[str]) -> list[VideoRecommendationItem]:
        api_key = config.YOUTUBE_API_KEY.strip()
        if not api_key:
            return []

        max_results = max(1, config.YOUTUBE_RECOMMENDATION_MAX_RESULTS)
        per_topic = max(2, min(5, max_results))
        seen_video_ids: set[str] = set()
        results: list[VideoRecommendationItem] = []

        async with httpx.AsyncClient(timeout=8.0) as client:
            for topic in topics:
                if len(results) >= max_results:
                    break
                try:
                    response = await client.get(
                        "https://www.googleapis.com/youtube/v3/search",
                        params={
                            "part": "snippet",
                            "type": "video",
                            "q": topic,
                            "maxResults": per_topic,
                            "safeSearch": "moderate",
                            "relevanceLanguage": "ko",
                            "regionCode": "KR",
                            "key": api_key,
                        },
                    )
                    response.raise_for_status()
                    payload = response.json()
                except Exception:
                    logger.warning("youtube_search_failed", topic=topic)
                    continue

                for item in payload.get("items", []):
                    video_id = (item.get("id") or {}).get("videoId")
                    snippet = item.get("snippet") or {}
                    if not video_id or video_id in seen_video_ids:
                        continue
                    seen_video_ids.add(video_id)
                    thumbnails = snippet.get("thumbnails") or {}
                    thumbnail = (
                        thumbnails.get("medium")
                        or thumbnails.get("high")
                        or thumbnails.get("default")
                        or {}
                    )
                    results.append(
                        VideoRecommendationItem(
                            video_id=video_id,
                            title=snippet.get("title") or topic,
                            channel_title=snippet.get("channelTitle"),
                            thumbnail_url=thumbnail.get("url"),
                            url=f"https://www.youtube.com/watch?v={video_id}",
                            topic=topic,
                            published_at=snippet.get("publishedAt"),
                        )
                    )
                    if len(results) >= max_results:
                        break

        return results

    def _build_search_links(self, topics: list[str]) -> list[VideoRecommendationItem]:
        return [
            VideoRecommendationItem(
                title=f"'{topic}' 관련 영상 찾아보기",
                channel_title="YouTube 검색",
                thumbnail_url=None,
                url=f"https://www.youtube.com/results?search_query={quote_plus(topic)}",
                topic=topic,
            )
            for topic in topics[: max(1, config.YOUTUBE_RECOMMENDATION_MAX_RESULTS)]
        ]
