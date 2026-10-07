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

import {
  InspectionDataAdapter,
  createInspectionServer,
  type SeedInput,
} from '$lib/product/domain.js';
import { SCENARIO_IDS, scenarioSeed, type ScenarioId } from '$lib/product/scenario-seeds.js';
import {
  InspectionDurableAdapter,
  durableDatabasePath,
  openDurableInspectionStore,
} from '$lib/server/inspection-durable.js';
import type { ActionResult } from '@victframework/ui-svelte';

export { SCENARIO_IDS, scenarioSeed };
export type { ScenarioId };

/** The registered implementation for the decision (U3-05). */
export type ImplementationMode = 'simulated' | 'durable-local';

export interface ProductServer {
  readonly scenario: ScenarioId;
  readonly mode: ImplementationMode;
  readonly server: ReturnType<typeof createInspectionServer>;
  /** Deterministic reset: same scenario → same domain state; fences in-flight.
   *  An implementation-mode switch swaps ONLY the registered implementation. */
  reset(scenario: ScenarioId, mode?: ImplementationMode): void;
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

interface ActiveServer {
  scenario: ScenarioId;
  generation: number;
  mode: ImplementationMode;
  seed: SeedInput;
  /** The simulated adapter (mutated in memory) when mode = simulated. */
  simulated: InspectionDataAdapter;
  /** The durable adapter (SQLite file) when mode = durable-local. */
  durable?: InspectionDurableAdapter;
  server: ReturnType<typeof createInspectionServer>;
}

let active: ActiveServer | undefined;

function instantiate(
  scenario: ScenarioId,
  mode: ImplementationMode = active?.mode ?? 'simulated',
): void {
  const seed = scenarioSeed(scenario);
  const generation = (active?.generation ?? 0) + 1;
  if (mode === 'durable-local') {
    // The durable store is NOT reseeded on reset: persistence is the
    // authority. An empty file seeds once; thereafter the domain carries.
    if (active?.durable === undefined) {
      const opened = openDurableInspectionStore(durableDatabasePath());
      active = {
        scenario,
        generation,
        mode,
        seed,
        simulated: new InspectionDataAdapter(seed),
        durable: opened.adapter,
        server: createInspectionServer(opened.adapter),
      };
      return;
    }
    active = {
      scenario,
      generation,
      mode,
      seed,
      simulated: active.simulated,
      durable: active.durable,
      // Rebuild the dispatcher around the DURABLE adapter — the mode swap
      // changes the registered implementation, never just a label.
      server: createInspectionServer(active.durable),
    };
    return;
  }
  const adapter = new InspectionDataAdapter(seed);
  active = {
    scenario,
    generation,
    mode,
    seed,
    simulated: adapter,
    ...(active?.durable !== undefined ? { durable: active.durable } : {}),
    server: createInspectionServer(adapter),
  };
}

if (active === undefined) instantiate('normal');

/** The durable database file location (restart evidence identifies it). */
export function durableFile(): string {
  return durableDatabasePath();
}

/** The process-wide product server (simulated implementation). */
export function getProductServer(): ProductServer {
  if (active === undefined) instantiate('normal');
  const current = () => active as ActiveServer;
  return {
    get scenario() {
      return current().scenario;
    },
    get generation() {
      return current().generation;
    },
    get mode(): ImplementationMode {
      return current().mode;
    },
    get server() {
      return current().server;
    },
    reset(scenario: ScenarioId, mode?: ImplementationMode) {
      instantiate(scenario, mode);
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
