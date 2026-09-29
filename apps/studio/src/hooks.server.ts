import { json, redirect, type Handle } from '@sveltejs/kit';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  destroySession,
  getSession,
  readCookie,
} from './lib/server/session.js';

/**
 * STUDIO REQUEST BOUNDARY (D-2/D-7) — the single request door.
 *
 * Fail-closed rules, in order:
 * 1. Cookie -> `locals.session` (null when absent/expired; the session id
 *    and CSRF token never enter a response body or hydration data).
 * 2. EVERY non-GET/HEAD request requires a present Origin header that is
 *    same-origin with the Host (scheme http/https, host equality); else
 *    403 VICT_STUDIO_ORIGIN (non-echoing).
 * 3. JSON requests require the session-bound `x-vict-csrf` header; an
 *    unauthenticated JSON request is 401 VICT_STUDIO_UNAUTHENTICATED.
 * 4. Unauthenticated page navigations (accept: text/html) redirect 303 to
 *    /login; other unauthenticated requests fail closed with 401.
 * 5. Exempt exactly: /login (GET+POST), /logout POST (handled here:
 *    destroy + redirect), and static/_app assets.
 *
 * Error bodies never echo credential material, session ids, or raw errors.
 */

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_app/') ||
    pathname.startsWith('/@fs/') ||
    pathname.startsWith('/@vite/') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.png'
  );
}

/** Origin must be present, http(s), and host-equal with the request Host. */
function isSameOrigin(origin: string | null, host: string): boolean {
  if (origin === null || origin.length === 0) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  return parsed.host === host;
}

function isJsonRequest(contentType: string | null): boolean {
  return (contentType?.split(';')[0]?.trim().toLowerCase() ?? '') === 'application/json';
}

function reject(code: string, status: number): Response {
  return json({ ok: false, code }, { status });
}

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  const method = event.request.method;

  if (isStaticAsset(path)) {
    return resolve(event);
  }

  // (a) Cookie -> session (server-side only).
  const sid = readCookie(event.request.headers.get('cookie'), SESSION_COOKIE_NAME);
  const session = sid === undefined ? null : getSession(sid);
  event.locals.session = session;

  // (b) Origin/Host same-origin enforcement for ALL state-changing methods.
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = event.request.headers.get('origin');
    const host = event.request.headers.get('host') ?? event.url.host;
    if (!isSameOrigin(origin, host)) {
      return reject('VICT_STUDIO_ORIGIN', 403);
    }
  }

  // (e) Logout POST: destroy + clear cookie + redirect (handled here).
  if (path === '/logout' && method === 'POST') {
    if (session !== null) {
      destroySession(session.sessionId);
    }
    return new Response(null, {
      status: 303,
      headers: { location: '/login', 'set-cookie': clearSessionCookie() },
    });
  }

  const contentType = event.request.headers.get('content-type');
  if (isJsonRequest(contentType)) {
    // (c) JSON: CSRF + authentication, fail closed.
    if (session === null) {
      return reject('VICT_STUDIO_UNAUTHENTICATED', 401);
    }
    const csrf = event.request.headers.get('x-vict-csrf');
    if (csrf !== session.csrfToken) {
      return reject('VICT_STUDIO_CSRF', 403);
    }
  } else if (path !== '/login' && session === null) {
    // (d) Unauthenticated: navigations go to /login, everything else 401s.
    const accept = event.request.headers.get('accept') ?? '';
    if (accept.includes('text/html')) {
      redirect(303, '/login');
    }
    return reject('VICT_STUDIO_UNAUTHENTICATED', 401);
  }

  return resolve(event);
};
