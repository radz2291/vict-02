import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync as mkTempDir, readFileSync, rmSync as rmDir, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverPackModules } from '../inputs.js';
import { CATALOG_SCHEMA } from '../markers.js';

/**
 * Capability-catalog generation (architecture §4.1).
 *
 * The generator imports ONLY first-party workspace pack modules — the same
 * trusted code the verified build/test ladder already executes — in a
 * credential-free isolated child process and serializes the frozen, fully
 * declarative pack manifests. Handlers are never invoked; handler bodies
 * are never serialized or hashed. The child receives a minimal allowlist
 * environment (no inherited credential-bearing variables).
 */

export class CatalogGenerationError extends Error {
  readonly details: readonly string[];
  constructor(message: string, details: readonly string[]) {
    super(message);
    this.name = 'CatalogGenerationError';
    this.details = details;
  }
}

export interface CatalogSourceModule {
  readonly package: string;
  readonly module: string;
  readonly contentSha256: string;
}

export interface GeneratedCatalog {
  readonly schemaMarker: typeof CATALOG_SCHEMA;
  readonly generatedFrom: { readonly sourceModules: readonly CatalogSourceModule[] };
  readonly packs: readonly unknown[];
}

interface ChildModuleSpec {
  readonly url: string;
  readonly module: string;
  readonly name: string;
}

/** Raw record emitted by the isolated child for one exported pack. */
interface ChildPackRecord {
  readonly module: string;
  readonly name: string;
  readonly manifest: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Transform one child pack record into a `vict.builder.catalog@1` pack
 * entry: exactly the manifest's declarative metadata, plus the declaring
 * module and its content digest. Capability `summary` is recorded as
 * `null` explicitly — the manifest closed vocabulary has no per-capability
 * description, and none may be invented.
 */
function toCatalogPackEntry(
  record: ChildPackRecord,
  moduleDigest: string,
): Record<string, unknown> {
  const manifest = record.manifest;
  const capabilitiesRaw = Array.isArray(manifest['capabilities']) ? manifest['capabilities'] : [];
  const capabilities = capabilitiesRaw.map((raw) => {
    const capability = asRecord(raw);
    if (capability === null)
      throw new Error(`catalog: non-object capability entry in ${record.module}`);
    const id = capability['id'];
    const revision = capability['revision'];
    if (typeof id !== 'string' || typeof revision !== 'string') {
      throw new Error(`catalog: capability id/revision missing in ${record.module}`);
    }
    const toRef = (value: unknown): Record<string, unknown> | null => {
      const ref = asRecord(value);
      if (ref === null) return null;
      return { contractId: ref['contractId'], revision: ref['revision'] };
    };
    const entry: Record<string, unknown> = {
      id,
      revision,
      effect: capability['effect'],
      input: toRef(capability['input']),
      output: toRef(capability['output']),
      // No per-capability summary exists in the manifest vocabulary.
      summary: null,
      module: record.module,
      contentSha256: moduleDigest,
    };
    for (const field of [
      'idempotency',
      'retry',
      'permissions',
      'configuration',
      'requiredConfiguration',
      'secrets',
      'requiredSecrets',
      'ambiguity',
    ] as const) {
      const value = capability[field];
      if (value !== undefined) entry[field] = value;
    }
    return entry;
  });

  const pack: Record<string, unknown> = {
    id: manifest['id'],
    version: manifest['version'],
    victCompatibility: manifest['victCompatibility'],
    capabilities,
  };
  for (const field of [
    'contracts',
    'permissions',
    'configuration',
    'secrets',
    'doubles',
    'evaluations',
  ] as const) {
    const value = manifest[field];
    if (value !== undefined) pack[field] = value;
  }
  const documentation = asRecord(manifest['documentation']);
  pack['documentation'] =
    documentation === null ? null : { summary: documentation['summary'] ?? null };
  const provenance = asRecord(manifest['provenance']);
  if (provenance !== null) pack['provenance'] = provenance;
  return pack;
}

/** Allowlisted environment keys for the isolated child process. */
const CHILD_ENV_KEYS: readonly string[] = [
  'path',
  'pathext',
  'systemdrive',
  'systemroot',
  'temp',
  'tmp',
  'tmpdir',
  'windir',
];

/**
 * Resolved tsx loader URL (absolute, cwd-independent) so the isolated
 * child can import the first-party TypeScript pack modules from any
 * repository root. Resolved lazily: module-level `import.meta.resolve`
 * is not available under every module runner.
 */
function resolveTsxImportUrl(): string {
  try {
    return import.meta.resolve('tsx');
  } catch {
    const nodeRequire = createRequire(import.meta.url);
    return pathToFileURL(nodeRequire.resolve('tsx')).href;
  }
}

function buildChildEnvironment(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (CHILD_ENV_KEYS.includes(key.toLowerCase())) env[key] = value;
  }
  return env;
}

const CHILD_SCRIPT = String.raw`
const specs = JSON.parse(process.argv[2]);
const packs = [];
for (const spec of specs) {
  const mod = await import(spec.url);
  for (const key of Object.keys(mod)) {
    const value = mod[key];
    if (
      value !== null && typeof value === 'object' &&
      typeof value.manifest === 'object' && value.manifest !== null &&
      value.manifest.schema === 'vict.capability-pack@1'
    ) {
      packs.push({ module: spec.module, name: spec.name, manifest: JSON.parse(JSON.stringify(value.manifest)) });
    }
  }
}
process.stdout.write(JSON.stringify({ packs }));
`;

/**
 * Generate the capability catalog from the first-party pack modules.
 * Reads only module FILES for digests (content-addressed); imports the
 * modules in an isolated, credential-free child; never touches bindings.
 */
export function generateCatalog(
  repoRoot: string,
  options: { readonly env?: Record<string, string> } = {},
): { readonly catalog: GeneratedCatalog; readonly childEnvKeys: readonly string[] } {
  const modules = discoverPackModules(repoRoot);
  const sourceModules: CatalogSourceModule[] = modules.map(({ name, module }) => ({
    package: name,
    module,
    contentSha256: createHash('sha256')
      .update(readFileSync(join(repoRoot, module)))
      .digest('hex'),
  }));

  const specs: ChildModuleSpec[] = modules.map(({ name, module }) => ({
    url: pathToFileURL(resolve(repoRoot, module)).href,
    module,
    name,
  }));

  const workDir = mkTempDir(join(tmpdir(), 'vict-builder-kit-catalog-'));
  const childScriptPath = join(workDir, 'catalog-child.mjs');
  let childEnv = buildChildEnvironment();
  if (options.env !== undefined) childEnv = { ...childEnv, ...options.env };
  try {
    writeFileSync(childScriptPath, CHILD_SCRIPT, 'utf8');
    const result = spawnSync(
      process.execPath,
      ['--import', resolveTsxImportUrl(), childScriptPath, JSON.stringify(specs)],
      {
        cwd: repoRoot,
        env: childEnv,
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    if (result.error !== undefined) {
      throw new CatalogGenerationError(
        `catalog child failed to start: ${result.error.message}`,
        [],
      );
    }
    if (result.status !== 0) {
      throw new CatalogGenerationError(`catalog child exited ${String(result.status)}`, [
        (result.stderr ?? '').trim(),
      ]);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      throw new CatalogGenerationError('catalog child produced unparsable output', [
        (result.stderr ?? '').trim(),
      ]);
    }
    const records = (parsed as { packs?: unknown }).packs;
    if (!Array.isArray(records)) {
      throw new CatalogGenerationError('catalog child produced no pack records', []);
    }
    const digestByModule = new Map(
      sourceModules.map((entry) => [entry.module, entry.contentSha256]),
    );
    const packs = (records as ChildPackRecord[])
      .map((record) => {
        const digest = digestByModule.get(record.module);
        if (digest === undefined) {
          throw new CatalogGenerationError(
            `catalog child returned an unknown module: ${record.module}`,
            [],
          );
        }
        return toCatalogPackEntry(record, digest);
      })
      .sort((a, b) => (String(a['id']) < String(b['id']) ? -1 : 1));
    const catalog: GeneratedCatalog = {
      schemaMarker: CATALOG_SCHEMA,
      generatedFrom: { sourceModules },
      packs,
    };
    return { catalog, childEnvKeys: Object.keys(childEnv).sort() };
  } finally {
    rmDir(workDir, { recursive: true, force: true });
  }
}
