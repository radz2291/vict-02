import { json, type RequestHandler } from '@sveltejs/kit';
import { acceptVisualCapture, refuseVisualCapture, VISUAL_LIMITS } from '$lib/server/designer-visual.js';

/** A bounded binary image route, separate from ordinary tool JSON snapshots. No persistence. */
export const POST: RequestHandler = async ({ request, locals, params }) => {
  if (!locals.session) return json({ ok: false, code: 'VICT_STUDIO_UNAUTHENTICATED' }, { status: 401 });
  if (request.headers.get('x-vict-csrf') !== locals.session.csrfToken) return json({ ok: false, code: 'VICT_STUDIO_CSRF' }, { status: 403 });
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (!['image/jpeg', 'application/json'].includes(contentType ?? '')) return json({ ok: false, code: 'STUDIO_CAPTURE_CONTENT_TYPE' }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false, code: 'STUDIO_CAPTURE_INVALID' }, { status: 400 });
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength;
      if (length > (contentType === 'image/jpeg' ? VISUAL_LIMITS.bytes : 2048)) { await reader.cancel(); return json({ ok: false, code: 'STUDIO_CAPTURE_IMAGE_LIMIT' }, { status: 413 }); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const owner = locals.session.sessionId; const id = params.captureId!;
    if (contentType === 'application/json') {
      const value = JSON.parse(new TextDecoder().decode(bytes));
      const ok = refuseVisualCapture(owner, id, typeof value?.code === 'string' ? value.code : 'STUDIO_CAPTURE_FAILED');
      return json({ ok }, { status: ok ? 200 : 404 });
    }
    const metadata = request.headers.get('x-vict-capture');
    if (!metadata || metadata.length > VISUAL_LIMITS.metadata) return json({ ok: false, code: 'STUDIO_CAPTURE_METADATA_LIMIT' }, { status: 400 });
    const result = acceptVisualCapture(owner, id, JSON.parse(decodeURIComponent(metadata)), bytes);
    return json(result, { status: result.ok ? 200 : result.code === 'STUDIO_CAPTURE_UNAVAILABLE' ? 404 : result.code === 'STUDIO_CAPTURE_STALE' ? 409 : 400, headers: { 'cache-control': 'no-store' } });
  } catch { return json({ ok: false, code: 'STUDIO_CAPTURE_INVALID' }, { status: 400 }); }
  finally { reader.releaseLock(); }
};
