'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User as UserIcon, Bell, Database, Lock, FileText, Check } from 'lucide-react';
import { api } from '../../../hooks/useApi';

const TERMS_TEXT = `다나아 서비스 이용약관\n\n제1조 (목적) 이 약관은 다나아 서비스의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무를 규정합니다.\n\n제2조 (서비스 내용) 다나아는 AI 기반 건강 생활습관 코칭 서비스를 제공합니다.\n\n제3조 (개인정보) 서비스 이용을 위해 수집되는 개인정보는 건강 기록, 생활습관 데이터에 한정되며, 관련 법률에 따라 보호됩니다.\n\n제4조 (면책) 다나아는 의료 진단 서비스가 아니며, 제공되는 정보는 참고용입니다.`;
const PRIVACY_TEXT = `다나아 개인정보 처리방침\n\n1. 수집하는 개인정보: 이메일, 성별, 연령대, 건강 기록(수면/식사/운동/수분), 당뇨 위험도 점수\n\n2. 수집 목적: AI 건강 코칭 서비스 제공, 맞춤 리포트 생성\n\n3. 보관 기간: 회원 탈퇴 시까지 (탈퇴 후 30일 이내 파기)\n\n4. 제3자 제공: 동의 없이 외부에 제공하지 않습니다.\n\n5. 이용자 권리: 열람, 수정, 삭제, 동의 철회를 언제든 요청할 수 있습니다.`;

/** 전화번호 자동 포맷 */
function formatPhone(val) {
  const nums = val.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
}

/** 토글 스위치 컴포넌트 */
function Toggle({ value, onChange, disabled = false }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-[42px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 ${
        disabled ? 'bg-cream-500 opacity-50 cursor-not-allowed'
          : value ? 'bg-nature-500' : 'bg-cream-500'
      }`}
    >
      <div className={`w-[20px] h-[20px] bg-white rounded-full shadow absolute top-[2px] transition-all duration-200 ${
        value ? 'left-[20px]' : 'left-[2px]'
      }`} />
    </button>
  );
}

export default function SettingsPage() {
  const [modal, setModal] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // 프로필 (읽기 전용 — 온보딩 기반)
  const [profileInfo, setProfileInfo] = useState({ group: '—', bmi: '—' });

  // 프로필 수정 폼
  // 백엔드 연동: GET /api/v1/users/me → 폼 채우기
  // 백엔드 연동: PATCH /api/v1/users/me → 저장
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    birthday: '',
    gender: '',
    phone_number: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null); // { type: 'success' | 'error', text: '' }

  // 알림 설정
  // 백엔드 연동: GET /api/v1/settings → 토글 상태
  // 백엔드 연동: PATCH /api/v1/settings → 변경
  const [notifications, setNotifications] = useState({
    chat_notification: true,
    challenge_reminder: true,
    weekly_report: true,
  });

  // 건강 데이터 수집 동의
  const [dataConsent, setDataConsent] = useState(true);

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    async function loadData() {
      // 1. 프로필 정보 (API 우선, fallback localStorage)
      try {
        const res = await api('/api/v1/users/me');
        if (res.ok) {
          const user = await res.json();
          setUserForm({
            name: user.name || '',
            email: user.email || '',
            birthday: user.birthday || '',
            gender: user.gender || '',
            phone_number: user.phone_number ? formatPhone(user.phone_number) : '',
          });
        } else {
          throw new Error('API unavailable');
        }
      } catch {
        // localStorage fallback
        try {
          const ob = localStorage.getItem('danaa_onboarding');
          if (ob) {
            const data = JSON.parse(ob);
            setUserForm(prev => ({
              ...prev,
              name: data.name || '',
              gender: data.gender === '남성' ? 'MALE' : data.gender === '여성' ? 'FEMALE' : '',
            }));
          }
        } catch {}
      }

      // 2. 설정 (API 우선, fallback 기본값)
      try {
        const res = await api('/api/v1/settings');
        if (res.ok) {
          const settings = await res.json();
          setNotifications({
            chat_notification: settings.chat_notification ?? true,
            challenge_reminder: settings.challenge_reminder ?? true,
            weekly_report: settings.weekly_report ?? true,
          });
        }
      } catch {}

      // 3. 온보딩 기반 프로필 정보 (그룹, BMI)
      try {
        const rk = localStorage.getItem('danaa_risk');
        const ob = localStorage.getItem('danaa_onboarding');
        if (rk) {
          const risk = JSON.parse(rk);
          setProfileInfo(prev => ({ ...prev, group: `${risk.group || ''}. ${risk.groupLabel || ''}` }));
        }
        if (ob) {
          const data = JSON.parse(ob);
          const height = data.height || 170;
          const weight = data.weight || 70;
          const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
          setProfileInfo(prev => ({ ...prev, bmi }));
        }
      } catch {}

      setLoaded(true);
    }
    loadData();
  }, []);

  // ── 프로필 저장 ──
  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    setProfileMsg(null);

    try {
      const body = {
        name: userForm.name || undefined,
        birthday: userForm.birthday || undefined,
        gender: userForm.gender || undefined,
        phone_number: userForm.phone_number?.replace(/\D/g, '') || undefined,
      };

      const res = await api('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setProfileMsg({ type: 'success', text: '프로필이 저장되었습니다.' });
      } else {
        const err = await res.json().catch(() => ({}));
        setProfileMsg({ type: 'error', text: err.detail || '저장에 실패했습니다.' });
      }
    } catch {
      setProfileMsg({ type: 'error', text: '서버에 연결할 수 없습니다. 나중에 다시 시도해주세요.' });
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(null), 3000);
    }
  }, [userForm]);

  // ── 알림 토글 변경 ──
  const toggleNotification = useCallback(async (key, newValue) => {
    // 즉시 UI 반영
    setNotifications(prev => ({ ...prev, [key]: newValue }));

    // API 호출 (백엔드 연결 시 자동 저장, 미연결 시 로컬만 반영)
    try {
      const res = await api('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: newValue }),
      });
      // 서버 응답이 실패면 롤백
      if (!res.ok) {
        setNotifications(prev => ({ ...prev, [key]: !newValue }));
      }
    } catch {
      // 네트워크 에러 (백엔드 미연결) — 로컬 상태 유지, 롤백 안 함
    }
  }, []);

  // ── 로딩 스켈레톤 ──
  if (!loaded) return (
    <>
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">설정</span>
      </header>
      <div className="flex-1 px-6 py-6">
        <div className="max-w-[720px] mx-auto space-y-4 animate-pulse">
          <div className="bg-cream-300 rounded-lg p-6 space-y-3">
            <div className="h-4 bg-cream-400 rounded w-1/4"></div>
            <div className="h-10 bg-cream-400 rounded w-full"></div>
            <div className="h-10 bg-cream-400 rounded w-full"></div>
          </div>
          <div className="bg-cream-300 rounded-lg p-6 space-y-3">
            <div className="h-4 bg-cream-400 rounded w-1/4"></div>
            <div className="h-8 bg-cream-400 rounded w-full"></div>
            <div className="h-8 bg-cream-400 rounded w-full"></div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">설정</span>
      </header>

      {/* 설정 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[720px] mx-auto">

          {/* ── 프로필 (읽기 전용) ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[14px] font-semibold text-nature-900 flex items-center gap-1.5"><UserIcon size={16} /> 프로필</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">그룹 분류</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">설문 기반 자동 분류</div>
                </div>
                <div className="text-[13px] text-neutral-400">{profileInfo.group}</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[13px] font-medium text-nature-900">BMI</div>
                <div className="text-[13px] text-neutral-400">{profileInfo.bmi}</div>
              </div>
            </div>
          </div>

          {/* ── 내 정보 수정 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[14px] font-semibold text-nature-900 flex items-center gap-1.5"><UserIcon size={16} /> 내 정보</h3>
            </div>
            <div className="px-4 py-4 space-y-3">
              {/* 이름 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-neutral-400 mb-1 block">이름</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    maxLength={20}
                    placeholder="홍길동"
                    className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-neutral-400 mb-1 block">이메일</label>
                  <input
                    type="email"
                    value={userForm.email}
                    disabled
                    className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none bg-cream-300 text-neutral-400"
                  />
                </div>
              </div>

              {/* 생년월일 + 성별 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-neutral-400 mb-1 block">생년월일</label>
                  <input
                    type="date"
                    value={userForm.birthday}
                    onChange={(e) => setUserForm(prev => ({ ...prev, birthday: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-neutral-400 mb-1 block">성별</label>
                  <select
                    value={userForm.gender}
                    onChange={(e) => setUserForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 transition-colors bg-white"
                  >
                    <option value="">선택</option>
                    <option value="MALE">남성</option>
                    <option value="FEMALE">여성</option>
                  </select>
                </div>
              </div>

              {/* 전화번호 */}
              <div>
                <label className="text-[12px] text-neutral-400 mb-1 block">전화번호</label>
                <input
                  type="tel"
                  value={userForm.phone_number}
                  onChange={(e) => setUserForm(prev => ({ ...prev, phone_number: formatPhone(e.target.value) }))}
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 transition-colors"
                />
              </div>

              {/* 저장 버튼 + 메시지 */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="px-5 py-2 bg-nature-500 text-white text-[13px] font-medium rounded-lg hover:bg-nature-600 transition-colors disabled:opacity-50"
                >
                  {profileSaving ? '저장 중...' : '프로필 저장'}
                </button>
                {profileMsg && (
                  <span className={`text-[12px] flex items-center gap-1 ${
                    profileMsg.type === 'success' ? 'text-success' : 'text-danger'
                  }`}>
                    {profileMsg.type === 'success' && <Check size={14} />}
                    {profileMsg.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 알림 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[14px] font-semibold text-nature-900 flex items-center gap-1.5"><Bell size={16} /> 알림</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">채팅 알림</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">AI 채팅에서 건강 질문 노출</div>
                </div>
                <Toggle value={notifications.chat_notification} onChange={(v) => toggleNotification('chat_notification', v)} />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">챌린지 리마인더</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">매일 오후 9시 챌린지 확인 알림</div>
                </div>
                <Toggle value={notifications.challenge_reminder} onChange={(v) => toggleNotification('challenge_reminder', v)} />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">주간 리포트</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">매주 일요일 건강 분석 요약</div>
                </div>
                <Toggle value={notifications.weekly_report} onChange={(v) => toggleNotification('weekly_report', v)} />
              </div>
            </div>
          </div>

          {/* ── 데이터 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[14px] font-semibold text-nature-900 flex items-center gap-1.5"><Database size={16} /> 데이터</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">건강 데이터 수집 동의</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">AI 응답 기반 건강 데이터 수집 허용</div>
                </div>
                <Toggle value={dataConsent} onChange={(v) => setDataConsent(v)} />
              </div>
            </div>
          </div>

          {/* ── 계정 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[14px] font-semibold text-nature-900 flex items-center gap-1.5"><Lock size={16} /> 계정</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <button
                onClick={() => setModal('password')}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream-300 transition-colors"
              >
                <div className="text-[13px] font-medium text-nature-900">비밀번호 변경</div>
                <span className="text-[13px] text-neutral-400">변경 ›</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('정말 로그아웃 하시겠어요?')) {
                    localStorage.removeItem('danaa_token');
                    localStorage.removeItem('danaa_onboarding');
                    localStorage.removeItem('danaa_risk');
                    localStorage.removeItem('danaa_tutorial_done');
                    localStorage.removeItem('danaa_challenges');
                    localStorage.removeItem('danaa_conversations');
                    window.location.href = '/login';
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream-300 transition-colors"
              >
                <div className="text-[13px] font-medium text-nature-900">로그아웃</div>
                <span className="text-[13px] text-danger">로그아웃 →</span>
              </button>
            </div>
          </div>

          {/* ── 약관 및 정책 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[14px] font-semibold text-nature-900 flex items-center gap-1.5"><FileText size={16} /> 약관 및 정책</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              {[
                { label: '개인정보처리방침', key: 'privacy' },
                { label: '이용약관', key: 'terms' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setModal(item.key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream-300 transition-colors"
                >
                  <div className="text-[13px] font-medium text-nature-900">{item.label}</div>
                  <span className="text-[13px] text-neutral-400">보기 ›</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* 모달 (약관/정책) */}
      {modal && modal !== 'password' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl max-w-[480px] w-full max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-cream-500 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-nature-900">
                {modal === 'terms' ? '이용약관' : '개인정보 처리방침'}
              </h3>
              <button onClick={() => setModal(null)} className="text-neutral-400 hover:text-nature-900 text-[18px]">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-[13px] text-neutral-600 leading-[1.8] whitespace-pre-wrap font-[inherit]">
                {modal === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-cream-500">
              <button onClick={() => setModal(null)} className="w-full py-2.5 bg-nature-500 text-white rounded-lg text-[14px] font-medium hover:bg-nature-600 transition-colors">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {modal === 'password' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl max-w-[400px] w-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-cream-500 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-nature-900">비밀번호 변경</h3>
              <button onClick={() => setModal(null)} className="text-neutral-400 hover:text-nature-900 text-[18px]">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <div className="text-[12px] text-neutral-400 mb-1">현재 비밀번호</div>
                <input type="password" placeholder="현재 비밀번호 입력" className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 bg-white" />
              </div>
              <div>
                <div className="text-[12px] text-neutral-400 mb-1">새 비밀번호</div>
                <input type="password" placeholder="새 비밀번호 입력" className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 bg-white" />
              </div>
              <div>
                <div className="text-[12px] text-neutral-400 mb-1">새 비밀번호 확인</div>
                <input type="password" placeholder="새 비밀번호 다시 입력" className="w-full px-3 py-2.5 border border-cream-500 rounded-lg text-[14px] outline-none focus:border-nature-500 bg-white" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-cream-500 flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-cream-500 rounded-lg text-[14px] text-neutral-400 hover:bg-cream-300 transition-colors">취소</button>
              <button onClick={() => { alert('백엔드 연동 후 비밀번호 변경이 가능합니다.'); setModal(null); }} className="flex-1 py-2.5 bg-nature-500 text-white rounded-lg text-[14px] font-medium hover:bg-nature-600 transition-colors">변경하기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
