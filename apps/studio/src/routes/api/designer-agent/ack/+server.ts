import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { acknowledgeAgentEdit } from '$lib/server/designer-agent.js';
import { agentJson } from '$lib/server/designer-agent-http.js';
const schema = z
  .object({
    runId: z.string().uuid(),
    proposalId: z.string().uuid(),
    receipt: z.union([
      z
        .object({
          ok: z.literal(true),
          revision: z.string().min(1).max(160),
          digest: z.string().min(1).max(160),
        })
        .strict(),
      z
        .object({
          ok: z.literal(false),
          code: z.enum([
            'STUDIO_AGENT_DRAFT',
            'UI_DOC_STALE_REVISION',
            'STUDIO_AGENT_INVALID_EDIT',
            'STUDIO_AGENT_TEXT_TARGET',
            'STUDIO_AGENT_EMPTY_EDIT',
            'STUDIO_AGENT_VALIDATION',
            'STUDIO_AGENT_LIMIT',
            'STUDIO_AGENT_DIGEST',
            'STUDIO_AGENT_CANCELLED',
          ]),
          message: z.string().max(500),
        })
        .strict(),
    ]),
  })
  .strict();
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await agentJson(request, locals.session);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return json({ ok: false, code: 'STUDIO_AGENT_REQUEST' }, { status: 400 });
  const ok = acknowledgeAgentEdit(
    locals.session!.sessionId,
    parsed.data.runId,
    parsed.data.proposalId,
    parsed.data.receipt,
  );
  return json({ ok }, { status: ok ? 200 : 409 });
};
