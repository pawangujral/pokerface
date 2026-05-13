'use client';

import { useMemo } from 'react';
import type { Session } from '@/types';

export function useModerator(session: Session | null, participantId: string | null): boolean {
  return useMemo(() => {
    if (!session || !participantId) return false;
    return session.createdBy === participantId;
  }, [session, participantId]);
}
