'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav — Glass */}
      <nav className="sticky top-0 z-10 flex items-center justify-between px-12 py-4 bg-white/85 backdrop-blur-xl border-b border-black/[.04]">
        <div className="text-lg font-bold text-nature-900 tracking-tight">🩺 DA-NA-A</div>
        <Link href="/login" className="px-5 py-2.5 bg-nature-500 text-white text-sm font-medium rounded-full hover:bg-nature-600 transition-all hover:-translate-y-px">
          시작하기
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-[640px] mx-auto px-12 pt-24 pb-16 text-center">
        <h1 className="text-4xl font-bold text-nature-900 leading-[1.3] mb-5 tracking-tight">
          AI 쓰면서<br /><span className="text-nature-400">건강 관리</span>까지
        </h1>
        <p className="text-lg text-neutral-400 leading-relaxed mb-9 max-w-[480px] mx-auto">
          ChatGPT, Claude, Gemini 쓰는 동안<br />자연스럽게 건강 데이터가 쌓이고, AI가 맞춤 리포트를 만들어줘요.
        </p>
        <Link href="/login" className="inline-block px-10 py-4 bg-nature-500 text-white text-base font-semibold rounded-full shadow-soft hover:bg-nature-600 hover:shadow-float hover:-translate-y-0.5 transition-all">
          지금 무료로 시작하기 →
        </Link>
        <div className="text-xs text-[var(--color-text-hint)] mt-4">가입 후 바로 사용 · 카드 등록 불필요</div>
      </section>

      {/* Steps */}
      <section className="max-w-[640px] mx-auto px-12 py-16">
        <h2 className="text-xl font-bold text-nature-900 text-center mb-8 tracking-tight">이렇게 시작해요</h2>
        <div className="grid grid-cols-3 gap-5">
          {[
            { num: '1', title: '간단 설문', desc: '2분이면 끝나는\n건강 프로필' },
            { num: '2', title: '확장 설치', desc: 'Chrome Extension\n또는 MCP' },
            { num: '3', title: 'AI와 대화', desc: '평소처럼 쓰면\n데이터가 쌓여요' },
          ].map((step) => (
            <div key={step.num} className="text-center p-7 bg-white rounded-lg shadow-soft hover:shadow-float hover:-translate-y-1 transition-all">
              <div className="w-8 h-8 rounded-full bg-nature-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-4">{step.num}</div>
              <h3 className="text-base font-semibold text-nature-900 mb-2">{step.title}</h3>
              <p className="text-xs text-neutral-400 whitespace-pre-line leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[640px] mx-auto px-12 pb-16">
        <div className="grid grid-cols-2 gap-4">
          {[
            { emoji: '🍽️', title: '식사 기록', desc: '"아침 드셨어요?" 탭 한 번' },
            { emoji: '📊', title: 'AI 주간 리포트', desc: '일주일 데이터 종합 분석' },
            { emoji: '🎯', title: '작은 습관 챌린지', desc: '까치발 10회부터 시작' },
            { emoji: '🩸', title: '당뇨 위험도', desc: '생활습관 기반 AI 분석' },
          ].map((feat) => (
            <div key={feat.title} className="flex items-start gap-4 p-5 bg-white rounded-lg shadow-xs hover:shadow-soft hover:-translate-y-0.5 transition-all">
              <span className="text-2xl mt-0.5">{feat.emoji}</span>
              <div>
                <h3 className="text-sm font-semibold text-nature-900 mb-1">{feat.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[640px] mx-auto px-12 py-14 text-center bg-cream-300 rounded-2xl mx-12 mb-16">
        <h2 className="text-2xl font-bold text-nature-900 mb-3 tracking-tight">지금 시작하세요</h2>
        <p className="text-base text-neutral-400 mb-7">작은 변화가 3개월 후 큰 차이를 만들어요</p>
        <Link href="/login" className="inline-block px-10 py-4 bg-nature-500 text-white text-base font-semibold rounded-full shadow-soft hover:bg-nature-600 hover:shadow-float hover:-translate-y-0.5 transition-all">
          무료로 시작하기 →
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-[var(--color-text-hint)] border-t border-black/[.04]">
        © 2026 DA-NA-A · 이용약관 · 개인정보처리방침
      </footer>
    </div>
  );
}
