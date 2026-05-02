import dynamic from 'next/dynamic';
import AuthRedirectGate from './AuthRedirectGate';
import LandingPage from '../components/landing/LandingPage';

/**
 * Root URL `/` — 다나아 V4 랜딩페이지 진입점.
 *
 * Server component. LandingPage 마크업이 SSR HTML에 그대로 포함되어
 * SEO 크롤러·JS-off 사용자·첫 페인트 모두 정상 노출됨 (V4 안정성 검증 권고 반영).
 *
 * 인증된 사용자는 마운트 후 AuthRedirectGate 의 useEffect 가 router.replace 로
 * /app/chat 또는 /onboarding/diabetes 로 즉시 이동. (잠깐 LandingPage가 보일 수 있으나 SEO 가치를 우선).
 */
export const metadata = {
  title: 'DANAA — 매일 쓰는 AI 옆에서, 자연스럽게 건강관리까지',
  description:
    '새 앱 설치도, 비싼 센서도 없습니다. 평소처럼 AI와 대화하는 동안 식사·수면·기분 같은 생활 패턴이 자동으로 쌓이고, FINDRISC 기반 참고 위험도와 7일 챌린지로 자연스럽게 이어지는 만성질환 생활관리 솔루션.',
  alternates: { canonical: 'https://danaa.kr/' },
  openGraph: {
    type: 'website',
    title: 'DANAA — 매일 쓰는 AI 옆에서, 자연스럽게 건강관리까지',
    description:
      '별도 앱·센서 0. AI 대화에 녹아들어 생활 패턴이 쌓이고, FINDRISC 기반 위험도와 7일 챌린지로 이어지는 만성질환 생활관리 솔루션.',
    url: 'https://danaa.kr/',
    siteName: 'DANAA',
    locale: 'ko_KR',
    images: [{ url: 'https://danaa.kr/og-image-1200x630.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DANAA — 매일 쓰는 AI 옆에서, 자연스럽게 건강관리까지',
    description: 'AI 대화에 녹아드는 만성질환 생활관리 솔루션. 별도 앱·센서 없이 시작합니다.',
  },
};

export default function Page() {
  return (
    <>
      <AuthRedirectGate />
      <LandingPage />
    </>
  );
}
