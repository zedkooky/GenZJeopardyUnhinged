import { useCallback, useEffect, useRef, useState } from 'react';
import type { Clue, Team } from '../types/game';
import { fetchRoom, type RoomClaim, type RoomRound, type RoomSnapshot } from './realtime';

export type RoomInfo = Pick<RoomSnapshot, 'playerCounts' | 'myTeamId' | 'maxPerTeam' | 'storage'>;

const FAST_POLL_MS = 500;
const IDLE_POLL_MS = 2000;

interface UseRoomSyncArgs {
  roomCode: string;
  playerId: string;
  /** This screen is the buzzer view (phone, or the host previewing it). */
  isBuzzerView: boolean;
  /** This browser opened the join link, so it never owns the room. */
  isPhoneDevice: boolean;
  activeClueId: string | null;
  setTeams: (update: (prev: Team[]) => Team[]) => void;
  setActiveClue: (clue: Clue | null) => void;
  setActiveCategoryName: (name: string) => void;
}

export interface RoomSync {
  round: RoomRound | null;
  answerer: RoomClaim | null;
  /** serverNow - localNow, so countdowns agree across devices. */
  serverOffsetMs: number;
  roomInfo: RoomInfo | null;
  refresh: () => Promise<void>;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Polls the room and mirrors it into React state for both the host board and phones. */
export function useRoomSync(args: UseRoomSyncArgs): RoomSync {
  const { roomCode, playerId, isBuzzerView, isPhoneDevice, activeClueId } = args;
  const [round, setRound] = useState<RoomRound | null>(null);
  const [answerer, setAnswerer] = useState<RoomClaim | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

  const argsRef = useRef(args);
  argsRef.current = args;
  const appliedNameAt = useRef<Record<string, number>>({});

  const apply = useCallback((snap: RoomSnapshot) => {
    const { setTeams, setActiveClue, setActiveCategoryName, isBuzzerView: phoneView, activeClueId: current } = argsRef.current;

    setServerOffsetMs(snap.serverNow - Date.now());
    setRound((prev) => (sameJson(prev, snap.active) ? prev : snap.active));
    setAnswerer((prev) => (sameJson(prev, snap.answerer) ? prev : snap.answerer));

    if (phoneView) {
      if (snap.teams?.length) {
        // Renames made on phones show immediately, before the host board has applied them
        const named = snap.teams.map((t) => ({ ...t, name: snap.teamNames?.[t.id]?.name ?? t.name }));
        setTeams((prev) => (sameJson(prev, named) ? prev : named));
      }
      setRoomInfo((prev) => {
        const next = { playerCounts: snap.playerCounts, myTeamId: snap.myTeamId, maxPerTeam: snap.maxPerTeam, storage: snap.storage };
        return sameJson(prev, next) ? prev : next;
      });
      if (snap.active && snap.active.clueId !== current) {
        setActiveClue(snap.active.clue);
        setActiveCategoryName(snap.active.categoryName);
      } else if (!snap.active && current) {
        setActiveClue(null);
      }
      return;
    }

    // Host: apply team renames made on phones, once each
    const renames = Object.entries(snap.teamNames ?? {}).filter(([id, v]) => v.at > (appliedNameAt.current[id] ?? 0));
    if (renames.length > 0) {
      renames.forEach(([id, v]) => {
        appliedNameAt.current[id] = v.at;
      });
      setTeams((prev) => prev.map((t) => {
        const hit = renames.find(([id]) => id === t.id);
        return hit ? { ...t, name: hit[1].name } : t;
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    const snap = await fetchRoom(roomCode, isPhoneDevice ? playerId : undefined);
    if (snap) apply(snap);
  }, [roomCode, playerId, isPhoneDevice, apply]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (document.visibilityState === 'visible') await refresh();
      if (!cancelled) timer = setTimeout(tick, activeClueId || isBuzzerView ? FAST_POLL_MS : IDLE_POLL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh, activeClueId, isBuzzerView]);

  return { round, answerer, serverOffsetMs, roomInfo, refresh };
}
