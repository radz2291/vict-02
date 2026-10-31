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
  const encoder = new TextEncoder();
  // Awaited writes propagate the actual consumer's demand. There is no
  // cumulative byte quota and no detached promise queue of pending frames.
  let abortChannel: () => void = () => {};
  const channel = new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      abortChannel = () => controller.error(new DOMException('Agent run cancelled', 'AbortError'));
    },
  });
  const writer = channel.writable.getWriter();
  const close = async () => {
    if (closed) return;
    closed = true;
    await writer.close().catch(() => undefined);
  };
  void writer.closed.catch(() => {
    closed = true;
    if (runId) cancelAgentRun(owner, runId);
  });
  const opened = openAgentRun(owner, checked.value, async (event) => {
    if (closed) return;
    try {
      await writer.ready;
      await writer.write(encoder.encode(JSON.stringify(event) + '\n'));
      if (event.type === 'done') await close();
    } catch {
      closed = true;
      if (runId) cancelAgentRun(owner, runId);
    }
  });
  if (!opened.ok) {
    void writer
      .write(
        encoder.encode(
          JSON.stringify({ type: 'done', status: 'failed', code: opened.code, applied: 0 }) + '\n',
        ),
      )
      .then(close)
      .catch(() => undefined);
  } else {
    runId = opened.runId;
    const abortWriter = () => {
      closed = true;
      abortChannel();
      void writer.abort().catch(() => undefined);
    };
    opened.signal.addEventListener('abort', abortWriter, { once: true });
    if (opened.signal.aborted) abortWriter();
    const abort = () => {
      cancelAgentRun(owner, runId);
      abortWriter();
    };
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    void opened.finished
      .finally(() => {
        request.signal.removeEventListener('abort', abort);
        opened.signal.removeEventListener('abort', abortWriter);
        void close();
      })
      .catch(() => undefined);
  }
  const stream = channel.readable;
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
