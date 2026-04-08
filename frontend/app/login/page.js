'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    window.location.href = '/onboarding/diabetes';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6">
      <div className="w-[380px] bg-white rounded-xl shadow-modal flex flex-col overflow-hidden p-8">

        {/* 로고 */}
        <div className="text-center mb-5">
          <div className="w-10 h-10 rounded-full bg-nature-900 text-white flex items-center justify-center text-[14px] font-bold mx-auto mb-2">D</div>
          <h1 className="text-[18px] font-bold text-nature-900 mb-0.5">환영합니다</h1>
          <p className="text-[11px] text-neutral-400">당신을 위한 건강 파트너, DA-NA-A</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleLogin} className="space-y-3 mb-3">
          <div>
            <div className="text-[11px] text-neutral-400 mb-1">이메일 주소</div>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-0 py-2 border-b border-cream-500 text-[13px] outline-none focus:border-nature-500 bg-transparent"
            />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 mb-1">비밀번호</div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-0 py-2 border-b border-cream-500 text-[13px] outline-none focus:border-nature-500 bg-transparent"
            />
          </div>

          {/* 로그인 유지 + 비밀번호 재설정 */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <div className="w-4 h-4 rounded border border-cream-500 flex items-center justify-center text-[9px] text-transparent hover:border-nature-500">✓</div>
              <span className="text-[11px] text-neutral-400">로그인 유지</span>
            </label>
            <span className="text-[11px] text-nature-500 font-medium cursor-pointer">비밀번호 재설정</span>
          </div>

          <button type="submit" className="w-full px-4 py-3 rounded-xl text-[13px] font-medium bg-nature-900 text-white transition-all hover:bg-nature-800">
            로그인
          </button>
        </form>

        <div className="flex items-center gap-3 w-full my-2">
          <div className="flex-1 h-px bg-cream-500" />
          <span className="text-[11px] text-neutral-300">또는</span>
          <div className="flex-1 h-px bg-cream-500" />
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-1.5 mb-4">
          <button onClick={() => window.location.href = '/onboarding/diabetes'} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-[#FEE500] text-[#3C1E1E] transition-all">
            💬 카카오로 계속하기
          </button>
          <button onClick={() => window.location.href = '/onboarding/diabetes'} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-white border border-cream-500 text-[#333] transition-all">
            G Google로 계속하기
          </button>
          <button onClick={() => window.location.href = '/onboarding/diabetes'} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-[#03C75A] text-white transition-all">
            N 네이버로 계속하기
          </button>
        </div>

        {/* 하단 */}
        <p className="text-[11px] text-neutral-300 text-center mb-1.5">
          아직 계정이 없으신가요?{' '}
          <Link href="/onboarding/diabetes" className="text-nature-500 font-semibold">회원가입</Link>
        </p>
        <p className="text-[10px] text-neutral-300 text-center">
          <span className="cursor-pointer hover:text-neutral-400">이용약관</span>
          {' · '}
          <span className="cursor-pointer hover:text-neutral-400">개인정보 처리방침</span>
        </p>
      </div>
    </div>
  );
}
