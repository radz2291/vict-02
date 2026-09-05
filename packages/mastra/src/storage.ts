import { chmodSync, lstatSync, mkdirSync, realpathSync, statSync } from 'node:fs';
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
 *
 * ACTUAL local-filesystem trust boundary (no more is claimed):
 * - path inputs are validated (absolute, no traversal, no public roots,
 *   plain-basename file names) BEFORE anything is created;
 * - symlink/junction REDIRECTION planted before composition (at the
 *   dedicated directory or at the database path) is rejected BEFORE the
 *   database is opened, and again after initialization as defense in
 *   depth — nothing outside the allowed root is created or modified by a
 *   rejected composition;
 * - a concurrent local process racing the composition (e.g. swapping a
 *   symlink between check and open) is OUTSIDE the declared single-process
 *   envelope; this boundary does not claim protection against it;
 * - protected-store permissions are owner-only POSIX modes (directory
 *   0o700, files 0o600 including existing SQLite sidecars), applied
 *   automatically during composition; on Windows POSIX bits are not
 *   honored and ACL configuration remains operator responsibility
 *   (documented limitation, never claimed otherwise).
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
    | 'VICT_MASTRA_STORAGE_PERMISSION'
    | 'VICT_MASTRA_STORAGE_RETENTION_INVALID';

  constructor(
    code:
      | 'VICT_MASTRA_STORAGE_PATH_INVALID'
      | 'VICT_MASTRA_STORAGE_PATH_TRAVERSAL'
      | 'VICT_MASTRA_STORAGE_PUBLIC_ROOT'
      | 'VICT_MASTRA_STORAGE_PATH_ESCAPE'
      | 'VICT_MASTRA_STORAGE_PERMISSION'
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
 * ten years: 10 × 365 days = 315_360_000_000 milliseconds.
 */
export const MAX_RETENTION_AGE_MS = 315_360_000_000;

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
 * Restrict a created store file/directory to the documented protected-store
 * permission policy: owner-only modes on POSIX — `0o700` for DIRECTORIES
 * (owner enter/read/write; traversal preserved for the owner) and `0o600`
 * for FILES. On Windows, POSIX-mode bits are emulated only for the
 * read-only flag; the attempt is best-effort and silently tolerated there
 * (documented ACL limitation — the local single-actor envelope never
 * claims POSIX guarantees on Windows).
 *
 * Failure surface per declared platform guarantees: on POSIX a failed chmod
 * is a real protection failure and THROWS a structured storage error; on
 * Windows the attempt is documented as best-effort and never throws.
 */
export function restrictStorePathPermissions(path: string): void {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    return; // nothing to protect (already gone)
  }
  const mode = stats.isDirectory() ? 0o700 : 0o600;
  try {
    chmodSync(path, mode);
  } catch {
    if (process.platform !== 'win32') {
      throw new VictMastraStorageError(
        'VICT_MASTRA_STORAGE_PERMISSION',
        'The protected-store permission policy could not be applied; owner-only modes are required on this platform.',
      );
    }
    // Windows: documented best-effort (ACL configuration is operator
    // responsibility in the declared local envelope).
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
 * Prove one REAL path is the same as, or inside, another REAL path.
 */
function isRealPathInside(childReal: string, rootReal: string): boolean {
  return (
    childReal === rootReal ||
    childReal.startsWith(rootReal.endsWith(sep) ? rootReal : rootReal + sep)
  );
}

/**
 * Prove the dedicated store directory remains INSIDE the composition-owned
 * data directory — BEFORE the database file is created or opened. A
 * pre-planted symlink or junction at `<dataDir>/mastra` resolves to its
 * REAL target here; a redirection to anywhere outside the composition data
 * dir is rejected BEFORE anything is created or modified outside the root.
 */
function assertStoreDirContained(dataDir: string, storeDir: string): string {
  let realDir: string;
  let realStoreDir: string;
  try {
    realDir = realpathSync(dataDir);
    realStoreDir = realpathSync(storeDir);
  } catch {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The dedicated store directory could not be resolved to a real path inside the composition-owned data directory.',
    );
  }
  if (!isRealPathInside(realStoreDir, realDir)) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The dedicated store directory resolves outside the composition-owned data directory (symlink or junction redirection); refusing the store before any database is created.',
    );
  }
  return realStoreDir;
}

/**
 * Prove an EXISTING database target is a regular file inside the dedicated
 * store directory — BEFORE it is opened. A symlink/junction planted at the
 * database path is rejected outright (file redirection); an existing
 * regular file must resolve (real path) inside the store directory. An
 * ABSENT target is the new-file case: its containing directory's real path
 * has already been proven contained.
 */
function assertExistingDatabaseTargetContained(databasePath: string, realStoreDir: string): void {
  let stats;
  try {
    stats = lstatSync(databasePath, { throwIfNoEntry: false });
  } catch {
    stats = undefined;
  }
  if (stats === undefined) {
    return; // new file: parent directory already proven contained
  }
  if (stats.isSymbolicLink()) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The database file name resolves to a symbolic link or junction redirection; refusing before the database is opened.',
    );
  }
  if (!stats.isFile()) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The database path already exists and is not a regular file.',
    );
  }
  let realFile: string;
  try {
    realFile = realpathSync(databasePath);
  } catch {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The existing database target could not be resolved to a real path inside the dedicated store directory.',
    );
  }
  if (!isRealPathInside(realFile, realStoreDir)) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The existing database target resolves outside the dedicated store directory; refusing before the database is opened.',
    );
  }
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
  } catch {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The database path could not be proven contained (real path resolution failed).',
    );
  }
  // The REAL path (symlinks and junctions resolved) must remain inside the
  // REAL composition-owned root. A store directory redirected by a symlink
  // or junction to somewhere outside the composition data dir fails this
  // proof even though the naive resolved path looked contained.
  if (!isRealPathInside(realFile, realRoot)) {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_ESCAPE',
      'The database file resolved outside the composition-owned data directory (symlink or junction escape); refusing the store.',
    );
  }
}

/**
 * Apply the documented protected-store permission policy to the composed
 * store: the dedicated directory gets owner-only `0o700` (traversal
 * preserved for the owner), the database file and any ALREADY-EXISTING
 * SQLite sidecar (WAL/SHM/journal) get owner-only `0o600`. On POSIX a
 * permission failure surfaces (declared guarantee); on Windows the attempt
 * is documented best-effort (ACL limitation). Sidecars created LATER sit
 * inside the 0o700 directory — unreachable to other local users;
 * `restrictPermissions()` on the composed store re-applies file modes.
 */
function applyProtectedStorePermissions(databasePath: string, storeDir: string): void {
  restrictStorePathPermissions(storeDir);
  restrictStorePathPermissions(databasePath);
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const sidecar = `${databasePath}${suffix}`;
    let stats;
    try {
      stats = lstatSync(sidecar, { throwIfNoEntry: false });
    } catch {
      stats = undefined;
    }
    if (stats !== undefined && stats.isFile()) {
      restrictStorePathPermissions(sidecar);
    }
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
 * domains have applied their schema before the promise resolves, the
 * database file has been proven (real path) to remain inside the dedicated
 * store directory — symlink/junction escapes fail closed — and the
 * protected-store permission policy has been applied automatically.
 *
 * CONTAINMENT IS PROVEN BEFORE ANY FILESYSTEM/DATABASE MUTATION: the file
 * name and retention bounds are validated first (nothing is created for an
 * invalid composition), the dedicated store directory's REAL path is
 * proven inside the composition data dir, and an EXISTING database target
 * (regular file or planted symlink/junction) is proven contained — all
 * BEFORE the database is opened or initialized. A known escape therefore
 * never creates or modifies anything outside the allowed root. The
 * post-open real-path proof is retained as defense in depth.
 */
export async function createDedicatedMastraStore(
  options: DedicatedMastraStoreOptions,
): Promise<DedicatedMastraStore> {
  const dir = resolveProtectedStoreDir({ dataDir: options.dataDir });
  // ALL input validation happens BEFORE any filesystem mutation.
  const fileName = assertPlainStoreFileName(options.fileName ?? 'mastra-store.db');
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

  const storeDir = `${dir}${dir.endsWith('/') || dir.endsWith('\\') ? '' : '/'}mastra`;
  try {
    mkdirSync(storeDir, { recursive: true });
  } catch {
    throw new VictMastraStorageError(
      'VICT_MASTRA_STORAGE_PATH_INVALID',
      'The dedicated store directory could not be created inside the composition-owned data directory.',
    );
  }
  // Pre-open containment: the dedicated directory's REAL path must lie
  // inside the composition data dir (this rejects a symlink/junction
  // planted at <dataDir>/mastra BEFORE the database file exists), and an
  // existing database target must be a contained regular file (this
  // rejects a file redirection BEFORE the database is opened).
  const realStoreDir = assertStoreDirContained(dir, storeDir);
  const databasePath = resolve(storeDir, fileName);
  assertExistingDatabaseTargetContained(databasePath, realStoreDir);

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
  // Post-open containment proof (defense in depth): a redirection that
  // appeared between the pre-open checks and initialization still fails
  // closed, and the store is closed before the error propagates.
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
  // Protected-store permission policy, applied automatically during
  // supported composition (POSIX failures surface as storage errors;
  // Windows is documented best-effort).
  try {
    applyProtectedStorePermissions(databasePath, storeDir);
  } catch (error) {
    try {
      await store.close();
    } catch {
      // the permission failure is primary; close errors never mask it
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
      // Re-applies the documented policy (idempotent): the dedicated
      // directory at 0o700, the database file and any existing SQLite
      // sidecars at 0o600.
      applyProtectedStorePermissions(databasePath, storeDir);
    },
    async close() {
      await store.close();
    },
  };
}
