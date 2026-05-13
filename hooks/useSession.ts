'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  subscribeSession,
  subscribeReactions,
  castVote as fbCastVote,
  revealVotes as fbRevealVotes,
  newRound as fbNewRound,
  setTimer as fbSetTimer,
  clearTimer as fbClearTimer,
  sendReaction as fbSendReaction,
} from '@/lib/firebase/session';
import type { Session } from '@/types';

export function useSession(sessionId: string | null, participantId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; ts: number }> | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubSession = useRef<(() => void) | null>(null);
  const unsubReactions = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    unsubSession.current = subscribeSession(sessionId, (data) => {
      setSession(data);
      setLoading(false);
    });

    unsubReactions.current = subscribeReactions(sessionId, setReactions);

    return () => {
      unsubSession.current?.();
      unsubReactions.current?.();
    };
  }, [sessionId]);

  const castVote = useCallback(async (value: string) => {
    if (!sessionId || !participantId) return;
    await fbCastVote(sessionId, participantId, value);
  }, [sessionId, participantId]);

  const revealVotes = useCallback(async () => {
    if (!sessionId) return;
    await fbRevealVotes(sessionId);
  }, [sessionId]);

  const startNewRound = useCallback(async () => {
    if (!sessionId) return;
    await fbNewRound(sessionId);
  }, [sessionId]);

  const startTimer = useCallback(async (durationMs: number) => {
    if (!sessionId) return;
    await fbSetTimer(sessionId, Date.now() + durationMs);
  }, [sessionId]);

  const stopTimer = useCallback(async () => {
    if (!sessionId) return;
    await fbClearTimer(sessionId);
  }, [sessionId]);

  const sendReaction = useCallback(async (emoji: string) => {
    if (!sessionId || !participantId) return;
    await fbSendReaction(sessionId, participantId, emoji);
  }, [sessionId, participantId]);

  return {
    session,
    reactions,
    loading,
    castVote,
    revealVotes,
    startNewRound,
    startTimer,
    stopTimer,
    sendReaction,
  };
}
