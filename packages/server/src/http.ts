import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { VictControlError, type AgentControlStores, type AgentStreamHub } from '@vict/runtime';
import {
  AGENT_STREAM_SCHEMA,
  assertAgentStreamWireEnvelope,
  type AgentStreamEvent,
} from '@vict/contracts';
import { AuthenticationError, type ServerActorContext } from './auth.js';
import { VictCommandService, type VictCommandOutcome } from './commands.js';

/**
 * Stage 06B — the VICT-owned HTTP boundary (AI-015).
 *
 * Versioned commands under `/vict/v1/*` plus resumable SSE under
 * `/vict/v1/streams/:streamId`. Hard transport rules:
 *
 * - closed request schemas and a bounded request body (256 KiB);
 * - EXACT content-type handling (`application/json`, optional charset);
 * - stable status/error mapping — malformed JSON, unknown routes, and
 *   unsupported methods fail with structured, non-echoing bodies;
 * - the durable `Idempotency-Key` boundary for state-changing commands is
 *   enforced below the transport by the shared command service;
 * - the authenticated server context on EVERY protected operation — no
 *   client-supplied identity is ever authoritative;
 * - SSE is ACTOR-SCOPED: a stream without a matching, valid turn ownership
 *   record is denied — never treated as public; every emitted frame is a
 *   closed `vict.agent-stream@1` wire envelope validated before write;
 * - Node HTTP backpressure is honored: `response.write() === false` means
 *   the bytes were ACCEPTED, and the remaining replay is delivered after
 *   `drain` — never discarded;
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
  | 'VICT_HTTP_FIELD_INVALID'
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
  /** The actual listening port (0 before `listen`). */
  port(): number;
  /** Await actual shutdown, including open SSE subscribers. */
  close(): Promise<void>;
}

/** Map a command dispatch failure to a stable HTTP status. */
function statusForError(code: string | undefined): number {
  if (code === undefined) {
    return 500;
  }
  switch (code) {
    case 'VICT_AUTH_TOKEN_MISSING':
    case 'VICT_AUTH_TOKEN_UNKNOWN':
      return 401;
    case 'VICT_ACTOR_SCOPE_DENIED':
      return 403;
    case 'VICT_COMMAND_UNKNOWN':
    case 'VICT_CONTROL_CHANGESET_MISSING':
    case 'VICT_TURN_MISSING':
    case 'VICT_APPROVAL_MISSING':
    case 'VICT_CONTROL_RELEASE_MISSING':
    case 'VICT_CONTROL_TURN_MISSING':
    case 'VICT_CONTROL_INVOCATION_MISSING':
    case 'VICT_CONTROL_APPROVAL_MISSING':
    case 'VICT_STORE_ACTIVATION_NOT_FOUND':
    case 'VICT_STORE_RELEASE_NOT_FOUND':
    case 'VICT_STREAM_ACTOR_MISMATCH':
    case 'VICT_TURN_ACTOR_MISMATCH':
      return 404;
    case 'VICT_COMMAND_FIELD_INVALID':
    case 'VICT_COMMAND_PAYLOAD_INVALID':
    case 'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID':
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
    case 'VICT_COMMAND_IDEMPOTENCY_CONFLICT':
    case 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS':
    case 'VICT_CONTROL_BASE_STALE':
    case 'VICT_STREAM_CURSOR_FUTURE':
      return 409;
    case 'VICT_CONTROL_APPROVAL_CONFLICT':
    case 'VICT_CONTROL_APPROVALS_INVALIDATED':
    case 'VICT_CONTROL_CHANGESET_NOT_APPROVED':
    case 'VICT_CONTROL_CHANGESET_NOT_DRAFT':
    case 'VICT_CONTROL_CHANGESET_EXPIRED':
    case 'VICT_CONTROL_CHANGESET_STATUS_CONFLICT':
    case 'VICT_CONTROL_EVIDENCE_MISSING':
    case 'VICT_CONTROL_EVIDENCE_FAILED':
    case 'VICT_CONTROL_EVIDENCE_STALE':
    case 'VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE':
    case 'VICT_CONTROL_EVIDENCE_SUBJECT_MISMATCH':
    case 'VICT_CONTROL_EVIDENCE_CONTENT_MISMATCH':
    case 'VICT_CONTROL_EVIDENCE_BASE_MISMATCH':
    case 'VICT_CONTROL_EVIDENCE_ACTOR_MISMATCH':
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
      if (code.startsWith('VICT_ACTOR_')) {
        return 403;
      }
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

/**
 * EXACT supported Content-Type parsing: the media type must be exactly
 * `application/json` (case-insensitive) with at most an optional charset
 * parameter (`utf-8`/`us-ascii`). Near-miss types fail closed.
 */
export function isSupportedJsonContentType(contentType: string): boolean {
  const parts = contentType.split(';').map((part) => part.trim());
  const mediaType = parts[0]?.toLowerCase();
  if (mediaType !== 'application/json') {
    return false;
  }
  for (const parameter of parts.slice(1)) {
    if (parameter.length === 0) {
      continue;
    }
    const [name, value] = parameter.split('=', 2);
    if (name?.trim().toLowerCase() !== 'charset') {
      return false;
    }
    const charset = value?.trim().toLowerCase().replace(/^"|"$/g, '');
    if (charset !== 'utf-8' && charset !== 'us-ascii') {
      return false;
    }
  }
  return true;
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
  '/vict/v1/changesets/check': () => 'changeset.execute-check',
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

/** The bounded reconnect cursor: `v1:<streamId>:<lastSeq>`. */
const CURSOR_PATTERN = /^v1:([A-Za-z0-9][A-Za-z0-9._:@-]{0,127}):(\d{1,19})$/;

export function encodeStreamCursor(streamId: string, lastSeq: number): string {
  return `v1:${streamId}:${lastSeq}`;
}

export interface DecodedStreamCursor {
  readonly streamId: string;
  readonly lastSeq: number;
}

export function decodeStreamCursor(raw: string): DecodedStreamCursor | undefined {
  const match = CURSOR_PATTERN.exec(raw);
  if (match === null) {
    return undefined;
  }
  const lastSeq = Number(match[2]);
  if (!Number.isSafeInteger(lastSeq) || lastSeq < 0) {
    return undefined;
  }
  return { streamId: match[1] as string, lastSeq };
}

/** Create the composed VICT HTTP + SSE server (not yet listening). */
export function createVictHttpServer(options: VictHttpServerOptions): VictHttpServer {
  let boundAddress: { port: number } | undefined;
  const openStreams = new Set<ServerResponse>();
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
  // Track the REAL bound port (0 before `listen`).
  const refreshBoundAddress = (): void => {
    const address = server.address();
    if (address !== null && typeof address === 'object') {
      boundAddress = { port: address.port };
    }
  };
  server.on('listening', refreshBoundAddress);
  refreshBoundAddress();

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
      try {
        await handleSse(req, res, actor, streamMatch[1] as string, url);
      } catch (error) {
        // Headers may already be flushed: end the stream cleanly instead
        // of leaving the socket half-open.
        if (!res.writableEnded) {
          try {
            if (res.headersSent) {
              res.end();
            } else {
              sendJson(res, 500, { ok: false, code: 'VICT_HTTP_INTERNAL' });
            }
          } catch {
            res.destroy();
          }
        }
        void error;
      }
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

    let body: string;
    if (req.method === 'POST' || req.method === 'PUT') {
      // EXACT supported content type (application/json, optional charset).
      const contentType = req.headers['content-type'];
      if (typeof contentType !== 'string' || !isSupportedJsonContentType(contentType)) {
        throw new HttpError('VICT_HTTP_CONTENT_TYPE_INVALID', 415);
      }
      body = await readBody(req, res);
    } else if (req.method === 'GET') {
      // GET commands may carry bounded query payloads.
      const queryPayload: Record<string, unknown> = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (queryPayload[key] === undefined) {
          queryPayload[key] = value;
        }
      }
      body = JSON.stringify({ payload: queryPayload });
    } else {
      body = '{}';
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
    let payload: unknown = (parsed as Record<string, unknown>).payload;
    if (payload === undefined) {
      payload = {};
    }
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      if (Object.keys(payload as Record<string, unknown>).length > 64) {
        throw new HttpError('VICT_HTTP_RATE_BOUNDS', 400);
      }
    }
    // Dynamic instance routes inject the authoritative path identity into
    // the bounded payload (path params win over client-supplied fields).
    const resolved = resolveCommand(
      req,
      path,
      url,
      (typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? payload
        : {}) as Record<string, unknown>,
    );
    if (resolved.pathParams !== undefined) {
      payload = { ...(payload as Record<string, unknown>), ...resolved.pathParams };
    }
    const idempotencyKey = req.headers['idempotency-key'];
    const command = resolved.command as never;
    const outcome = await options.commandService.dispatch(actor, {
      command,
      payload: payload as Record<string, unknown>,
      ...(typeof idempotencyKey === 'string' ? { idempotencyKey } : {}),
    });
    if (!outcome.ok) {
      sendJson(res, statusForError(outcome.code), outcomeBody(outcome));
      return;
    }
    sendJson(res, 200, outcomeBody(outcome));
  }

  /** The resolved command plus authoritative path parameters. */
  interface ResolvedRoute {
    readonly command: string;
    readonly pathParams?: Record<string, string>;
  }

  /** Resolve the command from the request (closed route table). */
  function resolveCommand(
    req: IncomingMessage,
    path: string,
    url: URL,
    payload: Record<string, unknown>,
  ): ResolvedRoute {
    // GET routes with fixed commands (checked first for dual-verb paths).
    if (req.method === 'GET') {
      const fixedGet = ROUTE_COMMANDS[path];
      if (fixedGet !== undefined) {
        return { command: fixedGet };
      }
    }
    // Explicit POST routes.
    const post = POST_ROUTES[path];
    if (post !== undefined) {
      if (req.method !== 'POST') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return { command: post() };
    }
    // GET routes with fixed commands.
    const fixed = ROUTE_COMMANDS[path];
    if (fixed !== undefined) {
      if (req.method !== 'GET') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return { command: fixed };
    }
    // Dynamic instance routes.
    const changesetMatch = /^\/vict\/v1\/changesets\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(
      path,
    );
    if (changesetMatch !== null) {
      if (req.method !== 'GET') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return { command: 'changeset.get', pathParams: { changesetId: changesetMatch[1] as string } };
    }
    const turnMatch = /^\/vict\/v1\/turns\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(path);
    if (turnMatch !== null) {
      if (req.method !== 'GET') {
        throw new HttpError('VICT_HTTP_METHOD_UNSUPPORTED', 405);
      }
      return { command: 'agent.turn.get', pathParams: { turnId: turnMatch[1] as string } };
    }
    const approvalMatch = /^\/vict\/v1\/approvals\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})$/.exec(
      path,
    );
    if (approvalMatch !== null && req.method === 'POST') {
      // The decision is part of the closed route contract: the approve and
      // decline commands are distinct in the versioned command surface.
      const decision = payload['decision'];
      if (decision === 'approved') {
        return {
          command: 'agent.tool.approve',
          pathParams: { approvalId: approvalMatch[1] as string },
        };
      }
      if (decision === 'declined') {
        return {
          command: 'agent.tool.decline',
          pathParams: { approvalId: approvalMatch[1] as string },
        };
      }
      throw new HttpError('VICT_HTTP_FIELD_INVALID', 400);
    }
    const streamInspect =
      /^\/vict\/v1\/streams\/([A-Za-z0-9][A-Za-z0-9._:@-]{0,127})\/inspect$/.exec(path);
    if (streamInspect !== null && req.method === 'GET') {
      return { command: 'stream.inspect', pathParams: { streamId: streamInspect[1] as string } };
    }
    throw new HttpError('VICT_HTTP_ROUTE_UNKNOWN', 404);
  }

  const TERMINAL_EVENT_KINDS: ReadonlySet<string> = new Set([
    'response.completed',
    'response.failed',
    'response.cancelled',
  ]);

  async function handleSse(
    req: IncomingMessage,
    res: ServerResponse,
    actor: ServerActorContext,
    streamId: string,
    url: URL,
  ): Promise<void> {
    // ---- AUTHORIZATION (fail closed; never treat a stream as public) ----
    // A stream is readable by its owning actor; broader access requires the
    // explicit privileged `operator.resolve` scope. Durable rows without a
    // matching, valid turn ownership record DENY access: a stream that no
    // turn owns does not exist for this caller.
    const turnRows = await options.stores.turns.listTurns();
    const streamTurn = turnRows.find((turn) => turn.streamId === streamId);
    if (streamTurn === undefined) {
      sendJson(res, 404, { ok: false, code: 'VICT_STREAM_UNKNOWN' });
      return;
    }
    if (streamTurn.actorId !== actor.actorId && !actor.scopes.includes('operator.resolve')) {
      sendJson(res, 403, { ok: false, code: 'VICT_STREAM_ACTOR_MISMATCH' });
      return;
    }
    // ---- Cursor validation (stream identity + sequence) ------------------
    const lastEventId = req.headers['last-event-id'];
    const cursorParam = url.searchParams.get('cursor');
    const rawCursor =
      typeof lastEventId === 'string' && lastEventId.length > 0 ? lastEventId : cursorParam;
    let lastSeq = 0;
    if (rawCursor !== undefined && rawCursor !== null && rawCursor !== '') {
      const decoded = typeof rawCursor === 'string' ? decodeStreamCursor(rawCursor) : undefined;
      if (decoded === undefined) {
        sendJson(res, 400, { ok: false, code: 'VICT_STREAM_CURSOR_MALFORMED' });
        return;
      }
      if (decoded.streamId !== streamId) {
        // A cursor from ANOTHER stream is rejected (cross-stream replay).
        sendJson(res, 403, { ok: false, code: 'VICT_STREAM_CURSOR_STREAM_MISMATCH' });
        return;
      }
      // Future detection uses the AUTHORITATIVE durable sequence bound
      // (the ledger), which survives restart when the memory buffer is empty.
      if (decoded.lastSeq > (await options.hub.latestSeq(streamId))) {
        sendJson(res, 409, { ok: false, code: 'VICT_STREAM_CURSOR_FUTURE' });
        return;
      }
      lastSeq = decoded.lastSeq;
    }
    // ---- Replay bounds BEFORE streaming (response-mechanism disclosure) --
    const replay = await options.hub.replay({ streamId, lastSeq });
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      // Replay status is NOT an event: it crosses the boundary through this
      // separately defined response mechanism (headers). An authoritative
      // `true` discloses that transient deltas between the cursor and the
      // buffer are unrecoverable and completed content must be recovered
      // from the durable, actor-authorized conversation store.
      ...(replay.olderThanBuffer ? { 'x-vict-replay-bounded': 'true' } : {}),
      'x-vict-stream-newest-seq': String(replay.newestSeq),
      'x-vict-stream-cursor': encodeStreamCursor(streamId, replay.newestSeq),
    });
    res.flushHeaders?.();
    // Flush the SSE handshake immediately so clients observe the response.
    res.write(': connected\n\n');
    openStreams.add(res);
    let closed = false;
    let drainScheduled = false;
    let terminalReached = false;

    const finish = (): void => {
      if (!closed) {
        closed = true;
        openStreams.delete(res);
        options.hub.unsubscribe(streamId, subscriberId);
        res.end();
      }
    };

    /** Serialize one frame as a closed wire envelope (validated; fail closed). */
    const serializeFrame = (event: AgentStreamEvent): string => {
      const frame = { schema: AGENT_STREAM_SCHEMA, ...event };
      // Every server-emitted frame conforms to the ONE closed wire-envelope
      // validator — including frames reconstructed from durable rows.
      assertAgentStreamWireEnvelope(frame);
      return `id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(frame)}\n\n`;
    };

    /** Write until backpressure; returns false when the socket is saturated. */
    const writeFrames = (events: readonly AgentStreamEvent[]): boolean => {
      for (const event of events) {
        if (TERMINAL_EVENT_KINDS.has(event.kind)) {
          terminalReached = true;
        }
        try {
          res.write(serializeFrame(event));
        } catch {
          finish();
          return false;
        }
      }
      return res.writableNeedDrain !== true;
    };

    const subscriberId = `sse-${actor.actorId}-${Math.random().toString(36).slice(2, 10)}`;
    // The authorized replay is written BEFORE the live subscription: Node
    // buffers accepted bytes, so the full replay is always written (never
    // discarded on backpressure — the `drain` event resumes live delivery).
    writeFrames(replay.events);
    if (terminalReached) {
      // The turn became terminal within the replay: close cleanly after it.
      finish();
      return;
    }
    // The subscription is anchored AT the replay cursor: the hub delivers
    // only NEW events, and its pending queue + `drain` pump carry any live
    // backpressure.
    await options.hub.subscribe(
      streamId,
      {
        subscriberId,
        deliver: (event) => writeFrames([event]),
      },
      { lastSeq: replay.newestSeq },
    );
    const pump = (): void => {
      if (closed || drainScheduled) {
        return;
      }
      drainScheduled = true;
      setImmediate(() => {
        drainScheduled = false;
        if (closed) {
          return;
        }
        const pending = options.hub.pull(streamId, subscriberId);
        const flushed = writeFrames(pending);
        if (terminalReached) {
          // The terminal event (and everything before it) has been written;
          // close the stream cleanly after the turn became terminal.
          finish();
          return;
        }
        if (!flushed) {
          return; // the next `drain` re-schedules the pump
        }
      });
    };
    res.on('drain', () => {
      // `response.write() === false` means the bytes were ACCEPTED; resume
      // delivery only when the socket has drained.
      pump();
    });
    pump();
    req.on('close', () => {
      finish();
    });
  }

  server.on('close', () => {
    for (const res of openStreams) {
      try {
        res.end();
      } catch {
        /* already gone */
      }
    }
    openStreams.clear();
  });

  return {
    server,
    port: () => boundAddress?.port ?? 0,
    async close(): Promise<void> {
      // Await ACTUAL shutdown: close the server, end every open SSE
      // subscriber, and resolve only when the server emits its close event.
      for (const res of openStreams) {
        try {
          res.end();
        } catch {
          /* already gone */
        }
      }
      openStreams.clear();
      await new Promise<void>((resolve) => {
        if (server.listening) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    },
  };
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
