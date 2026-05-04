'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ShieldCheck, Terminal } from 'lucide-react';

import { api, ensureAuthSession } from '../../../../hooks/useApi';

function normalizeUserCode(value) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function getApprovalErrorMessage(status, detail) {
  const errorCode = detail?.error_code || detail?.detail?.error_code;
  if (status === 401) return '로그인이 필요합니다. 다시 로그인한 뒤 승인해 주세요.';
  if (status === 404 || errorCode === 'DEVICE_CODE_NOT_FOUND') {
    return '기기 코드가 없거나 만료됐습니다. CLI에서 setup 명령을 다시 실행해 주세요.';
  }
  if (status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '승인을 처리하지 못했습니다. 코드를 확인한 뒤 다시 시도해 주세요.';
}

export default function DanaaHealthCardsIntegrationPage() {
  const [ready, setReady] = useState(false);
  const [userCode, setUserCode] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function guard() {
      const restored = await ensureAuthSession();
      if (!restored) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const initialCode = params.get('code') || params.get('user_code') || '';
      if (initialCode) setUserCode(normalizeUserCode(initialCode));
      setReady(true);
    }

    guard();
  }, []);

  async function approveDevice(event) {
    event.preventDefault();
    const normalized = normalizeUserCode(userCode);
    if (normalized.replace('-', '').length !== 8) {
      setMessage({ type: 'error', text: 'CLI에 표시된 8자리 코드를 입력해 주세요.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await api('/api/v1/external-auth/device/approve', {
        method: 'POST',
        body: JSON.stringify({ user_code: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: 'error', text: getApprovalErrorMessage(response.status, data?.detail || data) });
        return;
      }
      setMessage({
        type: 'success',
        text: '연결이 승인되었습니다. CLI 창으로 돌아가면 자동으로 로그인이 완료됩니다.',
      });
    } catch {
      setMessage({ type: 'error', text: '서버 연결에 실패했습니다. 네트워크 상태를 확인해 주세요.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="min-h-[100dvh] bg-cream-200" />;
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-cream-200 p-4 sm:p-6">
      <section className="w-full max-w-[520px] rounded-2xl border border-cream-500 bg-cream-300 p-6 shadow-modal sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nature-950 text-[var(--color-cta-text)]">
            <Terminal size={20} />
          </div>
          <div>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-nature-500">
              DANAA Health Cards
            </p>
            <h1 className="text-[22px] font-bold text-nature-900">Claude/Codex 연결 승인</h1>
            <p className="mt-2 text-[13px] leading-6 text-neutral-500">
              CLI에 표시된 코드를 입력하면 이 DANAA 계정으로 건강 체크인 카드를 저장할 수 있습니다.
            </p>
          </div>
        </div>

        <form onSubmit={approveDevice} className="space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-nature-900">기기 코드</label>
            <input
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              value={userCode}
              onChange={(event) => setUserCode(normalizeUserCode(event.target.value))}
              placeholder="ABCD-1234"
              className="w-full rounded-xl border border-cream-500 bg-cream-100 px-4 py-3 text-center text-[22px] font-semibold tracking-[0.18em] text-nature-900 outline-none focus:border-nature-500"
            />
          </div>

          {message && (
            <div
              className={`flex gap-2 rounded-xl px-4 py-3 text-[13px] leading-5 ${
                message.type === 'success'
                  ? 'border border-nature-200 bg-nature-50 text-nature-700'
                  : 'border border-danger/20 bg-danger-light text-danger'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-nature-950 px-4 py-3 text-[14px] font-semibold text-[var(--color-cta-text)] transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '승인 중...' : '이 계정으로 연결 승인'}
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-cream-500 bg-cream-200/60 px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-nature-900">
            <ShieldCheck size={15} />
            안전 안내
          </div>
          <p className="text-[12px] leading-5 text-neutral-500">
            토큰은 CLI의 안전 저장소에 보관되며, 이 화면에는 토큰이나 건강 답변 원문이 표시되지 않습니다.
            의료 진단이 아니라 생활습관 체크인을 위한 연결입니다.
          </p>
        </div>

        <Link href="/app/settings" className="mt-5 block text-center text-[12px] font-medium text-neutral-500 hover:text-nature-900">
          설정으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
