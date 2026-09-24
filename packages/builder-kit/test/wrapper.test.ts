import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ABSENT_TOOLS,
  defaultDenialsFile,
  executeTool,
  type ProfileDocument,
  type ToolContext,
  type ToolOutcome,
} from '../src/runtime/wrapper.js';

/**
 * Profile enforcement and escalation shapes (handoff Tests #4, #5, #6):
 * out-of-scope writes refused + recorded, unlisted scripts refused,
 * `git.push` not available, escalation-shaped attempts classified as stop
 * conditions, and denial records persisted as structured events.
 */

const readProfile: ProfileDocument = {
  schemaMarker: 'vict.builder.profile@1',
  name: 'builder.read',
  read: ['repository'],
  write: [],
  scripts: [],
  control: [],
  denials: ['secret values', 'git.push'],
  stopOnDenial: ['secret values'],
};

const changeProfile: ProfileDocument = {
  schemaMarker: 'vict.builder.profile@1',
  name: 'builder.change',
  read: ['repository'],
  write: ['in-scope paths', 'kit-tools', 'working-branch'],
  scripts: ['test', 'verify:builder-kit'],
  control: ['control.propose'],
  denials: [
    'production activation',
    'release publication or Application Release select',
    'secret values',
  ],
  stopOnDenial: [
    'production activation',
    'release publication or Application Release select',
    'secret values',
  ],
};

const tempRoots: string[] = [];

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'vict-wrapper-'));
  tempRoots.push(root);
  return root;
}

function context(repoRoot: string, profile: ProfileDocument): ToolContext {
  return {
    repoRoot,
    profile,
    inScopePaths: ['docs/builder-kit/**'],
    scriptAllowlist: profile.scripts,
    denialsFile: defaultDenialsFile(repoRoot),
    nowIso: () => '2026-01-01T00:00:00.000Z',
  };
}

function denialOf(outcome: ToolOutcome): { denialClass: string; stopCondition: string | null } {
  if (outcome.ok) throw new Error('expected a denial');
  return { denialClass: outcome.denial.denialClass, stopCondition: outcome.denial.stopCondition };
}

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

describe('profile-enforcing wrapper', () => {
  it('allows in-scope writes and refuses out-of-scope writes, recording both classes', () => {
    const root = tmpRoot();
    const ctx = context(root, changeProfile);

    const inScope = executeTool(ctx, 'fs.write', {
      path: 'docs/builder-kit/scratch.txt',
      content: 'hello',
    });
    expect(inScope.ok).toBe(true);
    expect(readFileSync(join(root, 'docs', 'builder-kit', 'scratch.txt'), 'utf8')).toBe('hello');

    const refusal = executeTool(ctx, 'fs.write', {
      path: 'packs/fx-pack/src/index.ts',
      content: 'x',
    });
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) {
      expect(refusal.denial.denialClass).toBe('out-of-scope-write');
      expect(refusal.denial.stopCondition).toBeNull();
    }

    const recorded = readFileSync(defaultDenialsFile(root), 'utf8').trim().split('\n');
    expect(recorded).toHaveLength(1);
    const event = JSON.parse(recorded[0] ?? '{}') as Record<string, unknown>;
    expect(event['denialClass']).toBe('out-of-scope-write');
    expect(event['profile']).toBe('builder.change');
    expect(typeof event['recordedAt']).toBe('string');
  });

  it('refuses unlisted npm scripts and treats publish-shaped scripts as stop conditions', () => {
    const root = tmpRoot();
    const ctx = context(root, changeProfile);

    const unlisted = executeTool(ctx, 'shell.run', { script: 'format' });
    expect(denialOf(unlisted)).toEqual({ denialClass: 'unlisted-script', stopCondition: null });

    const publish = executeTool(ctx, 'shell.run', { script: 'publish:release' });
    expect(denialOf(publish)).toEqual({
      denialClass: 'escalation:publish',
      stopCondition: 'stop:escalation-publish',
    });
  });

  it('does not offer git.push at all (tool absent from every profile)', () => {
    const root = tmpRoot();
    const outcome = executeTool(context(root, changeProfile), 'git.push', { remote: 'origin' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.denial.denialClass).toBe('tool-absent');
      expect(outcome.denial.stopCondition).toBeNull();
    }
    expect(ABSENT_TOOLS).toContain('git.push');
  });

  it('classifies control/activation/approval/secret attempts as escalation stop conditions', () => {
    const root = tmpRoot();
    const ctx = context(root, changeProfile);

    expect(denialOf(executeTool(ctx, 'control.activate', {})).stopCondition).toBe(
      'stop:escalation-production-activation',
    );
    expect(denialOf(executeTool(ctx, 'control.approve', {})).stopCondition).toBe(
      'stop:escalation-approval',
    );
    expect(denialOf(executeTool(ctx, 'control.grantRole', {})).stopCondition).toBe(
      'stop:escalation-role-change',
    );
    expect(denialOf(executeTool(ctx, 'fs.read', { path: '.env.production' })).stopCondition).toBe(
      'stop:secret-or-pi-content',
    );
    expect(
      denialOf(executeTool(ctx, 'fs.read', { path: '.pi/session-log.md' })).stopCondition,
    ).toBe('stop:secret-or-pi-content');
  });

  it('denies .pi/ and credential paths for the read-only profile too', () => {
    const root = tmpRoot();
    const ctx = context(root, readProfile);
    const outcome = executeTool(ctx, 'fs.read', { path: 'README.md' });
    // Read-only profile may read ordinary files (file may not exist → path-missing refusal).
    expect(outcome.ok === false && outcome.denial.denialClass === 'path-missing').toBe(true);
    const denied = executeTool(ctx, 'fs.read', { path: '.pi/x.md' });
    expect(denied.ok).toBe(false);
  });
});
