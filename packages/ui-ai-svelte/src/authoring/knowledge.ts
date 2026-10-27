import type { UiAuthoringPackage, UiAuthoringFragment } from '@victframework/ui';
import {
  aiConversationDescriptor,
  aiMessageDescriptor,
  aiPromptInputDescriptor,
  aiConversationDescriptorV2, aiMessageDescriptorV2, aiPromptInputDescriptorV2,
} from './descriptors.js';
import { specialistPublicExports } from './public-exports.js';
import compatibility from './compatibility.json' with { type: 'json' };
import presentationCompatibility from './compatibility-v2.json' with { type: 'json' };

const prompt: UiAuthoringFragment = {
  root: 'prompt',
  nodes: [
    {
      kind: 'component',
      id: 'prompt',
      definitionId: 'vict.ai.prompt-input',
      revision: '1',
      props: { value: { type: 'ref', path: 'state.message' } },
      outputs: { valueChange: { setState: { key: 'message' } } },
    },
  ],
  localState: { message: { key: 'message', type: 'string', initial: '' } },
};
const message: UiAuthoringFragment = {
  root: 'message',
  nodes: [
    {
      kind: 'component',
      id: 'message',
      definitionId: 'vict.ai.message',
      revision: '1',
      props: {
        role: { type: 'literal', value: 'assistant' },
        text: { type: 'literal', value: 'How can I help?' },
      },
    },
  ],
};
const conversation: UiAuthoringFragment = {
  root: 'conversation',
  nodes: [
    {
      kind: 'component',
      id: 'conversation',
      definitionId: 'vict.ai.conversation',
      revision: '1',
      slots: {
        messages: { name: 'messages', children: ['message'] },
        composer: { name: 'composer', children: ['prompt'] },
      },
    },
    ...message.nodes,
    ...prompt.nodes,
  ],
  localState: prompt.localState,
};

const legacyPackage: UiAuthoringPackage = {
  compatibility,
  schema: 'vict.ui-authoring@1',
  packageName: '@victframework/ui-ai-svelte',
  packageVersion: '0.4.0-rc.1',
  registrations: [
    {
      descriptor: aiConversationDescriptor,
      label: 'Conversation',
      family: 'ai',
      category: 'chat',
      purpose: 'Compose authored messages and a prompt input in a conversation presentation.',
      eligibility: { kind: 'standalone' },
      dependencies: [
        { id: aiMessageDescriptor.id, revision: '1' },
        { id: aiPromptInputDescriptor.id, revision: '1' },
      ],
      guidance: [
        'Messages and composer are explicit slots. Provider and tool execution require separately authorized host actions.',
        'The slotted shell adapts canonical child composition; the public code Conversation instead accepts structured messages and transport callbacks. Child Message and Prompt input adapters reuse the public presentation patterns.',
        'Import @victframework/ui-ai-svelte/styles.css for the pinned upstream presentation.',
      ],
      seed: conversation,
      examples: [conversation],
    },
    {
      descriptor: aiMessageDescriptor,
      label: 'Chat message',
      family: 'ai',
      category: 'chat',
      purpose: 'Render a user or assistant message using the pinned public Message presentation.',
      eligibility: { kind: 'standalone' },
      guidance: [
        'role is user or assistant. Other role strings use assistant presentation.',
        'No copy/edit/retry controls are advertised by this adapter. Assistant text uses the package safe Markdown presentation; user text is plain text.',
      ],
      seed: message,
      examples: [message],
    },
    {
      descriptor: aiPromptInputDescriptor,
      label: 'Prompt input',
      family: 'ai',
      category: 'chat',
      purpose: 'Controlled text composer with typed change, send and stop intents.',
      eligibility: { kind: 'standalone' },
      rules: [
        { kind: 'controlledPair', prop: 'value', output: 'valueChange' },
        { kind: 'labelOwnership', mode: 'component', property: 'label' },
      ],
      guidance: [
        'Bind value and valueChange to string local state to retain edits.',
        'send emits a trimmed nonempty string without clearing the source-controlled value. Enter submits; Shift+Enter inserts a line. While busy only stop is emitted.',
        'Sending does not execute a provider. Bind outputs to existing authorized host actions separately.',
      ],
      seed: prompt,
      examples: [prompt],
    },
  ],
  exportDispositions: [
    {
      name: './authoring',
      disposition: 'registered',
      reason: 'Only the three exact ABI adapters above are authored through this entry.',
    },
    ...specialistPublicExports.map((name) => ({
      name,
      disposition: name.startsWith('./authoring:')
        ? 'registration-api'
        : [
              'captureRenderedElement',
              'RENDER_CAPTURE_LIMITS',
              'conversationMessages',
              'appendConversationEvent',
            ].includes(name)
          ? 'excluded'
          : 'host-only',
      reason: name.startsWith('./authoring:')
        ? 'Descriptor, implementation or knowledge install data. Only exact registered descriptor identities are authored.'
        : ['ConversationToolPayload','SendAccepted'].includes(name)
          ? 'Public host Conversation transport/payload TypeScript type; not an authorable component or execution capability.'
        : 'Public code composition/type/helper API, not an automatically installed VICT authoring adapter.',
    })),
    ...['./patterns', './components/*', './markdown'].map((name) => ({
      name,
      disposition: 'host-only',
      reason: 'Public code composition subpath; not automatically authorable.',
    })),
  ],
};

const presentationDescriptors = [aiConversationDescriptorV2, aiMessageDescriptorV2, aiPromptInputDescriptorV2];
function presentationFragment(fragment: UiAuthoringFragment | undefined): UiAuthoringFragment | undefined {
  if (!fragment) return undefined;
  return {...fragment,nodes:fragment.nodes.map(node=>node.kind==='component'&&presentationDescriptors.some(descriptor=>descriptor.id===node.definitionId)?{...node,revision:'2'}:node)};
}
export const aiAuthoringPackage: UiAuthoringPackage = {
  ...legacyPackage,
  compatibility: [...compatibility, ...presentationCompatibility],
  registrations: [
    ...legacyPackage.registrations,
    ...legacyPackage.registrations.map(registration => ({
      ...registration,
      descriptor: presentationDescriptors.find(descriptor=>descriptor.id===registration.descriptor.id)!,
      dependencies: registration.dependencies?.map(dependency=>({...dependency,revision:'2'})),
      seed: presentationFragment(registration.seed),
      examples: registration.examples?.map(example=>presentationFragment(example)!),
      guidance: [...registration.guidance ?? [],
        'Revision 2 exposes real semantic parts. Use canonical partStyles or setPartStyleDeclaration with a declared target, property and typed value; root-only styles retain revision 1 behavior.',
        'Application theme uses document.theme schema vict.ui-theme@1 and semantic roles, inherited by owned popup surfaces independently of Studio chrome. Parts can attach shared conditional/pseudo-state style sources.',
        `Editable surfaces: ${presentationDescriptors.find(descriptor=>descriptor.id===registration.descriptor.id)!.styleTargets!.join(', ')}.`,
      ],
    })),
  ],
};
