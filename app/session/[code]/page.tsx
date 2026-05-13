'use client';

import { use, Suspense } from 'react';
import SessionPage from '@/components/poker/SessionPage';

export default function SessionRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense>
      <SessionPage code={code} />
    </Suspense>
  );
}
