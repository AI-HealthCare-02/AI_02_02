'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const NoteDetailView = dynamic(
  () => import('../../../../../components/doit/NoteDetailView'),
  { ssr: false },
);

export default function NoteDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return <NoteDetailView noteId={id} />;
}
