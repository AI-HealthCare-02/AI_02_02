'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { api, ensureAuthSession, syncSessionIdentity } from '../hooks/useApi';

/**
 * 인증 분기 게이트 (시각 마크업 없음).
 *
 * - SSR/HTML에는 아무것도 렌더하지 않음 → LandingPage 마크업이 그대로 SSR로 노출 (SEO·JS-off 사용자 OK).
 * - mount 후 useEffect로 토큰 복구 → 인증되면 onboarding 상태 따라 /app/chat 또는 /onboarding/diabetes 로 router.replace.
 * - 비로그인 또는 토큰 만료(401/500/network error) 시 아무것도 하지 않음 → 사용자는 이미 보고 있는 LandingPage 그대로 사용.
 *
 * cancelled 플래그로 unmount race 차단.
 * 외곽 try/catch 로 ensureAuthSession 자체 throw 도 안전 처리 (V4 안정성 검증 권고 반영).
 */
export default function AuthRedirectGate() {
  const router = useRouter();

  useEffect(() => {
    // 미리보기 모드 — `/?preview=1` 또는 `/?landing=1` 로 접속하면 인증된 사용자도 랜딩 그대로 노출.
    // (디자인 리뷰·QA 용도. window.location 사용 → useSearchParams Suspense 의존 회피.)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('preview') === '1' || params.get('landing') === '1') return;
    }

    let cancelled = false;

    async function bootstrapSession() {
      try {
        const restored = await ensureAuthSession();
        if (!restored || cancelled) return;

        await syncSessionIdentity();

        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) return; // 401/500 시 LandingPage 그대로 두기
        const status = await statusRes.json();
        if (cancelled) return;

        router.replace(status.is_completed ? '/app/chat' : '/onboarding/diabetes');
      } catch {
        // ensureAuthSession / network 오류 — 조용히 무시, LandingPage 그대로 노출
      }
    }

    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
