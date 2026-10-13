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
}

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

export async function fetchRoom(room: string): Promise<RoomSnapshot | null> {
  try {
    const res = await fetch(`/api/room?room=${encodeURIComponent(room)}`, { cache: 'no-store' });
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
