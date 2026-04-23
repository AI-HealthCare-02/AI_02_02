'use client';

import dynamic from 'next/dynamic';
import { FolderKanban } from 'lucide-react';

const CategoryListView = dynamic(
  () => import('../../../../components/doit/CategoryListView'),
  { ssr: false },
);

export default function ProjectPage() {
  return (
    <CategoryListView
      categoryId="project"
      categoryTone="brown"
      title="프로젝트"
      subtitle="여러 날에 걸친 큰 흐름을 묶어요."
      icon={FolderKanban}
    />
  );
}
