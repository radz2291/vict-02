import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineContract,
  defineResource,
} from '@vict/sdk';
import { compileApplication } from '@vict/application';
import type { ApplicationPlan } from '@vict/application';

/**
 * The ENTIRE reference application surface, described neutrally (Stage 05).
 *
 * This module contains no Svelte, no SQLite, and no renderer code: it is
 * the framework-neutral Application Definition plus its resource/contract
 * bindings, compiled into an immutable Application Plan. The generic host
 * renders whatever this definition declares — there are no hand-authored
 * routes or page shells for any declared screen.
 *
 * Schema marker: `vict.application@2` — the Stage 05 delivery vocabulary.
 * `vict.application@1` definitions keep their exact Stage 04 semantics and
 * identity vectors; the schema marker is part of application identity.
 */

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

const PROJECT_STATUSES = ['planning', 'active', 'paused', 'done'] as const;

export const projectInputContract = defineContract<{
  id?: string;
  name: string;
  status: string;
  budget: number;
}>({
  id: 'refapp.project.input',
  revision: '1',
  expected: '{ id?, name, status, budget }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a project record is required');
    }
    const name = candidate.name;
    const status = candidate.status;
    const budget = candidate.budget;
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      return failContract('name is required (1-120 characters)');
    }
    if (typeof status !== 'string' || !PROJECT_STATUSES.includes(status as never)) {
      return failContract('status must be one of: planning, active, paused, done');
    }
    if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
      return failContract('budget must be a non-negative finite number');
    }
    const id = candidate.id;
    if (id !== undefined && (typeof id !== 'string' || id.trim().length === 0)) {
      return failContract('id must be a non-empty string when present');
    }
    return {
      ok: true as const,
      value: {
        ...(typeof id === 'string' ? { id } : {}),
        name,
        status,
        budget,
      },
    };
  },
});

function failContract(message: string): {
  ok: false;
  issues: { code: string; path: string; message: string }[];
} {
  return { ok: false as const, issues: [{ code: 'invalid_value', path: '(root)', message }] };
}

export const messageInputContract = defineContract<{
  id: string;
  text: string;
  author: string;
  participant: string;
}>({
  id: 'refapp.message.input',
  revision: '1',
  expected: '{ id, text, author, participant }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a message record is required');
    }
    const text = candidate.text;
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 2000) {
      return failContract('text is required (1-2000 characters)');
    }
    const id = candidate.id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      return failContract('id is required');
    }
    const author =
      typeof candidate.author === 'string' && candidate.author.length > 0
        ? candidate.author
        : 'You';
    const participant = candidate.participant === 'assistant' ? 'assistant' : 'user';
    return { ok: true as const, value: { id, text, author, participant } };
  },
});

export const analyzeInputContract = defineContract<{
  projectCount: number;
  activeCount: number;
  totalBudget: number;
}>({
  id: 'refapp.analyze.input',
  revision: '1',
  expected: '{ projectCount, activeCount, totalBudget }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.projectCount === 'number' &&
      Number.isFinite(candidate.projectCount) &&
      typeof candidate.activeCount === 'number' &&
      Number.isFinite(candidate.activeCount) &&
      typeof candidate.totalBudget === 'number' &&
      Number.isFinite(candidate.totalBudget)
    ) {
      return {
        ok: true as const,
        value: {
          projectCount: candidate.projectCount,
          activeCount: candidate.activeCount,
          totalBudget: candidate.totalBudget,
        },
      };
    }
    return failContract('an analysis input with finite counts is required');
  },
});

export const analyzeOutputContract = defineContract<{
  metrics: { id: string; label: string; value: string }[];
}>({
  id: 'refapp.analyze.output',
  revision: '1',
  expected: '{ metrics: [{ id, label, value }] }',
  parse: (input) => {
    const candidate = input as { metrics?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      Array.isArray(candidate.metrics) &&
      candidate.metrics.every(
        (metric) =>
          metric !== null &&
          typeof metric === 'object' &&
          typeof (metric as { id?: unknown }).id === 'string' &&
          typeof (metric as { label?: unknown }).label === 'string' &&
          typeof (metric as { value?: unknown }).value === 'string',
      )
    ) {
      return {
        ok: true as const,
        value: {
          metrics: candidate.metrics.map((metric) => ({
            id: (metric as { id: string }).id,
            label: (metric as { label: string }).label,
            value: (metric as { value: string }).value,
          })),
        },
      };
    }
    return failContract('an analysis result with metrics is required');
  },
});

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export const projectResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'projects',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'name', type: 'string', required: true, label: 'Name' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'budget', type: 'number', required: true, label: 'Budget' },
    { name: 'owner', type: 'string', label: 'Owner' },
    { name: 'notes', type: 'string', label: 'Notes' },
  ],
  queries: {
    list: {
      filters: ['status'],
      sort: ['name', 'budget'],
      pagination: true,
      projection: ['id', 'name', 'status', 'budget', 'owner'],
    },
    detail: {},
  },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'refapp.project.input',
      idempotency: 'keyed',
      permissions: ['projects.write'],
    },
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'refapp.project.input',
      permissions: ['projects.write'],
    },
    { op: 'delete', effect: 'write', permissions: ['projects.admin.delete'] },
  ],
  authorization: { effect: 'read', permissions: ['projects.read'] },
});

export const messageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'messages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'string', label: 'Created' },
  ],
  queries: { list: { sort: ['createdAt'], pagination: true } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'refapp.message.input',
      idempotency: 'keyed',
      permissions: ['messages.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['messages.read'] },
});

export const metricResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'metrics',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'label', type: 'string', required: true, label: 'Metric' },
    { name: 'value', type: 'string', required: true, label: 'Value' },
  ],
  queries: { list: {} },
  mutations: [
    { op: 'create', effect: 'write', permissions: ['metrics.write'] },
    { op: 'update', effect: 'write', permissions: ['metrics.write'] },
  ],
  authorization: { effect: 'read', permissions: ['metrics.read'] },
});

/* ------------------------------------------------------------------ */
/* Application definition                                              */
/* ------------------------------------------------------------------ */

export const referenceApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.reference',
  revision: '5',
  name: 'Vict Reference Application',
  routes: [
    {
      id: 'home',
      path: '/',
      screenId: 's.dashboard',
      nav: { label: 'Dashboard', group: 'Workspace', order: 1 },
    },
    {
      id: 'conversation',
      path: '/conversation',
      screenId: 's.conversation',
      nav: { label: 'Conversation', group: 'Workspace', order: 2 },
    },
    {
      id: 'projects',
      path: '/projects',
      screenId: 's.projects',
      nav: { label: 'Projects', group: 'Work', order: 3 },
    },
    { id: 'project-new', path: '/projects/new', screenId: 's.project-new' },
    { id: 'project-detail', path: '/projects/:id', screenId: 's.project-detail' },
    { id: 'dashboard-alias', path: '/dashboard', redirect: 'home' },
  ],
  screens: [
    {
      id: 's.dashboard',
      title: 'Vict Reference Application',
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'text',
              id: 't.dash-intro',
              content: 'Local workspace overview produced from the neutral application definition.',
              level: 2,
            },
            {
              role: 'status',
              id: 'st.app-health',
              value: 'operational',
              tones: { operational: 'success', degraded: 'warning', down: 'danger' },
            },
            {
              role: 'list',
              id: 'ls.metrics',
              viewId: 'v.metrics',
              titleField: 'label',
              secondaryField: 'value',
              emptyMessage:
                'No analysis yet — run the analysis action to compute workspace metrics.',
            },
            {
              role: 'chart',
              id: 'ch.budget',
              viewId: 'v.chartProjects',
              kind: 'bar',
              xField: 'status',
              yField: 'budget',
              summary: 'Total project budget summed per project status',
              title: 'Budget by project status',
            },
            {
              role: 'action',
              id: 'act.analyze-btn',
              actionId: 'act.analyze',
              label: 'Run analysis (VICT)',
            },
            {
              role: 'component',
              id: 'cm.health',
              componentId: 'cmp.health',
              revision: '1',
              props: { label: 'workspace health island' },
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.dash-loading', content: 'Loading workspace…' },
        failure: { role: 'text', id: 't.dash-failure', content: 'The dashboard failed safely.' },
      },
    },
    {
      id: 's.conversation',
      title: 'Conversation',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Conversation' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'conversation',
              id: 'cv.main',
              viewId: 'v.messages',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.sendMessage',
              inputLabel: 'Message',
              inputPlaceholder: 'Type a message…',
              emptyMessage:
                'No messages yet — say hello! Your message is processed by a real Vict run.',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.conv-loading', content: 'Loading conversation…' },
        empty: { role: 'text', id: 't.conv-empty', content: 'No messages yet.' },
        failure: { role: 'text', id: 't.conv-failure', content: 'The conversation failed safely.' },
      },
    },
    {
      id: 's.projects',
      title: 'Projects',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Projects' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'table',
              id: 'tb.projects',
              viewId: 'v.projects',
              queryActionId: 'act.queryProjects',
              searchFields: ['name', 'owner'],
              filterFields: ['status'],
              pageSize: 3,
              emptyMessage: 'No projects match. Create one to get started.',
              columns: [
                { field: 'name', label: 'Name', sortable: true },
                { field: 'status', label: 'Status', sortable: true },
                { field: 'budget', label: 'Budget', sortable: true },
              ],
            },
            {
              role: 'action',
              id: 'act.new-project-btn',
              actionId: 'act.navNewProject',
              label: 'New project',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.prj-loading', content: 'Loading projects…' },
        empty: { role: 'text', id: 't.prj-empty', content: 'No projects yet.' },
        denied: {
          role: 'text',
          id: 't.prj-denied',
          content: 'Denied by the authorization boundary.',
        },
        stale: {
          role: 'text',
          id: 't.prj-stale',
          content: 'Showing saved data that may be out of date.',
        },
        partial: {
          role: 'text',
          id: 't.prj-partial',
          content: 'Some project data is unavailable right now.',
        },
        failure: { role: 'text', id: 't.prj-failure', content: 'The project list failed safely.' },
      },
    },
    {
      id: 's.project-new',
      title: 'New project',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Projects', routeId: 'projects' },
        { label: 'New' },
      ],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'form', id: 'fm.project-create', formId: 'f.project-create' },
            {
              role: 'action',
              id: 'act.reset-create-btn',
              actionId: 'act.resetForm',
              label: 'Clear form (local)',
            },
          ],
        },
      ],
      states: {
        validation: {
          role: 'text',
          id: 't.new-validation',
          content: 'Validation failed; check the highlighted fields.',
        },
      },
    },
    {
      id: 's.project-detail',
      title: 'Project',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Projects', routeId: 'projects' },
        { label: 'Record' },
      ],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'status',
              id: 'st.project-status',
              field: 'status',
              tones: { planning: 'info', active: 'success', paused: 'warning', done: 'neutral' },
            },
            {
              role: 'tabs',
              id: 'tb.detail-tabs',
              tabs: [
                {
                  name: 'overview',
                  label: 'Overview',
                  surfaces: [
                    {
                      role: 'detail',
                      id: 'dt.project',
                      viewId: 'v.projectDetail',
                      emptyMessage: 'This project does not exist.',
                    },
                  ],
                },
                {
                  name: 'edit',
                  label: 'Edit',
                  surfaces: [
                    { role: 'form', id: 'fm.project-edit', formId: 'f.project-edit' },
                    {
                      role: 'action',
                      id: 'act.reset-edit-btn',
                      actionId: 'act.resetForm',
                      label: 'Reset form (local)',
                    },
                  ],
                },
              ],
            },
            {
              role: 'dialog',
              id: 'dlg.delete',
              title: 'Delete project',
              triggerLabel: 'Delete…',
              content: [
                {
                  role: 'text',
                  id: 't.delete-warning',
                  content:
                    'This action is denied by the authorization boundary (UI visibility is not authorization).',
                },
                {
                  role: 'action',
                  id: 'act.delete-btn',
                  actionId: 'act.deleteProject',
                  label: 'Confirm delete',
                },
              ],
            },
            {
              role: 'drawer',
              id: 'dr.health',
              title: 'Workspace health',
              triggerLabel: 'Health details…',
              content: [
                {
                  role: 'text',
                  id: 't.health-text',
                  content: 'Custom components are registered code islands with explicit revisions.',
                },
                {
                  role: 'component',
                  id: 'cm.drawer-health',
                  componentId: 'cmp.health',
                  revision: '1',
                  props: { label: 'detail island' },
                },
              ],
            },
          ],
        },
      ],
      states: {
        failure: { role: 'text', id: 't.det-failure', content: 'The project failed safely.' },
      },
    },
  ],
  views: [
    {
      viewId: 'v.metrics',
      resourceId: 'metrics',
      resourceRevision: '1',
      fields: ['id', 'label', 'value'],
    },
    {
      viewId: 'v.chartProjects',
      resourceId: 'projects',
      resourceRevision: '1',
      fields: ['status', 'budget'],
    },
    {
      viewId: 'v.messages',
      resourceId: 'messages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant'],
    },
    {
      viewId: 'v.projects',
      resourceId: 'projects',
      resourceRevision: '1',
      fields: ['id', 'name', 'status', 'budget', 'owner'],
    },
    {
      viewId: 'v.projectDetail',
      resourceId: 'projects',
      resourceRevision: '1',
      fields: ['id', 'name', 'status', 'budget', 'owner', 'notes'],
    },
  ],
  forms: [
    {
      formId: 'f.project-create',
      resourceId: 'projects',
      resourceRevision: '1',
      inputContractId: 'refapp.project.input',
      fields: [
        { name: 'id', label: 'Identifier (slug)', required: true, widget: 'text' },
        { name: 'name', label: 'Name', required: true, widget: 'text' },
        {
          name: 'status',
          label: 'Status (planning | active | paused | done)',
          required: true,
          widget: 'text',
        },
        { name: 'budget', label: 'Budget', required: true, widget: 'number' },
      ],
      submitActionId: 'act.createProject',
    },
    {
      formId: 'f.project-edit',
      resourceId: 'projects',
      resourceRevision: '1',
      inputContractId: 'refapp.project.input',
      fields: [
        { name: 'name', label: 'Name', required: true, widget: 'text' },
        {
          name: 'status',
          label: 'Status (planning | active | paused | done)',
          required: true,
          widget: 'text',
        },
        { name: 'budget', label: 'Budget', required: true, widget: 'number' },
      ],
      submitActionId: 'act.updateProject',
    },
  ],
  actions: [
    { kind: 'local', id: 'act.resetForm', revision: '1' },
    {
      kind: 'navigation',
      id: 'act.navNewProject',
      revision: '1',
      routeId: 'project-new',
    },
    {
      kind: 'query',
      id: 'act.queryProjects',
      revision: '1',
      resourceId: 'projects',
      resourceRevision: '1',
    },
    {
      kind: 'query',
      id: 'act.queryMessages',
      revision: '1',
      resourceId: 'messages',
      resourceRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.createProject',
      revision: '1',
      resourceId: 'projects',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'refapp.project.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.updateProject',
      revision: '1',
      resourceId: 'projects',
      resourceRevision: '1',
      op: 'update',
      inputContractId: 'refapp.project.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.deleteProject',
      revision: '1',
      resourceId: 'projects',
      resourceRevision: '1',
      op: 'delete',
      inputContractId: 'refapp.project.input',
    },
    {
      kind: 'mutation',
      id: 'act.sendMessage',
      revision: '1',
      resourceId: 'messages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'refapp.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'capability',
      id: 'act.analyze',
      revision: '1',
      capabilityId: 'refapp.analyze',
      capabilityRevision: '1',
      inputContractId: 'refapp.analyze.input',
      inputContractRevision: '1',
      outputContractId: 'refapp.analyze.output',
      outputContractRevision: '1',
    },
  ],
  resources: [
    { resourceId: 'projects', revision: '1' },
    { resourceId: 'messages', revision: '1' },
    { resourceId: 'metrics', revision: '1' },
  ],
  components: [{ componentId: 'cmp.health', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
  theme: {
    reference: 'vict.default-theme',
    tokens: [
      { name: 'color.accent', value: '#0f766e' },
      { name: 'color.focusRing', value: '#0f766e' },
      { name: 'radius.base', value: '10px' },
    ],
  },
});

/** Available contract/capability/component bindings for compilation. */
export const bindings = {
  contracts: [
    { id: 'refapp.project.input', revision: '1' },
    { id: 'refapp.message.input', revision: '1' },
    { id: 'refapp.analyze.input', revision: '1' },
    { id: 'refapp.analyze.output', revision: '1' },
  ],
  capabilities: [{ id: 'refapp.analyze', revision: '1' }],
  components: [{ componentId: 'cmp.health', revision: '1' }],
} as const;

/** All resources of the reference application. */
export const resources = [projectResource, messageResource, metricResource];

/** The contracts bound to the data adapter (mutation validation). */
export const dataContracts = [projectInputContract, messageInputContract];

/** Compile the neutral definition into the immutable plan. */
export function compileReferencePlan(): ApplicationPlan {
  const result = compileApplication({
    application: referenceApplication,
    resources,
    contracts: bindings.contracts,
    capabilities: bindings.capabilities,
    components: bindings.components,
  });
  if (!result.ok) {
    throw new Error(`reference definition invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}
