// 온보딩(설문·완료)에서 공통으로 사용하는 따뜻한 베이지 톤 테마.
// 라이트/다크 테마 토글과 무관하게 일관된 분위기를 유지하기 위해
// 페이지 루트 div 의 inline style 로 주입해서 CSS 변수를 덮어쓴다.
export const ONBOARDING_THEME_VARS = {
  '--color-bg': '#F7F3EC',
  '--color-surface': '#FFFDF8',
  '--color-surface-hover': '#F2ECE2',
  '--color-border': '#DDD4C6',
  '--color-border-light': '#E8E0D3',
  '--color-border-focus': '#111111',
  '--color-text': '#1B1B18',
  '--color-text-secondary': '#4E4A43',
  '--color-text-muted': '#6B655D',
  '--color-text-hint': '#797267',
  '--color-primary': '#111111',
  '--color-primary-accent': '#111111',
  '--color-cta-bg': '#1D1D1A',
  '--color-cta-hover': '#2E2D2A',
  '--color-cta-text': '#FFFFFF',
  '--sidebar-top': '#F7F3EC',
  '--sidebar-bottom': '#F7F3EC',
};
