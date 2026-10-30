import type { UiExtensionDescriptor } from '@victframework/ui';
import { publicPatternDescriptors } from './public-patterns.js';
import { actionPatternDescriptors } from './action-patterns.js';
import { extendedChatDescriptors } from './chat-extended.js';
const base = {
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  rendererImplementationId: 'vict.svelte.ai.authoring',
  styleTargets: ['root'],
} as const;
export const aiConversationDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.ai.conversation',
  props: [{ name: 'label', type: 'string', default: 'Conversation' }],
  slots: ['messages', 'composer'],
  outputs: [],
  inspectionLimits: ['Presentation slots only. No provider, agent, shell or execution authority.'],
};
export const aiMessageDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.ai.message',
  props: [
    { name: 'role', type: 'string', default: 'assistant' },
    { name: 'text', type: 'string', default: '' },
  ],
  slots: [],
  outputs: [],
  inspectionLimits: [
    'Role is user or assistant; other values use assistant presentation. No unimplemented action controls.',
  ],
};
export const aiPromptInputDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.ai.prompt-input',
  props: [
    { name: 'value', type: 'string', default: '' },
    { name: 'busy', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: 'Message' },
    { name: 'placeholder', type: 'string', default: 'Write a message…' },
  ],
  slots: [],
  outputs: [
    {
      name: 'valueChange',
      payload: 'string',
      description: 'Controlled value request; connect to string local state for editable input.',
    },
    {
      name: 'send',
      payload: 'string',
      description:
        'Submit nonempty trimmed authored value while not busy. Does not clear the value or execute a provider.',
    },
    {
      name: 'stop',
      payload: 'void',
      description: 'Stop intent while busy. No implicit cancellation authority.',
    },
  ],
  inspectionLimits: [
    'Controlled scalar value. Host-authored output bindings decide state and actions. No attachment, provider or execution API.',
  ],
};
export const legacyAiAuthoringDescriptors = [
  aiConversationDescriptor,
  aiMessageDescriptor,
  aiPromptInputDescriptor,
] as const;
/** Revision 1 remains byte-compatible; new authoring explicitly selects revision 2. */
export const aiConversationDescriptorV2: UiExtensionDescriptor = { ...aiConversationDescriptor, revision: '2', styleTargets: ['root', 'surface', 'messages', 'composer'] };
export const aiMessageDescriptorV2: UiExtensionDescriptor = { ...aiMessageDescriptor, revision: '2', styleTargets: ['root', 'content', 'bubble', 'text'] };
export const aiPromptInputDescriptorV2: UiExtensionDescriptor = { ...aiPromptInputDescriptor, revision: '2', styleTargets: ['root', 'surface', 'field', 'actions', 'send', 'stop'] };
export const aiAuthoringDescriptors = [...legacyAiAuthoringDescriptors, aiConversationDescriptorV2, aiMessageDescriptorV2, aiPromptInputDescriptorV2, ...publicPatternDescriptors, ...actionPatternDescriptors, ...extendedChatDescriptors] as const;
