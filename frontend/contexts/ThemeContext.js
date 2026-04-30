'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { api, getToken } from '../hooks/useApi';

const STORAGE_KEY = 'danaa_theme';
const ALLOWED = ['dark', 'light'];
const DEFAULT_THEME = 'light';

// 로그인·회원가입·온보딩·랜딩 등 공개 경로는 localStorage 값과 무관하게
// 항상 라이트로 렌더한다. 이들 페이지는 라이트 전용으로 디자인되어
// 다크 적용 시 "D 로고·로그인 버튼" 같은 요소가 배경과 동색이 되어 안 보이기 때문.
const FORCE_LIGHT_PREFIXES = [
  '/login',
  '/signup',
  '/onboarding',
  '/social-auth',
  '/landing-new',
];

function isForcedLightPath(pathname) {
  if (!pathname) return false;
  if (pathname === '/') return true; // 루트 랜딩도 라이트 강제
  return FORCE_LIGHT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

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

function hasStoredThemePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return ALLOWED.includes(stored);
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [isLoaded, setIsLoaded] = useState(false);
  const themeRef = useRef(DEFAULT_THEME);
  const pathname = usePathname();
  const forcedLight = isForcedLightPath(pathname);

  useEffect(() => {
    const local = readLocalTheme();
    setThemeState(local);
    themeRef.current = local;
    applyTheme(local);
    setIsLoaded(true);
  }, []);

  // 경로 변경 시: 공개 페이지는 항상 라이트로, 앱 내부는 저장된 테마로 복원
  useEffect(() => {
    if (!isLoaded) return;
    if (forcedLight) {
      applyTheme('light');
    } else {
      applyTheme(theme);
    }
  }, [forcedLight, isLoaded, theme]);

  useEffect(() => {
    if (!isLoaded) return;

    const token = getToken();
    if (!token) return;
    if (hasStoredThemePreference()) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api('/api/v1/settings');
        if (!res.ok) return;

        const data = await res.json();
        const serverTheme = data.theme_preference;

        if (!cancelled && ALLOWED.includes(serverTheme) && serverTheme !== themeRef.current) {
          setThemeState(serverTheme);
          themeRef.current = serverTheme;
          if (!forcedLight) applyTheme(serverTheme);
          localStorage.setItem(STORAGE_KEY, serverTheme);
        }
      } catch {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forcedLight, isLoaded]);

  const setTheme = useCallback(async (value) => {
    if (!ALLOWED.includes(value)) return;

    setThemeState(value);
    themeRef.current = value;
    applyTheme(value);
    localStorage.setItem(STORAGE_KEY, value);

    const token = getToken();
    if (!token) return;

    try {
      await api('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify({ theme_preference: value }),
      });
    } catch {
      return;
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, isLoaded }}>{children}</ThemeContext.Provider>;
}
