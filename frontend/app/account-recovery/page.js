'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');

function validatePassword(password) {
  if (!password) return '새 비밀번호를 입력해 주세요.';
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return '비밀번호는 영문 대문자, 영문 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.';
  }
  return '';
}

function mapRecoveryError(status, detail) {
  if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (detail === 'Email not found.') return '가입된 이메일을 찾을 수 없습니다.';
  if (detail === 'Social account cannot reset password.') return '소셜 로그인 계정은 해당 소셜 로그인으로 접속해 주세요.';
  if (detail === 'Verification code is invalid.') return '인증 코드가 올바르지 않습니다.';
  if (detail === 'Invalid password reset token.') return '재설정 인증 시간이 만료되었습니다. 인증 코드를 다시 받아 주세요.';
  if (detail === 'Password reset token does not match email.') return '인증을 요청한 이메일과 입력한 이메일이 다릅니다.';
  if (detail === 'SMTP authentication failed. Check the Gmail address and app password.') {
    return '메일 서버 인증 설정에 문제가 있어 인증 코드를 보낼 수 없습니다.';
  }
  if (detail === 'Failed to send verification email. Check SMTP configuration and network access.') {
    return '메일 서버 또는 네트워크 문제로 인증 코드를 보낼 수 없습니다.';
  }
  if (detail === 'Email delivery is not configured.') return '현재 이메일 발송 기능이 설정되어 있지 않습니다.';
  return typeof detail === 'string' && detail ? detail : '요청을 처리하지 못했습니다.';
}

export default function AccountRecoveryPage() {
  const [tab, setTab] = useState('email');
  const [findForm, setFindForm] = useState({ name: '', birthDate: '' });
  const [foundAccounts, setFoundAccounts] = useState(null);
  const [findMessage, setFindMessage] = useState('');
  const [findLoading, setFindLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#password') {
      setTab('password');
    }
  }, []);

  const findEmail = async () => {
    const name = findForm.name.trim();
    if (!name) {
      setFindMessage('이름을 입력해 주세요.');
      return;
    }
    if (!findForm.birthDate) {
      setFindMessage('생년월일을 입력해 주세요.');
      return;
    }

    setFindLoading(true);
    setFindMessage('');
    setFoundAccounts(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/account/find-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          birth_date: findForm.birthDate,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFindMessage(mapRecoveryError(response.status, data?.detail));
        return;
      }
      setFoundAccounts(data.accounts || []);
      setFindMessage(data.accounts?.length ? '가입 계정을 찾았습니다.' : '일치하는 계정을 찾지 못했습니다.');
    } catch {
      setFindMessage('서버 연결에 실패했습니다.');
    } finally {
      setFindLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    const email = resetEmail.trim();
    if (!email) {
      setResetError('이메일을 입력해 주세요.');
      return;
    }

    setSendingReset(true);
    setResetError('');
    setResetMessage('');
    setResetDone(false);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/password/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResetError(mapRecoveryError(response.status, data?.detail));
        return;
      }
      setResetToken(data.reset_token || '');
      setResetCode('');
      if (data.delivery_mode === 'dev-code' && data.dev_verification_code) {
        setResetMessage(`인증 코드가 발급되었습니다. 개발용 인증 코드: ${data.dev_verification_code}`);
      } else {
        setResetMessage('인증 코드를 이메일로 보냈습니다. 받은 편지함과 스팸함을 확인해 주세요.');
      }
    } catch {
      setResetError('서버 연결에 실패했습니다.');
    } finally {
      setSendingReset(false);
    }
  };

  const confirmPasswordReset = async () => {
    const passwordError = validatePassword(newPassword);
    if (!resetToken) {
      setResetError('먼저 인증 코드를 받아 주세요.');
      return;
    }
    if (resetCode.length !== 6) {
      setResetError('인증 코드 6자리를 입력해 주세요.');
      return;
    }
    if (passwordError) {
      setResetError(passwordError);
      return;
    }

    setConfirmingReset(true);
    setResetError('');
    setResetMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/password/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          code: resetCode,
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResetError(mapRecoveryError(response.status, data?.detail));
        return;
      }
      setResetDone(true);
      setResetMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
      setNewPassword('');
      setResetCode('');
    } catch {
      setResetError('서버 연결에 실패했습니다.');
    } finally {
      setConfirmingReset(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream-200 p-4 sm:p-6">
      <div className="w-full max-w-[480px] rounded-xl border border-cream-500 bg-cream-300 p-6 shadow-modal sm:p-8">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-nature-900 font-bold text-white"
          >
            D
          </Link>
          <h1 className="text-[20px] font-bold text-nature-900">계정 찾기</h1>
          <p className="mt-1 text-[12px] text-neutral-400">가입 정보 확인 또는 비밀번호 재설정을 도와드릴게요.</p>
        </div>

        <div className="mb-5 grid grid-cols-1 rounded-lg border border-cream-500 bg-cream-200 p-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTab('email')}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${tab === 'email' ? 'bg-white text-nature-900 shadow-sm' : 'text-neutral-400'}`}
          >
            아이디 찾기
          </button>
          <button
            type="button"
            onClick={() => setTab('password')}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${tab === 'password' ? 'bg-white text-nature-900 shadow-sm' : 'text-neutral-400'}`}
          >
            비밀번호 재설정
          </button>
        </div>

        {tab === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] text-neutral-400">이름</label>
              <input
                value={findForm.name}
                onChange={(event) => {
                  setFindForm((prev) => ({ ...prev, name: event.target.value }));
                  setFindMessage('');
                  setFoundAccounts(null);
                }}
                placeholder="가입 시 입력한 이름"
                className="w-full rounded-lg border border-cream-500 px-4 py-3 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-neutral-400">생년월일</label>
              <input
                type="date"
                value={findForm.birthDate}
                onChange={(event) => {
                  setFindForm((prev) => ({ ...prev, birthDate: event.target.value }));
                  setFindMessage('');
                  setFoundAccounts(null);
                }}
                className="w-full rounded-lg border border-cream-500 px-4 py-3 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
              />
            </div>
            <button
              type="button"
              onClick={findEmail}
              disabled={findLoading}
              className="w-full rounded-xl bg-nature-950 px-4 py-3 text-[14px] font-medium text-[var(--color-cta-text)] transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {findLoading ? '확인 중...' : '아이디 찾기'}
            </button>

            {findMessage ? (
              <div className="rounded-lg border border-cream-500 bg-cream-100 px-4 py-3 text-[12px] text-neutral-500">
                {findMessage}
              </div>
            ) : null}

            {foundAccounts?.length ? (
              <div className="space-y-2">
                {foundAccounts.map((account, index) => (
                  <div key={`${account.masked_email}-${index}`} className="rounded-lg border border-cream-500 bg-white px-4 py-3">
                    <div className="text-[14px] font-semibold text-nature-900">{account.masked_email}</div>
                    <div className="mt-1 text-[12px] text-neutral-400">
                      {account.account_type}
                      {account.email_verified ? ' · 이메일 인증됨' : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] text-neutral-400">가입 이메일</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => {
                    setResetEmail(event.target.value);
                    setResetError('');
                    setResetMessage('');
                    setResetToken('');
                    setResetDone(false);
                  }}
                  placeholder="email@example.com"
                  className="min-w-0 flex-1 rounded-lg border border-cream-500 px-4 py-3 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
                />
                <button
                  type="button"
                  onClick={requestPasswordReset}
                  disabled={sendingReset}
                  className="whitespace-nowrap rounded-lg bg-nature-500 px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-nature-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingReset ? '발송 중...' : '코드 받기'}
                </button>
              </div>
            </div>

            {resetToken ? (
              <>
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">인증 코드</label>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(event) => {
                      setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setResetError('');
                    }}
                    placeholder="6자리"
                    className="w-full rounded-lg border border-cream-500 px-4 py-3 text-center text-[14px] tracking-[0.3em] outline-none transition-colors focus:border-nature-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">새 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setResetError('');
                      }}
                      placeholder="영문/숫자/특수문자 포함 8자 이상"
                      className="w-full rounded-lg border border-cream-500 px-4 py-3 pr-11 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                      aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={confirmPasswordReset}
                  disabled={confirmingReset}
                  className="w-full rounded-xl bg-nature-950 px-4 py-3 text-[14px] font-medium text-[var(--color-cta-text)] transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingReset ? '변경 중...' : '비밀번호 변경'}
                </button>
              </>
            ) : null}

            {resetError ? (
              <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-2.5 text-[12px] text-danger">
                {resetError}
              </div>
            ) : null}
            {resetMessage ? (
              <div className="flex items-start gap-2 rounded-lg border border-cream-500 bg-cream-100 px-4 py-3 text-[12px] text-neutral-500">
                {resetDone ? <CheckCircle size={16} className="mt-0.5 shrink-0 text-nature-500" /> : null}
                <span>{resetMessage}</span>
              </div>
            ) : null}
          </div>
        )}

        <p className="mt-6 text-center text-[12px] text-[var(--color-text-hint)]">
          기억나셨나요?{' '}
          <Link href="/login" className="font-semibold text-neutral-500 hover:text-nature-900">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
