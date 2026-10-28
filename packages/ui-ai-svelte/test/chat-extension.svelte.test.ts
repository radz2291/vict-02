import { describe,it,expect,afterEach } from 'vitest';
import { mount,unmount,flushSync } from 'svelte';
import { authoringDigest,authoringImplementationCapabilities } from '@victframework/ui';
import { extendedChatDescriptors,extendedChatImplementations,extendedChatCompatibility } from '../src/authoring/chat-extended.js';
import { parseAttachmentData,parseTranscriptData } from '../src/authoring/chat-extension-data.js';
import ExtendedMessage from '../src/authoring/ExtendedMessage.svelte';
import ExtendedPromptInput from '../src/authoring/ExtendedPromptInput.svelte';
import Transcript from '../src/authoring/Transcript.svelte';
import Conversation from '../src/Conversation.svelte';
import ChatPartsHarness from './ChatPartsHarness.svelte';
const mounted: ReturnType<typeof mount>[]=[];
const target=()=>{const value=document.createElement('div');document.body.append(value);return value;};
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,20));flushSync();};
afterEach(async()=>{for(const component of mounted.splice(0)) await unmount(component);document.body.replaceChildren();});
describe('extended chat authoring contracts',()=>{
  it('retains exact new descriptors and renderer capabilities',()=>{
    const pins=extendedChatDescriptors.map((descriptor,index)=>({id:descriptor.id,revision:descriptor.revision,descriptorDigest:authoringDigest(descriptor),capabilitiesDigest:authoringDigest(authoringImplementationCapabilities(extendedChatImplementations[index]!))}));
    expect(pins).toEqual(extendedChatCompatibility);
    expect(extendedChatDescriptors.map(item=>`${item.id}@${item.revision}`)).toEqual(['vict.ai.message@3','vict.ai.prompt-input@3','vict.ai.transcript@1']);
  });
  it('accepts complete supplied public transcript evidence and rejects unknown/private fields, duplicate IDs and oversized data',()=>{
    const activity={id:'tool1',title:'Read source',state:'completed',input:{text:'file.ts',redacted:true},result:{text:'Observed contents'},stages:[{id:'receipt1',title:'Completed read',state:'completed'}]};
    const messages=[{id:'assistant',role:'assistant',text:'Done',activity:[activity],events:[{id:'event1',kind:'activity',activity},{id:'summary1',kind:'summary',text:'Public provider summary'},{id:'compact',kind:'compaction',omitted:2,text:'Earlier public entries omitted'}]}];
    expect(parseTranscriptData(JSON.stringify({version:1,messages}))).toEqual(messages);
    expect(()=>parseTranscriptData(JSON.stringify({version:1,messages:[{id:'a',role:'assistant',text:'',privateReasoning:'secret'}]}))).toThrow('Unknown');
    expect(()=>parseTranscriptData(JSON.stringify({version:1,messages:[{id:'a',role:'user',text:''},{id:'a',role:'assistant',text:''}]}))).toThrow('unique');
    expect(()=>parseTranscriptData('x'.repeat(262145))).toThrow('bounded');
    expect(()=>parseTranscriptData('{"version":2,"messages":[]}')).toThrow('version');
    expect(()=>parseTranscriptData('{"version":1,"messages":[{"id":"a","role":["user"],"text":""}]}')).toThrow('role');
    expect(()=>parseTranscriptData('{"version":1,"messages":[{"id":"a","role":"assistant","text":"","activity":[{"id":"tool","title":"Tool","state":["running"]}]}]}')).toThrow('state');
    expect(()=>parseAttachmentData('{"version":1,"attachments":[{"id":"file","name":"Document","url":"file:///private"}]}')).toThrow('Unknown');
  });
  it('does not expose unwired message actions; enabled actions only emit typed requests',async()=>{
    const host=target(),outputs:unknown[]=[];
    mounted.push(mount(ExtendedMessage,{target:host,props:{props:{role:'assistant',text:'A response'},nodeId:'m',occurrenceKey:'m',io:{emit:(...value)=>outputs.push(value)}}}));
    await settle();expect(host.querySelector('button')).toBeNull();expect(outputs).toEqual([]);
    await unmount(mounted.pop()!);
    mounted.push(mount(ExtendedMessage,{target:host,props:{props:{role:'assistant',text:'A response',copyEnabled:true,retryEnabled:true,feedbackEnabled:true},nodeId:'m',occurrenceKey:'m',io:{emit:(...value)=>outputs.push(value)}}}));
    await settle();(host.querySelector('[aria-label="Retry response"]') as HTMLElement).click();(host.querySelector('[aria-label="Good response"]') as HTMLElement).click();
    expect(outputs).toEqual([['retry'],['feedbackChange','like']]);
  });
  it('renders supplied attachment metadata and emits attach/remove/send requests without mutating controlled draft',async()=>{
    const host=target(),outputs:unknown[]=[];
    mounted.push(mount(ExtendedPromptInput,{target:host,props:{props:{value:'  Keep this draft  ',data:'{"version":1,"attachments":[{"id":"receipt","name":"receipt.txt"}]}',sendEnabled:true,attachEnabled:true,removeAttachmentEnabled:true},nodeId:'p',occurrenceKey:'p',io:{emit:(...value)=>outputs.push(value)}}}));
    await settle();expect(host.textContent).toContain('receipt.txt');
    (host.querySelector('[aria-label="Attach files"]') as HTMLElement).click();(host.querySelector('[aria-label="Remove receipt.txt"]') as HTMLElement).click();
    host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();
    expect(outputs).toEqual([['attach'],['removeAttachment','receipt'],['send','Keep this draft']]);expect(host.querySelector('textarea')!.value).toBe('  Keep this draft  ');
  });
  it('fails closed for invalid attachments instead of presenting actionable partial data',async()=>{
    const host=target();mounted.push(mount(ExtendedPromptInput,{target:host,props:{props:{data:'{"version":1,"attachments":[{"id":"a","name":"n","unknown":true}]}',sendEnabled:true},nodeId:'p',occurrenceKey:'p'}}));await settle();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Invalid attachment');expect(host.querySelector('form')).toBeNull();
  });
  it('presents transcript events with disabled default send and no fabricated transport completion',async()=>{
    const host=target();mounted.push(mount(Transcript,{target:host,props:{props:{data:'{"version":1,"messages":[{"id":"observed","role":"assistant","text":"Actual response","events":[{"id":"summary","kind":"summary","text":"Public execution summary"}]}]}'},nodeId:'t',occurrenceKey:'t'}}));await settle();
    expect(host.textContent).toContain('Public execution summary');expect((host.querySelector('[aria-label="Send"]') as HTMLButtonElement).disabled).toBe(true);
  });
  it('retains existing actual Conversation callback acceptance behavior',async()=>{
    const host=target(),sent:string[]=[];
    mounted.push(mount(Conversation,{target:host,props:{messages:[],onSend:async(text,accepted)=>{sent.push(text);accepted?.();return {ok:true};}}}));await settle();
    const input=host.querySelector('textarea')!;input.value='Hosted send';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();
    expect(sent).toEqual(['Hosted send']);expect(input.value).toBe('');expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it('forwards real action/attachment parts and keeps the tooltip inside its scoped app outlet',async()=>{
    const host=target();mounted.push(mount(ChatPartsHarness,{target:host}));await settle();
    const copy=host.querySelector('[aria-label="Copy message"]') as HTMLButtonElement;
    expect(copy.dataset.uiPart).toBe('copy');expect(copy.style.backgroundColor).toBe('rgb(10, 20, 30)');
    expect(host.querySelector('[data-ui-part="attachments"]')?.getAttribute('style')).toContain('border-width: 3px');
    expect(host.querySelector('[aria-label="Remove file.txt"]')?.getAttribute('data-ui-part')).toBe('attachment-remove');
    const transcript=host.querySelector('[data-ui-occ="chat-transcript"][data-ui-part="root"]')!;
    for(const part of ['surface','header','heading','description','reset','messages','message','message-content','message-text','timeline','activity','copy','composer','composer-surface','composer-field','composer-actions','send','footer','status']) expect(transcript.querySelector(`[data-ui-part="${part}"]`),part).not.toBeNull();
    const ids=[...host.querySelectorAll('[id]')].map(element=>element.id);expect(new Set(ids).size).toBe(ids.length);
    copy.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,850));await settle();
    const tip=host.querySelector('[role="tooltip"]');
    expect(tip).not.toBeNull();expect(tip?.getAttribute('data-ui-part')).toBe('copy-tooltip');
    expect(tip?.closest('[data-testid="chat-outlet"]')).not.toBeNull();expect(tip?.closest('.chat-scope')).not.toBeNull();
    const other=host.querySelector('[aria-label="Other app input"]') as HTMLInputElement;
    other.focus();await settle();expect(document.activeElement).toBe(other);
  });
  it('does not consume sibling application Escape while an action tooltip is hovered',async()=>{
    const host=target();mounted.push(mount(ChatPartsHarness,{target:host}));await settle();
    const other=host.querySelector('[aria-label="Other app input"]') as HTMLInputElement;
    other.focus();await settle();
    const copy=host.querySelector('[aria-label="Copy message"]') as HTMLButtonElement;
    copy.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,850));await settle();
    expect(host.querySelector('[role="tooltip"]')).not.toBeNull();expect(document.activeElement).toBe(other);
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});other.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });
});
