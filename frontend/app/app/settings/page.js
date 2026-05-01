'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Database, FileText, Lock, User as UserIcon } from 'lucide-react';
import { api, clearClientSession } from '../../../hooks/useApi';
import useTheme from '../../../hooks/useTheme';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPermission,
  getPushSubscriptionState,
} from '../../../lib/pushNotifications';
import { formatUserGroupDisplay } from '../../../lib/userGroupLabels';

const TERMS_TEXT = `다나아 서비스 이용약관

본 서비스는 건강 관리 지원을 위한 참고용 정보를 제공합니다.
의학적 진단이나 처방을 대체하지 않으며, 필요한 경우 전문가 상담이 필요합니다.`;

const PRIVACY_TEXT = `개인정보 처리방침

회원 정보, 온보딩 설문, 건강 기록은 서비스 제공과 개인화된 기능 제공을 위해 저장됩니다.
사용자는 설정 화면에서 일부 동의 상태를 변경할 수 있습니다.`;

function formatPhone(value) {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

function normalizeEmailDraft(value) {
  return (value || '').trim().toLowerCase();
}

function formatEmailVerificationError(detail) {
  if (!detail) return '이메일 인증 요청을 처리하지 못했어요.';
  if (detail === 'Email delivery is not configured.') {
    return '서버 SMTP 설정이 없어 인증 메일을 보낼 수 없어요.';
  }
  if (detail === 'SMTP authentication failed. Check the Gmail address and app password.') {
    return 'SMTP 인증이 실패했어요. 발송 계정과 앱 비밀번호 설정을 확인해 주세요.';
  }
  if (detail === 'Failed to send verification email. Check SMTP configuration and network access.') {
    return '인증 메일 발송에 실패했어요. SMTP 설정이나 서버 네트워크를 확인해 주세요.';
  }
  if (detail === 'Verification session not found.') {
    return '인증 요청이 만료되었어요. 인증 메일을 다시 보내주세요.';
  }
  if (detail === 'Verification code expired.') {
    return '인증코드가 만료되었어요. 새 인증코드를 요청해 주세요.';
  }
  if (detail === 'Verification code is invalid.') {
    return '인증코드가 올바르지 않아요. 다시 확인해 주세요.';
  }
  if (detail === 'Email is already in use.') {
    return '이미 다른 계정에서 사용 중인 이메일이에요.';
  }
  return detail;
}

function Toggle({ value, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        disabled ? 'cursor-not-allowed bg-cream-500 opacity-50' : value ? 'bg-nature-500' : 'bg-cream-500'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          value ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function ThemeSegment() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'dark', label: '다크' },
    { value: 'light', label: '화이트' },
  ];
  return (
    <div className="flex rounded-lg border border-cream-500 bg-cream-200 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
            theme === opt.value
              ? 'bg-cream-400 text-nature-900 shadow-xs'
              : 'text-neutral-400 hover:text-nature-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PasswordModal({ onClose, onSubmit, saving, message }) {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const submit = () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      onSubmit({ error: '비밀번호를 모두 입력해주세요.' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      onSubmit({ error: '새 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }
    onSubmit({
      current_password: form.currentPassword,
      new_password: form.newPassword,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl bg-cream-300 border border-cream-500 shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-cream-500 px-5 py-4">
          <h3 className="text-[16px] font-semibold text-nature-900">비밀번호 변경</h3>
          <button type="button" onClick={onClose} className="text-[18px] text-neutral-400 hover:text-nature-900">
            ×
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">현재 비밀번호</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">새 비밀번호</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-neutral-400">새 비밀번호 확인</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
            />
          </div>
          {message && (
            <div
              className={`rounded-lg px-3 py-2 text-[12px] ${
                message.type === 'success'
                  ? 'bg-nature-50 text-nature-700'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-cream-500 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-cream-500 py-2.5 text-[14px] text-neutral-500 hover:bg-cream-300"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 rounded-lg bg-nature-500 py-2.5 text-[14px] font-medium text-white hover:bg-nature-600 disabled:opacity-50"
          >
            {saving ? '변경 중...' : '변경하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextModal({ title, text, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="flex max-h-[70vh] w-full max-w-[520px] flex-col rounded-2xl bg-cream-300 border border-cream-500 shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-cream-500 px-5 py-4">
          <h3 className="text-[16px] font-semibold text-nature-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-[18px] text-neutral-400 hover:text-nature-900">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap font-inherit text-[13px] leading-7 text-neutral-600">{text}</pre>
        </div>
        <div className="border-t border-cream-500 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-nature-500 py-2.5 text-[14px] font-medium text-white hover:bg-nature-600"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);

  const [profileInfo, setProfileInfo] = useState({ group: '-', bmi: '-' });
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    birthday: '',
    gender: '',
    phone_number: '',
    height_cm: '',
    weight_kg: '',
    provider: '',
    email_verified: false,
  });
  const [notifications, setNotifications] = useState({
    chat_notification: true,
    challenge_reminder: true,
    weekly_report: true,
  });
  const [pushPermission, setPushPermission] = useState('unsupported');
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState(null);
  const [dataConsent, setDataConsent] = useState(true);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState(null);

  const [emailDraft, setEmailDraft] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailConfirming, setEmailConfirming] = useState(false);
  const [emailRequested, setEmailRequested] = useState(false);
  const [emailMessage, setEmailMessage] = useState(null);

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const canEditEmail = useMemo(
    () => !userForm.email || !userForm.email_verified,
    [userForm.email, userForm.email_verified],
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, onboardingRes, settingsRes, consentRes] = await Promise.all([
          api('/api/v1/users/me'),
          api('/api/v1/onboarding/status'),
          api('/api/v1/settings'),
          api('/api/v1/auth/consent'),
        ]);

        const user = userRes.ok ? await userRes.json() : {};
        const onboarding = onboardingRes.ok ? await onboardingRes.json() : {};
        const settings = settingsRes.ok ? await settingsRes.json() : {};
        const consent = consentRes.ok ? await consentRes.json() : {};

        setUserForm({
          name: user.name || '',
          email: user.email || '',
          birthday: user.birthday || '',
          gender: user.gender || onboarding.gender || '',
          phone_number: user.phone_number ? formatPhone(user.phone_number) : '',
          height_cm: onboarding.height_cm ? String(onboarding.height_cm) : '',
          weight_kg: onboarding.weight_kg ? String(onboarding.weight_kg) : '',
          provider: user.provider || '',
          email_verified: Boolean(user.email_verified),
        });
        setEmailDraft(user.email || '');
        setProfileInfo({
          group: formatUserGroupDisplay(onboarding.user_group, '-'),
          bmi: onboarding.bmi ? String(onboarding.bmi) : '-',
        });
        setNotifications({
          chat_notification: settings.chat_notification ?? true,
          challenge_reminder: settings.challenge_reminder ?? true,
          weekly_report: settings.weekly_report ?? true,
        });
        const pushState = await getPushSubscriptionState();
        setPushPermission(pushState.permission);
        setPushConfigured(Boolean(pushState.configured));
        setPushEnabled(pushState.subscribed);
        if (!pushState.configured) {
          setPushMessage({ type: 'error', text: '브라우저 알림 서버 설정이 아직 완료되지 않았어요.' });
        }
        setDataConsent(consent.health_data_consent ?? true);
      } catch {
        setProfileMessage({ type: 'error', text: '설정 정보를 불러오지 못했습니다.' });
      } finally {
        setLoaded(true);
      }
    }

    loadData();
  }, []);

  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const response = await api('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: userForm.name || undefined,
          birthday: userForm.birthday || undefined,
          gender: userForm.gender || undefined,
          phone_number: userForm.phone_number ? userForm.phone_number.replace(/\D/g, '') : undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileMessage({ type: 'error', text: data.detail || '개인정보 저장에 실패했습니다.' });
        return;
      }

      const hasMeasurements = Boolean(userForm.height_cm || userForm.weight_kg);
      if (hasMeasurements) {
        const measurementResponse = await api('/api/v1/users/me/measurements', {
          method: 'PATCH',
          body: JSON.stringify({
            height_cm: userForm.height_cm ? Number(userForm.height_cm) : undefined,
            weight_kg: userForm.weight_kg ? Number(userForm.weight_kg) : undefined,
          }),
        });
        const measurementData = await measurementResponse.json().catch(() => ({}));
        if (!measurementResponse.ok) {
          setProfileMessage({ type: 'error', text: measurementData.detail || '키·몸무게 저장에 실패했습니다.' });
          return;
        }
        setProfileInfo((prev) => ({
          ...prev,
          bmi: measurementData.bmi != null ? String(measurementData.bmi) : prev.bmi,
        }));
      }

      setUserForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        birthday: data.birthday || '',
        gender: data.gender || prev.gender,
        phone_number: data.phone_number ? formatPhone(data.phone_number) : '',
      }));
      setProfileMessage({ type: 'success', text: '개인정보를 저장했습니다.' });
    } catch {
      setProfileMessage({ type: 'error', text: '개인정보 저장 중 오류가 발생했습니다.' });
    } finally {
      setProfileSaving(false);
    }
  }, [userForm]);

  const toggleNotification = useCallback(async (key, value) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await api('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        setNotifications((prev) => ({ ...prev, [key]: !value }));
      }
    } catch {
      setNotifications((prev) => ({ ...prev, [key]: !value }));
    }
  }, []);

  const enableBrowserPush = useCallback(async () => {
    setPushSaving(true);
    setPushMessage(null);
    try {
      await enablePushNotifications();
      const pushState = await getPushSubscriptionState();
      setPushPermission(pushState.permission);
      setPushConfigured(Boolean(pushState.configured));
      setPushEnabled(pushState.subscribed);
      setPushMessage({ type: 'success', text: '브라우저 알림을 켰어요.' });
    } catch (error) {
      const pushState = await getPushSubscriptionState();
      setPushPermission(pushState.permission);
      setPushConfigured(Boolean(pushState.configured));
      setPushEnabled(false);
      setPushMessage({ type: 'error', text: error?.message || '브라우저 알림을 켜지 못했어요.' });
    } finally {
      setPushSaving(false);
    }
  }, []);

  const disableBrowserPush = useCallback(async () => {
    setPushSaving(true);
    setPushMessage(null);
    try {
      await disablePushNotifications();
      setPushPermission(getPushPermission());
      setPushEnabled(false);
      setPushMessage({ type: 'success', text: '브라우저 알림을 껐어요.' });
    } catch {
      setPushMessage({ type: 'error', text: '브라우저 알림을 끄지 못했어요.' });
    } finally {
      setPushSaving(false);
    }
  }, []);

  const toggleBrowserPush = useCallback((value) => {
    if (value) {
      enableBrowserPush();
    } else {
      disableBrowserPush();
    }
  }, [disableBrowserPush, enableBrowserPush]);

  const updateConsent = useCallback(async (value) => {
    setDataConsent(value);
    setConsentSaving(true);
    setConsentMessage(null);

    try {
      const response = await api('/api/v1/auth/consent', {
        method: 'PATCH',
        body: JSON.stringify({ health_data_consent: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDataConsent(!value);
        setConsentMessage({ type: 'error', text: data.detail || '동의 상태 변경에 실패했습니다.' });
        return;
      }
      setConsentMessage({
        type: 'success',
        text: value
          ? '건강데이터 수집 동의를 다시 켰습니다.'
          : '건강데이터 수집 동의를 껐습니다. 현재는 동의 정보만 DB에 반영되고, 기존 데이터 삭제는 하지 않습니다.',
      });
    } catch {
      setDataConsent(!value);
      setConsentMessage({ type: 'error', text: '동의 상태 변경 중 오류가 발생했습니다.' });
    } finally {
      setConsentSaving(false);
    }
  }, []);

  const requestEmailVerification = useCallback(async () => {
    const normalizedEmail = normalizeEmailDraft(emailDraft);
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailMessage({ type: 'error', text: '올바른 이메일 주소를 입력해주세요.' });
      return;
    }

    setEmailSending(true);
    setEmailMessage(null);

    try {
      const response = await api('/api/v1/auth/email/account/request', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEmailMessage({ type: 'error', text: formatEmailVerificationError(data.detail) });
        return;
      }
      setEmailRequested(true);
      setEmailMessage({
        type: 'success',
        text:
          data.delivery_mode === 'dev-code' && data.dev_verification_code
            ? `인증코드를 발급했습니다. 개발용 코드: ${data.dev_verification_code}`
            : (data.detail || '인증 메일을 보냈습니다. 받은 메일함을 확인해주세요.'),
      });
    } catch {
      setEmailMessage({ type: 'error', text: '인증 메일 발송 중 오류가 발생했습니다.' });
    } finally {
      setEmailSending(false);
    }
  }, [emailDraft]);

  const confirmEmailVerification = useCallback(async () => {
    if (emailCode.length !== 6) {
      setEmailMessage({ type: 'error', text: '6자리 인증코드를 입력해주세요.' });
      return;
    }

    setEmailConfirming(true);
    setEmailMessage(null);

    try {
      const response = await api('/api/v1/auth/email/account/confirm', {
        method: 'POST',
        body: JSON.stringify({ email: emailDraft, code: emailCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEmailMessage({ type: 'error', text: data.detail || '이메일 인증에 실패했습니다.' });
        return;
      }

      const nextUser = data.user || {};
      setUserForm((prev) => ({
        ...prev,
        email: nextUser.email || emailDraft,
        email_verified: Boolean(nextUser.email_verified ?? true),
      }));
      setEmailDraft(nextUser.email || emailDraft);
      setEmailRequested(false);
      setEmailCode('');
      setEmailMessage({ type: 'success', text: '이메일 인증이 완료되었습니다.' });
    } catch {
      setEmailMessage({ type: 'error', text: '이메일 인증 중 오류가 발생했습니다.' });
    } finally {
      setEmailConfirming(false);
    }
  }, [emailCode, emailDraft]);

  const submitPasswordChange = useCallback(async (payload) => {
    if (payload?.error) {
      setPasswordMessage({ type: 'error', text: payload.error });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);

    try {
      const response = await api('/api/v1/auth/password/change', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPasswordMessage({ type: 'error', text: data.detail || '비밀번호 변경에 실패했습니다.' });
        return;
      }
      setPasswordMessage({ type: 'success', text: '비밀번호를 변경했습니다.' });
      window.setTimeout(() => setModal(null), 900);
    } catch {
      setPasswordMessage({ type: 'error', text: '비밀번호 변경 중 오류가 발생했습니다.' });
    } finally {
      setPasswordSaving(false);
    }
  }, []);

  if (!loaded) {
    return (
      <>
        <header className="flex h-12 items-center border-b border-black/[.04] bg-cream-300/90 px-4 backdrop-blur-xl">
          <span className="text-[14px] font-medium text-nature-900">설정</span>
        </header>
        <div className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-[720px] animate-pulse space-y-4">
            <div className="rounded-xl bg-cream-300 p-6">
              <div className="h-4 w-1/4 rounded bg-cream-400" />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex h-12 items-center border-b border-black/[.04] bg-cream-300/90 px-4 backdrop-blur-xl">
        <span className="text-[14px] font-medium text-nature-900">설정</span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="mx-auto max-w-[720px]">
          <section className="mb-4 rounded-xl bg-cream-300 border border-cream-500 shadow-soft">
            <div className="border-b border-black/[.04] px-4 py-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-nature-900">
                <UserIcon size={16} />
                프로필
              </h3>
              <ThemeSegment />
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">그룹 분류</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-hint)]">온보딩 설문 기준</div>
                </div>
                <div className="text-[13px] text-neutral-500">{profileInfo.group}</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[13px] font-medium text-nature-900">BMI</div>
                <div className="text-[13px] text-neutral-500">{profileInfo.bmi}</div>
              </div>
            </div>
          </section>

          <section className="mb-4 rounded-xl bg-cream-300 border border-cream-500 shadow-soft">
            <div className="border-b border-black/[.04] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-nature-900">
                <UserIcon size={16} />
                개인정보
              </h3>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">이름</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">이메일</label>
                  <input
                    type="email"
                    value={canEditEmail ? emailDraft : userForm.email}
                    onChange={(e) => {
                      setEmailDraft(e.target.value);
                      setEmailRequested(false);
                      setEmailCode('');
                      setEmailMessage(null);
                    }}
                    disabled={!canEditEmail}
                    placeholder="email@example.com"
                    className={`w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none ${
                      canEditEmail
                        ? 'border-cream-500 focus:border-nature-500'
                        : 'border-cream-500 bg-cream-300 text-neutral-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">생년월일</label>
                  <input
                    type="date"
                    value={userForm.birthday}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, birthday: e.target.value }))}
                    className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">성별</label>
                  <select
                    value={userForm.gender}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, gender: e.target.value }))}
                    className="w-full rounded-lg border border-cream-500 bg-cream-400 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
                  >
                    <option value="">선택</option>
                    <option value="MALE">남성</option>
                    <option value="FEMALE">여성</option>
                  </select>
                </div>
              </div>

                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">전화번호</label>
                  <input
                    type="tel"
                  value={userForm.phone_number}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, phone_number: formatPhone(e.target.value) }))}
                  placeholder="010-1234-5678"
                  className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">키 (cm)</label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    value={userForm.height_cm}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, height_cm: e.target.value }))}
                    className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-neutral-400">몸무게 (kg)</label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    step="0.1"
                    value={userForm.weight_kg}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, weight_kg: e.target.value }))}
                    className="w-full rounded-lg border border-cream-500 px-3 py-2.5 text-[14px] outline-none focus:border-nature-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="rounded-lg bg-nature-500 px-5 py-2 text-[13px] font-medium text-white hover:bg-nature-600 disabled:opacity-50"
                >
                  {profileSaving ? '저장 중...' : '개인정보 저장'}
                </button>
                {profileMessage && (
                  <span className={`flex items-center gap-1 text-[12px] ${profileMessage.type === 'success' ? 'text-success' : 'text-danger'}`}>
                    {profileMessage.type === 'success' && <Check size={14} />}
                    {profileMessage.text}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-cream-500 bg-cream-200/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[13px] font-medium text-nature-900">이메일 인증</div>
                  <div className="text-[12px] text-neutral-400">
                    {userForm.email_verified ? '인증 완료' : '미인증'}
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-neutral-400">
                  일반 회원가입 이메일은 자동으로 표시됩니다. 소셜 로그인에서 이메일을 받지 못한 경우 여기서 인증할 수 있습니다.
                </div>
                {canEditEmail && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={requestEmailVerification}
                        disabled={emailSending}
                        className="rounded-lg border border-nature-500 px-4 py-2 text-[13px] font-medium text-nature-600 hover:bg-nature-50 disabled:opacity-50"
                      >
                        {emailSending ? '발송 중...' : '인증메일 보내기'}
                      </button>
                    </div>
                    {emailRequested && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="인증코드 6자리"
                          className="w-full rounded-lg border border-cream-500 px-3 py-2 text-[14px] tracking-[0.2em] outline-none focus:border-nature-500 sm:w-[180px]"
                        />
                        <button
                          type="button"
                          onClick={confirmEmailVerification}
                          disabled={emailConfirming}
                          className="rounded-lg bg-nature-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-nature-600 disabled:opacity-50"
                        >
                          {emailConfirming ? '확인 중...' : '인증 완료'}
                        </button>
                      </div>
                    )}
                    {emailMessage && (
                      <div className={`rounded-lg px-3 py-2 text-[12px] ${emailMessage.type === 'success' ? 'bg-nature-50 text-nature-700' : 'bg-red-50 text-red-600'}`}>
                        {emailMessage.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mb-4 rounded-xl bg-cream-300 border border-cream-500 shadow-soft">
            <div className="border-b border-black/[.04] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-nature-900">
                <Bell size={16} />
                알림
              </h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">채팅 알림</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-hint)]">AI 채팅 관련 알림 설정</div>
                </div>
                <Toggle value={notifications.chat_notification} onChange={(v) => toggleNotification('chat_notification', v)} />
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium text-nature-900">브라우저 백그라운드 알림</div>
                    <div className="mt-0.5 text-[12px] text-[var(--color-text-hint)]">
                      다른 창을 보고 있어도 건강 기록 질문을 알림으로 받아요.
                    </div>
                  </div>
                  <Toggle
                    value={pushEnabled}
                    onChange={toggleBrowserPush}
                    disabled={pushSaving || !pushConfigured || pushPermission === 'unsupported' || pushPermission === 'denied'}
                  />
                </div>
                {pushMessage && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                    {pushMessage.text}
                  </div>
                )}
                <div className="mt-2 rounded-lg bg-cream-100 px-3 py-2 text-[12px] leading-5 text-neutral-600">
                  브라우저나 Windows 알림 설정이 꺼져 있거나 방해 금지 모드가 켜져 있으면 알림이 표시되지 않을 수 있어요.
                </div>
                {pushPermission === 'unsupported' && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
                    이 브라우저는 백그라운드 알림을 지원하지 않아요.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">챌린지 리마인더</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-hint)]">챌린지 참여 알림 설정</div>
                </div>
                <Toggle value={notifications.challenge_reminder} onChange={(v) => toggleNotification('challenge_reminder', v)} />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">주간 리포트</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-hint)]">수집한 정보를 바탕으로 주간 리포트를 받도록 설정</div>
                </div>
                <Toggle value={notifications.weekly_report} onChange={(v) => toggleNotification('weekly_report', v)} />
              </div>
            </div>
          </section>

          <section className="mb-4 rounded-xl bg-cream-300 border border-cream-500 shadow-soft">
            <div className="border-b border-black/[.04] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-nature-900">
                <Database size={16} />
                데이터
              </h3>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">건강데이터 수집 동의</div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-hint)]">건강 관리 기능 제공을 위한 데이터 활용 동의입니다.</div>
                </div>
                <Toggle value={dataConsent} onChange={updateConsent} disabled={consentSaving} />
              </div>
              {consentMessage && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${consentMessage.type === 'success' ? 'bg-nature-50 text-nature-700' : 'bg-red-50 text-red-600'}`}>
                  {consentMessage.text}
                </div>
              )}
            </div>
          </section>

          <section className="mb-4 rounded-xl bg-cream-300 border border-cream-500 shadow-soft">
            <div className="border-b border-black/[.04] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-nature-900">
                <Lock size={16} />
                계정
              </h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <button
                type="button"
                onClick={() => {
                  setPasswordMessage(null);
                  setModal('password');
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-cream-300"
              >
                <div className="text-[13px] font-medium text-nature-900">비밀번호 변경</div>
                <span className="text-[13px] text-neutral-400">열기</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('로그아웃 하시겠어요?')) return;
                  clearClientSession();
                  window.location.href = '/login';
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-cream-300"
              >
                <div className="text-[13px] font-medium text-nature-900">로그아웃</div>
              </button>
            </div>
          </section>

          <section className="rounded-xl bg-cream-300 border border-cream-500 shadow-soft">
            <div className="border-b border-black/[.04] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-nature-900">
                <FileText size={16} />
                약관 및 정책
              </h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <button
                type="button"
                onClick={() => setModal('privacy')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-cream-300"
              >
                <div className="text-[13px] font-medium text-nature-900">개인정보 처리방침</div>
                <span className="text-[13px] text-neutral-400">보기</span>
              </button>
              <button
                type="button"
                onClick={() => setModal('terms')}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-cream-300"
              >
                <div className="text-[13px] font-medium text-nature-900">이용약관</div>
                <span className="text-[13px] text-neutral-400">보기</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {modal === 'password' && (
        <PasswordModal
          onClose={() => setModal(null)}
          onSubmit={submitPasswordChange}
          saving={passwordSaving}
          message={passwordMessage}
        />
      )}

      {modal === 'terms' && <TextModal title="이용약관" text={TERMS_TEXT} onClose={() => setModal(null)} />}
      {modal === 'privacy' && <TextModal title="개인정보 처리방침" text={PRIVACY_TEXT} onClose={() => setModal(null)} />}
    </>
  );
}
