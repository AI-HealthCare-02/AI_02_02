/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DA-NA-A Design System v8 — Theme-aware (CSS 변수 참조)
        nature: {
          DEFAULT: 'var(--color-text)',
          100: 'var(--sidebar-top)',
          400: 'var(--color-text-secondary)',
          500: 'var(--color-cta-bg)',
          600: 'var(--color-cta-hover)',
          700: 'var(--color-border)',
          800: 'var(--color-text-secondary)',
          900: 'var(--color-text)',
          950: 'var(--color-primary)',
        },
        neutral: {
          300: 'var(--color-border)',
          400: 'var(--color-text-muted)',
          500: 'var(--color-text-secondary)',
          600: 'var(--color-text-secondary)',
          700: 'var(--color-text)',
          800: 'var(--color-text)',
          900: 'var(--color-text)',
        },
        cream: {
          DEFAULT: 'var(--color-bg)',
          200: 'var(--color-bg)',
          300: 'var(--color-surface)',
          400: 'var(--color-surface-hover)',
          500: 'var(--color-border)',
        },
        // 시맨틱 컬러
        success: {
          light: '#EBF7ED',
          DEFAULT: '#3D7C3F',
          dark: '#2D5E2F',
        },
        danger: {
          light: '#FEECEC',
          DEFAULT: '#C43C3C',
          dark: '#9B2C2C',
        },
        warning: {
          light: '#FFF5EB',
          DEFAULT: '#E07800',
          dark: '#B86200',
        },
        info: {
          light: '#E8F1FD',
          DEFAULT: '#4A7FB5',
          dark: '#3A6694',
        },
        // 소셜 로그인 브랜드 컬러
        kakao: { DEFAULT: '#FEE500', text: '#3C1E1E' },
        naver: { DEFAULT: '#03C75A' },
        google: { text: '#333333' },
      },
      fontFamily: {
        sans: ['Pretendard Variable', '-apple-system', 'BlinkMacSystemFont', 'Noto Sans KR', 'sans-serif'],
        heading: ['Pretendard Variable', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['11px', { lineHeight: '1.5' }],
        'sm':   ['12px', { lineHeight: '1.5' }],
        'base': ['14px', { lineHeight: '1.6' }],
        'md':   ['13px', { lineHeight: '1.6' }],
        'lg':   ['16px', { lineHeight: '1.5' }],
        'xl':   ['20px', { lineHeight: '1.4' }],
        '2xl':  ['22px', { lineHeight: '1.3' }],
        '3xl':  ['30px', { lineHeight: '1.2' }],
        '4xl':  ['38px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        'sm':  '8px',
        'md':  '12px',
        'lg':  '16px',
        'xl':  '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'xs':    '0 1px 2px rgba(0,0,0,.20)',
        'soft':  '0 1px 3px rgba(0,0,0,.24), 0 1px 2px rgba(0,0,0,.16)',
        'float': '0 4px 12px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.16)',
        'lift':  '0 8px 24px rgba(0,0,0,.32), 0 2px 8px rgba(0,0,0,.16)',
        'modal': '0 16px 48px rgba(0,0,0,.40), 0 4px 12px rgba(0,0,0,.20)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(.25,.46,.45,.94)',
        'spring':   'cubic-bezier(.34,1.56,.64,1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
}
