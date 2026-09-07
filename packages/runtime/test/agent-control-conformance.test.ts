import { describe, expect, it } from 'vitest';
import { runAgentControlConformanceSuite } from '../src/control-conformance.js';

/**
 * The SHARED Stage 06B conformance suite executed against the in-memory
 * reference adapters. The SQLite adapters pass the same suite in
 * `@vict/store-sqlite` (with close/reopen equivalence).
 */
describe('agent-control stores (in-memory reference)', () => {
  runAgentControlConformanceSuite(
    {
      name: 'in-memory',
      async create() {
        const { createInMemoryAgentControlStores } = await import('../src/control-in-memory.js');
        return {
          ...createInMemoryAgentControlStores(),
          dispose: (): void => undefined,
        };
      },
    },
    { describe, it, expect },
  );
});
