'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'danaa_conversations';

/**
 * 대화 히스토리 관리 훅
 *
 * localStorage 기반으로 동작하며, 백엔드 API 연결 시
 * fetchConversations()를 API 호출로 교체하면 됩니다.
 *
 * 데이터 구조:
 * {
 *   id: string,           // session_id (백엔드) 또는 클라이언트 UUID
 *   title: string,        // 첫 사용자 메시지 기반 (30자 truncate)
 *   updatedAt: string,    // ISO 8601 timestamp
 *   messageCount: number  // 메시지 수
 * }
 */
export default function useConversations() {
  const [conversations, setConversations] = useState([]);

  // ── localStorage에서 로드 ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConversations(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // ── localStorage에 저장 ──
  const persist = useCallback((list) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }, []);

  // ── 대화 추가 또는 업데이트 ──
  const addOrUpdate = useCallback((entry) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === entry.id);
      let next;
      if (idx >= 0) {
        // 기존 대화 업데이트
        next = [...prev];
        next[idx] = { ...next[idx], ...entry };
      } else {
        // 새 대화 추가
        next = [entry, ...prev];
      }
      // updatedAt 기준 내림차순 정렬
      next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      persist(next);
      return next;
    });
  }, [persist]);

  // ── 대화 삭제 ──
  const remove = useCallback((id) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  // ── CustomEvent 수신: chat 페이지에서 대화 업데이트 알림 ──
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        addOrUpdate(e.detail);
      }
    };
    window.addEventListener('danaa:conversation-update', handler);
    return () => window.removeEventListener('danaa:conversation-update', handler);
  }, [addOrUpdate]);

  // ── 날짜별 그룹핑 ──
  const grouped = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groups = {};

    conversations.forEach((conv) => {
      const d = new Date(conv.updatedAt);
      const dStr = d.toDateString();

      let label;
      if (dStr === todayStr) {
        label = '오늘';
      } else if (dStr === yesterdayStr) {
        label = '어제';
      } else {
        label = '이전';
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(conv);
    });

    // 순서 보장: 오늘 → 어제 → 이전
    const ordered = [];
    for (const label of ['오늘', '어제', '이전']) {
      if (groups[label]?.length) {
        ordered.push({ label, items: groups[label] });
      }
    }
    return ordered;
  }, [conversations]);

  return { conversations, grouped, addOrUpdate, remove };
}

/**
 * ── 백엔드 API 연결 가이드 ──
 *
 * 1. 백엔드에 GET /api/v1/chat/sessions 엔드포인트 추가
 *    → Response: { sessions: [{ id, title, updated_at, message_count }] }
 *
 * 2. useEffect 내에서 API 호출로 교체:
 *    useEffect(() => {
 *      async function fetchConversations() {
 *        const res = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
 *          headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
 *        });
 *        const data = await res.json();
 *        setConversations(data.sessions.map(s => ({
 *          id: s.id,
 *          title: s.title,
 *          updatedAt: s.updated_at,
 *          messageCount: s.message_count,
 *        })));
 *      }
 *      fetchConversations();
 *    }, []);
 *
 * 3. addOrUpdate에서 API 호출 추가:
 *    → POST /api/v1/chat/sessions/:id { title }
 *
 * 4. remove에서 API 호출 추가:
 *    → DELETE /api/v1/chat/sessions/:id
 */
