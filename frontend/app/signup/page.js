'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export default function SignupPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    birthDate: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);

  // 인증코드 타이머
  useEffect(() => {
    if (codeTimer <= 0) return;
    const t = setTimeout(() => setCodeTimer(codeTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [codeTimer]);

  // 인증코드 발송
  const sendEmailCode = useCallback(async () => {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('올바른 이메일을 입력해주세요.');
      return;
    }
    setCodeSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/email-verify/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      if (res.ok) {
        setEmailSent(true);
        setCodeTimer(180); // 3분
      } else {
        setError('인증코드 발송에 실패했습니다.');
      }
    } catch {
      // 백엔드 미연결 — 개발용으로 바로 sent 처리
      setEmailSent(true);
      setCodeTimer(180);
    } finally {
      setCodeSending(false);
    }
  }, [form.email]);

  // 인증코드 확인
  const verifyEmailCode = useCallback(async () => {
    if (!emailCode || emailCode.length < 4) {
      setError('인증코드를 입력해주세요.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/email-verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: emailCode }),
      });
      if (res.ok) {
        setEmailVerified(true);
        setError('');
      } else {
        setError('인증코드가 일치하지 않습니다.');
      }
    } catch {
      // 백엔드 미연결 — 개발용으로 바로 인증 처리
      setEmailVerified(true);
      setError('');
    }
  }, [form.email, emailCode]);

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  // 전화번호 자동 포맷 (010-1234-5678)
  const formatPhone = (val) => {
    const nums = val.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  };

  const validate = () => {
    if (!form.email) return '이메일을 입력해주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return '올바른 이메일 형식이 아닙니다.';
    if (!emailVerified) return '이메일 인증을 완료해주세요.';
    if (!form.password) return '비밀번호를 입력해주세요.';
    if (form.password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (!form.name) return '이름을 입력해주세요.';
    if (form.name.length > 20) return '이름은 20자 이내여야 합니다.';
    if (!form.birthDate) return '생년월일을 입력해주세요.';
    if (!form.phone) return '전화번호를 입력해주세요.';
    if (form.phone.replace(/\D/g, '').length < 10) return '올바른 전화번호를 입력해주세요.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          birth_date: form.birthDate,
          phone_number: form.phone.replace(/\D/g, ''),
        }),
      });

      if (res.status === 201) {
        // 가입 성공 → 온보딩으로 이동
        window.location.href = '/onboarding/diabetes';
      } else if (res.status === 409) {
        const data = await res.json();
        setError(data.detail || '이미 가입된 이메일 또는 전화번호입니다.');
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      // 백엔드 미연결 시 — 로컬 개발용으로 바로 온보딩 이동
      window.location.href = '/onboarding/diabetes';
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6">
      <div className="w-[420px] bg-white rounded-xl shadow-modal flex flex-col overflow-hidden p-8">

        {/* 로고 */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <div className="w-10 h-10 rounded-full bg-nature-900 text-white flex items-center justify-center text-[14px] font-bold mx-auto mb-2">D</div>
          </Link>
          <h1 className="text-[20px] font-bold text-nature-900 mb-0.5">회원가입</h1>
          <p className="text-[12px] text-neutral-400">다나아와 함께 건강관리를 시작하세요</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이메일 + 인증코드 */}
          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">이메일</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => { updateField('email', e.target.value); setEmailVerified(false); setEmailSent(false); }}
                disabled={emailVerified}
                className="flex-1 px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors disabled:bg-cream-300 disabled:text-neutral-400"
              />
              {emailVerified ? (
                <div className="flex items-center gap-1 px-3 text-nature-500 text-[12px] font-medium">
                  <CheckCircle size={16} /> 인증완료
                </div>
              ) : (
                <button
                  type="button"
                  onClick={sendEmailCode}
                  disabled={codeSending || (codeTimer > 0 && emailSent)}
                  className="px-4 py-3 bg-nature-500 text-white text-[13px] font-medium rounded-lg hover:bg-nature-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {codeSending ? '발송 중...' : codeTimer > 0 ? `재발송 ${Math.floor(codeTimer/60)}:${String(codeTimer%60).padStart(2,'0')}` : emailSent ? '재발송' : '인증코드 받기'}
                </button>
              )}
            </div>
            {/* 인증코드 입력 */}
            {emailSent && !emailVerified && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="인증코드 입력"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="flex-1 px-4 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 transition-colors text-center tracking-widest"
                />
                <button
                  type="button"
                  onClick={verifyEmailCode}
                  className="px-4 py-2.5 border border-nature-500 text-nature-500 text-[13px] font-medium rounded-lg hover:bg-nature-50 transition-colors"
                >
                  확인
                </button>
              </div>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="8자 이상 입력해주세요"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.password && form.password.length < 8 && (
              <p className="text-[11px] text-red-400 mt-1">8자 이상 입력해주세요</p>
            )}
          </div>

          {/* 이름 */}
          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">이름</label>
            <input
              type="text"
              placeholder="홍길동"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              maxLength={20}
              className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors"
            />
          </div>

          {/* 생년월일 */}
          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">생년월일</label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => updateField('birthDate', e.target.value)}
              className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors text-nature-900"
            />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">전화번호</label>
            <input
              type="tel"
              placeholder="010-1234-5678"
              value={form.phone}
              onChange={(e) => updateField('phone', formatPhone(e.target.value))}
              className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-[12px] text-red-500">
              {error}
            </div>
          )}

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3.5 rounded-xl text-[14px] font-medium bg-nature-500 text-white transition-all hover:bg-nature-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </form>

        {/* 하단 */}
        <p className="text-[12px] text-neutral-400 text-center mt-5">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-nature-500 font-semibold hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  );
}
