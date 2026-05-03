'use client';

import { useState } from 'react';
import { needsMigration, runMigration } from '../../lib/doit_store';

/**
 * 로컬에 저장된 데이터가 DB에 없을 때 1회 표시되는 마이그레이션 배너.
 * initDoitStore() 완료 후 needsMigration()이 true일 때 렌더링한다.
 */
export default function MigrationBanner({ onComplete }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error' | 'done'
  const [errorMsg, setErrorMsg] = useState(null);

  if (!needsMigration()) return null;
  if (status === 'done') return null;

  const handleMigrate = async () => {
    setStatus('loading');
    setErrorMsg(null);
    const result = await runMigration();
    if (!result.success) {
      setStatus('error');
      setErrorMsg(result.error ?? '알 수 없는 오류가 발생했어요.');
      return;
    }
    setStatus('done');
    if (typeof onComplete === 'function') onComplete();
  };

  const handleSkip = () => {
    setStatus('done');
    if (typeof onComplete === 'function') onComplete();
  };

  return (
    <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-surface)] p-4 shadow-sm">
      <p className="text-[13.5px] font-medium text-[var(--color-text)]">
        이전에 저장한 데이터가 있어요
      </p>
      <p className="mt-1 text-[12.5px] text-[var(--color-text-secondary)]">
        기기 로컬에 남아 있는 생각들을 계정에 옮겨드릴게요.
      </p>
      {status === 'error' && (
        <p className="mt-2 text-[12px] text-red-500">
          옮기기 실패: {errorMsg} 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleMigrate}
          disabled={status === 'loading'}
          className="rounded-full bg-[var(--color-text)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === 'loading' ? '옮기는 중…' : status === 'error' ? '다시 시도' : '계정으로 옮기기'}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={status === 'loading'}
          className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
