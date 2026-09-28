// Focused node-level verification for the coding-agent product proof:
// the neutral definition compiles, the deterministic server serves the
// product routes with scoped data, and the whole session state machine
// (waiting → running → completed / failed → retry → reset) behaves
// exactly as the workspace UI presents it.
import { describe, expect, it } from 'vitest';
import { compileAgentPlan } from '../src/lib/application/agent.js';
import { createAgentServer } from '../src/lib/server/agent-server.js';

describe('agent workspace definition', () => {
  it('compiles into a plan with the product routes, views and registered components', () => {
    const plan = compileAgentPlan();
    expect(plan.applicationId).toBe('app.agent-workspace');
    expect(plan.routes.map((entry) => entry.route.path)).toEqual([
      '/',
      '/agent',
      '/agent/sessions/:id',
    ]);
    expect(plan.components).toEqual([
      { componentId: 'cmp.session-picker', revision: '1' },
      { componentId: 'cmp.session-console', revision: '1' },
      { componentId: 'cmp.output-log', revision: '1' },
    ]);
    for (const actionId of [
      'act.send',
      'act.approve',
      'act.decline',
      'act.advance',
      'act.fail',
      'act.retry',
      'act.reset',
    ]) {
      expect(plan.actions[actionId]).toBeDefined();
    }
    // Product shell choices are declared by the application, never by routes.
    expect((plan.manifest.composition as { navigation?: string }).navigation).toBe('sidebar');
    expect(
      (plan.manifest.composition as { responsive?: { navigationAt?: string } }).responsive
        ?.navigationAt,
    ).toBe('medium');
  });
});

describe('agent workspace routes and scoped data', () => {
  it('serves the declared view data and the session workspace with scoped views', async () => {
    const server = createAgentServer();

    const sessions = await server.loadRoute('/agent');
    expect(sessions).not.toBeNull();

    // The chooser island receives the DECLARED views as props: the host
    // loader collects component-surface view bindings (v.agentSessions /
    // v.agentProjects) alongside direct view surfaces.
    const rows = sessions?.viewData['v.agentSessions']?.rows ?? [];
    expect(rows).toHaveLength(5);
    const statuses = rows.map((row) => row.status);
    for (const expected of ['running', 'completed', 'failed', 'awaiting_approval']) {
      expect(statuses).toContain(expected);
    }
    const projectRows = sessions?.viewData['v.agentProjects']?.rows ?? [];
    expect(projectRows).toHaveLength(3);

    const workspace = await server.loadRoute('/agent/sessions/AGW-101');
    expect(workspace).not.toBeNull();
    expect(workspace?.record).toMatchObject({ id: 'AGW-101', status: 'awaiting_approval' });
    // Every scoped view carries ONLY this session's rows.
    for (const viewId of ['v.agentMessages', 'v.agentFiles', 'v.agentActivity']) {
      const scoped = workspace?.viewData[viewId]?.rows ?? [];
      expect(scoped.length).toBeGreaterThan(0);
      expect(scoped.every((row) => row.sessionId === 'AGW-101')).toBe(true);
    }
    // The output log island receives its session-scoped rows as declared
    // view data (v.agentLog is a component-surface view binding).
    const logRows = workspace?.viewData['v.agentLog']?.rows ?? [];
    expect(logRows.length).toBeGreaterThan(0);
    expect(logRows.every((row) => row.sessionId === 'AGW-101')).toBe(true);

    // Unknown session → structured absence, not a silent fallback.
    const missing = await server.loadRoute('/agent/sessions/NOPE');
    expect(missing).not.toBeNull();
    expect(missing?.record).toBeNull();
  });
});

describe('deterministic session state machine', () => {
  it('rejects messages for a stopped session while retaining the safe failure shape', async () => {
    const server = createAgentServer();
    const result = await server.dispatch('act.send', {
      id: 'AGW-105',
      text: 'Anybody there?',
      author: 'You',
      participant: 'user',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ACTION_FAILED');
    expect(result.message).toContain('failed');
  });

  it('sends a message to a running session and appends the deterministic reply', async () => {
    const server = createAgentServer();
    const count = async (): Promise<number> =>
      (await server.loadRoute('/agent/sessions/AGW-102'))?.viewData['v.agentMessages']?.rows
        ?.length ?? 0;
    const before = await count();
    const result = await server.dispatch('act.send', {
      id: 'AGW-102',
      text: 'How are the edge cases going?',
      author: 'You',
      participant: 'user',
    });
    expect(result.ok).toBe(true);
    const after = await count();
    expect(after - before).toBe(2); // user message + assistant reply
  });

  it('moves a waiting session through approve → advance → completed', async () => {
    const server = createAgentServer();

    const waiting = await server.loadRoute('/agent/sessions/AGW-101');
    expect(waiting?.record?.status).toBe('awaiting_approval');

    const approved = await server.dispatch('act.approve', { id: 'AGW-101' });
    expect(approved.ok).toBe(true);
    let record = (await server.loadRoute('/agent/sessions/AGW-101'))?.record;
    expect(record).toMatchObject({ status: 'running', progress: 45 });

    const advanceAgain = await server.dispatch('act.approve', { id: 'AGW-101' });
    expect(advanceAgain.ok).toBe(false);

    await server.dispatch('act.advance', { id: 'AGW-101' });
    record = (await server.loadRoute('/agent/sessions/AGW-101'))?.record;
    expect(record).toMatchObject({ status: 'running', progress: 70 });

    await server.dispatch('act.advance', { id: 'AGW-101' });
    await server.dispatch('act.advance', { id: 'AGW-101' });
    record = (await server.loadRoute('/agent/sessions/AGW-101'))?.record;
    expect(record).toMatchObject({ status: 'completed', progress: 100 });

    // A completed session no longer accepts steps, failures or messages.
    expect((await server.dispatch('act.advance', { id: 'AGW-101' })).ok).toBe(false);
    expect((await server.dispatch('act.fail', { id: 'AGW-101' })).ok).toBe(false);
    const send = await server.dispatch('act.send', {
      id: 'AGW-101',
      text: 'hello?',
      author: 'You',
      participant: 'user',
    });
    expect(send.ok).toBe(false);
  });

  it('declines a waiting session into a completed state with a visible trail', async () => {
    const server = createAgentServer();
    const declined = await server.dispatch('act.decline', { id: 'AGW-101' });
    expect(declined.ok).toBe(true);
    const record = (await server.loadRoute('/agent/sessions/AGW-101'))?.record;
    expect(record).toMatchObject({ status: 'completed' });
    const activity = (await server.loadRoute('/agent/sessions/AGW-101'))?.viewData[
      'v.agentActivity'
    ]?.rows;
    expect(activity?.some((row) => String(row.summary).toLowerCase().includes('declined'))).toBe(
      true,
    );
  });

  it('fails a running session deterministically and recovers through retry', async () => {
    const server = createAgentServer();

    const failed = await server.dispatch('act.fail', { id: 'AGW-102' });
    expect(failed.ok).toBe(true);
    let record = (await server.loadRoute('/agent/sessions/AGW-102'))?.record;
    expect(record).toMatchObject({ status: 'failed', progress: 55 });
    let logRows =
      (await server.loadRoute('/agent/sessions/AGW-102'))?.viewData['v.agentLog']?.rows ?? [];
    expect(logRows.some((row) => row.level === 'error')).toBe(true);
    expect((await server.dispatch('act.retry', { id: 'AGW-102' })).ok).toBe(true);
    record = (await server.loadRoute('/agent/sessions/AGW-102'))?.record;
    expect(record).toMatchObject({ status: 'running' });
    expect(record?.progress).toBe(55); // progress survives the failure
    logRows =
      (await server.loadRoute('/agent/sessions/AGW-102'))?.viewData['v.agentLog']?.rows ?? [];
    expect(
      logRows.some((row) => String(row.line).includes('retrying from the last checkpoint')),
    ).toBe(true);

    // Retrying a running session is refused with a state-named message.
    const refused = await server.dispatch('act.retry', { id: 'AGW-102' });
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain('running');
  });

  it('advances a running session to completion and finishes cleanly', async () => {
    const server = createAgentServer();
    expect((await server.dispatch('act.advance', { id: 'AGW-103' })).ok).toBe(true);
    expect((await server.dispatch('act.advance', { id: 'AGW-103' })).ok).toBe(true);
    expect((await server.dispatch('act.advance', { id: 'AGW-103' })).ok).toBe(true);
    const record = (await server.loadRoute('/agent/sessions/AGW-103'))?.record;
    expect(record).toMatchObject({ status: 'completed', progress: 100 });
  });

  it('requires a session identity for console ops and rejects unknown ones', async () => {
    const server = createAgentServer();
    const noIdentity = await server.dispatch('act.advance');
    expect(noIdentity.ok).toBe(false);
    expect(noIdentity.code).toBe('DATA_UNKNOWN_IDENTITY');
    const unknown = await server.dispatch('act.advance', { id: 'NOPE' });
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe('DATA_UNKNOWN_IDENTITY');
    const undeclared = await server.dispatch('act.notReal');
    expect(undeclared.code).toBe('UNKNOWN_ACTION');
  });

  it('resets the demo to its exact seed state', async () => {
    const server = createAgentServer();
    await server.dispatch('act.approve', { id: 'AGW-101' });
    await server.dispatch('act.send', {
      id: 'AGW-102',
      text: 'hello',
      author: 'You',
      participant: 'user',
    });
    const sessionsRowsOf = async (): Promise<readonly Record<string, unknown>[]> =>
      (await server.loadRoute('/agent'))?.viewData['v.agentSessions']?.rows ?? [];
    let rows: readonly Record<string, unknown>[] = await sessionsRowsOf();
    expect(rows.find((row) => row.id === 'AGW-101')?.status).toBe('running');

    expect((await server.dispatch('act.reset')).ok).toBe(true);
    rows = await sessionsRowsOf();
    expect(rows).toHaveLength(5);
    expect(rows.find((row) => row.id === 'AGW-101')).toMatchObject({
      status: 'awaiting_approval',
      progress: 40,
    });
    const messages = (await server.loadRoute('/agent/sessions/AGW-102'))?.viewData[
      'v.agentMessages'
    ]?.rows;
    expect(messages).toHaveLength(3);
  });
});
