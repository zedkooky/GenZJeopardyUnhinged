import { Redis } from '@upstash/redis';

const ROOM_TTL_SECONDS = 6 * 60 * 60;
export const MAX_PLAYERS_PER_TEAM = 2;

export interface RoomClue {
  clueId: string;
  categoryName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clue: any;
}

export interface RoomState {
  active: RoomClue | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teams: any[] | null;
  version: number;
}

export interface RoomBuzz {
  teamId: string;
  timestamp: number;
  timeTakenMs: number;
}

export interface TeamName {
  name: string;
  at: number;
}

export interface JoinResult {
  ok: boolean;
  counts: Record<string, number>;
}

export interface RoomStore {
  getState(room: string): Promise<RoomState>;
  setState(room: string, patch: Partial<Omit<RoomState, 'version'>>): Promise<RoomState>;
  /** Replace the active clue and drop all buzzes belonging to the previous one. */
  setActive(room: string, active: RoomClue | null, teams: RoomState['teams']): Promise<RoomState>;
  /** First write per team wins; returns false if the team had already buzzed. */
  addBuzz(room: string, buzz: RoomBuzz): Promise<boolean>;
  getBuzzes(room: string): Promise<RoomBuzz[]>;
  /** Seat a player on a team (moving them if already seated); rejects a full team. */
  joinTeam(room: string, playerId: string, teamId: string): Promise<JoinResult>;
  /** playerId -> teamId for everyone seated in the room. */
  getPlayers(room: string): Promise<Record<string, string>>;
  setTeamName(room: string, teamId: string, name: string): Promise<void>;
  getTeamNames(room: string): Promise<Record<string, TeamName>>;
  readonly kind: 'redis' | 'memory';
}

export function countByTeam(players: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const teamId of Object.values(players)) counts[teamId] = (counts[teamId] ?? 0) + 1;
  return counts;
}

const EMPTY: RoomState = { active: null, teams: null, version: 0 };

function createRedisStore(redis: Redis): RoomStore {
  const stateKey = (r: string) => `jeo:${r}:state`;
  const buzzKey = (r: string) => `jeo:${r}:buzz`;
  const playersKey = (r: string) => `jeo:${r}:players`;
  const namesKey = (r: string) => `jeo:${r}:names`;

  const readPlayers = async (room: string): Promise<Record<string, string>> =>
    (await redis.hgetall<Record<string, string>>(playersKey(room))) ?? {};

  const read = async (room: string): Promise<RoomState> =>
    (await redis.get<RoomState>(stateKey(room))) ?? EMPTY;

  const write = async (room: string, next: RoomState): Promise<RoomState> => {
    await redis.set(stateKey(room), next, { ex: ROOM_TTL_SECONDS });
    return next;
  };

  return {
    kind: 'redis',
    getState: read,
    async setState(room, patch) {
      const cur = await read(room);
      return write(room, { ...cur, ...patch, version: cur.version + 1 });
    },
    async setActive(room, active, teams) {
      const cur = await read(room);
      await redis.del(buzzKey(room));
      return write(room, { active, teams: teams ?? cur.teams, version: cur.version + 1 });
    },
    async addBuzz(room, buzz) {
      const added = await redis.hsetnx(buzzKey(room), buzz.teamId, JSON.stringify(buzz));
      await redis.expire(buzzKey(room), ROOM_TTL_SECONDS);
      return added === 1;
    },
    async joinTeam(room, playerId, teamId) {
      const players = await readPlayers(room);
      const others = Object.entries(players).filter(([id]) => id !== playerId);
      const counts = countByTeam(Object.fromEntries(others));
      if ((counts[teamId] ?? 0) >= MAX_PLAYERS_PER_TEAM) return { ok: false, counts: countByTeam(players) };
      await redis.hset(playersKey(room), { [playerId]: teamId });
      await redis.expire(playersKey(room), ROOM_TTL_SECONDS);
      // Two phones can race past the check above; the later writer backs out.
      const after = await readPlayers(room);
      if (countByTeam(after)[teamId] > MAX_PLAYERS_PER_TEAM) {
        const previous = players[playerId];
        if (previous) await redis.hset(playersKey(room), { [playerId]: previous });
        else await redis.hdel(playersKey(room), playerId);
        return { ok: false, counts: countByTeam(await readPlayers(room)) };
      }
      return { ok: true, counts: countByTeam(after) };
    },
    getPlayers: readPlayers,
    async setTeamName(room, teamId, name) {
      await redis.hset(namesKey(room), { [teamId]: JSON.stringify({ name, at: Date.now() }) });
      await redis.expire(namesKey(room), ROOM_TTL_SECONDS);
    },
    async getTeamNames(room) {
      const all = (await redis.hgetall<Record<string, TeamName | string>>(namesKey(room))) ?? {};
      return Object.fromEntries(
        Object.entries(all).map(([id, v]) => [id, typeof v === 'string' ? (JSON.parse(v) as TeamName) : v]),
      );
    },
    async getBuzzes(room) {
      const all = await redis.hgetall<Record<string, RoomBuzz | string>>(buzzKey(room));
      if (!all) return [];
      return Object.values(all)
        .map((v) => (typeof v === 'string' ? (JSON.parse(v) as RoomBuzz) : v))
        .sort((a, b) => a.timestamp - b.timestamp);
    },
  };
}

function createMemoryStore(): RoomStore {
  const states = new Map<string, RoomState>();
  const buzzes = new Map<string, Map<string, RoomBuzz>>();
  const players = new Map<string, Record<string, string>>();
  const names = new Map<string, Record<string, TeamName>>();
  const read = (room: string) => states.get(room) ?? EMPTY;

  return {
    kind: 'memory',
    async getState(room) {
      return read(room);
    },
    async setState(room, patch) {
      const cur = read(room);
      const next = { ...cur, ...patch, version: cur.version + 1 };
      states.set(room, next);
      return next;
    },
    async setActive(room, active, teams) {
      const cur = read(room);
      buzzes.delete(room);
      const next = { active, teams: teams ?? cur.teams, version: cur.version + 1 };
      states.set(room, next);
      return next;
    },
    async addBuzz(room, buzz) {
      const roomBuzzes = buzzes.get(room) ?? new Map<string, RoomBuzz>();
      if (roomBuzzes.has(buzz.teamId)) return false;
      roomBuzzes.set(buzz.teamId, buzz);
      buzzes.set(room, roomBuzzes);
      return true;
    },
    async joinTeam(room, playerId, teamId) {
      const current = players.get(room) ?? {};
      const others = Object.fromEntries(Object.entries(current).filter(([id]) => id !== playerId));
      if ((countByTeam(others)[teamId] ?? 0) >= MAX_PLAYERS_PER_TEAM) {
        return { ok: false, counts: countByTeam(current) };
      }
      const next = { ...others, [playerId]: teamId };
      players.set(room, next);
      return { ok: true, counts: countByTeam(next) };
    },
    async getPlayers(room) {
      return players.get(room) ?? {};
    },
    async setTeamName(room, teamId, name) {
      names.set(room, { ...(names.get(room) ?? {}), [teamId]: { name, at: Date.now() } });
    },
    async getTeamNames(room) {
      return names.get(room) ?? {};
    },
    async getBuzzes(room) {
      return [...(buzzes.get(room)?.values() ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    },
  };
}

let store: RoomStore | null = null;

/** Redis when Upstash/Vercel KV env vars exist; otherwise in-memory (local dev only). */
export function getRoomStore(): RoomStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  store = url && token ? createRedisStore(new Redis({ url, token })) : createMemoryStore();
  return store;
}
