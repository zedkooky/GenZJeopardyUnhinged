import { countByTeam, getRoomStore, MAX_PLAYERS_PER_TEAM } from './_lib/roomStore.js';
import { queryString, type ApiReq, type ApiRes } from './_lib/http.js';

const ROOM_PATTERN = /^[A-Z0-9-]{4,24}$/;
const PLAYER_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_TEAM_NAME_LENGTH = 24;

/**
 * GET  /api/room?room=CODE[&playerId=ID] -> { active, teams, buzzes, teamNames, playerCounts, myTeamId, maxPerTeam, ... }
 * POST /api/room            -> { room, action: 'open' | 'close' | 'teams' | 'buzz' | 'join' | 'rename', ... }
 */
export default async function handler(req: ApiReq, res: ApiRes) {
  try {
    const store = getRoomStore();

    if (req.method === 'GET') {
      const room = queryString(req.query.room).toUpperCase();
      if (!ROOM_PATTERN.test(room)) return res.status(400).json({ error: 'Invalid room code' });
      const playerId = queryString(req.query.playerId);
      const [state, buzzes, players, teamNames] = await Promise.all([
        store.getState(room),
        store.getBuzzes(room),
        store.getPlayers(room),
        store.getTeamNames(room),
      ]);
      return res.status(200).json({
        ...state,
        buzzes,
        teamNames,
        playerCounts: countByTeam(players),
        myTeamId: players[playerId] ?? null,
        maxPerTeam: MAX_PLAYERS_PER_TEAM,
        storage: store.kind,
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body ?? {};
    const room = String(body.room ?? '').toUpperCase();
    if (!ROOM_PATTERN.test(room)) return res.status(400).json({ error: 'Invalid room code' });

    switch (body.action) {
      case 'open': {
        if (!body.clue?.id) return res.status(400).json({ error: 'clue is required' });
        const state = await store.setActive(
          room,
          { clueId: String(body.clue.id), categoryName: String(body.categoryName ?? ''), clue: body.clue },
          Array.isArray(body.teams) ? body.teams : null,
        );
        return res.status(200).json(state);
      }
      case 'close':
        return res.status(200).json(await store.setActive(room, null, null));
      case 'teams':
        return res.status(200).json(await store.setState(room, { teams: Array.isArray(body.teams) ? body.teams : null }));
      case 'buzz': {
        const state = await store.getState(room);
        const teamId = String(body.teamId ?? '');
        if (!teamId) return res.status(400).json({ error: 'teamId is required' });
        // A buzz for a clue that is no longer open is stale; drop it.
        if (!state.active || state.active.clueId !== String(body.clueId ?? '')) {
          return res.status(409).json({ error: 'No matching active clue', accepted: false });
        }
        const accepted = await store.addBuzz(room, {
          teamId,
          timestamp: Date.now(),
          timeTakenMs: Number(body.timeTakenMs) || 0,
        });
        return res.status(200).json({ accepted });
      }
      case 'join': {
        const playerId = String(body.playerId ?? '');
        const teamId = String(body.teamId ?? '');
        if (!PLAYER_PATTERN.test(playerId)) return res.status(400).json({ error: 'Invalid player id' });
        const state = await store.getState(room);
        if (!state.teams?.some((t: { id: string }) => t.id === teamId)) {
          return res.status(404).json({ error: 'Unknown team' });
        }
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
