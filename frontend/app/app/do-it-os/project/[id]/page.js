'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const ProjectDetailView = dynamic(
  () => import('../../../../../components/doit/ProjectDetailView'),
  { ssr: false },
);

export default function ProjectDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return <ProjectDetailView projectId={id} />;
}
