/**
 * QA harness application definition (P3 browser verification).
 *
 * A small real @2 application — compiled through the REAL SDK compiler —
 * that exercises every P3-migrated interaction the shipped reference app
 * does not declare: date, json, and boolean widgets; optional numeric
 * fields; forms inside dialogs and drawers; long-label tabs; disabled and
 * denied actions; and a nested overlay through the existing recursion path.
 *
 * Compiled once in Node (scripts/emit-plan.mts) into src/plan.json; the
 * harness page feeds the plan to the generic VitApp host exactly like the
 * reference app does.
 */
import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  defineApplication,
  defineContract,
  defineResource,
  RESOURCE_DEFINITION_SCHEMA,
} from '@victframework/sdk';
import { compileApplication, type ApplicationPlan } from '@victframework/application';

function failContract(message: string) {
  return {
    ok: false as const,
    issues: [{ code: 'invalid_value', path: '(root)', message }],
  };
}

/**
 * The widget form's boundary contract. Numbers must arrive as NUMBERS —
 * a stringy number is rejected — so any renderer value-model regression
 * (NaN, '', '12.5') becomes a visible structured rejection in the
 * harness dispatch log instead of a silent success.
 */
export const widgetInputContract = defineContract<{
  id?: string;
  name: string;
  starts?: string;
  config?: string;
  budget: number;
  discount?: number;
  active?: boolean;
}>({
  id: 'qa.widget.input',
  revision: '1',
  expected: '{ id?, name, starts?, config?, budget, discount?, active? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a widget record is required');
    }
    if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
      return failContract('name is required');
    }
    if (typeof candidate.budget !== 'number' || !Number.isFinite(candidate.budget)) {
      return failContract('budget must be a finite NUMBER (renderer sent a non-number)');
    }
    if (
      candidate.discount !== undefined &&
      (typeof candidate.discount !== 'number' || !Number.isFinite(candidate.discount))
    ) {
      return failContract('discount must be a finite NUMBER when present');
    }
    if (candidate.active !== undefined && typeof candidate.active !== 'boolean') {
      return failContract('active must be a boolean when present');
    }
    for (const key of ['starts', 'config'] as const) {
      const value = candidate[key];
      if (value !== undefined && typeof value !== 'string') {
        return failContract(`${key} must be a string when present`);
      }
    }
    if (candidate.id !== undefined && typeof candidate.id !== 'string') {
      return failContract('id must be a string when present');
    }
    return {
      ok: true as const,
      value: {
        ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}),
        name: candidate.name,
        ...(candidate.starts !== undefined ? { starts: candidate.starts } : {}),
        ...(candidate.config !== undefined ? { config: candidate.config } : {}),
        budget: candidate.budget,
        ...(candidate.discount !== undefined ? { discount: candidate.discount } : {}),
        ...(candidate.active !== undefined ? { active: candidate.active } : {}),
      },
    };
  },
});

const widgetFields = [
  { name: 'id', type: 'string', required: true },
  { name: 'name', type: 'string', required: true },
  { name: 'status', type: 'string' },
  { name: 'starts', type: 'string' },
  { name: 'config', type: 'string' },
  { name: 'budget', type: 'number' },
  { name: 'discount', type: 'number' },
  { name: 'active', type: 'boolean' },
] as const;

export const widgetResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'widgets',
  revision: '1',
  identity: { key: 'id' },
  fields: widgetFields,
  queries: { list: { sort: ['name'], pagination: false } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'qa.widget.input',
      idempotency: 'keyed',
      permissions: ['widgets.write'],
    },
    { op: 'update', effect: 'write', permissions: ['widgets.write'] },
    { op: 'delete', effect: 'write', permissions: ['widgets.admin'] },
  ],
  authorization: { effect: 'read' },
});

const widgetUiFields = [
  { name: 'id', label: 'Identifier', required: true, widget: 'text' },
  { name: 'name', label: 'Name', required: true, widget: 'text' },
  { name: 'starts', label: 'Starts on', widget: 'date' },
  { name: 'config', label: 'Config (JSON)', widget: 'json' },
  { name: 'budget', label: 'Budget', required: true, widget: 'number' },
  { name: 'discount', label: 'Discount (optional)', widget: 'number' },
  { name: 'active', label: 'Active', widget: 'boolean' },
] as const;

export const qaApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.qa.p3',
  revision: '1',
  routes: [
    { id: 'widgets', path: '/widgets', screenId: 's.widgets', nav: { label: 'Widgets', group: 'Data', order: 1 } },
    { id: 'widget-detail', path: '/rec/:id', screenId: 's.rec' },
    { id: 'tones', path: '/tones', screenId: 's.tones', nav: { label: 'Status tones', group: 'Checks', order: 2 } },
    { id: 'actions', path: '/actions', screenId: 's.actions', nav: { label: 'Actions & feedback', group: 'Checks', order: 3 } },
    { id: 'longtabs', path: '/longtabs', screenId: 's.longtabs', nav: { label: 'Long tabs', group: 'Checks', order: 4 } },
  ],
  screens: [
    {
      id: 's.widgets',
      title: 'Widget create form',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'form', id: 'fm.widget-create', formId: 'f.widget-create' },
            { role: 'action', id: 'act.reset-widgets-btn', actionId: 'act.resetForm', label: 'Clear form (local)' },
          ],
        },
      ],
    },
    {
      id: 's.rec',
      title: 'Widget record',
      breadcrumbs: [
        { label: 'Widgets', routeId: 'widgets' },
        { label: 'Record' },
      ],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'status', id: 'st.rec-status', field: 'status', tones: { cold: 'info', warm: 'success', hot: 'danger', hold: 'warning' } },
            {
              role: 'tabs',
              id: 'tb.rec-tabs',
              tabs: [
                {
                  name: 'overview',
                  label: 'Overview',
                  surfaces: [
                    { role: 'detail', id: 'dt.rec', viewId: 'v.widgetDetail', emptyMessage: 'This record does not exist.' },
                    { role: 'list', id: 'ls.related', viewId: 'v.related', titleField: 'name', secondaryField: 'status', emptyMessage: 'Nothing derived yet.' },
                  ],
                },
                {
                  name: 'edit',
                  label: 'Edit',
                  surfaces: [
                    { role: 'form', id: 'fm.widget-edit', formId: 'f.widget-edit' },
                    { role: 'action', id: 'act.reset-edit-btn', actionId: 'act.resetForm', label: 'Reset form (local)' },
                  ],
                },
              ],
            },
            {
              role: 'dialog',
              id: 'dlg.rec',
              title: 'Danger zone',
              triggerLabel: 'Danger zone…',
              content: [
                { role: 'text', id: 't.danger-note', content: 'Deleting is denied by the authorization boundary for every principal.' },
                { role: 'action', id: 'act.delete-denied-btn', actionId: 'act.delete-denied', label: 'Delete record' },
                // A form inside a dialog (overlay form path).
                { role: 'form', id: 'fm.rename', formId: 'f.rename' },
              ],
            },
            {
              role: 'drawer',
              id: 'dr.rec',
              title: 'Adjust record',
              triggerLabel: 'Adjust…',
              content: [
                { role: 'text', id: 't.adjust-note', content: 'A successful adjustment invalidates route data and closes the loop.' },
                { role: 'form', id: 'fm.adjust', formId: 'f.adjust' },
                {
                  // Nested overlay through the existing recursion path:
                  // a dialog INSIDE a drawer's content.
                  role: 'dialog',
                  id: 'dlg.nested',
                  title: 'Nested confirm',
                  triggerLabel: 'Nested confirm…',
                  content: [
                    { role: 'text', id: 't.nested-note', content: 'This dialog is nested inside the drawer surface.' },
                    { role: 'action', id: 'act.bump-nested-btn', actionId: 'act.bump', label: 'Bump revision (nested)' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's.tones',
      title: 'Status tones',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'status', id: 'st.neutral', value: 'draft', tones: {} },
            { role: 'status', id: 'st.success', value: 'warm', tones: { warm: 'success' } },
            { role: 'status', id: 'st.warning', value: 'hold', tones: { hold: 'warning' } },
            { role: 'status', id: 'st.danger', value: 'hot', tones: { hot: 'danger' } },
            { role: 'status', id: 'st.info', value: 'cold', tones: { cold: 'info' } },
          ],
        },
      ],
    },
    {
      id: 's.actions',
      title: 'Actions & feedback',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'action', id: 'act.primary-btn', actionId: 'act.bump', label: 'Bump revision' },
            { role: 'action', id: 'act.reset-feedback-btn', actionId: 'act.resetForm', label: 'Clear form (local)' },
            { role: 'action', id: 'act.delete-btn', actionId: 'act.delete-denied', label: 'Delete record' },
            { role: 'action', id: 'act.disabled-btn', actionId: 'act.bump', label: 'Disabled action', disabledWhen: { paramMissing: 'never-present' } },
            { role: 'list', id: 'ls.empty', viewId: 'v.none', titleField: 'name', emptyMessage: 'Nothing here yet.' },
            { role: 'detail', id: 'dt.empty', viewId: 'v.none', emptyMessage: 'This record does not exist.' },
          ],
        },
      ],
      states: {
        failure: { role: 'text', id: 't.actions-failure', content: 'The adjustment failed safely.' },
      },
    },
    {
      id: 's.longtabs',
      title: 'Long-label tabs',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'tabs',
              id: 'tb.long',
              tabs: [
                { name: 'configuration-overview', label: 'Configuration overview and defaults', surfaces: [{ role: 'text', id: 't.long-a', content: 'First long tab panel.' }] },
                { name: 'advanced-maintenance', label: 'Advanced maintenance operations queue', surfaces: [{ role: 'text', id: 't.long-b', content: 'Second long tab panel.' }] },
                { name: 'audit-history', label: 'Audit history and retained evidence trail', surfaces: [{ role: 'text', id: 't.long-c', content: 'Third long tab panel.' }] },
              ],
            },
          ],
        },
      ],
    },
  ],
  views: [
    { viewId: 'v.widgetDetail', resourceId: 'widgets', resourceRevision: '1', fields: ['id', 'name', 'status', 'starts', 'config', 'budget', 'discount', 'active'] },
    { viewId: 'v.related', resourceId: 'widgets', resourceRevision: '1', fields: ['id', 'name', 'status'] },
    { viewId: 'v.none', resourceId: 'widgets', resourceRevision: '1', fields: ['id', 'name'] },
  ],
  forms: [
    {
      formId: 'f.widget-create',
      resourceId: 'widgets',
      resourceRevision: '1',
      inputContractId: 'qa.widget.input',
      fields: widgetUiFields,
      submitActionId: 'act.saveWidget',
    },
    {
      formId: 'f.widget-edit',
      resourceId: 'widgets',
      resourceRevision: '1',
      inputContractId: 'qa.widget.input',
      fields: widgetUiFields.filter((f) => f.name !== 'id'),
      submitActionId: 'act.saveWidget',
    },
    {
      formId: 'f.rename',
      resourceId: 'widgets',
      resourceRevision: '1',
      inputContractId: 'qa.widget.input',
      fields: [{ name: 'name', label: 'Rename record', required: true, widget: 'text' }],
      submitActionId: 'act.saveWidget',
    },
    {
      formId: 'f.adjust',
      resourceId: 'widgets',
      resourceRevision: '1',
      inputContractId: 'qa.widget.input',
      fields: [
        { name: 'discount', label: 'Discount (optional)', widget: 'number' },
        { name: 'active', label: 'Active', widget: 'boolean' },
      ],
      submitActionId: 'act.saveWidget',
    },
  ],
  resources: [{ resourceId: 'widgets', revision: '1' }],
  actions: [
    { kind: 'local', id: 'act.resetForm', revision: '1' },
    { kind: 'navigation', id: 'act.goNew', revision: '1', routeId: 'widgets' },
    {
      kind: 'mutation', id: 'act.saveWidget', revision: '1',
      resourceId: 'widgets', resourceRevision: '1', op: 'create',
      inputContractId: 'qa.widget.input', inputContractRevision: '1',
    },
    {
      kind: 'mutation', id: 'act.delete-denied', revision: '1',
      resourceId: 'widgets', resourceRevision: '1', op: 'delete',
      inputContractId: 'qa.widget.input',
    },
    {
      kind: 'mutation', id: 'act.bump', revision: '1',
      resourceId: 'widgets', resourceRevision: '1', op: 'update',
      inputContractId: 'qa.widget.input',
    },
  ],
} as const);

/** Compile the harness definition through the real compiler. */
export function compileQaPlan(): ApplicationPlan {
  const result = compileApplication({
    application: qaApplication,
    resources: [widgetResource],
    contracts: [{ id: 'qa.widget.input', revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`qa definition invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}
