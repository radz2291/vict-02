import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AgentProfileRegistry,
  ConversationDeletionCoordinator,
  InMemoryAgentGovernanceStore,
  protectCredentialPort,
  type AgentArtifact,
  type AgentHelperToolDefinition,
} from '@vict/runtime';
import { createSqliteAgentGovernanceStore } from '@vict/store-sqlite';
import {
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  mastraThreadIdForConversation,
  MastraMemoryDeletionPort,
  MastraProductAgent,
} from '@vict/mastra';
import { AGENT_PROFILE_SCHEMA } from '@vict/sdk';
import { durableWrite, emitReady, hang } from './readiness.js';

/**
 * Stage 06A fresh-process agent worker. Invoked as a real child process
 * (tsx); the parent controls termination and recovery. Stages:
 *
 * - `setup`          compose + activate + persist identity; run one durable turn; hang (SIGKILL target)
 * - `verify-memory`  fresh process: reopen the dedicated store; assert persisted turn content; exit 0
 * - `restore`        fresh process: restore the EXACT pinned activation from the governance store; exit 0
 * - `restore-miss`   fresh process: restore against a registry holding only a NEWER revision; must fail closed
 * - `delete-partial` fresh process: governed deletion crosses the domain boundary, then hangs before the memory step (SIGKILL target)
 * - `delete-resume`  fresh process: recovery completes the deletion idempotently; asserts receipts; exit 0
 *
 * Fixture infrastructure only — no production runtime source is involved.
 */

interface WorkerState {
  readonly dataDir: string;
  readonly governanceDbPath: string;
  readonly activationVersion: string;
  readonly agentProfileVersion: string;
  readonly threadId: string;
}

function profileInput(): Parameters<AgentProfileRegistry['registerProfile']>[0] {
  return {
    schema: AGENT_PROFILE_SCHEMA,
    id: 'agent.ara.offline',
    revision: '1',
    instructions: { id: 'instructions.ara', revision: '1' },
    modelProfile: {
      id: 'model.ara.offline',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: { temperature: 0, maxOutputTokens: 512 },
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.ara', revision: '1' },
    guardrails: [{ id: 'guardrail.length', revision: '1' }],
    helperTools: [{ id: 'helper.uppercase', revision: '1' }],
    capabilities: [],
    adapter: {
      id: '@vict/mastra',
      revision: '1',
      runtimePackages: {
        '@mastra/core': '1.64.0',
        '@mastra/memory': '1.28.2',
        '@mastra/libsql': '1.22.3',
        '@mastra/observability': '1.17.5',
      },
    },
  };
}

function artifacts(): AgentArtifact[] {
  const definition: AgentHelperToolDefinition = {
    id: 'helper.uppercase',
    revision: '1',
    description: 'Pure echo helper.',
    effect: 'pure',
    input: {
      id: 'helper.uppercase.in',
      revision: '1',
      jsonSchema: { type: 'object' },
      parse: (value: unknown) => ({ ok: true as const, value }),
    },
    output: {
      id: 'helper.uppercase.out',
      revision: '1',
      jsonSchema: { type: 'object' },
      parse: (value: unknown) => ({ ok: true as const, value }),
    },
    execute: (value: unknown) => value,
  };
  return [
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
}

async function composeAdapter(dataDir: string): Promise<{
  agent: MastraProductAgent;
  dedicated: Awaited<ReturnType<typeof createDedicatedMastraStore>>;
  registry: AgentProfileRegistry;
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
}> {
  const dedicated = await createDedicatedMastraStore({ dataDir });
  const registry = new AgentProfileRegistry();
  registry.installArtifacts(artifacts());
  registry.registerProfile(profileInput());
  const activation = registry.activateAgentProfile({ id: 'agent.ara.offline', revision: '1' });
  const agent = MastraProductAgent.create(activation, {
    store: dedicated.store,
    modelFactory: () =>
      createDeterministicOfflineModel({
        script: { 'Say the phrase': { kind: 'text', text: 'RESTART-PHRASE' } },
      }),
  });
  return { agent, dedicated, registry, activation };
}

async function main(): Promise<void> {
  const [stage, dataDir, governanceDbPath, statePath] = process.argv.slice(2);
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(join(governanceDbPath, '..'), { recursive: true });
  mkdirSync(join(statePath, '..'), { recursive: true });
  // The conversation id and its derived Mastra thread id follow the ONE
  // convention the governed deletion ports use.
  const conversationId = 'conv-restart';
  const threadId = mastraThreadIdForConversation(conversationId);

  if (stage === 'setup') {
    const governance = createSqliteAgentGovernanceStore({ path: governanceDbPath });
    const { agent, activation } = await composeAdapter(dataDir);
    const outcome = await agent.runTurn(
      { turnId: 'turn-restart-1', threadId, actorId: 'actor-restart', input: 'Say the phrase' },
      {
        credentials: protectCredentialPort({
          async get(name) {
            void name;
            return 'cred-canary-should-never-persist';
          },
        }),
      },
    );
    if (outcome.status !== 'completed') {
      throw new Error(`setup turn did not complete: ${outcome.errorCode}`);
    }
    await governance.saveAgentActivation({
      recordSchema: 'vict.agent-activation-record@1',
      activationVersion: activation.activationVersion,
      agentProfileVersion: activation.agentProfileVersion,
      agentId: 'agent.ara.offline',
      agentRevision: '1',
      canonicalManifest: activation.profile.manifestJson,
      artifacts: [{ kind: 'instructions', id: 'instructions.ara', revision: '1' }],
      createdAt: activation.createdAt,
    });
    const state: WorkerState = {
      dataDir,
      governanceDbPath,
      activationVersion: activation.activationVersion,
      agentProfileVersion: activation.agentProfileVersion,
      threadId,
    };
    durableWrite(statePath, state);
    void governance.close?.();
    emitReady('setup-complete');
    hang(); // parent SIGKILLs after observing the sentinel
    return;
  }

  if (stage === 'verify-memory') {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as WorkerState;
    const dedicated = await createDedicatedMastraStore({ dataDir: state.dataDir });
    const domain = await dedicated.store.getStore('memory');
    const messages = await domain!.listMessages({
      threadId: state.threadId,
      resourceId: 'vict-actor-actor-restart',
    });
    const result = {
      stage: 'verify-memory',
      messageCount: messages.messages.length,
      roles: messages.messages.map((message) => message.role),
      containsReply: JSON.stringify(messages).includes('RESTART-PHRASE'),
      credentialCanaryPresent: JSON.stringify(messages).includes(
        'cred-canary-should-never-persist',
      ),
    };
    writeFileSync(
      join(statePath, '..', 'verify-memory-result.json'),
      JSON.stringify(result, null, 2),
    );
    await dedicated.close();
    emitReady('memory-verified');
    return;
  }

  if (stage === 'restore') {
    const governance = createSqliteAgentGovernanceStore({ path: governanceDbPath });
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as WorkerState;
    const record = await governance.getAgentActivation(state.activationVersion);
    if (record === undefined) {
      throw new Error('activation record missing');
    }
    const registry = new AgentProfileRegistry();
    registry.installArtifacts(artifacts());
    registry.registerProfile(profileInput());
    const restored = registry.restoreActivation(record);
    const result = {
      stage: 'restore',
      ok: restored.ok,
      activationVersion: restored.ok ? restored.activation.activationVersion : undefined,
      agentProfileVersion: restored.ok ? restored.activation.agentProfileVersion : undefined,
      instructionsText: restored.ok ? restored.activation.instructions.artifact.text : undefined,
    };
    await governance.close?.();
    writeFileSync(join(statePath, '..', 'restore-result.json'), JSON.stringify(result, null, 2));
    emitReady('restore-complete');
    return;
  }

  if (stage === 'restore-miss') {
    const governance = createSqliteAgentGovernanceStore({ path: governanceDbPath });
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as WorkerState;
    const record = await governance.getAgentActivation(state.activationVersion);
    if (record === undefined) {
      throw new Error('activation record missing');
    }
    // A "fresh process" that holds ONLY a NEWER profile revision and a
    // NEWER instructions revision: nothing may substitute.
    const registry = new AgentProfileRegistry();
    const newer = artifacts().map((artifact) =>
      artifact.kind === 'instructions'
        ? { ...artifact, revision: '2', text: 'NEWER INSTRUCTIONS' }
        : artifact,
    );
    registry.installArtifacts(newer);
    registry.registerProfile({
      ...profileInput(),
      revision: '2',
      instructions: { id: 'instructions.ara', revision: '2' },
    });
    const restored = registry.restoreActivation(record);
    const result = {
      stage: 'restore-miss',
      ok: restored.ok,
      failureCode: restored.ok ? undefined : restored.code,
    };
    await governance.close?.();
    writeFileSync(
      join(statePath, '..', 'restore-miss-result.json'),
      JSON.stringify(result, null, 2),
    );
    emitReady('restore-miss-complete');
    return;
  }

  if (stage === 'delete-partial') {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as WorkerState;
    const dedicated = await createDedicatedMastraStore({ dataDir: state.dataDir });
    void dedicated;
    const governance = createSqliteAgentGovernanceStore({ path: state.governanceDbPath });
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      // The application-domain port succeeds and records its receipt.
      domain: {
        async deleteConversation(_conversationId) {
          return { deleted: true };
        },
      },
      // The memory port hangs BEFORE executing: the parent SIGKILLs the
      // process while exactly one durable receipt exists.
      memory: {
        async deleteConversationThread(_conversationId: string) {
          durableWrite(statePath, { ...state, partial: 'before-memory-step' });
          emitReady('deletion-partial');
          hang();
        },
      },
    });
    const outcome = await coordinator.deleteConversation({
      conversationId,
      actorId: 'actor-restart',
    });
    void outcome;
    return;
  }

  if (stage === 'delete-resume') {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as WorkerState;
    const dedicated = await createDedicatedMastraStore({ dataDir: state.dataDir });
    const governance = createSqliteAgentGovernanceStore({ path: state.governanceDbPath });
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      domain: {
        async deleteConversation() {
          return { deleted: true };
        },
      },
      memory: new MastraMemoryDeletionPort({ store: dedicated.store, actorId: 'actor-restart' }),
    });
    const report = await coordinator.recoverPending();
    // Idempotency: a second recovery changes nothing.
    const report2 = await coordinator.recoverPending();
    const intent = await governance.getDeletionIntent('vict-del-conv-restart');
    const domain = await dedicated.store.getStore('memory');
    const messages = await domain!.listMessages({
      threadId: state.threadId,
      resourceId: 'vict-actor-actor-restart',
    });
    const result = {
      stage: 'delete-resume',
      first: report,
      second: report2,
      intentState: intent?.state,
      receipts: intent?.receipts.map((receipt) => receipt.step),
      remainingMessages: messages.messages.length,
    };
    await dedicated.close();
    void InMemoryAgentGovernanceStore;
    await governance.close?.();
    writeFileSync(
      join(statePath, '..', 'delete-resume-result.json'),
      JSON.stringify(result, null, 2),
    );
    emitReady('deletion-resumed');
    return;
  }

  throw new Error(`unknown worker stage '${String(stage)}'`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
