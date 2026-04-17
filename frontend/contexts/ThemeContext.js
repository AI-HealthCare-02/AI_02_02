'use client';

import { createContext, useCallback, useEffect, useState } from 'react';
import { api, getToken } from '../hooks/useApi';

const STORAGE_KEY = 'danaa_theme';
const ALLOWED = ['dark', 'light'];
const DEFAULT_THEME = 'dark';

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  isLoaded: false,
});

function applyTheme(value) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value;
  }
}

function readLocalTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return ALLOWED.includes(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [isLoaded, setIsLoaded] = useState(false);

  // 첫 화면 깜빡임을 줄이기 위해 localStorage 캐시를 먼저 적용
  useEffect(() => {
    const local = readLocalTheme();
    setThemeState(local);
    applyTheme(local);
    setIsLoaded(true);
  }, []);

  // 로그인 상태면 서버 설정을 최종 기준으로 다시 동기화
  useEffect(() => {
    if (!isLoaded) return;

    const token = getToken();
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api('/api/v1/settings');
        if (!res.ok) return;

        const data = await res.json();
        const serverTheme = data.theme_preference;

        if (!cancelled && ALLOWED.includes(serverTheme) && serverTheme !== theme) {
          setThemeState(serverTheme);
          applyTheme(serverTheme);
          localStorage.setItem(STORAGE_KEY, serverTheme);
        }
      } catch {
        // 서버 동기화 실패 시 로컬 캐시 상태를 유지
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, theme]);

  const setTheme = useCallback(
    async (value) => {
      if (!ALLOWED.includes(value)) return;

      const prev = theme;

      // 화면에는 즉시 반영
      setThemeState(value);
      applyTheme(value);
      localStorage.setItem(STORAGE_KEY, value);

      // 로그인된 경우에만 서버 설정도 함께 저장
      const token = getToken();
      if (!token) return;

      try {
        const res = await api('/api/v1/settings', {
          method: 'PATCH',
          body: JSON.stringify({ theme_preference: value }),
        });

        if (!res.ok) {
          setThemeState(prev);
          applyTheme(prev);
          localStorage.setItem(STORAGE_KEY, prev);
        }
      } catch {
        setThemeState(prev);
        applyTheme(prev);
        localStorage.setItem(STORAGE_KEY, prev);
      }
    },
    [theme],
  );

  return <ThemeContext.Provider value={{ theme, setTheme, isLoaded }}>{children}</ThemeContext.Provider>;
}
