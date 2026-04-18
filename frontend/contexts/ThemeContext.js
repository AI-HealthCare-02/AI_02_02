'use client';

import { createContext, useCallback, useEffect, useState } from 'react';

import { api, getToken } from '../hooks/useApi';

const STORAGE_KEY = 'danaa_theme';
const ALLOWED = ['dark', 'light'];
const DEFAULT_THEME = 'light';

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

  useEffect(() => {
    const local = readLocalTheme();
    setThemeState(local);
    applyTheme(local);
    setIsLoaded(true);
  }, []);

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
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const setTheme = useCallback(async (value) => {
    if (!ALLOWED.includes(value)) return;

    setThemeState(value);
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
