import { json, type RequestHandler } from '@sveltejs/kit';
import { toolEvidenceArchive } from '$lib/server/tool-evidence-archive.js';
export const GET: RequestHandler = async ({ locals, url }) => {
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (!locals.session) return json({ ok: false, code: 'VICT_STUDIO_UNAUTHENTICATED' }, { status: 401, headers });
  const allowed = new Set(['id', 'offset', 'limit']);
  if ([...url.searchParams.keys()].some(key => !allowed.has(key) || url.searchParams.getAll(key).length !== 1)) return json({ ok: false, code: 'STUDIO_EVIDENCE_QUERY' }, { status: 400, headers });
  const offsetText = url.searchParams.get('offset') ?? '0', limitText = url.searchParams.get('limit') ?? '6000';
  if (!/^\d+$/.test(offsetText) || !Number.isSafeInteger(Number(offsetText)) || !/^\d+$/.test(limitText) || !Number.isSafeInteger(Number(limitText)) || Number(limitText) < 1 || Number(limitText) > 6000) return json({ ok: false, code: 'STUDIO_EVIDENCE_QUERY' }, { status: 400, headers });
  try {
    const page = await toolEvidenceArchive.page(locals.session.sessionId, url.searchParams.get('id') ?? '', Number(offsetText), Number(limitText));
    return page ? json({ ok: true, ...page }, { headers }) : json({ ok: false, code: 'STUDIO_EVIDENCE_UNAVAILABLE', message: 'Evidence is unavailable, legacy-expired or outside this session. No tool was rerun.' }, { status: 404, headers });
  } catch {
    return json({ ok: false, code: 'STUDIO_EVIDENCE_STORAGE_FAILED', message: 'The evidence archive could not be read from storage. No tool was rerun.' }, { status: 500, headers });
  }
};
