'use client';

import { ExternalLink, Play, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../hooks/useApi';

function normalizeRecommendations(payload) {
  if (!payload || typeof payload !== 'object') {
    return { videos: [], topics: [], userName: null, message: null };
  }
  return {
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    topics: Array.isArray(payload.topics) ? payload.topics : [],
    userName: payload.user_name || null,
    message: payload.message || null,
  };
}

export default function VideoRecommendations() {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    videos: [],
    topics: [],
    userName: null,
    message: null,
    error: null,
  });

  const loadRecommendations = useCallback(async ({ refresh = false } = {}) => {
    setState((prev) => ({
      ...prev,
      loading: prev.videos.length === 0,
      refreshing: refresh,
      error: null,
    }));
    try {
      const res = await api(`/api/v1/recommendations/videos${refresh ? '?refresh=true' : ''}`);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const payload = normalizeRecommendations(await res.json());
      setState({
        loading: false,
        refreshing: false,
        videos: payload.videos,
        topics: payload.topics,
        userName: payload.userName,
        message: payload.message,
        error: null,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: '추천 영상을 불러오지 못했어요.',
      }));
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  if (state.loading) {
    return (
      <div className="max-w-[840px] mx-auto mb-4">
        <div className="ml-[38px] rounded-xl border border-cream-500 bg-cream-300 px-4 py-3 text-[14px] text-neutral-500">
          관심 주제를 분석해 추천 영상을 준비하고 있어요.
        </div>
      </div>
    );
  }

  if (state.error || state.videos.length === 0) {
    return null;
  }

  const displayName = state.userName || '회원';

  return (
    <section className="max-w-[840px] mx-auto mb-4">
      <div className="ml-[38px] rounded-xl border border-cream-500 bg-cream-300 p-4 shadow-soft">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-nature-900">
              안녕하세요, {displayName}님. 관심 있어 할 만한 영상을 가져와봤어요.
            </h2>
            {state.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-cream-400 px-2.5 py-1 text-[12px] font-medium text-neutral-500"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => loadRecommendations({ refresh: true })}
            disabled={state.refreshing}
            aria-label="추천 영상 새로고침"
            className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-cream-400 hover:text-nature-900 disabled:opacity-40"
          >
            <RefreshCw size={15} className={state.refreshing ? 'animate-spin' : ''} />
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-50 whitespace-nowrap rounded-md bg-nature-900 px-2 py-1 text-[11px] font-semibold text-cream-200 opacity-0 shadow-lg transition-opacity delay-[400ms] group-hover:opacity-100"
            >
              새로고침
            </span>
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          {state.videos.slice(0, 5).map((video) => (
            <a
              key={video.video_id || video.url}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="group block min-w-0 rounded-lg border border-cream-500 bg-cream-200 transition-colors hover:border-nature-400 hover:bg-cream-100"
            >
              <div className="relative aspect-video overflow-hidden rounded-t-lg bg-cream-400">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    <Play size={22} />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-nature-900 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    <ExternalLink size={14} />
                  </span>
                </div>
              </div>
              <div className="p-2.5">
                <div className="line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-[1.4] text-nature-900">
                  {video.title}
                </div>
                <div className="mt-1 truncate text-[11px] text-neutral-400">
                  {video.channel_title || video.topic}
                </div>
              </div>
            </a>
          ))}
        </div>

        {state.message && (
          <p className="mt-2 text-[11px] text-neutral-400">{state.message}</p>
        )}
      </div>
    </section>
  );
}
