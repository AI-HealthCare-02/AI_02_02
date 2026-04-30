'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api, ensureAuthSession, syncSessionIdentity } from '../hooks/useApi';

export default function LandingPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      const restored = await ensureAuthSession();
      if (!restored || cancelled) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      await syncSessionIdentity();

      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error('status_check_failed');

        const status = await statusRes.json();
        if (!cancelled) {
          router.replace(status.is_completed ? '/app/chat' : '/onboarding/diabetes');
        }
      } catch {
        if (!cancelled) setCheckingSession(false);
      }
    }

    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) {
    return <div className="min-h-screen bg-[var(--color-bg)] transition-colors" />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-12 py-4 backdrop-blur-xl transition-colors">
        <div className="text-lg font-bold tracking-tight text-[var(--color-text)]">DA-NA-A</div>
        <div className="h-12 w-[120px]" />
      </nav>

      <section className="mx-auto max-w-[640px] px-12 pb-16 pt-24 text-center">
        <h1 className="mb-5 text-4xl font-bold leading-[1.3] tracking-tight text-[var(--color-text)]">
          AI 쓰면서
          <br />
          <span className="font-bold text-[var(--color-text)]">건강관리까지</span>
        </h1>
        <p className="mx-auto mb-9 max-w-[480px] text-lg leading-relaxed text-[var(--color-text-secondary)]">
          ChatGPT, Claude, Gemini를 쓰는 동안
          <br />
          자연스럽게 건강 데이터가 쌓이고 AI가 맞춤 리포트를 만들어줍니다.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-nature-500 px-10 py-4 text-base font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-nature-600 hover:shadow-float"
        >
          지금 무료로 시작하기
        </Link>
        <div className="mt-4 text-xs text-[var(--color-text-hint)]">가입 즉시 바로 사용 가능, 카드 등록 불필요</div>
      </section>

      <section className="mx-auto max-w-[640px] px-12 py-16">
        <h2 className="mb-8 text-center text-xl font-bold tracking-tight text-[var(--color-text)]">이렇게 시작해요</h2>
        <div className="grid grid-cols-3 gap-5">
          {[
            { num: '1', title: '간단 설문', desc: '2분이면 끝나는\n건강 프로필 설정' },
            { num: '2', title: '확장 연결', desc: 'Chrome Extension\n또는 MCP 연결' },
            { num: '3', title: 'AI와 대화', desc: '평소처럼 쓰면\n데이터가 쌓여요' },
          ].map((step) => (
            <div
              key={step.num}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-7 text-center transition-all hover:-translate-y-1 hover:shadow-float"
            >
              <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-nature-500 text-sm font-bold text-white">
                {step.num}
              </div>
              <h3 className="mb-2 text-base font-semibold text-[var(--color-text)]">{step.title}</h3>
              <p className="whitespace-pre-line text-xs leading-relaxed text-[var(--color-text-secondary)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[640px] px-12 pb-16">
        <div className="grid grid-cols-2 gap-4">
          {[
            { emoji: '📝', title: '식사 기록', desc: '"오늘 뭐 먹었어요?" 한 번이면 충분해요' },
            { emoji: '📊', title: 'AI 주간 리포트', desc: '일주일 데이터를 종합 분석해요' },
            { emoji: '🎯', title: '작은 습관 챌린지', desc: '가볍게 시작하고 꾸준히 이어가요' },
            { emoji: '🩺', title: '건강 위험 예측', desc: '생활습관 기반 AI 분석을 제공해요' },
          ].map((feat) => (
            <div
              key={feat.title}
              className="flex items-start gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="mt-0.5 text-2xl">{feat.emoji}</span>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[var(--color-text)]">{feat.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-12 mb-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-12 py-14 text-center transition-colors">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-[var(--color-text)]">지금 시작하세요</h2>
        <p className="mb-7 text-base text-[var(--color-text-secondary)]">작은 변화가 3개월 후 큰 차이를 만들어요</p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-nature-500 px-10 py-4 text-base font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-nature-600 hover:shadow-float"
        >
          무료로 시작하기
        </Link>
      </section>

      <footer className="border-t border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-text-hint)] transition-colors">
        © 2026 DA-NA-A ·{' '}
        <Link href="/terms" className="hover:underline">이용약관</Link>
        {' · '}
        <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
      </footer>
    </div>
  );
}
