'use client';

import dynamic from 'next/dynamic';

const EndOfDayRitual = dynamic(
  () => import('../../../../components/doit/EndOfDayRitual'),
  { ssr: false },
);

export default function EndOfDayPage() {
  return <EndOfDayRitual />;
}
