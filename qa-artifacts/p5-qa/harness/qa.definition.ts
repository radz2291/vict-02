/**
 * QA harness application definition (P4 browser verification).
 *
 * A small real @2 application — compiled through the REAL SDK compiler —
 * that exercises every P4-migrated presentation role the shipped reference
 * app does not fully declare: the closed heading vocabulary (h1–h6 +
 * unleveled text), the read-only DataView with many columns / long text /
 * unbroken values, list variants, detail extremes, chart bar AND line
 * variants (including zero points, one point, large/zero/negative values,
 * and many points), three conversation panels with distinct boundary
 * outcomes (ok / denied / thrown), a resolvable custom component slot, and
 * P4 roles nested inside tabs/dialogs/drawers through the existing
 * recursion path.
 *
 * Compiled once in Node (scripts/emit-plan.mts) into src/plan.json (+ a
 * second plan-invalid.json whose ONLY difference is a component id the QA
 * host registry does NOT resolve, so the structured-failure feedback can be
 * exercised in a real browser).
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

/** The conversation send contract (mirrors the shipped reference app's shape). */
export const messageInputContract = defineContract<{
  text: string;
  author?: string;
  participant?: string;
}>({
  id: 'qa.message.input',
  revision: '1',
  expected: '{ text, author?, participant? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a message record is required');
    }
    const text = candidate.text;
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 500) {
      return failContract('text is required (1-500 characters)');
    }
    const author = typeof candidate.author === 'string' && candidate.author.length > 0 ? candidate.author : 'You';
    const participant = candidate.participant === 'assistant' ? 'assistant' : 'user';
    return { ok: true as const, value: { text, author, participant } };
  },
});

export const messageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'messages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'text', type: 'string', required: true },
    { name: 'author', type: 'string', required: true },
    { name: 'participant', type: 'string', required: true },
  ],
  queries: { list: { pagination: false } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'qa.message.input',
      idempotency: 'keyed',
      permissions: ['messages.write'],
    },
  ],
  authorization: { effect: 'read' },
});

/** Read-only catalogue resource: carries every widget/chart display field. */
export const catalogResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'catalog',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'secondary', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'budget', type: 'number' },
    { name: 'value', type: 'number' },
    { name: 'owner', type: 'string' },
    { name: 'notes', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'updated', type: 'string' },
    { name: 'month', type: 'string' },
    { name: 'label', type: 'string' },
    { name: 'config', type: 'string' },
    { name: 'tags', type: 'string' },
    { name: 'flags', type: 'string' },
  ],
  queries: { list: { pagination: false } },
  mutations: [],
  authorization: { effect: 'read' },
});

export const qaApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.qa.p4',
  revision: '1',
  routes: [
    { id: 'headings', path: '/headings', screenId: 's.headings', nav: { label: 'Headings', group: 'P4', order: 1 } },
    { id: 'widgets', path: '/widgets', screenId: 's.widgets', nav: { label: 'Widgets', group: 'P4', order: 2 } },
    { id: 'charts', path: '/charts', screenId: 's.charts', nav: { label: 'Charts', group: 'P4', order: 3 } },
    { id: 'conversation', path: '/conversation', screenId: 's.conversation', nav: { label: 'Conversation', group: 'P4', order: 4 } },
    { id: 'slots', path: '/slots', screenId: 's.slots', nav: { label: 'Slots', group: 'P4', order: 5 } },
    { id: 'rec', path: '/rec/:id', screenId: 's.rec' },
  ],
  screens: [
    {
      id: 's.headings',
      title: 'Heading vocabulary',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'text', id: 't.h1', content: 'Documented level one', level: 1 },
            { role: 'text', id: 't.h2', content: 'Documented level two', level: 2 },
            { role: 'text', id: 't.h3', content: 'Documented level three', level: 3 },
            { role: 'text', id: 't.h4', content: 'Documented level four', level: 4 },
            { role: 'text', id: 't.h5', content: 'Documented level five', level: 5 },
            { role: 'text', id: 't.h6', content: 'Documented level six', level: 6 },
            {
              role: 'text',
              id: 't.plain',
              content:
                'Unleveled body paragraph. Long content must wrap inside its container instead of forcing the document wider: this sentence repeats padding words so the rendered paragraph is several lines tall at phone widths, with ordinary spaces and a few long tokens such as Supercalifragilisticexpialidocious-And-Other-Extraordinary-Vocabulary to prove wrapping.',
            },
            {
              role: 'text',
              id: 't.unbroken',
              content:
                'Unbreakable-tokenthatmustnotforcepageoverflow-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-abcdefghijklmnopqrstuvwxyz-END',
            },
            {
              role: 'text',
              id: 't.hostile',
              content: 'Text with markup-looking content: <b>bold?</b> <img src=x onerror="window.__qaXss=1"> <script>window.__qaXssScript=1</script>',
            },
          ],
        },
      ],
    },
    {
      id: 's.widgets',
      title: 'Read-only widgets',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'text', id: 't.grid-title', content: 'Read-only data view', level: 2 },
            { role: 'view', id: 'sv.grid', viewId: 'v.grid' },
            { role: 'view', id: 'sv.grid-empty', viewId: 'v.gridEmpty' },
            { role: 'text', id: 't.list-title', content: 'Lists', level: 2 },
            { role: 'list', id: 'ls.plain', viewId: 'v.listPlain', titleField: 'title' },
            { role: 'list', id: 'ls.secondary', viewId: 'v.listSecondary', titleField: 'title', secondaryField: 'secondary' },
            { role: 'list', id: 'ls.unbroken', viewId: 'v.listUnbroken', titleField: 'title', secondaryField: 'secondary' },
            { role: 'list', id: 'ls.empty', viewId: 'v.listEmpty', titleField: 'title', emptyMessage: 'The list is empty.' },
            { role: 'text', id: 't.detail-title', content: 'Detail', level: 2 },
            { role: 'detail', id: 'dt.inline', viewId: 'v.detailRows', emptyMessage: 'This record does not exist.' },
            { role: 'detail', id: 'dt.empty', viewId: 'v.detailEmpty', emptyMessage: 'This record does not exist.' },
          ],
        },
      ],
    },
    {
      id: 's.charts',
      title: 'Charts',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'chart',
              id: 'ch.barMain',
              viewId: 'v.chartBar',
              kind: 'bar',
              xField: 'status',
              yField: 'budget',
              summary: 'Bar chart of total budget summed per project status',
              title: 'Budget by status (bar)',
            },
            {
              role: 'chart',
              id: 'ch.lineMain',
              viewId: 'v.chartLine',
              kind: 'line',
              xField: 'month',
              yField: 'value',
              summary: 'Line chart of the monthly value trend',
              title: 'Monthly trend (line)',
            },
            {
              role: 'chart',
              id: 'ch.barEmpty',
              viewId: 'v.chartEmpty',
              kind: 'bar',
              xField: 'status',
              yField: 'budget',
              summary: 'Empty bar chart with zero data points',
              title: 'Empty chart (bar, zero points)',
            },
            {
              role: 'chart',
              id: 'ch.lineOne',
              viewId: 'v.chartOne',
              kind: 'line',
              xField: 'month',
              yField: 'value',
              summary: 'Line chart with exactly one data point',
              title: 'One point (line)',
            },
            {
              role: 'chart',
              id: 'ch.barEdge',
              viewId: 'v.chartEdge',
              kind: 'bar',
              xField: 'label',
              yField: 'value',
              summary: 'Bar chart with large, zero, and negative values',
              title: 'Large / zero / negative values (bar)',
            },
            {
              role: 'chart',
              id: 'ch.lineMany',
              viewId: 'v.chartMany',
              kind: 'line',
              xField: 'label',
              yField: 'value',
              summary: 'Line chart with twelve dense data points',
              title: 'Many points (line, 12)',
            },
          ],
        },
      ],
    },
    {
      id: 's.conversation',
      title: 'Conversation',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'conversation',
              id: 'cv.ok',
              viewId: 'v.messages',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.sendMessage',
              inputLabel: 'Message (ok boundary)',
              inputPlaceholder: 'Type a message…',
              emptyMessage: 'No messages yet — say hello!',
            },
            {
              role: 'conversation',
              id: 'cv.empty',
              viewId: 'v.messagesEmpty',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.sendMessage',
              inputLabel: 'Message (empty feed)',
              emptyMessage: 'No messages yet — say hello!',
            },
            {
              role: 'conversation',
              id: 'cv.denied',
              viewId: 'v.messages',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.messageDenied',
              inputLabel: 'Message (denied boundary)',
            },
            {
              role: 'conversation',
              id: 'cv.throws',
              viewId: 'v.messages',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.messageThrows',
              inputLabel: 'Message (throwing boundary)',
            },
          ],
        },
      ],
      states: {
        failure: { role: 'text', id: 't.conv-failure', content: 'The conversation failed safely.' },
      },
    },
    {
      id: 's.slots',
      title: 'Component slot',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'text', id: 't.slot-intro', content: 'A resolvable custom component receives its declared props unchanged.', level: 2 },
            {
              role: 'component',
              id: 'cm.health',
              componentId: 'cmp.health',
              revision: '1',
              props: { label: 'workspace health island', count: 7, pinned: true },
            },
            { role: 'text', id: 't.slot-note', content: 'Below: the same island nested inside a dialog overlay at phone widths.', level: 3 },
            {
              role: 'dialog',
              id: 'dlg.slot',
              title: 'Island in overlay',
              triggerLabel: 'Open island dialog…',
              content: [
                {
                  role: 'component',
                  id: 'cm.overlay-health',
                  componentId: 'cmp.health',
                  revision: '1',
                  props: { label: 'overlay island', count: 3, pinned: false },
                },
                { role: 'list', id: 'ls.overlay', viewId: 'v.listPlain', titleField: 'title' },
                { role: 'view', id: 'sv.overlay-grid', viewId: 'v.gridEmpty' },
                {
                  role: 'chart',
                  id: 'ch.overlay-empty',
                  viewId: 'v.chartEmpty',
                  kind: 'bar',
                  xField: 'status',
                  yField: 'budget',
                  summary: 'Empty chart nested inside a dialog',
                  title: 'Nested empty chart',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's.rec',
      title: 'Record detail',
      breadcrumbs: [{ label: 'Home' }, { label: 'Record' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'tabs',
              id: 'tb.rec-tabs',
              tabs: [
                {
                  name: 'overview',
                  label: 'Overview',
                  surfaces: [
                    { role: 'detail', id: 'dt.rec', viewId: 'v.recDetail', emptyMessage: 'This record does not exist.' },
                    { role: 'list', id: 'ls.related', viewId: 'v.related', titleField: 'title', secondaryField: 'secondary', emptyMessage: 'Nothing derived yet.' },
                  ],
                },
                {
                  name: 'notes',
                  label: 'Notes',
                  surfaces: [
                    { role: 'text', id: 't.rec-notes', content: 'A long notes paragraph for the record: it repeats so the panel has real height and wrapping behavior at phone widths, exactly like the shipped applications produce.', level: 3 },
                  ],
                },
              ],
            },
            {
              role: 'drawer',
              id: 'dr.rec',
              title: 'Record drawer',
              triggerLabel: 'Open record drawer…',
              content: [
                { role: 'text', id: 't.drawer-note', content: 'A conversation nested inside a drawer overlay.' },
                {
                  role: 'conversation',
                  id: 'cv.drawer',
                  viewId: 'v.messages',
                  messageField: 'text',
                  authorField: 'author',
                  participantField: 'participant',
                  sendActionId: 'act.sendMessage',
                  inputLabel: 'Message (drawer)',
                  emptyMessage: 'No messages yet.',
                },
                { role: 'list', id: 'ls.drawer-empty', viewId: 'v.listEmpty', titleField: 'title', emptyMessage: 'The drawer list is empty.' },
              ],
            },
          ],
        },
      ],
      states: {
        failure: { role: 'text', id: 't.rec-failure', content: 'The record failed safely.' },
      },
    },
  ],
  views: [
    { viewId: 'v.grid', resourceId: 'catalog', resourceRevision: '1', fields: ['id', 'name', 'status', 'budget', 'owner', 'notes', 'code', 'updated'] },
    { viewId: 'v.gridEmpty', resourceId: 'catalog', resourceRevision: '1', fields: ['id', 'name'] },
    { viewId: 'v.listPlain', resourceId: 'catalog', resourceRevision: '1', fields: ['title'] },
    { viewId: 'v.listSecondary', resourceId: 'catalog', resourceRevision: '1', fields: ['title', 'secondary'] },
    { viewId: 'v.listUnbroken', resourceId: 'catalog', resourceRevision: '1', fields: ['title', 'secondary'] },
    { viewId: 'v.listEmpty', resourceId: 'catalog', resourceRevision: '1', fields: ['title'] },
    { viewId: 'v.detailRows', resourceId: 'catalog', resourceRevision: '1', fields: ['id', 'name', 'status', 'config', 'budget', 'owner', 'notes', 'updated'] },
    { viewId: 'v.detailEmpty', resourceId: 'catalog', resourceRevision: '1', fields: ['id', 'name'] },
    { viewId: 'v.recDetail', resourceId: 'catalog', resourceRevision: '1', fields: ['id', 'name', 'status', 'config', 'budget', 'owner', 'notes', 'updated', 'tags', 'flags'] },
    { viewId: 'v.related', resourceId: 'catalog', resourceRevision: '1', fields: ['title', 'secondary'] },
    { viewId: 'v.messages', resourceId: 'messages', resourceRevision: '1', fields: ['id', 'text', 'author', 'participant'] },
    { viewId: 'v.messagesEmpty', resourceId: 'messages', resourceRevision: '1', fields: ['id', 'text', 'author', 'participant'] },
    { viewId: 'v.chartBar', resourceId: 'catalog', resourceRevision: '1', fields: ['status', 'budget'] },
    { viewId: 'v.chartLine', resourceId: 'catalog', resourceRevision: '1', fields: ['month', 'value'] },
    { viewId: 'v.chartEmpty', resourceId: 'catalog', resourceRevision: '1', fields: ['status', 'budget'] },
    { viewId: 'v.chartOne', resourceId: 'catalog', resourceRevision: '1', fields: ['month', 'value'] },
    { viewId: 'v.chartEdge', resourceId: 'catalog', resourceRevision: '1', fields: ['label', 'value'] },
    { viewId: 'v.chartMany', resourceId: 'catalog', resourceRevision: '1', fields: ['label', 'value'] },
  ],
  resources: [{ resourceId: 'messages', revision: '1' }, { resourceId: 'catalog', revision: '1' }],
  actions: [
    {
      kind: 'mutation',
      id: 'act.sendMessage',
      revision: '1',
      resourceId: 'messages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'qa.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.messageDenied',
      revision: '1',
      resourceId: 'messages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'qa.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.messageThrows',
      revision: '1',
      resourceId: 'messages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'qa.message.input',
      inputContractRevision: '1',
    },
  ],
  components: [{ componentId: 'cmp.health', revision: '1' }],
} as const);

/**
 * The invalid-plan variant: identical shape but the component surface
 * references cmp.ghost, which the QA host registry deliberately does not
 * resolve. The REAL compiler accepts it (the declaration is well-formed);
 * the renderer's structural validation must produce the safe structured
 * failure panel in a real browser.
 */
const qaInvalidApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.qa.p4.invalid',
  revision: '1',
  routes: [{ id: 'home', path: '/', screenId: 's.slots' }],
  screens: [
    {
      id: 's.slots',
      title: 'Unresolvable slot',
      breadcrumbs: [{ label: 'Home' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'component',
              id: 'cm.ghost',
              componentId: 'cmp.ghost',
              revision: '1',
              props: { label: 'never resolves' },
            },
          ],
        },
      ],
    },
  ],
  views: [],
  resources: [{ resourceId: 'messages', revision: '1' }],
  actions: [],
  components: [{ componentId: 'cmp.ghost', revision: '1' }],
} as const);

function compileOrThrow(application: Parameters<typeof compileApplication>[0]['application'], components: readonly { componentId: string; revision: string }[]): ApplicationPlan {
  const result = compileApplication({
    application,
    resources: [messageResource, catalogResource],
    contracts: [{ id: 'qa.message.input', revision: '1' }],
    components: [...components],
  });
  if (!result.ok) {
    throw new Error(`qa definition invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

/** Compile the harness definitions through the real compiler. */
export function compileQaPlans(): { plan: ApplicationPlan; planInvalid: ApplicationPlan } {
  return {
    plan: compileOrThrow(qaApplication, [{ componentId: 'cmp.health', revision: '1' }]),
    planInvalid: compileOrThrow(qaInvalidApplication, [{ componentId: 'cmp.ghost', revision: '1' }]),
  };
}
