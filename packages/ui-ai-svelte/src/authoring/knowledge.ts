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
import { publicPatternRegistrations, publicPatternCompatibility } from './public-patterns.js';
import { actionPatternRegistrations, actionPatternCompatibility } from './action-patterns.js';
import { extendedChatRegistrations, extendedChatCompatibility } from './chat-extended.js';

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
  // The final package supplies the complete AI-EX01 export dispositions below.
  exportDispositions: [],
};

const presentationDescriptors = [aiConversationDescriptorV2, aiMessageDescriptorV2, aiPromptInputDescriptorV2];
function presentationFragment(fragment: UiAuthoringFragment | undefined): UiAuthoringFragment | undefined {
  if (!fragment) return undefined;
  return {...fragment,nodes:fragment.nodes.map(node=>node.kind==='component'&&presentationDescriptors.some(descriptor=>descriptor.id===node.definitionId)?{...node,revision:'2'}:node)};
}

/** AI-EX01 maps intended public compositions to real registered identities.
 * Low-level building blocks and transport types are not duplicate components. */
const publicCompositionIds: Readonly<Record<string, string>> = {
  ChainOfThought: 'vict.ai.chain-of-thought', Chat: 'vict.ai.transcript',
  Checkpoint: 'vict.ai.checkpoint', Confirmation: 'vict.ai.confirmation',
  Context: 'vict.ai.context', FileTree: 'vict.ai.file-tree',
  InlineCitation: 'vict.ai.inline-citation', Message: 'vict.ai.message',
  ModelSelector: 'vict.ai.model-selector', Plan: 'vict.ai.plan',
  PromptInput: 'vict.ai.prompt-input', Queue: 'vict.ai.queue',
  Reasoning: 'vict.ai.reasoning', Sources: 'vict.ai.sources',
  StackTrace: 'vict.ai.stack-trace', Subagent: 'vict.ai.subagent',
  Suggestion: 'vict.ai.suggestion', Task: 'vict.ai.task', Terminal: 'vict.ai.terminal',
  TestResults: 'vict.ai.test-results', Tool: 'vict.ai.tool',
};
const exposureDispositions: UiAuthoringPackage['exportDispositions'] = [
  {name:'./authoring',disposition:'registered',reason:'Exact versioned descriptors, implementations, seeds and contracts install all intended public AI pattern compositions through one manual/agent registry.'},
  ...specialistPublicExports.map(name => {
    const patternName=name.startsWith('./patterns:')?name.slice('./patterns:'.length):undefined;
    const id=patternName?publicCompositionIds[patternName]:name==='Conversation'?'vict.ai.transcript':name==='Markdown'?'vict.ai.markdown':undefined;
    if(id)return {name,disposition:'registered',reason:`Public composition is authorable through ${id}; descriptor revisions, parts, data validation and typed outputs are explicit. Host actions remain requests, not execution authority.`};
    if(name.startsWith('./authoring:'))return {name,disposition:'registration-api',reason:'Package installation API; exact component identities are delivered by the installed registry.'};
    if(['Patterns','./patterns','./patterns:aiElementPatterns'].includes(name))return {name,disposition:'registered-compositions',reason:'The twenty-one intended public pattern compositions have explicit installed adapters; the namespace/list is not itself an insertable component.'};
    if(['PatternShowcase','PrimitiveShowcase','./patterns:PatternShowcase'].includes(name))return {name,disposition:'fixture-only',reason:'Demonstration gallery, not a reusable authored application or proof of backend behavior.'};
    if(['captureRenderedElement','RENDER_CAPTURE_LIMITS','RenderedCapture'].includes(name))return {name,disposition:'observation-infrastructure',reason:'Bounded capture API/type supports observation; it is not an authored visual component.'};
    if(['conversationMessages','appendConversationEvent','ConversationActivity','ConversationEvent','ConversationMessage','ConversationToolPayload','SendAccepted','SendResult'].includes(name)||['./patterns:AIElementPattern','./patterns:Step','./patterns:Citation','./patterns:FileNode','./patterns:ModelOption'].includes(name))return {name,disposition:'host-data-api',reason:'Serializable presentation/transport type or bounded helper; intended visual capabilities are exposed through registered compositions without adding transport authority.'};
    return {name,disposition:'composition-primitive',reason:'Pinned low-level UI building block reused by registered AI patterns or the shared VICT catalog; a duplicate standalone authoring identity is not required for this internal composition surface.'};
  }),
  {name:'./components/*',disposition:'composition-primitive',reason:'Public low-level component subpaths support the registered compositions; they do not each introduce another authoring identity.'},
  {name:'./markdown',disposition:'registered',reason:'Public safe standalone Markdown is authorable through vict.ai.markdown@1, reusing the existing renderer without introducing authored script execution.'},
];
const withHostBounds = (registration: UiAuthoringPackage['registrations'][number]): UiAuthoringPackage['registrations'][number] => ({
  ...registration,
  guidance: [...registration.guidance ?? [], 'The adapter data-schema limit and the host authoring-tool delivery limit are separate. Respect the current tool string/body bounds; never truncate supplied records or issue independently invalid partial JSON writes.'],
});
export const aiAuthoringPackage: UiAuthoringPackage = {
  ...legacyPackage,
  exportDispositions: exposureDispositions,
  compatibility: [...compatibility, ...presentationCompatibility, ...publicPatternCompatibility, ...actionPatternCompatibility, ...extendedChatCompatibility],
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
    ...publicPatternRegistrations.map(withHostBounds),
    ...actionPatternRegistrations.map(withHostBounds),
    ...extendedChatRegistrations.map(withHostBounds),
  ],
};
