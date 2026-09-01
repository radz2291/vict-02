import { DatabaseSync } from 'node:sqlite';
import { VictStoreError } from '@vict/runtime';

/**
 * Thin, safe wrapper over the built-in `node:sqlite` driver.
 *
 * Driver decision (Stage 02, evidence-based):
 * - `better-sqlite3` v13 segfaults on the supported runtime (Node 22.13,
 *   win32-x64, ABI 127); v12 works today but couples every Node major
 *   upgrade to a native prebuild that may not exist yet.
 * - `node:sqlite` ships with Node itself (SQLite 3.47.2 here): no native
 *   install, no ABI coupling, synchronous API with real transactions,
 *   foreign-key enforcement, busy timeout and WAL journaling.
 * - The trade-off is that `node:sqlite` exists from Node 22.5+ and is
 *   exposed without a flag from 22.13; the repository engines floor is
 *   raised to `>=22.13.0` explicitly (documented, not silent).
 *
 * Safety rules:
 * - Raw driver error messages, SQL text and bound values never leave this
 *   module: failures are translated to structured `VictStoreError`s with
 *   safe messages; the raw cause is attached only to the protected
 *   `driverCause` field, which must never be serialized.
 * - Database file paths are not copied into public error messages.
 */

export type { DatabaseSync };

/** Operational knobs for the SQLite backend; all optional with safe defaults. */
export interface SqliteDriverOptions {
  /** Database file path or `':memory:'`. Default `':memory:'`. */
  readonly path?: string;
  /** Busy timeout in milliseconds (PRAGMA busy_timeout). Default 5000. */
  readonly busyTimeoutMs?: number;
  /**
   * journal_mode: `'wal'` (default) for file databases; `':memory:'`
   * databases always report `'memory'`.
   */
  readonly journalMode?: 'wal' | 'delete' | 'truncate' | 'persist' | 'memory';
  /**
   * synchronous pragma. `'full'` (default) fsyncs on every commit — real
   * local durability. `'normal'` is faster but may lose recent commits on
   * OS/power failure (process crashes remain safe under WAL).
   */
  readonly synchronous?: 'full' | 'normal';
}

/** Classify SQLite failure modes into safe store-error codes and messages. */
function classify(cause: unknown): {
  code: 'VICT_STORE_BUSY' | 'VICT_STORE_UNAVAILABLE' | 'VICT_STORE_INVALID_RECORD';
  message: string;
} {
  const errcode = (cause as { errcode?: unknown } | null)?.errcode;
  // SQLite primary result code 5 = SQLITE_BUSY (database locked).
  if (errcode === 5) {
    return {
      code: 'VICT_STORE_BUSY',
      message: 'The SQLite store is busy; the operation did not complete within the busy timeout.',
    };
  }
  // SQLite primary result code 11 = SQLITE_CORRUPT.
  if (errcode === 11) {
    return {
      code: 'VICT_STORE_INVALID_RECORD',
      message: 'The SQLite store reported a corrupt database.',
    };
  }
  return {
    code: 'VICT_STORE_UNAVAILABLE',
    message: 'The SQLite store could not complete the operation.',
  };
}

/** Run a driver operation, translating any raw failure into a structured store error. */
export function safeRun<T>(operation: string, run: () => T): T {
  try {
    return run();
  } catch (cause) {
    if (cause instanceof VictStoreError) {
      throw cause;
    }
    const { code, message } = classify(cause);
    throw new VictStoreError(code, message, { operation }, cause);
  }
}

export interface OpenDatabase {
  readonly db: DatabaseSync;
  close(): void;
}

/** Open (creating if needed) a database with the documented pragmas applied. */
export function openDatabase(options: SqliteDriverOptions = {}): OpenDatabase {
  const path = options.path ?? ':memory:';
  const db = safeRun('driver.open', () => new DatabaseSync(path));
  try {
    safeRun('driver.pragma', () => {
      // Foreign-key enforcement is a correctness feature, not an option.
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(options.busyTimeoutMs ?? 5000))};`);
      const journal = options.journalMode ?? (path === ':memory:' ? 'memory' : 'wal');
      if (journal !== 'memory') {
        db.exec(`PRAGMA journal_mode = ${journal};`);
      }
      db.exec(
        `PRAGMA synchronous = ${(options.synchronous ?? 'full') === 'normal' ? 'NORMAL' : 'FULL'};`,
      );
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

/**
 * Run `fn` inside an IMMEDIATE transaction. Any throw rolls back every
 * statement; success commits. Used for every compound write.
 */
export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  safeRun('driver.begin', () => db.exec('BEGIN IMMEDIATE;'));
  try {
    const result = fn();
    safeRun('driver.commit', () => db.exec('COMMIT;'));
    return result;
  } catch (cause) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      /* a broken transaction may already be rolled back */
    }
    throw cause;
  }
}
