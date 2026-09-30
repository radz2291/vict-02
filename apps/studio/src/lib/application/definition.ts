import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import type { ApplicationPlan } from '@victframework/application';

/**
 * VICT STUDIO APPLICATION DEFINITION (Stage 09, G1) — builder track
 * `studio-app`. Mirrors the reference-app pattern (defineApplication /
 * defineResource / compileApplication, `vict.application@2`).
 *
 * G1 is strictly READ-ONLY: every resource declares an EMPTY mutations
 * array, the application declares NO actions, and no surface binds a
 * form or capability. All resource ids/identity fields/safe field lists
 * come verbatim from `RESOURCE_BINDINGS` in `$lib/shared/contract.ts`
 * (the agreed studio-server ↔ studio-app interface — do not invent
 * fields here).
 *
 * FT-1 note: the shipped list/table/view surface roles have NO row
 * navigation. The run detail route `/runs/:runId` is reached by URL
 * only; no link column, row action, or island is declared anywhere in
 * this definition, and none may be added while FT-1 is unlanded
 * (an S9-02 drill-down claim must NOT become possible from G1).
 */

const READ_PERMISSION = ['studio.operator.read'] as const;

/* ------------------------------------------------------------------ */
/* Resources — exactly per RESOURCE_BINDINGS                           */
/* ------------------------------------------------------------------ */

export const runsResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'runs',
  revision: '1',
  identity: { key: 'runId' },
  fields: [
    { name: 'runId', type: 'string', required: true, label: 'Run' },
    { name: 'graphId', type: 'string', required: true, label: 'Graph' },
    { name: 'graphVersion', type: 'string', label: 'Graph version' },
    { name: 'capabilitySetVersion', type: 'string', label: 'Capability set version' },
    { name: 'activationVersion', type: 'string', label: 'Activation version' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'mode', type: 'string', label: 'Mode' },
    { name: 'retention', type: 'string', label: 'Retention' },
    { name: 'steps', type: 'json', label: 'Steps' },
    { name: 'currentNodeId', type: 'string', label: 'Current node' },
    { name: 'outputSummary', type: 'string', label: 'Output summary' },
    { name: 'error', type: 'string', label: 'Error' },
    { name: 'recordRevision', type: 'string', label: 'Record revision' },
    { name: 'createdAt', type: 'string', label: 'Created' },
    { name: 'updatedAt', type: 'string', label: 'Updated' },
  ],
  queries: {
    list: { pagination: true },
    detail: {},
  },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const runEventsResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'runEvents',
  revision: '1',
  identity: { key: 'seq' },
  fields: [
    { name: 'runId', type: 'string', required: true, label: 'Run' },
    { name: 'seq', type: 'number', required: true, label: 'Seq' },
    { name: 'eventSchema', type: 'string', label: 'Event schema' },
    { name: 'type', type: 'string', required: true, label: 'Type' },
    { name: 'graphId', type: 'string', label: 'Graph' },
    { name: 'graphVersion', type: 'string', label: 'Graph version' },
    { name: 'capabilitySetVersion', type: 'string', label: 'Capability set version' },
    { name: 'activationVersion', type: 'string', label: 'Activation version' },
    { name: 'nodeId', type: 'string', label: 'Node' },
    { name: 'capabilityId', type: 'string', label: 'Capability' },
    { name: 'timestamp', type: 'string', label: 'Timestamp' },
  ],
  queries: { list: {} },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const runWaitsResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'runWaits',
  revision: '1',
  identity: { key: 'waitId' },
  fields: [
    { name: 'waitId', type: 'string', required: true, label: 'Wait' },
    { name: 'runId', type: 'string', required: true, label: 'Run' },
    { name: 'tokenId', type: 'string', label: 'Token' },
    { name: 'nodeId', type: 'string', label: 'Node' },
    { name: 'activationVersion', type: 'string', label: 'Activation version' },
    { name: 'kind', type: 'string', label: 'Kind' },
    { name: 'signalName', type: 'string', label: 'Signal' },
    { name: 'dueAt', type: 'string', label: 'Due at' },
    { name: 'timeoutAt', type: 'string', label: 'Timeout at' },
    { name: 'status', type: 'string', label: 'Status' },
    { name: 'createdAt', type: 'string', label: 'Created' },
    { name: 'resolvedAt', type: 'string', label: 'Resolved at' },
    { name: 'resolvedBy', type: 'string', label: 'Resolved by' },
  ],
  queries: { list: {} },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const activationsResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'activations',
  revision: '1',
  identity: { key: 'activationVersion' },
  fields: [
    { name: 'graphId', type: 'string', required: true, label: 'Graph' },
    { name: 'activationVersion', type: 'string', required: true, label: 'Activation version' },
    { name: 'nodeCount', type: 'number', label: 'Nodes' },
    { name: 'bindingCount', type: 'number', label: 'Bindings' },
    { name: 'contractCount', type: 'number', label: 'Contracts' },
    { name: 'nodeIds', type: 'json', label: 'Node ids' },
    { name: 'createdAt', type: 'string', label: 'Created' },
  ],
  queries: {
    list: { pagination: true },
    detail: {},
  },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const selectedActivationsResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'selectedActivations',
  revision: '1',
  identity: { key: 'graphId' },
  fields: [
    { name: 'graphId', type: 'string', required: true, label: 'Graph' },
    { name: 'activationVersion', type: 'string', required: true, label: 'Activation version' },
    { name: 'selectionRevision', type: 'string', label: 'Selection revision' },
    { name: 'selectedAt', type: 'string', label: 'Selected at' },
  ],
  queries: {
    list: {},
    detail: {},
  },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const releasesResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'releases',
  revision: '1',
  identity: { key: 'releaseId' },
  fields: [
    { name: 'releaseId', type: 'string', required: true, label: 'Release' },
    { name: 'version', type: 'string', label: 'Version' },
    { name: 'state', type: 'string', label: 'State' },
    { name: 'createdAt', type: 'string', label: 'Created' },
  ],
  queries: { list: {} },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const releaseSelectionsResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'releaseSelections',
  revision: '1',
  identity: { key: 'releaseId' },
  fields: [
    { name: 'releaseId', type: 'string', required: true, label: 'Release' },
    { name: 'selectionRevision', type: 'string', label: 'Selection revision' },
    { name: 'selectedAt', type: 'string', label: 'Selected at' },
    { name: 'selectedBy', type: 'string', label: 'Selected by' },
  ],
  queries: { list: {} },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const auditEntriesResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'auditEntries',
  revision: '1',
  identity: { key: 'auditId' },
  fields: [
    { name: 'auditId', type: 'string', required: true, label: 'Audit id' },
    { name: 'at', type: 'string', label: 'At' },
    { name: 'actorId', type: 'string', label: 'Actor' },
    { name: 'action', type: 'string', label: 'Action' },
    { name: 'subjectType', type: 'string', label: 'Subject type' },
    { name: 'subjectId', type: 'string', label: 'Subject id' },
    { name: 'summary', type: 'string', label: 'Summary' },
  ],
  queries: { list: {} },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

export const targetStatusResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'targetStatus',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Target' },
    { name: 'label', type: 'string', label: 'Label' },
    { name: 'endpoint', type: 'string', label: 'Endpoint' },
    { name: 'state', type: 'string', required: true, label: 'State' },
    { name: 'actorId', type: 'string', label: 'Actor' },
    { name: 'scopes', type: 'json', label: 'Scopes' },
    { name: 'selected', type: 'json', label: 'Selected versions' },
    { name: 'detail', type: 'string', label: 'Detail' },
  ],
  queries: { list: {} },
  mutations: [],
  authorization: { effect: 'read', permissions: READ_PERMISSION },
});

/** All Studio resources (order matches STUDIO_RESOURCES in the contract). */
export const resources = [
  runsResource,
  runEventsResource,
  runWaitsResource,
  activationsResource,
  selectedActivationsResource,
  releasesResource,
  releaseSelectionsResource,
  auditEntriesResource,
  targetStatusResource,
];

/* ------------------------------------------------------------------ */
/* Application definition                                              */
/* ------------------------------------------------------------------ */

export const studioApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.vict-studio',
  revision: '1',
  name: 'VICT Studio',
  routes: [
    {
      id: 'home',
      path: '/',
      screenId: 's.dashboard',
      nav: { label: 'Dashboard', group: 'Target', order: 1 },
    },
    {
      id: 'runs',
      path: '/runs',
      screenId: 's.runs',
      nav: { label: 'Runs', group: 'Operations', order: 2 },
    },
    { id: 'run-detail', path: '/runs/:runId', screenId: 's.run-detail' },
    {
      id: 'activations',
      path: '/activations',
      screenId: 's.activations',
      nav: { label: 'Activations', group: 'Operations', order: 3 },
    },
    {
      id: 'releases',
      path: '/releases',
      screenId: 's.releases',
      nav: { label: 'Releases', group: 'Governance', order: 4 },
    },
    {
      id: 'audit',
      path: '/audit',
      screenId: 's.audit',
      nav: { label: 'Audit', group: 'Governance', order: 5 },
    },
    {
      // Stage 9 G2 (S9-04): the confirmation journey route — prepare →
      // human review → confirm, relayed by the Studio server with the
      // server-held credential (the browser NEVER talks to a VICT
      // target). ADDITIVE to the G1 read surface; the G1 read routes,
      // resources, views and the zero-actions invariant are untouched.
      id: 'confirmations',
      path: '/confirmations',
      screenId: 's.confirmations',
      nav: { label: 'Confirmations', group: 'Governance', order: 6 },
    },
    {
      // Stage 9 G2 (S9-03): the changeset browser journey route — propose →
      // review (operations, evidence, content hash) → decide (separate
      // approvers) → commit (authorized operator), relayed by the Studio
      // server with server-held per-actor credentials. ADDITIVE to the G1
      // read surface; the G1 read routes, resources, views and the
      // zero-actions invariant are untouched.
      id: 'changesets',
      path: '/changesets',
      screenId: 's.changesets',
      nav: { label: 'Changesets', group: 'Governance', order: 7 },
    },
  ],
  screens: [
    {
      id: 's.changesets',
      title: 'Changesets',
      breadcrumbs: [{ label: 'Dashboard', routeId: 'home' }, { label: 'Changesets' }],
      // The journey's forms live in the dedicated SvelteKit route;
      // the definition surface stays form-free (the zero-form invariant).
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'text',
              id: 't.changeset-intro',
              content:
                'ChangeSet governance journey: propose → review → decide → commit; ' +
                'self-approval, changed content, missing approval, and duplicate effect fail closed.',
              level: 2,
            },
          ],
        },
      ],
      states: {
        loading: {
          role: 'text',
          id: 't.changeset-loading',
          content: 'Loading changeset governance…',
        },
        empty: {
          role: 'text',
          id: 't.changeset-empty',
          content: 'Nothing to govern yet — no changeset is recorded on the target.',
        },
        failure: {
          role: 'text',
          id: 't.changeset-failure',
          content: 'The changeset journey failed safely.',
        },
      },
    },
    {
      id: 's.confirmations',
      title: 'Confirmations',
      breadcrumbs: [{ label: 'Dashboard', routeId: 'home' }, { label: 'Confirmations' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'component',
              id: 'cm.confirmation-review',
              componentId: 'cmp.confirmation-review',
              revision: '1',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.confirm-loading', content: 'Loading confirmation review…' },
        empty: {
          role: 'text',
          id: 't.confirm-empty',
          content: 'Nothing to review yet — no confirmation was prepared in this session.',
        },
        failure: {
          role: 'text',
          id: 't.confirm-failure',
          content: 'The confirmation review failed safely.',
        },
      },
    },
    {
      id: 's.dashboard',
      title: 'VICT Studio',
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'text',
              id: 't.dash-intro',
              content: 'Read-only operator view of the connected VICT target.',
              level: 2,
            },
            {
              role: 'component',
              id: 'cm.target-status',
              componentId: 'cmp.target-connection-status',
              revision: '1',
              props: { label: 'Target connection', rows: { view: 'v.targetStatus' } },
            },
            {
              role: 'text',
              id: 't.dash-selected-heading',
              content: 'Selected activations',
              level: 3,
            },
            {
              role: 'list',
              id: 'ls.selected-activations',
              viewId: 'v.selectedActivations',
              titleField: 'graphId',
              secondaryField: 'activationVersion',
              emptyMessage: 'No activation selected for any graph.',
            },
            {
              role: 'text',
              id: 't.dash-releases-heading',
              content: 'Releases',
              level: 3,
            },
            {
              role: 'list',
              id: 'ls.releases',
              viewId: 'v.releases',
              titleField: 'releaseId',
              secondaryField: 'version',
              emptyMessage: 'No releases listed.',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.dash-loading', content: 'Loading target status…' },
        empty: {
          role: 'text',
          id: 't.dash-empty',
          content: 'Nothing to show yet — no target status, selections, or releases reported.',
        },
        partial: {
          role: 'text',
          id: 't.dash-partial',
          content:
            'Some data is unavailable right now — the panel shown as empty was not successfully read from the target; nothing is invented to fill it.',
        },
        failure: {
          role: 'text',
          id: 't.dash-failure',
          content: 'The dashboard failed safely — no partial operator data is shown.',
        },
      },
    },
    {
      id: 's.runs',
      title: 'Runs',
      breadcrumbs: [{ label: 'Dashboard', routeId: 'home' }, { label: 'Runs' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'view',
              id: 'vw.runs',
              viewId: 'v.runs',
              // FT-1 (G3-A): definition-declared row→detail navigation.
              // Each run-list row resolves a REAL link to the run-detail
              // route, substituting `runId` from the row's own runId field.
              // The route itself is WP-G3-B's; the binding is the platform
              // mechanism's Studio consumption (navigation-only: no data
              // surface, command, or scope change).
              rowDetail: {
                routeId: 'run-detail',
                label: 'Open run',
                param: { runId: 'runId' },
              },
            },
            {
              role: 'text',
              id: 't.runs-ft1',
              content:
                'Open a run from its row link — drill-down is the definition-declared row→detail binding to /runs/<runId> (FT-1, G3-A).',
              level: 3,
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.runs-loading', content: 'Loading runs…' },
        empty: { role: 'text', id: 't.runs-empty', content: 'No runs recorded.' },
        failure: {
          role: 'text',
          id: 't.runs-failure',
          content: 'The run list failed safely.',
        },
      },
    },
    {
      id: 's.run-detail',
      title: 'Run',
      breadcrumbs: [
        { label: 'Dashboard', routeId: 'home' },
        { label: 'Runs', routeId: 'runs' },
        { label: 'Run' },
      ],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'detail',
              id: 'dt.run',
              viewId: 'v.runDetail',
              emptyMessage: 'This run does not exist.',
            },
            { role: 'text', id: 't.run-events-heading', content: 'Events', level: 3 },
            {
              role: 'list',
              id: 'ls.run-events',
              viewId: 'v.runEvents',
              titleField: 'seq',
              secondaryField: 'type',
              emptyMessage: 'No events recorded.',
            },
            { role: 'text', id: 't.run-waits-heading', content: 'Durable waits', level: 3 },
            {
              role: 'list',
              id: 'ls.run-waits',
              viewId: 'v.runWaits',
              titleField: 'waitId',
              secondaryField: 'kind',
              emptyMessage: 'No durable waits.',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.rundet-loading', content: 'Loading run…' },
        empty: {
          role: 'text',
          id: 't.rundet-empty',
          content: 'No events recorded. No durable waits.',
        },
        failure: { role: 'text', id: 't.rundet-failure', content: 'The run failed safely.' },
      },
    },
    {
      id: 's.activations',
      title: 'Activations',
      breadcrumbs: [{ label: 'Dashboard', routeId: 'home' }, { label: 'Activations' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'view',
              id: 'vw.activations',
              viewId: 'v.activations',
            },
            {
              role: 'text',
              id: 't.act-selected-heading',
              content: 'Selected per graph',
              level: 3,
            },
            {
              role: 'list',
              id: 'ls.act-selected',
              viewId: 'v.selectedActivations',
              titleField: 'graphId',
              secondaryField: 'activationVersion',
              emptyMessage: 'No activation selected for any graph.',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.act-loading', content: 'Loading activations…' },
        empty: { role: 'text', id: 't.act-empty', content: 'No activations recorded.' },
        failure: {
          role: 'text',
          id: 't.act-failure',
          content: 'The activation list failed safely.',
        },
      },
    },
    {
      id: 's.releases',
      title: 'Releases',
      breadcrumbs: [{ label: 'Dashboard', routeId: 'home' }, { label: 'Releases' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'view',
              id: 'vw.releases',
              viewId: 'v.releases',
            },
            {
              role: 'text',
              id: 't.rel-selections-heading',
              content: 'Release selections',
              level: 3,
            },
            {
              role: 'list',
              id: 'ls.rel-selections',
              viewId: 'v.releaseSelections',
              titleField: 'releaseId',
              secondaryField: 'selectionRevision',
              emptyMessage: 'No release selections recorded.',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.rel-loading', content: 'Loading releases…' },
        empty: { role: 'text', id: 't.rel-empty', content: 'No releases published.' },
        partial: {
          role: 'text',
          id: 't.rel-partial',
          content:
            'Some release data is unavailable: release enumeration requires an applicationId query parameter (?applicationId=…); the target truthfully refuses to enumerate without one.',
        },
        failure: {
          role: 'text',
          id: 't.rel-failure',
          content:
            'Release enumeration requires an applicationId query parameter (?applicationId=…). Without it the target truthfully refuses to enumerate; no partial list is shown.',
        },
      },
    },
    {
      id: 's.audit',
      title: 'Audit',
      breadcrumbs: [{ label: 'Dashboard', routeId: 'home' }, { label: 'Audit' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'view',
              id: 'vw.audit',
              viewId: 'v.audit',
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.audit-loading', content: 'Loading audit…' },
        empty: {
          role: 'text',
          id: 't.audit-empty',
          content: 'Audit is empty until actions occur.',
        },
        failure: {
          role: 'text',
          id: 't.audit-failure',
          content: 'The audit list failed safely.',
        },
      },
    },
  ],
  views: [
    {
      viewId: 'v.runs',
      resourceId: 'runs',
      resourceRevision: '1',
      fields: ['runId', 'graphId', 'status', 'createdAt'],
    },
    {
      viewId: 'v.runDetail',
      resourceId: 'runs',
      resourceRevision: '1',
      fields: [
        'runId',
        'graphId',
        'graphVersion',
        'capabilitySetVersion',
        'activationVersion',
        'status',
        'mode',
        'retention',
        'currentNodeId',
        'outputSummary',
        'error',
        'recordRevision',
        'createdAt',
        'updatedAt',
      ],
    },
    {
      viewId: 'v.runEvents',
      resourceId: 'runEvents',
      resourceRevision: '1',
      fields: ['seq', 'type', 'nodeId', 'capabilityId', 'timestamp'],
    },
    {
      viewId: 'v.runWaits',
      resourceId: 'runWaits',
      resourceRevision: '1',
      fields: ['waitId', 'nodeId', 'kind', 'signalName', 'dueAt', 'status'],
    },
    {
      viewId: 'v.activations',
      resourceId: 'activations',
      resourceRevision: '1',
      fields: [
        'graphId',
        'activationVersion',
        'nodeCount',
        'bindingCount',
        'contractCount',
        'createdAt',
      ],
    },
    {
      viewId: 'v.selectedActivations',
      resourceId: 'selectedActivations',
      resourceRevision: '1',
      fields: ['graphId', 'activationVersion', 'selectionRevision', 'selectedAt'],
    },
    {
      viewId: 'v.releases',
      resourceId: 'releases',
      resourceRevision: '1',
      fields: ['releaseId', 'version', 'state', 'createdAt'],
    },
    {
      viewId: 'v.releaseSelections',
      resourceId: 'releaseSelections',
      resourceRevision: '1',
      fields: ['releaseId', 'selectionRevision', 'selectedAt', 'selectedBy'],
    },
    {
      viewId: 'v.audit',
      resourceId: 'auditEntries',
      resourceRevision: '1',
      fields: ['auditId', 'at', 'actorId', 'action', 'subjectType', 'subjectId', 'summary'],
    },
    {
      viewId: 'v.targetStatus',
      resourceId: 'targetStatus',
      resourceRevision: '1',
      fields: ['id', 'label', 'endpoint', 'state', 'actorId', 'scopes', 'selected', 'detail'],
    },
  ],
  // G1 read-only: zero actions — no mutations, no capabilities, no forms.
  actions: [],
  resources: [
    { resourceId: 'runs', revision: '1' },
    { resourceId: 'runEvents', revision: '1' },
    { resourceId: 'runWaits', revision: '1' },
    { resourceId: 'activations', revision: '1' },
    { resourceId: 'selectedActivations', revision: '1' },
    { resourceId: 'releases', revision: '1' },
    { resourceId: 'releaseSelections', revision: '1' },
    { resourceId: 'auditEntries', revision: '1' },
    { resourceId: 'targetStatus', revision: '1' },
  ],
  components: [
    { componentId: 'cmp.target-connection-status', revision: '1' },
    { componentId: 'cmp.confirmation-review', revision: '1' },
  ],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});

/** Compile the neutral definition into the immutable plan. */
export function compileStudioDefinitionPlan(): ApplicationPlan {
  const result = compileApplication({
    application: studioApplication,
    resources,
    contracts: [],
    capabilities: [],
    components: [
      { componentId: 'cmp.target-connection-status', revision: '1' },
      { componentId: 'cmp.confirmation-review', revision: '1' },
    ],
  });
  if (!result.ok) {
    throw new Error(`studio definition invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}
