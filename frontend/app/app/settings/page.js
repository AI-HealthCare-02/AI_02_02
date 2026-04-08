'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
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
        <span className="text-[13px] font-medium text-nature-900">설정</span>
      </header>

      {/* 설정 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-[720px] mx-auto">

          {/* ── 프로필 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[13px] font-semibold text-nature-900">👤 프로필</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[12px] font-medium text-nature-900">그룹 분류</div>
                  <div className="text-[11px] text-neutral-300 mt-0.5">설문 기반 자동 분류</div>
                </div>
                <div className="text-[12px] text-neutral-400">B. 주의형</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[12px] font-medium text-nature-900">성별 / 연령대</div>
                <div className="text-[12px] text-neutral-400">남성 / 40대</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[12px] font-medium text-nature-900">BMI</div>
                <div className="text-[12px] text-neutral-400">24.2</div>
              </div>
            </div>
          </div>

          {/* ── 알림 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[13px] font-semibold text-nature-900">🔔 알림</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[12px] font-medium text-nature-900">챌린지 리마인더</div>
                  <div className="text-[11px] text-neutral-300 mt-0.5">매일 오후 9시 챌린지 확인 알림</div>
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
                  <div className="text-[12px] font-medium text-nature-900">주간 리포트</div>
                  <div className="text-[11px] text-neutral-300 mt-0.5">매주 일요일 건강 분석 요약</div>
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
                    <span className="text-[12px] font-medium text-nature-900">위험도 변화 알림</span>
                    <span className="text-[10px] text-neutral-300 bg-cream-300 px-1.5 py-0.5 rounded">준비 중</span>
                  </div>
                  <div className="text-[11px] text-neutral-300 mt-0.5">위험도 점수가 3점 이상 변동 시 알림</div>
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
              <h3 className="text-[13px] font-semibold text-nature-900">💾 데이터</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[12px] font-medium text-nature-900">건강 데이터 수집 동의</div>
                  <div className="text-[11px] text-neutral-300 mt-0.5">AI 응답 기반 건강 데이터 수집 허용</div>
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
              <h3 className="text-[13px] font-semibold text-nature-900">🔐 계정</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream-300 transition-colors">
                <div className="text-[12px] font-medium text-nature-900">비밀번호 변경</div>
                <span className="text-[12px] text-neutral-400">변경 ›</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream-300 transition-colors">
                <div className="text-[12px] font-medium text-nature-900">로그아웃</div>
                <span className="text-[12px] text-red-600">로그아웃 →</span>
              </div>
            </div>
          </div>

          {/* ── 약관 및 정책 ── */}
          <div className="bg-white shadow-soft rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-black/[.04]">
              <h3 className="text-[13px] font-semibold text-nature-900">📁 약관 및 정책</h3>
            </div>
            <div className="divide-y divide-black/[.04]">
              {[
                { label: '개인정보처리방침', href: '#' },
                { label: '이용약관', href: '#' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between px-4 py-3 hover:bg-cream-300 transition-colors"
                >
                  <div className="text-[12px] font-medium text-nature-900">{item.label}</div>
                  <span className="text-[12px] text-neutral-400">보기 ›</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
