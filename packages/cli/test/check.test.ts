/**
 * Authoring-tools slice — `vict check` and `vict vocabulary`.
 *
 * Local, server-free commands. Exit-code contract:
 *   0 valid/ok · 1 usage error · 4 invalid definition · 5 unexpected error.
 * Operator commands and their exit codes are exercised against the real
 * HTTP boundary in packages/server/test/cli.test.ts and MUST stay unchanged;
 * the preservation cases at the end of this file pin the no-server subset.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheckCommand, runVictCli } from '@victframework/cli';
import { describeApplicationVocabulary } from '@victframework/application';

const io = () => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (line: string) => out.push(line),
    stderr: (line: string) => err.push(line),
  };
};

const dir = mkdtempSync(join(tmpdir(), 'vict-check-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Write a definition file into the temp dir; vitest transforms the .ts import. */
function writeDefinition(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, body, 'utf8');
  return path;
}

const VALID = `import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.check.valid', revision: '1', name: 'Valid',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [{ id: 's.home', title: 'Home', layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.hi', content: 'Hi' }] }] }],
  views: [], forms: [], actions: [], resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});`;

const BROKEN = `import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.check.broken', revision: '1', name: 'Broken',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [{ id: 's.home', title: 'Home', layout: [{ name: 'main', surfaces: [
    { role: 'text', id: 't.hi', content: 'Hi', colour: 'red' },
    { role: 'gauge', id: 'g.one', viewId: 'v.x' },
  ] }] }],
  views: [], forms: [], actions: [], resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});`;

describe('vict check', () => {
  it('valid definition: exit 0, stable JSON result with the application version', async () => {
    const file = writeDefinition('valid.ts', VALID);
    const capture = io();
    const code = await runCheckCommand([file, '--json'], capture);
    expect(code).toBe(0);
    const payload = JSON.parse(capture.out.join('\n'));
    expect(payload).toMatchObject({ ok: true, file, schema: 'vict.application@2', issueCount: 0 });
    expect(payload.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
  });

  it('valid definition: human output names id, revision and version', async () => {
    const file = writeDefinition('valid-human.ts', VALID);
    const capture = io();
    const code = await runCheckCommand([file], capture);
    expect(code).toBe(0);
    expect(capture.out.join('\n')).toContain('app.check.valid');
    expect(capture.out.join('\n')).toMatch(/applicationVersion:\s+v1_[0-9a-f]{64}/);
  });

  it('invalid definition: exit 4, diagnostics carry codes, paths and allowed values', async () => {
    const file = writeDefinition('broken.ts', BROKEN);
    const capture = io();
    const code = await runCheckCommand([file, '--json'], capture);
    expect(code).toBe(4);
    const payload = JSON.parse(capture.out.join('\n')) as {
      ok: boolean;
      issueCount: number;
      issues: { code: string; path?: string; allowedValues?: string[] }[];
    };
    expect(payload.ok).toBe(false);
    expect(payload.issueCount).toBeGreaterThanOrEqual(2);
    const unknownField = payload.issues.find((issue) => issue.code === 'APPLICATION_UNKNOWN_FIELD');
    expect(unknownField?.path).toContain('t.hi');
    // Enrichment: the surface union of allowed fields is attached.
    expect(unknownField?.allowedValues).toContain('content');
    expect(unknownField?.allowedValues).toContain('rowAction');
    const badRole = payload.issues.find((issue) => issue.code === 'UNKNOWN_SURFACE_ROLE');
    expect(badRole?.allowedValues).toContain('table');
    expect(badRole?.allowedValues).not.toContain('gauge');
  });

  it('invalid definition: human output is stderr with a remediation line', async () => {
    const file = writeDefinition('broken-human.ts', BROKEN);
    const capture = io();
    const code = await runCheckCommand([file], capture);
    expect(code).toBe(4);
    expect(capture.err.join('\n')).toContain('INVALID');
    expect(capture.err.join('\n')).toContain('Exit code 4');
  });

  it('machine-readable output is byte-stable across runs', async () => {
    const file = writeDefinition('stable.ts', BROKEN);
    const a = io();
    const b = io();
    await runCheckCommand([file, '--json'], a);
    await runCheckCommand([file, '--json'], b);
    expect(a.out.join('\n')).toBe(b.out.join('\n'));
    // Paths are relative to cwd in the payload, but stable within a cwd.
    expect(a.out.join('\n')).toContain('"ok": false');
  });

  it('missing file: exit 1 (usage)', async () => {
    const capture = io();
    const code = await runCheckCommand(['Z:/definitely/missing.ts'], capture);
    expect(code).toBe(1);
  });

  it('no positional: exit 1 with usage', async () => {
    const capture = io();
    const code = await runCheckCommand([], capture);
    expect(code).toBe(1);
    expect(capture.err.join('\n')).toContain('Usage: vict check');
  });

  it('module without a recognizable definition export: exit 1 + conventions', async () => {
    const file = writeDefinition('empty.ts', `export const nope = 42;\n`);
    const capture = io();
    const code = await runCheckCommand([file], capture);
    expect(code).toBe(1);
    expect(capture.err.join('\n')).toContain('Export `application`');
  });

  it('accepts a default-exported bare definition', async () => {
    const file = writeDefinition(
      'default.ts',
      `import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
export default defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.check.default', revision: '1', name: 'Default',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [{ id: 's.home', title: 'Home', layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.hi', content: 'Hi' }] }] }],
  views: [], forms: [], actions: [], resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});`,
    );
    const capture = io();
    const code = await runCheckCommand([file, '--json'], capture);
    expect(code).toBe(0);
    expect(JSON.parse(capture.out.join('\n'))['ok']).toBe(true);
  });

  it('accepts the full host input object as default export', async () => {
    const file = writeDefinition(
      'input.ts',
      `import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.check.input', revision: '1', name: 'Input',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [{ id: 's.home', title: 'Home', layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.hi', content: 'Hi' }] }] }],
  views: [], forms: [], actions: [], resources: [],
});
export default { application, resources: [] };`,
    );
    const capture = io();
    const code = await runCheckCommand([file, '--json'], capture);
    expect(code).toBe(0);
  });
});

describe('vict vocabulary', () => {
  it('human output: exit 0 and the role list', async () => {
    const capture = io();
    const code = (await import('@victframework/cli')).runVocabularyCommand([], capture);
    expect(code).toBe(0);
    expect(capture.out.join('\n')).toContain('conversation');
  });

  it('--json matches describeApplicationVocabulary exactly and is byte-stable', async () => {
    const { runVocabularyCommand } = await import('@victframework/cli');
    const capture = io();
    const code = runVocabularyCommand(['--json'], capture);
    expect(code).toBe(0);
    const printed = JSON.parse(capture.out.join('\n'));
    expect(printed).toEqual(JSON.parse(JSON.stringify(describeApplicationVocabulary())));
    const again = io();
    runVocabularyCommand(['--json'], again);
    expect(again.out.join('\n')).toBe(capture.out.join('\n'));
  });
});

describe('operator commands are preserved (no-server subset)', () => {
  it('no command prints usage and exits 1', async () => {
    const capture = io();
    const code = await runVictCli([], capture);
    expect(code).toBe(1);
    expect(capture.out.join('\n')).toContain('Usage: vict');
    expect(capture.out.join('\n')).toContain('check <file>');
  });

  it('unknown command: exit 1', async () => {
    const capture = io();
    const code = await runVictCli(['frobnicate'], capture, {
      endpoint: 'http://127.0.0.1:9',
      token: 'unused',
    });
    expect(code).toBe(1);
    expect(capture.err.join('\n')).toContain("unknown command 'frobnicate'");
  });

  it('operator commands still require endpoint+token before anything else', async () => {
    const capture = io();
    const code = await runVictCli(['whoami'], capture);
    expect(code).toBe(1);
    expect(capture.err.join('\n')).toContain('--endpoint and --token');
  });
});
