'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="text-center max-w-[400px]">
        <div className="text-[64px] font-bold text-cream-500 mb-2">404</div>
        <h1 className="text-[20px] font-semibold text-nature-900 mb-2">페이지를 찾을 수 없어요</h1>
        <p className="text-[14px] text-neutral-400 mb-6">
          요청하신 페이지가 존재하지 않거나 이동되었어요.
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            href="/app/chat"
            className="px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors"
          >
            채팅으로 돌아가기
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 border border-cream-500 text-neutral-400 text-[14px] font-medium rounded-lg hover:bg-cream-300 transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
