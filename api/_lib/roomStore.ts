import { Redis } from '@upstash/redis';

const ROOM_TTL_SECONDS = 6 * 60 * 60;

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

export interface RoomStore {
  getState(room: string): Promise<RoomState>;
  setState(room: string, patch: Partial<Omit<RoomState, 'version'>>): Promise<RoomState>;
  /** Replace the active clue and drop all buzzes belonging to the previous one. */
  setActive(room: string, active: RoomClue | null, teams: RoomState['teams']): Promise<RoomState>;
  /** First write per team wins; returns false if the team had already buzzed. */
  addBuzz(room: string, buzz: RoomBuzz): Promise<boolean>;
  getBuzzes(room: string): Promise<RoomBuzz[]>;
  readonly kind: 'redis' | 'memory';
}

const EMPTY: RoomState = { active: null, teams: null, version: 0 };

function createRedisStore(redis: Redis): RoomStore {
  const stateKey = (r: string) => `jeo:${r}:state`;
  const buzzKey = (r: string) => `jeo:${r}:buzz`;

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
