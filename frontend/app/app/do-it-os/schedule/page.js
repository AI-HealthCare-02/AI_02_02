'use client';

import dynamic from 'next/dynamic';
import { Calendar } from 'lucide-react';

const CategoryListView = dynamic(
  () => import('../../../../components/doit/CategoryListView'),
  { ssr: false },
);

export default function SchedulePage() {
  return (
    <CategoryListView
      categoryId="schedule"
      categoryTone="yellow"
      title="일정"
      subtitle="날짜가 있는 생각이에요. 날짜를 설정하면 오늘·내일·앞으로로 자동 정렬돼요."
      icon={Calendar}
      showDate
    />
  );
}
