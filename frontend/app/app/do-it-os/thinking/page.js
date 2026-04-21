'use client';

import dynamic from 'next/dynamic';

const ThoughtCanvas = dynamic(
  () => import('../../../../components/doit/ThoughtCanvas'),
  { ssr: false },
);

export default function ThinkingPage() {
  return <ThoughtCanvas />;
}
