'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

import { api } from './useApi';

const STORAGE_KEY = 'danaa_conversations';

function persistConversations(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function normalizeConversation(session) {
  if (!session?.id) return null;

  return {
    id: session.id,
    title: session.title || '새 대화',
    updatedAt: session.updated_at || new Date().toISOString(),
    messageCount: Number(session.message_count || 0),
  };
}

export default function useConversations() {
  const [conversations, setConversations] = useState([]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api('/api/v1/chat/sessions?limit=20');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const next = Array.isArray(data?.sessions)
        ? data.sessions.map(normalizeConversation).filter(Boolean)
        : [];
      setConversations(next);
      persistConversations(next);
    } catch {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setConversations(JSON.parse(saved));
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const addOrUpdate = useCallback((entry) => {
    const normalized = normalizeConversation({
      ...entry,
      updated_at: entry?.updatedAt || entry?.updated_at || new Date().toISOString(),
      message_count: entry?.messageCount || entry?.message_count || 0,
    });
    if (!normalized) return;

    setConversations((prev) => {
      const idx = prev.findIndex((conversation) => conversation.id === normalized.id);
      const next = idx >= 0
        ? prev.map((conversation, index) => (index === idx ? { ...conversation, ...normalized } : conversation))
        : [normalized, ...prev];
      next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      persistConversations(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setConversations((prev) => {
      const next = prev.filter((conversation) => conversation.id !== id);
      persistConversations(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail) {
        addOrUpdate(event.detail);
      }
    };

    const refreshHandler = () => {
      fetchConversations();
    };

    window.addEventListener('danaa:conversation-update', handler);
    window.addEventListener('danaa:conversation-refresh', refreshHandler);
    return () => {
      window.removeEventListener('danaa:conversation-update', handler);
      window.removeEventListener('danaa:conversation-refresh', refreshHandler);
    };
  }, [addOrUpdate, fetchConversations]);

  const grouped = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groups = {};

    conversations.forEach((conversation) => {
      const date = new Date(conversation.updatedAt);
      const dateString = date.toDateString();

      let label;
      if (dateString === todayStr) {
        label = '오늘';
      } else if (dateString === yesterdayStr) {
        label = '어제';
      } else {
        label = '이전';
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(conversation);
    });

    return ['오늘', '어제', '이전']
      .filter((label) => groups[label]?.length)
      .map((label) => ({ label, items: groups[label] }));
  }, [conversations]);

  return { conversations, grouped, addOrUpdate, remove, refresh: fetchConversations };
}
