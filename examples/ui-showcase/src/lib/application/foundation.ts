import { APPLICATION_DEFINITION_SCHEMA_V2, type ApplicationDefinition } from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import { resourceList, registryContracts } from './data.js';

export const foundationApplication: ApplicationDefinition = {
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.foundation',
  revision: '1',
  name: 'VICT',
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
  resources: ['gallerySubmissions', 'galleryMessages', 'demo'].map((resourceId) => ({
    resourceId,
    revision: '1',
  })),
  routes: [
    { id: 'home', path: '/', redirect: 'records' },
    {
      id: 'records',
      path: '/records',
      screenId: 's.records',
      nav: { label: 'Requests', group: 'Team workspace', order: 1 },
    },
    {
      id: 'workspace',
      path: '/workspace',
      screenId: 's.workspace',
      nav: { label: 'Conversation', group: 'Team workspace', order: 2 },
    },
  ],
  screens: [
    {
      id: 's.records',
      title: 'Requests',
      layoutMode: 'split',
      breadcrumbs: [{ label: 'Team workspace' }, { label: 'Requests' }],
      layout: [
        {
          name: 'intro',
          flow: 'stack',
          surfaces: [
            {
              role: 'status',
              id: 'records.status',
              value: 'Intake open',
              tones: { 'Intake open': 'success' },
            },
            { role: 'text', id: 'records.heading', level: 2, content: 'Good work starts here.' },
            {
              role: 'text',
              id: 'records.description',
              content:
                'A shared place for the team’s next priorities. Review a request, or put a new idea on the board.',
            },
          ],
        },
        {
          name: 'requests',
          size: 'main',
          surfaces: [
            {
              role: 'table',
              id: 'records.table',
              viewId: 'v.requests',
              searchFields: ['name', 'comment'],
              pageSize: 6,
              columns: [
                { field: 'name', label: 'Request', sortable: true },
                { field: 'comment', label: 'Team', sortable: true },
                { field: 'rank', label: 'Priority', sortable: true },
              ],
              emptyMessage: 'No matching requests. Try another search or add a new request.',
            },
          ],
        },
        {
          name: 'new-request',
          size: 'aside',
          appearance: 'panel',
          surfaces: [
            { role: 'text', id: 'records.form-title', level: 2, content: 'New request' },
            {
              role: 'text',
              id: 'records.form-hint',
              content: 'Give the team a clear starting point.',
            },
            { role: 'form', id: 'records.form', formId: 'f.request' },
          ],
        },
        {
          name: 'support',
          flow: 'inline',
          surfaces: [
            {
              role: 'drawer',
              id: 'records.guide',
              triggerLabel: 'How prioritisation works',
              title: 'A little clarity goes a long way',
              content: [
                {
                  role: 'text',
                  id: 'guide.body',
                  content:
                    'Priority is a score from 0 to 100. Use a higher score for work with a nearer deadline or greater impact. Zero is a valid score.',
                },
                {
                  role: 'text',
                  id: 'guide.followup',
                  content:
                    'Mark “Needs follow-up” when a request needs more context before the team can act on it.',
                },
                {
                  role: 'dialog',
                  id: 'guide.dialog',
                  title: 'Review this guidance',
                  triggerLabel: 'Review guidance',
                  content: [
                    {
                      role: 'text',
                      id: 'guide.review',
                      content:
                        'Keep priorities visible and revisit them together. This local review records a deterministic acknowledgement.',
                    },
                    { role: 'action', id: 'guide.ack', actionId: 'act.ack', label: 'Acknowledge' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's.workspace',
      title: 'Conversation',
      layoutMode: 'split',
      breadcrumbs: [{ label: 'Team workspace' }, { label: 'Product direction' }],
      layout: [
        {
          name: 'intro',
          surfaces: [
            {
              role: 'status',
              id: 'workspace.status',
              value: 'Ready to collaborate',
              tones: { 'Ready to collaborate': 'info' },
            },
            {
              role: 'text',
              id: 'workspace.heading',
              level: 2,
              content: 'A quieter place to think.',
            },
            {
              role: 'text',
              id: 'workspace.description',
              content:
                'Bring the conversation and its context together. Shape the next step with your team.',
            },
          ],
        },
        {
          name: 'conversation',
          size: 'main',
          surfaces: [
            {
              role: 'tabs',
              id: 'workspace.tabs',
              tabs: [
                {
                  name: 'conversation',
                  label: 'Conversation',
                  surfaces: [
                    {
                      role: 'conversation',
                      id: 'workspace.chat',
                      viewId: 'v.messages',
                      messageField: 'text',
                      authorField: 'author',
                      participantField: 'participant',
                      sendActionId: 'act.send',
                      inputLabel: 'Your message',
                      inputPlaceholder: 'Add a thought or ask a question…',
                      emptyMessage: 'Start the conversation.',
                    },
                  ],
                },
                {
                  name: 'requests',
                  label: 'Linked requests',
                  surfaces: [
                    {
                      role: 'list',
                      id: 'workspace.requests',
                      viewId: 'v.requests',
                      titleField: 'name',
                      secondaryField: 'comment',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          name: 'context',
          size: 'aside',
          appearance: 'panel',
          surfaces: [
            { role: 'text', id: 'workspace.context-title', level: 2, content: 'Working context' },
            { role: 'text', id: 'workspace.context-label', level: 3, content: 'Product direction' },
            {
              role: 'text',
              id: 'workspace.context-body',
              content:
                'Make everyday work feel more considered. Start with the essentials, keep decisions visible, and leave room for different ways of working.',
            },
            { role: 'text', id: 'workspace.next-title', level: 3, content: 'Next checkpoint' },
            {
              role: 'text',
              id: 'workspace.next-body',
              content:
                'Review the first direction together before expanding the component library.',
            },
            {
              role: 'dialog',
              id: 'workspace.review',
              title: 'Review the working brief',
              triggerLabel: 'Review brief',
              content: [
                {
                  role: 'text',
                  id: 'workspace.review-body',
                  content:
                    'This is an early foundation review. Check the hierarchy, spacing, controls, and how the workspace feels on a smaller screen.',
                },
                {
                  role: 'action',
                  id: 'workspace.ack',
                  actionId: 'act.ack',
                  label: 'Acknowledge brief',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  views: [
    {
      viewId: 'v.requests',
      resourceId: 'gallerySubmissions',
      resourceRevision: '1',
      fields: ['id', 'name', 'comment', 'rank', 'zeroCheck'],
    },
    {
      viewId: 'v.messages',
      resourceId: 'galleryMessages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
  ],
  forms: [
    {
      formId: 'f.request',
      resourceId: 'gallerySubmissions',
      resourceRevision: '1',
      inputContractId: 'showcase.gallery.input',
      fields: [
        { name: 'name', label: 'Request name', widget: 'text', required: true },
        {
          name: 'comment',
          label: 'Team',
          widget: 'select',
          required: true,
          options: [
            { value: 'Product', label: 'Product' },
            { value: 'Engineering', label: 'Engineering' },
            { value: 'Operations', label: 'Operations' },
          ],
        },
        { name: 'rank', label: 'Priority score · 0–100', widget: 'number', required: true },
        { name: 'zeroCheck', label: 'Needs follow-up', widget: 'boolean' },
      ],
      submitActionId: 'act.create',
    },
  ],
  actions: [
    {
      kind: 'mutation',
      id: 'act.create',
      revision: '1',
      resourceId: 'gallerySubmissions',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.gallery.input',
    },
    {
      kind: 'mutation',
      id: 'act.send',
      revision: '1',
      resourceId: 'galleryMessages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.message.input',
    },
    {
      kind: 'mutation',
      id: 'act.ack',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'succeed',
      inputContractId: 'showcase.demo.input',
    },
  ],
};

export const foundationSeeds = {
  gallerySubmissions: [
    {
      id: 'REQ-001',
      name: 'Refresh the onboarding flow',
      comment: 'Product',
      rank: 90,
      zeroCheck: true,
    },
    {
      id: 'REQ-002',
      name: 'Simplify account settings',
      comment: 'Engineering',
      rank: 75,
      zeroCheck: false,
    },
    {
      id: 'REQ-003',
      name: 'Prepare the launch checklist',
      comment: 'Operations',
      rank: 70,
      zeroCheck: false,
    },
    {
      id: 'REQ-004',
      name: 'Explore a calmer workspace',
      comment: 'Product',
      rank: 65,
      zeroCheck: true,
    },
    {
      id: 'REQ-005',
      name: 'Improve keyboard navigation',
      comment: 'Engineering',
      rank: 60,
      zeroCheck: false,
    },
    {
      id: 'REQ-006',
      name: 'Review team permissions',
      comment: 'Operations',
      rank: 45,
      zeroCheck: true,
    },
  ],
  galleryMessages: [
    {
      id: 'M-01',
      author: 'Maya',
      participant: 'user',
      text: 'Let’s make the workspace feel calmer. The essentials should be easy to find, with space for the work itself.',
      createdAt: '2026-09-26T08:00:00+08:00',
    },
    {
      id: 'M-02',
      author: 'Assistant',
      participant: 'assistant',
      text: 'A useful starting point: one clear primary task per view.\n\nRequests can stay compact and scannable. Conversations can have a wider reading area, with supporting context alongside.',
      createdAt: '2026-09-26T08:01:00+08:00',
    },
    {
      id: 'M-03',
      author: 'Maya',
      participant: 'user',
      text: 'Yes. Keep the controls consistent, and make sure both views work just as well on a phone.',
      createdAt: '2026-09-26T08:02:00+08:00',
    },
  ],
};

export function compileFoundationPlan() {
  const result = compileApplication({
    application: foundationApplication,
    resources: resourceList,
    contracts: [...registryContracts],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}
