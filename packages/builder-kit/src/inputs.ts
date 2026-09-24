import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from './canonical.js';

/** Recorded-input discovery and content-addressed provenance (architecture §3.4). */

export interface RecordedInput {
  readonly path: string;
  readonly contentSha256: string;
}

export interface WorkspaceMember {
  readonly name: string;
  readonly version: string;
  readonly main: string;
  readonly types: string;
  readonly private: boolean;
  readonly internalDependencies: readonly string[];
  readonly externalDependencies: readonly string[];
}

const WORKSPACE_GLOBS: readonly string[] = ['packages', 'examples', 'packs'];

function listDirs(root: string, parent: string): readonly string[] {
  try {
    return readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export interface ManifestInfo {
  readonly path: string;
  readonly manifest: Record<string, unknown>;
}

/** Root + every workspace member manifest, in deterministic order. */
export function discoverWorkspaceManifests(repoRoot: string): readonly ManifestInfo[] {
  const manifests: ManifestInfo[] = [];
  const push = (relativePath: string): void => {
    try {
      const raw = readFileSync(join(repoRoot, relativePath), 'utf8');
      manifests.push({ path: relativePath, manifest: JSON.parse(raw) as Record<string, unknown> });
    } catch {
      // A missing/unreadable manifest is recorded by the gate as an
      // unregistered-input failure, not silently skipped here.
    }
  };
  push('package.json');
  for (const group of WORKSPACE_GLOBS) {
    for (const dir of listDirs(repoRoot, group)) {
      push(`${group}/${dir}/package.json`);
    }
  }
  return manifests;
}

/** Full recorded-input path set (sorted, repository-relative, forward slashes). */
export function recordedInputPaths(repoRoot: string): readonly string[] {
  const paths: string[] = [
    'docs/VICT-SYSTEM-REFERENCE.md',
    'docs/RELEASE-COMPATIBILITY.md',
    'docs/builder-kit/capability-catalog.json',
  ];
  for (const member of discoverWorkspaceManifests(repoRoot)) {
    if (member.path !== 'package.json') paths.push(member.path);
  }
  return [...new Set([...paths, 'package.json'])].sort();
}

/** Content-address each recorded input over the current working-tree bytes. */
export function digestInputs(
  repoRoot: string,
  paths: readonly string[],
): { readonly inputs: readonly RecordedInput[]; readonly missing: readonly string[] } {
  const inputs: RecordedInput[] = [];
  const missing: string[] = [];
  for (const path of [...paths].sort()) {
    try {
      const bytes = readFileSync(join(repoRoot, path));
      inputs.push({ path, contentSha256: sha256Hex(bytes) });
    } catch {
      missing.push(path);
    }
  }
  return { inputs, missing };
}

interface ReleaseSetRecord {
  readonly identity?: unknown;
}

/**
 * Parse the recorded release-set identity constant from the machine-
 * readable block of `docs/RELEASE-COMPATIBILITY.md` (same block the
 * `verify:release-set` gate reads).
 */
export function readReleaseSetId(repoRoot: string): string | null {
  let doc: string;
  try {
    doc = readFileSync(join(repoRoot, 'docs', 'RELEASE-COMPATIBILITY.md'), 'utf8');
  } catch {
    return null;
  }
  const blockMatch = doc.match(/```json\s*(\{[\s\S]*?"vict-release-set"[\s\S]*?\})\s*```/);
  const block = blockMatch?.[1];
  if (block === undefined) return null;
  try {
    const parsed = JSON.parse(block) as Record<string, ReleaseSetRecord>;
    const record = parsed['vict-release-set'];
    const identity = record?.identity;
    return typeof identity === 'string' ? identity : null;
  } catch {
    return null;
  }
}

/** Parse the reference document version from its header line. */
export function readReferenceVersion(repoRoot: string): string | null {
  let doc: string;
  try {
    doc = readFileSync(join(repoRoot, 'docs', 'VICT-SYSTEM-REFERENCE.md'), 'utf8');
  } catch {
    return null;
  }
  const match = doc.match(/\*\*Document version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/);
  const version = match?.[1];
  return version ?? null;
}

function dependencyLists(manifest: Record<string, unknown>): {
  readonly internal: readonly string[];
  readonly external: readonly string[];
} {
  const collect = (section: unknown): readonly string[] => {
    if (section === null || typeof section !== 'object' || Array.isArray(section)) return [];
    return Object.keys(section as Record<string, unknown>).sort();
  };
  const dependencies = collect(manifest['dependencies']);
  const devDependencies = collect(manifest['devDependencies']);
  const peerDependencies = collect(manifest['peerDependencies']);
  const all = [...new Set([...dependencies, ...devDependencies, ...peerDependencies])].sort();
  return {
    internal: all.filter((name) => name.startsWith('@victframework/')),
    external: all.filter((name) => !name.startsWith('@victframework/')),
  };
}

/** Repository map generated from the workspace manifests (never hand-written). */
export function buildRepositoryMap(repoRoot: string): readonly WorkspaceMember[] {
  const members: WorkspaceMember[] = [];
  for (const { path, manifest } of discoverWorkspaceManifests(repoRoot)) {
    if (path === 'package.json') continue; // the root manifest is workspace identity
    const name = manifest['name'];
    const version = manifest['version'];
    if (typeof name !== 'string' || typeof version !== 'string') continue;
    const { internal, external } = dependencyLists(manifest);
    members.push({
      name,
      version,
      main: typeof manifest['main'] === 'string' ? manifest['main'] : '',
      types: typeof manifest['types'] === 'string' ? manifest['types'] : '',
      private: manifest['private'] === true,
      internalDependencies: internal,
      externalDependencies: external,
    });
  }
  return members.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Workspace identity from the root manifest. */
export function readWorkspaceIdentity(repoRoot: string): {
  readonly name: string;
  readonly version: string;
  readonly workspaces: readonly string[];
} | null {
  try {
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    const name = manifest['name'];
    const version = manifest['version'];
    const workspaces = manifest['workspaces'];
    if (typeof name !== 'string' || typeof version !== 'string' || !Array.isArray(workspaces)) {
      return null;
    }
    return {
      name,
      version,
      workspaces: workspaces.filter((w): w is string => typeof w === 'string').sort(),
    };
  } catch {
    return null;
  }
}

/** Discover first-party capability-pack modules (packs/<pack>/src/index.ts). */
export function discoverPackModules(
  repoRoot: string,
): readonly { readonly name: string; readonly module: string }[] {
  const modules: { name: string; module: string }[] = [];
  for (const dir of listDirs(repoRoot, 'packs')) {
    const manifestPath = join(repoRoot, 'packs', dir, 'package.json');
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      const name = manifest['name'];
      const main = manifest['main'];
      if (typeof name !== 'string' || typeof main !== 'string') continue;
      modules.push({ name, module: `packs/${dir}/${main.replace(/^\.\//, '')}` });
    } catch {
      continue;
    }
  }
  return modules.sort((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0));
}
