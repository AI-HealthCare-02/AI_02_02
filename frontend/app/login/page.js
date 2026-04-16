'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { api, setToken } from '../../hooks/useApi';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const TERMS_CONTENT = `다나아 서비스 이용약관

제1조 (목적) 이 약관은 다나아 서비스의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무를 규정합니다.

제2조 (서비스 내용) 다나아는 AI 기반 건강 생활습관 코칭 서비스를 제공합니다.

제3조 (개인정보) 서비스 이용을 위해 수집되는 개인정보는 건강 기록, 생활습관 데이터에 한정되며, 관련 법률에 따라 보호됩니다.

제4조 (면책) 다나아는 의료 진단 서비스가 아니며, 제공되는 정보는 참고용입니다.`;

const PRIVACY_CONTENT = `다나아 개인정보 처리방침

1. 수집하는 개인정보: 이메일, 성별, 연령대, 건강 기록(수면/식사/운동/수분), 당뇨 위험도 점수

2. 수집 목적: AI 건강 코칭 서비스 제공, 맞춤 리포트 생성

3. 보관 기간: 회원 탈퇴 시까지 (탈퇴 후 30일 이내 파기)

4. 제3자 제공: 동의 없이 외부에 제공하지 않습니다.

5. 이용자 권리: 열람, 수정, 삭제, 동의 철회를 언제든 요청할 수 있습니다.`;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modal, setModal] = useState(null); // 'terms' | 'privacy' | null
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
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

        // 온보딩 완료 여부 확인 후 분기
        const statusRes = await api('/api/v1/onboarding/status');
        if (statusRes.ok) {
          const status = await statusRes.json();
          window.location.href = status.is_completed ? '/app/chat' : '/onboarding/diabetes';
        } else {
          setError('로그인은 되었지만 온보딩 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
      } else if (res.status === 401) {
        setError('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else {
        setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      // 백엔드 미연결 — 개발용 fallback
      setError('백엔드 연결에 실패했습니다. 서버 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6">
      <div className="w-[380px] bg-white rounded-xl shadow-modal flex flex-col overflow-hidden p-8">

        {/* 로고 */}
        <div className="text-center mb-5">
          <div className="w-10 h-10 rounded-full bg-nature-900 text-white flex items-center justify-center text-[15px] font-bold mx-auto mb-2">D</div>
          <h1 className="text-[18px] font-bold text-nature-900 mb-0.5">환영합니다</h1>
          <p className="text-[12px] text-neutral-400">당신을 위한 건강 파트너, DA-NA-A</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleLogin} className="space-y-3 mb-3">
          <div>
            <div className="text-[12px] text-neutral-400 mb-1">이메일 주소</div>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-0 py-2 border-b border-cream-500 text-[14px] outline-none focus:border-nature-500 bg-transparent"
            />
          </div>
          <div>
            <div className="text-[12px] text-neutral-400 mb-1">비밀번호</div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-0 py-2 border-b border-cream-500 text-[14px] outline-none focus:border-nature-500 bg-transparent"
            />
          </div>

          {/* 로그인 유지 + 비밀번호 재설정 */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <div className="w-4 h-4 rounded border border-cream-500 flex items-center justify-center text-[9px] text-transparent hover:border-nature-500">✓</div>
              <span className="text-[12px] text-neutral-400">로그인 유지</span>
            </label>
            <span className="text-[12px] text-nature-500 font-medium cursor-pointer" onClick={() => alert('비밀번호 재설정 이메일이 발송됩니다. (백엔드 연동 후 활성화)')}>비밀번호 재설정</span>
          </div>

          {error && (
            <div className="bg-danger-light border border-danger/20 rounded-lg px-4 py-2.5 text-[12px] text-danger">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full px-4 py-3 rounded-xl text-[14px] font-medium bg-nature-500 text-white transition-all hover:bg-nature-600 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="flex items-center gap-3 w-full my-2">
          <div className="flex-1 h-px bg-cream-500" />
          <span className="text-[12px] text-neutral-300">또는</span>
          <div className="flex-1 h-px bg-cream-500" />
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-1.5 mb-4">
          <a href={`${API_BASE}/api/v1/auth/kakao/start`} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-kakao text-kakao-text transition-all hover:opacity-90">
            <MessageCircle size={16} /> 카카오로 계속하기
          </a>
          <a href={`${API_BASE}/api/v1/auth/google/start`} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-white border border-cream-500 text-google-text transition-all hover:opacity-90">
            G Google로 계속하기
          </a>
          <a href={`${API_BASE}/api/v1/auth/naver/start`} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-naver text-white transition-all hover:opacity-90">
            N 네이버로 계속하기
          </a>
        </div>

        {/* 하단 */}
        <p className="text-[12px] text-neutral-300 text-center mb-1.5">
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="text-nature-500 font-semibold">회원가입</Link>
        </p>
        <p className="text-[11px] text-neutral-300 text-center">
          <span className="cursor-pointer hover:text-neutral-400" onClick={() => setModal('terms')}>이용약관</span>
          {' · '}
          <span className="cursor-pointer hover:text-neutral-400" onClick={() => setModal('privacy')}>개인정보 처리방침</span>
        </p>
      </div>

      {/* 약관/정책 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl max-w-[480px] w-full max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-cream-500 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-nature-900">
                {modal === 'terms' ? '이용약관' : '개인정보 처리방침'}
              </h3>
              <button onClick={() => setModal(null)} className="text-neutral-400 hover:text-nature-900 text-[18px]">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-[13px] text-neutral-600 leading-[1.8] whitespace-pre-wrap font-[inherit]">
                {modal === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-cream-500">
              <button onClick={() => setModal(null)} className="w-full py-2.5 bg-nature-500 text-white rounded-lg text-[14px] font-medium hover:bg-nature-600 transition-colors">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
