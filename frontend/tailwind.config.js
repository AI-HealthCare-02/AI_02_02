/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DA-NA-A Design System v2 — Modern Nature
        nature: {
          DEFAULT: '#2D3B15',    // primary deep olive
          50:  '#F5F7F2',
          100: '#EEF2E8',
          200: '#D4DFC6',
          300: '#B8CCA0',
          400: '#94AD6E',
          500: '#6B8F3C',        // accent
          600: '#5A6E2F',        // secondary
          700: '#48592A',
          800: '#364520',
          900: '#2D3B15',        // primary
          950: '#1A2409',
        },
        cream: {
          DEFAULT: '#FAFAF8',
          50:  '#FFFFFF',
          100: '#FDFDFB',
          200: '#FAFAF8',
          300: '#F5F7F2',
          400: '#EEF2E8',
          500: '#E8EDE0',
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
        'xs':    '0 1px 2px rgba(0,0,0,.04)',
        'soft':  '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        'float': '0 4px 12px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04)',
        'lift':  '0 8px 24px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04)',
        'modal': '0 16px 48px rgba(0,0,0,.10), 0 4px 12px rgba(0,0,0,.05)',
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
