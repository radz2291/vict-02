/**
 * Stage 06B — `@vict/cli`: the typed operator/developer command client.
 *
 * The CLI consumes the SAME versioned VICT command surface as the HTTP
 * boundary (identical routes, envelopes and stable error codes). It never
 * opens a store, reads SQLite, or bypasses governance: every operation is
 * performed by the composed `VictCommandService` behind `@vict/server`.
 *
 * The client contract is stable and tested:
 * - requests are JSON with bearer authentication;
 * - responses parse into the closed `{ ok, data } / { ok: false, code }`
 *   envelope;
 * - non-ok envelopes and transport failures become typed CLI errors;
 * - no hostile value is ever echoed into CLI diagnostics.
 */

export const VICT_CLI_SCHEMA = 'vict.cli@1' as const;

/** Typed CLI failure. `code` is the stable server code or a CLI-local one. */
export class VictCliError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'VictCliError';
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

/** The parsed command envelope (closed shape). */
export interface VictCliEnvelope {
  ok: boolean;
  data?: Record<string, unknown>;
  code?: string;
}

export interface VictHttpClientOptions {
  /** Base URL, e.g. `http://127.0.0.1:8787`. */
  readonly endpoint: string;
  /** Bearer token presented on every request. */
  readonly token: string;
  /** Request timeout in milliseconds (default 10s). */
  readonly timeoutMs?: number;
}

/**
 * Thin typed HTTP client for the VICT command surface. Shared contract for
 * the CLI binary and any operator tooling.
 */
export class VictHttpClient {
  readonly #options: Required<VictHttpClientOptions>;

  constructor(options: VictHttpClientOptions) {
    this.#options = {
      timeoutMs: 10_000,
      ...options,
      endpoint: options.endpoint.replace(/\/+$/, ''),
    };
  }

  /** Perform one command request and return the DATA of an ok envelope.
   * POST bodies use the versioned `{ payload }` envelope; GET payloads are
   * supplied as `query` and encoded as bounded query parameters.
   */
  async request(
    method: 'GET' | 'POST',
    path: string,
    input?: { payload?: Record<string, unknown>; query?: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const url = `${this.#options.endpoint}${path}${method === 'GET' && input?.query !== undefined ? toQueryString(input.query) : ''}`;
    const body =
      method === 'POST' && input?.payload !== undefined
        ? JSON.stringify({ payload: input.payload })
        : undefined;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${this.#options.token}`,
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body } : {}),
        signal: AbortSignal.timeout(this.#options.timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'failed';
      throw new VictCliError('VICT_CLI_TRANSPORT', `The VICT endpoint ${reason}.`, undefined);
    }
    const text = await response.text();
    let envelope: VictCliEnvelope;
    try {
      envelope = JSON.parse(text) as VictCliEnvelope;
    } catch {
      throw new VictCliError(
        'VICT_CLI_MALFORMED_RESPONSE',
        'The VICT endpoint returned a malformed response.',
        response.status,
      );
    }
    if (typeof envelope.ok !== 'boolean') {
      throw new VictCliError(
        'VICT_CLI_MALFORMED_RESPONSE',
        'The VICT endpoint returned a malformed response.',
        response.status,
      );
    }
    if (!envelope.ok) {
      throw new VictCliError(
        typeof envelope.code === 'string' ? envelope.code : 'VICT_CLI_UNKNOWN_ERROR',
        safeStatusMessage(response.status, envelope.code),
        response.status,
      );
    }
    return envelope.data ?? {};
  }
}

/** Encode a GET command payload as a bounded query string. */
function toQueryString(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._:@/-]{0,199}$/.test(value)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

/** Stable, non-echoing status text for rejected commands. */
function safeStatusMessage(status: number, code: unknown): string {
  if (typeof code === 'string' && /^VICT_[A-Z0-9_]{1,96}$/.test(code)) {
    return `The command was rejected (${code}, HTTP ${status}).`;
  }
  return `The command was rejected (HTTP ${status}).`;
}
