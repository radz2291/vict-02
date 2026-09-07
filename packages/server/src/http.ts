import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { VictControlError, type AgentControlStores, type AgentStreamHub } from '@vict/runtime';
import type { AgentStreamEvent } from '@vict/contracts';
import { AuthenticationError, type ServerActorContext } from './auth.js';
import { VictCommandService, type VictCommandOutcome } from './commands.js';

/**
 * Stage 06B — the VICT-owned HTTP boundary (AI-015).
 *
 * Versioned commands under `/vict/v1/*` plus resumable SSE under
 * `/vict/v1/streams/:streamId`. Hard transport rules:
 *
 * - closed request schemas and a bounded request body (256 KiB);
 * - strict content-type handling (`application/json` for commands);
 * - stable status/error mapping — malformed JSON, unknown routes, and
 *   unsupported methods fail with structured, non-echoing bodies;
 * - mutation idempotency keys via the `Idempotency-Key` header;
 * - the authenticated server context on EVERY protected operation — no
 *   client-supplied identity is ever authoritative;
 * - NO privileged Mastra route exists at this boundary (a probe set of
 *   Mastra-native paths is covered by permanent tests);
 * - raw exceptions, tokens, and secrets never echo.
 */

/** Maximum command body size. */
export const MAX_BODY_BYTES = 256 * 1024;

/** Stable transport error codes. */
export type HttpErrorCode =
  | 'VICT_HTTP_ROUTE_UNKNOWN'
  | 'VICT_HTTP_METHOD_UNSUPPORTED'
  | 'VICT_HTTP_BODY_MALFORMED'
  | 'VICT_HTTP_BODY_TOO_LARGE'
  | 'VICT_HTTP_CONTENT_TYPE_INVALID'
  | 'VICT_HTTP_COMMAND_UNKNOWN'
  | 'VICT_HTTP_RATE_BOUNDS';

/** Structured transport error (safe body; never echoes raw content). */
export class HttpError extends Error {
  readonly code: HttpErrorCode;
  readonly status: number;
  constructor(code: HttpErrorCode, status: number) {
    super(`HTTP request rejected (${code}).`);
    this.name = 'HttpError';
    this.code = code;
    this.status = status;
  }
}

export interface VictHttpServerOptions {
  readonly commandService: VictCommandService;
  readonly auth: {
    resolve(token: string | undefined): Promise<ServerActorContext>;
  };
  readonly hub: AgentStreamHub;
  readonly stores: AgentControlStores;
  readonly server?: Server;
}

/** The composed VICT HTTP server (transport + command + SSE). */
export interface VictHttpServer {
  readonly server: Server;
  /** The actual listening port (after `listen`). */
  port(): number;
  close(): Promise<void>;
}

/** Map a command dispatch failure to a stable HTTP status. */
function statusForError(code: string | undefined): number {
  if (code === undefined) {
    return 500;
  }
  if (code.startsWith('VICT_ACTOR_')) {
    return 403;
  }
  switch (code) {
    case 'VICT_AUTH_TOKEN_MISSING':
    case 'VICT_AUTH_TOKEN_UNKNOWN':
      return 401;
    case 'VICT_COMMAND_UNKNOWN':
    case 'VICT_CONTROL_CHANGESET_MISSING':
    case 'VICT_TURN_MISSING':
    case 'VICT_APPROVAL_MISSING':
    case 'VICT_CONTROL_RELEASE_MISSING':
    case 'VICT_CONTROL_TURN_MISSING':
    case 'VICT_CONTROL_INVOCATION_MISSING':
    case 'VICT_CONTROL_APPROVAL_MISSING':
      return 404;
    case 'VICT_COMMAND_FIELD_INVALID':
    case 'VICT_CONTROL_ID_INVALID':
    case 'VICT_CONTROL_FIELD_INVALID':
    case 'VICT_CONTROL_TIMESTAMP_INVALID':
    case 'VICT_CONTROL_OPERATION_INVALID':
    case 'VICT_CONTROL_RELEASE_INVALID':
    case 'VICT_CONTROL_CHANGESET_EXISTS':
    case 'VICT_CONTROL_TURN_COLLISION':
    case 'VICT_CONTROL_INVOCATION_COLLISION':
    case 'VICT_CONTROL_INVOCATION_KEY_COLLISION':
    case 'VICT_CONTROL_RELEASE_COLLISION':
    case 'VICT_AGENT_DELETION_INTENT_COLLISION':
      return 400;
    case 'VICT_CONTROL_BASE_STALE':
      return 409;
    case 'VICT_CONTROL_APPROVAL_CONFLICT':
    case 'VICT_CONTROL_APPROVALS_INVALIDATED':
    case 'VICT_CONTROL_CHANGESET_NOT_APPROVED':
    case 'VICT_CONTROL_CHANGESET_NOT_DRAFT':
    case 'VICT_CONTROL_CHANGESET_EXPIRED':
    case 'VICT_CONTROL_TURN_INVALID_TRANSITION':
    case 'VICT_CONTROL_INVOCATION_REGRESSION':
    case 'VICT_CONTROL_INVOCATION_TERMINAL':
    case 'VICT_CONTROL_APPROVAL_EXPIRED':
    case 'VICT_APPROVAL_SELF_DENIED':
    case 'VICT_APPROVAL_EXPIRED':
    case 'VICT_TURN_EXECUTOR_UNAVAILABLE':
    case 'VICT_APPDATA_UNAVAILABLE':
    case 'VICT_RUN_STORE_UNAVAILABLE':
      return 409;
    default:
      return 500;
  }
}

function outcomeBody(outcome: VictCommandOutcome): Record<string, unknown> {
  if (outcome.ok) {
    return { ok: true, data: outcome.data };
  }
  return { ok: false, code: outcome.code };
}

/** Read the request body with the bounded limit (fail closed). */
function readBody(req: IncomingMessage, res: ServerResponse): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Respond safely without destroying the socket (fetch clients must
        // see the structured 413 body).
        try {
          res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
          res.end(safeErrorBody('VICT_HTTP_BODY_TOO_LARGE'));
        } catch {
          /* already gone */
        }
        req.removeAllListeners('data');
        req.resume();
        reject(new HttpError('VICT_HTTP_BODY_TOO_LARGE', 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new HttpError('VICT_HTTP_BODY_MALFORMED', 400)));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function safeErrorBody(code: string): string {
  return JSON.stringify({ ok: false, code });
}

/** Route the command path to a command name. */
const ROUTE_COMMANDS: Readonly<Record<string, string>> = {
  '/vict/v1/health': 'health.inspect',
  '/vict/v1/compatibility': 'compatibility.inspect',
  '/vict/v1/actor/whoami': 'actor.whoami',
  '/vict/v1/changesets': 'changeset.list',
  '/vict/v1/releases/selected': 'release.get-selected',
  '/vict/v1/turns': 'agent.turn.start',
  '/vict/v1/app/query': 'app.data.query',
  '/vict/v1/app/mutate': 'app.data.mutate',
};

/** The command endpoints with explicit verbs (mutation routes). */
const POST_ROUTES: Readonly<Record<string, () => string>> = {
  '/vict/v1/changesets': () => 'changeset.propose',
  '/vict/v1/changesets/commit': () => 'changeset.commit',
  '/vict/v1/changesets/decide': () => 'changeset.decide',
  '/vict/v1/changesets/revise': () => 'changeset.revise',
  '/vict/v1/changesets/evidence': () => 'changeset.attach-evidence',
  '/vict/v1/releases/publish': () => 'release.publish',
  '/vict/v1/releases/select': () => 'release.select',
  '/vict/v1/releases/rollback': () => 'release.rollback',
  '/vict/v1/activations/select': () => 'activation.select',
  '/vict/v1/runs/cancel': () => 'run.cancel',
  '/vict/v1/turns': () => 'agent.turn.start',
  '/vict/v1/turns/cancel': () => 'agent.turn.cancel',
  '/vict/v1/app/actions': () => 'app.data.mutate',
  '/vict/v1/actor/whoami': () => 'actor.whoami',
  '/vict/v1/streams/inspect': () => 'stream.inspect',
};

/** Create the composed VICT HTTP + SSE server (not yet listening). */
export function createVictHttpServer(options: VictHttpServerOptions): VictHttpServer {
  let boundPort = 0;
  const server =
    options.server ??
    createServer((req, res) => {
      void handle(req, res).catch((error: unknown) => {
        let status = 500;
        let code = 'VICT_HTTP_INTERNAL';
        if (error instanceof HttpError) {
          status = error.status;
          code = error.code;
        } else if (error instanceof AuthenticationError) {
          status = 401;
          code = error.code;
        } else if (error instanceof VictControlError) {
          status = statusForError(error.code);
          code = error.code;
        }
        try {
          sendJson(res, status, { ok: false, code });
        } catch {
          /* the client already went away */
        }
      });
    });

  async function authenticate(req: IncomingMessage): Promise<ServerActorContext> {
    // Bearer-token authentication: the transport credential NEVER carries
    // identity claims; the authoritative context derives from the directory.
    const header = req.headers.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length)
        : undefined;
    return options.auth.resolve(token);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    // ---- SSE stream endpoint -------------------------------------------
    const streamMatch = /^\/vict\/v1\/streams\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(path);
    if (streamMatch !== null && req.method === 'GET') {
      const actor = await authenticate(req);
      await handleSse(req, res, actor, streamMatch[1] as string, url);
      return;
    }

    if (path === '/vict/v1/health') {
      // Health is unauthenticated-safe: it discloses only compatibility
      // markers, never deployment details.
      sendJson(res, 200, {
        ok: true,
        data: {
          healthy: true,
          commandSchema: 'vict.command@1',
          streamSchema: 'vict.agent-stream@1',
        },
      });
      return;
    }

    // Everything else is a protected command endpoint.
    const actor = await authenticate(req);

    const command = resolveCommand(req, path, url);
    if (process.env.VICT_HTTP_DEBUG === '1') {
      console.error('COMMAND::' + String(command));
    }
    const isMutation = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
    let body = '';
    if (req.method === 'POST' || req.method === 'PUT') {
      const contentType = req.headers['content-type'];
      if (contentType === undefined || !contentType.includes('application/json')) {
        throw new HttpError('VICT_HTTP_CONTENT_TYPE_INVALID', 415);
      }
      body = await readBody(req, res);
    } else {
      // GET commands may carry bounded query payloads.
      const queryPayload: Record<string, unknown> = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (queryPayload[key] === undefined) {
          queryPayload[key] = value;
        }
      }
      body = JSON.stringify({ payload: queryPayload });
    }
    let parsed: unknown;
    try {
      parsed = body.length === 0 ? { payload: {} } : JSON.parse(body);
    } catch {
      throw new HttpError('VICT_HTTP_BODY_MALFORMED', 400);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new HttpError('VICT_HTTP_BODY_MALFORMED', 400);
    }
    const bodyPayload = (parsed as Record<string, unknown>).payload;
    const payload =
      typeof bodyPayload === 'object' && bodyPayload !== null && !Array.isArray(bodyPayload)
        ? (bodyPayload as Record<string, unknown>)
        : {};
    if (Object.keys(payload).length > 64) {
      throw new HttpError('VICT_HTTP_RATE_BOUNDS', 400);
    }
    const idempotencyKey = req.headers['idempotency-key'];
    const outcome = await options.commandService.dispatch(actor, {
      command: command as never,
      payload,
      ...(typeof idempotencyKey === 'string' && isMutation ? { idempotencyKey } : {}),
    });
    if (!outcome.ok) {
      sendJson(res, statusForError(outcome.code), outcomeBody(outcome));
      return;
    }
    sendJson(res, 200, outcomeBody(outcome));
  }

  /** Resolve the command name from the request (closed route table). */
  function resolveCommand(req: IncomingMessage, path: string, url: URL): string {
    // Explicit POST routes.
    const post = POST_ROUTES[path];
    if (post !== undefined) {
      if (req.method !== 'POST') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return post();
    }
    // GET routes with fixed commands.
    const fixed = ROUTE_COMMANDS[path];
    if (fixed !== undefined) {
      if (req.method !== 'GET') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return fixed;
    }
    // Dynamic instance routes.
    const changesetMatch = /^\/vict\/v1\/changesets\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(
      path,
    );
    if (changesetMatch !== null) {
      if (req.method !== 'GET') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return 'changeset.get';
    }
    const turnMatch = /^\/vict\/v1\/turns\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(path);
    if (turnMatch !== null) {
      if (req.method !== 'GET') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return 'agent.turn.get';
    }
    const approvalMatch = /^\/vict\/v1\/approvals\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(
      path,
    );
    if (approvalMatch !== null && req.method === 'POST') {
      return 'agent.tool.decide';
    }
    const streamInspect =
      /^\/vict\/v1\/streams\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})\/inspect$/.exec(path);
    if (streamInspect !== null && req.method === 'GET') {
      return 'stream.inspect';
    }
    throw new HttpError('VICT_HTTP_ROUTE_UNKNOWN', 404);
  }

  async function handleSse(
    req: IncomingMessage,
    res: ServerResponse,
    actor: ServerActorContext,
    streamId: string,
    url: URL,
  ): Promise<void> {
    // Authorization: the stream's owning actor (or an operator) may read.
    const turnRows = await options.stores.turns.listTurns();
    const streamTurn = turnRows.find((turn) => turn.streamId === streamId);
    if (streamTurn !== undefined && streamTurn.actorId !== actor.actorId) {
      const canOperate = actor.scopes.includes('agent.stream.read');
      if (!canOperate) {
        sendJson(res, 403, { ok: false, code: 'VICT_STREAM_ACTOR_MISMATCH' });
        return;
      }
    }
    // Cursor validation: Last-Event-ID header or explicit ?cursor=.
    const lastEventId = req.headers['last-event-id'];
    const cursorParam = url.searchParams.get('cursor');
    const rawCursor =
      typeof lastEventId === 'string' && lastEventId.length > 0 ? lastEventId : cursorParam;
    let lastSeq = 0;
    if (rawCursor !== undefined && rawCursor !== null && rawCursor !== '') {
      const parsed = Number(rawCursor);
      if (!Number.isSafeInteger(parsed) || parsed < 0 || !/^\d+$/.test(String(rawCursor))) {
        sendJson(res, 400, { ok: false, code: 'VICT_STREAM_CURSOR_MALFORMED' });
        return;
      }
      if (parsed > (await options.hub.latestSeq(streamId))) {
        // A future cursor is rejected (no fabricated state).
        sendJson(res, 409, { ok: false, code: 'VICT_STREAM_CURSOR_FUTURE' });
        return;
      }
      lastSeq = parsed;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const subscriberId = `sse-${actor.actorId}-${Math.random().toString(36).slice(2, 10)}`;
    let open = true;
    const writeEvent = (event: AgentStreamEvent): boolean => {
      if (!open) {
        return false;
      }
      try {
        res.write(
          `id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify({
            schema: 'vict.agent-stream@1',
            ...event,
          })}\n\n`,
        );
        return true;
      } catch {
        open = false;
        return false;
      }
    };
    // Replay from the cursor (durable rows + buffered deltas).
    const replay = await options.hub.replay({ streamId, lastSeq });
    if (replay.olderThanBuffer) {
      // Authoritative durable state disclosure: completed content must be
      // recovered from the durable milestones (never from delta replay).
      res.write(
        `event: replay.bounded\ndata: ${JSON.stringify({
          schema: 'vict.agent-stream@1',
          streamId,
          note: 'cursor-older-than-buffer',
          newestSeq: replay.newestSeq,
        })}\n\n`,
      );
    }
    for (const event of replay.events) {
      if (!writeEvent(event)) {
        break;
      }
    }
    if (isTerminalTurn(streamTurn)) {
      // The turn is already terminal: close cleanly after replay.
      res.end();
      return;
    }
    await options.hub.subscribe(
      streamId,
      {
        subscriberId,
        deliver: (event) => writeEvent(event),
      },
      { lastSeq: replay.newestSeq },
    );
    // Drain buffered events when the client pulls (slow-client backpressure
    // coalescing happens inside the hub).
    const drainInterval = setInterval(() => {
      const pending = options.hub.pull(streamId, subscriberId);
      for (const event of pending) {
        if (!writeEvent(event)) {
          break;
        }
      }
    }, 50);
    req.on('close', () => {
      open = false;
      clearInterval(drainInterval);
      options.hub.unsubscribe(streamId, subscriberId);
    });
  }

  return {
    server,
    port: () => boundPort,
    async close(): Promise<void> {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        resolve();
      });
    },
  };
}

function isTerminalTurn(turn: { status: string } | undefined): boolean {
  return (
    turn !== undefined &&
    (turn.status === 'completed' ||
      turn.status === 'failed' ||
      turn.status === 'cancelled' ||
      turn.status === 'blocked')
  );
}

/** Listen on an ephemeral port (real HTTP, loopback). */
export function listenVictHttpServer(composed: VictHttpServer): Promise<number> {
  return new Promise((resolve, reject) => {
    composed.server.listen(0, '127.0.0.1', () => {
      const address = composed.server.address();
      if (address === null || typeof address === 'object') {
        const port = (address as { port: number }).port;
        resolve(port);
      } else {
        reject(new Error('the server did not bind a TCP port'));
      }
    });
  });
}
