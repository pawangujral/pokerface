'use client';

import { Suspense } from 'react';
import LandingPage from '@/components/poker/LandingPage';

export default function Home() {
  return (
    <Suspense>
      <LandingPage />
    </Suspense>
  );
}
