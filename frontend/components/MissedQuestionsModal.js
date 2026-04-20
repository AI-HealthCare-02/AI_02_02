'use client';

/**
 * MissedQuestionsModal · 최근 3일 미응답 질문 팝업
 *
 * 구조:
 *   - Portal (document.body) · next/dynamic(ssr: false)로 로드되므로 SSR 걱정 없음
 *   - Focus trap (수동 Tab 가두기 + ESC + 이전 포커스 복귀)
 *   - Derived hybrid: 오늘 열은 todayLog(props)에서 계산 · 과거 2일은 fetch + 60s TTL
 *   - 셀 인라인 편집 → saveImmediate 경로 (디바운스 분리)
 *   - field_results startsWith('skipped') 처리
 *   - sessionStorage draft 1건 (401 대응)
 *   - 오늘 날짜 편집 UI 가드
 *
 * 접근성:
 *   - role="dialog" aria-modal="true"
 *   - 첫 포커스: 닫기 버튼
 *   - ESC 닫기 · 편집 중이면 확인 다이얼로그
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/hooks/useApi';
import { getVisibleMissedCategories } from '@/lib/chat/cardRegistry';
import { t } from '@/lib/i18n/rightPanel.ko';

const API_MISSING_PATH = '/api/v1/health/daily/missing?lookback_days=3';
const API_DAILY_PATH = (date) => `/api/v1/health/daily/${date}`;
const CACHE_TTL_MS = 60 * 1000;
const DRAFT_KEY = 'danaa_missed_draft_v1';

/**
 * DB 필드 → 카테고리 매핑 (cardRegistry와 동일 키)
 */
const CATEGORY_FIELDS = {
  sleep: ['sleep_quality', 'sleep_duration_bucket'],
  meal: ['breakfast_status', 'lunch_status', 'dinner_status'],
  medication: ['took_medication'],
  exercise: ['exercise_done', 'exercise_type'],
  water: ['water_cups'],
  mood: ['mood_level'],
  alcohol: ['alcohol_today'],
};

/**
 * 카테고리별 display value 계산
 */
function formatCategoryValue(key, dailyLog) {
  if (!dailyLog) return null;
  const fields = CATEGORY_FIELDS[key] || [];
  const hasAny = fields.some((f) => dailyLog[f] != null && dailyLog[f] !== '');
  if (!hasAny) return null;
  switch (key) {
    case 'sleep': {
      const q = { excellent: '잘 잤음', good: '그럭저럭', normal: '뒤척임', bad: '푹 못 잠' }[dailyLog.sleep_quality];
      return q || '기록됨';
    }
    case 'meal': {
      const done = ['breakfast_status', 'lunch_status', 'dinner_status'].filter((f) => dailyLog[f]).length;
      return `${done}/3`;
    }
    case 'medication':
      if (dailyLog.took_medication === true) return '드셨음';
      if (dailyLog.took_medication === false) return '건너뜀';
      return null;
    case 'exercise':
      if (dailyLog.exercise_done === true) return '했음';
      if (dailyLog.exercise_done === false) return '쉼';
      return null;
    case 'water':
      return dailyLog.water_cups > 0 ? `${dailyLog.water_cups}잔` : null;
    case 'mood':
      return { great: '아주 좋음', good: '좋음', normal: '보통', hard: '힘듦' }[dailyLog.mood_level] || null;
    case 'alcohol':
      if (dailyLog.alcohol_today === false) return '안 마심';
      if (dailyLog.alcohol_today === true) return '마심';
      return null;
    default:
      return null;
  }
}

/**
 * 간이 60s TTL 캐시 · useRef 기반
 */
const missedCache = { data: null, timestamp: 0 };

async function fetchPastDays(dates) {
  const now = Date.now();
  if (missedCache.data && now - missedCache.timestamp < CACHE_TTL_MS) {
    return missedCache.data;
  }
  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const res = await api(API_DAILY_PATH(date));
        if (!res.ok) return { date, log: null };
        const data = await res.json();
        return { date, log: data };
      } catch {
        return { date, log: null };
      }
    })
  );
  missedCache.data = results;
  missedCache.timestamp = now;
  return results;
}

export function invalidateMissedCache() {
  missedCache.data = null;
  missedCache.timestamp = 0;
}

/* ───── 입력 위젯 (간소화 · 셀 인라인 편집용) ───── */

/**
 * 통일된 드롭다운 위젯. boolean/number 값은 문자열로 직렬화해 <option>에 바인딩하고,
 * onChange에서 parse 콜백으로 원래 타입 복원.
 */
function SelectField({ value, options, placeholder = '선택', onChange, parse = (v) => v }) {
  const toStr = (v) => (v === null || v === undefined ? '' : String(v));
  return (
    <select
      className="mqm-select"
      value={toStr(value)}
      onChange={(e) => onChange(parse(e.target.value))}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={toStr(opt.value)} value={toStr(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const parseBool = (v) => (v === 'true' ? true : v === 'false' ? false : null);
const parseInt10 = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * 카테고리별 간이 편집기 (cell inline edit)
 * 완전 기능은 SleepPanel 등 기존 컴포넌트가 담당 · 여기선 필수 필드 1개만
 */
function CellEditor({ categoryKey, onSave, onCancel, initialDraft }) {
  const [draft, setDraft] = useState(initialDraft || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (Object.keys(draft).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(t('rightPanel.error.networkFail'));
    } finally {
      setSaving(false);
    }
  };

  const fields = (() => {
    switch (categoryKey) {
      case 'sleep':
        return (
          <SelectField
            value={draft.sleep_quality}
            options={[
              { value: 'excellent', label: '잘 잤음' },
              { value: 'good', label: '그럭저럭' },
              { value: 'normal', label: '뒤척임' },
              { value: 'bad', label: '푹 못 잠' },
            ]}
            onChange={(v) => setDraft({ ...draft, sleep_quality: v })}
          />
        );
      case 'meal':
        return (
          <SelectField
            value={draft.breakfast_status}
            options={[
              { value: 'hearty', label: '든든히' },
              { value: 'light', label: '간단히' },
              { value: 'skipped', label: '못먹음' },
            ]}
            onChange={(v) => setDraft({ ...draft, breakfast_status: v })}
          />
        );
      case 'medication':
        return (
          <SelectField
            value={draft.took_medication}
            options={[
              { value: true, label: '드셨어요' },
              { value: false, label: '건너뜀' },
            ]}
            parse={parseBool}
            onChange={(v) => setDraft({ ...draft, took_medication: v })}
          />
        );
      case 'exercise':
        return (
          <SelectField
            value={draft.exercise_done}
            options={[
              { value: true, label: '했음' },
              { value: false, label: '쉼' },
            ]}
            parse={parseBool}
            onChange={(v) => setDraft({ ...draft, exercise_done: v })}
          />
        );
      case 'water':
        return (
          <SelectField
            value={draft.water_cups}
            options={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
              value: n,
              label: n === 10 ? '10잔 이상' : `${n}잔`,
            }))}
            parse={parseInt10}
            onChange={(v) => setDraft({ ...draft, water_cups: v })}
          />
        );
      case 'mood':
        return (
          <SelectField
            value={draft.mood_level}
            options={[
              { value: 'great', label: '아주 좋음' },
              { value: 'good', label: '좋음' },
              { value: 'normal', label: '보통' },
              { value: 'hard', label: '힘듦' },
            ]}
            onChange={(v) => setDraft({ ...draft, mood_level: v })}
          />
        );
      case 'alcohol':
        return (
          <SelectField
            value={draft.alcohol_today}
            options={[
              { value: false, label: '안 마심' },
              { value: true, label: '마심' },
            ]}
            parse={parseBool}
            onChange={(v) => setDraft({ ...draft, alcohol_today: v })}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="mqm-cell-edit">
      {fields}
      {error && <div className="mqm-cell-edit__error">{error}</div>}
      <div className="mqm-cell-edit__actions">
        <button type="button" className="mqm-btn-ghost" onClick={onCancel}>취소</button>
        <button type="button" className="mqm-btn-primary" onClick={handleSave} disabled={saving || Object.keys(draft).length === 0}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

/* ───── 메인 모달 ───── */

export default function MissedQuestionsModal({ open, onClose, todayISO, todayLog, userCtx, saveImmediate, onGoChat }) {
  const modalRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [pastDays, setPastDays] = useState(null); // [{date, log}, {date, log}]
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { key, date } | null
  const [toast, setToast] = useState(null);

  // 과거 2일 날짜 계산 (KST)
  const pastDates = useMemo(() => {
    if (!todayISO) return [];
    const base = new Date(`${todayISO}T00:00:00+09:00`);
    return [1, 2].map((offset) => {
      const d = new Date(base);
      d.setDate(d.getDate() - offset);
      return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    });
  }, [todayISO]);

  // 카테고리 (그룹 필터 적용)
  const categories = useMemo(() => getVisibleMissedCategories(userCtx), [userCtx]);

  // Fetch 과거 2일
  useEffect(() => {
    if (!open || pastDates.length === 0) return;
    setLoading(true);
    fetchPastDays(pastDates)
      .then((res) => setPastDays(res))
      .catch(() => setPastDays([]))
      .finally(() => setLoading(false));
  }, [open, pastDates]);

  // 포커스 관리
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      modalRef.current?.querySelector('.mqm-close')?.focus();
    }, 30);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // ESC + Focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusables = Array.from(
        modalRef.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // handleClose는 클로저로 draft 접근 · 매 렌더 새로 감
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingCell]);

  const handleClose = useCallback(() => {
    if (editingCell) {
      if (!window.confirm(t('rightPanel.missedModal.unsavedConfirm'))) return;
    }
    setEditingCell(null);
    onClose();
  }, [editingCell, onClose]);

  const handleCellClick = (key, date) => {
    setEditingCell({ key, date });
  };

  const handleCellSave = async (categoryKey, date, payload) => {
    // sessionStorage 1건 draft (401 리다이렉트 대비)
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ date, key: categoryKey, payload, ts: Date.now() }));
    } catch { /* 용량 초과 등 무시 */ }

    const res = await api(API_DAILY_PATH(date), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'direct', ...payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 리포트 캐시 무효화 — 건강 기록이 바뀌었으니 다음 리포트 진입 시 서버 값으로 재조회
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('danaa:report-cache-refresh'));
    }

    // field_results 분석
    const skipped = [];
    const accepted = [];
    for (const [field, status] of Object.entries(data.field_results || {})) {
      if (status === 'accepted') accepted.push(field);
      else if (typeof status === 'string' && status.startsWith('skipped(already_answered)')) skipped.push({ field, reason: 'already' });
      else skipped.push({ field, reason: 'other' });
    }

    if (accepted.length > 0) setToast(`${accepted.length}개 항목 저장됨`);
    else if (skipped.some((s) => s.reason === 'already')) setToast(t('rightPanel.error.skippedAlreadyAnswered'));
    else setToast(t('rightPanel.error.skippedGeneric'));
    setTimeout(() => setToast(null), 3000);

    // 성공 draft 제거
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }

    // 캐시 무효화 + 과거 2일 재조회
    invalidateMissedCache();
    const refreshed = await fetchPastDays(pastDates);
    setPastDays(refreshed);
    setEditingCell(null);
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  // Day columns 구성 — 오늘은 우측 Today 카드에서 입력하므로 모달에서는 제외
  const dayCols = [
    { date: pastDates[0], label: t('rightPanel.missedModal.columns.yesterday'), log: pastDays?.[0]?.log },
    { date: pastDates[1], label: t('rightPanel.missedModal.columns.dayBefore'), log: pastDays?.[1]?.log },
  ];

  return createPortal(
    <div className="mqm-wrap" aria-hidden={!open}>
      <div className="mqm-backdrop" onClick={handleClose} />
      <div
        className="mqm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mqm-title"
        ref={modalRef}
      >
        <button type="button" className="mqm-close" onClick={handleClose} aria-label={t('rightPanel.missedModal.close')}>✕</button>
        <div className="mqm-head">
          <h2 id="mqm-title" className="mqm-title">{t('rightPanel.missedModal.title')}</h2>
          <p className="mqm-hint">{t('rightPanel.missedModal.hint')}</p>
        </div>
        <div className="mqm-body">
          {loading && <div className="mqm-loading">불러오는 중…</div>}
          <table className="mqm-table">
            <thead>
              <tr>
                <th scope="col">{t('rightPanel.missedModal.columns.category')}</th>
                {dayCols.map((col) => (
                  <th key={col.date} scope="col">
                    {col.label}
                    <br />
                    <span className="mqm-day-sub">{col.date?.slice(5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.key}>
                  <th scope="row">
                    <span className="mqm-category">
                      <span className="mqm-category__emoji" aria-hidden="true">{cat.emoji}</span>
                      {cat.name}
                    </span>
                  </th>
                  {dayCols.map((col) => {
                    const val = formatCategoryValue(cat.key, col.log);
                    const isEditing = editingCell?.key === cat.key && editingCell?.date === col.date;
                    if (isEditing) {
                      return (
                        <td key={col.date} className="mqm-cell mqm-cell--editing" colSpan={1}>
                          <CellEditor
                            categoryKey={cat.key}
                            onSave={(payload) => handleCellSave(cat.key, col.date, payload)}
                            onCancel={() => setEditingCell(null)}
                          />
                        </td>
                      );
                    }
                    if (val) {
                      return <td key={col.date} className="mqm-cell mqm-cell--filled">{val}</td>;
                    }
                    // 미입력 셀
                    return (
                      <td
                        key={col.date}
                        className="mqm-cell mqm-cell--empty"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCellClick(cat.key, col.date)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCellClick(cat.key, col.date);
                          }
                        }}
                        aria-label={`${col.label} ${cat.name} 미입력 · 클릭하면 입력`}
                      >
                        <span className="mqm-cell__plus" aria-hidden="true">＋</span>
                        <span>{t('rightPanel.missedModal.empty')}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {toast && (
          <div className="mqm-toast" role="status" aria-live="polite">{toast}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
