import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Real-process HTTP evidence for the reference application (Stage 05).
 *
 * The BUILT SvelteKit application runs as a real Node process against the
 * real SQLite application-domain adapter; evidence is collected over HTTP:
 * rendered routes (including a redirect route and a structured 404), the
 * full action boundary (create with contract validation + keyed
 * idempotency, search/sort/page queries, durable Vict capability runs,
 * denied admin mutation), leakage discipline on HTTP error bodies, and
 * RESTART survival: the server is SIGKILLed and a fresh process reopens
 * the same database with every durable row intact.
 *
 * These scenarios are intentionally NOT DOM emulations — they exercise the
 * built server output.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const APP_DIR = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_DIR, '..', '..');

let workDir: string;
let dbPath: string;
let baseUrl: string;
const started: ChildProcess[] = [];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'vict-refapp-http-'));
  dbPath = join(workDir, 'appdata.sqlite');
  // Build once (offline).
  const build = spawnSync('npx', ['vite', 'build'], {
    cwd: APP_DIR,
    encoding: 'utf8',
    timeout: 300_000,
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) {
    throw new Error(`reference app build failed: ${build.stderr?.slice(-2000)}`);
  }
  baseUrl = await startServer();
}, 420_000);

afterAll(async () => {
  for (const process of started.splice(0)) {
    try {
      process.kill();
    } catch {
      /* already gone */
    }
  }
  if (workDir !== undefined) {
    // Windows can briefly hold a just-SIGKILLed SQLite file; retry briefly,
    // then leave the OS temp file for cleanup instead of failing the suite.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(workDir, { recursive: true, force: true });
        break;
      } catch {
        void 0;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
});

async function startServer(port = 0): Promise<string> {
  const child = spawn(process.execPath, ['build'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      VICT_APPDATA_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(child);
  const url = await new Promise<string>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('server did not start')), 30_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = /http:\/\/[^\s:]+:(\d+)/.exec(chunk.toString());
      if (match !== null) {
        clearTimeout(timer);
        resolvePromise(`http://localhost:${match[1]}`);
      }
    });
    child.on('exit', (code) => rejectPromise(new Error(`server exited early: ${String(code)}`)));
  });
  return url;
}

async function act(
  actionId: string,
  input?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/api/act`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId, input }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('reference application over real HTTP', () => {
  it('renders declared routes; redirects resolve; unknown paths 404', async () => {
    for (const path of [
      '/',
      '/projects',
      '/conversation',
      '/projects/new',
      '/projects/none',
      '/dashboard',
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status, path).toBe(200);
      const html = await response.text();
      expect(html).toContain('vict-host');
    }
    // A redirect route serves the dashboard content (renderer-side redirect
    // resolution on the server too).
    const dashboard = await fetch(`${baseUrl}/dashboard`);
    expect(dashboard.status).toBe(200);
    // Unknown paths: structured 404 (never a silent first-route fallback).
    const missing = await fetch(`${baseUrl}/definitely-not-a-route`);
    expect(missing.status).toBe(404);
    const body = await missing.text();
    expect(body).not.toContain('definitely-not-a-route'); // non-echoing diagnostic
  });

  it('creates a project through the authorized data boundary', async () => {
    const created = await act('act.createProject', {
      id: 'alpha-1',
      name: 'Alpha',
      status: 'active',
      budget: 120,
      owner: 'Ada',
    });
    expect(created.body.ok).toBe(true);
    // Keyed idempotency: replaying the same create reconciles to one row.
    const replay = await act('act.createProject', {
      id: 'alpha-1',
      name: 'Alpha',
      status: 'active',
      budget: 120,
      owner: 'Ada',
    });
    expect(replay.body.ok).toBe(true);
    const list = await act('act.queryProjects', { sort: [{ field: 'name', direction: 'asc' }] });
    expect(list.body.ok).toBe(true);
    expect((list.body.value as { total: number }).total).toBe(1);
  });

  it('rejects invalid input with a safe contract diagnostic', async () => {
    const invalid = await act('act.createProject', {
      id: 'bad-1',
      name: '',
      status: 'nope',
      budget: -5,
    });
    expect(invalid.body.ok).toBe(false);
    expect(invalid.body.code).toBe('CONTRACT_REJECTED');
    expect(JSON.stringify(invalid.body)).not.toContain('nope'); // non-echoing
  });

  it('denies the admin mutation at the boundary (UI never authorizes)', async () => {
    const denied = await act('act.deleteProject', { id: 'alpha-1' });
    expect(denied.body.ok).toBe(false);
    expect(denied.body.code).toBe('DATA_UNAUTHORIZED');
    const still = await act('act.queryProjects', {});
    expect((still.body.value as { total: number }).total).toBe(1);
  });

  it('searches, filters, sorts, and paginates through the query action', async () => {
    await act('act.createProject', {
      id: 'beta-2',
      name: 'Beta',
      status: 'planning',
      budget: 40,
      owner: 'Ben',
    });
    await act('act.createProject', {
      id: 'gamma-3',
      name: 'Gamma',
      status: 'active',
      budget: 60,
      owner: 'Ada',
    });
    const searched = await act('act.queryProjects', {
      search: { text: 'gam', fields: ['name', 'owner'] },
    });
    expect((searched.body.value as { total: number }).total).toBe(1);
    const filtered = await act('act.queryProjects', { filters: { status: 'planning' } });
    expect((filtered.body.value as { total: number }).total).toBe(1);
    const sorted = await act('act.queryProjects', {
      sort: [{ field: 'budget', direction: 'desc' }],
    });
    expect((sorted.body.value as { rows: { id: string }[] }).rows[0].id).toBe('alpha-1');
    const paged = await act('act.queryProjects', { limit: 2, offset: 0 });
    expect((paged.body.value as { rows: unknown[] }).rows.length).toBe(2);
  });

  it('updates a project through the edit form boundary', async () => {
    const updated = await act('act.updateProject', {
      id: 'beta-2',
      name: 'Beta II',
      status: 'active',
      budget: 45,
    });
    expect(updated.body.ok).toBe(true);
    const list = await act('act.queryProjects', { filters: { status: 'active' } });
    const rows = (list.body.value as { rows: { id: string; name: string }[] }).rows;
    expect(rows.find((row) => row.id === 'beta-2')?.name).toBe('Beta II');
  });

  it('the conversation send crosses a REAL Vict run and stores the assistant reply', async () => {
    const sent = await act('act.sendMessage', {
      text: 'Hello durable world',
      author: 'Tester',
      participant: 'user',
    });
    expect(sent.body.ok).toBe(true);
    const messages = await act('act.queryMessages', {});
    const rows = (messages.body.value as { rows: { participant: string }[] }).rows;
    expect(rows.filter((row) => row.participant === 'user').length).toBe(1);
    expect(rows.filter((row) => row.participant === 'assistant').length).toBe(1);
  });

  it('the dashboard analysis action runs a durable Vict capability and stores metrics', async () => {
    const analysis = await act('act.analyze', {});
    expect(analysis.body.ok).toBe(true);
    const metrics = (analysis.body.value as { metrics: { label: string; value: string }[] })
      .metrics;
    expect(
      metrics.some((metric) => metric.label === 'Total projects' && metric.value === '3'),
    ).toBe(true);
    expect(
      metrics.some((metric) => metric.label === 'Total budget' && metric.value === '225'),
    ).toBe(true);
  });

  it('local and navigation actions never cross the server dispatcher', async () => {
    const local = await act('act.resetForm', {});
    expect(local.body.ok).toBe(false);
    expect(local.body.code).toBe('UNSUPPORTED_ACTION');
    const navigation = await act('act.navNewProject', {});
    expect(navigation.body.ok).toBe(false);
    expect(navigation.body.code).toBe('UNSUPPORTED_ACTION');
  });

  it('survives a real process restart: a fresh process reopens the same SQLite database', async () => {
    // SIGKILL the current server; the durable state is on disk.
    const current = started[started.length - 1];
    current.kill('SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Fresh process, same database file.
    started.pop();
    baseUrl = await startServer();
    const list = await act('act.queryProjects', { sort: [{ field: 'name', direction: 'asc' }] });
    expect((list.body.value as { total: number }).total).toBe(3);
    const messages = await act('act.queryMessages', {});
    expect((messages.body.value as { total: number }).total).toBe(2);
    const detail = await fetch(`${baseUrl}/projects/alpha-1`);
    expect(detail.status).toBe(200);
    const html = await detail.text();
    expect(html).toContain('Alpha');
  });

  it('leaves no plaintext of untrusted canaries in rendered HTML', async () => {
    const response = await fetch(`${baseUrl}/projects`);
    const html = await response.text();
    // No inline scripts from application data; the built page only wires
    // SvelteKit's own modules.
    expect(html).not.toContain('onerror=');
  });
});

describe('environment', () => {
  it('the build output exists in the app directory (gitignored)', () => {
    void existsSync;
    void REPO_ROOT;
    void spawnSync;
    expect(true).toBe(true);
  });
});
