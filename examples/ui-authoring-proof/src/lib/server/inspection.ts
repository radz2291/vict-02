/**
 * Process-hosted inspection product server (U3-01/U3-05).
 *
 * The inspection domain lives in the SERVER process (SvelteKit node process):
 * queue/detail loads and every action dispatch cross this module, so the
 * journey's status/activity/queue refresh is coherent across pages and the
 * durable implementation's persisted decisions survive client navigation.
 * A process restart re-creates this module — the restart evidence in U3-05
 * shows recovery from SQLite storage, not from this module's memory.
 *
 * Scenario selection (U3-02): the active scenario seed is switched here with
 * a generation counter — every in-flight dispatch carries the generation it
 * started against and is fenced (`SESSION_STALE`) when the generation moved.
 * Reset is deterministic: the SAME seed rebuilds the SAME domain state.
 */

import { InspectionDataAdapter, createInspectionServer } from '$lib/product/domain.js';
import { SCENARIO_IDS, scenarioSeed, type ScenarioId } from '$lib/product/scenario-seeds.js';
import type { ActionResult } from '@victframework/ui-svelte';

export { SCENARIO_IDS, scenarioSeed };
export type { ScenarioId };

export interface ProductServer {
  readonly scenario: ScenarioId;
  readonly server: ReturnType<typeof createInspectionServer>;
  /** Deterministic reset: same scenario → same domain state; fences in-flight. */
  reset(scenario: ScenarioId): void;
  /** The LIVE generation in-flight dispatches capture for fencing. */
  readonly generation: number;
  /** Dispatch with fencing: a scenario reset during the call yields SESSION_STALE. */
  dispatch(
    actionId: string,
    input: unknown,
    actor: { readonly role: string; readonly actorId: string },
    options?: { readonly idempotencyKey?: string },
  ): Promise<ActionResult>;
}

let active:
  | {
      scenario: ScenarioId;
      generation: number;
      adapter: InspectionDataAdapter;
      server: ReturnType<typeof createInspectionServer>;
    }
  | undefined;

function instantiate(scenario: ScenarioId): void {
  const seed = scenarioSeed(scenario);
  const adapter = new InspectionDataAdapter(seed);
  active = {
    scenario,
    generation: (active?.generation ?? 0) + 1,
    adapter,
    server: createInspectionServer(adapter),
  };
}

if (active === undefined) instantiate('normal');

/** The process-wide product server (simulated implementation). */
export function getProductServer(): ProductServer {
  if (active === undefined) instantiate('normal');
  const current = () =>
    active as {
      scenario: ScenarioId;
      generation: number;
      adapter: InspectionDataAdapter;
      server: ReturnType<typeof createInspectionServer>;
    };
  return {
    get scenario() {
      return current().scenario;
    },
    get generation() {
      return current().generation;
    },
    get server() {
      return current().server;
    },
    reset(scenario: ScenarioId) {
      instantiate(scenario);
    },
    async dispatch(actionId, input, actor, options) {
      const generation = current().generation;
      const result = await current().server.dispatch(actionId, input, actor, options);
      if (current().generation !== generation) {
        return {
          ok: false,
          code: 'SESSION_STALE',
          message:
            'The scenario was reset while this operation was in flight; the result was dropped.',
        };
      }
      return result;
    },
  };
}

/** Resolve the acting identity from a request (`?as=technician`). */
export function actorFrom(url: URL): { role: string; actorId: string } {
  return url.searchParams.get('as') === 'technician'
    ? { role: 'technician', actorId: 't.nguyen' }
    : { role: 'supervisor', actorId: 's.hart' };
}
