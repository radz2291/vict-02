import { json, type RequestHandler } from '@sveltejs/kit';
import { toolEvidenceArchive } from '$lib/server/tool-evidence-archive.js';
export const GET: RequestHandler = ({ locals, url }) => {
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (!locals.session) return json({ ok: false, code: 'VICT_STUDIO_UNAUTHENTICATED' }, { status: 401, headers });
  const allowed = new Set(['id', 'offset', 'limit']);
  if ([...url.searchParams.keys()].some(key => !allowed.has(key) || url.searchParams.getAll(key).length !== 1)) return json({ ok: false, code: 'STUDIO_EVIDENCE_QUERY' }, { status: 400, headers });
  const offsetText = url.searchParams.get('offset') ?? '0', limitText = url.searchParams.get('limit') ?? '6000';
  if (!/^\d{1,9}$/.test(offsetText) || !/^\d{1,4}$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 6000) return json({ ok: false, code: 'STUDIO_EVIDENCE_QUERY' }, { status: 400, headers });
  const page = toolEvidenceArchive.page(locals.session.sessionId, url.searchParams.get('id') ?? '', Number(offsetText), Number(limitText));
  return page ? json({ ok: true, ...page }, { headers }) : json({ ok: false, code: 'STUDIO_EVIDENCE_UNAVAILABLE', message: 'Evidence is unavailable, expired or outside this session. No tool was rerun.' }, { status: 404, headers });
};
