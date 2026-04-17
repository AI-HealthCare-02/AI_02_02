'use client';

import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

/**
 * 테마 상태 접근 hook.
 * @returns {{ theme: 'dark'|'light', setTheme: (v: string) => Promise<void>, isLoaded: boolean }}
 */
export default function useTheme() {
  return useContext(ThemeContext);
}
