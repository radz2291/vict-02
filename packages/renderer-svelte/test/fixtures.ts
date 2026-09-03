import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineContract,
  defineResource,
} from '@vict/sdk';
import { compileApplication, type ApplicationPlan } from '@vict/application';
import { createComponentRegistry } from '@vict/application/renderer';
import type { SurfaceRole } from '@vict/sdk';
import Badge from './Badge.svelte';

/**
 * Test fixtures: a contract + resource plus a parametrized @2 application
 * builder so every built-in role can be probed through the REAL compiler.
 */

export const itemInput = defineContract<{ id: string; title: string; status: string; qty: number }>(
  {
    id: 'test.item.input',
    revision: '1',
    expected: '{ id, title, status, qty }',
    parse: (input) => {
      const candidate = input as Record<string, unknown> | null;
      if (
        candidate !== null &&
        typeof candidate === 'object' &&
        typeof candidate.id === 'string' &&
        typeof candidate.title === 'string' &&
        typeof candidate.status === 'string' &&
        typeof candidate.qty === 'number'
      ) {
        return {
          ok: true as const,
          value: {
            id: candidate.id,
            title: candidate.title,
            status: candidate.status,
            qty: candidate.qty,
          },
        };
      }
      return {
        ok: false as const,
        issues: [{ code: 'invalid_type', path: '(root)', message: 'an item is required' }],
      };
    },
  },
);

export const itemResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'items',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string', required: true },
    { name: 'status', type: 'string' },
    { name: 'qty', type: 'number' },
  ],
  queries: { list: { sort: ['title'], pagination: true } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'test.item.input',
      idempotency: 'keyed',
      permissions: ['items.write'],
    },
    { op: 'update', effect: 'write', permissions: ['items.write'] },
  ],
  authorization: { effect: 'read' },
});

export const ROWS: readonly Record<string, unknown>[] = [
  { id: 'i-1', title: 'alpha', status: 'active', qty: 4 },
  { id: 'i-2', title: 'beta', status: 'draft', qty: 2 },
  { id: 'i-3', title: 'gamma', status: 'active', qty: 7 },
];

/** Build a minimal @2 application whose screen carries exactly one surface. */
export function probeApp(
  surface: Record<string, unknown>,
  extra?: {
    readonly views?: readonly unknown[];
    readonly actions?: readonly unknown[];
  },
): ApplicationPlan {
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: 'app.probe',
    revision: '1',
    routes: [{ id: 'home', path: '/', screenId: 's.home' }],
    screens: [
      {
        id: 's.home',
        title: 'Probe',
        layout: [{ name: 'main', surfaces: [surface as never] }],
      },
    ],
    views: (extra?.views as never) ?? [
      {
        viewId: 'v.items',
        resourceId: 'items',
        resourceRevision: '1',
        fields: ['id', 'title', 'status', 'qty'],
      },
    ],
    forms: [
      {
        formId: 'f.item',
        resourceId: 'items',
        resourceRevision: '1',
        inputContractId: 'test.item.input',
        fields: [
          { name: 'id', label: 'Id', required: true, widget: 'text' },
          { name: 'title', label: 'Title', required: true, widget: 'text' },
          { name: 'status', label: 'Status', widget: 'text' },
          { name: 'qty', label: 'Qty', widget: 'number' },
        ],
        submitActionId: 'act.create',
      },
    ],
    actions: (extra?.actions as never) ?? [
      { kind: 'local', id: 'act.local', revision: '1' },
      {
        kind: 'query',
        id: 'act.query',
        revision: '1',
        resourceId: 'items',
        resourceRevision: '1',
      },
      {
        kind: 'mutation',
        id: 'act.create',
        revision: '1',
        resourceId: 'items',
        resourceRevision: '1',
        op: 'create',
        inputContractId: 'test.item.input',
      },
    ],
    resources: [{ resourceId: 'items', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: [{ id: 'test.item.input', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`probe plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

/** A role-by-role surface table for probe plans. */
export function surfaceForRole(role: SurfaceRole): Record<string, unknown> {
  switch (role) {
    case 'text':
      return { role: 'text', id: 'x', content: 'Hello renderer' };
    case 'view':
      return { role: 'view', id: 'x', viewId: 'v.items' };
    case 'form':
      return {
        role: 'form',
        id: 'x',
        formId: 'f.item',
      };
    case 'action':
      return { role: 'action', id: 'x', actionId: 'act.local', label: 'Do it' };
    case 'component':
      return { role: 'component', id: 'x', componentId: 'cmp.badge', revision: '1' };
    case 'states':
      return { role: 'states', id: 'x', viewId: 'v.items' };
    case 'list':
      return {
        role: 'list',
        id: 'x',
        viewId: 'v.items',
        titleField: 'title',
        secondaryField: 'status',
      };
    case 'table':
      return {
        role: 'table',
        id: 'x',
        viewId: 'v.items',
        queryActionId: 'act.query',
        searchFields: ['title'],
        pageSize: 2,
      };
    case 'detail':
      return { role: 'detail', id: 'x', viewId: 'v.items', fields: ['id', 'title'] };
    case 'chart':
      return {
        role: 'chart',
        id: 'x',
        viewId: 'v.items',
        kind: 'bar',
        xField: 'status',
        yField: 'qty',
        summary: 'Quantity per status',
      };
    case 'status':
      return {
        role: 'status',
        id: 'x',
        value: 'active',
        tones: { active: 'success' },
      };
    case 'tabs':
      return {
        role: 'tabs',
        id: 'x',
        tabs: [
          {
            name: 'one',
            label: 'One',
            surfaces: [{ role: 'text', id: 'x-1', content: 'Tab one' }],
          },
          {
            name: 'two',
            label: 'Two',
            surfaces: [{ role: 'text', id: 'x-2', content: 'Tab two' }],
          },
        ],
      };
    case 'dialog':
      return {
        role: 'dialog',
        id: 'x',
        title: 'Confirm',
        triggerLabel: 'Open dialog',
        content: [{ role: 'text', id: 'x-3', content: 'Dialog body' }],
      };
    case 'drawer':
      return {
        role: 'drawer',
        id: 'x',
        title: 'Details',
        triggerLabel: 'Open drawer',
        content: [{ role: 'text', id: 'x-4', content: 'Drawer body' }],
      };
    case 'conversation':
      return {
        role: 'conversation',
        id: 'x',
        viewId: 'v.items',
        messageField: 'title',
        authorField: 'id',
        participantField: 'status',
        sendActionId: 'act.create',
        inputLabel: 'Message',
      };
    default:
      throw new Error(`no probe surface for role ${role}`);
  }
}

/** A full application form binding for form probes. */
export function probeAppWithForm(): ApplicationPlan {
  return probeApp(
    { role: 'form', id: 'x', formId: 'f.item' },
    {
      views: [
        {
          viewId: 'v.items',
          resourceId: 'items',
          resourceRevision: '1',
          fields: ['id', 'title', 'status', 'qty'],
        },
      ],
    },
  );
}

export function testRegistry(): ReturnType<typeof createComponentRegistry> {
  const registry = createComponentRegistry('registry.test', '1');
  registry.register({ componentId: 'cmp.badge', revision: '1', implementation: Badge });
  return registry;
}

export const viewRowsFixture = true;
