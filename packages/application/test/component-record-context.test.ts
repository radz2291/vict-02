import { describe, expect, it } from 'vitest';
import { compileApplication, type CompileApplicationInput } from '../src/index.js';

/**
 * Declared record context for component surfaces (UI reconciliation slice):
 * - component-surface props may bind to the route parameter, the route
 *   record's fields, or a declared view's rows (closed ComponentSource
 *   vocabulary — never expressions or executable code);
 * - component surfaces may declare action-input bindings (`input`) so an
 *   island dispatching a record-operating action never inspects URLs;
 * - unknown sources, unknown route parameters, undeclared views and
 *   unknown record fields are rejected at compile time.
 */

function fixture(componentSurface: Record<string, unknown>) {
  return {
    application: {
      schema: 'vict.application@2',
      id: 'app.record-context',
      revision: '1',
      routes: [
        { id: 'home', path: '/', screenId: 'list' },
        { id: 'task', path: '/tasks/:id', screenId: 'detail' },
      ],
      screens: [
        {
          id: 'list',
          title: 'Tasks',
          layout: [{ name: 'main', surfaces: [{ role: 'view', id: 'n.list', viewId: 'v.tasks' }] }],
        },
        {
          id: 'detail',
          title: 'Task detail',
          layout: [{ name: 'main', surfaces: [componentSurface] }],
        },
      ],
      views: [
        {
          viewId: 'v.tasks',
          resourceId: 'tasks',
          resourceRevision: '1',
          fields: ['id', 'title'],
        },
        {
          viewId: 'v.log',
          resourceId: 'tasks',
          resourceRevision: '1',
          fields: ['id', 'title'],
        },
      ],
      actions: [
        {
          kind: 'mutation',
          id: 'act.completeTask',
          revision: '1',
          resourceId: 'tasks',
          resourceRevision: '1',
          op: 'update',
          inputContractId: 'task.input',
        },
      ],
      resources: [{ resourceId: 'tasks', revision: '1' }],
      components: [{ componentId: 'app.console', revision: '1' }],
    },
    resources: [
      {
        schema: 'vict.resource@1',
        id: 'tasks',
        revision: '1',
        identity: { key: 'id' },
        fields: [
          { name: 'id', type: 'string' },
          { name: 'title', type: 'string' },
          { name: 'status', type: 'string' },
        ],
        mutations: [{ op: 'update', effect: 'write', inputContractId: 'task.input' }],
        authorization: { effect: 'read' },
      },
    ],
    contracts: [{ id: 'task.input', revision: '1' }],
    capabilities: [],
    components: [{ componentId: 'app.console', revision: '1' }],
  };
}

const compile = (input: ReturnType<typeof fixture>) =>
  compileApplication(input as unknown as CompileApplicationInput);

function issuesFor(result: ReturnType<typeof compile>): { code: string; path?: string }[] {
  return result.ok ? [] : result.issues.map((issue) => ({ code: issue.code, path: issue.path }));
}

describe('component-surface declared record context', () => {
  it('compiles param, record-field and view-row bindings plus an action-input binding', () => {
    const result = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: {
          kind: 'console',
          taskId: { param: 'id' },
          status: { record: 'status' },
          rows: { view: 'v.log' },
        },
        input: { id: { param: 'id' } },
      }),
    );
    expect(result.ok).toBe(true);
    // The plan keeps the declared bindings verbatim for the renderer.
    const surface = (
      result as unknown as {
        plan: { screens: Record<string, { layout: { surfaces: Record<string, unknown>[] }[] }> };
      }
    ).plan.screens['detail']!.layout[0]!.surfaces[0]!;
    expect(surface['input']).toEqual({ id: { param: 'id' } });
    expect(surface['props']).toMatchObject({
      taskId: { param: 'id' },
      status: { record: 'status' },
    });
  });

  it('rejects an unknown source shape (expressions are not part of the vocabulary)', () => {
    const result = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { expr: { expr: '1 + 1' } },
      }),
    );
    expect(issuesFor(result)).toContainEqual({
      code: 'INVALID_COMPONENT_SOURCE',
      path: "application.screens[detail] (surface 'task.console').props.expr",
    });
  });

  it('rejects a multi-member source object and an unknown source kind', () => {
    const multi = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { x: { param: 'id', record: 'status' } },
      }),
    );
    expect(issuesFor(multi).map((issue) => issue.code)).toContain('INVALID_COMPONENT_SOURCE');
    const unknownKind = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { x: { route: 'id' } },
      }),
    );
    expect(issuesFor(unknownKind).map((issue) => issue.code)).toContain('INVALID_COMPONENT_SOURCE');
  });

  it('rejects a route parameter no declared route declares', () => {
    const result = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { x: { param: 'taskRef' } },
      }),
    );
    expect(issuesFor(result)).toContainEqual({
      code: 'INVALID_COMPONENT_SOURCE',
      path: "application.screens[detail] (surface 'task.console').props.x",
    });
  });

  it('rejects an undeclared view and an unknown record field', () => {
    const view = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { rows: { view: 'v.nope' } },
      }),
    );
    expect(issuesFor(view).map((issue) => issue.code)).toContain('UNKNOWN_VIEW_REFERENCE');
    const field = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { x: { record: 'priority' } },
      }),
    );
    expect(issuesFor(field).map((issue) => issue.code)).toContain('UNKNOWN_FIELD');
  });

  it('rejects an input binding that is not a closed source map', () => {
    const result = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        input: { id: 'hardcoded-string' },
      }),
    );
    expect(issuesFor(result).map((issue) => issue.code)).toContain('INVALID_COMPONENT_SOURCE');
  });

  it('static scalar props keep their literal meaning (unchanged @2 contract)', () => {
    const result = compile(
      fixture({
        role: 'component',
        id: 'task.console',
        componentId: 'app.console',
        revision: '1',
        props: { kind: 'console', level: 3, verbose: true },
      }),
    );
    expect(result.ok).toBe(true);
  });
});
