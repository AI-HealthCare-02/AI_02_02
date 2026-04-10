'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="text-center max-w-[400px]">
        <div className="w-16 h-16 rounded-full bg-danger-light flex items-center justify-center mx-auto mb-4">
          <span className="text-[28px]">!</span>
        </div>
        <h1 className="text-[20px] font-semibold text-nature-900 mb-2">문제가 발생했어요</h1>
        <p className="text-[14px] text-neutral-400 mb-6">
          일시적인 오류가 발생했습니다.<br />
          잠시 후 다시 시도해주세요.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-lg hover:bg-nature-600 transition-colors"
          >
            다시 시도
          </button>
          <a
            href="/app/chat"
            className="px-5 py-2.5 border border-cream-500 text-neutral-400 text-[14px] font-medium rounded-lg hover:bg-cream-300 transition-colors"
          >
            채팅으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
