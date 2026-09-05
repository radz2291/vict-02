import { mkdirSync, chmodSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';

/**
 * Dedicated Mastra storage composition (MSTR-003, amendment §8.2/§8.3).
 *
 * The Mastra store is a dedicated file-backed `LibSQLStore` — physically
 * separate from both VICT SQLite stores (operational and application
 * domain). Mastra creates its own `mastra_*` tables with its own
 * bookkeeping; there is no shared handle, no shared migration domain, and
 * no table overlap with the `vict_*` namespaces.
 *
 * Deployment envelope (honest, enforced at this composition boundary):
 *
 *   local-first · single actor · single application process ·
 *   non-multi-tenant · file-backed
 *
 * This profile is NOT multi-process, multi-tenant, protected-cloud, or
 * production-scale. Exceeding the envelope requires an appropriate
 * supported backend (the documented PostgreSQL direction), never a silent
 * extension of the libSQL claim (MSTR-012).
 */

/** Path segments that mark a publicly served directory (rejected). */
const PUBLIC_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  'public',
  'static',
  'assets',
  'www',
  'htdocs',
]);

/**
 * Resolve and validate a protected store directory:
 * - the path must be absolute after resolution (no relative ambiguity);
 * - no path-traversal segment (`..`) may appear;
 * - no publicly served segment (`public`, `static`, …) may appear;
 * - the directory is created if missing and restricted where the platform
 *   supports it (owner-only on POSIX; Windows ACLs are NOT POSIX modes —
 *   documented honestly, never claimed).
 */
export function resolveProtectedStoreDir(options: {
  /** The composition-owned data directory (NOT a public/static root). */
  readonly dataDir: string;
}): string {
  const raw = options.dataDir;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The store data directory must be a non-empty string.',
    );
  }
  if (raw.includes('\0')) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The store data directory must not contain NUL bytes.',
    );
  }
  // Traversal is evaluated on the RAW segments: resolution would silently
  // normalize an author-supplied '..' into a different location, which is
  // exactly the substitution this boundary must refuse. A relative input
  // is likewise refused: it would silently resolve against the process
  // working directory.
  if (!isAbsolute(raw)) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The store data directory must be an absolute path.',
    );
  }
  const rawSegments = raw.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (rawSegments.includes('..') || rawSegments.includes('.')) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_TRAVERSAL',
      'The store data directory must not contain path-traversal segments.',
    );
  }
  const resolved = resolve(raw);
  const segments = resolved.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_TRAVERSAL',
      'The store data directory must not contain path-traversal segments.',
    );
  }
  for (const segment of segments) {
    if (PUBLIC_ROOT_SEGMENTS.has(segment.toLowerCase())) {
      throw new VictMastraStorageError(
        'VICT_MASTRA_STORAGE_PUBLIC_ROOT',
        `The store data directory must live outside publicly served directories ('${segment}' segment is a public-root convention). Store databases are never web-accessible.`,
      );
    }
  }
  return resolved;
}

/** Stable storage-composition failure. */
export class VictMastraStorageError extends Error {
  readonly code:
    | 'VICT_MASTRA_STORAGE_PATH_INVALID'
    | 'VICT_MASTRA_STORAGE_PATH_TRAVERSAL'
    | 'VICT_MASTRA_STORAGE_PUBLIC_ROOT';

  constructor(
    code:
      | 'VICT_MASTRA_STORAGE_PATH_INVALID'
      | 'VICT_MASTRA_STORAGE_PATH_TRAVERSAL'
      | 'VICT_MASTRA_STORAGE_PUBLIC_ROOT',
    message: string,
  ) {
    super(message);
    this.name = 'VictMastraStorageError';
    this.code = code;
  }
}

/**
 * Restrict a created store file/directory where Node/OS reliably supports
 * it. On POSIX this applies owner-only modes. On Windows, POSIX-mode bits
 * are emulated only for the read-only flag — this function therefore
 * applies what the platform honors and NEVER claims POSIX guarantees on
 * Windows (documented ACL limitation; single-user local envelope).
 */
export function restrictStorePathPermissions(path: string): void {
  try {
    chmodSync(path, 0o600);
  } catch {
    // Environmental (e.g. Windows ACL mapping): documented honestly; the
    // local single-actor envelope does not claim POSIX modes on Windows.
  }
}

/** Options for `createDedicatedMastraStore`. */
export interface DedicatedMastraStoreOptions {
  /**
   * The composition-owned data directory for the dedicated Mastra database
   * file. Validated by `resolveProtectedStoreDir` (never a public root).
   * Defaults to a `mastra` directory inside `dataDir`.
   */
  readonly dataDir: string;
  /** Explicit database file name. Default `mastra-store.db`. */
  readonly fileName?: string;
  /**
   * Explicit retention bounds (MSTR-011: retention is always EXPLICIT).
   * Ages are milliseconds; the adapter maps them onto the pinned store's
   * retention policies.
   */
  readonly retention?: {
    readonly messagesMaxAgeMs?: number;
    readonly threadsMaxAgeMs?: number;
    readonly spansMaxAgeMs?: number;
  };
}

/** The composed store plus its recorded metadata. */
export interface DedicatedMastraStore {
  readonly store: LibSQLStore;
  /** The resolved database file path (outside public roots). */
  readonly databasePath: string;
  /** Apply restrictive file permissions (platform-supported subset). */
  restrictPermissions(): void;
  /** Close the underlying store after an orderly flush. */
  close(): Promise<void>;
}

/**
 * Compose the dedicated file-backed Mastra store. The URL is a `file:`
 * URL (the pinned LibSQLStore zero-service local path). The database is
 * physically distinct from VICT operational and application-domain SQLite
 * files: a dedicated directory inside the composition-owned data dir.
 *
 * The returned store is FULLY INITIALIZED: the memory and observability
 * domains have applied their schema before the promise resolves, so no
 * later operation races a lazy in-flight migration (close/reopen and
 * fresh-process fixtures rely on this).
 */
export async function createDedicatedMastraStore(
  options: DedicatedMastraStoreOptions,
): Promise<DedicatedMastraStore> {
  const dir = resolveProtectedStoreDir({ dataDir: options.dataDir });
  const storeDir = `${dir}${dir.endsWith('/') || dir.endsWith('\\') ? '' : '/'}mastra`;
  mkdirSync(storeDir, { recursive: true });
  const fileName = options.fileName ?? 'mastra-store.db';
  const databasePath = resolve(storeDir, fileName);

  const retention: Record<string, Record<string, { maxAge: string }>> = {};
  if (options.retention?.messagesMaxAgeMs !== undefined) {
    retention.memory = {
      ...retention.memory,
      messages: { maxAge: `${options.retention.messagesMaxAgeMs}ms` },
    };
  }
  if (options.retention?.threadsMaxAgeMs !== undefined) {
    retention.memory = {
      ...retention.memory,
      threads: { maxAge: `${options.retention.threadsMaxAgeMs}ms` },
    };
  }
  if (options.retention?.spansMaxAgeMs !== undefined) {
    retention.observability = {
      ...retention.observability,
      spans: { maxAge: `${options.retention.spansMaxAgeMs}ms` },
    };
  }

  const store = new LibSQLStore({
    id: 'vict-mastra-store',
    url: `file:${databasePath}`,
    ...(Object.keys(retention).length > 0 ? { retention: retention as never } : {}),
  });

  // Eager, awaited initialization: schema exists before any caller
  // proceeds (turn execution, close/reopen, fresh-process restoration).
  await store.init();
  const memoryDomain = await store.getStore('memory');
  if (memoryDomain === undefined) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The dedicated store could not initialize its memory domain.',
    );
  }
  await store.getStore('observability');

  return {
    store,
    databasePath,
    restrictPermissions() {
      restrictStorePathPermissions(databasePath);
      restrictStorePathPermissions(dirname(databasePath));
    },
    async close() {
      await store.close();
    },
  };
}
