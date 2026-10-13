import { getRoomStore } from './_lib/roomStore.js';
import { queryString, type ApiReq, type ApiRes } from './_lib/http.js';

const ROOM_PATTERN = /^[A-Z0-9-]{4,24}$/;

/**
 * GET  /api/room?room=CODE  -> { active, teams, buzzes, version, storage }
 * POST /api/room            -> { room, action: 'open' | 'close' | 'teams' | 'buzz', ... }
 */
export default async function handler(req: ApiReq, res: ApiRes) {
  try {
    const store = getRoomStore();

    if (req.method === 'GET') {
      const room = queryString(req.query.room).toUpperCase();
      if (!ROOM_PATTERN.test(room)) return res.status(400).json({ error: 'Invalid room code' });
      const [state, buzzes] = await Promise.all([store.getState(room), store.getBuzzes(room)]);
      return res.status(200).json({ ...state, buzzes, storage: store.kind });
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
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err: unknown) {
    console.error('room api error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Room error' });
  }
}
