declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export interface VercelRequest extends IncomingMessage {
    body?: unknown;
    query?: Record<string, string | string[]>;
    cookies?: Record<string, string>;
    method?: string;
    headers: IncomingMessage['headers'];
    url?: string;
  }

  export interface VercelResponse extends ServerResponse {
    status: (code: number) => VercelResponse;
    json: (body: unknown) => VercelResponse;
    send: (body: unknown) => VercelResponse;
    setHeader: (
      name: string,
      value: number | string | readonly string[]
    ) => this;
  }
}
