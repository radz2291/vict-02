import type { UiExtensionDescriptor, UiAuthoringRegistration, UiAuthoringFragment } from '@victframework/ui';
import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import ExtendedMessage from './ExtendedMessage.svelte';
import ExtendedPromptInput from './ExtendedPromptInput.svelte';
import Transcript from './Transcript.svelte';
import compatibility from './chat-extended-compatibility.json' with { type: 'json' };

const base = { abi: 'vict.ui-component-abi@1', events: ['vict.ui-component-abi@1'], rendererImplementationId: 'vict.svelte.ai.authoring', slots: [] } as const;
const string = (name: string, value = '') => ({ name, type: 'string' as const, default: value });
const flag = (name: string) => ({ name, type: 'boolean' as const, default: false });
const intent = (name: string, payload: 'string' | 'void' = 'void') => ({ name, payload, description: 'Host-bound request only; does not grant execution, acceptance or completion authority.' });
const message: UiExtensionDescriptor = {
  ...base, id: 'vict.ai.message', revision: '3', styleTargets: ['root','content','bubble','text','actions','copy','copy-tooltip','edit','edit-tooltip','retry','retry-tooltip','feedback-like','feedback-like-tooltip','feedback-dislike','feedback-dislike-tooltip'],
  props: [string('role','assistant'),string('text'),flag('copied'),string('feedback'),flag('copyEnabled'),flag('editEnabled'),flag('retryEnabled'),flag('feedbackEnabled')],
  outputs: [intent('copy'),intent('edit'),intent('retry'),intent('feedbackChange','string')],
  inspectionLimits: ['Action flags default false. The host must enable an action only after connecting its corresponding output; the renderer cannot inspect binding presence. copied and feedback are controlled presentation state; feedbackChange emits like, dislike or empty string for cleared feedback. Copy is an intent, not implicit clipboard access. User messages expose edit; assistant messages expose retry and feedback.'],
};
const prompt: UiExtensionDescriptor = {
  ...base, id: 'vict.ai.prompt-input', revision: '3', styleTargets: ['root','surface','field','actions','send','stop','attachments','attachment','attachment-remove','attach','footer'], slots: ['footer'],
  props: [string('value'),flag('busy'),string('label','Message'),string('placeholder','Write a message.'),string('data','{"version":1,"attachments":[]}'),flag('sendEnabled'),flag('stopEnabled'),flag('attachEnabled'),flag('removeAttachmentEnabled')],
  outputs: [intent('valueChange','string'),intent('send','string'),intent('stop'),intent('attach'),intent('removeAttachment','string')],
  inspectionLimits: ['data is strict bounded JSON {version:1,attachments:[{id,name}]}, maximum40 unique records,262144 characters. Metadata only; no file access/upload URLs. Bind value/valueChange; sending retains controlled text until the host confirms its action. Actions default disabled; attach requests a separately authorized host chooser. Footer is canonical authored composition.'],
};
const transcript: UiExtensionDescriptor = {
  ...base, id: 'vict.ai.transcript', revision: '1', styleTargets: ['root','surface','header','heading','description','reset','reset-tooltip','messages','message','message-content','message-text','timeline','activity','event-summary','copy','copy-tooltip','composer','composer-surface','composer-field','composer-actions','send','stop','footer','status'], slots: ['composer','footer'],
  props: [string('data','{"version":1,"messages":[]}'),flag('busy'),string('title'),string('description'),string('emptyMessage','How can I help?'),string('inputLabel','Message'),string('inputPlaceholder','Write a message.'),flag('stopEnabled'),flag('resetEnabled')],
  outputs: [intent('stop'),intent('reset')],
  inspectionLimits: ['Read-only host-supplied transcript through the public Conversation renderer. data is strict JSON {version:1,messages:[{id,role,text,author?,activity?,events?}]}, maximum120 messages,80 activities/message,240 events/message and262144 characters. Activities/stages are public execution receipts; summaries are provider-supported public summaries, never private chain of thought. Events support text,summary,activity,compaction; no generated trace. Composer slot accepts a separately controlled PromptInput; absent slot has disabled send, never fake transport success. Stop/reset are requests only. System-role rendering follows existing public Conversation behavior.'],
};
export const extendedChatDescriptors: readonly UiExtensionDescriptor[] = [message,prompt,transcript];
export const extendedChatImplementations: readonly UiSvelteComponentImplementation[] = extendedChatDescriptors.map((descriptor,index) => ({
  extensionId: descriptor.id, revision: descriptor.revision, rendererImplementationId: descriptor.rendererImplementationId!, abi: 'vict.ui-component-abi@1', slots: descriptor.slots ?? [], styleTargets: descriptor.styleTargets,
  component: [ExtendedMessage,ExtendedPromptInput,Transcript][index]!,
}));
export const extendedChatRegistrations: readonly UiAuthoringRegistration[] = extendedChatDescriptors.map((descriptor,index) => {
  const promptSeed: UiAuthoringFragment = { root:'composer', nodes:[{kind:'component',id:'composer',definitionId:'vict.ai.prompt-input',revision:'3',props:{value:{type:'ref',path:'state.message'}},outputs:{valueChange:{setState:{key:'message'}}}}],localState:{message:{key:'message',type:'string',initial:''}} };
  const seed: UiAuthoringFragment = index===1 ? promptSeed : index===0 ? {root:'ai',nodes:[{kind:'component',id:'ai',definitionId:descriptor.id,revision:descriptor.revision,props:{text:{type:'literal',value:'A supplied assistant response.'}}}]} : {
    root:'ai',nodes:[{kind:'component',id:'ai',definitionId:descriptor.id,revision:descriptor.revision,props:{data:{type:'literal',value:'{"version":1,"messages":[{"id":"welcome","role":"assistant","text":"A supplied public transcript.","events":[{"id":"public-step","kind":"activity","activity":{"id":"read","title":"Read project source","state":"completed","result":{"text":"Supplied public receipt"}}},{"id":"answer","kind":"text","text":"A supplied public transcript."}]}]}'}},slots:{composer:{name:'composer',children:['composer']}}},...promptSeed.nodes],localState:promptSeed.localState,
  };
  return { descriptor, label: ['Chat message with actions','Prompt input with attachments','Chat transcript'][index]!, family:'ai',category:'chat',purpose: ['Present a controlled message with explicit host action requests.','Compose text and supplied attachment metadata with typed host requests.','Present complete supplied chat messages and public execution events using the existing Conversation.'][index]!, eligibility:{kind:'standalone'}, dependencies:index===2?[{id:'vict.ai.prompt-input',revision:'3'}]:[], rules: index===0 ? [{kind:'controlledPair',prop:'feedback',output:'feedbackChange'}] : index===1 ? [{kind:'controlledPair',prop:'value',output:'valueChange'}] : [], seed,examples:[seed], guidance:[
    'Use existing VICT theme/ControlScope and @victframework/ui-ai-svelte/styles.css. Every action flag defaults false; enable only with a corresponding authorized output binding.',
    ...(descriptor.inspectionLimits ?? []),
    'Invalid structured data fails closed with a visible diagnostic. Unknown fields, duplicate IDs, oversized text and unsupported versions are rejected. Data never grants provider or execution access.',
  ] };
});
export const extendedChatCompatibility = compatibility;
