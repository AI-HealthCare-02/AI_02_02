'use client';

import { useCallback } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const TOKEN_KEY = 'danaa_token';
const LAST_AUTH_ACTIVITY_KEY = 'danaa_last_auth_activity_at';
const MAX_AUTH_IDLE_MS = 12 * 60 * 60 * 1000;
const DEV_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';
const REFRESH_COOKIE = 'refresh_token'; // httpOnly — 백엔드가 관리

/* ═══════════════════════════════════════════
 *  토큰 관리 유틸
 * ═══════════════════════════════════════════ */

/** access token 저장 */
export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    markAuthActivity();
  } catch {}
}

/** access token 읽기 */
export function getToken() {
  if (DEV_TOKEN) return DEV_TOKEN;
  if (isAuthSessionExpired()) {
    clearToken();
    return null;
  }
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** access token 삭제 (로그아웃) */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LAST_AUTH_ACTIVITY_KEY);
  } catch {}
}

/** 로그인 상태 확인 */
export function isLoggedIn() {
  return !!getToken();
}

/**
 * 세션 복원 시도 — 토큰 없으면 refresh_token 쿠키로 갱신 시도.
 * 마지막 인증 활동 후 12시간이 지나면 다음 접속에서 자동 로그인 복원을 막는다.
 * @returns {Promise<boolean>} 세션 유효 여부
 */
export async function ensureAuthSession() {
  if (isAuthSessionExpired()) {
    clearToken();
    return false;
  }
  if (getToken()) {
    markAuthActivity();
    return true;
  }
  return refreshToken();
}

function markAuthActivity() {
  try { localStorage.setItem(LAST_AUTH_ACTIVITY_KEY, String(Date.now())); } catch {}
}

function isAuthSessionExpired() {
  if (DEV_TOKEN) return false;
  try {
    const raw = localStorage.getItem(LAST_AUTH_ACTIVITY_KEY);
    if (!raw) return false;
    const lastActivityAt = Number(raw);
    if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
    return Date.now() - lastActivityAt > MAX_AUTH_IDLE_MS;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════
 *  API 호출 유틸
 * ═══════════════════════════════════════════ */

/**
 * 인증된 API 요청을 보내는 함수
 *
 * @param {string} path - API 경로 (예: '/api/v1/chat/send')
 * @param {object} options - fetch options (method, body, headers 등)
 * @returns {Promise<Response>}
 *
 * 사용 예시:
 *   const res = await api('/api/v1/users/me');
 *   const data = await res.json();
 *
 *   await api('/api/v1/health/daily/2026-04-09', {
 *     method: 'PATCH',
 *     body: JSON.stringify({ sleep_duration_bucket: 'between_6_7' }),
 *   });
 */
export async function api(path, options = {}) {
  const token = getToken();

  // FormData는 Content-Type을 browser에 맡겨야 multipart boundary가 자동 설정됨
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    markAuthActivity();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // refresh_token 쿠키 포함
  });

  // 401 → 토큰 만료 → 자동 갱신 시도
  if (res.status === 401 && token) {
    if (isAuthSessionExpired()) {
      clearToken();
      window.location.href = '/login';
      return res;
    }
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      // 갱신 실패 → 로그아웃
      clearToken();
      window.location.href = '/login';
      return res;
    }
  }

  return res;
}

/**
 * 토큰 자동 갱신
 * refresh_token 쿠키를 사용해 새 access_token 발급
 */
async function refreshToken() {
  try {
    if (isAuthSessionExpired()) {
      clearToken();
      return false;
    }
    const res = await fetch(`${API_BASE}/api/v1/auth/token/refresh`, {
      method: 'GET',
      credentials: 'include', // httpOnly 쿠키 전송
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════
 *  React Hook — useApi
 * ═══════════════════════════════════════════ */

/**
 * API 호출을 위한 React Hook
 *
 * 사용 예시:
 *   const { get, post, patch, del } = useApi();
 *
 *   // GET
 *   const data = await get('/api/v1/users/me');
 *
 *   // POST
 *   const result = await post('/api/v1/chat/send', { message: '안녕' });
 *
 *   // PATCH
 *   await patch('/api/v1/health/daily/2026-04-09', { water_cups: 5 });
 */
export default function useApi() {
  const get = useCallback(async (path) => {
    const res = await api(path);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }, []);

  const post = useCallback(async (path, body) => {
    const res = await api(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `API Error: ${res.status}`);
    }
    return res.json();
  }, []);

  const patch = useCallback(async (path, body) => {
    const res = await api(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `API Error: ${res.status}`);
    }
    return res.json();
  }, []);

  const del = useCallback(async (path) => {
    const res = await api(path, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `API Error: ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }, []);

  return { get, post, patch, del, api };
}
