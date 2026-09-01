/**
 * Shared fixture code for restart tests. Runs in child processes under tsx.
 * Imports resolve through relative source paths so no build step or
 * workspace hoisting is required inside the child.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createRuntime } from '../../../runtime/src/index.js';
import type { VictRuntime } from '../../../runtime/src/index.js';
import type { DisposableVictStores } from '../../../runtime/src/index.js';
import { createSqliteStores } from '../../src/index.js';
import { defineZodContract } from '../../../contracts/src/zod/index.js';
import { z } from 'zod';

export interface FixturePaths {
  readonly db: string;
  readonly marker: string;
  readonly barrier: string;
}

export const Count = defineZodContract('fx.count', '1', z.object({ count: z.number() }));

/** Marker names recorded in the marker file when a capability body executes. */
export const MARKER_START = 'invoked:fx.start';
export const MARKER_SECOND = 'invoked:fx.second';

export function writeMarker(markerPath: string, name: string): void {
  appendFileSync(markerPath, `${name}\n`, 'utf8');
}

export function markerContains(markerPath: string, name: string): boolean {
  if (!existsSync(markerPath)) {
    return false;
  }
  return readFileSync(markerPath, 'utf8').includes(name);
}

/**
 * Block until the barrier file exists. In interruption scenarios the parent
 * kills the process long before this deadline; the barrier is never set by
 * Vict processes.
 */
export async function waitBehindBarrier(barrier: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (existsSync(barrier)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * Two-node graph used by interruption scenarios:
 *   fx.start (pure, completes quickly) -> fx.second (blocks on a barrier)
 * Both capabilities record their invocation in the marker file so tests can
 * prove that no capability executed after an interruption.
 */
export function buildRuntime(paths: FixturePaths): {
  runtime: VictRuntime;
  stores: DisposableVictStores;
} {
  const stores = createSqliteStores({ path: paths.db });
  const runtime = createRuntime({ stores });
  runtime.registerCapability({
    id: 'fx.start',
    revision: '1',
    effect: 'pure',
    input: Count,
    output: Count,
    invoke: (input) => {
      writeMarker(paths.marker, MARKER_START);
      return { count: input.count + 1 };
    },
  });
  runtime.registerCapability({
    id: 'fx.second',
    revision: '1',
    effect: 'pure',
    input: Count,
    output: Count,
    invoke: async (input) => {
      // The barrier stands between invocation and the capability's work:
      // nothing observable happens until it resolves (the parent kills the
      // process before that in interruption scenarios).
      await waitBehindBarrier(paths.barrier);
      writeMarker(paths.marker, MARKER_SECOND);
      return { count: input.count + 2 };
    },
  });
  return { runtime, stores };
}

export const FX_GRAPH = {
  id: 'fx-graph',
  entry: 'start',
  nodes: [
    { id: 'start', capability: 'fx.start' },
    { id: 'second', capability: 'fx.second' },
  ],
  edges: [{ from: 'start', to: 'second' }],
} as const;
