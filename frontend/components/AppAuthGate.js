'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ensureAuthSession, syncSessionIdentity } from '../hooks/useApi';

export default function AppAuthGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function guard() {
      const restored = await ensureAuthSession();
      if (!restored) {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/app/chat')}`);
        return;
      }

      await syncSessionIdentity();
      if (!cancelled) {
        setReady(true);
      }
    }

    guard();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return <div className="min-h-screen bg-[var(--color-bg)]" />;
  }

  return children;
}
