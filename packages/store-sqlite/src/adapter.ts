import type { KernelEvent, OutputSummary } from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type { ExecutionMode, PayloadRetention } from '@vict/runtime';
import {
  ACTIVATION_MANIFEST_SCHEMA,
  RUN_EVENT_SCHEMA,
  VictStoreError,
  assertActivationBelongsToGraph,
  assertEventMatchesRun,
  assertPublishableManifest,
  assertRunMatchesActivation,
  assertStoredActivationReadable,
  toCanonicalJson,
} from '@vict/runtime';
import type {
  ActivationCatalog,
  ActivationSelection,
  ActivationManifest,
  CommitRunTransitionCommand,
  CreateRunCommand,
  DisposableVictStores,
  ExecutionStore,
  PublishActivationCommand,
  PublishAndSelectCommand,
  PublishResult,
  RecoveredRun,
  RecoveryCommand,
  RecoveryResult,
  RunQuery,
  SelectActivationCommand,
  StoredActivation,
  StoredEvent,
  StoredRun,
  StoredRunStatus,
  TransitionFaultHooks,
  VictStores,
} from '@vict/runtime';
import { inTransaction, openDatabase, safeRun } from './driver.js';
import type { OpenDatabase, SqliteDriverOptions } from './driver.js';
import { runMigrations } from './migrations.js';
import { createSqliteOrchestrationStore } from './orchestration-adapter.js';

/**
 * SQLite adapter for Vict's semantic store ports.
 *
 * - One local runtime owner per database file; concurrent multi-process
 *   ownership is not supported in this stage. The adapter sets a busy
 *   timeout so brief lock contention from other readers fails softly rather
 *   than corrupting anything.
 * - Every compound write (run creation, run transition + events, publish +
 *   select, recovery) commits atomically in one transaction (DATA-003).
 * - Reads validate rows and JSON payloads before they become public
 *   records; malformed or inconsistent data raises structured
 *   invalid-record errors instead of leaking corrupt objects.
 * - Returned records are deep-frozen immutable snapshots (DATA-012).
 * - Timestamps persist as ISO-8601 UTC strings; public records carry epoch
 *   milliseconds. Event order is defined exclusively by the dense `seq`,
 *   never by row order or timestamps.
 */

export interface SqliteStoresOptions extends SqliteDriverOptions {
  /** Test-only transition fault hooks; inert in normal use. */
  readonly faults?: TransitionFaultHooks;
  /** Inject a pre-opened handle (used by tests); `path` is ignored then. */
  readonly database?: OpenDatabase;
  /** Override the migration list (test-only). */
  readonly migrations?: Parameters<typeof runMigrations>[1];
}

const RUN_STATUSES: readonly StoredRunStatus[] = ['running', 'completed', 'failed', 'blocked'];
const RETENTIONS: readonly PayloadRetention[] = ['none', 'summary', 'full'];
const MODES: readonly ExecutionMode[] = ['normal', 'simulate', 'test'];

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function fromIso(value: string | null, context: string): number {
  if (value === null) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A required timestamp is missing.', {
      operation: context,
    });
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored timestamp is not a valid ISO-8601 instant.',
      { operation: context },
    );
  }
  return parsed;
}

function parseJsonColumn<T>(text: string | null, context: string): T | undefined {
  if (text === null) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      `A stored ${context} column is not valid JSON.`,
      { operation: context },
      cause,
    );
  }
  return parsed as T;
}

interface RunRow {
  run_id: string;
  graph_id: string;
  graph_version: string;
  capability_set_version: string;
  activation_version: string;
  status: string;
  mode: string;
  retention: string;
  steps: number;
  current_node_id: string | null;
  output_summary: string | null;
  output: string | null;
  error: string | null;
  record_revision: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function validateRunRow(row: RunRow): StoredRun {
  const context = 'execution.readRun';
  if (typeof row.run_id !== 'string' || typeof row.graph_id !== 'string') {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored run row is incomplete.', {
      operation: context,
    });
  }
  if (!RUN_STATUSES.includes(row.status as StoredRunStatus)) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run carries an unknown status.',
      { operation: context, runId: row.run_id },
    );
  }
  if (!MODES.includes(row.mode as ExecutionMode)) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run carries an unknown execution mode.',
      { operation: context, runId: row.run_id },
    );
  }
  if (!RETENTIONS.includes(row.retention as PayloadRetention)) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run carries an unknown payload retention.',
      { operation: context, runId: row.run_id },
    );
  }
  if (!Number.isInteger(row.record_revision) || row.record_revision < 1) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run carries an invalid record revision.',
      { operation: context, runId: row.run_id },
    );
  }
  if (!Number.isInteger(row.steps) || row.steps < 0) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run carries an invalid step count.',
      { operation: context, runId: row.run_id },
    );
  }
  const error = parseJsonColumn<VictError>(row.error, 'run error');
  if (
    error !== undefined &&
    (typeof error.code !== 'string' || typeof error.message !== 'string')
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run error is not a valid structured error.',
      { operation: context, runId: row.run_id },
    );
  }
  const outputSummary = parseJsonColumn<OutputSummary>(row.output_summary, 'run output summary');
  if (
    outputSummary !== undefined &&
    (typeof outputSummary !== 'object' ||
      outputSummary === null ||
      typeof (outputSummary as { shape?: unknown }).shape !== 'string')
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored output summary is not a valid summary object.',
      { operation: context, runId: row.run_id },
    );
  }
  const completedAt = row.completed_at === null ? null : fromIso(row.completed_at, context);
  const run: StoredRun = {
    runId: row.run_id,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    capabilitySetVersion: row.capability_set_version,
    activationVersion: row.activation_version,
    status: row.status as StoredRunStatus,
    mode: row.mode as ExecutionMode,
    retention: row.retention as PayloadRetention,
    steps: row.steps,
    currentNodeId: row.current_node_id,
    recordRevision: row.record_revision,
    createdAt: fromIso(row.created_at, context),
    updatedAt: fromIso(row.updated_at, context),
    completedAt,
    ...(outputSummary !== undefined ? { outputSummary } : {}),
    ...(row.output !== null ? { output: parseJsonColumn<unknown>(row.output, 'run output') } : {}),
    ...(error !== undefined ? { error } : {}),
  };
  return immutable(run);
}

interface EventRow {
  run_id: string;
  seq: number;
  event_schema: string;
  type: string;
  graph_id: string;
  graph_version: string;
  capability_set_version: string;
  activation_version: string;
  node_id: string | null;
  capability_id: string | null;
  payload: string;
  timestamp: string;
}

function validateEventRow(row: EventRow): StoredEvent {
  const context = 'execution.readEvent';
  if (row.event_schema !== RUN_EVENT_SCHEMA) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored event carries an unsupported event schema version.',
      { operation: context, runId: row.run_id },
    );
  }
  if (!Number.isInteger(row.seq) || row.seq < 0) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored event carries an invalid sequence number.',
      { operation: context, runId: row.run_id },
    );
  }
  const payload = parseJsonColumn<Record<string, unknown>>(row.payload, 'event payload');
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.seq !== row.seq ||
    payload.type !== row.type ||
    payload.runId !== row.run_id ||
    payload.graphId !== row.graph_id ||
    payload.graphVersion !== row.graph_version ||
    payload.capabilitySetVersion !== row.capability_set_version ||
    payload.activationVersion !== row.activation_version
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored event payload disagrees with its columns.',
      { operation: context, runId: row.run_id },
    );
  }
  const timestamp = fromIso(row.timestamp, context);
  if (payload.timestamp !== timestamp) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored event timestamp disagrees with its payload.',
      { operation: context, runId: row.run_id },
    );
  }
  return immutable({
    runId: row.run_id,
    seq: row.seq,
    eventSchema: row.event_schema,
    type: row.type as KernelEvent['type'],
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    capabilitySetVersion: row.capability_set_version,
    activationVersion: row.activation_version,
    nodeId: row.node_id,
    capabilityId: row.capability_id,
    payload: row.payload,
    timestamp,
  });
}

interface ActivationRow {
  activation_version: string;
  manifest_schema: string;
  graph_id: string;
  graph_version: string;
  capability_set_version: string;
  canonical_manifest: string;
  created_at: string;
}

function validateActivationRow(row: ActivationRow): StoredActivation {
  const context = 'catalog.readActivation';
  if (row.manifest_schema !== ACTIVATION_MANIFEST_SCHEMA) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored activation carries an unsupported manifest schema.',
      { operation: context, activationVersion: row.activation_version },
    );
  }
  const manifest = parseJsonColumn<ActivationManifest>(
    row.canonical_manifest,
    'activation manifest',
  );
  if (!manifest || typeof manifest !== 'object') {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored activation manifest is missing or is not an object.',
      { operation: context, activationVersion: row.activation_version },
    );
  }
  // Identity columns must agree with the manifest, AND every content-derived
  // identity must recompute from the persisted canonical content. Corrupt
  // rows are rejected, never silently normalized.
  assertStoredActivationReadable({
    activationVersion: row.activation_version,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    capabilitySetVersion: row.capability_set_version,
    canonicalManifest: row.canonical_manifest,
    manifest,
  });
  return immutable({
    activationVersion: row.activation_version,
    manifestSchema: row.manifest_schema,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    capabilitySetVersion: row.capability_set_version,
    canonicalManifest: row.canonical_manifest,
    createdAt: fromIso(row.created_at, context),
  });
}

/** Deep-freeze a freshly built record: callers can never mutate stored state. */
function immutable<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      immutable((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Identity columns a run row (or command) presents for event validation. */
interface RunIdentity {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
}

function assertEvent(event: KernelEvent): void {
  if (!event || typeof event.type !== 'string' || !Number.isInteger(event.seq) || event.seq < 0) {
    throw new VictStoreError(
      'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      'An event requires a non-negative integer sequence number and a string type.',
      { operation: 'execution.appendEvents' },
    );
  }
}

function assertManifestContent(command: PublishActivationCommand): void {
  const manifest: ActivationManifest = command.manifest;
  if (
    manifest.manifestSchema !== ACTIVATION_MANIFEST_SCHEMA ||
    typeof manifest.activationVersion !== 'string' ||
    manifest.activationVersion.length === 0 ||
    typeof manifest.graphId !== 'string' ||
    manifest.graphId.length === 0
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'An activation manifest requires a supported schema and non-empty identities.',
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

export function createSqliteStores(options: SqliteStoresOptions = {}): DisposableVictStores {
  const handle = options.database ?? openDatabase(options);
  const faults = options.faults;
  const { db } = handle;

  try {
    safeRun('store.migrate', () => {
      runMigrations(db, options.migrations as Parameters<typeof runMigrations>[1]);
    });
  } catch (cause) {
    // Fail closed without leaking the handle (e.g. unsupported future schema).
    handle.close();
    throw cause;
  }

  const insertEvent = (event: KernelEvent, run: RunIdentity): void => {
    assertEvent(event);
    // Every appended event must carry exactly its run's identity columns.
    assertEventMatchesRun(event, run);
    db.prepare(
      `INSERT INTO vict_run_event
        (run_id, seq, event_schema, type, graph_id, graph_version, capability_set_version, activation_version, node_id, capability_id, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      event.runId,
      event.seq,
      RUN_EVENT_SCHEMA,
      event.type,
      event.graphId,
      event.graphVersion,
      event.capabilitySetVersion,
      event.activationVersion,
      'nodeId' in event ? ((event as { nodeId?: string }).nodeId ?? null) : null,
      'capabilityId' in event ? ((event as { capabilityId?: string }).capabilityId ?? null) : null,
      toCanonicalJson(event),
      toIso(event.timestamp),
    );
  };

  const listEventRows = (runId: string, afterSeq: number): EventRow[] =>
    db
      .prepare('SELECT * FROM vict_run_event WHERE run_id = ? AND seq > ? ORDER BY seq ASC;')
      .all(runId, afterSeq) as unknown as EventRow[];

  const catalog: ActivationCatalog = {
    async publish(command: PublishActivationCommand): Promise<PublishResult> {
      assertManifestContent(command);
      return safeRun('catalog.publish', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT canonical_manifest FROM vict_activation WHERE activation_version = ?;')
            .get(command.manifest.activationVersion) as { canonical_manifest: string } | undefined;
          if (existing) {
            // Same version + different canonical content is a collision
            // regardless of content validity; equivalent content is an
            // idempotent republish.
            if (existing.canonical_manifest !== command.canonicalManifest) {
              throw new VictStoreError(
                'VICT_STORE_ACTIVATION_COLLISION',
                'An activation with this version already exists with different content.',
                {
                  operation: 'catalog.publish',
                  activationVersion: command.manifest.activationVersion,
                },
              );
            }
            return { activationVersion: command.manifest.activationVersion, created: false };
          }
          // Fresh creation: content-derived identity validation, shared with
          // the in-memory adapter — the canonical string must BE the
          // manifest's canonical form and every identity must recompute.
          assertPublishableManifest(command);
          db.prepare(
            `INSERT INTO vict_activation
              (activation_version, manifest_schema, graph_id, graph_version, capability_set_version, canonical_manifest, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            command.manifest.activationVersion,
            command.manifest.manifestSchema,
            command.manifest.graphId,
            command.manifest.graphVersion,
            command.manifest.capabilitySetVersion,
            command.canonicalManifest,
            toIso(Date.now()),
          );
          return { activationVersion: command.manifest.activationVersion, created: true };
        }),
      );
    },

    async get(activationVersion: string): Promise<StoredActivation | undefined> {
      return safeRun('catalog.get', () => {
        const row = db
          .prepare('SELECT * FROM vict_activation WHERE activation_version = ?;')
          .get(activationVersion) as ActivationRow | undefined;
        return row ? validateActivationRow(row) : undefined;
      });
    },

    async list(): Promise<readonly StoredActivation[]> {
      return safeRun('catalog.list', () => {
        const rows = db
          .prepare('SELECT * FROM vict_activation ORDER BY created_at ASC, activation_version ASC;')
          .all() as unknown as ActivationRow[];
        return rows.map((row) => validateActivationRow(row));
      });
    },

    async select(command: SelectActivationCommand): Promise<ActivationSelection> {
      return safeRun('catalog.select', () =>
        inTransaction(db, () => {
          const exists = db
            .prepare(
              'SELECT activation_version, graph_id FROM vict_activation WHERE activation_version = ?;',
            )
            .get(command.activationVersion) as
            { activation_version: string; graph_id: string } | undefined;
          if (!exists) {
            throw new VictStoreError('VICT_STORE_ACTIVATION_NOT_FOUND', 'Activation not found.', {
              operation: 'catalog.select',
              activationVersion: command.activationVersion,
            });
          }
          // An activation may only be selected for the graph it belongs to.
          assertActivationBelongsToGraph(
            { activationVersion: exists.activation_version, graphId: exists.graph_id },
            command.graphId,
            'catalog.select',
          );
          const current = db
            .prepare('SELECT selection_revision FROM vict_activation_selection WHERE graph_id = ?;')
            .get(command.graphId) as { selection_revision: number } | undefined;
          const currentRevision = current?.selection_revision;
          if (command.expectedSelectionRevision !== undefined) {
            if (
              currentRevision === undefined ||
              currentRevision !== command.expectedSelectionRevision
            ) {
              throw new VictStoreError(
                'VICT_STORE_SELECTION_CONFLICT',
                'The selection changed since it was read; the expected selection revision is stale.',
                {
                  operation: 'catalog.select',
                  graphId: command.graphId,
                  expectedSelectionRevision: command.expectedSelectionRevision,
                  actualSelectionRevision: currentRevision,
                },
              );
            }
          }
          const nextRevision = (currentRevision ?? 0) + 1;
          const selectedAt = toIso(Date.now());
          db.prepare(
            `INSERT INTO vict_activation_selection (graph_id, activation_version, selection_revision, selected_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(graph_id) DO UPDATE SET
               activation_version = excluded.activation_version,
               selection_revision = excluded.selection_revision,
               selected_at = excluded.selected_at;`,
          ).run(command.graphId, command.activationVersion, nextRevision, selectedAt);
          return immutable({
            graphId: command.graphId,
            activationVersion: command.activationVersion,
            selectionRevision: nextRevision,
            selectedAt: Date.parse(selectedAt),
          });
        }),
      );
    },

    async getSelection(graphId: string): Promise<ActivationSelection | undefined> {
      return safeRun('catalog.getSelection', () => {
        const row = db
          .prepare('SELECT * FROM vict_activation_selection WHERE graph_id = ?;')
          .get(graphId) as
          | {
              graph_id: string;
              activation_version: string;
              selection_revision: number;
              selected_at: string;
            }
          | undefined;
        if (!row) {
          return undefined;
        }
        return immutable({
          graphId: row.graph_id,
          activationVersion: row.activation_version,
          selectionRevision: row.selection_revision,
          selectedAt: fromIso(row.selected_at, 'catalog.readSelection'),
        });
      });
    },

    async getSelected(graphId: string): Promise<StoredActivation | undefined> {
      return safeRun('catalog.getSelected', () => {
        const row = db
          .prepare(
            `SELECT a.* FROM vict_activation a
             JOIN vict_activation_selection s ON s.activation_version = a.activation_version
             WHERE s.graph_id = ?;`,
          )
          .get(graphId) as ActivationRow | undefined;
        return row ? validateActivationRow(row) : undefined;
      });
    },

    async publishAndSelect(
      command: PublishAndSelectCommand,
    ): Promise<PublishResult & { selection: ActivationSelection }> {
      assertManifestContent(command.publish);
      if (command.publish.manifest.graphId !== command.select.graphId) {
        throw new VictStoreError(
          'VICT_STORE_ACTIVATION_MISMATCH',
          'The activation does not belong to the graph being selected for.',
          {
            operation: 'catalog.publishAndSelect',
            activationVersion: command.publish.manifest.activationVersion,
            graphId: command.select.graphId,
          },
        );
      }
      return safeRun('catalog.publishAndSelect', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT canonical_manifest FROM vict_activation WHERE activation_version = ?;')
            .get(command.publish.manifest.activationVersion) as
            { canonical_manifest: string } | undefined;
          let created: boolean;
          if (existing) {
            // Same version + different canonical content is a collision
            // regardless of content validity.
            if (existing.canonical_manifest !== command.publish.canonicalManifest) {
              throw new VictStoreError(
                'VICT_STORE_ACTIVATION_COLLISION',
                'An activation with this version already exists with different content.',
                {
                  operation: 'catalog.publishAndSelect',
                  activationVersion: command.publish.manifest.activationVersion,
                },
              );
            }
            created = false;
          } else {
            // Fresh creation: identity must recompute from content.
            assertPublishableManifest(command.publish);
            db.prepare(
              `INSERT INTO vict_activation
                (activation_version, manifest_schema, graph_id, graph_version, capability_set_version, canonical_manifest, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
            ).run(
              command.publish.manifest.activationVersion,
              command.publish.manifest.manifestSchema,
              command.publish.manifest.graphId,
              command.publish.manifest.graphVersion,
              command.publish.manifest.capabilitySetVersion,
              command.publish.canonicalManifest,
              toIso(Date.now()),
            );
            created = true;
          }
          // The selection participates in the same transaction and honors
          // the optimistic revision guard — a stale writer must leave BOTH
          // the catalog and the selection untouched.
          const current = db
            .prepare('SELECT selection_revision FROM vict_activation_selection WHERE graph_id = ?;')
            .get(command.select.graphId) as { selection_revision: number } | undefined;
          const currentRevision = current?.selection_revision;
          if (
            command.select.expectedSelectionRevision !== undefined &&
            (currentRevision === undefined ||
              currentRevision !== command.select.expectedSelectionRevision)
          ) {
            throw new VictStoreError(
              'VICT_STORE_SELECTION_CONFLICT',
              'The selection changed since it was read; the expected selection revision is stale.',
              {
                operation: 'catalog.publishAndSelect',
                graphId: command.select.graphId,
                expectedSelectionRevision: command.select.expectedSelectionRevision,
                actualSelectionRevision: currentRevision,
              },
            );
          }
          const nextRevision = (currentRevision ?? 0) + 1;
          const selectedAt = toIso(Date.now());
          db.prepare(
            `INSERT INTO vict_activation_selection (graph_id, activation_version, selection_revision, selected_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(graph_id) DO UPDATE SET
               activation_version = excluded.activation_version,
               selection_revision = excluded.selection_revision,
               selected_at = excluded.selected_at;`,
          ).run(
            command.select.graphId,
            command.publish.manifest.activationVersion,
            nextRevision,
            selectedAt,
          );
          return {
            activationVersion: command.publish.manifest.activationVersion,
            created,
            selection: immutable({
              graphId: command.select.graphId,
              activationVersion: command.publish.manifest.activationVersion,
              selectionRevision: nextRevision,
              selectedAt: Date.parse(selectedAt),
            }),
          };
        }),
      );
    },
  };

  const execution: ExecutionStore = {
    async createRun(command: CreateRunCommand): Promise<StoredRun> {
      return safeRun('execution.createRun', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT run_id FROM vict_run WHERE run_id = ?;')
            .get(command.runId);
          if (existing) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'A run with this id already exists.',
              { operation: 'execution.createRun', runId: command.runId },
            );
          }
          // Enum validation happens before identity lookups so command
          // errors surface deterministically as invalid-command failures.
          if (!MODES.includes(command.mode)) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'A run requires a known execution mode.',
              { operation: 'execution.createRun', runId: command.runId },
            );
          }
          if (!RETENTIONS.includes(command.retention)) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'A run requires a known payload retention.',
              { operation: 'execution.createRun', runId: command.runId },
            );
          }
          const storedActivation = db
            .prepare(
              'SELECT activation_version, graph_id, graph_version, capability_set_version FROM vict_activation WHERE activation_version = ?;',
            )
            .get(command.activationVersion) as
            | {
                activation_version: string;
                graph_id: string;
                graph_version: string;
                capability_set_version: string;
              }
            | undefined;
          if (!storedActivation) {
            throw new VictStoreError('VICT_STORE_ACTIVATION_NOT_FOUND', 'Activation not found.', {
              operation: 'execution.createRun',
              activationVersion: command.activationVersion,
            });
          }
          // The run's identity columns must describe exactly that published
          // activation (foreign keys alone cannot prove coherence).
          assertRunMatchesActivation(
            {
              activationVersion: storedActivation.activation_version,
              graphId: storedActivation.graph_id,
              graphVersion: storedActivation.graph_version,
              capabilitySetVersion: storedActivation.capability_set_version,
            },
            command,
            'execution.createRun',
          );
          try {
            db.prepare(
              `INSERT INTO vict_run
                (run_id, graph_id, graph_version, capability_set_version, activation_version, status, mode, retention,
                 steps, current_node_id, record_revision, created_at, updated_at, completed_at)
              VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, 1, ?, ?, NULL);`,
            ).run(
              command.runId,
              command.graphId,
              command.graphVersion,
              command.capabilitySetVersion,
              command.activationVersion,
              command.mode,
              command.retention,
              command.steps ?? 0,
              command.currentNodeId ?? null,
              toIso(command.timestamp),
              toIso(command.timestamp),
            );
          } catch (cause) {
            // A missing activation (foreign key) or bad enum value is a command error.
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The run could not be created; its activation may not exist or a field may be invalid.',
              { operation: 'execution.createRun', runId: command.runId },
              cause,
            );
          }
          faults?.afterRunUpdate?.(command);
          // The initial batch must be dense and begin at sequence zero, and
          // every event must carry the run's identity columns.
          const runIdentity: RunIdentity = {
            runId: command.runId,
            graphId: command.graphId,
            graphVersion: command.graphVersion,
            capabilitySetVersion: command.capabilitySetVersion,
            activationVersion: command.activationVersion,
          };
          command.events.forEach((event, index) => {
            if (event.seq !== index) {
              throw new VictStoreError(
                'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
                'The initial event batch must be dense and begin at sequence zero.',
                {
                  operation: 'execution.createRun',
                  runId: command.runId,
                  expectedEventSeq: index,
                  actualEventSeq: event.seq,
                },
              );
            }
            insertEvent(event, runIdentity);
          });
          faults?.beforeCommit?.(command);
          const row = db
            .prepare('SELECT * FROM vict_run WHERE run_id = ?;')
            .get(command.runId) as unknown as RunRow;
          return validateRunRow(row);
        }),
      );
    },

    async commitTransition(command: CommitRunTransitionCommand): Promise<StoredRun> {
      return safeRun('execution.commitTransition', () =>
        inTransaction(db, () => {
          const row = db.prepare('SELECT * FROM vict_run WHERE run_id = ?;').get(command.runId) as
            RunRow | undefined;
          if (!row) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'execution.commitTransition',
              runId: command.runId,
            });
          }
          if (row.record_revision !== command.expectedRecordRevision) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run record changed since it was read; the expected record revision is stale.',
              {
                operation: 'execution.commitTransition',
                runId: command.runId,
                expectedRecordRevision: command.expectedRecordRevision,
                actualRecordRevision: row.record_revision,
              },
            );
          }
          if (row.status !== 'running') {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run is already terminal and cannot accept further transitions.',
              {
                operation: 'execution.commitTransition',
                runId: command.runId,
                expectedRecordRevision: command.expectedRecordRevision,
                actualRecordRevision: row.record_revision,
              },
            );
          }
          // The caller's expectation must equal the ACTUAL stored next
          // sequence (dense: zero for an empty run, otherwise preceding+1).
          // A gapped stored history is reported as corrupt, never extended.
          // All of this participates in the same transaction as the update
          // and the event append.
          const history = db
            .prepare(
              'SELECT COUNT(*) AS count, MAX(seq) AS maxSeq FROM vict_run_event WHERE run_id = ?;',
            )
            .get(command.runId) as { count: number; maxSeq: number | null };
          const actualNextSeq = history.maxSeq === null ? 0 : history.maxSeq + 1;
          if (history.count !== actualNextSeq) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_RECORD',
              'The stored event sequence has a gap; the run history is incomplete or corrupt.',
              {
                operation: 'execution.commitTransition',
                runId: command.runId,
                expectedEventSeq: actualNextSeq,
              },
            );
          }
          if (command.expectedNextEventSeq !== actualNextSeq) {
            throw new VictStoreError(
              'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
              'The expected next event sequence does not match the stored event history.',
              {
                operation: 'execution.commitTransition',
                runId: command.runId,
                expectedEventSeq: actualNextSeq,
                actualEventSeq: command.expectedNextEventSeq,
              },
            );
          }
          const nextStatus = command.next.status ?? 'running';
          if (!RUN_STATUSES.includes(nextStatus)) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The transition requests an unknown run status.',
              { operation: 'execution.commitTransition', runId: command.runId },
            );
          }
          // Retention boundary (DATA-004/005/006): stored rows obey the
          // run's retention policy regardless of what the command carries.
          if (row.retention === 'none' && command.next.outputSummary !== undefined) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'Retention is none; an output summary cannot be stored.',
              { operation: 'execution.commitTransition', runId: command.runId },
            );
          }
          if (
            row.retention === 'none' &&
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
            row.retention !== 'full' &&
            'output' in command.next &&
            command.next.output !== undefined
          ) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'Complete outputs require explicit full retention.',
              { operation: 'execution.commitTransition', runId: command.runId },
            );
          }
          const completedAt =
            command.next.completedAt !== undefined
              ? command.next.completedAt === null
                ? null
                : toIso(command.next.completedAt)
              : nextStatus === 'running'
                ? row.completed_at
                : toIso(command.timestamp);
          db.prepare(
            `UPDATE vict_run SET
              status = ?,
              steps = ?,
              current_node_id = ?,
              output_summary = ?,
              output = ?,
              error = ?,
              record_revision = ?,
              updated_at = ?,
              completed_at = ?
            WHERE run_id = ?;`,
          ).run(
            nextStatus,
            command.next.steps ?? row.steps,
            command.next.currentNodeId !== undefined
              ? command.next.currentNodeId
              : row.current_node_id,
            command.next.outputSummary !== undefined
              ? toCanonicalJson(command.next.outputSummary)
              : row.output_summary,
            'output' in command.next
              ? command.next.output === undefined
                ? row.output
                : toCanonicalJson(command.next.output)
              : row.output,
            command.next.error !== undefined ? toCanonicalJson(command.next.error) : row.error,
            row.record_revision + 1,
            toIso(command.timestamp),
            completedAt,
            command.runId,
          );
          faults?.afterRunUpdate?.(command);
          const runIdentity: RunIdentity = {
            runId: row.run_id,
            graphId: row.graph_id,
            graphVersion: row.graph_version,
            capabilitySetVersion: row.capability_set_version,
            activationVersion: row.activation_version,
          };
          let seq = command.expectedNextEventSeq;
          for (const event of command.events) {
            assertEvent(event);
            if (event.seq !== seq) {
              throw new VictStoreError(
                'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
                'The event batch does not start at the expected dense sequence number.',
                {
                  operation: 'execution.commitTransition',
                  runId: command.runId,
                  expectedEventSeq: seq,
                  actualEventSeq: event.seq,
                },
              );
            }
            insertEvent(event, runIdentity);
            seq += 1;
          }
          faults?.beforeCommit?.(command);
          const updated = db
            .prepare('SELECT * FROM vict_run WHERE run_id = ?;')
            .get(command.runId) as unknown as RunRow;
          return validateRunRow(updated);
        }),
      );
    },

    async getRun(runId: string): Promise<StoredRun | undefined> {
      return safeRun('execution.getRun', () => {
        const row = db.prepare('SELECT * FROM vict_run WHERE run_id = ?;').get(runId) as unknown as
          RunRow | undefined;
        return row ? validateRunRow(row) : undefined;
      });
    },

    async listRuns(query: RunQuery = {}): Promise<readonly StoredRun[]> {
      return safeRun('execution.listRuns', () => {
        const clauses: string[] = [];
        const params: string[] = [];
        if (query.graphId !== undefined) {
          clauses.push('graph_id = ?');
          params.push(query.graphId);
        }
        if (query.activationVersion !== undefined) {
          clauses.push('activation_version = ?');
          params.push(query.activationVersion);
        }
        if (query.status !== undefined) {
          clauses.push('status = ?');
          params.push(query.status);
        }
        const limit =
          query.limit !== undefined ? ` LIMIT ${Math.max(0, Math.floor(query.limit))}` : '';
        const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
        const rows = db
          .prepare(`SELECT * FROM vict_run${where} ORDER BY created_at ASC, run_id ASC${limit};`)
          .all(...params) as unknown as RunRow[];
        return rows.map((row) => validateRunRow(row));
      });
    },

    async listEvents(runId: string, afterSeq = -1): Promise<readonly StoredEvent[]> {
      return safeRun('execution.listEvents', () => {
        const run = db.prepare('SELECT run_id FROM vict_run WHERE run_id = ?;').get(runId);
        if (!run) {
          throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
            operation: 'execution.listEvents',
            runId,
          });
        }
        const rows = listEventRows(runId, afterSeq);
        const events = rows.map((row) => validateEventRow(row));
        // Density check: storage must never hand back gapped sequences.
        let expected = afterSeq + 1;
        for (const event of events) {
          if (event.seq !== expected) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_RECORD',
              'The stored event sequence has a gap; the run history is incomplete or corrupt.',
              { operation: 'execution.listEvents', runId, expectedEventSeq: expected },
            );
          }
          expected += 1;
        }
        return events;
      });
    },

    async recoverInterruptedRuns(command: RecoveryCommand): Promise<RecoveryResult> {
      return safeRun('execution.recoverInterruptedRuns', () => {
        const rows = db
          .prepare("SELECT run_id FROM vict_run WHERE status = 'running' ORDER BY created_at ASC;")
          .all() as unknown as { run_id: string }[];
        const blocked: RecoveredRun[] = [];
        for (const { run_id } of rows) {
          const recovered = inTransaction(db, () => {
            const row = db.prepare('SELECT * FROM vict_run WHERE run_id = ?;').get(run_id) as
              RunRow | undefined;
            if (!row || row.status !== 'running') {
              return undefined;
            }
            const seq = (
              db
                .prepare('SELECT COUNT(*) AS count FROM vict_run_event WHERE run_id = ?;')
                .get(run_id) as {
                count: number;
              }
            ).count;
            db.prepare(
              `UPDATE vict_run SET status = 'blocked', record_revision = record_revision + 1,
                 updated_at = ?, completed_at = ? WHERE run_id = ?;`,
            ).run(toIso(command.timestamp), toIso(command.timestamp), run_id);
            const event = {
              seq,
              runId: row.run_id,
              graphId: row.graph_id,
              graphVersion: row.graph_version,
              capabilitySetVersion: row.capability_set_version,
              activationVersion: row.activation_version,
              timestamp: command.timestamp,
              type: 'run.blocked',
              code: command.code,
              steps: row.steps,
              reason: command.reason,
              remediation: command.remediation,
            } as KernelEvent;
            insertEvent(event, {
              runId: row.run_id,
              graphId: row.graph_id,
              graphVersion: row.graph_version,
              capabilitySetVersion: row.capability_set_version,
              activationVersion: row.activation_version,
            });
            return immutable({
              runId: row.run_id,
              graphId: row.graph_id,
              activationVersion: row.activation_version,
              currentNodeId: row.current_node_id,
              steps: row.steps,
              eventSeq: seq,
            });
          });
          if (recovered) {
            blocked.push(recovered);
          }
        }
        return { scanned: blocked.length, blocked };
      });
    },
  };

  const stores: VictStores = {
    catalog,
    execution,
    orchestration: createSqliteOrchestrationStore(
      handle,
      faults === undefined
        ? undefined
        : {
            afterStateStage: (operation) => faults.afterRunUpdate?.({ runId: operation } as never),
            beforeCommit: (operation) => faults.beforeCommit?.({ runId: operation } as never),
          },
    ),
  };
  return {
    ...stores,
    async dispose(): Promise<void> {
      handle.close();
    },
  };
}
