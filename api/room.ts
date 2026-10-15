import { countByTeam, getRoomStore, MAX_PLAYERS_PER_TEAM, type RoomStore } from './_lib/roomStore.js';
import {
  canBuzz, claimRound, createRound, extendRound, releaseRound, settle, startRound, wrongAnswer,
  DEFAULT_DURATION_MS, type RoomClue,
} from './_lib/round.js';
import { queryString, type ApiReq, type ApiRes } from './_lib/http.js';

const ROOM_PATTERN = /^[A-Z0-9-]{4,24}$/;
const PLAYER_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_TEAM_NAME_LENGTH = 24;

/**
 * GET  /api/room?room=CODE[&playerId=ID]
 *   -> { serverNow, active, answerer, teams, teamNames, playerCounts, myTeamId, maxPerTeam, storage }
 * POST /api/room { room, action, ... }
 *   host:   open | start | extend | wrong | release | close | teams
 *   player: buzz | join | rename
 */
export default async function handler(req: ApiReq, res: ApiRes) {
  try {
    const store = getRoomStore();

    if (req.method === 'GET') {
      const room = queryString(req.query.room).toUpperCase();
      if (!ROOM_PATTERN.test(room)) return res.status(400).json({ error: 'Invalid room code' });
      return res.status(200).json(await snapshot(store, room, queryString(req.query.playerId)));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body ?? {};
    const room = String(body.room ?? '').toUpperCase();
    if (!ROOM_PATTERN.test(room)) return res.status(400).json({ error: 'Invalid room code' });
    const now = Date.now();

    switch (body.action) {
      case 'open': {
        if (!body.clue?.id) return res.status(400).json({ error: 'clue is required' });
        await store.clearClaim(room);
        await store.putActive(
          room,
          createRound(
            String(body.clue.id),
            String(body.categoryName ?? ''),
            body.clue,
            Number(body.durationMs) || DEFAULT_DURATION_MS,
          ),
        );
        if (Array.isArray(body.teams)) await store.putTeams(room, body.teams);
        return res.status(200).json(await snapshot(store, room, ''));
      }
      case 'teams':
        if (Array.isArray(body.teams)) await store.putTeams(room, body.teams);
        return res.status(200).json({ ok: true });
      case 'close':
        await store.clearClaim(room);
        await store.putActive(room, null);
        return res.status(200).json({ ok: true });
      case 'start':
      case 'extend':
      case 'wrong':
      case 'release': {
        const round = settle(await store.getActive(room), now);
        if (!round) return res.status(409).json({ error: 'No active clue' });
        const next = await applyHostAction(store, room, round, body, now);
        await store.putActive(room, next);
        return res.status(200).json(await snapshot(store, room, ''));
      }
      case 'buzz': {
        const round = settle(await store.getActive(room), now);
        const teamId = String(body.teamId ?? '');
        if (!teamId) return res.status(400).json({ error: 'teamId is required' });
        if (!round || round.clueId !== String(body.clueId ?? '')) {
          return res.status(409).json({ error: 'No matching active clue', accepted: false });
        }
        if (!canBuzz(round, teamId)) {
          // Persist a timed-out clock so everyone agrees the buzzers are closed.
          await store.putActive(room, round);
          return res.status(409).json({ error: 'Buzzers are closed for this team', accepted: false, status: round.status });
        }
        const won = await store.claim(room, { teamId, timestamp: now, timeTakenMs: Number(body.timeTakenMs) || 0 });
        if (!won) return res.status(409).json({ error: 'Another team buzzed first', accepted: false });
        await store.putActive(room, claimRound(round, now));
        return res.status(200).json({ accepted: true });
      }
      case 'join': {
        const playerId = String(body.playerId ?? '');
        const teamId = String(body.teamId ?? '');
        if (!PLAYER_PATTERN.test(playerId)) return res.status(400).json({ error: 'Invalid player id' });
        const teams = await store.getTeams(room);
        if (!teams?.some((t) => t.id === teamId)) return res.status(404).json({ error: 'Unknown team' });
        const result = await store.joinTeam(room, playerId, teamId);
        if (!result.ok) return res.status(409).json({ error: 'Team is full', playerCounts: result.counts });
        return res.status(200).json({ playerCounts: result.counts });
      }
      case 'rename': {
        const teamId = String(body.teamId ?? '');
        const name = String(body.name ?? '').trim().slice(0, MAX_TEAM_NAME_LENGTH);
        if (!teamId || !name) return res.status(400).json({ error: 'teamId and name are required' });
        await store.setTeamName(room, teamId, name);
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err: unknown) {
    console.error('room api error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Room error' });
  }
}

async function applyHostAction(
  store: RoomStore,
  room: string,
  round: RoomClue,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  now: number,
): Promise<RoomClue> {
  switch (body.action) {
    case 'start':
      return startRound(round, now);
    case 'extend':
      return extendRound(round, Number(body.ms) || 0, now);
    case 'release':
      await store.clearClaim(room);
      return releaseRound(round, now);
    default: {
      // wrong
      const teamId = String(body.teamId ?? '');
      const teams = (await store.getTeams(room)) ?? [];
      await store.clearClaim(room);
      return wrongAnswer(round, teamId, teams.map((t) => t.id), now);
    }
  }
}

async function snapshot(store: RoomStore, room: string, playerId: string) {
  const now = Date.now();
  const [stored, answerer, teams, players, teamNames] = await Promise.all([
    store.getActive(room),
    store.getClaim(room),
    store.getTeams(room),
    store.getPlayers(room),
    store.getTeamNames(room),
  ]);
  return {
    serverNow: now,
    active: settle(stored, now),
    answerer,
    teams,
    teamNames,
    playerCounts: countByTeam(players),
    myTeamId: players[playerId] ?? null,
    maxPerTeam: MAX_PLAYERS_PER_TEAM,
    storage: store.kind,
  };
}
