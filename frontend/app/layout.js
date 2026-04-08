import './globals.css';

export const metadata = {
  title: '다나아 (DA-NA-A) — AI 건강관리',
  description: '만성질환 예방을 위한 AI 건강 생활습관 코칭 서비스',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="m-0 p-0 bg-cream text-nature-900 antialiased">
        {children}
      </body>
    </html>
  );
}
