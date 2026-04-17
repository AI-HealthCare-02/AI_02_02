'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api, ensureAuthSession } from '../hooks/useApi';

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
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white text-[#171717]">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[.04] bg-white/85 px-12 py-4 backdrop-blur-xl">
        <div className="text-lg font-bold tracking-tight text-[#171717]">DA-NA-A</div>
        <Link
          href="/login"
          className="rounded-full bg-nature-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px hover:bg-nature-600"
        >
          시작하기
        </Link>
      </nav>

      <section className="mx-auto max-w-[640px] px-12 pb-16 pt-24 text-center">
        <h1 className="mb-5 text-4xl font-bold leading-[1.3] tracking-tight text-[#171717]">
          AI 쓰면서
          <br />
          <span className="font-bold text-[#171717]">건강관리까지</span>
        </h1>
        <p className="mx-auto mb-9 max-w-[480px] text-lg leading-relaxed text-[#4B4B4B]">
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
        <div className="mt-4 text-xs text-[#5C5C5C]">가입 즉시 바로 사용 가능, 카드 등록 불필요</div>
      </section>

      <section className="mx-auto max-w-[640px] px-12 py-16">
        <h2 className="mb-8 text-center text-xl font-bold tracking-tight text-[#171717]">이렇게 시작해요</h2>
        <div className="grid grid-cols-3 gap-5">
          {[
            { num: '1', title: '간단 설문', desc: '2분이면 끝나는\n건강 프로필 설정' },
            { num: '2', title: '확장 연결', desc: 'Chrome Extension\n또는 MCP 연결' },
            { num: '3', title: 'AI와 대화', desc: '평소처럼 쓰면\n데이터가 쌓여요' },
          ].map((step) => (
            <div
              key={step.num}
              className="rounded-lg bg-white p-7 text-center transition-all hover:-translate-y-1 hover:shadow-float"
            >
              <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-nature-500 text-sm font-bold text-white">
                {step.num}
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#171717]">{step.title}</h3>
              <p className="whitespace-pre-line text-xs leading-relaxed text-[#4B4B4B]">{step.desc}</p>
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
              className="flex items-start gap-4 rounded-lg bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="mt-0.5 text-2xl">{feat.emoji}</span>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[#171717]">{feat.title}</h3>
                <p className="text-xs leading-relaxed text-[#4B4B4B]">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-12 mb-16 rounded-2xl bg-cream-300 px-12 py-14 text-center">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-[#171717]">지금 시작하세요</h2>
        <p className="mb-7 text-base text-[#4B4B4B]">작은 변화가 3개월 후 큰 차이를 만들어요</p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-nature-500 px-10 py-4 text-base font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-nature-600 hover:shadow-float"
        >
          무료로 시작하기
        </Link>
      </section>

      <footer className="border-t border-black/[.04] py-6 text-center text-xs text-[#5C5C5C]">
        © 2026 DA-NA-A · 이용약관 · 개인정보처리방침
      </footer>
    </div>
  );
}
