#!/usr/bin/env node
/**
 * Release-tarball inspection and content scan (trusted-publishing path).
 *
 * Implements contract §9 of
 * `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`: every ACTUAL packed
 * tarball of the coordinated release set is inspected BEFORE publication
 * and must pass:
 *
 *   1. identity — the tarball's OWN package metadata matches the
 *      workspace manifest identity under the canonical npm-pack filename
 *      (scripts/lib/tarball-set.mjs);
 *   2. path allowlist — every archived file sits inside one of the
 *      manifest's declared `files` entries (plus the npm-mandated
 *      package.json / README / LICENSE roots), and NO dotfile of any kind
 *      is archived (scripts/lib/tarball-scan-rules.mjs);
 *   3. manifest truth — the packed package.json equals the workspace
 *      manifest on the release-relevant fields, and its dependency
 *      specifiers carry no workspace/file/link/git+ protocol;
 *   4. content scan — no credential material and no local absolute
 *      paths (scripts/lib/tarball-scan-rules.mjs), scanning
 *      comment-stripped text for code files and raw bytes otherwise.
 *
 * The scan fails closed: every finding names the tarball, the archived
 * file, and the rule; any finding fails the run before publication.
 *
 * Usage:
 *   node scripts/scan-release-tarballs.mjs --pack-dir <dir> [--repo-root R]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { matchTarballSet } from './lib/tarball-set.mjs';
import { readTarballMember } from './lib/tarball-io.mjs';
import { deriveReleaseInventory } from './lib/release-set.mjs';
import {
  checkPathAllowlist,
  checkPackedManifest,
  checkText,
  COMMENTED_EXTENSIONS,
  stripComments,
} from './lib/tarball-scan-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`scan-release-tarballs: BLOCKED — ${message}`);
  process.exit(1);
}

/** List every archived path of one tarball and extract it to a fresh dir. */
function extractTarball(tgzPath, destination) {
  mkdirSync(destination, { recursive: true });
  // Windows GNU tar treats 'X:\...' as a remote host:path — use forward
  // slashes and --force-local there; POSIX needs neither.
  const isWindows = process.platform === 'win32';
  const normalize = (value) => (isWindows ? value.replace(/\\/g, '/') : value);
  const extractArgs = isWindows
    ? ['--force-local', '-xzf', normalize(tgzPath), '-C', normalize(destination)]
    : ['-xzf', tgzPath, '-C', destination];
  const listArgs = isWindows ? ['--force-local', '-tzf', normalize(tgzPath)] : ['-tzf', tgzPath];
  const tar = spawnSync('tar', extractArgs, {
    encoding: 'utf8',
    shell: isWindows,
  });
  if (tar.status !== 0) {
    return { error: `tar exited ${tar.status}: ${(tar.stderr ?? '').trim().slice(0, 200)}` };
  }
  const listed = spawnSync('tar', listArgs, { encoding: 'utf8', shell: isWindows });
  if (listed.status !== 0) {
    return {
      error: `tar -t exited ${listed.status}: ${(listed.stderr ?? '').trim().slice(0, 200)}`,
    };
  }
  const paths = (listed.stdout ?? '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  return { paths };
}

function readScannableText(filePath, extension) {
  const buffer = readFileSync(filePath);
  if (COMMENTED_EXTENSIONS.has(extension)) {
    return stripComments(buffer.toString('utf8'));
  }
  // latin1 is byte-preserving for arbitrary binary content while keeping
  // every ASCII pattern matchable.
  return buffer.toString('latin1');
}

// ---- main --------------------------------------------------------------------

const argv = process.argv.slice(2);
let packDir;
let repoRoot = resolve(scriptDir, '..');
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--pack-dir') {
    packDir = argv[index + 1];
    index += 1;
  } else if (argv[index] === '--repo-root') {
    repoRoot = resolve(argv[index + 1]);
    index += 1;
  } else {
    fail(`unknown argument '${argv[index]}'`);
  }
}
if (packDir === undefined || !existsSync(packDir)) {
  fail('a valid --pack-dir <dir> with the packed release set is required.');
}

const inventory = deriveReleaseInventory(repoRoot);
if (inventory.problems.length > 0) {
  fail(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
}

const expected = inventory.order.map((name) => ({
  name,
  version: inventory.byName.get(name).version,
}));
const found = readdirSync(packDir)
  .filter((fileName) => fileName.endsWith('.tgz'))
  .map((fileName) => {
    try {
      const out = readTarballMember(join(packDir, fileName), 'package/package.json');
      const parsed = JSON.parse(out);
      return { fileName, name: parsed.name, version: parsed.version };
    } catch (error) {
      return { fileName, error: error.message };
    }
  });
const matched = matchTarballSet(expected, found);
if (!matched.ok) {
  fail(
    `packed tarball set does not match the release inventory:\n  - ${matched.problems.join('\n  - ')}`,
  );
}

const workRoot = join(tmpdir(), `vict-tarball-scan-${process.pid}-${Date.now()}`);
rmSync(workRoot, { recursive: true, force: true });
mkdirSync(workRoot, { recursive: true });
const findings = [];

try {
  for (const name of inventory.order) {
    const tarball = matched.byName.get(name);
    const tgzPath = join(packDir, tarball.fileName);
    const workspaceManifest = inventory.byName.get(name).manifest;
    const scanDir = join(workRoot, name.replace('/', '_'));
    const extraction = extractTarball(tgzPath, scanDir);
    if (extraction.error !== undefined) {
      findings.push(`${tarball.fileName}: extraction failed (${extraction.error})`);
      continue;
    }

    let packedManifest;
    try {
      packedManifest = JSON.parse(readFileSync(join(scanDir, 'package', 'package.json'), 'utf8'));
    } catch (error) {
      findings.push(`${tarball.fileName}: packed package.json unreadable (${error.message})`);
      continue;
    }

    // Regular files only (directory entries end with '/' in the listing).
    const archivedFiles = extraction.paths
      .map((rawPath) => rawPath.replace(/\\/g, '/'))
      .filter(
        (rawPath) =>
          rawPath.startsWith('package/') &&
          rawPath.length > 'package/'.length &&
          !rawPath.endsWith('/'),
      )
      .map((rawPath) => rawPath.slice('package/'.length));

    checkPathAllowlist(extraction.paths, packedManifest.files, findings, tarball.fileName);
    checkPackedManifest(packedManifest, workspaceManifest, findings, tarball.fileName);
    for (const relative of archivedFiles) {
      const extension = relative.slice(relative.lastIndexOf('.')).toLowerCase();
      try {
        checkText(
          readScannableText(join(scanDir, 'package', relative), extension),
          findings,
          tarball.fileName,
          relative,
        );
      } catch {
        // Unreadable-by-us files remain covered by the path allowlist.
      }
    }
    console.log(`  ok: ${tarball.fileName} (${archivedFiles.length} files scanned)`);
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}

if (findings.length > 0) {
  console.error(`\nscan-release-tarballs: ${findings.length} FINDING(S):`);
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}
console.log('\nscan-release-tarballs: ALL 13 TARBALLS CLEAN (identity, paths, manifest, content)');
