/**
 * EXAMPLE — conversation surface backed by a view and a governed send action.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/conversation.ts
 */
import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@victframework/sdk';

export const resources = [
  defineResource({
    schema: RESOURCE_DEFINITION_SCHEMA,
    id: 'messages',
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string', required: true, label: 'Id' },
      { name: 'text', type: 'string', required: true, label: 'Message' },
      { name: 'author', type: 'string', label: 'Author' },
    ],
    mutations: [
      { op: 'create', effect: 'write', inputContractId: 'message.send.input', idempotency: 'keyed', permissions: ['messages.write'] },
    ],
    authorization: { effect: 'read' },
  }),
];

/** The compiler reads identity entries for contracts. */
export const contracts = [{ id: 'message.send.input', revision: '1' }];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.conversation',
  revision: '1',
  name: 'Conversation example',
  routes: [{ id: 'chat', path: '/chat', screenId: 's.chat', nav: { label: 'Chat', order: 1 } }],
  screens: [
    {
      id: 's.chat',
      title: 'Chat',
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
              sendActionId: 'act.send',
              inputLabel: 'Message',
              inputPlaceholder: 'Type a message…',
              emptyMessage: 'No messages yet.',
            },
          ],
        },
      ],
    },
  ],
  views: [
    {
      viewId: 'v.messages',
      resourceId: 'messages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author'],
      sort: [{ field: 'id', direction: 'asc' }],
    },
  ],
  forms: [],
  actions: [
    {
      kind: 'mutation',
      id: 'act.send',
      revision: '1',
      resourceId: 'messages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'message.send.input',
      feedback: { success: 'Message sent.', failure: 'The message was not sent.' },
    },
  ],
  resources: [{ resourceId: 'messages', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
