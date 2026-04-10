'use client';

import Link from 'next/link';
import { ArrowRight, Users, Globe, Smile, Award, BarChart3, FileText, Heart, Building2, UserCheck, Trophy, Zap, ChevronRight } from 'lucide-react';

/* ─────────────────────────────────────────────
   DANAA Landing Page  (Figma-faithful)
   Primary: nature-500 (from tailwind.config.js)
   Font: Inter (default Tailwind sans)
   Desktop width: ~1200px  |  Mobile: fluid
   ───────────────────────────────────────────── */

export default function DanaaLandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#263238]">

      {/* ══════════════════════════════════════
          NAVBAR
         ══════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] h-[60px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5">
            <div className="w-[33px] h-[33px] rounded-full bg-nature-500 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-[20px] font-bold text-[#263238]">
              DANAA
            </span>
          </Link>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-[14px] text-[#18191F] hover:text-nature-500 transition-colors">홈</a>
            <a href="#features" className="text-[14px] text-[#18191F] hover:text-nature-500 transition-colors">기능</a>
            <a href="#community" className="text-[14px] text-[#18191F] hover:text-nature-500 transition-colors">소개</a>
            <a href="#blog" className="text-[14px] text-[#18191F] hover:text-nature-500 transition-colors">블로그</a>
            <a href="#pricing" className="text-[14px] text-[#18191F] hover:text-nature-500 transition-colors">요금</a>
          </nav>

          {/* CTA */}
          <Link
            href="/login"
            className="hidden md:inline-flex px-5 py-2.5 bg-nature-500 text-white text-[14px] font-medium rounded-[4px] hover:bg-nature-600 transition-colors"
          >
            시작하기 &rarr;
          </Link>

          {/* Mobile hamburger */}
          <button className="md:hidden flex flex-col gap-1.5">
            <span className="w-6 h-0.5 bg-[#263238]" />
            <span className="w-6 h-0.5 bg-[#263238]" />
            <span className="w-6 h-0.5 bg-[#263238]" />
          </button>
        </div>
      </header>


      {/* ══════════════════════════════════════
          HERO SECTION
         ══════════════════════════════════════ */}
      <section id="home" className="bg-[#F5F7FA]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] py-16 md:py-24 flex flex-col md:flex-row items-center gap-12">
          {/* Left text */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-[36px] md:text-[48px] lg:text-[54px] font-semibold leading-[1.15] text-[#4D4D4D] mb-4">
              AI와 함께하는{' '}
              <span className="text-nature-500">건강 생활습관 코칭</span>
            </h1>
            <p className="text-[14px] md:text-[16px] text-[#717171] leading-relaxed mb-8">
              당뇨 위험도 예측부터 매일 건강 기록까지, 다나아가 당신의 건강을 함께 관리합니다.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-nature-500 text-white text-[14px] font-medium rounded-[4px] hover:bg-nature-600 transition-colors"
            >
              무료로 시작하기
            </Link>
          </div>
          {/* Right illustration placeholder */}
          <div className="flex-1 flex justify-center">
            <div className="w-[320px] h-[300px] bg-nature-50 rounded-lg flex items-center justify-center text-nature-500/60 text-[14px] font-medium">
              [Hero Illustration]
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          CLIENTS SECTION
         ══════════════════════════════════════ */}
      <section className="py-10 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] text-center">
          <h2 className="text-[24px] md:text-[30px] font-semibold text-[#4D4D4D] mb-2">
            파트너
          </h2>
          <p className="text-[14px] md:text-[16px] text-[#717171] mb-8">
            다나아와 함께하는 기관들
          </p>
          {/* Client logos row */}
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14">
            {['Logo 1', 'Logo 2', 'Logo 3', 'Logo 4', 'Logo 5', 'Logo 6', 'Logo 7'].map((logo, i) => (
              <div
                key={i}
                className="w-[48px] h-[48px] bg-gray-200 rounded-md flex items-center justify-center text-[10px] text-gray-400"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          COMMUNITY MANAGEMENT SECTION
         ══════════════════════════════════════ */}
      <section id="community" className="py-12 md:py-16 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] text-center">
          <h2 className="text-[24px] md:text-[36px] font-semibold text-[#4D4D4D] mb-2">
            하나의 플랫폼에서 건강을<br className="hidden md:block" /> 관리하세요
          </h2>
          <p className="text-[14px] md:text-[16px] text-[#717171] mb-12">
            다나아는 이런 분들에게 적합해요
          </p>

          {/* 3-column cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Users size={28} className="text-nature-500" />,
                title: '당뇨 위험군',
                desc: 'FINDRISC 8변수 기반으로 위험도를 분석하고, 맞춤 관리 방향을 제시합니다.',
              },
              {
                icon: <Globe size={28} className="text-nature-500" />,
                title: '건강 관심자',
                desc: '매일 수면, 식사, 운동, 수분을 기록하면 AI가 주간 리포트를 제공합니다.',
              },
              {
                icon: <UserCheck size={28} className="text-nature-500" />,
                title: '생활습관 개선',
                desc: '7가지 미니 챌린지로 건강 습관을 만들고 스트릭을 쌓아보세요.',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-8 flex flex-col items-center text-center hover:shadow-lg transition-shadow"
              >
                <div className="w-[65px] h-[65px] bg-nature-50 rounded-full flex items-center justify-center mb-4 relative">
                  <div className="absolute -bottom-1 -right-1 w-[50px] h-[50px] bg-nature-500/10 rounded-full" />
                  {card.icon}
                </div>
                <h3 className="text-[20px] font-semibold text-[#4D4D4D] whitespace-pre-line leading-snug mb-2">
                  {card.title}
                </h3>
                <p className="text-[14px] text-[#717171] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          FEATURE SECTION 1 — Unlock (left image, right text)
         ══════════════════════════════════════ */}
      <section id="features" className="py-12 md:py-16 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] flex flex-col md:flex-row items-center gap-12">
          {/* Left illustration */}
          <div className="flex-1 flex justify-center">
            <div className="w-[320px] h-[300px] bg-nature-50 rounded-lg flex items-center justify-center text-nature-500/60 text-[14px] font-medium">
              [Mobile Login Illustration]
            </div>
          </div>
          {/* Right text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-[24px] md:text-[36px] font-semibold text-[#4D4D4D] leading-tight mb-4">
              AI가 매일 건강을 체크해요
            </h2>
            <p className="text-[14px] md:text-[16px] text-[#717171] leading-relaxed mb-6">
              대화하다 보면 AI가 자연스럽게 생활 습관을 물어봐요. 답변을 잘 해주실수록 맞춤 리포트의 정확도가 올라갑니다.
            </p>
            <Link
              href="#"
              className="inline-flex items-center gap-2 px-6 py-3 bg-nature-500 text-white text-[14px] font-medium rounded-[4px] hover:bg-nature-600 transition-colors"
            >
              자세히 보기
            </Link>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          STATS / ACHIEVEMENTS SECTION
         ══════════════════════════════════════ */}
      <section id="stats" className="py-12 md:py-16 bg-[#F5F7FA]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] flex flex-col md:flex-row items-center gap-12">
          {/* Left text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-[24px] md:text-[36px] font-semibold text-[#4D4D4D] leading-tight mb-4">
              다나아와 함께{' '}
              <span className="text-nature-500">건강을 관리하세요</span>
            </h2>
            <p className="text-[14px] text-[#717171]">
              다나아가 제공하는 서비스 현황
            </p>
          </div>

          {/* Right stats grid */}
          <div className="flex-1 grid grid-cols-2 gap-x-10 gap-y-8">
            {[
              { icon: <Users size={24} className="text-nature-500" />, number: '16단계', label: '맞춤 온보딩 설문' },
              { icon: <Building2 size={24} className="text-nature-500" />, number: '7개', label: '생활습관 챌린지' },
              { icon: <FileText size={24} className="text-nature-500" />, number: '5단계', label: '위험도 분석' },
              { icon: <BarChart3 size={24} className="text-nature-500" />, number: '24시간', label: 'AI 건강 코칭' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-[48px] h-[48px] bg-nature-50 rounded-full flex items-center justify-center flex-shrink-0">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[20px] md:text-[24px] font-bold text-[#4D4D4D]">{stat.number}</p>
                  <p className="text-[14px] text-[#717171]">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          FEATURE SECTION 2 — Calendar (left image, right text)
         ══════════════════════════════════════ */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] flex flex-col md:flex-row items-center gap-12">
          {/* Left illustration */}
          <div className="flex-1 flex justify-center">
            <div className="w-[320px] h-[300px] bg-nature-50 rounded-lg flex items-center justify-center text-nature-500/60 text-[14px] font-medium">
              [Calendar / Sign-up Illustration]
            </div>
          </div>
          {/* Right text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-[24px] md:text-[36px] font-semibold text-[#4D4D4D] leading-tight mb-4">
              온보딩 3분이면 시작할 수 있어요
            </h2>
            <p className="text-[14px] md:text-[16px] text-[#717171] leading-relaxed mb-6">
              간단한 건강 설문으로 당뇨 위험도를 확인하고, 맞춤 관리 계획을 받으세요. 온보딩 후 바로 AI 채팅과 건강 기록을 시작할 수 있습니다.
            </p>
            <Link
              href="#"
              className="inline-flex items-center gap-2 px-6 py-3 bg-nature-500 text-white text-[14px] font-medium rounded-[4px] hover:bg-nature-600 transition-colors"
            >
              온보딩 시작하기
            </Link>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          TESTIMONIAL / CUSTOMER SECTION
         ══════════════════════════════════════ */}
      <section className="py-12 md:py-16 bg-[#F5F7FA]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] flex flex-col md:flex-row items-center gap-12">
          {/* Left avatar */}
          <div className="w-[200px] h-[200px] md:w-[240px] md:h-[240px] bg-gray-200 rounded-xl flex-shrink-0 flex items-center justify-center text-gray-400 text-[14px]">
            [Customer Photo]
          </div>

          {/* Right content */}
          <div className="flex-1">
            <blockquote className="text-[14px] md:text-[16px] text-[#717171] leading-relaxed mb-6 italic">
              &ldquo;다나아를 사용하면서 매일 건강 기록하는 습관이 생겼어요. AI가 물어보는 질문에 답하다 보면 자연스럽게 건강을 챙기게 됩니다. 리포트를 보면서 내 생활습관이 어떻게 변하는지 확인하는 게 동기부여가 돼요.&rdquo;
            </blockquote>
            <p className="text-[16px] md:text-[18px] font-semibold text-nature-500 mb-1">사용자 후기</p>
            <p className="text-[14px] text-[#717171] mb-6">다나아 베타 테스터</p>

            {/* Customer logos row */}
            <div className="flex flex-wrap items-center gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="w-[36px] h-[36px] bg-gray-200 rounded-md flex items-center justify-center text-[9px] text-gray-400"
                >
                  Logo
                </div>
              ))}
              <Link href="#" className="flex items-center gap-1 text-[14px] text-nature-500 font-medium hover:underline">
                더 많은 후기 보기 <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          COMMUNITY UPDATES / BLOG SECTION
         ══════════════════════════════════════ */}
      <section id="blog" className="py-12 md:py-16 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] text-center">
          <h2 className="text-[24px] md:text-[30px] font-semibold text-[#4D4D4D] mb-2">
            다나아 건강 가이드
          </h2>
          <p className="text-[14px] md:text-[16px] text-[#717171] max-w-[500px] mx-auto mb-12">
            건강한 생활습관에 대한 최신 정보와 팁을 확인하세요.
          </p>

          {/* Blog cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: '당뇨 예방을 위한 올바른 식습관 가이드',
              },
              {
                title: '하루 30분 산책이 건강에 미치는 놀라운 효과',
              },
              {
                title: '수면의 질을 높이는 5가지 생활습관',
              },
            ].map((post, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden text-left hover:shadow-lg transition-shadow"
              >
                {/* Image placeholder */}
                <div className="w-full h-[200px] bg-gray-200 flex items-center justify-center text-gray-400 text-[14px]">
                  [Blog Image {i + 1}]
                </div>
                {/* Content */}
                <div className="p-6">
                  <h3 className="text-[16px] md:text-[18px] font-semibold text-[#4D4D4D] leading-snug mb-4">
                    {post.title}
                  </h3>
                  <Link
                    href="#"
                    className="inline-flex items-center gap-1 text-[14px] text-nature-500 font-medium hover:underline"
                  >
                    자세히 보기 <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
          CTA SECTION
         ══════════════════════════════════════ */}
      <section className="py-16 md:py-20 bg-[#F5F7FA]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] text-center">
          <h2 className="text-[30px] md:text-[48px] lg:text-[54px] font-semibold text-[#263238] leading-tight mb-8">
            지금 바로 건강관리를 시작하세요
          </h2>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-nature-500 text-white text-[16px] font-medium rounded-[4px] hover:bg-nature-600 transition-colors"
          >
            무료로 시작하기 &rarr;
          </Link>
        </div>
      </section>


      {/* ══════════════════════════════════════
          FOOTER
         ══════════════════════════════════════ */}
      <footer className="bg-[#263238] text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[100px] py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Brand column */}
            <div>
              <Link href="/" className="flex items-center gap-1.5 mb-4">
                <div className="w-[33px] h-[33px] rounded-full bg-nature-500 flex items-center justify-center">
                  <Zap size={18} className="text-white" />
                </div>
                <span className="text-[20px] font-bold text-white">DANAA</span>
              </Link>
              <p className="text-[14px] text-[#D9DBE1] leading-relaxed mb-4">
                만성질환 예방을 위한 AI 건강 생활습관 코칭
              </p>
              {/* Social icons */}
              <div className="flex items-center gap-3">
                {['instagram', 'dribbble', 'twitter', 'youtube'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="w-[32px] h-[32px] bg-[#FFFFFF14] rounded-full flex items-center justify-center hover:bg-nature-500 transition-colors"
                  >
                    <span className="text-[12px] text-white/70">{social[0].toUpperCase()}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[16px] font-semibold text-white mb-4">서비스</h4>
              <ul className="space-y-3">
                {['소개', '블로그', '문의', '요금', '후기'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[14px] text-[#D9DBE1] hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-[16px] font-semibold text-white mb-4">지원</h4>
              <ul className="space-y-3">
                {['도움말', '이용약관', '법적 고지', '개인정보 처리방침', '서비스 상태'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[14px] text-[#D9DBE1] hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stay up to date */}
            <div>
              <h4 className="text-[16px] font-semibold text-white mb-4">뉴스레터 구독</h4>
              <div className="flex">
                <input
                  type="email"
                  placeholder="이메일 주소를 입력하세요"
                  className="flex-1 px-4 py-2.5 bg-[#FFFFFF14] border border-[#FFFFFF1A] rounded-l-[4px] text-[14px] text-white placeholder-[#D9DBE1]/50 focus:outline-none focus:border-nature-500"
                />
                <button className="px-4 py-2.5 bg-nature-500 rounded-r-[4px] hover:bg-nature-600 transition-colors">
                  <ArrowRight size={16} className="text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#FFFFFF1A] pt-6 text-center">
            <p className="text-[13px] text-[#D9DBE1]">
              &copy; 2025 DANAA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
