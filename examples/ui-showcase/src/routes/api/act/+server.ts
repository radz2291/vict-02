import { json } from '@sveltejs/kit';
import { serverForId } from '$lib/server/preview-server';
import type { RequestHandler } from './$types';

// The ONLY action boundary of the showcase. Every non-local action crosses
// the server-side authorization/effect boundary here; local and navigation
// actions never reach this endpoint at all (the renderer executes them
// client-side).
export const POST: RequestHandler = async ({ request, url }) => {
  const app = serverForId(url.searchParams.get('application'));
  if (!app)
    return json(
      { ok: false, code: 'UNKNOWN_APPLICATION', message: 'This application is not registered.' },
      { status: 404 },
    );
  let body: { actionId?: unknown; input?: unknown };
  try {
    body = (await request.json()) as { actionId?: unknown; input?: unknown };
  } catch {
    return json(
      { ok: false, code: 'INVALID_REQUEST', message: 'The request body must be JSON.' },
      { status: 400 },
    );
  }
  if (typeof body.actionId !== 'string' || body.actionId.length === 0) {
    return json(
      { ok: false, code: 'INVALID_REQUEST', message: 'actionId is required.' },
      { status: 400 },
    );
  }
  const result = await app.dispatch(body.actionId, body.input, url.searchParams.get('path'));
  return json(result);
};
