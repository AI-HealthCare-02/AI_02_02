'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import { api, establishSession } from '../../hooks/useApi';

const API_BASE =
  process.env.NEXT_PUBLIC_SOCIAL_AUTH_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:8000';

function getLoginErrorMessage(status, detail) {
  if (status === 429) return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

  if (detail === 'Email not found.') {
    return '가입된 이메일을 찾을 수 없습니다. 이메일 주소를 다시 확인해 주세요.';
  }
  if (detail === 'Password is incorrect.') {
    return '비밀번호가 올바르지 않습니다. 다시 입력해 주세요.';
  }
  if (detail === 'Social account cannot use password login.') {
    return '이 계정은 소셜 로그인 계정입니다. 카카오, 구글, 네이버 로그인으로 접속해 주세요.';
  }
  if (detail === 'Account is locked.') {
    return '계정이 비활성화되어 있습니다. 관리자에게 문의해 주세요.';
  }

  return '로그인에 실패했습니다. 입력 정보를 확인한 뒤 다시 시도해 주세요.';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(getLoginErrorMessage(response.status, data?.detail));
        return;
      }

      const data = await response.json();
      await establishSession(data.access_token, { remember: keepLoggedIn });

      const statusRes = await api('/api/v1/onboarding/status');
      if (!statusRes.ok) {
        setError('로그인은 되었지만 온보딩 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const status = await statusRes.json();
      window.location.href = status.is_completed ? '/app/chat' : '/onboarding/diabetes';
    } catch {
      setError('서버 연결에 실패했습니다. 백엔드 상태를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream-200 p-4 sm:p-6">
      <div className="flex w-full max-w-[380px] flex-col overflow-hidden rounded-xl border border-cream-500 bg-cream-300 p-6 shadow-modal sm:p-8">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-nature-950 text-[15px] font-bold text-[var(--color-cta-text)]">
            D
          </div>
          <h1 className="mb-0.5 text-[18px] font-bold text-nature-900">로그인</h1>
          <p className="text-[12px] text-neutral-400">당신을 위한 건강 파트너, DANAA</p>
        </div>

        <form onSubmit={handleLogin} className="mb-3 space-y-3">
          <div>
            <div className="mb-1 text-[12px] text-neutral-400">이메일 주소</div>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border-b border-cream-500 bg-transparent px-0 py-2 text-[14px] outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <div className="mb-1 text-[12px] text-neutral-400">비밀번호</div>
            <input
              type="password"
              placeholder="비밀번호를 입력해 주세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border-b border-cream-500 bg-transparent px-0 py-2 text-[14px] outline-none focus:border-neutral-400"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(event) => setKeepLoggedIn(event.target.checked)}
                className="h-4 w-4 rounded border border-cream-500 text-nature-500 focus:ring-nature-500/30"
              />
              <span className="text-[12px] text-neutral-400">로그인 유지</span>
            </label>

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <Link href="/account-recovery#email" className="font-medium text-nature-500">
                아이디 찾기
              </Link>
              <span className="text-cream-600">|</span>
              <Link href="/account-recovery#password" className="font-medium text-nature-500">
                비밀번호 재설정
              </Link>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-2.5 text-[12px] text-danger">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-nature-950 px-4 py-3 text-[14px] font-medium text-[var(--color-cta-text)] transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="my-2 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-cream-500" />
          <span className="text-[12px] text-[var(--color-text-hint)]">또는</span>
          <div className="h-px flex-1 bg-cream-500" />
        </div>

        <div className="mb-4 space-y-1.5">
          <a
            href={`${API_BASE}/api/v1/auth/kakao/start`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-kakao px-4 py-2.5 text-[13px] font-medium text-kakao-text transition-all hover:opacity-90"
          >
            <MessageCircle size={16} />
            카카오로 계속하기
          </a>
          <a
            href={`${API_BASE}/api/v1/auth/google/start`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#DADCE0] bg-white px-4 py-2.5 text-[13px] font-medium text-[#333333] transition-all hover:bg-[#F8F9FA]"
          >
            G Google로 계속하기
          </a>
          <a
            href={`${API_BASE}/api/v1/auth/naver/start`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-naver px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90"
          >
            N 네이버로 계속하기
          </a>
        </div>

        <p className="mb-1.5 text-center text-[12px] text-[var(--color-text-hint)]">
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="font-semibold text-neutral-500 hover:text-nature-900">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
