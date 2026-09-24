import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packIdentityFromBytes } from '../canonical.js';
import { APP_PACK_SCHEMA, BOOTSTRAP_PROTOCOL } from '../markers.js';
import { validateDocument } from '../validate/index.js';
import {
  APP_BOOTSTRAP_PATH,
  APP_PACK_PATH,
  appPath,
  isSafeRelativeAppPath,
} from '../generate/app-pack.js';
import type { CheckResult, VerifyReport } from './verify.js';

/**
 * `vict-builder-kit verify --app` — the app-level freshness gate for an
 * external application project carrying an app-local base pack (handoff
 * WP-1; the bootstrap file's mandated freshness command).
 *
 * Checks, in order: schema validity of the pack, the canonical identity
 * rule (packId over canonical bytes with packId omitted, and never over
 * the including bytes), the bootstrap↔pack binding, per-input content
 * provenance (`content-drift` / `unregistered-input`), and — once any
 * `@victframework/*` platform package is installed — the installed release
 * identity against the recorded set (`release-identity-drift`).
 *
 * This is the bootstrap support surface, not the TaskLedger P2 proof.
 */

function check(
  id: string,
  ok: boolean,
  detail: string,
  driftClass: string | null = null,
): CheckResult {
  return { id, ok, detail, driftClass };
}

/** Once platform packages exist, they must match the recorded release set; before that, bootstrap state.
 *  The kit itself (`@victframework/builder-kit`) is a tool, not a platform member — it is recorded
 *  separately via `kitArtifact` and is excluded from this check. */
function releaseSetCheck(appDir: string, recordedSetId: string): CheckResult {
  const match = /^vict-release-set@1\/(\d+\.\d+\.\d+)$/.exec(recordedSetId);
  const recordedVersion = match === null ? null : match[1];
  const installed: string[] = [];
  const scopeDir = appPath(appDir, join('node_modules', '@victframework'));
  if (existsSync(scopeDir)) {
    for (const entry of readdirSync(scopeDir)) {
      if (entry === 'builder-kit') continue;
      const manifestPath = appPath(
        appDir,
        join('node_modules', '@victframework', entry, 'package.json'),
      );
      if (existsSync(manifestPath) === false) continue;
      try {
        const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const version = (manifest as Record<string, unknown> | null)?.['version'];
        installed.push(
          `@victframework/${entry}@${typeof version === 'string' ? version : '<unreadable>'}`,
        );
      } catch {
        installed.push(`@victframework/${entry}@<unreadable>`);
      }
    }
  }
  if (installed.length === 0) {
    return check(
      'identity:release-set',
      true,
      `platform packages not installed yet (bootstrap state); recorded set ${recordedSetId}`,
    );
  }
  const mismatched =
    recordedVersion === null
      ? installed
      : installed.filter((entry) => entry.endsWith(`@${recordedVersion}`) === false);
  if (mismatched.length > 0) {
    return check(
      'identity:release-set',
      false,
      `installed platform packages ${mismatched.join(', ')} do not match the recorded set ${recordedSetId}`,
      'release-identity-drift',
    );
  }
  return check(
    'identity:release-set',
    true,
    `installed platform packages match the recorded set ${recordedSetId} (${installed.join(', ')})`,
  );
}

/** Run the app-level freshness gate. `appDir` defaults to the process working directory. */
export function verifyApp(appDir?: string): VerifyReport {
  const checks: CheckResult[] = [];
  const root = resolve(appDir ?? process.cwd());
  const packPath = appPath(root, APP_PACK_PATH);

  let packBytes: Buffer;
  let pack: Record<string, unknown> | null = null;
  try {
    packBytes = readFileSync(packPath);
    const parsed: unknown = JSON.parse(packBytes.toString('utf8'));
    if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false) {
      pack = parsed as Record<string, unknown>;
    }
  } catch {
    checks.push(
      check(
        'schema:app-pack',
        false,
        `missing or unreadable app base pack at ${APP_PACK_PATH}`,
        'content-drift',
      ),
    );
    return { ok: false, checks };
  }

  const validation = validateDocument(pack);
  checks.push(
    check(
      'schema:app-pack',
      validation.ok,
      validation.ok
        ? `valid ${APP_PACK_SCHEMA}`
        : validation.issues.map((item) => `${item.path}: ${item.message}`).join('; '),
    ),
  );
  if (validation.ok === false) {
    return { ok: false, checks };
  }

  const recordedPackId = pack === null ? undefined : pack['packId'];
  let identityOk: boolean;
  try {
    const recomputed = packIdentityFromBytes(packBytes);
    const identityIncluding = createHash('sha256').update(packBytes).digest('hex');
    identityOk =
      typeof recordedPackId === 'string' &&
      recomputed === recordedPackId &&
      recomputed !== identityIncluding;
  } catch {
    identityOk = false;
  }
  checks.push(
    check(
      'identity:app-pack',
      identityOk,
      identityOk
        ? 'packId matches canonical bytes with packId omitted (and differs from the including-packId hash)'
        : 'packId does not match the canonical bytes of the pack (or was computed over the including bytes)',
      identityOk ? null : 'pack-tamper',
    ),
  );

  const bootstrapPath = appPath(root, APP_BOOTSTRAP_PATH);
  let bootstrapOk = false;
  let bootstrapDetail = `missing ${APP_BOOTSTRAP_PATH}`;
  if (existsSync(bootstrapPath)) {
    const bootstrap = readFileSync(bootstrapPath, 'utf8');
    const hasProtocol = bootstrap.includes(BOOTSTRAP_PROTOCOL);
    const hasPackId = typeof recordedPackId === 'string' && bootstrap.includes(recordedPackId);
    bootstrapOk = hasProtocol && hasPackId;
    bootstrapDetail = bootstrapOk
      ? `${APP_BOOTSTRAP_PATH} carries the protocol and the recorded packId`
      : `${APP_BOOTSTRAP_PATH} does not carry the recorded protocol/packId binding`;
  }
  checks.push(
    check(
      'bootstrap:app-pack',
      bootstrapOk,
      bootstrapDetail,
      bootstrapOk ? null : 'bootstrap-drift',
    ),
  );

  const generatedFrom =
    pack === null ? null : (pack['generatedFrom'] as Record<string, unknown> | null);
  const inputs = Array.isArray(generatedFrom?.['inputs']) ? generatedFrom?.['inputs'] : undefined;
  if (inputs === undefined) {
    checks.push(
      check('inputs:app-pack', false, 'pack carries no recorded inputs', 'content-drift'),
    );
  } else {
    const drifted: string[] = [];
    const missing: string[] = [];
    for (const input of inputs as readonly Record<string, unknown>[]) {
      const path = input['path'];
      const digest = input['contentSha256'];
      if (typeof path !== 'string' || typeof digest !== 'string') {
        drifted.push('<malformed input record>');
        continue;
      }
      if (isSafeRelativeAppPath(path) === false) {
        drifted.push(`${path} (unsafe path)`);
        continue;
      }
      const absolute = appPath(root, path);
      if (existsSync(absolute) === false) {
        missing.push(path);
        continue;
      }
      const actual = createHash('sha256').update(readFileSync(absolute)).digest('hex');
      if (actual !== digest) drifted.push(path);
    }
    const okInputs = drifted.length === 0 && missing.length === 0;
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing from app: ${missing.join(', ')}`);
    if (drifted.length > 0) parts.push(`content drift: ${drifted.join(', ')}`);
    checks.push(
      check(
        'inputs:app-pack',
        okInputs,
        okInputs
          ? `all ${String(inputs.length)} recorded input(s) match their recorded digests`
          : parts.join('; '),
        okInputs ? null : missing.length > 0 ? 'unregistered-input' : 'content-drift',
      ),
    );
  }

  const releaseSetId = generatedFrom?.['releaseSetId'];
  if (typeof releaseSetId === 'string') {
    checks.push(releaseSetCheck(root, releaseSetId));
  }

  return { ok: checks.every((item) => item.ok), checks };
}
