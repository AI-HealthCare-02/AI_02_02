'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { User as UserIcon, Bell, Database, Lock, FileText } from 'lucide-react';

const TERMS_TEXT = `다나아 서비스 이용약관\n\n제1조 (목적) 이 약관은 다나아 서비스의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무를 규정합니다.\n\n제2조 (서비스 내용) 다나아는 AI 기반 건강 생활습관 코칭 서비스를 제공합니다.\n\n제3조 (개인정보) 서비스 이용을 위해 수집되는 개인정보는 건강 기록, 생활습관 데이터에 한정되며, 관련 법률에 따라 보호됩니다.\n\n제4조 (면책) 다나아는 의료 진단 서비스가 아니며, 제공되는 정보는 참고용입니다.`;
const PRIVACY_TEXT = `다나아 개인정보 처리방침\n\n1. 수집하는 개인정보: 이메일, 성별, 연령대, 건강 기록(수면/식사/운동/수분), 당뇨 위험도 점수\n\n2. 수집 목적: AI 건강 코칭 서비스 제공, 맞춤 리포트 생성\n\n3. 보관 기간: 회원 탈퇴 시까지 (탈퇴 후 30일 이내 파기)\n\n4. 제3자 제공: 동의 없이 외부에 제공하지 않습니다.\n\n5. 이용자 권리: 열람, 수정, 삭제, 동의 철회를 언제든 요청할 수 있습니다.`;

export default function SettingsPage() {
  const [modal, setModal] = useState(null); // 'terms' | 'privacy' | 'password' | null
  const [profile, setProfile] = useState({ group: '—', gender: '—', age: '—', bmi: '—' });

  useEffect(() => {
    try {
      const rk = localStorage.getItem('danaa_risk');
      const ob = localStorage.getItem('danaa_onboarding');
      if (rk) {
        const risk = JSON.parse(rk);
        setProfile(prev => ({ ...prev, group: `${risk.group || ''}. ${risk.groupLabel || ''}` }));
      }
      if (ob) {
        const data = JSON.parse(ob);
        const gender = data.gender || '—';
        const age = data.age || '—';
        const height = data.height || 170;
        const weight = data.weight || 70;
        const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
        setProfile(prev => ({ ...prev, gender: `${gender} / ${age}`, bmi }));
      }
    } catch {}
  }, []);

  const [notifications, setNotifications] = useState({
    challengeReminder: true,
    weeklyReport: true,
    riskChange: false,
  });
  const [dataConsent, setDataConsent] = useState(true);

  const toggleNotification = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {/* 헤더 */}
      <header className="h-12 bg-white/90 backdrop-blur-xl border-b border-black/[.04] px-4 flex items-center shrink-0">
        <span className="text-[14px] font-medium text-nature-900">설정</span>
      </header>

      {/* 설정 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[720px] mx-auto">

          {/* ── 프로필 ── */}
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
                <div className="text-[13px] text-neutral-400">{profile.group}</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[13px] font-medium text-nature-900">성별 / 연령대</div>
                <div className="text-[13px] text-neutral-400">{profile.gender}</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[13px] font-medium text-nature-900">BMI</div>
                <div className="text-[13px] text-neutral-400">{profile.bmi}</div>
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
                  <div className="text-[13px] font-medium text-nature-900">챌린지 리마인더</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">매일 오후 9시 챌린지 확인 알림</div>
                </div>
                <button
                  onClick={() => toggleNotification('challengeReminder')}
                  className={`w-[42px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 ${
                    notifications.challengeReminder ? 'bg-nature-500' : 'bg-cream-500'
                  }`}
                >
                  <div className={`w-[20px] h-[20px] bg-white rounded-full shadow absolute top-[2px] transition-all duration-200 ${
                    notifications.challengeReminder ? 'left-[20px]' : 'left-[2px]'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-nature-900">주간 리포트</div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">매주 일요일 건강 분석 요약</div>
                </div>
                <button
                  onClick={() => toggleNotification('weeklyReport')}
                  className={`w-[42px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 ${
                    notifications.weeklyReport ? 'bg-nature-500' : 'bg-cream-500'
                  }`}
                >
                  <div className={`w-[20px] h-[20px] bg-white rounded-full shadow absolute top-[2px] transition-all duration-200 ${
                    notifications.weeklyReport ? 'left-[20px]' : 'left-[2px]'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-nature-900">위험도 변화 알림</span>
                    <span className="text-[11px] text-neutral-300 bg-cream-300 px-1.5 py-0.5 rounded">준비 중</span>
                  </div>
                  <div className="text-[12px] text-neutral-300 mt-0.5">위험도 점수가 3점 이상 변동 시 알림</div>
                </div>
                <button
                  disabled
                  className="w-[42px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 bg-cream-500 opacity-50 cursor-not-allowed"
                >
                  <div className="w-[20px] h-[20px] bg-white rounded-full shadow absolute top-[2px] left-[2px]" />
                </button>
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
                <button
                  onClick={() => setDataConsent(!dataConsent)}
                  className={`w-[42px] h-[24px] rounded-full relative transition-colors duration-200 shrink-0 ${
                    dataConsent ? 'bg-nature-500' : 'bg-cream-500'
                  }`}
                >
                  <div className={`w-[20px] h-[20px] bg-white rounded-full shadow absolute top-[2px] transition-all duration-200 ${
                    dataConsent ? 'left-[20px]' : 'left-[2px]'
                  }`} />
                </button>
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
                    localStorage.removeItem('danaa_onboarding');
                    localStorage.removeItem('danaa_risk');
                    localStorage.removeItem('danaa_tutorial_done');
                    localStorage.removeItem('danaa_challenges');
                    window.location.href = '/';
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream-300 transition-colors"
              >
                <div className="text-[13px] font-medium text-nature-900">로그아웃</div>
                <span className="text-[13px] text-red-600">로그아웃 →</span>
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

      {/* 모달 (약관/정책/비밀번호) */}
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
