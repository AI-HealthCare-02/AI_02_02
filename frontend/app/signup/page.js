'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const MAX_NAME_LENGTH = 20;
const NAME_PATTERN = /^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣\s]+$/;

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeBackendValidationMessage(detail) {
  if (!Array.isArray(detail)) return null;

  for (const item of detail) {
    const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : '';
    const message = String(item?.msg || '');

    if (field === 'email') {
      return { field: 'email', message: '이메일 형식이 올바르지 않습니다.' };
    }
    if (field === 'password') {
      if (message.includes('8')) {
        return { field: 'password', message: '비밀번호는 8자 이상이어야 합니다.' };
      }
      return {
        field: 'password',
        message: '비밀번호는 영문 대문자, 영문 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
      };
    }
    if (field === 'name') {
      if (message.includes('20')) {
        return { field: 'name', message: '이름은 20자 이하로 입력해 주세요.' };
      }
      return { field: 'name', message: '이름 형식이 올바르지 않습니다.' };
    }
    if (field === 'birth_date') {
      if (message.includes('YYYY-MM-DD')) {
        return { field: 'birthDate', message: '생년월일 형식이 올바르지 않습니다.' };
      }
      return { field: 'birthDate', message: '생년월일이 유효하지 않습니다.' };
    }
  }

  return null;
}

function mapSendVerificationError(status, detail) {
  const normalized = normalizeBackendValidationMessage(detail);
  if (normalized) return normalized;

  if (status === 409 || detail === 'Email is already in use.') {
    return { field: 'email', message: '이미 가입된 이메일입니다. 다른 이메일을 사용해 주세요.' };
  }
  if (status === 429) {
    return { field: 'general', message: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
  }
  if (detail === 'SMTP authentication failed. Check the Gmail address and app password.') {
    return { field: 'email', message: '인증 메일 발송에 실패했습니다. 현재 메일 서버 인증 설정에 문제가 있습니다.' };
  }
  if (detail === 'Failed to send verification email. Check SMTP configuration and network access.') {
    return { field: 'email', message: '인증 메일 발송에 실패했습니다. 메일 서버 또는 네트워크 상태를 확인해 주세요.' };
  }
  if (detail === 'Email delivery is not configured.') {
    return { field: 'email', message: '현재 이메일 인증 기능이 설정되어 있지 않습니다.' };
  }

  return { field: 'general', message: typeof detail === 'string' && detail ? detail : '인증 코드 발송에 실패했습니다.' };
}

function mapConfirmVerificationError(status, detail) {
  const normalized = normalizeBackendValidationMessage(detail);
  if (normalized) return normalized;

  if (detail === 'Verification session not found.') {
    return { field: 'email', message: '이 이메일에 대한 인증 요청 기록을 찾을 수 없습니다. 인증 코드를 다시 요청해 주세요.' };
  }
  if (detail === 'Verification code expired.') {
    return { field: 'emailCode', message: '인증 코드가 만료되었습니다. 인증 코드를 다시 받아 주세요.' };
  }
  if (detail === 'Verification code is invalid.') {
    return { field: 'emailCode', message: '인증 코드가 올바르지 않습니다. 6자리 코드를 다시 확인해 주세요.' };
  }
  if (status === 429) {
    return { field: 'general', message: '인증 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
  }

  return { field: 'general', message: typeof detail === 'string' && detail ? detail : '이메일 인증 확인에 실패했습니다.' };
}

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
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
    name: '',
    birthDate: '',
    emailCode: '',
    general: '',
  });

  const maxBirthDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 14);
    return date.toISOString().slice(0, 10);
  }, []);

  const setSingleError = (field, value) => {
    setFieldErrors({
      email: '',
      password: '',
      name: '',
      birthDate: '',
      emailCode: '',
      general: '',
      [field]: value,
    });
  };

  const clearErrors = () => {
    setFieldErrors({
      email: '',
      password: '',
      name: '',
      birthDate: '',
      emailCode: '',
      general: '',
    });
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearErrors();
    setMessage('');
  };

  const handleNameChange = (value) => {
    if (value.length > MAX_NAME_LENGTH) return;
    if (value && !NAME_PATTERN.test(value)) {
      setFieldErrors((prev) => ({
        ...prev,
        name: '이름에는 한글, 영문, 공백만 사용할 수 있습니다.',
      }));
      return;
    }

    setForm((prev) => ({ ...prev, name: value }));
    setFieldErrors((prev) => ({ ...prev, name: '', general: '' }));
    setMessage('');
  };

  const validateRequiredFields = useCallback(() => {
    const nextErrors = {
      email: '',
      password: '',
      name: '',
      birthDate: '',
      emailCode: '',
      general: '',
    };

    const email = form.email.trim();
    const name = form.name.trim();
    const password = form.password;
    const birthDate = form.birthDate;

    if (!email) {
      nextErrors.email = '이메일을 입력해 주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = '이메일 형식이 올바르지 않습니다.';
    }

    if (!password) {
      nextErrors.password = '비밀번호를 입력해 주세요.';
    } else if (password.length < 8) {
      nextErrors.password = '비밀번호는 8자 이상이어야 합니다.';
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      nextErrors.password = '비밀번호는 영문 대문자, 영문 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.';
    }

    if (!name) {
      nextErrors.name = '이름을 입력해 주세요.';
    } else if (name.length > MAX_NAME_LENGTH) {
      nextErrors.name = '이름은 20자 이하로 입력해 주세요.';
    } else if (!NAME_PATTERN.test(name)) {
      nextErrors.name = '이름에는 한글, 영문, 공백만 사용할 수 있습니다.';
    }

    if (!birthDate) {
      nextErrors.birthDate = '생년월일을 입력해 주세요.';
    } else if (birthDate > maxBirthDate) {
      nextErrors.birthDate = '만 14세 이상만 가입할 수 있습니다.';
    } else if (birthDate > getTodayDateString()) {
      nextErrors.birthDate = '미래 날짜는 입력할 수 없습니다.';
    }

    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }, [form.birthDate, form.email, form.name, form.password, maxBirthDate]);

  const sendEmailCode = useCallback(async () => {
    if (!validateRequiredFields()) return;

    setSending(true);
    clearErrors();
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/email-verify/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          birth_date: form.birthDate,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mapped = mapSendVerificationError(response.status, data?.detail);
        setSingleError(mapped.field, mapped.message);
        return;
      }

      setEmailSent(true);
      setFieldErrors({
        email: '',
        password: '',
        name: '',
        birthDate: '',
        emailCode: '',
        general: '',
      });

      if (data.delivery_mode === 'dev-code' && data.dev_verification_code) {
        setMessage(`인증 코드가 발급되었습니다. 개발용 인증 코드: ${data.dev_verification_code}`);
      } else {
        setMessage('인증 이메일을 발송했습니다. 받은 편지함과 스팸함을 확인해 주세요.');
      }
    } catch {
      setSingleError('general', '인증 코드 발송 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  }, [form.birthDate, form.email, form.name, form.password, validateRequiredFields]);

  const confirmEmailCode = useCallback(async () => {
    if (!emailCode) {
      setSingleError('emailCode', '인증 코드를 입력해 주세요.');
      return;
    }
    if (emailCode.length !== 6) {
      setSingleError('emailCode', '인증 코드는 6자리여야 합니다.');
      return;
    }

    setConfirming(true);
    clearErrors();
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/email-verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          code: emailCode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mapped = mapConfirmVerificationError(response.status, data?.detail);
        setSingleError(mapped.field, mapped.message);
        return;
      }

      setEmailVerified(true);
      setMessage('이메일 인증이 완료되었습니다. 잠시 후 로그인 페이지로 이동합니다.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch {
      setSingleError('general', '이메일 인증 확인 중 네트워크 오류가 발생했습니다.');
    } finally {
      setConfirming(false);
    }
  }, [emailCode, form.email]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-200 p-6">
      <div className="w-full max-w-[460px] rounded-xl border border-cream-500 bg-cream-300 p-8 shadow-modal">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-nature-900 font-bold text-white"
          >
            D
          </Link>
          <h1 className="text-[20px] font-bold text-nature-900">회원가입</h1>
          <p className="mt-1 text-[12px] text-neutral-400">이메일 인증 후 가입이 완료됩니다.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">이메일</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={form.email}
                onChange={(event) => {
                  updateField('email', event.target.value);
                  setEmailSent(false);
                  setEmailVerified(false);
                  setEmailCode('');
                }}
                disabled={emailVerified}
                placeholder="email@example.com"
                className="flex-1 rounded-lg border border-cream-500 px-4 py-3 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10 disabled:bg-cream-300 disabled:text-neutral-400"
              />
              {emailVerified ? (
                <div className="flex items-center gap-1 px-3 text-[12px] font-medium text-nature-500">
                  <CheckCircle size={16} />
                  인증완료
                </div>
              ) : (
                <button
                  type="button"
                  onClick={sendEmailCode}
                  disabled={sending}
                  className="whitespace-nowrap rounded-lg bg-nature-500 px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-nature-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? '발송 중...' : '인증코드 받기'}
                </button>
              )}
            </div>
            {fieldErrors.email ? <p className="mt-1 text-[12px] text-danger">{fieldErrors.email}</p> : null}
          </div>

          {emailSent && !emailVerified ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailCode}
                  onChange={(event) => {
                    setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setFieldErrors((prev) => ({ ...prev, emailCode: '', general: '' }));
                    setMessage('');
                  }}
                  placeholder="인증코드 6자리"
                  className="flex-1 rounded-lg border border-cream-500 px-4 py-3 text-center text-[14px] tracking-[0.3em] outline-none transition-colors focus:border-nature-500"
                />
                <button
                  type="button"
                  onClick={confirmEmailCode}
                  disabled={confirming}
                  className="rounded-lg border border-nature-500 px-4 py-3 text-[13px] font-medium text-nature-500 transition-colors hover:bg-nature-50 disabled:opacity-50"
                >
                  {confirming ? '확인 중...' : '확인'}
                </button>
              </div>
              {fieldErrors.emailCode ? <p className="mt-1 text-[12px] text-danger">{fieldErrors.emailCode}</p> : null}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="8자 이상, 대/소문자, 숫자, 특수문자 포함"
                className="w-full rounded-lg border border-cream-500 px-4 py-3 pr-12 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-hint)] hover:text-neutral-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password ? <p className="mt-1 text-[12px] text-danger">{fieldErrors.password}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">이름</label>
            <input
              type="text"
              value={form.name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="이름을 입력해 주세요"
              className="w-full rounded-lg border border-cream-500 px-4 py-3 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
            />
            <div className="mt-1 flex items-center justify-between">
              {fieldErrors.name ? <p className="text-[12px] text-danger">{fieldErrors.name}</p> : <span />}
              <span className="text-[11px] text-[var(--color-text-hint)]">{form.name.length}/{MAX_NAME_LENGTH}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">생년월일</label>
            <input
              type="date"
              value={form.birthDate}
              max={maxBirthDate}
              onChange={(event) => updateField('birthDate', event.target.value)}
              className="w-full rounded-lg border border-cream-500 px-4 py-3 text-[14px] outline-none transition-colors focus:border-nature-500 focus:ring-2 focus:ring-nature-500/10"
            />
            {fieldErrors.birthDate ? <p className="mt-1 text-[12px] text-danger">{fieldErrors.birthDate}</p> : null}
          </div>

          {fieldErrors.general ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">
              {fieldErrors.general}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-nature-200 bg-nature-50 px-4 py-3 text-[12px] text-nature-700">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={confirmEmailCode}
            disabled={!emailSent || emailVerified || confirming}
            className="w-full rounded-xl bg-nature-500 px-4 py-3 text-[14px] font-medium text-white transition-all hover:bg-nature-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emailVerified ? '이메일 인증 완료' : '가입 완료'}
          </button>
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--color-text-hint)]">
          이미 계정이 있다면{' '}
          <Link href="/login" className="font-semibold text-nature-500">
            로그인
          </Link>
        </p>

        <p className="mt-2 text-center text-[11px] text-[var(--color-text-hint)]">
          이메일 인증 완료 후 계정이 생성됩니다.
        </p>
      </div>
    </div>
  );
}
