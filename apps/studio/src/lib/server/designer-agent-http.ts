import { json } from '@sveltejs/kit';
import type { StudioSession } from './session.js';
/** Every mutation also checks its boundary locally (including non-JSON probes). */
export async function agentJson(
  request: Request,
  session: StudioSession | null | undefined,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  if (!session)
    return {
      ok: false,
      response: json({ ok: false, code: 'VICT_STUDIO_UNAUTHENTICATED' }, { status: 401 }),
    };
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
  )
    return {
      ok: false,
      response: json({ ok: false, code: 'STUDIO_AGENT_CONTENT_TYPE' }, { status: 415 }),
    };
  if (request.headers.get('x-vict-csrf') !== session.csrfToken)
    return { ok: false, response: json({ ok: false, code: 'VICT_STUDIO_CSRF' }, { status: 403 }) };
  try {
    return {
      ok: true,
      value: JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(await request.arrayBuffer()),
      ),
    };
  } catch {
    return {
      ok: false,
      response: json({ ok: false, code: 'STUDIO_AGENT_REQUEST' }, { status: 400 }),
    };
  }
}
