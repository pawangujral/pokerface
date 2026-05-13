'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const EMOJIS = ['👍', '👎', '🤔', '🔥', '💯', '😅'];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
}

interface Props {
  reactions: Record<string, { emoji: string; ts: number }> | null;
  onSend: (emoji: string) => void;
}

export default function ReactionsBar({ reactions, onSend }: Props) {
  const [floats, setFloats] = useState<FloatingEmoji[]>([]);
  const seenTs = useRef<Set<number>>(new Set());
  const nextId = useRef(0);

  useEffect(() => {
    if (!reactions) return;
    for (const { emoji, ts } of Object.values(reactions)) {
      if (!ts || seenTs.current.has(ts)) continue;
      seenTs.current.add(ts);
      const id = nextId.current++;
      const x = 10 + Math.random() * 80;
      setFloats((prev) => [...prev, { id, emoji, x }]);
      setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 2200);
    }
  }, [reactions]);

  const handleSend = useCallback((emoji: string) => {
    onSend(emoji);
    // Optimistic local float
    const id = nextId.current++;
    const x = 10 + Math.random() * 80;
    setFloats((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 2200);
  }, [onSend]);

  return (
    <>
      <div className="reactions-bar">
        {EMOJIS.map((e) => (
          <button key={e} className="reaction-btn" onClick={() => handleSend(e)} title={e}>
            {e}
          </button>
        ))}
      </div>

      <div className="reaction-floats">
        {floats.map((f) => (
          <span
            key={f.id}
            className="floating-emoji"
            style={{ left: `${f.x}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
    </>
  );
}
