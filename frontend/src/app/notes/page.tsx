'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NotesWorkspace } from '@/components/sivlo/notes/NotesWorkspace';

function NotesContent() {
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('id') ?? '';

  return <NotesWorkspace meetingId={meetingId} />;
}

export default function NotesPage() {
  return (
    <Suspense fallback={null}>
      <NotesContent />
    </Suspense>
  );
}
