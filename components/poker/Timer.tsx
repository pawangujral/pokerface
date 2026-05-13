'use client';

import { useEffect, useState, useRef } from 'react';

interface Props {
  endsAt: number | null;
  onExpire: () => void;
  onStop: () => void;
}

export default function Timer({ endsAt, onExpire, onStop }: Props) {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const totalRef = useRef(0);

  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const dur = endsAt - Date.now();
    if (dur <= 0) { onExpire(); return; }
    totalRef.current = dur;
    setTotal(dur);
    setRemaining(dur);

    const interval = setInterval(() => {
      const left = endsAt - Date.now();
      if (left <= 0) {
        clearInterval(interval);
        setRemaining(0);
        onExpire();
      } else {
        setRemaining(left);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!endsAt || remaining <= 0) return null;

  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const secs = Math.ceil(remaining / 1000);
  const fillClass = pct > 80 ? 'timer-fill timer-danger' : pct > 60 ? 'timer-fill timer-warn' : 'timer-fill';

  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const label = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;

  return (
    <div className="timer-bar">
      <div className={fillClass} style={{ width: `${pct}%` }} />
      <span className="timer-text">{label}</span>
      <button className="btn-timer-stop" onClick={onStop} title="Stop timer">×</button>
    </div>
  );
}
