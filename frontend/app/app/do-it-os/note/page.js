'use client';

import dynamic from 'next/dynamic';
import { StickyNote } from 'lucide-react';

const CategoryListView = dynamic(
  () => import('../../../../components/doit/CategoryListView'),
  { ssr: false },
);

export default function NotePage() {
  return (
    <CategoryListView
      categoryId="note"
      categoryTone="gray"
      title="노트"
      subtitle="오래 참고할 생각·자료·건강 단서를 보관해요."
      icon={StickyNote}
    />
  );
}
