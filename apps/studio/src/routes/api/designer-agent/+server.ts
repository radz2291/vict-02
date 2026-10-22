import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import {
  agentConfiguration,
  cancelAgentRun,
  openAgentRun,
  validateAgentStart,
} from '$lib/server/designer-agent.js';
import { agentJson } from '$lib/server/designer-agent-http.js';

export const GET: RequestHandler = ({ locals }) => {
  if (!locals.session)
    return json({ ok: false, code: 'VICT_STUDIO_UNAUTHENTICATED' }, { status: 401 });
  const config = agentConfiguration();
  // A CSRF nonce is deliberately readable by this same-origin authenticated client.
  // It is not a session credential; the HttpOnly cookie remains server-owned.
  return json(
    { csrf: locals.session.csrfToken, model: config.model, ready: config.ready },
    { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } },
  );
};
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await agentJson(request, locals.session);
  if (!body.ok) return body.response;
  const checked = validateAgentStart(body.value);
  if (!checked.ok) return json(checked, { status: 400 });
  const owner = locals.session!.sessionId;
  let runId = '';
  let closed = false;
  let bytes = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        const opened = openAgentRun(owner, checked.value, (event) => {
          if (closed) return;
          const chunk = encoder.encode(JSON.stringify(event) + '\n');
          bytes += chunk.byteLength;
          if (bytes > 1_000_000 || (controller.desiredSize ?? 0) < -256_000) {
            closed = true;
            if (runId) cancelAgentRun(owner, runId);
            controller.error(new Error('STUDIO_AGENT_STREAM_LIMIT'));
            return;
          }
          try {
            controller.enqueue(chunk);
          } catch {
            closed = true;
            if (runId) cancelAgentRun(owner, runId);
          }
        });
        if (!opened.ok) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: 'done', status: 'failed', code: opened.code, applied: 0 }) +
                '\n',
            ),
          );
          closed = true;
          controller.close();
          return;
        }
        runId = opened.runId;
        const abort = () => {
          cancelAgentRun(owner, runId);
        };
        request.signal.addEventListener('abort', abort, { once: true });
        if (request.signal.aborted) abort();
        void opened.finished.finally(() => {
          request.signal.removeEventListener('abort', abort);
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
      },
      cancel() {
        closed = true;
        if (runId) cancelAgentRun(owner, runId);
      },
    },
    { highWaterMark: 64_000, size: (chunk) => chunk.byteLength },
  );
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-accel-buffering': 'no',
    },
  });
};
export const DELETE: RequestHandler = async ({ request, locals }) => {
  const body = await agentJson(request, locals.session);
  if (!body.ok) return body.response;
  const parsed = z.object({ runId: z.string().uuid() }).strict().safeParse(body.value);
  if (!parsed.success) return json({ ok: false, code: 'STUDIO_AGENT_REQUEST' }, { status: 400 });
  const ok = cancelAgentRun(locals.session!.sessionId, parsed.data.runId);
  return json({ ok }, { status: ok ? 200 : 404 });
};
