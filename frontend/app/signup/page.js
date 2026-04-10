'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Eye, EyeOff, Mail } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export default function SignupPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    birthDate: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
    setMessage('');
  };

  const validateRequiredFields = useCallback(() => {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return '올바른 이메일을 입력해주세요.';
    }
    if (!form.password || form.password.length < 8) {
      return '비밀번호를 8자 이상 입력해주세요.';
    }
    if (!form.name) {
      return '이름을 입력해주세요.';
    }
    if (!form.birthDate) {
      return '생년월일을 입력해주세요.';
    }
    return null;
  }, [form.email, form.password, form.name, form.birthDate]);

  const sendEmailCode = useCallback(async () => {
    const err = validateRequiredFields();
    if (err) {
      setError(err);
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/email-verify/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          birth_date: form.birthDate,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.detail || '인증코드 발송에 실패했습니다.');
        return;
      }

      setEmailSent(true);
      setMessage('인증코드를 발송했습니다. 이메일을 확인해주세요.');
    } catch {
      setError('인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  }, [form.birthDate, form.email, form.name, form.password, validateRequiredFields]);

  const confirmEmailCode = useCallback(async () => {
    if (!emailCode || emailCode.length !== 6) {
      setError('6자리 인증코드를 입력해주세요.');
      return;
    }

    setConfirming(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/email-verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          code: emailCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.detail || '인증코드가 올바르지 않습니다.');
        return;
      }

      setEmailVerified(true);
      setMessage('이메일 인증이 완료되었습니다. 로그인 화면으로 이동합니다.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch {
      setError('인증 확인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setConfirming(false);
    }
  }, [emailCode, form.email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-[460px] bg-white rounded-xl shadow-modal p-8">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-nature-900 text-white font-bold mx-auto mb-2">
            D
          </Link>
          <h1 className="text-[20px] font-bold text-nature-900">회원가입</h1>
          <p className="text-[12px] text-neutral-400 mt-1">이메일 인증 후 가입을 완료합니다.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">이메일</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  updateField('email', e.target.value);
                  setEmailSent(false);
                  setEmailVerified(false);
                  setEmailCode('');
                }}
                disabled={emailVerified}
                placeholder="email@example.com"
                className="flex-1 px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors disabled:bg-cream-300 disabled:text-neutral-400"
              />
              {emailVerified ? (
                <div className="flex items-center gap-1 px-3 text-nature-500 text-[12px] font-medium">
                  <CheckCircle size={16} />
                  인증완료
                </div>
              ) : (
                <button
                  type="button"
                  onClick={sendEmailCode}
                  disabled={sending}
                  className="px-4 py-3 bg-nature-500 text-white text-[13px] font-medium rounded-lg hover:bg-nature-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {sending ? '발송 중...' : '인증코드 받기'}
                </button>
              )}
            </div>
          </div>

          {emailSent && !emailVerified && (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="인증코드 6자리"
                className="flex-1 px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 transition-colors tracking-[0.3em] text-center"
              />
              <button
                type="button"
                onClick={confirmEmailCode}
                disabled={confirming}
                className="px-4 py-3 border border-nature-500 text-nature-500 text-[13px] font-medium rounded-lg hover:bg-nature-50 transition-colors disabled:opacity-50"
              >
                {confirming ? '확인 중...' : '확인'}
              </button>
            </div>
          )}

          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="8자 이상 입력해주세요"
                className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="이름을 입력해주세요"
              className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors"
            />
          </div>

          <div>
            <label className="text-[12px] text-neutral-400 mb-1 block">생년월일</label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => updateField('birthDate', e.target.value)}
              className="w-full px-4 py-3 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-600">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-nature-200 bg-nature-50 px-4 py-3 text-[12px] text-nature-700">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={confirmEmailCode}
            disabled={!emailSent || emailVerified || confirming}
            className="w-full px-4 py-3 rounded-xl text-[14px] font-medium bg-nature-500 text-white transition-all hover:bg-nature-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailVerified ? '이메일 인증 완료' : '가입 완료'}
          </button>
        </div>

        <p className="text-[12px] text-neutral-300 text-center mt-4">
          이미 계정이 있다면{' '}
          <Link href="/login" className="text-nature-500 font-semibold">
            로그인
          </Link>
        </p>

        <p className="text-[11px] text-neutral-300 text-center mt-2">
          인증 완료 후 계정이 생성됩니다.
        </p>
      </div>
    </div>
  );
}
