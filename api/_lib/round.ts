// Pure state machine for one clue round. All times are epoch milliseconds from the server clock.
//
//   reading --start--> open --buzz--> answering --wrong/release--> open --...--> ended
//                        \--time runs out--> ended (timeup)      \--all teams locked--> ended (exhausted)

export type RoundStatus = 'reading' | 'open' | 'answering' | 'ended';
export type EndReason = 'timeup' | 'exhausted';

export interface RoomClue {
  clueId: string;
  categoryName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clue: any;
  status: RoundStatus;
  durationMs: number;
  /** Time left while the clock is not running (reading / answering / ended). */
  remainingMs: number;
  /** When the running clock hits zero. Only set while status is 'open'. */
  deadline: number | null;
  lockedTeams: string[];
  endReason: EndReason | null;
}

export const MIN_DURATION_MS = 5_000;
export const MAX_DURATION_MS = 600_000;
export const DEFAULT_DURATION_MS = 30_000;

export const clampDuration = (ms: number): number =>
  Number.isFinite(ms)
    ? Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(ms)))
    : DEFAULT_DURATION_MS;

export function createRound(
  clueId: string,
  categoryName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clue: any,
  durationMs: number,
): RoomClue {
  const duration = clampDuration(durationMs);
  return {
    clueId,
    categoryName,
    clue,
    status: 'reading',
    durationMs: duration,
    remainingMs: duration,
    deadline: null,
    lockedTeams: [],
    endReason: null,
  };
}

/** Applies the passage of time: an open clock that has run out becomes 'ended'. */
export function settle(round: RoomClue | null, now: number): RoomClue | null {
  if (round && round.status === 'open' && round.deadline !== null && now >= round.deadline) {
    return { ...round, status: 'ended', deadline: null, remainingMs: 0, endReason: 'timeup' };
  }
  return round;
}

export function remainingMs(round: RoomClue, now: number): number {
  if (round.status === 'open' && round.deadline !== null) return Math.max(0, round.deadline - now);
  return round.remainingMs;
}

const resume = (round: RoomClue, now: number): RoomClue =>
  round.remainingMs > 0
    ? { ...round, status: 'open', deadline: now + round.remainingMs, endReason: null }
    : { ...round, status: 'ended', deadline: null, remainingMs: 0, endReason: 'timeup' };

/** Host finished reading: open the buzzers and start the clock. */
export function startRound(round: RoomClue, now: number): RoomClue {
  return round.status === 'reading' ? resume(round, now) : round;
}

/** Add time. Re-opens a clue that ended on time-up; no-op once every team is locked out. */
export function extendRound(round: RoomClue, ms: number, now: number): RoomClue {
  const extra = Math.max(0, Math.round(ms));
  if (round.status === 'ended') {
    return round.endReason === 'timeup' ? resume({ ...round, remainingMs: extra }, now) : round;
  }
  if (round.status === 'open' && round.deadline !== null) return { ...round, deadline: round.deadline + extra };
  return { ...round, remainingMs: round.remainingMs + extra };
}

export const canBuzz = (round: RoomClue | null, teamId: string): boolean =>
  round !== null && round.status === 'open' && !round.lockedTeams.includes(teamId);

/** A team won the buzz: freeze the clock while they answer. */
export function claimRound(round: RoomClue, now: number): RoomClue {
  return { ...round, status: 'answering', remainingMs: remainingMs(round, now), deadline: null };
}

/** Host clears the current answerer without penalty: buzzers reopen with the time that was left. */
export function releaseRound(round: RoomClue, now: number): RoomClue {
  return round.status === 'answering' ? resume(round, now) : round;
}

/** Wrong answer: lock the team out of this clue and reopen for everyone else. */
export function wrongAnswer(round: RoomClue, teamId: string, allTeamIds: string[], now: number): RoomClue {
  const lockedTeams = round.lockedTeams.includes(teamId) ? round.lockedTeams : [...round.lockedTeams, teamId];
  const locked = { ...round, lockedTeams };
  if (allTeamIds.length > 0 && allTeamIds.every((id) => lockedTeams.includes(id))) {
    return { ...locked, status: 'ended', deadline: null, remainingMs: 0, endReason: 'exhausted' };
  }
  return locked.status === 'answering' ? resume(locked, now) : locked;
}
