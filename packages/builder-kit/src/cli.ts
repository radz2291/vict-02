import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateStableLayer } from './generate/generate.js';
import {
  buildAcceptedTaskScope,
  ACCEPTED_TASK_SCOPE_PATH,
} from './generate/accepted-task-scope.js';
import { buildTaskPack, taskPackDirectory } from './generate/task-pack.js';
import { initExternalApp } from './generate/init-app.js';
import { canonicalJsonBytes, sha256Hex } from './canonical.js';
import { generateCatalog } from './catalog/generate.js';
import { verifyBuilderKit } from './verify/verify.js';
import { verifyApp } from './verify/app-verify.js';
import { verifyTaskPackAuthority } from './verify/task-pack.js';
import { validateDocument, type ValidationResult } from './validate/index.js';
import {
  defaultDenialsFile,
  executeTool,
  type ProfileDocument,
  type ToolContext,
} from './runtime/wrapper.js';

/**
 * `vict-builder-kit` command-line surface:
 * `generate`, `catalog`, `verify`, `validate`, `run`, `task-pack`,
 * `accept-scope`, `init-app`.
 */

function usage(): string {
  return [
    'vict-builder-kit <command> [options]',
    '',
    'commands:',
    '  generate [--repo-root <dir>]                      regenerate the committed stable layer',
    '  catalog   [--repo-root <dir>] [--out <file>]      regenerate the capability catalog',
    '  verify    [--repo-root <dir>] [--json]            run the verify:builder-kit gate',
    '  verify --app [--app-dir <dir>] [--json]           run the app-level freshness gate',
    '  validate  <file>...                               validate vict.builder.* documents',
    '  run       --profile <name> --tool <tool> [--task-pack <file>] [--arg k=v ...]',
    '                                                    execute a tool under a profile',
    '  task-pack --handoff <path> --base-tree <sha> --in-scope <glob> [--ignore <glob>]' +
      ' [--profile <name>] [--repo-root <dir>]' +
      '  generate an isolated task pack',
    '  accept-scope --handoff <path> --in-scope <glob> [--in-scope <glob> ...]' +
      ' [--profile <name> [--profile <name> ...]] [--ignore <glob>] [--notes <text>]' +
      ' [--repo-root <dir>]' +
      '  file the committed accepted-task-scope record for a handoff',
    '  init-app  --app-dir <dir> --release-set <id> --kit-artifact <spec> --kit-sha256 <hex>',
    '            --input <path> [--input <path> ...] [--brief <path>]  bootstrap an external application',
  ].join('\n');
}

interface ParsedArgs {
  readonly positional: readonly string[];
  readonly flags: ReadonlyMap<string, string[]>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    if (arg !== undefined && arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      const existing = flags.get(key) ?? [];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, [...existing, next]);
        index += 2;
      } else {
        flags.set(key, [...existing, 'true']);
        index += 1;
      }
      continue;
    }
    positional.push(arg ?? '');
    index += 1;
  }
  return { positional, flags };
}

function flag(args: ParsedArgs, key: string): string | undefined {
  const values = args.flags.get(key);
  return values === undefined || values.length === 0 ? undefined : values[values.length - 1];
}

function flagList(args: ParsedArgs, key: string): readonly string[] {
  return args.flags.get(key) ?? [];
}

function repoRootOf(args: ParsedArgs): string {
  return flag(args, 'repo-root') ?? process.cwd();
}

function loadProfiles(repoRoot: string): readonly ProfileDocument[] {
  const parsed: unknown = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'builder-kit', 'data', 'profiles.json'), 'utf8'),
  );
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list as ProfileDocument[];
}

function readRootScripts(repoRoot: string): readonly string[] {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const scripts = manifest['scripts'];
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) return [];
  return Object.keys(scripts as Record<string, unknown>).sort();
}

/** Build the tool context for `run`; returns an error string on refusal. */
export function buildToolContext(
  repoRoot: string,
  profileName: string,
  taskPackPath: string | undefined,
): ToolContext | string {
  const profiles = loadProfiles(repoRoot);
  const profile = profiles.find((candidate) => candidate.name === profileName);
  if (profile === undefined) {
    return `unknown profile '${profileName}' (available: ${profiles.map((p) => p.name).join(', ')})`;
  }
  // A write-capable invocation REQUIRES a valid active task pack: there is
  // no fallback write scope, and the caller cannot choose a stronger
  // profile than the pack's accepted effective profile (architecture
  // §3.3/§3.5 — the task pack names the profile in effect).
  const writeCapable =
    profile.write.includes('working-branch') || profile.write.includes('kit-tools');
  if (writeCapable && taskPackPath === undefined) {
    return `write-capable profile '${profileName}' requires a valid active task pack (--task-pack); no fallback write scope exists`;
  }
  let inScopePaths: readonly string[] = [];
  if (taskPackPath !== undefined) {
    // Authority BEFORE scope: an invalid or stale task pack is refused
    // outright — its carried scope is never used (architecture §3.3/§3.9;
    // a recomputed packId certifies bytes, not authority).
    const authority = verifyTaskPackAuthority(repoRoot, taskPackPath);
    if (!authority.ok) {
      const failed = authority.checks
        .filter((check) => !check.ok)
        .map((check) => `${check.id} [${check.driftClass ?? 'invalid'}]`)
        .join(', ');
      return `task pack refused (not accepted authority): ${failed}`;
    }
    if (authority.permissionProfile !== profileName) {
      return `task pack refused (profile mismatch): the pack's accepted effective profile is '${String(
        authority.permissionProfile,
      )}' but '${profileName}' was requested`;
    }
    inScopePaths = authority.inScopePaths;
  }
  return {
    repoRoot,
    profile,
    inScopePaths,
    scriptAllowlist: profile.scripts.filter((script) => readRootScripts(repoRoot).includes(script)),
    denialsFile: defaultDenialsFile(repoRoot),
    nowIso: () => new Date().toISOString(),
  };
}

function printValidationResult(file: string, result: ValidationResult): boolean {
  if (result.ok) {
    console.log(`  ok: ${file}`);
    return true;
  }
  for (const issueEntry of result.issues) {
    console.error(
      `  FAIL: ${file}: ${issueEntry.code} at ${issueEntry.path}: ${issueEntry.message}`,
    );
  }
  return false;
}

export function runCli(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const command = args.positional[0];
  if (command === undefined || flag(args, 'help') !== undefined) {
    console.log(usage());
    return command === undefined ? 2 : 0;
  }

  if (command === 'generate') {
    const repoRoot = repoRootOf(args);
    const result = generateStableLayer(repoRoot);
    for (const item of result.written) {
      console.log(`  wrote ${item.path} (${String(item.bytes)} bytes)`);
    }
    console.log(`  base pack packId ${result.packId}`);
    return 0;
  }

  if (command === 'catalog') {
    const repoRoot = repoRootOf(args);
    const { catalog } = generateCatalog(repoRoot);
    const bytes = canonicalJsonBytes(catalog);
    const out = flag(args, 'out');
    if (out === undefined) {
      process.stdout.write(bytes);
      return 0;
    }
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(out, bytes);
    console.log(`  wrote ${out} (${String(bytes.byteLength)} bytes)`);
    return 0;
  }

  if (command === 'verify') {
    const appMode = flag(args, 'app') !== undefined;
    if (appMode) {
      const report = verifyApp(flag(args, 'app-dir'));
      if (flag(args, 'json') !== undefined) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        for (const check of report.checks) {
          const marker = check.ok ? 'ok' : 'FAIL';
          const drift = check.driftClass === null ? '' : ` [${check.driftClass}]`;
          console.log(`  ${marker}: ${check.id}${drift} — ${check.detail}`);
        }
        console.log(
          report.ok
            ? `\nverify --app: ALL CHECKS PASSED (${String(report.checks.length)} checks)`
            : `\nverify --app: ${String(report.checks.filter((check) => !check.ok).length)} check(s) FAILED`,
        );
      }
      return report.ok ? 0 : 1;
    }
    const repoRoot = repoRootOf(args);
    const report = verifyBuilderKit(repoRoot);
    if (flag(args, 'json') !== undefined) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      for (const check of report.checks) {
        const marker = check.ok ? 'ok' : 'FAIL';
        const drift = check.driftClass === null ? '' : ` [${check.driftClass}]`;
        console.log(`  ${marker}: ${check.id}${drift} — ${check.detail}`);
      }
      console.log(
        report.ok
          ? `\nverify:builder-kit: ALL CHECKS PASSED (${String(report.checks.length)} checks)`
          : `\nverify:builder-kit: ${String(report.checks.filter((check) => !check.ok).length)} check(s) FAILED`,
      );
    }
    return report.ok ? 0 : 1;
  }

  if (command === 'validate') {
    const files = args.positional.slice(1);
    if (files.length === 0) {
      console.error('validate: no files given');
      return 2;
    }
    let allOk = true;
    for (const file of files) {
      try {
        const document: unknown = JSON.parse(readFileSync(file, 'utf8'));
        const result = validateDocument(document);
        allOk = printValidationResult(file, result) && allOk;
      } catch (error) {
        console.error(`  FAIL: ${file}: unreadable or unparsable (${(error as Error).message})`);
        allOk = false;
      }
    }
    return allOk ? 0 : 1;
  }

  if (command === 'run') {
    const repoRoot = repoRootOf(args);
    const profileName = flag(args, 'profile');
    const tool = flag(args, 'tool');
    if (profileName === undefined || tool === undefined) {
      console.error('run: --profile and --tool are required');
      return 2;
    }
    const context = buildToolContext(repoRoot, profileName, flag(args, 'task-pack'));
    if (typeof context === 'string') {
      console.error(`run: ${context}`);
      return 2;
    }
    const input: Record<string, string> = {};
    for (const pair of flagList(args, 'arg')) {
      const equals = pair.indexOf('=');
      if (equals <= 0) {
        console.error(`run: malformed --arg '${pair}' (expected key=value)`);
        return 2;
      }
      input[pair.slice(0, equals)] = pair.slice(equals + 1);
    }
    const outcome = executeTool(context, tool, input);
    if (outcome.ok) {
      console.log(outcome.output);
      return 0;
    }
    const denial = outcome.denial;
    console.error(
      JSON.stringify({
        event: 'kit.denial',
        profile: denial.profile,
        tool: denial.tool,
        denialClass: denial.denialClass,
        stopCondition: denial.stopCondition,
        path: denial.path,
        reason: denial.reason,
      }),
    );
    if (denial.stopCondition !== null) {
      console.error(`STOP: ${denial.stopCondition} — report and halt (architecture §3.8 item 5)`);
    }
    return 1;
  }

  if (command === 'task-pack') {
    const repoRoot = repoRootOf(args);
    const handoffPath = flag(args, 'handoff');
    const baseTree = flag(args, 'base-tree');
    if (handoffPath === undefined || baseTree === undefined) {
      console.error('task-pack: --handoff and --base-tree are required');
      return 2;
    }
    const inScopePaths = flagList(args, 'in-scope');
    const ignoreManifest = flagList(args, 'ignore');
    if (inScopePaths.length === 0) {
      console.error('task-pack: at least one --in-scope glob is required');
      return 2;
    }
    const { writeFileSync: writeFile, mkdirSync: makeDir } = {
      writeFileSync,
      mkdirSync,
    };
    const params = {
      handoffPath,
      baseTree,
      inScopePaths,
      ignoreManifest,
      permissionProfile: flag(args, 'profile') ?? 'builder.change',
    };
    const pack = buildTaskPack(repoRoot, params);
    const bytes = canonicalJsonBytes(pack);
    const handoffSha = sha256Hex(readFileSync(join(repoRoot, handoffPath)));
    const directory = taskPackDirectory(repoRoot, handoffPath, handoffSha);
    makeDir(directory, { recursive: true });
    const outPath = join(directory, 'task-pack.json');
    writeFile(outPath, bytes);
    console.log(`  wrote ${outPath} (${String(bytes.byteLength)} bytes)`);
    console.log(`  task packId ${String(pack['packId'])}`);
    return 0;
  }

  if (command === 'accept-scope') {
    const repoRoot = repoRootOf(args);
    const handoffPath = flag(args, 'handoff');
    if (handoffPath === undefined) {
      console.error('accept-scope: --handoff is required');
      return 2;
    }
    const inScopePaths = flagList(args, 'in-scope');
    if (inScopePaths.length === 0) {
      console.error('accept-scope: at least one --in-scope glob is required');
      return 2;
    }
    const profiles = flagList(args, 'profile');
    const notes = flag(args, 'notes');
    if (notes === undefined || notes.trim().length === 0) {
      console.error(
        'accept-scope: --notes is required (the acceptance record must state its derivation)',
      );
      return 2;
    }
    const record = buildAcceptedTaskScope(repoRoot, {
      handoffPath,
      inScopePaths,
      permissionProfiles: profiles.length > 0 ? profiles : ['builder.change'],
      ignoreManifest: flagList(args, 'ignore'),
      notes,
    });
    const bytes = canonicalJsonBytes(record);
    const outPath = join(repoRoot, ACCEPTED_TASK_SCOPE_PATH);
    writeFileSync(outPath, bytes);
    console.log(`  wrote ${outPath} (${String(bytes.byteLength)} bytes)`);
    console.log(`  accepted-scope packId ${String(record['packId'])}`);
    return 0;
  }

  if (command === 'init-app') {
    const appDir = flag(args, 'app-dir');
    const releaseSet = flag(args, 'release-set');
    const kitArtifact = flag(args, 'kit-artifact');
    const kitSha = flag(args, 'kit-sha256');
    const inputs = flagList(args, 'input');
    if (
      appDir === undefined ||
      releaseSet === undefined ||
      kitArtifact === undefined ||
      kitSha === undefined ||
      inputs.length === 0
    ) {
      console.error(
        'init-app: --app-dir, --release-set, --kit-artifact, --kit-sha256, and at least one --input are required',
      );
      return 2;
    }
    let written: readonly string[];
    try {
      written = initExternalApp({
        appDir,
        releaseSetId: releaseSet,
        kitArtifactSpec: kitArtifact,
        kitArtifactSha256: kitSha,
        inputs,
        briefPath: flag(args, 'brief'),
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    for (const path of written) console.log(`  wrote ${path}`);
    return 0;
  }

  console.error(`unknown command '${command}'`);
  console.log(usage());
  return 2;
}

// Entry point: dispatch and set the process exit code (never process.exit,
// so redirected stdout always flushes). Guarded so test modules can import
// helpers from this file without dispatching.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) process.exitCode = runCli(process.argv.slice(2));
