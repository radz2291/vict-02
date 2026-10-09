import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { RequestHandler } from './$types';

// GENERIC ACTION BOUNDARY — scaffolder-owned, domain-free.
//
// The ONLY action boundary of the application. Every non-local action
// crosses the server-side authorization/contract/effect boundary here;
// local and navigation actions never reach this endpoint at all. The
// (asynchronous) application is awaited; declared input contracts are
// pre-validated inside the dispatcher BEFORE any governed run or durable
// mutation. This file contains no domain facts and never needs editing.
export const POST: RequestHandler = async ({ request }) => {
  const app = await getAppServer();
  let body: { actionId?: unknown; input?: unknown };
  try {
    body = (await request.json()) as { actionId?: unknown; input?: unknown };
  } catch {
    return json({ ok: false, code: 'INVALID_REQUEST', message: 'The request body must be JSON.' }, { status: 400 });
  }
  if (typeof body.actionId !== 'string' || body.actionId.length === 0) {
    return json({ ok: false, code: 'INVALID_REQUEST', message: 'actionId is required.' }, { status: 400 });
  }
  const result = await app.dispatch(body.actionId, body.input);
  return json(result);
};
