'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';

import useTheme from '../hooks/useTheme';

// 공개 페이지(온보딩·로그인·회원가입·랜딩·소셜 콜백) 에서는 토글을 숨긴다.
// 이들은 라이트로 강제되므로 전환 버튼 자체가 의미 없음.
const HIDDEN_PATH_PREFIXES = ['/onboarding', '/login', '/signup', '/landing-new', '/social-auth'];

export default function ThemeToggleFloating() {
  const { theme, setTheme, isLoaded } = useTheme();
  const pathname = usePathname() || '';

  const hidden = pathname === '/' || HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (hidden) return null;

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const nextLabel = nextTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      disabled={!isLoaded}
      className="fixed right-14 top-[7px] z-[95] inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-3 text-[12px] font-medium text-[var(--color-text)] shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur transition-transform hover:scale-[1.02]"
      aria-label={`${nextLabel} mode`}
    >
      {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
      <span>{nextLabel}</span>
    </button>
  );
}
