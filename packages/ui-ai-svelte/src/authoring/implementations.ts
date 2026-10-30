import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import Conversation from './Conversation.svelte';
import Message from './Message.svelte';
import PromptInput from './PromptInput.svelte';
import { aiConversationDescriptorV2, aiMessageDescriptorV2, aiPromptInputDescriptorV2 } from './descriptors.js';
import { publicPatternImplementations } from './public-patterns.js';
import { actionPatternImplementations } from './action-patterns.js';
import { extendedChatImplementations } from './chat-extended.js';
const legacyImplementations: readonly UiSvelteComponentImplementation[] = [
  {
    extensionId: 'vict.ai.conversation',
    revision: '1',
    rendererImplementationId: 'vict.svelte.ai.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: ['messages', 'composer'],
    component: Conversation,
  },
  {
    extensionId: 'vict.ai.message',
    revision: '1',
    rendererImplementationId: 'vict.svelte.ai.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: Message,
  },
  {
    extensionId: 'vict.ai.prompt-input',
    revision: '1',
    rendererImplementationId: 'vict.svelte.ai.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: PromptInput,
  },
];
export const aiAuthoringImplementations: readonly UiSvelteComponentImplementation[] = [
  ...legacyImplementations,
  ...[aiConversationDescriptorV2, aiMessageDescriptorV2, aiPromptInputDescriptorV2].map(descriptor => ({
    ...legacyImplementations.find(item => item.extensionId === descriptor.id)!,
    revision: descriptor.revision, styleTargets: descriptor.styleTargets,
  })),
  ...publicPatternImplementations,
  ...actionPatternImplementations,
  ...extendedChatImplementations,
];
