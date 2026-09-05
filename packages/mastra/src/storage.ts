import { mkdirSync, chmodSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, dirname, sep } from 'node:path';
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
    | 'VICT_MASTRA_STORAGE_PUBLIC_ROOT'
    | 'VICT_MASTRA_STORAGE_PATH_ESCAPE'
    | 'VICT_MASTRA_STORAGE_RETENTION_INVALID';

  constructor(
    code:
      | 'VICT_MASTRA_STORAGE_PATH_INVALID'
      | 'VICT_MASTRA_STORAGE_PATH_TRAVERSAL'
      | 'VICT_MASTRA_STORAGE_PUBLIC_ROOT'
      | 'VICT_MASTRA_STORAGE_PATH_ESCAPE'
      | 'VICT_MASTRA_STORAGE_RETENTION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'VictMastraStorageError';
    this.code = code;
  }
}

/**
 * Validate an EXPLICIT retention bound (MSTR-011: retention is always
 * explicit and bounded — unbounded silent persistence is forbidden).
 * Values must be positive finite integers within the documented limit of
 * ten years (3650 days in milliseconds).
 */
export const MAX_RETENTION_AGE_MS = 3_153_600_000_000;

function assertRetentionBound(value: unknown, what: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_RETENTION_AGE_MS
  ) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_RETENTION_INVALID',
      `${what} must be a positive finite integer of at most ${MAX_RETENTION_AGE_MS} ms (ten years); unbounded retention is never accepted.`,
    );
  }
  return value;
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
  /**
   * Explicit database file name. MUST be a plain basename (default
   * `mastra-store.db`): separators, drive prefixes, dot segments, NULs,
   * and traversal are rejected, and the resolved path is proven to remain
   * inside the dedicated store directory.
   */
  readonly fileName?: string;
  /**
   * EXPLICIT retention bounds (MSTR-011). Every bound is required and is
   * validated as a positive finite integer within the documented limit —
   * unbounded silent persistence is forbidden. Ages are milliseconds; the
   * adapter maps them onto the pinned store's retention policies.
   */
  readonly retention: {
    readonly messagesMaxAgeMs: number;
    readonly threadsMaxAgeMs: number;
    readonly spansMaxAgeMs: number;
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
 * Validate a store file name as a PLAIN BASENAME. Rejected: empty names,
 * path separators (both POSIX and Windows forms, on every platform),
 * drive prefixes, dot segments, NUL bytes, traversal, trailing dots/spaces
 * (Windows resolution quirk), and over-long names. The only accepted shape
 * is a single path segment such as `mastra-store.db`.
 */
export function assertPlainStoreFileName(fileName: string): string {
  const invalid =
    typeof fileName !== 'string' ||
    fileName.length === 0 ||
    fileName.length > 128 ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('\0') ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.startsWith('.') ||
    /^[A-Za-z]:/.test(fileName) ||
    fileName.endsWith('.') ||
    fileName.endsWith(' ');
  if (invalid) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The store file name must be a plain basename without separators, drive prefixes, dot segments, NUL bytes, or traversal.',
    );
  }
  return fileName;
}

/**
 * Prove the database file remains INSIDE the dedicated store directory:
 * the resolved parent must be the store directory itself, and after the
 * store initializes, the file's REAL path (symlinks and junctions
 * resolved) must still live within the store directory's REAL path. An
 * escape — a swapped symlink, a junction, any redirection — fails closed.
 */
function assertDatabaseContained(
  databasePath: string,
  storeDir: string,
  containmentRoot: string,
): void {
  // Compare NORMALIZED absolute forms (Windows may mix separators in the
  // composed storeDir string).
  if (dirname(resolve(databasePath)) !== resolve(storeDir)) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The resolved database path escaped the dedicated store directory.',
    );
  }
  let realFile: string;
  let realRoot: string;
  try {
    realFile = realpathSync(databasePath);
    realRoot = realpathSync(containmentRoot);
  } catch (error) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      `The database path could not be proven contained (realpath failed: ${error instanceof Error ? error.name : 'unknown'}).`,
    );
  }
  // The REAL path (symlinks and junctions resolved) must remain inside the
  // REAL composition-owned root. A store directory redirected by a symlink
  // or junction to somewhere outside the composition data dir fails this
  // proof even though the naive resolved path looked contained.
  const contained =
    realFile === realRoot ||
    realFile.startsWith(realRoot.endsWith(sep) ? realRoot : realRoot + sep);
  if (!contained) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The database file resolved outside the composition-owned data directory (symlink or junction escape); refusing the store.',
    );
  }
}

/**
 * Compose the dedicated file-backed Mastra store. The URL is a `file:`
 * URL (the pinned LibSQLStore zero-service local path). The database is
 * physically distinct from VICT operational and application-domain SQLite
 * files: a dedicated directory inside the composition-owned data dir.
 *
 * Retention bounds are REQUIRED and validated (positive finite integers
 * within the documented limit): the composed store never persists without
 * explicit bounds.
 *
 * The returned store is FULLY INITIALIZED: the memory and observability
 * domains have applied their schema before the promise resolves, and the
 * database file has been proven (real path) to remain inside the dedicated
 * store directory — symlink/junction escapes fail closed.
 */
export async function createDedicatedMastraStore(
  options: DedicatedMastraStoreOptions,
): Promise<DedicatedMastraStore> {
  const dir = resolveProtectedStoreDir({ dataDir: options.dataDir });
  const storeDir = `${dir}${dir.endsWith('/') || dir.endsWith('\\') ? '' : '/'}mastra`;
  mkdirSync(storeDir, { recursive: true });
  const fileName = assertPlainStoreFileName(options.fileName ?? 'mastra-store.db');
  const databasePath = resolve(storeDir, fileName);

  // Retention is REQUIRED and bounded (MSTR-011).
  const messagesMaxAgeMs = assertRetentionBound(
    options.retention?.messagesMaxAgeMs,
    'The messages retention bound',
  );
  const threadsMaxAgeMs = assertRetentionBound(
    options.retention?.threadsMaxAgeMs,
    'The threads retention bound',
  );
  const spansMaxAgeMs = assertRetentionBound(
    options.retention?.spansMaxAgeMs,
    'The spans retention bound',
  );
  const retention: Record<string, Record<string, { maxAge: string }>> = {
    memory: {
      messages: { maxAge: `${messagesMaxAgeMs}ms` },
      threads: { maxAge: `${threadsMaxAgeMs}ms` },
    },
    observability: { spans: { maxAge: `${spansMaxAgeMs}ms` } },
  };

  const store = new LibSQLStore({
    id: 'vict-mastra-store',
    url: `file:${databasePath}`,
    retention: retention as never,
  });

  // Eager, awaited initialization: schema exists before any caller
  // proceeds (turn execution, close/reopen, fresh-process restoration).
  await store.init();
  // Containment proof AFTER creation: a pre-planted symlink/junction (or
  // any redirection) is resolved through realpath against the REAL
  // composition-owned root — an escaped database fails closed and the
  // store is closed before the error propagates.
  try {
    assertDatabaseContained(databasePath, storeDir, dir);
  } catch (error) {
    try {
      await store.close();
    } catch {
      // the escape failure is primary; close errors never mask it
    }
    throw error;
  }
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
