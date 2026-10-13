// Minimal request/response shapes shared by Vercel functions and the local Express server.
export interface ApiReq {
  method?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  query: Record<string, string | string[] | undefined>;
}

export interface ApiRes {
  status(code: number): ApiRes;
  json(body: unknown): void;
}

export function queryString(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}
