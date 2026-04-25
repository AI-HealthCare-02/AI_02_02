'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  Circle,
  Droplets,
  Dumbbell,
  Footprints,
  LineChart,
  Moon,
  Pencil,
  Sparkles,
  Target,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import { api } from '../../../hooks/useApi';

const REPORT_CACHE_PREFIX = 'danaa:report:dashboard:v7';
const REPORT_CACHE_TTL_MS = 5 * 60 * 1000;

const CARD_CLASS = 'rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(37,99,235,0.10)] transition-transform duration-150 hover:-translate-y-0.5';
const PRIMARY_BUTTON = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]';
const SECONDARY_BUTTON = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#111827] transition-colors hover:bg-[#F4F6F8]';

const STATUS = {
  none: {
    label: '대기',
    badge: 'bg-[#F4F6F8] text-[#6B7280]',
    bar: 'bg-[#6B7280]',
    text: 'text-[#6B7280]',
  },
  good: {
    label: '양호',
    badge: 'bg-[#D1FAE5] text-[#10B981]',
    bar: 'bg-[#2563EB]',
    text: 'text-[#111827]',
  },
  caution: {
    label: '주의',
    badge: 'bg-[#FEF3C7] text-[#F59E0B]',
    bar: 'bg-[#2563EB]',
    text: 'text-[#111827]',
  },
  danger: {
    label: '관리 필요',
    badge: 'bg-[#FEE2E2] text-[#EF4444]',
    bar: 'bg-[#2563EB]',
    text: 'text-[#111827]',
  },
};

const FINDRISC_FACTORS = {
  age: { label: '나이', desc: '연령 구간' },
  bmi: { label: '체중 상태', desc: 'BMI 기준' },
  waist: { label: '허리둘레', desc: '복부비만 신호' },
  activity: { label: '활동량', desc: '운동 부족' },
  vegetable: { label: '채소 섭취', desc: '섭취 부족' },
  hypertension: { label: '혈압 이력', desc: '고혈압 관련' },
  glucose_history: { label: '혈당 이력', desc: '고혈당 관련' },
  family: { label: '가족력', desc: '당뇨 가족력' },
};

const HEALTH_CARDS = [
  {
    key: 'sleep',
    title: '수면',
    icon: Moon,
    scoreKey: 'sleep_score',
    unit: '점',
    target: '목표 70점',
    keyword: '수면 부족 · 불규칙 패턴',
  },
  {
    key: 'diet',
    title: '식습관',
    icon: UtensilsCrossed,
    scoreKey: 'diet_score',
    unit: '점',
    target: '목표 70점',
    keyword: '채소 · 균형 · 단음료',
  },
  {
    key: 'exercise',
    title: '운동',
    icon: Activity,
    scoreKey: 'exercise_score',
    unit: '점',
    target: '목표 70점',
    keyword: '운동 빈도 · 활동량',
  },
  {
    key: 'hydration',
    title: '수분',
    icon: Droplets,
    scoreKey: null,
    unit: '',
    target: '기록 참고',
    keyword: '물 섭취 · 기록 습관',
  },
];

const CHALLENGE_ICON = {
  exercise: Dumbbell,
  hydration: Droplets,
  sleep: Moon,
  diet: UtensilsCrossed,
  lifestyle: Activity,
  medication: CheckCircle2,
};

function reportCacheKey(userId) {
  return userId == null ? null : `${REPORT_CACHE_PREFIX}:u${userId}`;
}

function readReportCache(userId) {
  if (typeof window === 'undefined') return null;
  const key = reportCacheKey(userId);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > REPORT_CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeReportCache(userId, payload) {
  if (typeof window === 'undefined') return;
  const key = reportCacheKey(userId);
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), payload }));
  } catch {}
}

function clearReportCache() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`${REPORT_CACHE_PREFIX}:`))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

function formatAgeRange(ageRange) {
  const map = { under_45: '45세 미만', '45_54': '45–54세', '55_64': '55–64세', '65_plus': '65세 이상' };
  return map[ageRange] ?? '-';
}

function formatGender(gender) {
  if (gender === 'MALE') return '남성';
  if (gender === 'FEMALE') return '여성';
  return '-';
}

function calcAgeFromBirthday(birthday) {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function clampPct(value, max = 100) {
  return Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));
}

function progressStatus(percent) {
  if (percent <= 0) return 'none';
  if (percent <= 40) return 'danger';
  if (percent <= 70) return 'caution';
  return 'good';
}

function progressColor(percent) {
  if (percent <= 0) return 'bg-[#6B7280]';
  if (percent <= 40) return 'bg-[#EF4444]';
  if (percent <= 70) return 'bg-[#F59E0B]';
  return 'bg-[#10B981]';
}

function predictionStatus(score) {
  if (score == null) return 'none';
  if (score < 40) return 'good';
  if (score < 70) return 'caution';
  return 'danger';
}

function findriscStatus(score) {
  if (score == null) return 'none';
  if (score <= 8) return 'good';
  if (score <= 20) return 'caution';
  return 'danger';
}

function lifestyleStatus(score) {
  if (score == null) return 'none';
  if (score >= 70) return 'good';
  if (score >= 40) return 'caution';
  return 'danger';
}

function latestTrendDelta(history, key) {
  const values = (history || []).map((item) => item?.[key]).filter((value) => value != null);
  if (values.length < 2) return null;
  return Math.round((values.at(-1) - values.at(-2)) * 10) / 10;
}

function formatDelta(value, suffix = '') {
  if (value == null) return '비교 부족';
  if (value === 0) return '변화 없음';
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function buildTrendPoints(history) {
  const recent = (history || []).slice(-7);
  return recent.map((item, index) => ({
    x: 46 + index * (recent.length === 1 ? 0 : 568 / (recent.length - 1)),
    label: String(item.period_end || '').slice(5),
    prediction: item.predicted_score_pct,
    official: item.findrisc_score,
  }));
}

function pointY(value, max) {
  if (value == null) return null;
  return 154 - (Math.max(0, Math.min(max, value)) / max) * 108;
}

function linePath(points, key, max) {
  const valid = points
    .map((point) => [point.x, pointY(point[key], max)])
    .filter(([, y]) => y != null);
  if (valid.length < 2) return '';
  return valid.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

function factorList(risk) {
  const breakdown = risk?.score_breakdown || {};
  return Object.entries(breakdown)
    .filter(([, value]) => Number(value) > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
}

function plainSignal(signal) {
  if (!signal) return '';
  return String(signal)
    .replace('BMI 기반 비만 위험', '체중 관리')
    .replace('수면 부족 경향', '수면 부족')
    .replace('운동 부족 경향', '활동량 부족')
    .replace('식습관 위험', '식습관 관리')
    .replace('혈당 위험 구간 반영', '혈당 주의')
    .replace('혈압 위험 구간 반영', '혈압 주의')
    .replace('복부비만 위험', '허리둘레 관리');
}

function buildSummaryText(risk, predictionDelta) {
  const signals = (risk?.supporting_signals || []).map(plainSignal).filter(Boolean);
  if (!risk) return '기록 기반 상태';
  if (signals.length > 0) return signals.slice(0, 2).join(' · ');
  if ((predictionDelta ?? 0) > 0) return '상승 흐름 · 기록 점검';
  if ((predictionDelta ?? 0) < 0) return '하락 흐름 · 유지';
  return '변화 없음 · 기록 유지';
}

function DefaultAvatar() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="32" cy="32" r="32" fill="#E8EEF8" />
      <circle cx="32" cy="24" r="11" fill="#B8C8E8" />
      <ellipse cx="32" cy="52" rx="18" ry="13" fill="#B8C8E8" />
    </svg>
  );
}

function ProfileEditModal({ userData, onClose, onSave }) {
  const [name, setName] = useState(userData?.name || '');
  const [gender, setGender] = useState(userData?.gender || '');
  const [birthday, setBirthday] = useState(userData?.birthday || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      const body = {};
      if (name.trim()) body.name = name.trim();
      if (gender) body.gender = gender;
      if (birthday) body.birthday = birthday;
      const res = await api('/api/v1/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('저장 실패');
      const updated = await res.json();
      onSave(updated);
    } catch {
      setErr('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[320px] rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#0F172A]">프로필 수정</span>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 hover:bg-[#F4F6FA]"><X size={16} /></button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B]">이름</label>
            <input
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B]">성별</label>
            <div className="flex gap-2">
              {[['MALE', '남성'], ['FEMALE', '여성']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGender(val)}
                  className="flex-1 rounded-xl border py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    borderColor: gender === val ? '#3B82F6' : '#E2E8F0',
                    backgroundColor: gender === val ? '#EFF6FF' : 'white',
                    color: gender === val ? '#2563EB' : '#64748B',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B]">생년월일</label>
            <input
              type="date"
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/10"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>

          {err && <div className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#EF4444]">{err}</div>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-1 w-full rounded-xl bg-[#2563EB] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ userData, statusData, onUserDataUpdate }) {
  const [photo, setPhoto] = useState(userData?.profile_image || null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [localUserData, setLocalUserData] = useState(userData);
  const fileRef = useRef(null);

  useEffect(() => {
    setLocalUserData(userData);
    setPhoto(userData?.profile_image || null);
  }, [userData]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      alert('이미지 크기는 512 KB 이하여야 합니다.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api('/api/v1/users/me/profile-image', { method: 'PUT', body: formData });
      if (res.ok) {
        const updated = await res.json();
        setPhoto(updated.profile_image || null);
        setLocalUserData(updated);
        if (onUserDataUpdate) onUserDataUpdate(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.detail || '이미지 업로드에 실패했습니다.');
      }
    } catch {
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const name = localUserData?.name || '사용자';
  const gender = localUserData?.gender ?? statusData?.gender;
  const height = statusData?.height_cm;
  const weight = statusData?.weight_kg;
  const birthday = localUserData?.birthday;
  const age = calcAgeFromBirthday(birthday);
  const ageDisplay = age != null ? `${age}세` : (statusData?.age_range ? formatAgeRange(statusData.age_range) : '-');

  const stats = [
    { label: '성별', value: formatGender(gender) },
    { label: '키', value: height ? `${Math.round(height)}cm` : '-' },
    { label: '나이', value: ageDisplay },
    { label: '몸무게', value: weight ? `${Math.round(weight)}kg` : '-' },
  ];

  return (
    <>
      {editOpen && (
        <ProfileEditModal
          userData={localUserData}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => {
            setLocalUserData(updated);
            setPhoto(updated?.profile_image || null);
            if (onUserDataUpdate) onUserDataUpdate(updated);
            setEditOpen(false);
          }}
        />
      )}
      <div className="border-b border-[#DDE1E8] p-5">
        <div className="flex items-center gap-4">
          {/* 아바타 */}
          <div className="relative shrink-0">
            <div className="h-[80px] w-[80px] overflow-hidden rounded-full ring-2 ring-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
              {photo ? (
                <img src={photo} alt="프로필" className="h-full w-full object-cover" />
              ) : (
                <DefaultAvatar />
              )}
            </div>
            <button
              type="button"
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#3B82F6] shadow-sm transition-colors hover:bg-[#2563EB] disabled:opacity-60"
              title="사진 변경"
            >
              <Camera size={11} color="white" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* 이름 + 수정 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[16px] font-bold text-[#0F172A]">{name}</span>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="shrink-0 rounded-lg p-1 text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#3B82F6]"
                title="프로필 수정"
              >
                <Pencil size={11} />
              </button>
            </div>
            <div className="mt-0.5 text-[10px] text-[#94A3B8]">내 건강 프로필</div>
          </div>
        </div>

        {/* 스탯 그리드 */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {stats.map(({ label, value }) => (
            <div key={label} className="flex min-h-[60px] flex-col items-center justify-center rounded-lg bg-[#F8FAFC] px-1.5 py-3">
              <span className="text-[9px] font-medium text-[#94A3B8]">{label}</span>
              <span className="mt-1 text-[12px] font-bold text-[#1E293B]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ScoreHoverPopup({ children, content, direction = 'right' }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  function show() {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  }
  function hide() {
    timer.current = setTimeout(() => setOpen(false), 100);
  }

  const posStyle =
    direction === 'right'
      ? 'left-full top-1/2 ml-2 -translate-y-1/2'
      : 'bottom-full left-1/2 mb-2 -translate-x-1/2';

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {open && (
        <div
          className={`pointer-events-auto absolute z-50 w-[210px] rounded-xl bg-white p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.14)] ring-1 ring-[#E2E8F0] ${posStyle}`}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {content}
        </div>
      )}
    </div>
  );
}

function ReportTabs() {
  return (
    <div className="shrink-0 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex w-full max-w-[1260px] gap-0 px-5">
        <div className="inline-flex items-center border-b-2 border-[#2563EB] px-5 py-3 text-[14px] font-semibold text-[#111827]">
          대시보드
        </div>
        <Link
          href="/app/report/detail"
          className="inline-flex items-center border-b-2 border-transparent px-5 py-3 text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
        >
          상세 리포트
        </Link>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center px-7 py-16">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#6B7280] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <BarChart3 size={20} />
        </div>
        <div className="text-[18px] font-semibold text-[#111827]">데이터 불러오는 중</div>
        <div className="mt-1 text-[12px] text-[#6B7280]">위험도 · 생활습관 · 챌린지</div>
      </div>
    </div>
  );
}

function HeroMetric({ title, value, suffix, status, max }) {
  const style = STATUS[status || 'none'];
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-[#111827]">{title}</div>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${style.badge}`}>{style.label}</span>
      </div>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-[36px] font-bold leading-none text-[#111827]">{value ?? '-'}</span>
        <span className="pb-1 text-[12px] font-semibold text-[#6B7280]">{suffix}</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-[#E5E7EB]">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${clampPct(value, max)}%` }} />
      </div>
    </div>
  );
}

function GaugeChart({ value, status }) {
  const pct = clampPct(value);
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const style = STATUS[status || 'none'];

  return (
    <div className="relative mx-auto flex h-[190px] w-[190px] items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 190 190" role="img" aria-label="다나와 모델 위험도 게이지">
        <circle cx="95" cy="95" r={radius} fill="none" stroke="#DBEAFE" strokeWidth="18" />
        <circle
          cx="95"
          cy="95"
          r={radius}
          fill="none"
          stroke="#2563EB"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="relative text-center">
        <div className="text-[72px] font-extrabold leading-none text-[#2563EB]">{value ?? '-'}</div>
        <div className="mt-1 text-[12px] font-semibold text-[#6B7280]">/ 100</div>
        <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${style.badge}`}>{style.label}</div>
      </div>
    </div>
  );
}

function DashboardPopoverCard({
  title,
  label,
  summary,
  badge,
  icon: Icon,
  align = 'left',
  children,
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  function openPopover() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function closePopover() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <div
      className="group relative"
      onMouseEnter={openPopover}
      onMouseLeave={closePopover}
      onFocus={openPopover}
      onBlur={closePopover}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-[24px] border border-[#E5EEF9] bg-white/95 p-4 text-left shadow-[0_12px_30px_rgba(37,99,235,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(37,99,235,0.14)]"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-[#9CA3AF]">{label}</div>
              <div className="mt-0.5 text-[15px] font-semibold leading-snug text-[#111827]">{title}</div>
            </div>
          </div>
          {badge ? (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 text-[13px] leading-5 text-[#6B7280]">{summary}</div>
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#2563EB]">
          눌러서 더 보기
          <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open ? (
        <>
          {/* XL 사이드 팝오버 - 마우스 갭 방지용 투명 브릿지 포함 */}
          <div
            className={`absolute top-3 z-30 hidden xl:block ${
              align === 'right' ? 'right-full pr-3' : 'left-full pl-3'
            }`}
            onMouseEnter={openPopover}
            onMouseLeave={closePopover}
          >
            <div className="w-[272px] rounded-[24px] bg-white p-4 text-left shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ring-[#DBEAFE]">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-[#9CA3AF]">{label}</div>
                  <div className="truncate text-[14px] font-semibold text-[#111827]">{title}</div>
                </div>
              </div>
              <div className="mt-3 text-[12px] leading-5 text-[#4B5563]">{children}</div>
            </div>
          </div>
          {/* 모바일/작은 화면 - 카드 아래 인라인 */}
          <div className="mt-2 rounded-[20px] bg-[#F8FBFF] p-4 text-[12px] leading-5 text-[#4B5563] ring-1 ring-[#DBEAFE] xl:hidden">
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}

function DashboardTrendPreview({ history }) {
  const points = buildTrendPoints(history);
  const predictionPath = linePath(points, 'prediction', 100);

  if (points.length < 2 || !predictionPath) {
    return <div className="rounded-2xl bg-[#F8FAFC] px-4 py-5 text-[12px] text-[#6B7280]">아직 비교할 기록이 충분하지 않습니다.</div>;
  }

  return (
    <div className="rounded-2xl bg-[#F8FAFC] p-3">
      <svg width="100%" viewBox="0 0 680 130" role="img" aria-label="위험도 추이 미리보기">
        <line x1="42" y1="32" x2="642" y2="32" stroke="#E5E7EB" strokeDasharray="4 4" />
        <line x1="42" y1="104" x2="642" y2="104" stroke="#E5E7EB" />
        <path d={predictionPath.replaceAll('154', '104')} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => {
          const y = pointY(point.prediction, 100);
          return y == null ? null : <circle key={point.label} cx={point.x} cy={Math.max(20, y - 50)} r="4.5" fill="white" stroke="#2563EB" strokeWidth="2.4" />;
        })}
      </svg>
    </div>
  );
}

function LegacyBodyInsightPanel() {
  const [selectedPointId, setSelectedPointId] = useState('chest');
  const [hoveredPointId, setHoveredPointId] = useState(null);
  const bodyPoints = [
    {
      id: 'head',
      label: '수면 회복',
      short: '수면 부족',
      description: '최근 수면 기록이 부족해 회복 상태 확인이 필요합니다.',
      signals: ['수면 부족', '회복 패턴 확인'],
      action: '수면 기록하기',
      href: '/app/chat',
      color: '#2563EB',
      status: '참고',
      top: '18%',
      left: '50%',
      glowSize: 136,
    },
    {
      id: 'chest',
      label: '심혈관',
      short: '활동량 부족',
      description: '활동량과 식습관 개선이 필요합니다.',
      signals: ['활동량 부족', '식습관 점검'],
      action: '운동 기록하기',
      href: '/app/chat',
      color: '#EF4444',
      status: '관리 필요',
      top: '38%',
      left: '50%',
      glowSize: 164,
    },
    {
      id: 'abdomen',
      label: '대사 관리',
      short: '식습관 점검',
      description: '식단 기록과 혈당 관리 흐름을 확인해보세요.',
      signals: ['식단 기록 부족', '대사 관리'],
      action: '식단 입력하기',
      href: '/app/chat',
      color: '#F59E0B',
      status: '주의',
      top: '55%',
      left: '50%',
      glowSize: 156,
    },
  ];
  const selectedPoint = bodyPoints.find((point) => point.id === selectedPointId) ?? bodyPoints[1];
  const focusedPoint = bodyPoints.find((point) => point.id === (hoveredPointId || selectedPointId)) ?? selectedPoint;
  const isHoverMode = Boolean(hoveredPointId);

  return (
    <div className="body-visual-panel relative flex h-full w-full flex-col rounded-[24px] bg-[rgba(247,248,250,0.78)] px-5 py-5 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-[2px]">
      <div className="body-visual-header text-center">
        <div className="text-[15px] font-semibold text-[#0F172A]">생활습관 영향 영역</div>
        <div className="mt-1 text-[12px] text-[#64748B]">포인트를 선택하면 관련 신호와 추천 행동을 확인할 수 있어요</div>
      </div>

      <div className="body-visual-content mt-4 flex min-h-0 flex-1 flex-col items-center">
        <div className="human-image-wrapper relative flex w-full flex-1 items-center justify-center rounded-[24px] bg-[radial-gradient(circle_at_center,#FAFAFA_0%,#F1F3F5_52%,#E9ECEF_100%)] px-4 py-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-[8%] rounded-[32px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.38),rgba(255,255,255,0)_72%)]" />
            <div className="absolute inset-0 rounded-[24px] ring-1 ring-white/35" />
            <div className="relative rounded-[24px] shadow-[0_16px_34px_rgba(148,163,184,0.10)]">
              <Image
                src="/body-clean.png"
                alt="건강 리포트 인체 이미지"
                width={410}
                height={620}
                priority
                className="block h-[470px] w-auto object-contain"
                style={{
                  mixBlendMode: 'multiply',
                  filter: 'contrast(1.05) brightness(0.96) saturate(0.9)',
                }}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[24px] overflow-hidden">
              <div className={`absolute inset-0 transition-opacity duration-200 ${isHoverMode ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'rgba(15,23,42,0.18)' }} />
              <div
                className="absolute rounded-full transition-all duration-200"
                style={{
                  top: focusedPoint.top,
                  left: focusedPoint.left,
                  width: `${focusedPoint.glowSize}px`,
                  height: `${focusedPoint.glowSize}px`,
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle at center, ${focusedPoint.color}40 0%, ${focusedPoint.color}1F 32%, transparent 72%)`,
                  filter: 'blur(2px)',
                  opacity: 1,
                }}
              />
              <div
                className="absolute rounded-full transition-all duration-200"
                style={{
                  top: focusedPoint.top,
                  left: focusedPoint.left,
                  width: `${Math.max(68, focusedPoint.glowSize * 0.42)}px`,
                  height: `${Math.max(68, focusedPoint.glowSize * 0.42)}px`,
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle at center, rgba(255,255,255,0.28), transparent 72%)`,
                  opacity: isHoverMode ? 1 : 0.78,
                }}
              />
            </div>
              {bodyPoints.map((point) => {
                const isSelected = selectedPointId === point.id;
                const isHovered = hoveredPointId === point.id;
                return (
                  <button
                    key={point.id}
                    type="button"
                    className="absolute rounded-full transition-transform duration-150 hover:scale-[1.15] focus:scale-[1.15] focus:outline-none"
                    style={{ top: point.top, left: point.left, transform: 'translate(-50%, -50%)' }}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId(null)}
                    onFocus={() => setHoveredPointId(point.id)}
                    onBlur={() => setHoveredPointId(null)}
                    onClick={() => setSelectedPointId(point.id)}
                    aria-label={point.label}
                  >
                    <span
                      className="relative block h-[18px] w-[18px] rounded-full"
                    >
                      <span
                        className="absolute inset-[-8px] rounded-full"
                        style={{ background: `${point.color}29` }}
                      />
                      <span
                        className="absolute inset-[-2px] rounded-full border border-white/80"
                        style={{ boxShadow: `0 0 14px ${point.color}99` }}
                      />
                      <span
                        className="absolute inset-0 rounded-full border-[4px] border-white"
                        style={{
                          background: point.color,
                          boxShadow: `0 8px 18px rgba(0,0,0,0.12)`,
                          animation: isSelected ? 'bodyPointPulse 1.6s infinite' : 'none',
                        }}
                      />
                      <span
                        className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                      />
                    </span>
                    {isHovered && (
                      <span className="absolute left-1/2 top-[-102px] z-20 min-w-[180px] -translate-x-1/2 rounded-[16px] bg-white/96 px-4 py-3 text-left shadow-[0_14px_32px_rgba(15,23,42,0.12)] ring-1 ring-white/80 backdrop-blur-sm">
                        <span
                          className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold"
                          style={{
                            color: point.color,
                            backgroundColor: `${point.color}14`,
                          }}
                        >
                          {point.status}
                        </span>
                        <span className="mt-2 block text-[13px] font-semibold text-[#0F172A]">{point.label}</span>
                        <span className="mt-1 block text-[11px] text-[#64748B]">{point.short}</span>
                        <span className="mt-2 block text-[11px] font-medium text-[#2563EB]">{point.action}</span>
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        <div className="selected-region-card mt-4 flex w-full max-w-[500px] flex-col rounded-[24px] bg-[rgba(255,255,255,0.86)] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
          <div className="text-[11px] font-semibold text-[#94A3B8]">선택된 부위 정보</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[18px] font-semibold text-[#0F172A]">{selectedPoint.label}</div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{
                color: selectedPoint.color,
                backgroundColor: `${selectedPoint.color}14`,
              }}
            >
              {selectedPoint.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedPoint.signals.map((signal) => (
              <span key={signal} className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
                {signal}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[12px] leading-[1.6] text-[#64748B]">{selectedPoint.description}</div>
          <Link
            href={selectedPoint.href}
            className="mt-4 inline-flex items-center justify-center self-start rounded-[14px] bg-[#EFF6FF] px-3 py-2 text-[12px] font-semibold text-[#2563EB] transition-colors hover:bg-[#DBEAFE]"
          >
            {selectedPoint.action}
          </Link>
        </div>

        <div className="body-legend mt-4 flex items-center justify-center gap-4 text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />관리 필요</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />주의</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />참고</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes bodyPointPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function BodyInsightPanel({ sleepStatus = 'none', dietStatus = 'none', exerciseStatus = 'none', highlightId = null, onPointEnter, onPointLeave, hideImage = false }) {
  const [hoveredId, setHoveredId] = useState(null);

  function stColor(s) {
    if (s === 'danger') return '#EF4444';
    if (s === 'caution') return '#F59E0B';
    if (s === 'good') return '#10B981';
    return '#3B82F6';
  }
  function stLabel(s) {
    if (s === 'danger') return '관리 필요';
    if (s === 'caution') return '주의';
    if (s === 'good') return '정상';
    return '참고';
  }

  const bodyPoints = useMemo(() => [
    {
      id: 'head',
      label: '수면 · 인지 기능',
      sub: '수면 패턴이 혈당 조절과 호르몬 균형에 직접 영향을 미칩니다.',
      color: stColor(sleepStatus),
      statusText: stLabel(sleepStatus),
      top: '18%', left: '50%', tipDir: 'right',
    },
    {
      id: 'chest',
      label: '심혈관 · 혈압',
      sub: '혈압 관리와 규칙적 운동은 당뇨 합병증 예방의 핵심입니다.',
      color: stColor(exerciseStatus),
      statusText: stLabel(exerciseStatus),
      top: '38%', left: '50%', tipDir: 'right',
    },
    {
      id: 'abdomen',
      label: '혈당 · 대사',
      sub: '복부 지방과 식습관은 인슐린 저항성을 높이는 주요 원인입니다.',
      color: stColor(dietStatus),
      statusText: stLabel(dietStatus),
      top: '56%', left: '50%', tipDir: 'right',
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sleepStatus, dietStatus, exerciseStatus]);

  const activeId = hoveredId || highlightId;
  const activePoint = bodyPoints.find((p) => p.id === activeId);

  function handleEnter(id) {
    setHoveredId(id);
    onPointEnter?.(id);
  }
  function handleLeave() {
    setHoveredId(null);
    onPointLeave?.();
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative flex h-full items-center justify-center">
        {/* 인체 이미지 — hideImage=true 이면 상위 레이어에서 배경으로 처리 */}
        {!hideImage && (
          <Image
            src="/body-clean.png"
            alt="건강 상태 인체"
            width={470}
            height={720}
            priority
            className="block h-full w-auto object-contain"
            style={{
              minHeight: '520px',
              mixBlendMode: 'multiply',
              filter: 'contrast(1.08) brightness(0.94) saturate(0.9) drop-shadow(0 16px 28px rgba(148,163,184,0.18))',
            }}
          />
        )}

        {/* 활성 부위 글로우 */}
        {activePoint && (
          <div
            className="pointer-events-none absolute rounded-full transition-all duration-300"
            style={{
              top: activePoint.top,
              left: activePoint.left,
              width: '120px',
              height: '120px',
              transform: 'translate(-50%,-50%)',
              background: `radial-gradient(circle, ${activePoint.color}35 0%, ${activePoint.color}12 55%, transparent 75%)`,
              filter: 'blur(6px)',
            }}
          />
        )}

        {/* 바디 포인트 */}
        {bodyPoints.map((point) => {
          const isHovered = hoveredId === point.id;
          const isHighlighted = !hoveredId && highlightId === point.id;
          const isActive = isHovered || isHighlighted;

          const tipStyle =
            point.tipDir === 'down'  ? { top: '22px',    left: '50%', transform: 'translateX(-50%)' } :
            point.tipDir === 'right' ? { top: '50%',     left: '22px', transform: 'translateY(-50%)' } :
                                       { bottom: '22px', left: '50%', transform: 'translateX(-50%)' };

          return (
            <button
              key={point.id}
              type="button"
              className="absolute focus:outline-none"
              style={{ top: point.top, left: point.left, transform: 'translate(-50%,-50%)', zIndex: isHovered ? 30 : 10 }}
              onMouseEnter={() => handleEnter(point.id)}
              onMouseLeave={handleLeave}
              aria-label={point.label}
            >
              {/* 펄스 링 */}
              <span
                className="absolute rounded-full"
                style={{
                  width: '26px', height: '26px',
                  top: '-8px', left: '-8px',
                  background: `${point.color}${isActive ? '28' : '18'}`,
                  animation: 'dotPulse 2.6s ease-in-out infinite',
                  transition: 'background 0.2s',
                }}
              />
              {/* 닷 */}
              <span
                className="relative block rounded-full border-2 border-white transition-all duration-200"
                style={{
                  width: isActive ? '14px' : '10px',
                  height: isActive ? '14px' : '10px',
                  background: point.color,
                  boxShadow: isActive
                    ? `0 0 0 6px ${point.color}28, 0 6px 18px rgba(0,0,0,0.22)`
                    : `0 0 0 3px ${point.color}18, 0 3px 8px rgba(0,0,0,0.15)`,
                }}
              />

              {/* 툴팁 */}
              {isHovered && (
                <span
                  className="absolute z-50 w-[180px] rounded-2xl bg-white p-3.5 text-left shadow-[0_12px_32px_rgba(0,0,0,0.14)] ring-1 ring-[#E2E8F0]"
                  style={tipStyle}
                >
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: point.color, backgroundColor: `${point.color}14` }}
                  >
                    {point.statusText}
                  </span>
                  <span className="mt-2 block text-[13px] font-bold text-[#0F172A]">
                    {point.id === 'head'
                      ? '수면 기록 피드백'
                      : point.id === 'chest'
                        ? '운동 루틴 피드백'
                        : '식습관 기록 피드백'}
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-[1.6] text-[#475569]">
                    {point.id === 'head'
                      ? '최근 수면 기록이 들쭉날쭉해서 대시보드가 보수적으로 판단하고 있습니다. 취침 시간과 수면 시간을 더 꾸준히 입력해 주세요.'
                      : point.id === 'chest'
                        ? '운동 기록이 부족해서 활동 흐름을 충분히 읽지 못하고 있습니다. 짧은 운동이라도 자주 남기면 피드백 정확도가 올라갑니다.'
                        : '식사와 섭취 기록이 자주 비어 있어 생활습관 점수가 낮게 잡혀 있습니다. 식사 내용만 꾸준히 남겨도 변화가 바로 반영됩니다.'}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function DashboardCenterVisual({ sleepStatus, dietStatus, exerciseStatus, highlightId, onPointEnter, onPointLeave, hideImage = false }) {
  return (
    <div className="relative h-full w-full">
      <BodyInsightPanel
        sleepStatus={sleepStatus}
        dietStatus={dietStatus}
        exerciseStatus={exerciseStatus}
        highlightId={highlightId}
        onPointEnter={onPointEnter}
        onPointLeave={onPointLeave}
        hideImage={hideImage}
      />
    </div>
  );
}

function HoverInsightSurface({
  children,
  title,
  summary,
  insight,
  badge,
  side = 'right',
}) {
  return (
    <div className="group relative">
      {children}
      <div
        className={`pointer-events-none absolute top-3 z-30 hidden w-[220px] rounded-[20px] bg-white/96 p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-[#E2E8F0] backdrop-blur-sm transition-all duration-150 lg:block ${
          side === 'left' ? 'right-full mr-3' : 'left-full ml-3'
        } opacity-0 translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100`}
      >
        {badge ? (
          <span
            className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{ color: badge.color, backgroundColor: badge.bg }}
          >
            {badge.label}
          </span>
        ) : null}
        <div className="mt-2 text-[13px] font-semibold text-[#0F172A]">{title}</div>
        <div className="mt-1 text-[11px] font-medium text-[#334155]">{summary}</div>
        <div className="mt-2 text-[11px] leading-5 text-[#64748B]">{insight}</div>
      </div>
    </div>
  );
}


function LegacySummarySection({ risk, history, summary, challenges }) {
  const prediction = risk?.predicted_score_pct;
  const official = risk?.findrisc_score;
  const signals = (risk?.supporting_signals || []).map(plainSignal).filter(Boolean);
  const sleep = summary?.scorecard?.sleep_score;
  const diet = summary?.scorecard?.diet_score;
  const exercise = summary?.scorecard?.exercise_score;

  const recommendedList = (challenges?.recommended || []).slice(0, 3);
  const todayTasks = recommendedList.length > 0
    ? recommendedList.map((t) => ({ id: t.template_id ?? t.name, name: t.name, href: '/app/challenge' }))
    : [
      { id: 't1', name: '운동 기록하기', href: '/app/chat' },
      { id: 't2', name: '수면 기록하기', href: '/app/chat' },
      { id: 't3', name: '식사 입력하기', href: '/app/chat' },
    ];

  const lifestyleCards = [
    {
      key: 'sleep', icon: Moon, label: '수면',
      score: sleep, status: lifestyleStatus(sleep),
      targetLabel: '목표 70점 · 수면 패턴 분석',
      recordLabel: '수면 기록하기', recordHref: '/app/chat',
    },
    {
      key: 'diet', icon: UtensilsCrossed, label: '식습관',
      score: diet, status: lifestyleStatus(diet),
      targetLabel: '목표 70점 · 식사 균형 분석',
      recordLabel: '식단 입력하기', recordHref: '/app/chat',
    },
    {
      key: 'exercise', icon: Activity, label: '운동',
      score: exercise, status: lifestyleStatus(exercise),
      targetLabel: '목표 70점 · 활동량 분석',
      recordLabel: '운동 기록하기', recordHref: '/app/chat',
    },
  ];

  return (
    <section className="h-full min-h-0 overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(37,99,235,0.10)]">
      <div className="grid h-full min-h-0 grid-cols-[240px_1fr_264px]">

        {/* ── 왼쪽 패널: 위험도 요약 ── */}
        <div className="flex flex-col gap-2.5 overflow-y-auto border-r border-[#F1F5F9] p-4">

          {/* 건강 위험도 (AI 종합) */}
          <div className="rounded-2xl bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-[#111827]">건강 위험도</span>
                <div className="text-[10px] text-[#9CA3AF]">다나와 모델 · AI 분석 결과</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[predictionStatus(prediction)].badge}`}>
                {STATUS[predictionStatus(prediction)].label}
              </span>
            </div>
            <div className="mt-2 flex items-end gap-1.5">
              <span className="text-[42px] font-extrabold leading-none text-[#111827]">
                {prediction ?? '-'}
              </span>
              <span className="mb-1.5 text-[13px] text-[#9CA3AF]">/ 100</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[#E5E7EB]">
              <div
                className={`h-full rounded-full transition-all ${progressColor(clampPct(prediction))}`}
                style={{ width: `${clampPct(prediction)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]">
              <span>낮음</span><span>높음</span>
            </div>
          </div>

          {/* 당뇨 위험도 (FINDRISC) */}
          <div className="rounded-2xl bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-[#111827]">당뇨 위험도</span>
                <div className="text-[10px] text-[#9CA3AF]">FINDRISC · 기본 건강 지표</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[findriscStatus(official)].badge}`}>
                {STATUS[findriscStatus(official)].label}
              </span>
            </div>
            <div className="mt-1.5 flex items-end gap-1.5">
              <span className="text-[28px] font-extrabold leading-none text-[#111827]">{official ?? '-'}</span>
              <span className="mb-1 text-[12px] text-[#9CA3AF]">/ 26</span>
            </div>
            <div className="mt-1.5 text-[12px] leading-5 text-[#6B7280]">
              {findriscStatus(official) === 'good'
                ? '당뇨 위험이 낮은 편이에요.'
                : findriscStatus(official) === 'caution'
                ? '가벼운 관리가 필요해요.'
                : '적극적인 관리를 권장해요.'}
            </div>
          </div>

          {/* 주요 신호 */}
          <div className="rounded-2xl bg-[#F8FAFC] p-4">
            <div className="text-[11px] font-semibold text-[#9CA3AF]">주요 신호</div>
            {signals.length === 0 ? (
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#10B981]">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                큰 이상 신호 없음
              </div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {signals.slice(0, 3).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: i === 0 ? '#EF4444' : i === 1 ? '#F59E0B' : '#6B7280' }}
                    />
                    <span className="text-[13px] text-[#374151]">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 오늘 할 일 */}
          <div className="rounded-2xl bg-[#F8FAFC] p-4">
            <div className="text-[11px] font-semibold text-[#9CA3AF]">오늘 할 일</div>
            <div className="mt-2 space-y-2">
              {todayTasks.map((task, i) => (
                <Link
                  key={task.id}
                  href={task.href}
                  className="flex items-center gap-2 text-[13px] text-[#374151] transition-colors hover:text-[#2563EB]"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#D1D5DB] text-[9px] font-bold text-[#9CA3AF]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{task.name}</span>
                  <ArrowRight size={11} className="shrink-0 text-[#9CA3AF]" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── 가운데 패널: 인체 시각화 ── */}
        <div className="flex flex-col items-center gap-3 border-r border-[#F1F5F9] bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_70%)] px-4 py-4">
          <div className="flex min-h-0 flex-1 w-full items-center justify-center">
            <DashboardCenterVisual />
          </div>
          <Link
            href="/app/report/detail"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-white px-4 py-2 text-[12px] font-semibold text-[#2563EB] shadow-sm transition-colors hover:bg-[#EFF6FF]"
          >
            상세 리포트 보기 <ArrowRight size={12} />
          </Link>
        </div>

        {/* ── 오른쪽 패널: 생활습관 점수 ── */}
        <div className="flex flex-col gap-2.5 overflow-y-auto p-4">
          {lifestyleCards.map(({ key, icon: Icon, label, score, status, targetLabel, recordLabel, recordHref }) => {
            const sc = STATUS[status];
            const pct = clampPct(score);
            const numColor =
              status === 'good' ? '#10B981'
              : status === 'caution' ? '#F59E0B'
              : status === 'danger' ? '#EF4444'
              : '#9CA3AF';
            return (
              <div key={key} className="rounded-2xl bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon size={14} className="text-[#2563EB]" />
                    <span className="text-[13px] font-semibold text-[#111827]">{label}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc.badge}`}>{sc.label}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-[#9CA3AF]">{targetLabel}</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-[30px] font-extrabold leading-none" style={{ color: numColor }}>
                    {score ?? '-'}
                  </span>
                  <span className="mb-0.5 text-[11px] text-[#9CA3AF]">점</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[#E5E7EB]">
                  <div className={`h-full rounded-full ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-0.5 text-[10px] text-[#9CA3AF]">목표 대비 {score ?? 0}%</div>
                <Link
                  href={recordHref}
                  className="mt-2.5 flex items-center justify-between border-t border-[#E5E7EB] pt-2.5 text-[12px] font-medium text-[#6B7280] transition-colors hover:text-[#2563EB]"
                >
                  {recordLabel}
                  <ArrowRight size={12} className="text-[#9CA3AF]" />
                </Link>
              </div>
            );
          })}

          {/* 추천 챌린지 */}
          {recommendedList.length > 0 && (
            <div className="rounded-2xl bg-[#F8FAFC] p-4">
              <div className="text-[11px] font-semibold text-[#9CA3AF]">추천 챌린지</div>
              <div className="mt-2 space-y-1.5">
                {recommendedList.slice(0, 2).map((item) => (
                  <Link
                    key={item.template_id ?? item.name}
                    href="/app/challenge"
                    className="flex items-center gap-2 text-[13px] text-[#374151] transition-colors hover:text-[#2563EB]"
                  >
                    <Target size={12} className="shrink-0 text-[#2563EB]" />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <ArrowRight size={11} className="shrink-0 text-[#9CA3AF]" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
function buildSmartChallenges(sleep, diet, exercise, challenges) {
  const fromApi = challenges?.recommended || [];
  if (fromApi.length > 0) return fromApi.slice(0, 2);
  const candidates = [
    { key: 'sleep', score: sleep, name: '규칙적인 수면 루틴 챌린지', description: '수면 점수가 낮습니다. 취침·기상 시간을 일정하게 유지해보세요.', category: 'sleep' },
    { key: 'diet',  score: diet,  name: '채소 충분히 먹기 챌린지',   description: '식습관 점수가 낮습니다. 매 끼니 채소 한 가지를 추가해보세요.', category: 'diet' },
    { key: 'exercise', score: exercise, name: '주 150분 운동 챌린지', description: '운동 점수가 낮습니다. 하루 30분 걷기부터 시작해보세요.', category: 'exercise' },
  ];
  return candidates
    .filter((c) => c.score != null)
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
    .slice(0, 2)
    .map((c) => ({ template_id: `smart-${c.key}`, name: c.name, description: c.description, category: c.category }));
}

function SummarySection({ risk, history, summary, challenges, userData, statusData }) {
  const [hoveredRegion, setHoveredRegion] = useState(null);

  const prediction = risk?.predicted_score_pct;
  const official = risk?.findrisc_score;
  const signals = (risk?.supporting_signals || []).map(plainSignal).filter(Boolean);
  const sleep = summary?.scorecard?.sleep_score;
  const diet = summary?.scorecard?.diet_score;
  const exercise = summary?.scorecard?.exercise_score;

  const sleepSt = lifestyleStatus(sleep);
  const dietSt = lifestyleStatus(diet);
  const exerciseSt = lifestyleStatus(exercise);
  const predSt = predictionStatus(prediction);
  const finSt = findriscStatus(official);

  function stColor(s) {
    if (s === 'danger') return '#EF4444';
    if (s === 'caution') return '#F59E0B';
    if (s === 'good') return '#10B981';
    return '#94A3B8';
  }

  const predColor = stColor(predSt);
  const finColor = stColor(finSt);

  const activeList = challenges?.active || [];
  const smartChallenges = buildSmartChallenges(sleep, diet, exercise, challenges);

  const lifestyleItems = [
    {
      key: 'sleep', pointId: 'head', icon: Moon, label: '수면', score: sleep, status: sleepSt, href: '/app/chat',
      weakReason: sleep == null ? '기록이 없습니다' : sleep < 40 ? '수면 부족이 심각합니다' : sleep < 70 ? '수면 패턴이 불규칙합니다' : '수면 상태가 양호합니다',
    },
    {
      key: 'diet', pointId: 'abdomen', icon: UtensilsCrossed, label: '식습관', score: diet, status: dietSt, href: '/app/chat',
      weakReason: diet == null ? '기록이 없습니다' : diet < 40 ? '식습관 개선이 시급합니다' : diet < 70 ? '채소·균형 섭취가 부족합니다' : '식습관 상태가 양호합니다',
    },
    {
      key: 'exercise', pointId: 'chest', icon: Activity, label: '운동', score: exercise, status: exerciseSt, href: '/app/chat',
      weakReason: exercise == null ? '기록이 없습니다' : exercise < 40 ? '운동량이 매우 부족합니다' : exercise < 70 ? '활동량이 다소 부족합니다' : '운동 상태가 양호합니다',
    },
  ];

  const findriscBreakdown = Object.entries(risk?.score_breakdown || {})
    .filter(([, v]) => Number(v) > 0)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 3);

  return (
    <section
      className="mx-auto flex h-full w-full max-w-[1260px] overflow-hidden rounded-[28px] shadow-[0_18px_42px_rgba(148,163,184,0.14)]"
      style={{
        minHeight: '760px',
        height: '100%',
        position: 'relative',
        background: '#F0F2F5',
      }}
    >
      <div className="relative grid flex-1 w-full" style={{ gridTemplateColumns: '292px minmax(0, 1fr) 278px', alignItems: 'stretch' }}>

        {/* ── LEFT: 프로필 + 점수 강조 + 분석 근거 ── */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            background: 'rgba(240,242,245,0.97)',
            boxShadow: 'inset -1px 0 0 #DDE1E8',
          }}
        >

          <ProfileCard
            userData={userData}
            statusData={statusData}
            onUserDataUpdate={setUserData}
          />

          {/* 건강 위험도 (다나와 모델) — 크게 강조 */}
          <div className="min-h-[148px] border-b border-[#EDF0F5] p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">건강 위험도</span>
              <span className="text-[9px] text-[#CBD5E1]">다나와 AI</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative h-[68px] w-[68px] shrink-0">
                <svg className="-rotate-90" width="68" height="68" viewBox="0 0 68 68">
                  <circle cx="34" cy="34" r="26" fill="none" stroke="#F0F2F5" strokeWidth="7" />
                  <circle cx="34" cy="34" r="26" fill="none" stroke={predColor} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${(clampPct(prediction) / 100) * Math.PI * 52} ${Math.PI * 52}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[18px] font-extrabold leading-none" style={{ color: predColor }}>{prediction ?? '-'}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#0F172A]">{prediction ?? '-'} / 100</span>
                  <span className="ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: predColor, backgroundColor: `${predColor}14` }}>
                    {STATUS[predSt].label}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {signals.slice(0, 2).map((s, i) => (
                    <span key={s} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{ color: i === 0 ? '#B91C1C' : '#B45309', backgroundColor: i === 0 ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.12)' }}>
                      {s}
                    </span>
                  ))}
                  {signals.length === 0 && <span className="text-[10px] text-[#10B981]">이상 신호 없음</span>}
                </div>
              </div>
            </div>
          </div>

          {/* 당뇨 위험도 (FINDRISC) — 크게 강조 */}
          <div className="min-h-[168px] border-b border-[#EDF0F5] p-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">당뇨 위험도</span>
              <span className="text-[9px] text-[#CBD5E1]">FINDRISC</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[34px] font-extrabold leading-none" style={{ color: finColor }}>{official ?? '-'}</span>
              <span className="text-[11px] text-[#94A3B8]">/ 26점</span>
              <span className="ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: finColor, backgroundColor: `${finColor}14` }}>
                {STATUS[finSt].label}
              </span>
            </div>
            <div className="relative mt-2.5">
              <div className="flex h-2 overflow-hidden rounded-full">
                <div className="flex-[8] bg-[#DCFCE7]" />
                <div className="mx-px w-px bg-white" />
                <div className="flex-[12] bg-[#FEF9C3]" />
                <div className="mx-px w-px bg-white" />
                <div className="flex-[6] bg-[#FEE2E2]" />
              </div>
              <span className="absolute -top-0.5 h-3 w-[3px] -translate-x-1/2 rounded-full bg-[#1E293B]"
                style={{ left: `${Math.min(93, clampPct(official, 26))}%` }} />
            </div>
            <div className="mt-0.5 flex justify-between text-[9px] text-[#94A3B8]">
              <span>낮음</span><span>높음</span>
            </div>
          </div>

          {/* 점수 분석 근거 */}
          <div className="flex-1 p-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">점수 근거</div>
            <div className="space-y-1.5">
              {signals.length > 0 ? signals.slice(0, 3).map((s, i) => (
                <div key={s} className="flex items-start gap-2 rounded-lg bg-[#F1F3F5] px-2.5 py-2 text-[10px] text-[#334155]">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: i === 0 ? '#EF4444' : i === 1 ? '#F59E0B' : '#94A3B8' }} />
                  {s}
                </div>
              )) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-[#F0FDF4] px-2.5 py-2 text-[10px] text-[#10B981]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />현재 주요 위험 신호 없음
                </div>
              )}
              {findriscBreakdown.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-[#FEF9C3] px-2.5 py-1.5 text-[10px]">
                  <span className="text-[#92400E]">{FINDRISC_FACTORS[key]?.label || key}</span>
                  <span className="font-semibold text-[#B45309]">+{value}점</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER: 도트만 표시 ── */}
        <div
          className="relative flex flex-col items-center justify-between pb-5 pt-2"
          style={{ overflow: 'visible', background: 'transparent' }}
        >
          <DashboardCenterVisual
            sleepStatus={sleepSt}
            dietStatus={dietSt}
            exerciseStatus={exerciseSt}
            highlightId={hoveredRegion}
            onPointEnter={(id) => setHoveredRegion(id)}
            onPointLeave={() => setHoveredRegion(null)}
          />
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-3 text-[9px] text-[#7B8CA6]">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />관리 필요</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />주의</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />양호</span>
            </div>
            <Link href="/app/report/detail"
              className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1 text-[10px] font-semibold text-[#3B82F6] shadow-sm backdrop-blur-sm transition-colors hover:bg-white/95">
              상세 리포트 <ArrowRight size={9} />
            </Link>
          </div>
        </div>

        {/* ── RIGHT: 생활습관 + 스마트 챌린지 + 진행 중 챌린지 ── */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            background: 'rgba(240,242,245,0.97)',
            boxShadow: 'inset 1px 0 0 #DDE1E8',
          }}
        >

          {/* 생활습관 점수 (부족 이유 포함) */}
          {lifestyleItems.map(({ key, pointId, icon: Icon, label, score, status, weakReason, href }) => {
            const color = stColor(status);
            const pct = clampPct(score);
            const sc = STATUS[status];
            const isLinked = hoveredRegion === pointId;
            const r = 18;
            const circ = 2 * Math.PI * r;
            const dash = (pct / 100) * circ;
            return (
              <div
                key={key}
                className="flex min-h-[152px] cursor-default flex-col border-b border-[#EDF0F5] p-4 transition-colors"
                style={{ backgroundColor: isLinked ? `${color}08` : 'transparent' }}
                onMouseEnter={() => setHoveredRegion(pointId)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                      style={{ backgroundColor: isLinked ? `${color}22` : `${color}12` }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <span className="text-[12px] font-semibold text-[#0F172A]">{label}</span>
                  </div>
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ color, backgroundColor: `${color}12` }}>
                    {sc.label}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="relative h-[40px] w-[40px] shrink-0">
                    <svg className="-rotate-90" width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r={r} fill="none" stroke="#EDF0F5" strokeWidth="4" />
                      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
                        strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-extrabold leading-none" style={{ color }}>{score ?? '-'}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] leading-[1.5] text-[#64748B]">{weakReason}</div>
                    <div className="mt-1 h-1 rounded-full bg-[#EDF0F5]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold" style={{ color }}>{pct}%</span>
                      <Link href={href} className="text-[9px] font-semibold text-[#3B82F6] hover:text-[#2563EB]"
                        onClick={(e) => e.stopPropagation()}>기록 →</Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 추천 챌린지 (약한 영역 기반) */}
          <div className="min-h-[144px] border-b border-[#EDF0F5] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">추천 챌린지</span>
              <Target size={10} className="text-[#3B82F6]" />
            </div>
            <div className="flex flex-col gap-1.5">
              {smartChallenges.map((item) => (
                <Link key={item.template_id ?? item.name} href="/app/challenge"
                  className="flex items-center gap-2 rounded-xl bg-[#F1F3F5] px-2.5 py-2 text-[10px] text-[#374151] transition-colors hover:bg-[#E7EBEF] hover:text-[#2563EB]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <ArrowRight size={9} className="shrink-0 text-[#94A3B8]" />
                </Link>
              ))}
            </div>
          </div>

          {/* 진행 중인 챌린지 */}
          {activeList.length > 0 && (
            <div className="min-h-[122px] border-b border-[#EDF0F5] p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">진행 중</div>
              <div className="flex flex-col gap-1.5">
                {activeList.slice(0, 2).map((item) => (
                  <div key={item.user_challenge_id ?? item.name} className="flex items-center gap-2 rounded-xl bg-[#F0FDF4] px-2.5 py-2 text-[10px] text-[#166534]">
                    <CheckCircle2 size={10} className="shrink-0 text-[#10B981]" />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 챌린지 탭으로 이동 */}
          <div className="mt-auto p-4">
            <Link href="/app/challenge"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5 text-[11px] font-semibold text-[#2563EB] transition-colors hover:bg-[#DBEAFE]">
              챌린지 바꾸러 가기 <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendSection({ history }) {
  const points = buildTrendPoints(history);
  const predictionPath = linePath(points, 'prediction', 100);
  const officialPath = linePath(points, 'official', 26);

  return (
    <section className={CARD_CLASS}>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[18px] font-semibold text-[#111827]">최근 7주 위험도 흐름</div>
          <div className="mt-1 text-[12px] text-[#6B7280]">흐름 · 비교</div>
        </div>
        <div className="flex gap-4 text-[12px] text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />다나와 모델</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 border-t-2 border-dashed border-[#6B7280]" />공식 점수</span>
        </div>
      </div>
      {points.length < 2 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl bg-[#F4F6F8] px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#6B7280] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <LineChart size={24} />
          </div>
          <div className="mt-4 text-[18px] font-semibold text-[#111827]">아직 데이터가 부족해요</div>
          <div className="mt-2 text-[12px] leading-5 text-[#6B7280]">7일 이상 기록하면 흐름을 확인할 수 있어요</div>
          <Link href="/app/chat?new=1" className={`${PRIMARY_BUTTON} mt-5`}>
            기록 시작하기
          </Link>
        </div>
      ) : (
        <svg width="100%" viewBox="0 0 680 230" role="img" aria-label="최근 위험도 흐름 그래프">
          <line x1="42" y1="46" x2="642" y2="46" stroke="#E5E7EB" strokeDasharray="4 4" />
          <line x1="42" y1="100" x2="642" y2="100" stroke="#E5E7EB" strokeDasharray="4 4" />
          <line x1="42" y1="154" x2="642" y2="154" stroke="#E5E7EB" />
          {predictionPath && <path d={predictionPath} fill="none" stroke="#2563EB" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
          {officialPath && <path d={officialPath} fill="none" stroke="#6B7280" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((point) => {
            const y = pointY(point.prediction, 100);
            return y == null ? null : (
              <g key={point.label}>
                <circle cx={point.x} cy={y} r="5" fill="white" stroke="#2563EB" strokeWidth="2.8" />
                <text x={point.x} y="190" textAnchor="middle" fontSize="11" fill="#6B7280">{point.label}</text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

function FactorSection({ risk }) {
  const findriscFactors = factorList(risk);
  const signals = (risk?.supporting_signals || []).map(plainSignal).filter(Boolean);

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className={CARD_CLASS}>
        <div className="text-[18px] font-semibold text-[#111827]">주요 반영 항목</div>
        <div className="mt-1 text-[12px] text-[#6B7280]">영향 요인</div>
        <div className="mt-5 space-y-3">
          {findriscFactors.length > 0 ? findriscFactors.map(([key, value]) => {
            const meta = FINDRISC_FACTORS[key] || { label: key, desc: '' };
            return (
              <div key={key} className="flex items-start justify-between gap-4 rounded-2xl bg-[#F4F6F8] px-5 py-4">
                <div>
                  <div className="text-[14px] font-semibold text-[#111827]">{meta.label}</div>
                  <div className="mt-1 text-[12px] text-[#6B7280]">{meta.desc}</div>
                </div>
                <div className="shrink-0 rounded-full bg-[#FEF3C7] px-3 py-1 text-[12px] font-bold text-[#F59E0B]">+{value}점</div>
              </div>
            );
          }) : (
            <div className="rounded-2xl bg-[#F4F6F8] px-5 py-6 text-[14px] text-[#6B7280]">표시할 요인 부족</div>
          )}
        </div>
      </div>
      <div className={CARD_CLASS}>
        <div className="text-[18px] font-semibold text-[#111827]">최근 신호</div>
        <div className="mt-1 text-[12px] text-[#6B7280]">생활 키워드</div>
        <div className="mt-5 space-y-3">
          {signals.length > 0 ? signals.map((signal) => (
            <div key={signal} className="flex items-start gap-3 rounded-2xl bg-[#FEF3C7] px-5 py-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#F59E0B]" />
              <div className="text-[14px] leading-6 text-[#111827]">{signal}</div>
            </div>
          )) : (
            <div className="rounded-2xl bg-[#F4F6F8] px-5 py-6 text-[14px] text-[#6B7280]">큰 위험 신호 없음</div>
          )}
        </div>
      </div>
    </section>
  );
}

function LifestyleSection({ summary }) {
  const scorecard = summary?.scorecard || {};

  return (
    <section>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[18px] font-semibold text-[#111827]">최근 7일 생활습관</div>
          <div className="mt-1 text-[12px] text-[#6B7280]">기록 · 목표 · 행동</div>
        </div>
        <Link href="/app/report/detail" className={SECONDARY_BUTTON}>
          자세히 보기 <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {HEALTH_CARDS.map((card) => {
          const Icon = card.icon;
          const score = card.scoreKey ? scorecard[card.scoreKey] : null;
          const isReference = !card.scoreKey;
          const pct = clampPct(score);
          const statusKey = isReference ? 'none' : progressStatus(pct);
          const tone = STATUS[statusKey];
          return (
            <div key={card.key} className={`${CARD_CLASS} flex min-h-[260px] flex-col`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F6F8] text-[#111827]">
                    <Icon size={19} />
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold text-[#111827]">{card.title}</div>
                    <div className="mt-1 text-[12px] text-[#6B7280]">{card.target}</div>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${isReference ? 'bg-[#F4F6F8] text-[#6B7280]' : tone.badge}`}>
                  {isReference ? '참고' : tone.label}
                </span>
              </div>
              <div className="mt-5 text-[14px] font-medium text-[#111827]">{card.keyword}</div>
              <div className="mt-auto pt-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex items-end gap-1">
                    <span className="text-[36px] font-bold leading-none text-[#111827]">{score == null ? '-' : score}</span>
                    <span className="pb-1 text-[14px] font-semibold text-[#6B7280]">{card.unit}</span>
                  </div>
                  <div className="text-[14px] font-semibold text-[#6B7280]">목표 대비 {score == null ? '-' : `${pct}%`}</div>
                </div>
                <div className="mt-4 h-3 rounded-full bg-[#E5E7EB]">
                  <div className={`h-full rounded-full ${isReference ? 'bg-[#6B7280]' : progressColor(pct)}`} style={{ width: `${score == null ? 8 : pct}%` }} />
                </div>
                <Link href="/app/chat?new=1" className={`${PRIMARY_BUTTON} mt-5 w-full`}>
                  기록하기
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChallengeSection({ challenges, risk }) {
  const [completed, setCompleted] = useState({});
  const recommended = challenges?.recommended || [];
  const active = challenges?.active || [];
  const actions = risk?.recommended_actions || [];
  const visibleActions = actions.length > 0 ? actions.slice(0, 3) : ['물 섭취 기록', '10분 걷기'];

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className={CARD_CLASS}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[18px] font-semibold text-[#111827]">오늘 우선 액션</div>
            <div className="mt-1 text-[12px] text-[#6B7280]">실행 · 체크</div>
          </div>
          <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">우선순위</span>
        </div>
        <div className="mt-5 space-y-3">
          {visibleActions.map((action, index) => {
            const done = Boolean(completed[action]);
            return (
              <button
                key={action}
                type="button"
                onClick={() => setCompleted((prev) => ({ ...prev, [action]: !prev[action] }))}
                className={`flex w-full items-start gap-3 rounded-2xl px-5 py-4 text-left transition-colors ${
                  done ? 'bg-[#D1FAE5] text-[#111827]' : 'bg-[#F4F6F8] text-[#111827] hover:bg-[#E5E7EB]'
                }`}
              >
                {done ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#10B981]" /> : <Circle size={17} className="mt-0.5 shrink-0 text-[#6B7280]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${index === 0 ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-white text-[#6B7280]'}`}>
                      {index === 0 ? '중요' : '권장'}
                    </span>
                    {done && <span className="text-[11px] font-semibold text-[#10B981]">완료</span>}
                  </div>
                  <div className={`mt-2 text-[14px] leading-6 ${done ? 'line-through decoration-[#10B981]/50' : ''}`}>{action}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className={`${CARD_CLASS} flex min-h-full flex-col`}>
        <div className="text-[18px] font-semibold text-[#111827]">추천 챌린지</div>
        <div className="mt-1 text-[12px] text-[#6B7280]">습관 · 시작</div>
        <div className="mt-5 flex-1 space-y-3">
          {recommended.slice(0, 3).map((item) => {
            const Icon = CHALLENGE_ICON[item.category] || Footprints;
            return (
              <Link
                key={item.template_id}
                href="/app/challenge"
                className="flex items-start gap-3 rounded-2xl bg-[#F4F6F8] px-5 py-4 transition-colors hover:bg-[#E5E7EB]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#111827]">
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[#111827]">{item.name}</div>
                  <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#6B7280]">{item.description}</div>
                </div>
                <ArrowRight size={15} className="mt-1 shrink-0 text-[#6B7280]" />
              </Link>
            );
          })}
          {recommended.length === 0 && active.length > 0 && (
            <div className="rounded-2xl bg-[#F4F6F8] px-5 py-6 text-[14px] text-[#6B7280]">진행 중인 챌린지 우선</div>
          )}
          {recommended.length === 0 && active.length === 0 && (
            <div className="rounded-2xl bg-[#F4F6F8] px-5 py-6 text-[14px] text-[#6B7280]">추천 챌린지 없음</div>
          )}
        </div>
        <Link href="/app/challenge" className={`${PRIMARY_BUTTON} mt-5 w-full`}>
          챌린지 보기 <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function DashboardDetailTabs({ history, summary, challenges, risk }) {
  const [activeTab, setActiveTab] = useState('trend');
  const points = buildTrendPoints(history);
  const predictionPath = linePath(points, 'prediction', 100);
  const officialPath = linePath(points, 'official', 26);
  const scorecard = summary?.scorecard || {};
  const recommended = challenges?.recommended || [];
  const actions = risk?.recommended_actions || [];
  const visibleActions = actions.length > 0 ? actions.slice(0, 3) : ['오늘 기록 채우기', '가벼운 걷기 10분', '물 한 잔 마시기'];
  const challengeItems = recommended.length > 0
    ? recommended.slice(0, 3)
    : [
      { template_id: 'compact-walk', name: '10분 걷기', description: '활동량 채우기', category: 'exercise' },
      { template_id: 'compact-water', name: '물 마시기', description: '수분 기록하기', category: 'hydration' },
      { template_id: 'compact-diet', name: '식사 균형', description: '식습관 점검하기', category: 'diet' },
    ];
  const tabs = [
    { key: 'trend', label: '위험도 추이' },
    { key: 'lifestyle', label: '생활습관' },
    { key: 'challenge', label: '챌린지' },
  ];

  return (
    <section className="shrink-0 rounded-[24px] bg-white p-4 shadow-[0_12px_34px_rgba(37,99,235,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-2xl bg-[#F4F6F8] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === tab.key ? 'bg-[#2563EB] text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link href="/app/report/detail" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563EB]">
          상세 리포트 <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-3 h-[190px] overflow-visible">
        {activeTab === 'trend' && (
          points.length < 2 ? (
            <div className="flex h-full items-center justify-center gap-3 rounded-2xl bg-[#F8FAFC] text-center">
              <LineChart size={22} className="text-[#2563EB]" />
              <div>
                <div className="text-[14px] font-semibold text-[#111827]">아직 데이터가 부족해요</div>
                <div className="mt-1 text-[12px] text-[#6B7280]">7일 이상 기록하면 흐름을 볼 수 있어요</div>
              </div>
            </div>
          ) : (
            <svg width="100%" viewBox="0 0 680 150" role="img" aria-label="위험도 추이 미니 그래프">
              <line x1="42" y1="35" x2="642" y2="35" stroke="#E5E7EB" strokeDasharray="4 4" />
              <line x1="42" y1="78" x2="642" y2="78" stroke="#E5E7EB" strokeDasharray="4 4" />
              <line x1="42" y1="122" x2="642" y2="122" stroke="#E5E7EB" />
              {predictionPath && <path d={predictionPath.replaceAll('154', '122')} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
              {officialPath && <path d={officialPath.replaceAll('154', '122')} fill="none" stroke="#6B7280" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />}
              {points.map((point) => {
                const y = pointY(point.prediction, 100);
                return y == null ? null : (
                  <g key={point.label}>
                    <circle cx={point.x} cy={Math.max(24, y - 32)} r="4.5" fill="white" stroke="#2563EB" strokeWidth="2.5" />
                    <text x={point.x} y="142" textAnchor="middle" fontSize="11" fill="#6B7280">{point.label}</text>
                  </g>
                );
              })}
            </svg>
          )
        )}

        {activeTab === 'lifestyle' && (
          <div className="grid h-full gap-3 md:grid-cols-4">
            {HEALTH_CARDS.map((card) => {
              const Icon = card.icon;
              const score = card.scoreKey ? scorecard[card.scoreKey] : null;
              const pct = clampPct(score);
              const statusKey = card.scoreKey ? progressStatus(pct) : 'none';
              return (
                <Link key={card.key} href="/app/chat?new=1" className="rounded-2xl bg-[#F8FAFC] p-4 transition-colors hover:bg-[#EFF6FF]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-[#2563EB]" />
                      <span className="text-[13px] font-semibold text-[#111827]">{card.title}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[statusKey].badge}`}>{card.scoreKey ? STATUS[statusKey].label : '기록'}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div className="text-[28px] font-bold leading-none text-[#111827]">{score == null ? '-' : score}</div>
                    <div className="text-[12px] font-semibold text-[#6B7280]">{card.scoreKey ? `${pct}%` : '참고'}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#E5E7EB]">
                    <div className={`h-full rounded-full ${card.scoreKey ? progressColor(pct) : 'bg-[#6B7280]'}`} style={{ width: `${score == null ? 12 : pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {activeTab === 'challenge' && (
          <div className="grid h-full gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              {visibleActions.map((action, index) => (
                <div key={action} className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] px-4 py-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${index === 0 ? 'bg-[#2563EB]' : 'bg-[#9CA3AF]'}`}>
                    {index + 1}
                  </span>
                  <span className="line-clamp-2 text-[13px] font-semibold leading-5 text-[#111827]">{action}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              {challengeItems.map((item) => {
                const Icon = CHALLENGE_ICON[item.category] || Footprints;
                return (
                  <Link key={item.template_id ?? item.name} href="/app/challenge" className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] px-4 py-3 transition-colors hover:bg-[#EFF6FF]">
                    <Icon size={16} className="shrink-0 text-[#2563EB]" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[13px] font-semibold text-[#111827]">{item.name}</div>
                      <div className="line-clamp-2 text-[11px] leading-4 text-[#6B7280]">{item.description}</div>
                    </div>
                    <ArrowRight size={13} className="shrink-0 text-[#9CA3AF]" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DashboardOneScreen({ risk, history, summary, challenges, userData, statusData }) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <SummarySection risk={risk} history={history} summary={summary} challenges={challenges} userData={userData} statusData={statusData} />
      </div>
    </section>
  );
}

export default function ReportPage() {
  const [status, setStatus] = useState(null);
  const [risk, setRisk] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [challenges, setChallenges] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');
      let currentUserId = null;
      try {
        const userRes = await api('/api/v1/users/me');
        if (userRes.ok) {
          const meData = await userRes.json();
          currentUserId = meData?.id ?? null;
          if (!cancelled) setUserData(meData);
        }
      } catch {}

      const cached = readReportCache(currentUserId);
      if (cached) {
        setStatus(cached.status);
        setRisk(cached.risk);
        setHistory(cached.history || []);
        setSummary(cached.summary);
        setChallenges(cached.challenges);
        setLoaded(true);
      }

      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
        const statusData = await statusRes.json();
        if (cancelled) return;
        setStatus(statusData);

        if (!statusData.is_completed) {
          writeReportCache(currentUserId, { status: statusData, risk: null, history: [], summary: null, challenges: null });
          return;
        }

        const [riskRes, historyRes, summaryRes, challengesRes] = await Promise.all([
          api('/api/v1/risk/current'),
          api('/api/v1/risk/history?weeks=7'),
          api('/api/v1/analysis/summary?period=7'),
          api('/api/v1/challenges/overview'),
        ]);
        if (cancelled) return;

        const nextRisk = riskRes.ok ? await riskRes.json() : null;
        const historyJson = historyRes.ok ? await historyRes.json() : {};
        const nextSummary = summaryRes.ok ? await summaryRes.json() : null;
        const nextChallenges = challengesRes.ok ? await challengesRes.json() : null;

        setRisk(nextRisk);
        setHistory(historyJson.history || []);
        setSummary(nextSummary);
        setChallenges(nextChallenges);
        writeReportCache(currentUserId, {
          status: statusData,
          risk: nextRisk,
          history: historyJson.history || [],
          summary: nextSummary,
          challenges: nextChallenges,
        });
      } catch (err) {
        console.error('report_dashboard_load_failed', err);
        if (!cancelled) setError('리포트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => clearReportCache();
    window.addEventListener('danaa:report-cache-refresh', handler);
    return () => window.removeEventListener('danaa:report-cache-refresh', handler);
  }, []);

  const hasOnboarding = Boolean(status?.is_completed);

  if (!loaded) {
    return (
      <div className="theme-report-page flex h-full flex-col bg-[#F4F6F8]">
        <header className="flex h-12 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
          <span className="text-[14px] font-medium text-[#111827]">리포트</span>
        </header>
        <ReportTabs />
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="theme-report-page flex h-full flex-col bg-[#F5F7FA]">
      <header className="flex h-12 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
        <span className="text-[14px] font-medium text-[#111827]">리포트</span>
      </header>
      <ReportTabs />

      <div className="flex-1 overflow-hidden px-3 py-2">
        <main className="mx-auto flex h-full max-w-[1360px] flex-col gap-2">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl bg-[#FEE2E2] px-4 py-3 text-[14px] text-[#EF4444] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {!hasOnboarding ? (
            <section className={CARD_CLASS}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F6F8] text-[#6B7280]">
                <Sparkles size={20} />
              </div>
              <div className="mt-5 text-[18px] font-semibold text-[#111827]">건강 설문 필요</div>
              <div className="mt-2 text-[14px] leading-6 text-[#6B7280]">위험도 · 생활습관 · 챌린지</div>
              <Link href="/onboarding/diabetes" className={`${PRIMARY_BUTTON} mt-6`}>
                설문 시작하기 <ArrowRight size={14} />
              </Link>
            </section>
          ) : (
            <DashboardOneScreen risk={risk} history={history} summary={summary} challenges={challenges} userData={userData} statusData={status} />
          )}
        </main>
      </div>
    </div>
  );
}
