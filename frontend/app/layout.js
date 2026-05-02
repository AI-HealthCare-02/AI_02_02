import './globals.css';
import { Noto_Sans_KR } from 'next/font/google';
import { ThemeProvider } from '../contexts/ThemeContext';
import ThemeToggleFloating from '../components/ThemeToggleFloating';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ui',
});

export const metadata = {
  title: '다나아(DA-NA-A) | AI 건강관리',
  description: '만성질환 예방을 위한 AI 건강 생활습관 코칭 서비스',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '다나아',
    statusBarStyle: 'default',
  },
  verification: {
    google: 'SHfb0EXqPhftJEvAzp8Ijw89Jzz75tT_cnw_BH_brZA',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F8F8F6',
};

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var p = location.pathname || '/';
    // 공개 페이지(로그인/회원가입/온보딩/랜딩) 는 localStorage 값과 무관하게 라이트 강제
    var forceLight = p === '/' ||
      /^\\/(login|signup|account-recovery|onboarding|social-auth|landing-new)(\\/|$)/.test(p);
    if (forceLight) {
      document.documentElement.dataset.theme = 'light';
      return;
    }
    var t = localStorage.getItem('danaa_theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.dataset.theme = t;
    } else {
      document.documentElement.dataset.theme = 'light';
    }
  } catch(e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="ko"
      className={notoSansKr.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {/* Pretendard Variable — V4 랜딩 메인 본문 폰트 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        {/* Geist — V4 랜딩 숫자·라벨 강조 폰트 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="m-0 bg-cream-200 p-0 text-nature-900 antialiased">
        <ThemeProvider>
          <ThemeToggleFloating />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
