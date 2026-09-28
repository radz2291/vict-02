import { describe, expect, it } from 'vitest';
import { compileApplication, type CompileApplicationInput } from '../src/index.js';

/**
 * TaskLedger platform-gap contracts (Stage 8 F6 follow-up):
 * - island table cells (versioned component in a declared column, row-derived props);
 * - declared table row actions (dispatch and parameterized navigation);
 * - the @2 `count` surface (view-total aggregate);
 * - declared view filters/sort (plan-driven view loading without app server code).
 */

function fixture() {
  return {
    application: {
      schema: 'vict.application@2',
      id: 'app.gap',
      revision: '1',
      routes: [
        { id: 'home', path: '/', screenId: 'dash' },
        { id: 'tasks', path: '/tasks', screenId: 'tasks' },
        { id: 'task', path: '/tasks/:id', screenId: 'edit' },
      ],
      screens: [
        {
          id: 'dash',
          title: 'Dashboard',
          layout: [
            {
              name: 'main',
              surfaces: [
                { role: 'count', id: 'n.open', viewId: 'v.open', label: 'Open tasks' },
                {
                  role: 'chart',
                  id: 'c.days',
                  viewId: 'v.days',
                  kind: 'bar',
                  xField: 'day',
                  yField: 'qty',
                  summary: 'Completions per day',
                },
              ],
            },
          ],
        },
        {
          id: 'tasks',
          title: 'Tasks',
          layout: [
            {
              name: 'main',
              surfaces: [
                {
                  role: 'table',
                  id: 'tb.tasks',
                  viewId: 'v.tasks',
                  queryActionId: 'act.queryTasks',
                  rowAction: {
                    actionId: 'act.completeTask',
                    label: 'Complete',
                    input: { id: 'id' },
                  },
                  columns: [
                    { field: 'title', label: 'Title', sortable: true },
                    {
                      field: 'priority',
                      label: 'Priority',
                      componentId: 'app.priority-badge',
                      revision: '1',
                      props: { priority: 'priority', label: 'title' },
                    },
                  ],
                  searchFields: ['title'],
                  pageSize: 10,
                },
              ],
            },
          ],
        },
        {
          id: 'edit',
          title: 'Edit task',
          layout: [{ name: 'main', surfaces: [{ role: 'form', id: 'f.edit', formId: 'f.task' }] }],
        },
      ],
      views: [
        {
          viewId: 'v.open',
          resourceId: 'tasks',
          resourceRevision: '1',
          fields: ['id'],
          filters: { status: 'open' },
        },
        {
          viewId: 'v.days',
          resourceId: 'completions',
          resourceRevision: '1',
          fields: ['day', 'qty'],
          sort: [{ field: 'day', direction: 'asc' }],
        },
        {
          viewId: 'v.tasks',
          resourceId: 'tasks',
          resourceRevision: '1',
          fields: ['id', 'title', 'priority', 'status'],
        },
      ],
      forms: [
        {
          formId: 'f.task',
          resourceId: 'tasks',
          resourceRevision: '1',
          inputContractId: 'task.input',
          submitActionId: 'act.saveTask',
          fields: [{ name: 'title', label: 'Title', required: true }],
        },
      ],
      actions: [
        {
          kind: 'query',
          id: 'act.queryTasks',
          revision: '1',
          resourceId: 'tasks',
          resourceRevision: '1',
        },
        {
          kind: 'capability',
          id: 'act.completeTask',
          revision: '1',
          capabilityId: 'task.complete',
          capabilityRevision: '1',
          inputContractId: 'task.complete.input',
          outputContractId: 'task.complete.output',
        },
        {
          kind: 'mutation',
          id: 'act.saveTask',
          revision: '1',
          resourceId: 'tasks',
          resourceRevision: '1',
          op: 'update',
          inputContractId: 'task.input',
        },
        { kind: 'navigation', id: 'act.editTask', revision: '1', routeId: 'task' },
      ],
      resources: [
        { resourceId: 'tasks', revision: '1' },
        { resourceId: 'completions', revision: '1' },
      ],
      components: [{ componentId: 'app.priority-badge', revision: '1' }],
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
          { name: 'priority', type: 'string' },
          { name: 'status', type: 'string' },
        ],
        mutations: [{ op: 'update', effect: 'write', inputContractId: 'task.input' }],
        authorization: { effect: 'read' },
      },
      {
        schema: 'vict.resource@1',
        id: 'completions',
        revision: '1',
        identity: { key: 'id' },
        fields: [
          { name: 'id', type: 'string' },
          { name: 'day', type: 'string' },
          { name: 'qty', type: 'number' },
        ],
        mutations: [{ op: 'create', effect: 'write' }],
        authorization: { effect: 'read' },
      },
    ],
    contracts: [
      { id: 'task.input', revision: '1' },
      { id: 'task.complete.input', revision: '1' },
      { id: 'task.complete.output', revision: '1' },
    ],
    capabilities: [{ id: 'task.complete', revision: '1' }],
    components: [{ componentId: 'app.priority-badge', revision: '1' }],
  };
}

const compile = (input: ReturnType<typeof fixture>) =>
  compileApplication(input as unknown as CompileApplicationInput);

/** Issue codes of a compile result (empty when it compiled). */
function issueCodes(result: ReturnType<typeof compile>): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('island table cells', () => {
  it('compiles a versioned registered component in a declared column', () => {
    const result = compile(fixture());
    expect(result.ok, JSON.stringify(result.ok ? [] : result.issues)).toBe(true);
    if (!result.ok) return;
    const screen = result.plan.screens['tasks']!;
    const table = screen!.layout[0]!.surfaces[0]! as unknown as {
      columns: Record<string, unknown>[];
    };
    expect(table.columns[1]).toMatchObject({
      componentId: 'app.priority-badge',
      revision: '1',
      props: { priority: 'priority', label: 'title' },
    });
  });

  it('rejects an undeclared cell component', () => {
    const input = fixture();
    (input.components as { componentId: string; revision: string }[]).length = 0;
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_COMPONENT_REFERENCE');
  });

  it('rejects a cell component revision mismatch', () => {
    const input = fixture();
    const table = input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
      columns: { componentId: string; revision: string; props: Record<string, string> }[];
    };
    table.columns[1]!.revision = '2';
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('COMPONENT_REVISION_MISMATCH');
  });

  it('rejects a prop source outside the view projection', () => {
    const input = fixture();
    const table = input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
      columns: { componentId: string; revision: string; props: Record<string, string> }[];
    };
    table.columns[1]!.props = { priority: 'notProjected' };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_FIELD');
  });

  it('rejects cell-component members without componentId', () => {
    const input = fixture();
    const table = input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
      columns: { componentId?: string; revision?: string; props?: Record<string, string> }[];
    };
    delete table.columns[1]!.componentId;
    table.columns[1]!.props = { priority: 'priority' };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('INVALID_TABLE_DECLARATION');
  });
});

describe('declared row actions', () => {
  it('compiles a declared row action against a declared action', () => {
    const result = compile(fixture());
    expect(result.ok, JSON.stringify(result.ok ? [] : result.issues)).toBe(true);
    if (!result.ok) return;
    const screen = result.plan.screens['tasks'];
    const table = screen!.layout[0]!.surfaces[0]! as unknown as {
      rowAction: Record<string, unknown>;
    };
    expect(table.rowAction).toMatchObject({
      actionId: 'act.completeTask',
      label: 'Complete',
      input: { id: 'id' },
    });
  });

  it('rejects an undeclared row action', () => {
    const input = fixture();
    (
      input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
        rowAction: { actionId: string; label: string };
      }
    ).rowAction = { actionId: 'act.missing', label: 'Complete' };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_ACTION_REFERENCE');
  });

  it('rejects a row action bound to a local action', () => {
    const input = fixture();
    input.application.actions.push({ kind: 'local', id: 'act.local', revision: '1' } as never);
    (
      input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
        rowAction: { actionId: string; label: string };
      }
    ).rowAction = { actionId: 'act.local', label: 'Reset' };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('INVALID_ACTION_BINDING');
  });

  it('rejects a row action input mapping outside the view projection', () => {
    const input = fixture();
    (
      input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
        rowAction: { actionId: string; label: string; input: Record<string, string> };
      }
    ).rowAction = { actionId: 'act.completeTask', label: 'Complete', input: { id: 'ghost' } };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_FIELD');
  });
});

describe('count surface', () => {
  it('compiles a count surface bound to a declared view', () => {
    const result = compile(fixture());
    expect(result.ok, JSON.stringify(result.ok ? [] : result.issues)).toBe(true);
    if (!result.ok) return;
    const screen = result.plan.screens['dash']!;
    expect(screen!.layout[0]!.surfaces[0]!).toMatchObject({ role: 'count', viewId: 'v.open' });
  });

  it('rejects a count surface bound to an unknown view', () => {
    const input = fixture();
    (
      input.application.screens[0]!.layout[0]!.surfaces[0]! as unknown as { viewId: string }
    ).viewId = 'v.missing';
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_VIEW_REFERENCE');
  });

  it('rejects count in a @1 definition (foundation vocabulary only)', () => {
    const input = fixture();
    const app = input.application as unknown as { schema: string };
    app.schema = 'vict.application@1';
    const result = compile(input);
    expect(result.ok).toBe(false);
  });
});

describe('declared view filters and sort', () => {
  it('compiles declared filters and sort on views', () => {
    const result = compile(fixture());
    expect(result.ok, JSON.stringify(result.ok ? [] : result.issues)).toBe(true);
    if (!result.ok) return;
    expect(result.plan.views['v.open']!).toMatchObject({ filters: { status: 'open' } });
    expect(result.plan.views['v.days']!).toMatchObject({
      sort: [{ field: 'day', direction: 'asc' }],
    });
  });

  it('rejects a filter key outside the resource catalogue', () => {
    const input = fixture();
    (input.application.views[0]! as unknown as { filters: Record<string, string> }).filters = {
      ghost: 'open',
    };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_FIELD');
  });

  it('rejects a non-primitive filter value', () => {
    const input = fixture();
    (input.application.views[0]! as unknown as { filters: Record<string, unknown> }).filters = {
      status: { nested: 'open' },
    };
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('INVALID_VIEW_DECLARATION');
  });

  it('rejects an invalid sort direction', () => {
    const input = fixture();
    (
      input.application.views[1]! as unknown as {
        sort: { field: string; direction: string }[];
      }
    ).sort = [{ field: 'day', direction: 'up' }];
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('INVALID_VIEW_DECLARATION');
  });

  it('rejects a sort field outside the resource catalogue', () => {
    const input = fixture();
    (
      input.application.views[1]! as unknown as {
        sort: { field: string; direction: string }[];
      }
    ).sort = [{ field: 'ghost', direction: 'asc' }];
    const result = compile(input);
    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain('UNKNOWN_FIELD');
  });
});

describe('existing definitions are unaffected', () => {
  it('a definition without the new members compiles with an unchanged identity surface', () => {
    const input = fixture();
    // Strip every new member: no count surface, no rowAction, no island
    // cells, no view filters/sort.
    (input.application.screens[0]!.layout[0]!.surfaces as unknown as Record<string, unknown>[])[0] =
      {
        role: 'text',
        id: 't.open',
        content: 'Open tasks',
        level: 2,
      };
    delete (
      input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as { rowAction?: unknown }
    ).rowAction;
    const table = input.application.screens[1]!.layout[0]!.surfaces[0]! as unknown as {
      columns: { componentId?: string; revision?: string; props?: unknown }[];
    };
    delete table.columns[1]!.componentId;
    delete table.columns[1]!.revision;
    delete table.columns[1]!.props;
    delete (input.application.views[0]! as unknown as { filters?: unknown }).filters;
    delete (input.application.views[1]! as unknown as { sort?: unknown }).sort;
    const result = compile(input);
    expect(result.ok, JSON.stringify(result.ok ? [] : result.issues)).toBe(true);
  });
});
