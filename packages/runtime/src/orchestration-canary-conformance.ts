import { neutralJsonContract } from '@vict/sdk';
import type { KernelEvent } from '@vict/kernel';
import { SAFE_ISSUE_CODES } from '@vict/contracts';
import type { ContractIssue } from '@vict/contracts';
import type { VictRuntime } from './runtime.js';
import type { OrchestrationStore } from './orchestration-store-types.js';
import type {
  ConformanceExpect,
  ConformanceTestRunner,
  OrchestrationConformanceFixture,
  OrchestrationConformanceStores,
} from './orchestration-conformance.js';

/**
 * Adapter-neutral Stage 03 adversarial canary suite (final audit-readiness
 * closure). A single ALPHANUMERIC canary — the class that survives any
 * character-filtering "sanitizer" — is injected independently into every
 * untrusted position of a hostile contract parser's issues (code, path,
 * message, expected/received, extra nested properties, payload-derived key
 * names) and into three additional sources: valid signal payloads,
 * cancellation metadata, and external-ledger thrown errors (with nested
 * causes). The canary must be absent from EVERY observable or persistable
 * surface: the `onEvent` callback, the stored event ledger, the stored run
 * record, the public failure error, `RunResult.trace`, wait and receipt
 * records, and cancellation/operator records. Rejections must still be
 * USEFUL: a `contract.rejected` fact with a framework-controlled issue
 * code, an ordinal path, and a framework-generated message.
 */

/** Alphanumeric canary: deliberately defeats character-filter sanitizers. */
const CANARY = 'CANARYSecret123';

export interface OrchestrationCanaryStores extends OrchestrationConformanceStores {
  /** A SECOND runtime sharing the same durable stores (operator surface). */
  createOperatorRuntime(): Promise<VictRuntime>;
}

export interface OrchestrationCanaryFixture extends OrchestrationConformanceFixture {
  create(): Promise<OrchestrationCanaryStores>;
}

interface RejectionCapture {
  runId: string;
  status: string;
  error?: { code?: string; message?: string; details?: unknown };
  trace: readonly KernelEvent[];
  callbackEvents: KernelEvent[];
}

/** Run one graph to completion while capturing the onEvent callback stream. */
async function runCaptured(
  runtime: VictRuntime,
  input: unknown,
): Promise<ReturnType<VictRuntime['run']> & { callbackEvents: KernelEvent[] }> {
  const callbackEvents: KernelEvent[] = [];
  const result = (await runtime.run(input, {
    onEvent: (event: KernelEvent) => callbackEvents.push(event),
  })) as unknown as {
    runId: string;
    status: string;
    error?: { code?: string; message?: string; details?: unknown };
    trace: readonly KernelEvent[];
    callbackEvents: KernelEvent[];
  };
  result.callbackEvents = callbackEvents;
  return result as never;
}

/**
 * Assert the canary is absent from every observable and persistable
 * surface of a failed run, and that the rejection is still structurally
 * useful (framework-controlled code, ordinal path, generated message).
 */
async function assertRejectionIsSafe(
  expect: ConformanceExpect,
  orchestration: OrchestrationStore,
  runtime: VictRuntime,
  captured: RejectionCapture,
  expectedStage?: 'input' | 'output',
): Promise<void> {
  expect(captured.status).toBe('failed');
  const surfaces: Record<string, unknown>[] = [
    { label: 'onEvent callback events', value: captured.callbackEvents },
    { label: 'RunResult.trace', value: captured.trace },
    { label: 'public failure error', value: captured.error },
    {
      label: 'stored event ledger',
      value: await orchestration.listOrchestrationEvents(captured.runId),
    },
    { label: 'stored run record', value: await runtime.getRun(captured.runId) },
    {
      label: 'signal receipts',
      value: await orchestration.listSignalReceipts(captured.runId),
    },
    { label: 'wait records', value: await orchestration.listWaits(captured.runId) },
  ];
  for (const { label, value } of surfaces) {
    const text = JSON.stringify(value) ?? '';
    expect(text.includes(CANARY)).toBe(false);
    if (text.includes(CANARY)) {
      throw new Error(`canary leaked into ${label}: ${text.slice(0, 200)}`);
    }
  }
  // The rejection remains diagnosable WITHOUT untrusted content.
  const rejected = [...captured.callbackEvents, ...captured.trace].find(
    (event) => event.type === 'contract.rejected',
  ) as unknown as
    { stage?: string; issues: { code: string; path: string; message: string }[] } | undefined;
  expect(rejected).toBeDefined();
  if (!rejected) {
    return;
  }
  if (expectedStage !== undefined) {
    expect(rejected.stage).toBe(expectedStage);
  }
  expect(rejected.issues.length).toBeGreaterThan(0);
  for (const [index, issue] of rejected.issues.entries()) {
    expect(
      (SAFE_ISSUE_CODES as readonly string[]).includes(issue.code) ||
        issue.code === 'untrusted_issue',
    ).toBe(true);
    expect(issue.path).toBe(`issues[${index}]`);
    // Framework-GENERATED message: quotes the ordinal path, never the raw
    // parser content (allowlisted codes read "Expected … at 'issues[i]'",
    // the fallback reads "Validation failed (untrusted_issue) …").
    expect(issue.message.includes(`'issues[${index}]'`)).toBe(true);
    expect(JSON.stringify(issue).includes(CANARY)).toBe(false);
  }
}

/** A hostile contract whose parse() rejects with the canary in ONE position. */
function hostileContract(id: string, position: 'code' | 'path' | 'message' | 'fields' | 'extra') {
  return {
    id,
    revision: '1',
    expected: 'never',
    parse: (_input: unknown) => {
      const issue: Record<string, unknown> = {
        code: 'invalid_type',
        path: '(root)',
        message: 'rejected',
      };
      switch (position) {
        case 'code':
          issue.code = CANARY;
          break;
        case 'path':
          issue.path = CANARY;
          break;
        case 'message':
          issue.message = `rejected because of ${CANARY}`;
          break;
        case 'fields':
          issue.expected = CANARY;
          issue.received = CANARY;
          issue.safeMessage = CANARY;
          break;
        case 'extra':
          issue.nested = { deeper: [CANARY] };
          issue.toStringOverride = CANARY;
          break;
      }
      return { ok: false as const, issues: [issue as unknown as ContractIssue] };
    },
  };
}

export function runOrchestrationCanarySuite(
  runner: ConformanceTestRunner,
  expect: ConformanceExpect,
  factory: OrchestrationCanaryFixture,
): void {
  const t = runner.test;
  const label = (name: string): string => `[${factory.name}] ${name}`;

  for (const position of ['code', 'path', 'message', 'fields', 'extra'] as const) {
    t(label(`join contract canary in issue ${position} never reaches any surface`), async () => {
      const fixture = await factory.create();
      try {
        const { runtime, orchestration } = fixture;
        let downstreamCalls = 0;
        runtime
          .registerCapability({
            id: 'c.first',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 's',
          })
          .registerCapability({
            id: 'c.b1',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 'ALPHA',
          })
          .registerCapability({
            id: 'c.b2',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 'BETA',
          })
          .registerCapability({
            id: 'c.after',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => {
              downstreamCalls += 1;
              return 'after';
            },
          })
          .registerContract(hostileContract(`c.hostile-${position}`, position));
        const activated = await runtime.activate({
          id: `canary-join-${position}`,
          entry: 's',
          nodes: [
            { id: 's', capability: 'c.first' },
            { id: 'f', kind: 'fork', join: 'j' },
            { id: 'x1', capability: 'c.b1' },
            { id: 'x2', capability: 'c.b2' },
            { id: 'j', kind: 'join', fork: 'f', output: `c.hostile-${position}` },
            { id: 'z', capability: 'c.after' },
          ],
          edges: [
            { from: 's', to: 'f' },
            { from: 'f', to: 'x1', kind: 'branch', key: 'a' },
            { from: 'f', to: 'x2', kind: 'branch', key: 'b' },
            { from: 'x1', to: 'j' },
            { from: 'x2', to: 'j' },
            { from: 'j', to: 'z' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const captured = (await runCaptured(runtime, 'seed')) as unknown as RejectionCapture;
        await assertRejectionIsSafe(expect, orchestration, runtime, captured, 'output');
        expect(downstreamCalls).toBe(0);
      } finally {
        await fixture.dispose();
      }
    });
  }

  t(
    label('a payload-derived canary key cannot leak through parser-derived issue fields'),
    async () => {
      const fixture = await factory.create();
      try {
        const { runtime, orchestration } = fixture;
        let downstreamCalls = 0;
        runtime
          .registerCapability({
            id: 'p.first',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 's',
          })
          // Branch outputs carry the canary as a DYNAMIC OBJECT KEY: the
          // canonical join payload itself contains the secret key name.
          .registerCapability({
            id: 'p.b',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => ({ [CANARY]: 'value' }),
          })
          .registerCapability({
            id: 'p.after',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => {
              downstreamCalls += 1;
              return 'after';
            },
          })
          // A hostile parser that derives its diagnostics from the payload:
          // the secret key name flows into code, path, and message.
          .registerContract({
            id: 'p.derive',
            revision: '1',
            expected: 'never',
            parse: (input: unknown) => {
              const keys = Object.keys(input as Record<string, unknown>).join(',');
              return {
                ok: false as const,
                issues: [{ code: keys, path: `$.${keys}`, message: `keys: ${keys}` }],
              };
            },
          });
        const activated = await runtime.activate({
          id: 'canary-derive',
          entry: 's',
          nodes: [
            { id: 's', capability: 'p.first' },
            { id: 'f', kind: 'fork', join: 'j' },
            { id: 'x1', capability: 'p.b' },
            { id: 'x2', capability: 'p.b' },
            { id: 'j', kind: 'join', fork: 'f', output: 'p.derive' },
            { id: 'z', capability: 'p.after' },
          ],
          edges: [
            { from: 's', to: 'f' },
            { from: 'f', to: 'x1', kind: 'branch', key: 'a' },
            { from: 'f', to: 'x2', kind: 'branch', key: 'b' },
            { from: 'x1', to: 'j' },
            { from: 'x2', to: 'j' },
            { from: 'j', to: 'z' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const captured = (await runCaptured(runtime, 'seed')) as unknown as RejectionCapture;
        await assertRejectionIsSafe(expect, orchestration, runtime, captured, 'output');
        expect(downstreamCalls).toBe(0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(label('an input-contract canary never reaches any surface (input stage)'), async () => {
    const fixture = await factory.create();
    try {
      const { runtime, orchestration } = fixture;
      let invoked = 0;
      runtime
        .registerCapability({
          id: 'i.guarded',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => {
            invoked += 1;
            return 'ran';
          },
        })
        .registerContract(hostileContract('i.hostile-input', 'message'));
      const activated = await runtime.activate({
        id: 'canary-input',
        entry: 'n',
        // A declared timeout forces the durable orchestration engine, so
        // the driver's input boundary (not the sequential engine) is what
        // rejects and records the failure.
        nodes: [
          {
            id: 'n',
            capability: 'i.guarded',
            input: 'i.hostile-input',
            timeoutMs: 30_000,
          },
        ],
        edges: [],
      } as never);
      expect(activated.ok).toBe(true);
      const captured = (await runCaptured(runtime, 'seed')) as unknown as RejectionCapture;
      await assertRejectionIsSafe(expect, orchestration, runtime, captured, 'input');
      expect(invoked).toBe(0);
    } finally {
      await fixture.dispose();
    }
  });

  t(label('a signal-payload canary stays inside the private continuation boundary'), async () => {
    const fixture = await factory.create();
    try {
      const { runtime, orchestration } = fixture;
      runtime
        .registerCapability({
          id: 's.first',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'go',
        })
        .registerCapability({
          id: 's.echo',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => `echo:${String(input)}`,
        })
        .registerContract({
          id: 's.string',
          revision: '1',
          expected: 'a string',
          parse: (input: unknown) =>
            typeof input === 'string'
              ? { ok: true as const, value: input, issues: [] }
              : {
                  ok: false as const,
                  issues: [{ code: 'invalid_type', path: '(root)', message: 'string' }],
                },
        });
      const activated = await runtime.activate({
        id: 'canary-signal',
        entry: 'a',
        nodes: [
          { id: 'a', capability: 's.first' },
          { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', contract: 's.string' } },
          { id: 'b', capability: 's.echo', output: 's.string' },
        ],
        edges: [
          { from: 'a', to: 'w' },
          { from: 'w', to: 'b' },
        ],
      } as never);
      expect(activated.ok).toBe(true);
      const callbackEvents: KernelEvent[] = [];
      const parked = (await runtime.run('seed', {
        onEvent: (event: KernelEvent) => callbackEvents.push(event),
      })) as unknown as { runId: string; status: string; waits?: { waitId: string }[] };
      expect(parked.status).toBe('waiting');
      // A VALID secret-bearing signal payload: usable only inside the
      // private continuation boundary (it becomes the branch completion
      // value / checkpoint of the resumed work).
      const signaled = await runtime.signal({
        runId: parked.runId,
        waitId: parked.waits?.[0]?.waitId as string,
        signalId: 'sig-1',
        signalName: 'go',
        payload: `${CANARY}-payload`,
      });
      expect(signaled.ok).toBe(true);
      const final = await runtime.resumeRun(parked.runId);
      // Returned output is the intentional public result contract; the
      // application transformed the payload, so the raw payload value
      // itself must still be absent from every stored surface.
      expect(final.status).toBe('completed');
      expect(final.output).toBe(`echo:${CANARY}-payload`);
      const surfaces: Record<string, unknown>[] = [
        { label: 'onEvent callback events', value: callbackEvents },
        { label: 'RunResult.trace', value: final.trace },
        {
          label: 'stored event ledger',
          value: await orchestration.listOrchestrationEvents(parked.runId),
        },
        {
          label: 'default run record',
          value: await runtime.getRun(parked.runId),
        },
        {
          label: 'signal receipts',
          value: await orchestration.listSignalReceipts(parked.runId),
        },
        { label: 'wait records', value: await orchestration.listWaits(parked.runId) },
      ];
      for (const { label: name, value } of surfaces) {
        const text = JSON.stringify(value) ?? '';
        if (text.includes(`${CANARY}-payload`)) {
          throw new Error(`canary leaked into ${name}: ${text.slice(0, 200)}`);
        }
      }
    } finally {
      await fixture.dispose();
    }
  });

  t(
    label('a hostile signal contract rejects without echoing the payload or issue content'),
    async () => {
      const fixture = await factory.create();
      try {
        const { runtime, orchestration } = fixture;
        runtime
          .registerCapability({
            id: 'v.first',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 'go',
          })
          .registerCapability({
            id: 'v.after',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 'after',
          })
          // Hostile wait-payload contract: canary in every issue position
          // plus a full payload echo.
          .registerContract({
            id: 'v.hostile',
            revision: '1',
            expected: 'never',
            parse: (input: unknown) => ({
              ok: false as const,
              issues: [
                {
                  code: CANARY,
                  path: `${CANARY}:${JSON.stringify(input)}`,
                  message: `${CANARY}:${JSON.stringify(input)}`,
                  expected: CANARY,
                  received: CANARY,
                  nested: { echo: CANARY },
                },
              ],
            }),
          });
        const activated = await runtime.activate({
          id: 'canary-signal-reject',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'v.first' },
            { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', contract: 'v.hostile' } },
            { id: 'b', capability: 'v.after' },
          ],
          edges: [
            { from: 'a', to: 'w' },
            { from: 'w', to: 'b' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const parked = (await runtime.run('seed')) as unknown as {
          runId: string;
          status: string;
          waits?: { waitId: string }[];
        };
        expect(parked.status).toBe('waiting');
        const rejected = await runtime.signal({
          runId: parked.runId,
          waitId: parked.waits?.[0]?.waitId as string,
          signalId: 'sig-1',
          signalName: 'go',
          payload: `${CANARY}-value`,
        });
        expect(rejected.ok).toBe(false);
        if (!rejected.ok) {
          expect(JSON.stringify(rejected).includes(CANARY)).toBe(false);
        }
        // The wait stays open; nothing about the rejected payload persists.
        expect((await orchestration.listWaits(parked.runId)).length).toBe(1);
        expect((await orchestration.listSignalReceipts(parked.runId)).length).toBe(0);
        const ledger = JSON.stringify(await orchestration.listOrchestrationEvents(parked.runId));
        expect(ledger.includes(CANARY)).toBe(false);
        const record = JSON.stringify(await orchestration.getOrchestrationRun(parked.runId));
        expect(record.includes(CANARY)).toBe(false);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(label('cancellation metadata uses only the closed safe vocabulary'), async () => {
    const fixture = await factory.create();
    try {
      const { runtime, orchestration } = fixture;
      runtime
        .registerCapability({
          id: 'm.first',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'go',
        })
        .registerCapability({
          id: 'm.after',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'after',
        });
      const activated = await runtime.activate({
        id: 'canary-cancel-meta',
        entry: 'a',
        nodes: [
          { id: 'a', capability: 'm.first' },
          { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go' } },
          { id: 'b', capability: 'm.after' },
        ],
        edges: [
          { from: 'a', to: 'w' },
          { from: 'w', to: 'b' },
        ],
      } as never);
      expect(activated.ok).toBe(true);
      const parked = (await runtime.run('seed')) as unknown as {
        runId: string;
        status: string;
      };
      expect(parked.status).toBe('waiting');
      // An invalid reason code fails safely WITHOUT echoing the value.
      const invalid = (await runtime.cancel({
        runId: parked.runId,
        requestId: 'req-invalid',
        reasonCode: CANARY as never,
      })) as unknown as { ok: boolean; code?: string; message?: string };
      expect(invalid.ok).toBe(false);
      expect(JSON.stringify(invalid).includes(CANARY)).toBe(false);
      expect(invalid.code).toBe('VICT_ORCH_INVALID_REASON');
      // The run is untouched by the invalid request.
      expect((await orchestration.getOrchestrationRun(parked.runId))?.status).toBe('waiting');
      // A valid request persists ONLY the closed vocabulary plus the
      // caller-owned requestId (an identifier in the caller's namespace,
      // documented as explicitly safe — never arbitrary diagnostic text).
      const accepted = await runtime.cancel({
        runId: parked.runId,
        requestId: 'req-1',
        reasonCode: 'operator_request',
      });
      expect(accepted.ok).toBe(true);
      const record = (await orchestration.getOrchestrationRun(parked.runId)) as unknown as {
        status: string;
        cancellation?: Record<string, unknown>;
      };
      expect(record.status).toBe('cancelled');
      // Persisted cancellation facts: the closed-vocabulary reason code
      // plus the caller-owned requestId identifier. No free-text field
      // exists to carry arbitrary content.
      expect(record.cancellation?.reasonCode).toBe('operator_request');
      expect(Object.keys(record.cancellation ?? {}).sort()).toEqual(
        ['reasonCode', 'requestId'].sort(),
      );
      const ledger = await orchestration.listOrchestrationEvents(parked.runId);
      for (const event of ledger) {
        const reason = (event as unknown as { reasonCode?: string }).reasonCode;
        if (reason !== undefined) {
          expect(['operator_request', 'shutdown', 'policy', 'superseded']).toContain(reason);
        }
      }
    } finally {
      await fixture.dispose();
    }
  });

  t(label('an external-ledger thrown error with a nested cause never leaks'), async () => {
    const fixture = await factory.create();
    try {
      const { runtime, orchestration } = fixture;
      const externalLedger: string[] = [];
      runtime.registerCapability({
        id: 'e.keyedWrite',
        revision: '1',
        effect: 'write',
        input: neutralJsonContract,
        output: neutralJsonContract,
        idempotency: 'keyed',
        invoke: (input: unknown, context) => {
          // Disposable external-effect ledger: records the mutation,
          // then the reconciliation boundary throws with a nested cause.
          externalLedger.push(`${String(input)}:${context.idempotencyKey ?? ''}`);
          throw new Error(`outer ${CANARY}`, { cause: new Error(`inner ${CANARY}`) });
        },
      });
      const activated = await runtime.activate({
        id: 'canary-ledger',
        entry: 'w',
        nodes: [{ id: 'w', capability: 'e.keyedWrite', timeoutMs: 30_000 }],
        edges: [],
      } as never);
      expect(activated.ok).toBe(true);
      const captured = (await runCaptured(runtime, 'seed')) as unknown as RejectionCapture;
      expect(captured.status).toBe('failed');
      const surfaces: Record<string, unknown>[] = [
        { label: 'onEvent callback events', value: captured.callbackEvents },
        { label: 'RunResult.trace', value: captured.trace },
        { label: 'public failure error', value: captured.error },
        {
          label: 'stored event ledger',
          value: await orchestration.listOrchestrationEvents(captured.runId),
        },
        { label: 'stored run record', value: await runtime.getRun(captured.runId) },
        { label: 'wait records', value: await orchestration.listWaits(captured.runId) },
      ];
      for (const { label: name, value } of surfaces) {
        const text = JSON.stringify(value) ?? '';
        if (text.includes(CANARY)) {
          throw new Error(`canary leaked into ${name}: ${text.slice(0, 200)}`);
        }
      }
      // The stable framework class is all that is observable about the
      // thrown error: no message, no error name chain, no cause text.
      const failedEvent = captured.callbackEvents.find(
        (event) => event.type === 'node.failed',
      ) as unknown as { error?: { code?: string; message?: string } } | undefined;
      expect(failedEvent?.error?.code).toBe('VICT_RUNTIME_CAPABILITY_THREW');
      expect((failedEvent?.error?.message ?? '').includes('threw')).toBe(true);
      // Recovery/operator diagnostics after the failure carry no secret.
      const recovery = await runtime.recoverOrchestration();
      expect(JSON.stringify(recovery).includes(CANARY)).toBe(false);
    } finally {
      await fixture.dispose();
    }
  });

  t(label('operator confirmation rejection echoes nothing from the hostile contract'), async () => {
    const fixture = await factory.create();
    try {
      const { runtime, orchestration } = fixture;
      runtime
        .registerCapability({
          id: 'o.blocked',
          revision: '1',
          effect: 'irreversible',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'never',
        })
        .registerCapability({
          id: 'o.after',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'x',
        })
        .registerContract({
          id: 'o.hostile-output',
          revision: '1',
          expected: 'never',
          parse: (input: unknown) => ({
            ok: false as const,
            issues: [
              {
                code: CANARY,
                path: `${CANARY}:${JSON.stringify(input)}`,
                message: `${CANARY}:${JSON.stringify(input)}`,
                expected: CANARY,
                received: CANARY,
                nested: { echo: CANARY },
              },
            ],
          }),
        });
      const activated = await runtime.activate({
        id: 'canary-operator',
        entry: 'b',
        nodes: [
          {
            id: 'b',
            capability: 'o.blocked',
            output: 'o.hostile-output',
            // Declared timeout: forces the durable orchestration engine,
            // so the blocked-run operator surface is the one under probe.
            timeoutMs: 30_000,
          },
          { id: 'z', capability: 'o.after' },
        ],
        edges: [{ from: 'b', to: 'z' }],
      } as never);
      expect(activated.ok).toBe(true);
      const blocked = (await runtime.run('seed')) as unknown as {
        runId: string;
        status: string;
      };
      expect(blocked.status).toBe('blocked');
      const operator = await fixture.createOperatorRuntime();
      operator.registerCapability({
        id: 'o.blocked',
        revision: '1',
        effect: 'irreversible',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'never',
      });
      operator.registerContract({
        id: 'o.hostile-output',
        revision: '1',
        expected: 'never',
        parse: (input: unknown) => ({
          ok: false as const,
          issues: [
            {
              code: CANARY,
              path: `${CANARY}:${JSON.stringify(input)}`,
              message: `${CANARY}:${JSON.stringify(input)}`,
              expected: CANARY,
              received: CANARY,
              nested: { echo: CANARY },
            },
          ],
        }),
      });
      const confirmed = (await operator.resolveBlocked({
        runId: blocked.runId,
        resolutionId: 'res-1',
        action: 'confirm_applied',
        reasonCode: 'operator_request',
        output: `${CANARY}-confirmed`,
      })) as unknown as { ok: boolean; code?: string; message?: string };
      expect(confirmed.ok).toBe(false);
      expect(JSON.stringify(confirmed).includes(CANARY)).toBe(false);
      // The run remains blocked; no resolution fact carries the secret.
      expect((await orchestration.getOrchestrationRun(blocked.runId))?.status).toBe('blocked');
      const ledger = JSON.stringify(await orchestration.listOrchestrationEvents(blocked.runId));
      expect(ledger.includes(CANARY)).toBe(false);
    } finally {
      await fixture.dispose();
    }
  });
}
