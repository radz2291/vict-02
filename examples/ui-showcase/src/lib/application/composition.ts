import { type ApplicationDefinition, type ScreenDefinition } from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import { foundationApplication } from './foundation.js';
import { resourceList, registryContracts } from './data.js';

const requestsScreen = foundationApplication.screens[0]!;
const requestForm = foundationApplication.forms![0]!;
const shared = {
  schema: foundationApplication.schema,
  revision: '1',
  resources: foundationApplication.resources,
  views: foundationApplication.views,
  compatibility: foundationApplication.compatibility,
};
const feedbackReview: ScreenDefinition = {
  id: 's.feedback',
  title: 'Save feedback review',
  composition: { contentWidth: 'standard', density: 'comfortable' },
  layout: [
    {
      name: 'intro',
      surfaces: [
        { role: 'text', id: 'review.title', level: 2, content: 'When a save needs attention' },
        {
          role: 'text',
          id: 'review.description',
          content:
            'These review forms use deterministic server responses. Your draft stays available so you can act on the result.',
        },
      ],
    },
    {
      name: 'examples',
      surfaces: [
        {
          role: 'tabs',
          id: 'review.tabs',
          tabs: [
            {
              name: 'failure',
              label: 'Server failure',
              surfaces: [{ role: 'form', id: 'review.failure', formId: 'f.failure' }],
            },
            {
              name: 'denial',
              label: 'Access denied',
              surfaces: [{ role: 'form', id: 'review.denial', formId: 'f.denial' }],
            },
          ],
        },
      ],
    },
  ],
};
export const requestsApplication: ApplicationDefinition = {
  ...shared,
  id: 'app.requests',
  name: 'Requests',
  components: [{ componentId: 'cmp.request-planner', revision: '1' }],
  composition: {
    navigation: 'sidebar',
    contentWidth: 'wide',
    density: 'compact',
    responsive: { navigationAt: 'small' },
  },
  routes: [
    { id: 'home', path: '/', redirect: 'requests' },
    {
      id: 'requests',
      path: '/requests',
      screenId: 's.records',
      nav: { label: 'All requests', group: 'Team intake', order: 1 },
    },
    {
      id: 'feedback',
      path: '/requests/feedback',
      screenId: 's.feedback',
      nav: { label: 'Save feedback review', group: 'Team intake', order: 2 },
    },
    {
      id: 'schedule',
      path: '/requests/schedule',
      screenId: 's.schedule',
      nav: { label: 'Plan a request', group: 'Team intake', order: 3 },
    },
  ],
  screens: [
    {
      ...requestsScreen,
      title: 'All requests',
      composition: { supportingWidth: 'standard', stackAt: 'large' },
      breadcrumbs: [{ label: 'Team intake' }, { label: 'All requests' }],
      layout: requestsScreen.layout.map((region) =>
        region.name === 'intro'
          ? {
              ...region,
              surfaces: [
                {
                  role: 'text',
                  id: 'requests.heading',
                  level: 2,
                  content: 'Make room for what’s next.',
                },
                {
                  role: 'text',
                  id: 'requests.intro',
                  content: 'Review the team’s priorities and add a request.',
                },
              ],
            }
          : region,
      ),
    },
    feedbackReview,
    {
      id: 's.schedule',
      title: 'Plan a request',
      composition: { contentWidth: 'standard', density: 'comfortable' },
      layout: [
        {
          name: 'planner',
          appearance: 'panel',
          surfaces: [
            {
              role: 'component',
              id: 'requests.planner',
              componentId: 'cmp.request-planner',
              revision: '1',
              props: { submitActionId: 'act.create' },
            },
          ],
        },
      ],
    },
  ],
  forms: [
    requestForm,
    ...['failure', 'denial'].map((kind) => ({
      formId: 'f.' + kind,
      resourceId: 'demo',
      resourceRevision: '1',
      inputContractId: 'showcase.demo.input',
      fields: [{ name: 'note', label: 'Request', widget: 'text' as const, required: true }],
      submitActionId: 'act.' + kind,
    })),
  ],
  actions: [
    ...foundationApplication.actions.map((action) =>
      action.id === 'act.create'
        ? {
            ...action,
            feedback: {
              success: 'Request saved. It’s now in the team’s queue.',
              validation: 'The request could not be saved. Check its details and try again.',
            },
          }
        : action,
    ),
    {
      kind: 'mutation',
      id: 'act.failure',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'fail',
      inputContractId: 'showcase.demo.input',
      feedback: {
        failure: 'We couldn’t save your request. Your draft is still here. Try Save again.',
      },
    },
    {
      kind: 'mutation',
      id: 'act.denial',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'deny',
      inputContractId: 'showcase.demo.input',
      feedback: {
        denied:
          'You don’t have permission to save this request. Ask a workspace owner for access; your draft is still here.',
      },
    },
  ],
};
export const workspaceApplication: ApplicationDefinition = {
  ...shared,
  id: 'app.workspace',
  name: 'Workspace',
  composition: {
    navigation: 'top',
    contentWidth: 'wide',
    density: 'comfortable',
    responsive: { navigationAt: 'medium' },
  },
  routes: [
    {
      id: 'conversation',
      path: '/workspace',
      screenId: 's.conversation',
      nav: { label: 'Conversation', order: 1 },
    },
    {
      id: 'notes',
      path: '/workspace/notes',
      screenId: 's.notes',
      nav: { label: 'Shared notes', order: 2 },
    },
  ],
  forms: [],
  actions: foundationApplication.actions.filter((action) => action.id === 'act.send'),
  screens: [
    {
      id: 's.conversation',
      title: 'Product direction',
      layoutMode: 'split',
      composition: { supportingWidth: 'narrow', stackAt: 'medium' },
      layout: [
        {
          name: 'conversation',
          size: 'main',
          surfaces: [
            {
              role: 'conversation',
              id: 'workspace.chat',
              viewId: 'v.messages',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.send',
              inputLabel: 'Add to the conversation',
              inputPlaceholder: 'Share a thought or ask a question…',
              emptyMessage: 'Start the conversation.',
            },
          ],
        },
        {
          name: 'context',
          size: 'aside',
          surfaces: [
            { role: 'text', id: 'context.heading', level: 2, content: 'In this space' },
            {
              role: 'status',
              id: 'context.status',
              value: 'Exploring',
              tones: { Exploring: 'info' },
            },
            {
              role: 'text',
              id: 'context.description',
              content: 'A calmer workspace, with room for the work itself.',
            },
            { role: 'text', id: 'context.focus', level: 3, content: 'Current focus' },
            {
              role: 'text',
              id: 'context.notes',
              content: 'One clear task per view. Consistent controls. Comfortable on a phone.',
            },
            { role: 'text', id: 'context.people', level: 3, content: 'Working together' },
            { role: 'text', id: 'context.members', content: 'Maya · Product team · Assistant' },
          ],
        },
      ],
    },
    {
      id: 's.notes',
      title: 'Shared notes',
      composition: { contentWidth: 'standard' },
      layout: [
        {
          name: 'notes',
          surfaces: [
            { role: 'text', id: 'notes.title', level: 2, content: 'Keep the essentials close.' },
            {
              role: 'text',
              id: 'notes.body',
              content:
                'The conversation is our primary workspace. Supporting context stays alongside it on desktop and follows it on small screens.',
            },
          ],
        },
      ],
    },
  ],
};
export function compileCompositionPlan(application: ApplicationDefinition) {
  const result = compileApplication({
    application,
    resources: resourceList,
    contracts: [...registryContracts],
    components: [{ componentId: 'cmp.request-planner', revision: '1' }],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}
