'use client';

import { Moon, Sun } from 'lucide-react';

import useTheme from '../hooks/useTheme';

export default function ThemeToggleFloating() {
  const { theme, setTheme, isLoaded } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const nextLabel = nextTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      disabled={!isLoaded}
      className="fixed right-4 top-3 z-[95] inline-flex min-h-[48px] items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-4 py-3 text-[14px] font-semibold text-[var(--color-text)] shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur transition-transform hover:scale-[1.02] md:right-5"
      aria-label={`${nextLabel} mode`}
    >
      {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
      <span>{nextLabel}</span>
    </button>
  );
}
