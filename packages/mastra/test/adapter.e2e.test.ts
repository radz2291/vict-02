import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  ConversationExportService,
  type AgentArtifact,
  type AgentHelperToolDefinition,
} from '@vict/runtime';
import type { Contract, ContractResult } from '@vict/contracts';
import {
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  MastraConversationExportPort,
  MastraMemoryDeletionPort,
  MastraProductAgent,
  MASTRA_ADAPTER_COMPATIBILITY,
  executeMemoryPrune,
  mastraResourceIdForActor,
} from '@vict/mastra';
import { validProfileInput } from './fixtures.js';

/**
 * Stage 06A adapter end-to-end proof: a REAL pinned Mastra Agent runs a
 * deterministic turn through the offline model fixture, helper tools
 * execute through the contract boundary, events normalize deterministically,
 * memory persists in the dedicated store, and lifecycle operations work.
 */

const tempDirs: string[] = [];
const closers: Array<() => Promise<void>> = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const close of closers.splice(0)) {
    try {
      await close();
    } catch {
      // already closed
    }
  }
  // Windows can hold a closed database file briefly (WAL checkpoint /
  // AV scanning); retries keep cleanup reliable without weakening any
  // test assertion.
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

/** A neutral handwritten contract for helper-tool I/O. */
function uppercaseContract(): Contract<{ text: string }> & { jsonSchema: Record<string, unknown> } {
  const contract: Contract<{ text: string }> = {
    id: 'helper.uppercase.input',
    revision: '1',
    expected: 'an object with a non-empty text member',
    parse(value: unknown): ContractResult<{ text: string }> {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { text?: unknown }).text === 'string'
      ) {
        return { ok: true, value: { text: (value as { text: string }).text } };
      }
      return {
        ok: false,
        issues: [{ code: 'CONTRACT_TEXT_REQUIRED', path: 'text', message: 'text is required' }],
      };
    },
  };
  return Object.freeze({
    ...contract,
    jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  }) as Contract<{ text: string }> & {
    jsonSchema: Record<string, unknown>;
  };
}

function helperToolArtifact(): AgentArtifact {
  const io = uppercaseContract();
  const parseLoose = io.parse as (value: unknown) =>
    | { readonly ok: true; readonly value: unknown }
    | {
        readonly ok: false;
        readonly issues: ReadonlyArray<{ readonly path?: string; readonly message: string }>;
      };
  const definition: AgentHelperToolDefinition = {
    id: 'helper.uppercase',
    revision: '1',
    description: 'Uppercases the input text (pure formatting helper).',
    effect: 'pure',
    input: { id: io.id, revision: io.revision, jsonSchema: io.jsonSchema, parse: parseLoose },
    output: {
      id: 'helper.uppercase.output',
      revision: '1',
      jsonSchema: io.jsonSchema,
      parse: parseLoose,
    },
    execute: (input: unknown) => ({ text: String((input as { text: string }).text).toUpperCase() }),
  };
  return {
    kind: 'helper-tool' as const,
    id: definition.id,
    revision: definition.revision,
    definition,
  };
}

function guardrailArtifact(
  check: (text: string) => { readonly ok: true } | { readonly ok: false; readonly code: string },
): AgentArtifact {
  return { kind: 'guardrail', id: 'guardrail.length', revision: '1', check };
}

interface Composition {
  agent: MastraProductAgent;
  store: Awaited<ReturnType<typeof createDedicatedMastraStore>>['store'];
  databasePath: string;
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
  registry: AgentProfileRegistry;
  close(): Promise<void>;
}

/** Compose the full valid profile against a fresh dedicated store. */
type ComposeOptions = Parameters<typeof createDeterministicOfflineModel>[0] & {
  readonly guardrail?: (
    text: string,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  readonly dir?: string;
};
async function compose(options?: ComposeOptions): Promise<Composition> {
  const dir = options?.dir ?? tempDir('vict-mastra-e2e-');
  const dedicated = await createDedicatedMastraStore({ dataDir: dir });
  closers.push(() => dedicated.close());
  const registry = new AgentProfileRegistry();

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
    helperToolArtifact(),
    guardrailArtifact(
      options?.guardrail ??
        ((text: string) =>
          text.length <= 1000 ? { ok: true } : { ok: false, code: 'RESPONSE_TOO_LONG' }),
    ),
  ];
  registry.installArtifacts(artifacts);
  registry.registerProfile(validProfileInput());
  const activation = registry.activateAgentProfile({ id: 'agent.ara.offline', revision: '1' });

  const model = createDeterministicOfflineModel({
    ...(options?.script !== undefined ? { script: options.script } : {}),
    ...(options?.throwOnStep !== undefined ? { throwOnStep: options.throwOnStep } : {}),
  });
  const agent = MastraProductAgent.create(activation, {
    store: dedicated.store,
    modelFactory: () => model,
  });
  return {
    agent,
    store: dedicated.store,
    databasePath: dedicated.databasePath,
    activation,
    registry,
    close: async () => {
      // Orderly shutdown: settle memory saves and flush buffered spans
      // before releasing the store's file handles (Windows lock-safe).
      await agent.flush();
      await dedicated.close();
    },
  };
}

describe('Mastra adapter end-to-end (real pinned Mastra Agent, offline)', () => {
  it('runs a deterministic plain turn with normalized events and usage', async () => {
    const { agent, activation, close } = await compose({
      script: { 'Say the phrase': { kind: 'text', text: 'DETERMINISTIC-PHRASE' } },
    });
    try {
      const first = await agent.runTurn(
        {
          turnId: 'turn-1',
          threadId: 'vict-conv-conv-1',
          actorId: 'actor-1',
          input: 'Say the phrase',
        },
        { activation },
      );
      expect(first.status).toBe('completed');
      expect(first.text).toBe('DETERMINISTIC-PHRASE');
      expect(first.providerModelIdentity).toBe('offline-fixture/deterministic-1');
      const kinds = first.events.map((event) => event.kind);
      expect(kinds[0]).toBe('response.started');
      expect(kinds.filter((kind) => kind === 'text.delta').length).toBe(2);
      expect(kinds).toContain('usage.updated');
      expect(kinds.at(-1)).toBe('response.completed');
      // Sequence numbers are monotonic and gapless.
      expect(first.events.map((event) => event.seq)).toEqual(
        first.events.map((_, index) => index + 1),
      );
      // Identity on every event.
      for (const event of first.events) {
        expect(event.turnId).toBe('turn-1');
        expect(event.agentProfileVersion).toBe(agent.agentProfileVersion);
      }

      // Determinism: the same input produces the same event order.
      const second = await agent.runTurn(
        {
          turnId: 'turn-2',
          threadId: 'vict-conv-conv-1',
          actorId: 'actor-1',
          input: 'Say the phrase',
        },
        { activation },
      );
      expect(second.text).toBe(first.text);
      expect(second.events.map((event) => [event.seq, event.kind])).toEqual(
        first.events.map((event) => [event.seq, event.kind]),
      );
    } finally {
      await close();
    }
  });

  it('executes a pure helper tool through the contract boundary', async () => {
    const { agent, activation, close } = await compose({
      script: {
        'Use the helper': {
          kind: 'tool-call',
          toolName: 'helper_uppercase',
          args: { text: 'make me loud' },
          thenText: 'TOOL ROUND COMPLETE',
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-tool-1',
          threadId: 'vict-conv-conv-2',
          actorId: 'actor-1',
          input: 'Use the helper',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      expect(outcome.text).toBe('TOOL ROUND COMPLETE');
      const kinds = outcome.events.map((event) => event.kind);
      expect(kinds).toContain('tool.requested');
      expect(kinds).toContain('tool.started');
      expect(kinds).toContain('tool.completed');
      expect(kinds).not.toContain('tool.failed');
    } finally {
      await close();
    }
  });

  it('persists conversation memory in the dedicated store across close/reopen', async () => {
    const dir = tempDir('vict-mastra-persist-');
    const first = await compose({ dir, script: { hi: { kind: 'text', text: 'HELLO' } } });
    await first.agent.runTurn(
      { turnId: 'turn-p1', threadId: 'vict-conv-conv-9', actorId: 'actor-1', input: 'hi' },
      { activation: first.activation },
    );
    await first.close();

    expect(existsSync(first.databasePath)).toBe(true);
    // Fresh store over the same file (fresh-process persistence model).
    const reopened = await createDedicatedMastraStore({ dataDir: dir });
    closers.push(() => reopened.close());
    const domain = await reopened.store.getStore('memory');
    const messages = await domain!.listMessages({ threadId: 'vict-conv-conv-9' });
    expect(messages.messages.length).toBe(2); // user + assistant
  });

  it('sanitizes a canary-bearing model failure', async () => {
    const canary = 'sk-SECRET-CANARY-9f8b';
    const { agent, activation, close } = await compose({
      script: { boom: { kind: 'text', text: 'ignored' } },
      throwOnStep: { kind: 'throw', message: `provider exploded with ${canary}` },
    });
    try {
      const outcome = await agent.runTurn(
        { turnId: 'turn-fail', threadId: 'vict-conv-conv-3', actorId: 'actor-1', input: 'boom' },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TURN_FAILED');
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toContain(canary);
      expect(serialized).not.toContain('provider exploded');
    } finally {
      await close();
    }
  });

  it('fails the turn closed when a guardrail rejects the completed text', async () => {
    const { agent, activation, close } = await compose({
      script: { hi: { kind: 'text', text: 'TINY' } },
      guardrail: (text: string) =>
        text.length < 5 ? { ok: false, code: 'RESPONSE_TOO_LONG' } : { ok: true },
    });
    try {
      const outcome = await agent.runTurn(
        { turnId: 'turn-g1', threadId: 'vict-conv-conv-4', actorId: 'actor-1', input: 'hi' },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_GUARDRAIL_RESPONSE_TOO_LONG');
    } finally {
      await close();
    }
  });

  it('exports a conversation through the governed export path', async () => {
    const { agent, store, activation, close } = await compose({
      script: { hi: { kind: 'text', text: 'EXPORT-ME' } },
    });
    try {
      await agent.runTurn(
        { turnId: 'turn-e1', threadId: 'vict-conv-conv-7', actorId: 'actor-42', input: 'hi' },
        { activation },
      );

      const memoryExport = new MastraConversationExportPort({ store, actorId: 'actor-42' });
      const service = new ConversationExportService({ memory: memoryExport });
      const result = await service.export({ conversationId: 'conv-7', actorId: 'actor-42' });
      expect(result.retained).toBe(false);
      expect(result.export.actorId).toBe('actor-42');
      expect(result.export.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
      expect(result.export.messages.map((message) => message.text)).toEqual(['hi', 'EXPORT-ME']);

      // Actor mismatch is a stable denial; another actor cannot read the thread.
      await expect(
        service.export({ conversationId: 'conv-7', actorId: 'actor-1' }),
      ).rejects.toMatchObject({
        code: 'VICT_AGENT_EXPORT_ACTOR_MISMATCH',
      });
    } finally {
      await close();
    }
  });

  it('deletes a conversation thread idempotently through the memory port', async () => {
    const { agent, store, activation, close } = await compose({
      script: { hi: { kind: 'text', text: 'DELETE-ME' } },
    });
    try {
      await agent.runTurn(
        { turnId: 'turn-d1', threadId: 'vict-conv-conv-5', actorId: 'actor-1', input: 'hi' },
        { activation },
      );

      const deletion = new MastraMemoryDeletionPort({ store, actorId: 'actor-1' });
      expect((await deletion.deleteConversationThread('conv-5')).deleted).toBe(true);
      // Idempotent: second delete reports already-absent.
      expect((await deletion.deleteConversationThread('conv-5')).deleted).toBe(false);
      const domain = await store.getStore('memory');
      const messages = await domain!.listMessages({ threadId: 'vict-conv-conv-5' });
      expect(messages.messages.length).toBe(0);
    } finally {
      await close();
    }
  });

  it('executes retention pruning and removes only eligible records', async () => {
    const dir = tempDir('vict-mastra-prune-');
    const dedicated = await createDedicatedMastraStore({
      dataDir: dir,
      retention: { messagesMaxAgeMs: 10_000 },
    });
    closers.push(() => dedicated.close());
    const registry = new AgentProfileRegistry();
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
      helperToolArtifact(),
      guardrailArtifact((text: string) =>
        text.length <= 1000 ? { ok: true } : { ok: false, code: 'RESPONSE_TOO_LONG' },
      ),
    ]);
    registry.registerProfile(validProfileInput());
    const activation = registry.activateAgentProfile({ id: 'agent.ara.offline', revision: '1' });
    const agent = MastraProductAgent.create(activation, {
      store: dedicated.store,
      modelFactory: () =>
        createDeterministicOfflineModel({ script: { hi: { kind: 'text', text: 'PRUNE-CHECK' } } }),
    });

    // A CURRENT conversation (must survive pruning).
    await agent.runTurn(
      { turnId: 'turn-new', threadId: 'vict-conv-prune-current', actorId: 'actor-1', input: 'hi' },
      { activation },
    );

    // Two genuinely aged records, persisted directly through the store's
    // own save API with explicit old creation instants (simulated aging —
    // no fragile sleeps). These are prune-eligible under a 10s bound.
    const memoryDomain = await dedicated.store.getStore('memory');
    const now = Date.now();
    await memoryDomain!.saveMessages({
      messages: [
        {
          id: 'aged-message-1',
          role: 'user',
          threadId: 'vict-conv-prune-aged',
          resourceId: mastraResourceIdForActor('actor-1'),
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'AGED-MESSAGE-1' }],
          },
          createdAt: new Date(now - 60_000),
        },
        {
          id: 'aged-message-2',
          role: 'assistant',
          threadId: 'vict-conv-prune-aged',
          resourceId: mastraResourceIdForActor('actor-1'),
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'AGED-MESSAGE-2' }],
          },
          createdAt: new Date(now - 60_000),
        },
      ] as never,
    });

    // Prune as of "now": rows older than 10s are eligible.
    const result = await executeMemoryPrune({
      store: dedicated.store,
      retention: { messagesMaxAgeMs: 10_000 },
      now: () => now,
    });
    const messageResult = result.tables.find((table) => table.table.includes('message'));
    expect(messageResult?.deleted ?? 0).toBeGreaterThanOrEqual(2);

    const domain = await dedicated.store.getStore('memory');
    const aged = await domain!.listMessages({ threadId: 'vict-conv-prune-aged' });
    expect(aged.messages.length).toBe(0); // eligible records removed
    const current = await domain!.listMessages({ threadId: 'vict-conv-prune-current' });
    expect(current.messages.length).toBe(2); // current records remain

    // Idempotent: repeated pruning removes nothing more.
    const repeat = await executeMemoryPrune({
      store: dedicated.store,
      retention: { messagesMaxAgeMs: 10_000 },
      now: () => now,
    });
    const repeatMessageResult = repeat.tables.find((table) => table.table.includes('message'));
    expect(repeatMessageResult?.deleted ?? 0).toBe(0);
    await agent.flush();
    await dedicated.close();
  });

  it('records adapter compatibility metadata with the pinned versions', async () => {
    const { agent, close } = await compose({ script: { x: { kind: 'text', text: 'X' } } });
    try {
      expect(agent.metadata.agentProfileVersion).toMatch(/^v1_[0-9a-f]{64}$/);
      expect(MASTRA_ADAPTER_COMPATIBILITY.runtimePackages['@mastra/core']).toBe('1.64.0');
      expect(MASTRA_ADAPTER_COMPATIBILITY.runtimePackages['@mastra/memory']).toBe('1.28.2');
      expect(MASTRA_ADAPTER_COMPATIBILITY.runtimePackages['@mastra/libsql']).toBe('1.22.3');
      expect(MASTRA_ADAPTER_COMPATIBILITY.runtimePackages['@mastra/observability']).toBe('1.17.5');
    } finally {
      await close();
    }
  });

  it('isolates threads by actor: no cross-user memory access', async () => {
    const { agent, store, activation, close } = await compose({
      script: { hi: { kind: 'text', text: 'ISO' } },
    });
    try {
      await agent.runTurn(
        { turnId: 'turn-i1', threadId: 'vict-conv-iso', actorId: 'actor-1', input: 'hi' },
        { activation },
      );
      const domain = await store.getStore('memory');
      // The owner sees the thread; the other actor's resource filter excludes it.
      const ownerThreads = await domain!.listThreads({
        filter: { resourceId: mastraResourceIdForActor('actor-1') },
      });
      const otherThreads = await domain!.listThreads({
        filter: { resourceId: mastraResourceIdForActor('actor-2') },
      });
      expect(ownerThreads.threads.length).toBe(1);
      expect(otherThreads.threads.length).toBe(0);
      const cross = await domain!.listMessages({
        threadId: 'vict-conv-iso',
        resourceId: mastraResourceIdForActor('actor-2'),
      });
      expect(cross.messages.length).toBe(0);
    } finally {
      await close();
    }
  });
});
