'use client';

import { Suspense } from 'react';
import SocialAuthClient from './SocialAuthClient';

export default function SocialAuthPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-400 via-cream to-neutral-100">
          <div className="rounded-2xl bg-white px-8 py-6 shadow-modal">
            <p className="text-sm font-medium text-nature-900">소셜 로그인 처리 중입니다.</p>
            <p className="mt-2 text-xs text-neutral-400">잠시만 기다리면 다음 화면으로 이동합니다.</p>
          </div>
        </div>
      }
    >
      <SocialAuthClient searchParams={searchParams} />
    </Suspense>
  );
}
