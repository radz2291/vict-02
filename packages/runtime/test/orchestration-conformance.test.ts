import { describe, expect, it } from 'vitest';
import { createInMemoryStores, createRuntime } from '@vict/runtime';
import {
  runOrchestrationCanarySuite,
  runOrchestrationConformanceSuite,
  runOrchestrationJoinSuite,
  runOrchestrationRaceSuite,
  runOrchestrationRemediationSuite,
} from '@vict/runtime/testing';

/** The shared Stage 03 audit-remediation suite — in-memory backend. */
describe('orchestration remediation (shared suite, in-memory)', () => {
  runOrchestrationRemediationSuite({ test: it }, expect, {
    name: 'in-memory',
    async create(clock) {
      const stores = createInMemoryStores();
      const buildRuntime = (): ReturnType<typeof createRuntime> =>
        createRuntime({
          stores,
          ...(clock ? { clock, orchestration: { time: clock } } : {}),
        });
      const runtime = buildRuntime();
      return {
        stores: { runtime, orchestration: stores.orchestration as never },
        async reopen() {
          // Nothing is persisted to disk, but the reopened runtime is a NEW
          // runtime instance over the SAME store state (registry is
          // per-runtime, mirroring the SQLite close/reopen semantics).
          const reopened = buildRuntime();
          return { runtime: reopened, orchestration: stores.orchestration as never };
        },
        async createOperatorRuntime() {
          return createRuntime({
            stores,
            orchestration: { operatorAuthorized: true },
          });
        },
        async dispose() {
          /* nothing durable to release */
        },
      };
    },
  });
});

/** The shared Stage 03 orchestration conformance suite — in-memory backend. */
describe('orchestration conformance (shared suite, in-memory)', () => {
  runOrchestrationConformanceSuite({ test: it }, expect, {
    name: 'in-memory',
    async create() {
      const stores = createInMemoryStores();
      const runtime = createRuntime({ stores });
      return {
        runtime,
        orchestration: stores.orchestration as never,
        async dispose() {
          /* nothing durable to release */
        },
      };
    },
  });
});

/** The shared join-boundary conformance suite — in-memory backend. */
describe('orchestration join boundary (shared suite, in-memory)', () => {
  runOrchestrationJoinSuite({ test: it }, expect, {
    name: 'in-memory',
    async create() {
      const stores = createInMemoryStores();
      const runtime = createRuntime({ stores });
      return {
        runtime,
        orchestration: stores.orchestration as never,
        async dispose() {
          /* nothing durable to release */
        },
      };
    },
  });
});

/** The shared race/adversarial conformance suite — in-memory backend. */
describe('orchestration races (shared suite, in-memory)', () => {
  runOrchestrationRaceSuite({ test: it }, expect, {
    name: 'in-memory',
    async create(clock) {
      const stores = createInMemoryStores();
      const runtime = createRuntime({
        stores,
        ...(clock ? { clock, orchestration: { time: clock } } : {}),
      });
      return {
        runtime,
        orchestration: stores.orchestration as never,
        async createOperatorRuntime() {
          return createRuntime({
            stores,
            orchestration: {
              operatorAuthorized: true,
              ...(clock ? { time: clock } : {}),
            },
          });
        },
        async dispose() {
          /* nothing durable to release */
        },
      };
    },
  });
});

/** The shared adversarial canary suite — in-memory backend. */
describe('orchestration canaries (shared suite, in-memory)', () => {
  runOrchestrationCanarySuite({ test: it }, expect, {
    name: 'in-memory',
    async create() {
      const stores = createInMemoryStores();
      const runtime = createRuntime({ stores });
      return {
        runtime,
        orchestration: stores.orchestration as never,
        async createOperatorRuntime() {
          return createRuntime({ stores, orchestration: { operatorAuthorized: true } });
        },
        async dispose() {
          /* nothing durable to release */
        },
      };
    },
  });
});
