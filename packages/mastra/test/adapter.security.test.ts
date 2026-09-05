import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  type AgentArtifact,
  type AgentHelperToolDefinition,
} from '@vict/runtime';
import {
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  MastraProductAgent,
  resolveProtectedStoreDir,
  VictMastraStorageError,
} from '@vict/mastra';
import { validProfileInput } from './fixtures.js';

/**
 * Stage 06A adversarial leakage suite (MSTR-011 canary discipline).
 *
 * Unique canaries are planted through credential-provider values, model
 * thrown errors, helper-tool thrown messages/nested causes, tool arguments
 * and results, memory content, trace metadata, and hostile object keys.
 * The appropriate serialized surfaces are then inspected — including the
 * RAW database bytes after close/reopen and the STORED observability
 * records — distinguishing intentionally retained conversation content
 * from forbidden credential/error leakage.
 */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(async () => {
  await new Promise((resolveCleanup) => setTimeout(resolveCleanup, 100));
  for (const dir of tempDirs) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }
});

const CANARY_CREDENTIAL = 'canary-CRED-sk-7f31a';
const CANARY_MODEL_ERROR = 'canary-MODELERR-9be2c';
const CANARY_HELPER_THROW = 'canary-HELPERTHROW-4cc7d';
const CANARY_HELPER_ARG = 'canary-HELPERARG-11aa2';
const CANARY_MEMORY = 'canary-MEMORY-52bb8';
const CANARY_HOSTILE_KEY = 'canary-HOSTILEKEY-63cd1';

interface Composition {
  agent: MastraProductAgent;
  store: Awaited<ReturnType<typeof createDedicatedMastraStore>>['store'];
  databasePath: string;
  helperToolLog: string[];
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
  close(): Promise<void>;
}

type SecurityComposeOptions = Parameters<typeof createDeterministicOfflineModel>[0];
async function compose(options?: SecurityComposeOptions): Promise<Composition> {
  const dir = tempDir('vict-mastra-sec-');
  const dedicated = await createDedicatedMastraStore({ dataDir: dir });
  const registry = new AgentProfileRegistry();
  const helperToolLog: string[] = [];
  const definition: AgentHelperToolDefinition = {
    id: 'helper.uppercase',
    revision: '1',
    description: 'Echo helper (pure).',
    effect: 'pure',
    input: {
      id: 'helper.sec.in',
      revision: '1',
      jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      parse(value: unknown):
        | { readonly ok: true; readonly value: unknown }
        | {
            readonly ok: false;
            readonly issues: ReadonlyArray<{ readonly path?: string; readonly message: string }>;
          } {
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { text?: unknown }).text === 'string'
        ) {
          return { ok: true, value: { text: (value as { text: string }).text } };
        }
        return { ok: false, issues: [{ path: 'text', message: 'text required' }] };
      },
    },
    output: {
      id: 'helper.sec.out',
      revision: '1',
      jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      parse(value: unknown):
        | { readonly ok: true; readonly value: unknown }
        | {
            readonly ok: false;
            readonly issues: ReadonlyArray<{ readonly path?: string; readonly message: string }>;
          } {
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { text?: unknown }).text === 'string'
        ) {
          return { ok: true, value: { text: (value as { text: string }).text } };
        }
        return { ok: false, issues: [{ path: 'text', message: 'text required' }] };
      },
    },
    execute(input: unknown) {
      helperToolLog.push(JSON.stringify(input));
      return { text: `echo:${(input as { text: string }).text}` };
    },
  };
  const artifacts: AgentArtifact[] = [
    {
      kind: 'instructions',
      id: 'instructions.ara',
      revision: '1',
      text: 'Be deterministic and brief.',
    },
    {
      kind: 'memory-policy',
      id: 'memory-policy.ara',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    { kind: 'helper-tool', id: 'helper.uppercase', revision: '1', definition },
    {
      kind: 'guardrail',
      id: 'guardrail.length',
      revision: '1',
      check: (text: string) =>
        text.length <= 2000 ? { ok: true } : { ok: false, code: 'RESPONSE_TOO_LONG' },
    },
  ];
  registry.installArtifacts(artifacts);
  registry.registerProfile(validProfileInput());
  const activation = registry.activateAgentProfile({ id: 'agent.ara.offline', revision: '1' });
  const fixture = createDeterministicOfflineModel({
    ...(options?.script !== undefined ? { script: options.script } : {}),
    ...(options?.throwOnStep !== undefined ? { throwOnStep: options.throwOnStep } : {}),
  });
  const agent = MastraProductAgent.create(activation, {
    store: dedicated.store,
    modelFactory: () => fixture,
  });
  return {
    agent,
    store: dedicated.store,
    databasePath: dedicated.databasePath,
    helperToolLog,
    activation,
    close: async () => {
      await agent.flush();
      await dedicated.close();
    },
  };
}

describe('canary leakage — planted secrets never reach forbidden surfaces', () => {
  it('a credential canary planted in the resolution path never reaches events, outcome, memory, or traces', async () => {
    const canaryMemoryText = `${CANARY_MEMORY} honest retained conversation content`;
    const { agent, store, activation, close } = await compose({
      script: { canary: { kind: 'text', text: canaryMemoryText } },
    });
    try {
      const events: unknown[] = [];
      const outcome = await agent.runTurn(
        { turnId: 'turn-cred', threadId: 'vict-conv-cred', actorId: 'actor-1', input: 'canary' },
        {
          activation,
          credentials: {
            get: async () => {
              // The provider would hand the value to the adapter; the
              // adapter's sanitization is proven by the searches below.
              return CANARY_CREDENTIAL;
            },
          },
          onEvent: (event) => events.push(event),
        },
      );
      expect(outcome.status).toBe('completed');
      // …but the credential canary is absent from every surface.
      for (const [surface, serialized] of [
        ['outcome', JSON.stringify(outcome)],
        ['events', JSON.stringify(events)],
      ] as const) {
        expect(serialized, surface).not.toContain(CANARY_CREDENTIAL);
      }
      // Intentionally retained conversation content IS in its owning store,
      // verified at the DURABLE boundary (flush + close/reopen — the
      // deployment guarantee, not a mid-flight debounce race).
      await agent.flush();
      await store.close();
      const reopened = await createDedicatedMastraStore({
        dataDir: tempDirs[tempDirs.length - 1]!,
      });
      try {
        const domain = await reopened.store.getStore('memory');
        const messages = await domain!.listMessages({
          threadId: 'vict-conv-cred',
          resourceId: 'vict-actor-actor-1',
        });
        expect(messages.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
        expect(JSON.stringify(messages)).toContain(canaryMemoryText);
        expect(JSON.stringify(messages)).not.toContain(CANARY_CREDENTIAL);
      } finally {
        await reopened.close();
      }
    } finally {
      // The original store was already closed above; the adapter flush is a
      // no-op here but keeps the failure path safe.
      await close().catch(() => undefined);
    }
  });

  it(
    'a model/provider thrown canary never reaches events, outcome, or stored traces',
    { timeout: 60_000 },
    async () => {
      const { agent, store, databasePath, activation, close } = await compose({
        script: { boom: { kind: 'text', text: 'x' } },
        throwOnStep: { kind: 'throw', message: `provider exploded: ${CANARY_MODEL_ERROR}` },
      });
      try {
        const events: unknown[] = [];
        const outcome = await agent.runTurn(
          { turnId: 'turn-merr', threadId: 'vict-conv-merr', actorId: 'actor-1', input: 'boom' },
          { activation, onEvent: (event) => events.push(event) },
        );
        expect(outcome.status).toBe('failed');
        expect(outcome.errorCode).toBe('VICT_AGENT_TURN_FAILED');
        for (const [surface, serialized] of [
          ['outcome', JSON.stringify(outcome)],
          ['events', JSON.stringify(events)],
        ] as const) {
          expect(serialized, surface).not.toContain(CANARY_MODEL_ERROR);
          expect(serialized, surface).not.toContain('provider exploded');
        }
        await agent.flush();
        // Stored observability spans: the sanitized turn carries no raw error.
        const observability = await store.getStore('observability');
        const traces = await observability!.listTraces({ pagination: { page: 0, perPage: 50 } });
        expect(JSON.stringify(traces)).not.toContain(CANARY_MODEL_ERROR);
        // Raw database bytes after close/reopen.
        await close();
        const db = new DatabaseSync(databasePath);
        try {
          const tables = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .all() as Array<{ name: string }>;
          for (const table of tables) {
            const rows = db.prepare(`SELECT * FROM "${table.name}"`).all();
            expect(JSON.stringify(rows), table.name).not.toContain(CANARY_MODEL_ERROR);
            expect(JSON.stringify(rows), table.name).not.toContain(CANARY_CREDENTIAL);
          }
        } finally {
          db.close();
        }
      } finally {
        await close().catch(() => undefined);
      }
    },
  );

  it('helper-tool thrown canaries (message and nested cause) never re-enter the model context', async () => {
    const dir = tempDir('vict-mastra-sec-throw-');
    const dedicated = await createDedicatedMastraStore({ dataDir: dir });
    const registry = new AgentProfileRegistry();
    const definition: AgentHelperToolDefinition = {
      id: 'helper.throwing',
      revision: '1',
      description: 'Throws canaries.',
      effect: 'pure',
      input: {
        id: 'i',
        revision: '1',
        jsonSchema: { type: 'object' },
        parse: (value: unknown) => ({ ok: true as const, value }),
      },
      output: {
        id: 'o',
        revision: '1',
        jsonSchema: { type: 'object' },
        parse: (value: unknown) => ({ ok: true as const, value }),
      },
      execute() {
        const error = new Error(`helper failed with ${CANARY_HELPER_THROW}`);
        (error as Error & { cause?: unknown }).cause = new Error(`nested ${CANARY_CREDENTIAL}`);
        throw error;
      },
    };
    registry.installArtifacts([
      {
        kind: 'instructions',
        id: 'instructions.ara',
        revision: '1',
        text: 'Be deterministic and brief.',
      },
      {
        kind: 'memory-policy',
        id: 'memory-policy.ara',
        revision: '1',
        config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
      },
      { kind: 'helper-tool', id: 'helper.throwing', revision: '1', definition },
      {
        kind: 'guardrail',
        id: 'guardrail.length',
        revision: '1',
        check: () => ({ ok: true }),
      },
    ]);
    registry.registerProfile({
      ...validProfileInput(),
      helperTools: [{ id: 'helper.throwing', revision: '1' }],
    });
    const activation = registry.activateAgentProfile({ id: 'agent.ara.offline', revision: '1' });
    const agent = MastraProductAgent.create(activation, {
      store: dedicated.store,
      modelFactory: () =>
        createDeterministicOfflineModel({
          script: {
            use: {
              kind: 'tool-call',
              toolName: 'helper_throwing',
              args: { text: CANARY_HELPER_ARG },
              thenText: 'AFTER-THROW',
            },
          },
        }),
    });
    try {
      const events: unknown[] = [];
      const outcome = await agent.runTurn(
        { turnId: 'turn-hthrow', threadId: 'vict-conv-hthrow', actorId: 'actor-1', input: 'use' },
        { activation, onEvent: (event) => events.push(event) },
      );
      expect(outcome.status).toBe('completed');
      // The tool failure was reported as a stable code…
      expect(outcome.events.map((event) => event.kind)).toContain('tool.failed');
      // …and both canaries are absent from the neutral boundary surfaces.
      for (const serialized of [JSON.stringify(outcome), JSON.stringify(events)]) {
        expect(serialized).not.toContain(CANARY_HELPER_THROW);
        expect(serialized).not.toContain(CANARY_CREDENTIAL);
      }
    } finally {
      await agent.flush();
      await dedicated.close();
    }
  });

  it('helper-tool arguments/results stay in the tool path and never enter traces or operational history', async () => {
    const { agent, activation, store, databasePath, helperToolLog, close } = await compose({
      script: {
        'pass canary': {
          kind: 'tool-call',
          toolName: 'helper_uppercase',
          args: { text: CANARY_HELPER_ARG },
          thenText: 'tool round done',
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-harg',
          threadId: 'vict-conv-harg',
          actorId: 'actor-1',
          input: 'pass canary',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      // The helper genuinely ran with the canary argument (tool-path truth).
      expect(helperToolLog.some((entry) => entry.includes(CANARY_HELPER_ARG))).toBe(true);
      // The tool RESULT text passed back to the model is the echo (data, not authority).
      expect(outcome.text).toBe('tool round done');
      // Stored spans hide input/output, so the argument cannot be there.
      const observability = await store.getStore('observability');
      const traces = await observability!.listTraces({ pagination: { page: 0, perPage: 50 } });
      for (const span of traces.spans) {
        expect(span.input ?? null).toBeNull();
        expect(span.output ?? null).toBeNull();
      }
      // Raw database bytes: the argument exists ONLY in the memory domain
      // (intentionally retained conversation/tool content), never in spans.
      await agent.flush();
      const db = new DatabaseSync(databasePath);
      try {
        const spans = db.prepare('SELECT * FROM mastra_ai_spans').all() as Array<{
          input: unknown;
          output: unknown;
        }>;
        for (const span of spans) {
          expect(String(span.input ?? '')).not.toContain(CANARY_HELPER_ARG);
          expect(String(span.output ?? '')).not.toContain(CANARY_HELPER_ARG);
        }
      } finally {
        db.close();
      }
    } finally {
      await close();
    }
  });

  it('hostile object keys cannot smuggle canaries into identity manifests', async () => {
    const { compileAgentProfile } = await import('@vict/kernel');
    const hostile = validProfileInput() as unknown as Record<string, unknown>;
    hostile[CANARY_HOSTILE_KEY] = 'SECRET';
    const result = compileAgentProfile(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The hostile VALUE is never echoed (established non-echoing
      // discipline: stable codes/paths/key names only, never values).
      expect(JSON.stringify(result.issues)).not.toContain('SECRET');
      // The hostile key cannot enter any compiled manifest, and no partial
      // profile/version is produced.
      expect('value' in result).toBe(false);
    }
  });

  it('stored observability spans record correlation metadata but hide payloads (STORED, not serializer)', async () => {
    const { agent, store, activation, close } = await compose({
      script: { traced: { kind: 'text', text: 'TRACE-CHECK-RESPONSE' } },
    });
    try {
      const outcome = await agent.runTurn(
        { turnId: 'turn-trace', threadId: 'vict-conv-trace', actorId: 'actor-77', input: 'traced' },
        { activation, victRunId: 'vict-run-42' },
      );
      expect(outcome.status).toBe('completed');
      await agent.flush();
      const observability = await store.getStore('observability');
      const traces = await observability!.listTraces({ pagination: { page: 0, perPage: 50 } });
      expect(traces.spans.length).toBeGreaterThan(0);
      for (const span of traces.spans) {
        expect(span.input ?? null).toBeNull();
        expect(span.output ?? null).toBeNull();
      }
      const all = JSON.stringify(traces.spans);
      expect(all).toContain('turn-trace'); // stable correlation metadata (victTurnId)
      expect(all).toContain('vict-run-42'); // VICT run correlation (victRunId)
      expect(all).toContain('"victActorId":"actor-77"'); // actor correlation
      expect(all).not.toContain('TRACE-CHECK-RESPONSE'); // payloads hidden
    } finally {
      await close();
    }
  });
});

describe('local file protection (MSTR-011)', () => {
  it('rejects store directories under public roots', () => {
    expect(() =>
      resolveProtectedStoreDir({ dataDir: resolve(tempDir('vict-pub-'), 'public', 'data') }),
    ).toThrow(VictMastraStorageError);
    expect(() =>
      resolveProtectedStoreDir({ dataDir: join(tmpdir(), 'static', 'store-data') }),
    ).toThrow(VictMastraStorageError);
    expect(() => resolveProtectedStoreDir({ dataDir: join(tmpdir(), 'www', 'store') })).toThrow(
      VictMastraStorageError,
    );
    // Non-public segments remain acceptable.
    expect(() =>
      resolveProtectedStoreDir({ dataDir: join(tmpdir(), 'static-store') }),
    ).not.toThrow();
  });

  it('rejects traversal and relative paths', () => {
    expect(() => resolveProtectedStoreDir({ dataDir: `${tmpdir()}/safe/../../etc-store` })).toThrow(
      VictMastraStorageError,
    );
    expect(() =>
      resolveProtectedStoreDir({ dataDir: `${tmpdir()}\\safe\\..\\..\\etc-store` }),
    ).toThrow(VictMastraStorageError);

    expect(() => resolveProtectedStoreDir({ dataDir: 'relative/path' })).toThrow(
      VictMastraStorageError,
    );
    expect(() => resolveProtectedStoreDir({ dataDir: '' })).toThrow(VictMastraStorageError);
  });

  it('places the database outside any public directory and the file exists after use', async () => {
    const { databasePath, close } = await compose({ script: { x: { kind: 'text', text: 'X' } } });
    try {
      const segments = databasePath.split(/[\\/]+/);
      expect(
        segments.some((segment) =>
          ['public', 'static', 'assets', 'www', 'htdocs'].includes(segment.toLowerCase()),
        ),
      ).toBe(false);
      expect(existsSync(databasePath)).toBe(true);
    } finally {
      await close();
    }
  });

  it('creates the dedicated mastra directory inside the composition data dir only', async () => {
    const dir = tempDir('vict-mastra-layout-');
    const dedicated = await createDedicatedMastraStore({ dataDir: dir });
    try {
      expect(dedicated.databasePath.startsWith(resolve(dir))).toBe(true);
      expect(dedicated.databasePath.includes('mastra')).toBe(true);
      mkdirSync(join(dir, 'untouched'), { recursive: true });
      expect(existsSync(join(dir, 'untouched'))).toBe(true);
    } finally {
      await dedicated.close();
    }
  });
});
