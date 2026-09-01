import { describe, expect, it } from 'vitest';
import { createInMemoryStores, createRuntime } from '@vict/runtime';
import {
  runOrchestrationConformanceSuite,
  runOrchestrationJoinSuite,
  runOrchestrationRaceSuite,
} from '@vict/runtime/testing';
import type { OrchestrationConformanceFixture } from '@vict/runtime/testing';

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
