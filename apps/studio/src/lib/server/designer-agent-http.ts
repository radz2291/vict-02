import { json } from '@sveltejs/kit';
import type { StudioSession } from './session.js';
import { AGENT_REQUEST_BYTES } from '../designer/agent-transport.js';
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
  const reader = request.body?.getReader();
  if (!reader)
    return {
      ok: false,
      response: json({ ok: false, code: 'STUDIO_AGENT_REQUEST' }, { status: 400 }),
    };
  let length = 0;
  let oversized = false;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > AGENT_REQUEST_BYTES) {
        // adapter-node maps stream cancellation to IncomingMessage.destroy(),
        // which closes the socket before a structured refusal can be delivered.
        // Discard excess bytes under the host's 2M cap without retaining them.
        oversized = true;
        chunks.length = 0;
        continue;
      }
      chunks.push(next.value);
    }
    if (oversized) return {
      ok: false,
      response: json({ ok: false, code: 'STUDIO_AGENT_REQUEST_LIMIT', message: 'Aggregate UTF-8 request exceeds admission.', limitBytes: AGENT_REQUEST_BYTES }, { status: 413 }),
    };
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 413)
      return { ok: false, response: json({ ok: false, code: 'STUDIO_AGENT_REQUEST_LIMIT', message: 'The HTTP host rejected this body. Use BODY_SIZE_LIMIT=2M for advertised source limits.' }, { status: 413 }) };
    return {
      ok: false,
      response: json({ ok: false, code: 'STUDIO_AGENT_REQUEST' }, { status: 400 }),
    };
  } finally {
    reader.releaseLock();
  }
}
