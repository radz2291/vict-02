import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { matchesAny } from '../glob.js';

/**
 * Profile-enforcing repository tools (architecture §3.5/§3.7).
 *
 * Enforce-by-default for kit-mediated calls: every refusal is recorded as a
 * structured denial event; escalation-shaped attempts (publish, production
 * activation, approvals, role changes, secret access) carry a stop-
 * condition classification. Honest enforcement boundary: calls a host makes
 * outside this wrapper are DETECTED by the gate's baseline comparison, not
 * prevented here.
 */

export interface ProfileDocument {
  readonly schemaMarker: 'vict.builder.profile@1';
  readonly name: string;
  readonly read: readonly string[];
  readonly write: readonly string[];
  readonly scripts: readonly string[];
  readonly control: readonly string[];
  readonly denials: readonly string[];
  readonly stopOnDenial: readonly string[];
}

export interface ToolContext {
  readonly repoRoot: string;
  readonly profile: ProfileDocument;
  readonly inScopePaths: readonly string[];
  /** Root-manifest npm script names the profile permits. */
  readonly scriptAllowlist: readonly string[];
  readonly denialsFile: string;
  readonly nowIso: () => string;
}

export interface DenialRecord {
  readonly recordedAt: string;
  readonly profile: string;
  readonly tool: string;
  readonly denialClass: string;
  readonly stopCondition: string | null;
  readonly path: string | null;
  readonly reason: string;
}

export type ToolOutcome =
  | { readonly ok: true; readonly output: string }
  | { readonly ok: false; readonly denial: DenialRecord };

/** Tools declared by `vict.builder.tools@1` that the wrapper implements. */
export const IMPLEMENTED_TOOLS: readonly string[] = [
  'fs.read',
  'fs.write',
  'shell.run',
  'git.status',
  'git.diff',
  'git.log',
  'git.commit',
  'kit.verify',
  'kit.validate',
  'kit.generate',
];

/** Tools deliberately ABSENT from every profile (architecture §3.5). */
export const ABSENT_TOOLS: readonly string[] = ['git.push'];

const READ_DENIAL_PATTERNS: readonly string[] = [
  '.pi/**',
  '.git/**',
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  '**/*credential*',
  '**/*secret*',
];

const SECRET_VALUE_SHAPES = /(^|\/)(\.env(\..+)?|.+\.pem|.+\.key|.*credential.*|.*secret.*)$/i;

function escalate(
  tool: string,
  detail: string,
): { readonly denialClass: string; readonly stopCondition: string } | null {
  const lowered = `${tool} ${detail}`.toLowerCase();
  if (lowered.includes('publish') || lowered.includes('release-select')) {
    return { denialClass: 'escalation:publish', stopCondition: 'stop:escalation-publish' };
  }
  if (lowered.includes('activate') || lowered.includes('production')) {
    return {
      denialClass: 'escalation:production-activation',
      stopCondition: 'stop:escalation-production-activation',
    };
  }
  if (lowered.includes('approve') || lowered.includes('approval')) {
    return { denialClass: 'escalation:approval', stopCondition: 'stop:escalation-approval' };
  }
  if (lowered.includes('role') || lowered.includes('scope-change')) {
    return { denialClass: 'escalation:role-change', stopCondition: 'stop:escalation-role-change' };
  }
  if (lowered.includes('secret') || lowered.includes('credential')) {
    return {
      denialClass: 'escalation:secret-access',
      stopCondition: 'stop:escalation-secret-access',
    };
  }
  return null;
}

function withinRepo(ctx: ToolContext, path: string): string | null {
  if (isAbsolute(path)) return null;
  const absolute = resolve(ctx.repoRoot, path);
  const rel = relative(ctx.repoRoot, absolute).replace(/\\/g, '/');
  if (rel.startsWith('..') || rel.length === 0) return null;
  return rel;
}

function record(ctx: ToolContext, denial: DenialRecord): void {
  mkdirSync(dirname(ctx.denialsFile), { recursive: true });
  appendFileSync(ctx.denialsFile, JSON.stringify(denial) + '\n', 'utf8');
}

function deny(
  ctx: ToolContext,
  tool: string,
  denialClass: string,
  stopCondition: string | null,
  path: string | null,
  reason: string,
): ToolOutcome {
  const recordFull: DenialRecord = {
    recordedAt: ctx.nowIso(),
    profile: ctx.profile.name,
    tool,
    denialClass,
    stopCondition,
    path,
    reason,
  };
  record(ctx, recordFull);
  return { ok: false, denial: recordFull };
}

function git(ctx: ToolContext, args: readonly string[]): ToolOutcome {
  const result = spawnSync('git', ['-C', ctx.repoRoot, ...args], { encoding: 'utf8' });
  if (result.error !== undefined) {
    return deny(
      ctx,
      `git.${String(args[0])}`,
      'git-failed',
      null,
      null,
      `git failed to start: ${result.error.message}`,
    );
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return { ok: true, output: output.length > 4000 ? output.slice(0, 4000) + '…' : output };
}

/** Execute one kit tool under the profile. */
export function executeTool(
  ctx: ToolContext,
  tool: string,
  input: Readonly<Record<string, string>>,
): ToolOutcome {
  if (ABSENT_TOOLS.includes(tool)) {
    const shape = escalate(tool, input['remote'] ?? '');
    return deny(
      ctx,
      tool,
      shape === null ? 'tool-absent' : shape.denialClass,
      shape === null ? null : shape.stopCondition,
      null,
      `tool is deliberately absent from the kit: ${tool}`,
    );
  }
  if (tool.startsWith('control.')) {
    const shape = escalate(tool, '');
    return deny(
      ctx,
      tool,
      'tool-absent',
      shape === null ? null : shape.stopCondition,
      null,
      'control-tool bindings are omitted from this kit build (recorded limitation); no control authority is available',
    );
  }
  if (!IMPLEMENTED_TOOLS.includes(tool)) {
    return deny(ctx, tool, 'unknown-tool', null, null, 'tool outside the declared manifest');
  }

  if (tool === 'fs.read') {
    const rawPath = input['path'];
    if (rawPath === undefined || rawPath.length === 0) {
      return deny(ctx, tool, 'invalid-input', null, null, 'fs.read requires a path');
    }
    const rel = withinRepo(ctx, rawPath);
    if (rel === null) {
      return deny(
        ctx,
        tool,
        'path-outside-repository',
        null,
        rawPath,
        'path escapes the repository',
      );
    }
    if (matchesAny(rel, READ_DENIAL_PATTERNS)) {
      const secret = SECRET_VALUE_SHAPES.test(rel) || rel.startsWith('.pi/');
      return deny(
        ctx,
        tool,
        secret ? 'escalation:secret-access' : 'path-denied',
        secret ? 'stop:secret-or-pi-content' : null,
        rel,
        'path is a named denial of every builder profile',
      );
    }
    if (!existsSync(join(ctx.repoRoot, rel))) {
      return deny(ctx, tool, 'path-missing', null, rel, 'path does not exist');
    }
    const content = readFileSync(join(ctx.repoRoot, rel), 'utf8');
    return { ok: true, output: content.length > 16000 ? content.slice(0, 16000) + '…' : content };
  }

  if (tool === 'fs.write') {
    const rawPath = input['path'];
    if (rawPath === undefined || rawPath.length === 0) {
      return deny(ctx, tool, 'invalid-input', null, null, 'fs.write requires a path');
    }
    const rel = withinRepo(ctx, rawPath);
    if (rel === null) {
      return deny(
        ctx,
        tool,
        'path-outside-repository',
        null,
        rawPath,
        'path escapes the repository',
      );
    }
    if (matchesAny(rel, READ_DENIAL_PATTERNS)) {
      const secret = SECRET_VALUE_SHAPES.test(rel) || rel.startsWith('.pi/');
      return deny(
        ctx,
        tool,
        secret ? 'escalation:secret-access' : 'path-denied',
        secret ? 'stop:secret-or-pi-content' : null,
        rel,
        'path is a named denial of every builder profile',
      );
    }
    if (!matchesAny(rel, ctx.inScopePaths)) {
      return deny(
        ctx,
        tool,
        'out-of-scope-write',
        null,
        rel,
        'path outside the handoff in-scope set',
      );
    }
    const content = input['content'] ?? '';
    const absolute = join(ctx.repoRoot, rel);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, 'utf8');
    return { ok: true, output: `wrote ${rel} (${Buffer.byteLength(content, 'utf8')} bytes)` };
  }

  if (tool === 'shell.run') {
    const script = input['script'];
    if (script === undefined || script.length === 0) {
      return deny(ctx, tool, 'invalid-input', null, null, 'shell.run requires an npm script name');
    }
    if (!ctx.scriptAllowlist.includes(script)) {
      const shape = escalate(tool, script);
      return deny(
        ctx,
        tool,
        shape === null ? 'unlisted-script' : shape.denialClass,
        shape === null ? null : shape.stopCondition,
        script,
        shape === null
          ? 'script not on the profile allowlist'
          : 'script matches an escalation shape',
      );
    }
    const result = spawnSync('npm', ['run', '--silent', script], {
      cwd: ctx.repoRoot,
      encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.status !== 0) {
      return deny(
        ctx,
        tool,
        'script-failed',
        null,
        script,
        `npm run ${script} exited ${String(result.status)}`,
      );
    }
    return { ok: true, output: output.length > 16000 ? output.slice(0, 16000) + '…' : output };
  }

  if (tool === 'git.status') return git(ctx, ['status', '--porcelain']);
  if (tool === 'git.diff') return git(ctx, ['diff', '--stat']);
  if (tool === 'git.log') return git(ctx, ['log', '--oneline', '-12']);

  if (tool === 'git.commit') {
    if (!ctx.profile.write.includes('working-branch')) {
      return deny(ctx, tool, 'profile-forbidden', null, null, 'profile does not permit commits');
    }
    const message = input['message'];
    if (message === undefined || message.trim().length === 0) {
      return deny(ctx, tool, 'invalid-input', null, null, 'git.commit requires a message');
    }
    const result = spawnSync('git', ['-C', ctx.repoRoot, 'commit', '-m', message], {
      encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.status !== 0) {
      return deny(
        ctx,
        tool,
        'git-failed',
        null,
        null,
        `git commit exited ${String(result.status)}: ${output.slice(0, 200)}`,
      );
    }
    return { ok: true, output };
  }

  // kit.* tools delegate to the gate/validator/generator entry points.
  if (tool === 'kit.verify' || tool === 'kit.validate' || tool === 'kit.generate') {
    if (!ctx.profile.write.includes('kit-tools')) {
      return deny(ctx, tool, 'profile-forbidden', null, null, 'profile does not permit kit tools');
    }
    return { ok: true, output: `kit tool '${tool}' is available through the vict-builder-kit CLI` };
  }

  return deny(ctx, tool, 'unknown-tool', null, null, 'unhandled tool');
}

/** Default denial-record location (gitignored, isolated per repository). */
export function defaultDenialsFile(repoRoot: string): string {
  return join(repoRoot, '.builder-kit', 'denials.jsonl');
}
