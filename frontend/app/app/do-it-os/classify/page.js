'use client';

import dynamic from 'next/dynamic';

const ClassifyView = dynamic(
  () => import('../../../../components/doit/ClassifyView'),
  { ssr: false },
);

export default function ClassifyPage() {
  return <ClassifyView />;
}
