import { randomBytes } from 'node:crypto';

/**
 * HUMAN SESSION BOUNDARY (D-2) — server-side only.
 *
 * Human operator credentials are locally provisioned by the deployment
 * (env VICT_STUDIO_HUMAN_CREDENTIALS: JSON map label -> {secret}), with a
 * local-demo default. Sessions are in-memory (short-lived, restart-truthful).
 * The CSRF token is bound to the session and surfaced ONLY server-side
 * through `locals`; it never enters a cookie, a response body, or hydration
 * data.
 */

export const SESSION_COOKIE_NAME = 'vict_studio_session';
export const SESSION_MAX_AGE_SECONDS = 28800; // 8h, short-lived

export interface StudioSession {
  readonly sessionId: string;
  readonly csrfToken: string;
  readonly actorLabel: string;
}

interface StoredSession extends StudioSession {
  readonly expiresAt: number;
}

function parseHumanCredentials(): Readonly<Record<string, string>> {
  const raw = process.env['VICT_STUDIO_HUMAN_CREDENTIALS'];
  const fallback = { operator: 'studio-local-pass' };
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [label, value] of Object.entries(parsed)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>)['secret'] === 'string'
      ) {
        out[label] = (value as Record<string, unknown>)['secret'] as string;
      }
    }
    return Object.keys(out).length > 0 ? out : fallback;
  } catch {
    return fallback;
  }
}

const humanCredentials = parseHumanCredentials();
const sessions = new Map<string, StoredSession>();

function isLive(session: StoredSession): boolean {
  return session.expiresAt > Date.now();
}

/** Verify a human label+secret pair; issue a session or null (non-echoing). */
export function createSession(label: string, secret: string): StudioSession | null {
  const expected = humanCredentials[label];
  if (expected === undefined || expected !== secret) {
    return null;
  }
  const session: StoredSession = {
    sessionId: randomBytes(32).toString('hex'),
    csrfToken: randomBytes(32).toString('hex'),
    actorLabel: label,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  sessions.set(session.sessionId, session);
  return { sessionId: session.sessionId, csrfToken: session.csrfToken, actorLabel: label };
}

/** Resolve a session id; expired or unknown ids resolve to null. */
export function getSession(sessionId: string): StudioSession | null {
  const stored = sessions.get(sessionId);
  if (stored === undefined || !isLive(stored)) {
    if (stored !== undefined) {
      sessions.delete(sessionId);
    }
    return null;
  }
  return {
    sessionId: stored.sessionId,
    csrfToken: stored.csrfToken,
    actorLabel: stored.actorLabel,
  };
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

/** The session cookie: HttpOnly, SameSite=Lax, path '/', bounded lifetime. */
export function serializeSessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

/** An expired cookie that clears the session on the client. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Read one cookie value from a raw Cookie header. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (header === null) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}
