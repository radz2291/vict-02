import type { ExecutionMode, KernelEvent } from '@vict/kernel';
import type { PayloadRetention } from './types.js';
import type {
  ActivationCatalog,
  ActivationSelection,
  CommitRunTransitionCommand,
  CreateRunCommand,
  ExecutionStore,
  PublishActivationCommand,
  PublishAndSelectCommand,
  PublishResult,
  RecoveredRun,
  RecoveryCommand,
  RunQuery,
  SelectActivationCommand,
  StoredActivation,
  StoredEvent,
  StoredRun,
  StoredRunStatus,
  TransitionFaultHooks,
  VictStores,
} from './store-types.js';
import { ACTIVATION_MANIFEST_SCHEMA, RUN_EVENT_SCHEMA } from './store-types.js';
import { VictStoreError } from './store-errors.js';
import { immutableSnapshot, toCanonicalJson } from './serialization.js';

interface InternalRun {
  run: StoredRun;
  events: StoredEvent[];
}

/**
 * Conforming in-memory implementation of the semantic store ports.
 *
 * Semantics match the SQLite adapter: atomic transitions, optimistic
 * concurrency, dense append-only event sequences, immutable/defensive
 * snapshots on every read (DATA-012), canonical manifests, and structured
 * safe errors. Optional test-only fault hooks make it possible to prove
 * that a failure staged between the run update and the event append leaves
 * no half-state behind.
 */
export interface InMemoryStoresOptions {
  /** Test-only fault hooks; inert when omitted. */
  readonly faults?: TransitionFaultHooks;
}

export function createInMemoryStores(options: InMemoryStoresOptions = {}): VictStores {
  const faults = options.faults;
  const activations = new Map<string, StoredActivation>();
  const selections = new Map<string, ActivationSelection>();
  const runs = new Map<string, InternalRun>();

  const requireActivation = (activationVersion: string, operation: string): StoredActivation => {
    const found = activations.get(activationVersion);
    if (!found) {
      throw new VictStoreError('VICT_STORE_ACTIVATION_NOT_FOUND', 'Activation not found.', {
        operation,
        activationVersion,
      });
    }
    return found;
  };

  const publish = (command: PublishActivationCommand): PublishResult => {
    assertManifest(command);
    const existing = activations.get(command.manifest.activationVersion);
    if (existing) {
      if (existing.canonicalManifest !== command.canonicalManifest) {
        throw new VictStoreError(
          'VICT_STORE_ACTIVATION_COLLISION',
          'An activation with this version already exists with different content.',
          {
            operation: 'catalog.publish',
            activationVersion: command.manifest.activationVersion,
          },
        );
      }
      return { activationVersion: existing.activationVersion, created: false };
    }
    const record: StoredActivation = {
      activationVersion: command.manifest.activationVersion,
      manifestSchema: command.manifest.manifestSchema,
      graphId: command.manifest.graphId,
      graphVersion: command.manifest.graphVersion,
      capabilitySetVersion: command.manifest.capabilitySetVersion,
      canonicalManifest: command.canonicalManifest,
      createdAt: Date.now(),
    };
    activations.set(record.activationVersion, immutableSnapshot(record));
    return { activationVersion: record.activationVersion, created: true };
  };

  const select = (command: SelectActivationCommand): ActivationSelection => {
    requireActivation(command.activationVersion, 'catalog.select');
    const current = selections.get(command.graphId);
    if (command.expectedSelectionRevision !== undefined) {
      if (!current) {
        throw new VictStoreError(
          'VICT_STORE_SELECTION_CONFLICT',
          'No current selection exists for this graph; the expected selection revision does not match.',
          {
            operation: 'catalog.select',
            graphId: command.graphId,
            expectedSelectionRevision: command.expectedSelectionRevision,
            actualSelectionRevision: undefined,
          },
        );
      }
      if (current.selectionRevision !== command.expectedSelectionRevision) {
        throw new VictStoreError(
          'VICT_STORE_SELECTION_CONFLICT',
          'The selection changed since it was read; the expected selection revision is stale.',
          {
            operation: 'catalog.select',
            graphId: command.graphId,
            activationVersion: command.activationVersion,
            expectedSelectionRevision: command.expectedSelectionRevision,
            actualSelectionRevision: current.selectionRevision,
          },
        );
      }
    }
    const next: ActivationSelection = {
      graphId: command.graphId,
      activationVersion: command.activationVersion,
      selectionRevision: (current?.selectionRevision ?? 0) + 1,
      selectedAt: Date.now(),
    };
    selections.set(command.graphId, next);
    return immutableSnapshot(next);
  };

  const catalog: ActivationCatalog = {
    async publish(command) {
      return publish(command);
    },
    async get(activationVersion) {
      const found = activations.get(activationVersion);
      return found ? immutableSnapshot(found) : undefined;
    },
    async list() {
      return [...activations.values()].map((record) => immutableSnapshot(record));
    },
    async select(command) {
      return select(command);
    },
    async getSelection(graphId) {
      const found = selections.get(graphId);
      return found ? immutableSnapshot(found) : undefined;
    },
    async getSelected(graphId) {
      const selection = selections.get(graphId);
      if (!selection) {
        return undefined;
      }
      return immutableSnapshot(
        requireActivation(selection.activationVersion, 'catalog.getSelected'),
      );
    },
    async publishAndSelect(command: PublishAndSelectCommand) {
      const published = publish(command.publish);
      const selection = select({
        ...command.select,
        activationVersion: published.activationVersion,
      });
      return { ...published, selection };
    },
  };

  const createRun = (command: CreateRunCommand): StoredRun => {
    assertCreateCommand(command);
    if (runs.has(command.runId)) {
      throw new VictStoreError('VICT_STORE_RUN_CONFLICT', 'A run with this id already exists.', {
        operation: 'execution.createRun',
        runId: command.runId,
      });
    }
    // A run must reference a published activation (RUN-001, FK parity with
    // the SQLite adapter's foreign key).
    requireActivation(command.activationVersion, 'execution.createRun');
    const record: StoredRun = {
      runId: command.runId,
      graphId: command.graphId,
      graphVersion: command.graphVersion,
      capabilitySetVersion: command.capabilitySetVersion,
      activationVersion: command.activationVersion,
      status: 'running',
      mode: command.mode,
      retention: command.retention,
      steps: command.steps ?? 0,
      currentNodeId: command.currentNodeId ?? null,
      recordRevision: 1,
      createdAt: command.timestamp,
      updatedAt: command.timestamp,
      completedAt: null,
    };
    const stored: InternalRun = { run: record, events: [] };
    runs.set(record.runId, stored);
    try {
      // CreateRun and its initial events are one atomic operation: the fault
      // hook runs after the run update is staged but before events commit.
      faults?.afterRunUpdate?.(command);
      appendEvents(stored, command.events, 0, command.timestamp);
      faults?.beforeCommit?.(command);
    } catch (cause) {
      runs.delete(record.runId);
      throw wrapInternal(cause, 'execution.createRun', record.runId);
    }
    return immutableSnapshot(record);
  };

  const commitTransition = (command: CommitRunTransitionCommand): StoredRun => {
    assertTransitionCommand(command);
    const stored = runs.get(command.runId);
    if (!stored) {
      throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
        operation: 'execution.commitTransition',
        runId: command.runId,
      });
    }
    if (stored.run.recordRevision !== command.expectedRecordRevision) {
      throw new VictStoreError(
        'VICT_STORE_RUN_CONFLICT',
        'The run record changed since it was read; the expected record revision is stale.',
        {
          operation: 'execution.commitTransition',
          runId: command.runId,
          expectedRecordRevision: command.expectedRecordRevision,
          actualRecordRevision: stored.run.recordRevision,
        },
      );
    }
    if (stored.run.status !== 'running') {
      throw new VictStoreError(
        'VICT_STORE_RUN_CONFLICT',
        'The run is already terminal and cannot accept further transitions.',
        {
          operation: 'execution.commitTransition',
          runId: command.runId,
          expectedRecordRevision: command.expectedRecordRevision,
          actualRecordRevision: stored.run.recordRevision,
        },
      );
    }
    const nextStatus = command.next.status ?? 'running';
    if (!ALL_RUN_STATUSES.includes(nextStatus)) {
      throw new VictStoreError(
        'VICT_STORE_INVALID_COMMAND',
        'The transition requests an unknown run status.',
        { operation: 'execution.commitTransition', runId: command.runId },
      );
    }
    // Retention boundary (DATA-004/005/006): stored rows obey the run's
    // retention policy regardless of what the command carries.
    if (stored.run.retention === 'none' && command.next.outputSummary !== undefined) {
      throw new VictStoreError(
        'VICT_STORE_INVALID_COMMAND',
        'Retention is none; an output summary cannot be stored.',
        { operation: 'execution.commitTransition', runId: command.runId },
      );
    }
    if (
      stored.run.retention === 'none' &&
      'output' in command.next &&
      command.next.output !== undefined
    ) {
      throw new VictStoreError(
        'VICT_STORE_INVALID_COMMAND',
        'Retention is none; a complete output cannot be stored.',
        { operation: 'execution.commitTransition', runId: command.runId },
      );
    }
    if (
      stored.run.retention !== 'full' &&
      'output' in command.next &&
      command.next.output !== undefined
    ) {
      throw new VictStoreError(
        'VICT_STORE_INVALID_COMMAND',
        'Complete outputs require explicit full retention.',
        { operation: 'execution.commitTransition', runId: command.runId },
      );
    }
    // Stage the updated record without mutating the previous snapshot, then
    // append events. Any failure \u2014 invalid sequence, fault hook, or
    // serialization \u2014 rolls the staged transition back so no half-state
    // (run updated without its events) ever becomes visible.
    const previous = stored.run;
    const updated: StoredRun = {
      ...stored.run,
      ...command.next,
      status: nextStatus,
      recordRevision: stored.run.recordRevision + 1,
      updatedAt: command.timestamp,
      completedAt:
        command.next.completedAt !== undefined
          ? command.next.completedAt
          : nextStatus === 'running'
            ? stored.run.completedAt
            : command.timestamp,
    };
    stored.run = updated;
    try {
      faults?.afterRunUpdate?.(command);
      appendEvents(stored, command.events, command.expectedNextEventSeq, command.timestamp);
      faults?.beforeCommit?.(command);
      return immutableSnapshot(stored.run);
    } catch (cause) {
      stored.run = previous;
      stored.events.length = command.expectedNextEventSeq;
      throw wrapInternal(cause, 'execution.commitTransition', command.runId);
    }
  };

  const execution: ExecutionStore = {
    async createRun(command) {
      return createRun(command);
    },
    async commitTransition(command) {
      return commitTransition(command);
    },
    async getRun(runId) {
      const found = runs.get(runId);
      return found ? immutableSnapshot(found.run) : undefined;
    },
    async listRuns(query: RunQuery = {}) {
      const all = [...runs.values()]
        .map((entry) => entry.run)
        .filter(
          (run) =>
            (query.graphId === undefined || run.graphId === query.graphId) &&
            (query.activationVersion === undefined ||
              run.activationVersion === query.activationVersion) &&
            (query.status === undefined || run.status === query.status),
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      return all.map((run) => immutableSnapshot(run));
    },
    async listEvents(runId, afterSeq = -1) {
      const stored = runs.get(runId);
      if (!stored) {
        throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
          operation: 'execution.listEvents',
          runId,
        });
      }
      return stored.events
        .filter((event) => event.seq > afterSeq)
        .map((event) => immutableSnapshot(event));
    },
    async recoverInterruptedRuns(command: RecoveryCommand) {
      const blocked: RecoveredRun[] = [];
      for (const stored of runs.values()) {
        if (stored.run.status !== 'running') {
          continue;
        }
        const seq = stored.events.length;
        const updated: StoredRun = {
          ...stored.run,
          status: 'blocked',
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: command.timestamp,
          completedAt: command.timestamp,
        };
        stored.run = updated;
        appendEvents(
          stored,
          [
            {
              seq,
              runId: stored.run.runId,
              graphId: stored.run.graphId,
              graphVersion: stored.run.graphVersion,
              capabilitySetVersion: stored.run.capabilitySetVersion,
              activationVersion: stored.run.activationVersion,
              timestamp: command.timestamp,
              type: 'run.blocked',
              code: command.code,
              steps: stored.run.steps,
              reason: command.reason,
              remediation: command.remediation,
            } as KernelEvent,
          ],
          seq,
          command.timestamp,
        );
        blocked.push({
          runId: stored.run.runId,
          graphId: stored.run.graphId,
          activationVersion: stored.run.activationVersion,
          currentNodeId: stored.run.currentNodeId,
          steps: stored.run.steps,
          eventSeq: seq,
        });
      }
      return { scanned: blocked.length, blocked: blocked.map((entry) => immutableSnapshot(entry)) };
    },
  };

  return { catalog, execution };
}

const ALL_RUN_STATUSES: readonly StoredRunStatus[] = ['running', 'completed', 'failed', 'blocked'];

/** Translate any non-store failure (e.g. an injected fault) into a structured store error. */
function wrapInternal(cause: unknown, operation: string, runId?: string): VictStoreError {
  if (cause instanceof VictStoreError) {
    return cause;
  }
  return new VictStoreError(
    'VICT_STORE_UNAVAILABLE',
    'The storage operation failed and the transition was not committed.',
    { operation, runId },
    cause,
  );
}

function appendEvents(
  stored: InternalRun,
  events: readonly KernelEvent[],
  expectedNextSeq: number,
  timestamp: number,
): void {
  let seq = expectedNextSeq;
  for (const event of events) {
    assertEvent(event, stored.run.runId);
    if (event.seq !== seq) {
      throw new VictStoreError(
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
        'The event batch does not start at the expected dense sequence number.',
        {
          operation: 'execution.appendEvents',
          runId: stored.run.runId,
          expectedEventSeq: seq,
          actualEventSeq: event.seq,
        },
      );
    }
    stored.events.push({
      runId: stored.run.runId,
      seq: event.seq,
      eventSchema: RUN_EVENT_SCHEMA,
      type: event.type,
      graphId: event.graphId,
      graphVersion: event.graphVersion,
      capabilitySetVersion: event.capabilitySetVersion,
      activationVersion: event.activationVersion,
      nodeId: 'nodeId' in event ? (event.nodeId as string) : null,
      capabilityId: 'capabilityId' in event ? (event.capabilityId as string) : null,
      payload: toCanonicalJson(event),
      timestamp: event.timestamp ?? timestamp,
    });
    seq += 1;
  }
}

function assertManifest(command: PublishActivationCommand): void {
  if (command.manifest.manifestSchema !== ACTIVATION_MANIFEST_SCHEMA) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      `Unsupported activation manifest schema '${String(command.manifest.manifestSchema)}'.`,
      { operation: 'catalog.publish' },
    );
  }
  if (!command.manifest.activationVersion || !command.manifest.graphId) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'An activation manifest requires non-empty activationVersion and graphId.',
      { operation: 'catalog.publish' },
    );
  }
  if (typeof command.canonicalManifest !== 'string' || command.canonicalManifest.length === 0) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'A canonical manifest string is required.',
      { operation: 'catalog.publish' },
    );
  }
}

function assertCreateCommand(command: CreateRunCommand): void {
  if (!command.runId || !command.graphId || !command.activationVersion) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'A run requires non-empty runId, graphId and activationVersion.',
      { operation: 'execution.createRun', runId: command.runId },
    );
  }
  if (typeof command.timestamp !== 'number' || !Number.isFinite(command.timestamp)) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'A run creation requires a finite timestamp.',
      { operation: 'execution.createRun', runId: command.runId },
    );
  }
  const retention: PayloadRetention = command.retention;
  if (retention !== 'none' && retention !== 'summary' && retention !== 'full') {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      `Unknown payload retention '${String(retention)}'.`,
      { operation: 'execution.createRun', runId: command.runId },
    );
  }
  const mode: ExecutionMode = command.mode;
  if (mode !== 'normal' && mode !== 'simulate' && mode !== 'test') {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      `Unknown execution mode '${String(mode)}'.`,
      { operation: 'execution.createRun', runId: command.runId },
    );
  }
}

function assertTransitionCommand(command: CommitRunTransitionCommand): void {
  if (!command.runId) {
    throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'A transition requires a runId.', {
      operation: 'execution.commitTransition',
    });
  }
  if (
    !Number.isInteger(command.expectedRecordRevision) ||
    command.expectedRecordRevision < 1 ||
    !Number.isInteger(command.expectedNextEventSeq) ||
    command.expectedNextEventSeq < 0
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'A transition requires an integer record revision (>=1) and event sequence (>=0).',
      { operation: 'execution.commitTransition', runId: command.runId },
    );
  }
}

function assertEvent(event: KernelEvent, runId?: string): void {
  if (!event || typeof event.type !== 'string') {
    throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'An event requires a string type.', {
      operation: 'execution.appendEvents',
    });
  }
  if (!Number.isInteger(event.seq) || event.seq < 0) {
    throw new VictStoreError(
      'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      'An event requires a non-negative integer sequence number.',
      { operation: 'execution.appendEvents', actualEventSeq: event.seq },
    );
  }
  if (runId !== undefined && event.runId !== runId) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'An event references a different run than the transition targets.',
      { operation: 'execution.appendEvents', runId },
    );
  }
}
