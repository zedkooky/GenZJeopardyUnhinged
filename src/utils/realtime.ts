import type { Clue, Team } from '../types/game';

export interface RoomBuzz {
  teamId: string;
  timestamp: number;
  timeTakenMs: number;
}

export interface RoomSnapshot {
  active: { clueId: string; categoryName: string; clue: Clue } | null;
  teams: Team[] | null;
  buzzes: RoomBuzz[];
  version: number;
  storage: 'redis' | 'memory';
  teamNames: Record<string, { name: string; at: number }>;
  playerCounts: Record<string, number>;
  myTeamId: string | null;
  maxPerTeam: number;
}

export type JoinOutcome = 'joined' | 'full' | 'failed';

async function post(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const openClue = (room: string, clue: Clue, categoryName: string, teams: Team[]) =>
  post({ room, action: 'open', clue, categoryName, teams });

export const closeClue = (room: string) => post({ room, action: 'close' });

export const publishTeams = (room: string, teams: Team[]) => post({ room, action: 'teams', teams });

export const sendBuzz = (room: string, clueId: string, teamId: string, timeTakenMs: number) =>
  post({ room, action: 'buzz', clueId, teamId, timeTakenMs });

export async function joinTeam(room: string, playerId: string, teamId: string): Promise<JoinOutcome> {
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, action: 'join', playerId, teamId }),
    });
    if (res.ok) return 'joined';
    return res.status === 409 ? 'full' : 'failed';
  } catch {
    return 'failed';
  }
}

export const renameTeam = (room: string, teamId: string, name: string) =>
  post({ room, action: 'rename', teamId, name });

export async function fetchRoom(room: string, playerId?: string): Promise<RoomSnapshot | null> {
  try {
    const query = `room=${encodeURIComponent(room)}${playerId ? `&playerId=${encodeURIComponent(playerId)}` : ''}`;
    const res = await fetch(`/api/room?${query}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as RoomSnapshot) : null;
  } catch {
    return null;
  }
}

/** Room codes are URL-safe and stable per host browser. */
export function loadRoomCode(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('room');
  if (fromUrl) return fromUrl.toUpperCase();
  try {
    const saved = localStorage.getItem('jeopardy_room_code');
    if (saved) return saved;
    const created = `QUIZ-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem('jeopardy_room_code', created);
    return created;
  } catch {
    return `QUIZ-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

/** Anonymous per-device id so the server can count players per team. */
export function loadPlayerId(): string {
  const fresh = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  try {
    const saved = localStorage.getItem('jeopardy_player_id');
    if (saved) return saved;
    const created = fresh();
    localStorage.setItem('jeopardy_player_id', created);
    return created;
  } catch {
    return fresh();
  }
}
