import { useEffect, useState } from 'react';
import type { RoomRound } from './realtime';

/** Milliseconds left on the clue clock, computed on the server's clock so every device agrees. */
export function remainingFor(round: RoomRound | null, serverOffsetMs: number): number {
  if (!round) return 0;
  if (round.status === 'open' && round.deadline !== null) {
    return Math.max(0, round.deadline - (Date.now() + serverOffsetMs));
  }
  return round.status === 'ended' ? 0 : round.remainingMs;
}

/** Re-renders ~5x a second while the clock is running and returns whole seconds remaining. */
export function useRoundClock(round: RoomRound | null, serverOffsetMs: number): number {
  const [, setTick] = useState(0);
  const running = round?.status === 'open';

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(timer);
  }, [running]);

  return Math.ceil(remainingFor(round, serverOffsetMs) / 1000);
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
