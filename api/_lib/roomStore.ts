import { Redis } from '@upstash/redis';
import type { RoomClue } from './round.js';

const ROOM_TTL_SECONDS = 6 * 60 * 60;
export const MAX_PLAYERS_PER_TEAM = 2;

export interface RoomTeam {
  id: string;
  name: string;
  [key: string]: unknown;
}

/** The team that won the buzz for the current clue. Only one exists at a time. */
export interface Claim {
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
  getActive(room: string): Promise<RoomClue | null>;
  putActive(room: string, active: RoomClue | null): Promise<void>;
  getTeams(room: string): Promise<RoomTeam[] | null>;
  putTeams(room: string, teams: RoomTeam[]): Promise<void>;
  /** First caller wins; used so two simultaneous buzzes can never both answer. */
  claim(room: string, claim: Claim): Promise<boolean>;
  getClaim(room: string): Promise<Claim | null>;
  clearClaim(room: string): Promise<void>;
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

const parse = <T>(value: unknown): T => (typeof value === 'string' ? (JSON.parse(value) as T) : (value as T));

function createRedisStore(redis: Redis): RoomStore {
  const key = (room: string, part: string) => `jeo:${room}:${part}`;

  const readPlayers = async (room: string): Promise<Record<string, string>> =>
    (await redis.hgetall<Record<string, string>>(key(room, 'players'))) ?? {};

  return {
    kind: 'redis',
    async getActive(room) {
      const value = await redis.get<RoomClue | string | null>(key(room, 'active'));
      return value ? parse<RoomClue>(value) : null;
    },
    async putActive(room, active) {
      if (active) await redis.set(key(room, 'active'), active, { ex: ROOM_TTL_SECONDS });
      else await redis.del(key(room, 'active'));
    },
    async getTeams(room) {
      const value = await redis.get<RoomTeam[] | string | null>(key(room, 'teams'));
      return value ? parse<RoomTeam[]>(value) : null;
    },
    async putTeams(room, teams) {
      await redis.set(key(room, 'teams'), teams, { ex: ROOM_TTL_SECONDS });
    },
    async claim(room, claim) {
      const result = await redis.set(key(room, 'claim'), claim, { nx: true, ex: ROOM_TTL_SECONDS });
      return result === 'OK';
    },
    async getClaim(room) {
      const value = await redis.get<Claim | string | null>(key(room, 'claim'));
      return value ? parse<Claim>(value) : null;
    },
    async clearClaim(room) {
      await redis.del(key(room, 'claim'));
    },
    async joinTeam(room, playerId, teamId) {
      const players = await readPlayers(room);
      const others = Object.fromEntries(Object.entries(players).filter(([id]) => id !== playerId));
      if ((countByTeam(others)[teamId] ?? 0) >= MAX_PLAYERS_PER_TEAM) return { ok: false, counts: countByTeam(players) };
      await redis.hset(key(room, 'players'), { [playerId]: teamId });
      await redis.expire(key(room, 'players'), ROOM_TTL_SECONDS);
      // Two phones can race past the check above; the later writer backs out.
      const after = await readPlayers(room);
      if ((countByTeam(after)[teamId] ?? 0) > MAX_PLAYERS_PER_TEAM) {
        const previous = players[playerId];
        if (previous) await redis.hset(key(room, 'players'), { [playerId]: previous });
        else await redis.hdel(key(room, 'players'), playerId);
        return { ok: false, counts: countByTeam(await readPlayers(room)) };
      }
      return { ok: true, counts: countByTeam(after) };
    },
    getPlayers: readPlayers,
    async setTeamName(room, teamId, name) {
      await redis.hset(key(room, 'names'), { [teamId]: JSON.stringify({ name, at: Date.now() }) });
      await redis.expire(key(room, 'names'), ROOM_TTL_SECONDS);
    },
    async getTeamNames(room) {
      const all = (await redis.hgetall<Record<string, TeamName | string>>(key(room, 'names'))) ?? {};
      return Object.fromEntries(Object.entries(all).map(([id, v]) => [id, parse<TeamName>(v)]));
    },
  };
}

function createMemoryStore(): RoomStore {
  const actives = new Map<string, RoomClue>();
  const teams = new Map<string, RoomTeam[]>();
  const claims = new Map<string, Claim>();
  const players = new Map<string, Record<string, string>>();
  const names = new Map<string, Record<string, TeamName>>();

  return {
    kind: 'memory',
    async getActive(room) {
      return actives.get(room) ?? null;
    },
    async putActive(room, active) {
      if (active) actives.set(room, active);
      else actives.delete(room);
    },
    async getTeams(room) {
      return teams.get(room) ?? null;
    },
    async putTeams(room, value) {
      teams.set(room, value);
    },
    async claim(room, claim) {
      if (claims.has(room)) return false;
      claims.set(room, claim);
      return true;
    },
    async getClaim(room) {
      return claims.get(room) ?? null;
    },
    async clearClaim(room) {
      claims.delete(room);
    },
    async joinTeam(room, playerId, teamId) {
      const current = players.get(room) ?? {};
      const others = Object.fromEntries(Object.entries(current).filter(([id]) => id !== playerId));
      if ((countByTeam(others)[teamId] ?? 0) >= MAX_PLAYERS_PER_TEAM) return { ok: false, counts: countByTeam(current) };
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
