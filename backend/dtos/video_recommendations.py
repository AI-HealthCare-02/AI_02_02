from __future__ import annotations

from pydantic import BaseModel, Field


class VideoRecommendationItem(BaseModel):
    video_id: str | None = None
    title: str
    channel_title: str | None = None
    thumbnail_url: str | None = None
    url: str
    topic: str
    published_at: str | None = None


class VideoRecommendationsResponse(BaseModel):
    user_name: str | None = None
    source: str = Field(description="youtube_api, youtube_search, cache, or empty")
    topics: list[str] = Field(default_factory=list)
    videos: list[VideoRecommendationItem] = Field(default_factory=list)
    generated_at: str | None = None
    message: str | None = None
