import './globals.css';

// 전체 레이아웃 — 모든 페이지에 적용됨
export const metadata = {
  title: '다나아 (DA-NA-A) — AI 건강관리',
  description: 'AI 채팅 연동형 건강관리 웹 서비스',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
