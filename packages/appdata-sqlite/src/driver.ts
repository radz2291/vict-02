import { DatabaseSync } from 'node:sqlite';

/**
 * Safe driver wrapper for the application-domain SQLite adapter.
 *
 * This adapter boundary owns its OWN minimal node:sqlite wrapper: it MUST
 * NOT depend on `@vict/store-sqlite` (which belongs to the execution spine
 * and imports `@vict/runtime`). The application branch depends only on
 * `@vict/contracts`, `@vict/sdk`, and `@vict/application`.
 *
 * Safety rules (mirroring the operational driver's discipline):
 * - Raw driver error messages, SQL text, and bound values never leave this
 *   module: failures are translated into structured
 *   `VictApplicationDataError`s with safe, non-echoing messages.
 * - Database file paths are never copied into public error messages.
 * - Production durability pragmas (WAL, synchronous=FULL, foreign keys,
 *   busy timeout) are applied and are inspectable via `pragmaInfo()`.
 */

/** Structured error of the application-domain SQLite adapter. */
export type ApplicationDataSqliteErrorCode =
  | 'APPDATA_STORE_UNAVAILABLE'
  | 'APPDATA_STORE_BUSY'
  | 'APPDATA_MIGRATION_FAILED'
  | 'APPDATA_MIGRATION_CONFLICT'
  | 'APPDATA_FUTURE_SCHEMA'
  | 'APPDATA_INVALID_RESOURCE';

/** Structured, non-echoing error. The raw cause is never serialized. */
export class VictApplicationDataError extends Error {
  readonly code: ApplicationDataSqliteErrorCode;
  /** Protected diagnostic detail: safe identifiers only, never raw driver text. */
  readonly operation?: string;

  constructor(code: ApplicationDataSqliteErrorCode, message: string, operation?: string) {
    super(message);
    this.name = 'VictApplicationDataError';
    this.code = code;
    this.operation = operation;
  }
}

/** Run a driver operation, translating raw failures into structured errors. */
export function safeDriver<T>(operation: string, run: () => T): T {
  try {
    return run();
  } catch (cause) {
    const errcode = (cause as { errcode?: unknown } | null)?.errcode;
    if (errcode === 5) {
      throw new VictApplicationDataError(
        'APPDATA_STORE_BUSY',
        'The application-domain SQLite store is busy; the operation did not complete within the busy timeout.',
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

export interface OpenAppDatabase {
  readonly db: DatabaseSync;
  close(): void;
}

/** Open (creating if needed) the application-domain database with production pragmas. */
export function openAppDatabase(path: string = ':memory:', busyTimeoutMs = 5000): OpenAppDatabase {
  const db = safeDriver('driver.open', () => new DatabaseSync(path));
  try {
    safeDriver('driver.pragma', () => {
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(busyTimeoutMs))};`);
      if (path !== ':memory:') {
        db.exec('PRAGMA journal_mode = WAL;');
      }
      db.exec('PRAGMA synchronous = FULL;');
    });
    return {
      db,
      close(): void {
        try {
          db.close();
        } catch {
          /* closing twice or closing a broken handle must not throw */
        }
      },
    };
  } catch (cause) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    throw cause;
  }
}

/** Read the durability-relevant pragmas (used by tests and the reference proof). */
export function readDurabilityPragmas(db: DatabaseSync): {
  journalMode: string;
  synchronous: string;
  foreignKeys: string;
  busyTimeout: string;
} {
  const scalar = (sql: string): string => {
    const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
    const first = Object.values(row ?? {})[0];
    return first === undefined ? '' : String(first);
  };
  return {
    journalMode: scalar('PRAGMA journal_mode;'),
    synchronous: scalar('PRAGMA synchronous;'),
    foreignKeys: scalar('PRAGMA foreign_keys;'),
    busyTimeout: scalar('PRAGMA busy_timeout;'),
  };
}

/** Run `fn` inside an IMMEDIATE transaction; any throw rolls back everything. */
export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  safeDriver('tx.begin', () => db.exec('BEGIN IMMEDIATE;'));
  try {
    const result = fn();
    safeDriver('tx.commit', () => db.exec('COMMIT;'));
    return result;
  } catch (cause) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      /* a failed BEGIN or an auto-rolled-back transaction must not mask the cause */
    }
    throw cause;
  }
}
