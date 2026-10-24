import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import Conversation from './Conversation.svelte';
import Message from './Message.svelte';
import PromptInput from './PromptInput.svelte';
export const aiAuthoringImplementations: readonly UiSvelteComponentImplementation[] = [
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
