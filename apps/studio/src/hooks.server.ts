import type { Handle } from '@sveltejs/kit';

/**
 * STUDIO REQUEST BOUNDARY — BUILDER TRACK `studio-server` OWNS THIS FILE.
 *
 * This scaffold stub exists only so the app runs before the real boundary
 * lands. Replace it with the D-2/D-7 boundary: session resolution from the
 * HttpOnly cookie into `locals.session`, Origin/Host checks on
 * state-changing requests, and the session-bound CSRF enforcement for JSON
 * requests. Unauthenticated page navigations redirect to `/login`; API and
 * non-GET JSON requests fail closed (401/403, non-echoing).
 */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = null;
  return resolve(event);
};
