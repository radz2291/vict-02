import { json } from '@sveltejs/kit';
import { getReferenceServer } from '$lib/server/application-server.sqlite';
import type { RequestHandler } from './$types';

// The ONLY action boundary of the application. Every non-local action
// crosses the server-side authorization/effect boundary here; local actions
// never reach this endpoint at all (the renderer executes them locally).
export const POST: RequestHandler = async ({ request }) => {
  const app = getReferenceServer();
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
  const result = await app.dispatch(body.actionId, body.input);
  return json(result);
};
