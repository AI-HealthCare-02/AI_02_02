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
import { api, getScopedStorageKey } from '@/hooks/useApi';
import { getVisibleMissedCategories } from '@/lib/chat/cardRegistry';
import {
  ALCOHOL_OPTIONS,
  EXERCISE_DONE_OPTIONS,
  EXERCISE_MINUTES_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
  MEDICATION_OPTIONS,
  MEAL_STATUS_OPTIONS,
  MOOD_LABELS,
  MOOD_OPTIONS,
  SLEEP_DURATION_LABELS,
  SLEEP_DURATION_OPTIONS,
  SLEEP_QUALITY_LABELS,
  SLEEP_QUALITY_OPTIONS,
  WALK_DONE_OPTIONS,
  WATER_OPTIONS,
} from '@/lib/healthOptionLabels';
import { t } from '@/lib/i18n/rightPanel.ko';

const API_MISSING_PATH = '/api/v1/health/daily/missing?lookback_days=3';
const API_DAILY_PATH = (date) => `/api/v1/health/daily/${date}`;
const CACHE_TTL_MS = 60 * 1000;
const DRAFT_KEY = 'danaa_missed_draft_v1';

function getDraftStorageKey() {
  return getScopedStorageKey(DRAFT_KEY);
}

/**
 * DB 필드 → 카테고리 매핑 (cardRegistry와 동일 키)
 */
const CATEGORY_FIELDS = {
  sleep: ['sleep_quality', 'sleep_duration_bucket'],
  meal: ['breakfast_status', 'lunch_status', 'dinner_status'],
  medication: ['took_medication'],
  exercise: ['exercise_done', 'exercise_type', 'exercise_minutes', 'walk_done'],
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
  if (key === 'sleep') {
    const quality = ({ ...SLEEP_QUALITY_LABELS, excellent: '푹 잤어요' })[dailyLog.sleep_quality];
    const duration = SLEEP_DURATION_LABELS[dailyLog.sleep_duration_bucket];
    if (quality && duration) return `${quality} · ${duration}`;
    return quality || duration || '기록됨';
  }
  if (key === 'water') {
    const cups = Number(dailyLog.water_cups || 0);
    return cups > 0 ? `${cups}잔` : null;
  }
  switch (key) {
    case 'sleep': {
      const q = ({ ...SLEEP_QUALITY_LABELS, excellent: '푹 잤어요' })[dailyLog.sleep_quality];
      const d = SLEEP_DURATION_LABELS[dailyLog.sleep_duration_bucket];
      if (q && d) return `${q} · ${d}`;
      return q || d || '기록됨';
    }
    case 'meal': {
      const done = ['breakfast_status', 'lunch_status', 'dinner_status'].filter((f) => dailyLog[f]).length;
      return `${done}/3`;
    }
    case 'medication':
      if (dailyLog.took_medication === true) return '복용했어요';
      if (dailyLog.took_medication === false) return '아직 못 먹었어요';
      return null;
    case 'exercise': {
      if (dailyLog.exercise_done === true) {
        const typeLabel = EXERCISE_TYPE_OPTIONS.find((o) => o.value === dailyLog.exercise_type)?.label;
        const minLabel = EXERCISE_MINUTES_OPTIONS.find((o) => o.value === dailyLog.exercise_minutes)?.label;
        if (typeLabel && minLabel) return `${typeLabel} · ${minLabel}`;
        if (typeLabel) return `했어요 · ${typeLabel}`;
        return '했어요';
      }
      if (dailyLog.exercise_done === false) {
        if (dailyLog.walk_done === true) return '못 했어요 · 걷기 했어요';
        if (dailyLog.walk_done === false) return '못 했어요 · 걷기도 못 했어요';
        return '못 했어요';
      }
      return null;
    }
    case 'water':
      return dailyLog.water_cups > 0 ? `${dailyLog.water_cups}잔` : null;
    case 'mood':
      return MOOD_LABELS[dailyLog.mood_level] || null;
    case 'alcohol':
      if (dailyLog.alcohol_today === false) return '안 마셨어요';
      if (dailyLog.alcohol_today === true) return '마셨어요';
      return null;
    default:
      return null;
  }
}

function isCategoryComplete(key, dailyLog) {
  if (!dailyLog) return false;
  const fields = CATEGORY_FIELDS[key] || [];
  if (key === 'meal' || key === 'sleep') {
    return fields.every((f) => dailyLog[f] != null && dailyLog[f] !== '');
  }
  if (key === 'exercise') {
    const done = dailyLog.exercise_done;
    if (done == null) return false;
    if (done === true) return dailyLog.exercise_type != null && dailyLog.exercise_minutes != null;
    if (done === false) return dailyLog.walk_done != null;
    return false;
  }
  return fields.some((f) => dailyLog[f] != null && dailyLog[f] !== '');
}

const MEAL_FIELD_LABELS = {
  breakfast_status: '아침',
  lunch_status: '점심',
  dinner_status: '저녁',
};

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

const FIELD_OPTIONS = {
  sleep: {
    field: 'sleep_quality',
    options: SLEEP_QUALITY_OPTIONS,
  },
  meal: {
    field: 'breakfast_status',
    options: MEAL_STATUS_OPTIONS,
  },
  medication: {
    field: 'took_medication',
    parse: parseBool,
    options: MEDICATION_OPTIONS,
  },
  exercise: {
    field: 'exercise_done',
    parse: parseBool,
    options: EXERCISE_DONE_OPTIONS,
  },
  water: {
    field: 'water_cups',
    parse: parseInt10,
    options: WATER_OPTIONS,
  },
  mood: {
    field: 'mood_level',
    options: MOOD_OPTIONS,
  },
  alcohol: {
    field: 'alcohol_today',
    parse: parseBool,
    options: ALCOHOL_OPTIONS,
  },
};

const draftKey = (date, categoryKey) => `${date}:${categoryKey}`;

function buildDraftPayload(categoryKey, rawValue) {
  const def = FIELD_OPTIONS[categoryKey];
  if (!def) return null;
  const parse = def.parse || ((v) => v);
  return { [def.field]: parse(rawValue) };
}

function buildFieldDraftPayload(categoryKey, field, rawValue) {
  const def = FIELD_OPTIONS[categoryKey];
  if (!def) return null;
  const parse = def.parse || ((v) => v);
  return { [field]: parse(rawValue) };
}

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

  if (categoryKey === 'sleep') {
    return (
      <div className="mqm-cell-edit">
        <SelectField
          value={draft.sleep_duration_bucket}
          options={SLEEP_DURATION_OPTIONS}
          onChange={(v) => setDraft({ ...draft, sleep_duration_bucket: v })}
        />
        <SelectField
          value={draft.sleep_quality}
          options={SLEEP_QUALITY_OPTIONS}
          onChange={(v) => setDraft({ ...draft, sleep_quality: v })}
        />
        <div className="mqm-cell-edit__actions">
          <button type="button" className="mqm-btn-ghost" onClick={onCancel}>취소</button>
          <button type="button" className="mqm-btn-primary" onClick={handleSave} disabled={saving || Object.keys(draft).length === 0}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
        {error && <div className="mqm-cell-edit__error">{error}</div>}
      </div>
    );
  }

  const fields = (() => {
    switch (categoryKey) {
      case 'sleep':
        return (
          <SelectField
            value={draft.sleep_quality}
            options={SLEEP_QUALITY_OPTIONS}
            onChange={(v) => setDraft({ ...draft, sleep_quality: v })}
          />
        );
      case 'meal':
        return (
          <SelectField
            value={draft.breakfast_status}
            options={MEAL_STATUS_OPTIONS}
            onChange={(v) => setDraft({ ...draft, breakfast_status: v })}
          />
        );
      case 'medication':
        return (
          <SelectField
            value={draft.took_medication}
            options={MEDICATION_OPTIONS}
            parse={parseBool}
            onChange={(v) => setDraft({ ...draft, took_medication: v })}
          />
        );
      case 'exercise':
        return (
          <>
            <SelectField
              value={draft.exercise_done ?? ''}
              placeholder="운동 여부"
              options={EXERCISE_DONE_OPTIONS}
              parse={parseBool}
              onChange={(v) => setDraft({ exercise_done: v })}
            />
            {draft.exercise_done === true && (
              <>
                <SelectField
                  value={draft.exercise_type ?? ''}
                  placeholder="운동 종류"
                  options={EXERCISE_TYPE_OPTIONS}
                  onChange={(v) => setDraft({ ...draft, exercise_type: v })}
                />
                <SelectField
                  value={draft.exercise_minutes ?? ''}
                  placeholder="운동 시간"
                  options={EXERCISE_MINUTES_OPTIONS}
                  parse={parseInt10}
                  onChange={(v) => setDraft({ ...draft, exercise_minutes: v })}
                />
              </>
            )}
            {draft.exercise_done === false && (
              <SelectField
                value={draft.walk_done ?? ''}
                placeholder="걷기 여부"
                options={WALK_DONE_OPTIONS}
                parse={parseBool}
                onChange={(v) => setDraft({ ...draft, walk_done: v })}
              />
            )}
          </>
        );
      case 'water':
        return (
          <SelectField
            value={draft.water_cups}
            options={WATER_OPTIONS}
            parse={parseInt10}
            onChange={(v) => setDraft({ ...draft, water_cups: v })}
          />
        );
      case 'mood':
        return (
          <SelectField
            value={draft.mood_level}
            options={MOOD_OPTIONS}
            onChange={(v) => setDraft({ ...draft, mood_level: v })}
          />
        );
      case 'alcohol':
        return (
          <SelectField
            value={draft.alcohol_today}
            options={ALCOHOL_OPTIONS}
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
  const [pendingDrafts, setPendingDrafts] = useState({});
  const [savingDrafts, setSavingDrafts] = useState(false);
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
        modalRef.current.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')
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
  }, [open, editingCell, pendingDrafts]);

  const savePendingDrafts = useCallback(async () => {
    const entries = Object.entries(pendingDrafts);
    if (entries.length === 0) return true;

    setSavingDrafts(true);
    try {
      for (const [key, payload] of entries) {
        const [date, categoryKey] = key.split(':');
        // eslint-disable-next-line no-await-in-loop
        await handleCellSave(categoryKey, date, payload, { keepDrafts: true });
      }
      setPendingDrafts({});
      setToast(`${entries.length}개 항목을 저장했어요.`);
      setTimeout(() => setToast(null), 3000);
      return true;
    } catch (error) {
      setToast(t('rightPanel.error.networkFail'));
      setTimeout(() => setToast(null), 3000);
      return false;
    } finally {
      setSavingDrafts(false);
    }
  }, [pendingDrafts]);

  const handleClose = useCallback(async () => {
    if (Object.keys(pendingDrafts).length > 0) {
      const shouldSave = window.confirm('선택한 미입력 기록이 아직 저장되지 않았어요. 닫기 전에 저장할까요?');
      if (shouldSave) {
        const saved = await savePendingDrafts();
        if (!saved) return;
      } else {
        setPendingDrafts({});
      }
    }
    setEditingCell(null);
    setPendingDrafts({});
    onClose();
  }, [onClose, pendingDrafts, savePendingDrafts]);

  const handleCellClick = (key, date) => {
    setEditingCell({ key, date });
  };

  const handleCellSave = async (categoryKey, date, payload, options = {}) => {
    // sessionStorage 1건 draft (401 리다이렉트 대비)
    try {
      sessionStorage.setItem(getDraftStorageKey(), JSON.stringify({ date, key: categoryKey, payload, ts: Date.now() }));
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
    try { sessionStorage.removeItem(getDraftStorageKey()); } catch { /* noop */ }

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
                    const complete = isCategoryComplete(cat.key, col.log);
                    if (val && complete) {
                      return <td key={col.date} className="mqm-cell mqm-cell--filled">{val}</td>;
                    }
                    const optionDef = FIELD_OPTIONS[cat.key];
                    const pendingKey = draftKey(col.date, cat.key);
                    const currentDraft = pendingDrafts[pendingKey];
                    if ((cat.key === 'meal' || cat.key === 'sleep') && optionDef) {
                      const targetFields = CATEGORY_FIELDS[cat.key];
                      const missingFields = targetFields.filter((field) => col.log?.[field] == null || col.log?.[field] === '');
                      return (
                        <td key={col.date} className="mqm-cell mqm-cell--empty">
                          {val && <div className="mb-2 text-[12px] font-semibold text-nature-900">{val} 기록됨</div>}
                          <div className="space-y-2">
                            {missingFields.map((field) => {
                              const draftValue = currentDraft?.[field] ?? '';
                              const options = field === 'sleep_duration_bucket'
                                ? SLEEP_DURATION_OPTIONS
                                : field === 'sleep_quality'
                                  ? SLEEP_QUALITY_OPTIONS
                                  : optionDef.options;
                              const label = field === 'sleep_duration_bucket'
                                ? '수면 시간'
                                : field === 'sleep_quality'
                                  ? '수면 질'
                                  : MEAL_FIELD_LABELS[field];
                              return (
                                <label key={field} className="block text-left">
                                  <span className="mb-1 block text-[11px] font-semibold text-neutral-500">{label}</span>
                                  <SelectField
                                    value={draftValue}
                                    placeholder="선택"
                                    options={options}
                                    onChange={(rawValue) => {
                                      const payload = buildFieldDraftPayload(cat.key, field, rawValue);
                                      setPendingDrafts((prev) => ({
                                        ...prev,
                                        [pendingKey]: {
                                          ...(prev[pendingKey] || {}),
                                          ...payload,
                                        },
                                      }));
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      );
                    }
                    if (cat.key === 'exercise' && optionDef) {
                      const exerciseDoneValue = currentDraft?.exercise_done ?? col.log?.exercise_done;
                      return (
                        <td key={col.date} className="mqm-cell mqm-cell--empty">
                          <div className="space-y-2">
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-semibold text-neutral-500">운동 여부</span>
                              <SelectField
                                value={currentDraft?.exercise_done ?? col.log?.exercise_done ?? ''}
                                placeholder="선택"
                                options={EXERCISE_DONE_OPTIONS}
                                parse={parseBool}
                                onChange={(rawValue) => {
                                  setPendingDrafts((prev) => {
                                    const base = { exercise_done: rawValue };
                                    const existing = prev[pendingKey] || {};
                                    if (rawValue === true) {
                                      if (existing.exercise_type) base.exercise_type = existing.exercise_type;
                                      if (existing.exercise_minutes) base.exercise_minutes = existing.exercise_minutes;
                                    } else if (rawValue === false) {
                                      if (existing.walk_done != null) base.walk_done = existing.walk_done;
                                    }
                                    return { ...prev, [pendingKey]: base };
                                  });
                                }}
                              />
                            </label>
                            {exerciseDoneValue === true && (
                              <>
                                <label className="block text-left">
                                  <span className="mb-1 block text-[11px] font-semibold text-neutral-500">운동 종류</span>
                                  <SelectField
                                    value={currentDraft?.exercise_type ?? col.log?.exercise_type ?? ''}
                                    placeholder="선택"
                                    options={EXERCISE_TYPE_OPTIONS}
                                    onChange={(v) =>
                                      setPendingDrafts((prev) => ({
                                        ...prev,
                                        [pendingKey]: { ...(prev[pendingKey] || {}), exercise_type: v },
                                      }))
                                    }
                                  />
                                </label>
                                <label className="block text-left">
                                  <span className="mb-1 block text-[11px] font-semibold text-neutral-500">운동 시간</span>
                                  <SelectField
                                    value={currentDraft?.exercise_minutes ?? col.log?.exercise_minutes ?? ''}
                                    placeholder="선택"
                                    options={EXERCISE_MINUTES_OPTIONS}
                                    parse={parseInt10}
                                    onChange={(v) =>
                                      setPendingDrafts((prev) => ({
                                        ...prev,
                                        [pendingKey]: { ...(prev[pendingKey] || {}), exercise_minutes: v },
                                      }))
                                    }
                                  />
                                </label>
                              </>
                            )}
                            {exerciseDoneValue === false && (
                              <label className="block text-left">
                                <span className="mb-1 block text-[11px] font-semibold text-neutral-500">걷기 여부</span>
                                <SelectField
                                  value={currentDraft?.walk_done ?? col.log?.walk_done ?? ''}
                                  placeholder="선택"
                                  options={WALK_DONE_OPTIONS}
                                  parse={parseBool}
                                  onChange={(v) =>
                                    setPendingDrafts((prev) => ({
                                      ...prev,
                                      [pendingKey]: { ...(prev[pendingKey] || {}), walk_done: v },
                                    }))
                                  }
                                />
                              </label>
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (optionDef) {
                      return (
                        <td key={col.date} className="mqm-cell mqm-cell--empty">
                          <SelectField
                            value={currentDraft ? Object.values(currentDraft)[0] : ''}
                            placeholder="선택"
                            options={optionDef.options}
                            onChange={(rawValue) => {
                              const payload = buildDraftPayload(cat.key, rawValue);
                              setPendingDrafts((prev) => ({ ...prev, [pendingKey]: payload }));
                            }}
                          />
                        </td>
                      );
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
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="mqm-btn-ghost"
              onClick={() => setPendingDrafts({})}
              disabled={savingDrafts || Object.keys(pendingDrafts).length === 0}
            >
              선택 초기화
            </button>
            <button
              type="button"
              className="mqm-btn-primary"
              onClick={savePendingDrafts}
              disabled={savingDrafts || Object.keys(pendingDrafts).length === 0}
            >
              {savingDrafts ? '저장 중...' : `기록 저장하기 (${Object.keys(pendingDrafts).length})`}
            </button>
          </div>
        </div>
        {toast && (
          <div className="mqm-toast" role="status" aria-live="polite">{toast}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
