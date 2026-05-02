'use client';

import Script from 'next/script';
import dynamic from 'next/dynamic';
import SymbolDefs from './SymbolDefs';
import LandingNav from './LandingNav';
import HeroSection from './HeroSection';
import PainSection from './PainSection';
import SolutionSection from './SolutionSection';
import { useScrollProgress } from '../../hooks/landing/useScrollProgress';
import { useGlobalMouseTracking } from '../../hooks/landing/useMouseTracking';
import { useRevealOnScroll } from '../../hooks/landing/useRevealOnScroll';
import { useReducedMotion } from '../../hooks/landing/useReducedMotion';

/**
 * Fold-below 섹션 — 초기 viewport 밖. next/dynamic({ssr:true}) 으로 분리하여
 * 초기 번들 청크 축소(SSR HTML 마크업은 유지 → SEO·JS-off 영향 0).
 * V4 성능 검증 1팀 권고 반영.
 */
const BentoSection = dynamic(() => import('./BentoSection'), { ssr: true });
const ServiceFlowDeck = dynamic(() => import('./ServiceFlowDeck'), { ssr: true });
const CompareTable = dynamic(() => import('./CompareTable'), { ssr: true });
const TrustSection = dynamic(() => import('./TrustSection'), { ssr: true });
const CtaSection = dynamic(() => import('./CtaSection'), { ssr: true });
const LandingFooter = dynamic(() => import('./LandingFooter'), { ssr: true });

const LD_JSON = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'DANAA',
  alternateName: '다나아',
  description: 'AI와 대화하는 동안 생활 패턴이 정리되고 참고용 위험도로 이어지는 생활 운영형 건강관리 서비스',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  url: 'https://danaa.kr/',
  image: 'https://danaa.kr/og-image-1200x630.png',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  inLanguage: 'ko-KR',
};

export default function LandingPage() {
  const reduced = useReducedMotion();
  const progressRef = useScrollProgress();
  useGlobalMouseTracking({ enabled: !reduced });
  useRevealOnScroll();

  return (
    <div className="danaa-landing">
      <SymbolDefs />
      <Script id="ld-software" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(LD_JSON)}
      </Script>

      <a className="skip-link" href="#main">메인 콘텐츠로 건너뛰기</a>
      <div className="scroll-progress" ref={progressRef} aria-hidden="true" />

      <LandingNav />

      <main id="main">
        <HeroSection />
        <PainSection />
        <SolutionSection />
        <BentoSection />
        <ServiceFlowDeck />
        <CompareTable />
        <TrustSection />
        <CtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}
