import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProofServer } from '$lib/application/server';

// The server action boundary: EVERY non-local action crosses here, where
// the authorization profile lives and the Vict runtime enforces effect
// policy. The UI cannot bypass this endpoint.
export const POST: RequestHandler = async ({ request }) => {
  const server = getProofServer();
  let body: { actionId?: unknown; input?: unknown };
  try {
    body = (await request.json()) as { actionId?: unknown; input?: unknown };
  } catch {
    return json({ ok: false, code: 'BAD_REQUEST', message: 'A JSON body is required.' }, { status: 400 });
  }
  if (typeof body.actionId !== 'string') {
    return json({ ok: false, code: 'BAD_REQUEST', message: 'actionId is required.' }, { status: 400 });
  }
  const result = await server.dispatch(body.actionId, body.input);
  return json(result);
};
