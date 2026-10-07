/**
 * Durable-local inspection adapter (U3-05/06) — scenario 1's
 * `inspection.approve` implementation swap target.
 *
 * SAME rule core as the simulated adapter (`applyInspectionMutation` /
 * `applyChildAdd`), SAME `ApplicationDataAdapter` contract, SAME action
 * identity and input/output contracts — only the registered implementation
 * and storage change: domain records persist in a local SQLite database
 * (production pragmas: WAL, synchronous=FULL, foreign keys, busy timeout)
 * through the repository's `@victframework/appdata-sqlite` driver. A process
 * restart reloads from the file; nothing survives in memory.
 *
 * This is NOT a second domain engine: the rules are the shared core, the
 * boundary is the declared adapter port, and the storage is the repository's
 * own local persistence mechanism.
 */

import type { DatabaseSync } from 'node:sqlite';
import type {
  ApplicationDataAdapter,
  ApplicationDataMutationRequest,
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import { openAppDatabase, readDurabilityPragmas, VictApplicationDataError } from '@victframework/appdata-sqlite';
import {
  applyChildAdd,
  applyInspectionMutation,
  queryTable,
  systemClock,
  type ActivityRow,
  type DomainClock,
  type DomainLedger,
  type InspectionTables,
} from '$lib/product/domain.js';
import { scenarioSeed, type ScenarioId } from '$lib/product/scenario-seeds.js';

export const DURABLE_ADAPTER_ID = 'vict.inspection-durable-sqlite';
export const DURABLE_ADAPTER_REVISION = '1';

/** Where the durable file lives (relative to the example root). */
export function durableDatabasePath(fileName = 'inspections-u3.sqlite'): string {
  return process.env.U3_DURABLE_DB ?? `./.local-data/${fileName}`;
}

interface DurableLedger extends DomainLedger {
  /** The open database (for the adapter's close/pragma reporting). */
  readonly handle: ReturnType<typeof openAppDatabase>;
}

/** Local translation of raw driver failures into structured errors. */
function withStore<T>(operation: string, run: () => T): T {
  try {
    return run();
  } catch (cause) {
    if (cause instanceof VictApplicationDataError) throw cause;
    const errcode = (cause as { errcode?: unknown } | null)?.errcode;
    if (errcode === 5) {
      throw new VictApplicationDataError(
        'APPDATA_STORE_BUSY',
        'The application-domain SQLite store is busy; the operation did not complete.',
        operation,
      );
    }
    throw new VictApplicationDataError(
      'APPDATA_STORE_UNAVAILABLE',
      'The application-domain SQLite store could not complete the operation.',
      operation,
    );
  }
}

/** Open (creating if needed) the durable store; seed ONLY an empty database. */
export function openDurableInspectionStore(
  path: string = durableDatabasePath(),
  seed: ScenarioId = 'normal',
): {
  adapter: InspectionDurableAdapter;
  file: string;
  pragmas: ReturnType<typeof readDurabilityPragmas>;
  handle: ReturnType<typeof openAppDatabase>;
} {
  const handle = openAppDatabase(path);
  const db = handle.db;
  withStore('schema.ensure', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS inspection_domain_inspections (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        technician TEXT NOT NULL,
        supervisor TEXT NOT NULL,
        submittedAt TEXT,
        decidedAt TEXT,
        rejectionReason TEXT,
        domainRevision INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inspection_domain_findings (
        id TEXT PRIMARY KEY,
        inspectionId TEXT NOT NULL REFERENCES inspection_domain_inspections(id),
        severity TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inspection_domain_evidence (
        id TEXT PRIMARY KEY,
        inspectionId TEXT NOT NULL,
        label TEXT NOT NULL,
        kind TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inspection_domain_activity (
        id TEXT PRIMARY KEY,
        inspectionId TEXT NOT NULL,
        at TEXT NOT NULL,
        actor TEXT NOT NULL,
        entry TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inspection_domain_decision_keys (
        key TEXT PRIMARY KEY,
        digest TEXT NOT NULL,
        row_json TEXT NOT NULL
      );
    `);
  });
  const count = db.prepare('SELECT COUNT(*) AS n FROM inspection_domain_inspections').get() as {
    n: number;
  };
  if (count.n === 0) {
    // First open on an empty file: seed deterministically (a restart NEVER
    // reseeds — persistence is the authority).
    const base = scenarioSeed(seed);
    const insertInspection = db.prepare(
      'INSERT INTO inspection_domain_inspections (id, title, status, technician, supervisor, submittedAt, decidedAt, rejectionReason, domainRevision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const row of base.inspections) {
      insertInspection.run(row.id, row.title, row.status, row.technician, row.supervisor, row.submittedAt, row.decidedAt, row.rejectionReason, row.domainRevision);
    }
    const insertFinding = db.prepare(
      'INSERT INTO inspection_domain_findings (id, inspectionId, severity, description) VALUES (?, ?, ?, ?)',
    );
    for (const row of base.findings) insertFinding.run(row.id, row.inspectionId, row.severity, row.description);
    const insertEvidence = db.prepare(
      'INSERT INTO inspection_domain_evidence (id, inspectionId, label, kind) VALUES (?, ?, ?, ?)',
    );
    for (const row of base.evidence) insertEvidence.run(row.id, row.inspectionId, row.label, row.kind);
    const insertActivity = db.prepare(
      'INSERT INTO inspection_domain_activity (id, inspectionId, at, actor, entry) VALUES (?, ?, ?, ?, ?)',
    );
    for (const row of base.activity) insertActivity.run(row.id, row.inspectionId, row.at, row.actor, row.entry);
  }
  const ledger: DurableLedger = {
    handle,
    lookup(key, digest) {
      const found = db.prepare(
        'SELECT digest, row_json FROM inspection_domain_decision_keys WHERE key = ?',
      ).get(key) as { digest: string; row_json: string } | undefined;
      if (found === undefined) return { recorded: false, digestMatches: false };
      return { recorded: true, digestMatches: found.digest === digest, rowJson: found.row_json };
    },
    record(key, digest, rowJson) {
      db.prepare(
        'INSERT INTO inspection_domain_decision_keys (key, digest, row_json) VALUES (?, ?, ?)',
      ).run(key, digest, rowJson);
    },
  };
  const adapter = new InspectionDurableAdapter(db, ledger, handle);
  return { adapter, file: path, pragmas: readDurabilityPragmas(db), handle };
}

/**
 * The durable-local `ApplicationDataAdapter`: the SAME shared rule core as
 * the simulated adapter, persisted to SQLite with write-through on every
 * accepted mutation.
 */
export class InspectionDurableAdapter implements ApplicationDataAdapter {
  readonly id = DURABLE_ADAPTER_ID;
  readonly revision = DURABLE_ADAPTER_REVISION;
  readonly #db: DatabaseSync;
  readonly #ledger: DomainLedger;
  readonly #clock: DomainClock;
  readonly #handle: ReturnType<typeof openAppDatabase>;

  constructor(db: DatabaseSync, ledger: DomainLedger, handle: ReturnType<typeof openAppDatabase>) {
    this.#db = db;
    this.#ledger = ledger;
    this.#clock = systemClock;
    this.#handle = handle;
  }

  /** Durability pragma snapshot (restart evidence shows WAL/FULL persisted). */
  durabilityPragmas(): ReturnType<typeof readDurabilityPragmas> {
    return readDurabilityPragmas(this.#db);
  }

  close(): void {
    this.#handle.close();
  }

  query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    if (!context.permissions.includes('qlt.inspection.read')) {
      return Promise.resolve({ ok: false, code: 'DATA_UNAUTHORIZED', message: 'Read denied.' });
    }
    if (request.resourceId === 'inspection') {
      if (request.op === 'get') {
        const row = this.#db
          .prepare('SELECT * FROM inspection_domain_inspections WHERE id = ?')
          .get(request.id as string) as Record<string, unknown> | undefined;
        if (row === undefined) {
          return Promise.resolve({
            ok: false,
            code: 'DATA_UNKNOWN_IDENTITY',
            message: 'No such inspection.',
          });
        }
        return Promise.resolve({ ok: true, row: this.joined(row) });
      }
      if (request.op === 'list') {
        const rows = this.#db
          .prepare('SELECT * FROM inspection_domain_inspections ORDER BY id')
          .all() as Record<string, unknown>[];
        return Promise.resolve({
          ok: true,
          rows: rows.map((row) => this.joined(row)),
          total: rows.length,
        });
      }
      return Promise.resolve({
        ok: false,
        code: 'DATA_UNSUPPORTED_QUERY',
        message: `Unsupported op '${request.op}'.`,
      });
    }
    if (request.resourceId === 'activity') {
      const rows = (
        request.filters?.['inspectionId'] !== undefined
          ? (this.#db
              .prepare('SELECT * FROM inspection_domain_activity WHERE inspectionId = ? ORDER BY id')
              .all(request.filters['inspectionId'] as string))
          : (this.#db.prepare('SELECT * FROM inspection_domain_activity ORDER BY id').all())
      ) as Record<string, unknown>[];
      return Promise.resolve(queryTable(rows, request));
    }
    if (request.resourceId === 'finding' || request.resourceId === 'evidence') {
      const table =
        request.resourceId === 'finding'
          ? 'inspection_domain_findings'
          : 'inspection_domain_evidence';
      const rows = this.#db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Record<
        string,
        unknown
      >[];
      return Promise.resolve(queryTable(rows, request));
    }
    return Promise.resolve({
      ok: false,
      code: 'DATA_UNKNOWN_RESOURCE',
      message: `Unknown resource '${request.resourceId}'.`,
    });
  }

  mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const tables = this.loadTables();
    const outcome =
      request.resourceId === 'inspection'
        ? applyInspectionMutation(tables, request, context, this.#clock, this.#ledger)
        : applyChildAdd(tables, request, context, this.#clock, this.#ledger);
    if (!outcome.ok) {
      return Promise.resolve({ ok: false, code: outcome.code, message: outcome.message });
    }
    // Write-through: accepted mutations persist transactionally before the
    // result returns (durability is not best-effort).
    withStore('mutation.persist', () => {
      this.#db.exec('BEGIN');
      try {
        for (const row of tables.inspections) {
          this.#db
            .prepare(
              'INSERT INTO inspection_domain_inspections (id, title, status, technician, supervisor, submittedAt, decidedAt, rejectionReason, domainRevision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, submittedAt = excluded.submittedAt, decidedAt = excluded.decidedAt, rejectionReason = excluded.rejectionReason, domainRevision = excluded.domainRevision',
            )
            .run(row.id, row.title, row.status, row.technician, row.supervisor, row.submittedAt, row.decidedAt, row.rejectionReason, row.domainRevision);
        }
        this.persistChildren('inspection_domain_findings', tables.findings, ['severity', 'description']);
        this.persistChildren('inspection_domain_evidence', tables.evidence, ['label', 'kind']);
        for (const row of tables.activity) {
          this.#db
            .prepare(
              'INSERT OR REPLACE INTO inspection_domain_activity (id, inspectionId, at, actor, entry) VALUES (?, ?, ?, ?, ?)',
            )
            .run(row.id, row.inspectionId, row.at, row.actor, row.entry);
        }
        this.#db.exec('COMMIT');
      } catch (error) {
        this.#db.exec('ROLLBACK');
        throw error;
      }
    });
    const inspection = tables.inspections.find((candidate) => candidate['id'] === outcome.row['id']);
    return Promise.resolve({
      ok: true,
      row:
        inspection !== undefined
          ? this.joined(inspection as unknown as Record<string, unknown>)
          : outcome.row,
    });
  }

  private persistChildren(
    table: string,
    rows: readonly { readonly id: string }[],
    valueColumns: readonly string[],
  ): void {
    const columns = ['id', 'inspectionId', ...valueColumns];
    const placeholders = columns.map(() => '?').join(', ');
    const updates = valueColumns.map((column) => `${column} = excluded.${column}`).join(', ');
    const statement = this.#db.prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
    );
    for (const row of rows as unknown as Record<string, unknown>[]) {
      statement.run(...columns.map((column) => row[column] as string | number | null));
    }
  }

  /** Load the domain tables from the store (the shared core mutates them). */
  private loadTables(): InspectionTables {
    return {
      inspections: this.#db
        .prepare('SELECT * FROM inspection_domain_inspections ORDER BY id')
        .all() as never,
      findings: this.#db.prepare('SELECT * FROM inspection_domain_findings ORDER BY id').all() as never,
      evidence: this.#db.prepare('SELECT * FROM inspection_domain_evidence ORDER BY id').all() as never,
      activity: this.#db.prepare('SELECT * FROM inspection_domain_activity ORDER BY id').all() as never,
    };
  }

  private joined(row: Record<string, unknown>): Record<string, unknown> {
    return {
      ...row,
      domainRevision: Number(row['domainRevision']),
      findings:
        (this.#db
          .prepare('SELECT * FROM inspection_domain_findings WHERE inspectionId = ? ORDER BY id')
          .all(String(row['id'])) as never[]) ?? [],
      evidence:
        (this.#db
          .prepare('SELECT * FROM inspection_domain_evidence WHERE inspectionId = ? ORDER BY id')
          .all(String(row['id'])) as never[]) ?? [],
      activity:
        (this.#db
          .prepare('SELECT * FROM inspection_domain_activity WHERE inspectionId = ? ORDER BY id')
          .all(String(row['id'])) as never[]) ?? [],
    };
  }

  /** Direct read for server-side dispatch (already permission-checked callers). */
  activityFor(inspectionId: string): readonly ActivityRow[] {
    return this.#db
      .prepare('SELECT * FROM inspection_domain_activity WHERE inspectionId = ? ORDER BY id')
      .all(inspectionId) as unknown as readonly ActivityRow[];
  }
}
