import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
  getProductServer,
  actorFrom,
  SCENARIO_IDS,
  type ImplementationMode,
  type ScenarioId,
} from '$lib/server/inspection.js';

/**
 * The ONE product action boundary (U1-05/U3-01): the document's declared
 * interactions AND the native host controls POST here; the server process's
 * adapter enforces permissions and domain rules. In-flight dispatches carry
 * their generation; a scenario reset fences late results as SESSION_STALE.
 */
export const POST: RequestHandler = async (event) => {
  const action = event.params.action;
  const url = new URL(event.request.url);
  const actor = actorFrom(url);
  const product = getProductServer();
  let input: unknown = {};
  try {
    const text = await event.request.text();
    if (text.length > 0) input = JSON.parse(text) as unknown;
  } catch {
    return json(
      { ok: false, code: 'DATA_INVALID_INPUT', message: 'Malformed request body.' },
      { status: 400 },
    );
  }
  const idempotencyKey = event.request.headers.get('x-idempotency-key') ?? undefined;
  // Normalize route-style actions (finding-add -> finding.add).
  const actionId = action.replaceAll('-', '.');
  const result = await product.dispatch(actionId, input, actor, { idempotencyKey });
  return json(result, { status: result.ok ? 200 : result.code === 'SESSION_STALE' ? 409 : 422 });
};

/** Scenario reset (U3-02) + implementation-mode switch (U3-05). */
export const PUT: RequestHandler = async (event) => {
  const url = new URL(event.request.url);
  const product = getProductServer();
  const requested = url.searchParams.get('scenario') ?? product.scenario;
  if (!SCENARIO_IDS.includes(requested as ScenarioId)) {
    return json(
      { ok: false, code: 'UNKNOWN_SCENARIO', message: `Unknown scenario '${requested}'.` },
      { status: 400 },
    );
  }
  const modeParam = url.searchParams.get('mode');
  const mode: ImplementationMode | undefined =
    modeParam === 'durable-local' || modeParam === 'simulated' ? modeParam : undefined;
  product.reset(requested as ScenarioId, mode);
  return json({ ok: true, value: { scenario: requested, mode: product.mode } });
};
