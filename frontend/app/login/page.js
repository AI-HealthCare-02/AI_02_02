'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

import { api, ensureAuthSession, setToken } from '../../hooks/useApi';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const TERMS_CONTENT = `다나아 서비스 이용약관

제1조 (목적)
본 약관은 다나아 서비스의 이용 조건 및 절차를 규정합니다.

제2조 (서비스 이용)
다나아는 AI 기반 건강 관리 서비스를 제공합니다.

제3조 (면책)
다나아는 의료 진단 서비스가 아니며, 제공 정보는 참고용입니다.`;

const PRIVACY_CONTENT = `다나아 개인정보 처리방침

1. 수집 항목
이메일, 이름, 생년월일, 건강 기록, 위험도 점수

2. 수집 목적
AI 건강 코칭 서비스 제공 및 맞춤형 리포트 생성

3. 보관 기간
회원 탈퇴 시 또는 관련 법령에 따른 기간까지 보관합니다.`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);

        const statusRes = await api('/api/v1/onboarding/status');
        if (statusRes.ok) {
          const status = await statusRes.json();
          window.location.href = status.is_completed ? '/app/chat' : '/onboarding/diabetes';
        } else {
          setError('로그인은 되었지만 온보딩 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
      } else if (res.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      setError('백엔드 연결에 실패했습니다. 서버 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] p-6">
        <div className="w-[380px] rounded-2xl border border-[#E4DED3] bg-white p-8 text-center text-[14px] text-[#333333] shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
          로그인 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] p-6">
      <div className="flex w-[380px] flex-col overflow-hidden rounded-[28px] border border-[#E4DED3] bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#2F2F2F] text-[15px] font-bold text-white">
            D
          </div>
          <h1 className="mb-1 text-[20px] font-bold text-[#1F1F1F]">환영합니다</h1>
          <p className="text-[12px] text-[#555555]">당신을 위한 건강 파트너, DA-NA-A</p>
        </div>

        <form onSubmit={handleLogin} className="mb-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#555555]">이메일 주소</label>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#DDD6CB] bg-[#FCFBF8] px-4 py-3 text-[14px] text-[#222222] outline-none placeholder:text-[#8A8A8A] focus:border-[#333333] focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#555555]">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#DDD6CB] bg-[#FCFBF8] px-4 py-3 text-[14px] text-[#222222] outline-none placeholder:text-[#8A8A8A] focus:border-[#333333] focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2">
              <div className="h-4 w-4 rounded border border-[#CFC7BA] bg-white" />
              <span className="text-[12px] text-[#555555]">로그인 유지</span>
            </label>
            <button
              type="button"
              className="text-[12px] font-medium text-[#444444] hover:text-black"
              onClick={() => alert('비밀번호 재설정 이메일 발송 기능은 백엔드 연동 후 활성화됩니다.')}
            >
              비밀번호 재설정
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-[#F1C5C5] bg-[#FFF3F3] px-4 py-3 text-[12px] text-[#B42318]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2F2F2F] px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#DDD6CB]" />
          <span className="text-[12px] text-[#777777]">또는</span>
          <div className="h-px flex-1 bg-[#DDD6CB]" />
        </div>

        <div className="mb-4 space-y-2">
          <a
            href={`${API_BASE}/api/v1/auth/kakao/start`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-kakao px-4 py-3 text-[13px] font-semibold text-kakao-text transition-opacity hover:opacity-90"
          >
            <MessageCircle size={16} />
            카카오로 계속하기
          </a>
          <a
            href={`${API_BASE}/api/v1/auth/google/start`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#DDD6CB] bg-white px-4 py-3 text-[13px] font-semibold text-[#333333] transition-colors hover:bg-[#F8F8F8]"
          >
            G Google로 계속하기
          </a>
          <a
            href={`${API_BASE}/api/v1/auth/naver/start`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-naver px-4 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            N 네이버로 계속하기
          </a>
        </div>

        <p className="mb-2 text-center text-[12px] text-[#666666]">
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="font-semibold text-[#333333] hover:text-black">
            회원가입
          </Link>
        </p>
        <p className="text-center text-[11px] text-[#777777]">
          <button type="button" className="hover:text-[#333333]" onClick={() => setModal('terms')}>
            이용약관
          </button>
          {' · '}
          <button type="button" className="hover:text-[#333333]" onClick={() => setModal('privacy')}>
            개인정보 처리방침
          </button>
        </p>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
          onClick={() => setModal(null)}
        >
          <div
            className="flex max-h-[70vh] w-full max-w-[480px] flex-col rounded-2xl border border-[#E4DED3] bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EEE7DC] px-5 py-4">
              <h3 className="text-[15px] font-semibold text-[#222222]">
                {modal === 'terms' ? '이용약관' : '개인정보 처리방침'}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="text-[18px] text-[#666666] hover:text-black">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-[inherit] text-[13px] leading-[1.8] text-[#333333]">
                {modal === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT}
              </pre>
            </div>
            <div className="border-t border-[#EEE7DC] px-5 py-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-full rounded-lg bg-[#2F2F2F] py-2.5 text-[14px] font-medium text-white hover:bg-black"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
