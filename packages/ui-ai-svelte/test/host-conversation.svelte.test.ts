import {afterEach,describe,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import HostConversationHarness from './HostConversationHarness.svelte';
import type {ConversationMessage} from '../src/adapters.js';
import {parseTranscriptData} from '../src/authoring/chat-extension-data.js';
let instance:{update:(next:ConversationMessage[])=>void}|undefined;
const settle=async()=>{flushSync();await tick();await new Promise(resolve=>setTimeout(resolve,20));flushSync();};
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.replaceChildren();vi.restoreAllMocks();});
const notes='Public contract note [supplied link](https://example.com/notes).';
const final='Applied the requested edit. Appearance was observed in the supplied crop. Interactions remain unverified.';
function message(state:NonNullable<ConversationMessage['hostTurn']>['state']='running'):ConversationMessage {
  return {id:'reply-one',role:'assistant',text:`${notes}\n\n${final}`,events:[
    {id:'note',kind:'text',text:notes},
    {id:'tool',kind:'activity',activity:{id:'read',title:'Read source',state:'completed',input:{text:'Exact input'},result:{text:'Exact result'},stages:[{id:'receipt',title:'Actual receipt',state:'completed'}]}},
    {id:'final',kind:'text',text:final},
  ],hostTurn:{state,statusText:state==='running'?'Working.':'One confirmed edit; interactions unverified.',finalTextEventIds:state==='completed'?['final']:[]}};
}
async function setup(messages:ConversationMessage[]){const target=document.createElement('div');document.body.append(target);instance=mount(HostConversationHarness,{target,props:{messages}});await settle();return target;}
describe('host lifecycle presentation without transcript loss',()=>{
  it('keeps unsupported verbose model claims intact in labeled details, never in the host evidence summary',async()=>{
    const original=message('completed');
    const unsupported='The footer is clipped. Saved and tested everything. '.repeat(120).trim();
    original.text=unsupported;original.events=[{id:'final',kind:'text',text:unsupported}];
    original.hostTurn!.evidenceSummary='No source changes were applied. No image assessment matches the final source. Behavior was not tested by this agent.';
    const host=await setup([original]);
    expect(host.querySelector('[aria-label="Host evidence summary"]')?.textContent).toContain('No source changes');
    expect(host.querySelector('[aria-label="Host evidence summary"]')?.textContent).not.toContain('footer');
    expect(host.querySelector('[aria-label="Terminal response"]')).toBeNull();
    const details=host.querySelector<HTMLElement>('[data-slot="trace-collapsible-content"]')!;
    expect(details.hidden).toBe(true);expect(details.textContent).toContain('claims not independently verified');
    expect(details.querySelector('[data-event-id="final"]')?.textContent).toBe(unsupported);
    host.querySelector<HTMLButtonElement>('[data-slot="trace-collapsible-trigger"]')!.click();await settle();
    expect(details.hidden).toBe(false);
    const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    host.querySelector<HTMLButtonElement>('[aria-label="Copy message"]')!.click();await settle();expect(writeText).toHaveBeenCalledWith(unsupported);
    expect(()=>parseTranscriptData(JSON.stringify({version:1,messages:[original]}))).toThrow('Unknown data field');
  });
  it('keeps the public default expanded and rejects lifecycle metadata in canonical authored data',async()=>{
    const original=message();delete original.hostTurn;const host=await setup([original]);
    expect(host.querySelector('[data-slot="trace-collapsible-trigger"]')?.textContent).toContain('Read source');
    expect([...host.querySelectorAll('button')].some(button=>button.textContent?.includes('Public activity and tool details'))).toBe(false);
    expect(host.textContent).toContain(final);
    expect(()=>parseTranscriptData(JSON.stringify({version:1,messages:[message()]}))).toThrow('Unknown data field');
  });
  it('retains mounted focused public text through completion, preserves full copy and inspectable receipts',async()=>{
    const original=message(),host=await setup([original]);
    const trigger=host.querySelector<HTMLButtonElement>('[data-slot="trace-collapsible-trigger"]')!;
    const content=host.querySelector<HTMLElement>('[data-slot="trace-collapsible-content"]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(content.hidden).toBe(true);
    trigger.focus();trigger.click();await settle();expect(trigger.getAttribute('aria-expanded')).toBe('true');expect(content.hidden).toBe(false);
    const note=host.querySelector('[data-event-id="note"]')!,link=note.querySelector<HTMLAnchorElement>('a')!;link.focus();
    instance!.update([message('completed')]);await settle();
    expect(host.querySelector('[data-event-id="note"]')).toBe(note);expect(document.activeElement).toBe(link);
    expect(host.querySelector('[aria-label="Terminal response"]')?.textContent).toBe(final);
    expect(content.textContent).toContain(final);expect(content.textContent).toContain('Public contract note');
    [...content.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.includes('Read source'))!.click();await settle();
    expect(content.textContent).toContain('Exact input');expect(content.textContent).toContain('Exact result');
    const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
    host.querySelector<HTMLButtonElement>('[aria-label="Copy message"]')!.click();await settle();expect(writeText).toHaveBeenCalledWith(original.text);
    trigger.click();await settle();expect(content.hidden).toBe(true);expect(host.querySelector('[data-event-id="note"]')).toBe(note);
  });
  it.each(['failed','cancelled','interrupted'] as const)('does not promote unfinished text for %s',async state=>{
    const item=message(state);item.hostTurn!.finalTextEventIds=['final'];const host=await setup([item]);
    expect(host.querySelector('[aria-label="Terminal response"]')).toBeNull();expect(host.textContent).toContain('No successful final response');
    expect(host.querySelector('[data-event-id="final"]')?.textContent).toBe(final);
  });
  it('shows no-final explicitly, keeps verbose terminal text intact, and preserves historical message IDs',async()=>{
    const empty=message('completed');empty.hostTurn!.finalTextEventIds=[];const host=await setup([empty]);
    expect(host.textContent).toContain('No final response received');
    const historicalNode=host.querySelector('[data-event-id="note"]');
    const verbose='Supplied verbose response. '.repeat(150).trim(),next=message('completed');next.id='reply-two';next.text=verbose;next.events=[{id:'verbose',kind:'text',text:verbose}];next.hostTurn!.finalTextEventIds=['verbose'];
    instance!.update([empty,next]);await settle();expect(host.querySelector('[data-event-id="note"]')).toBe(historicalNode);
    expect(host.querySelector('[aria-label="Terminal response"]')?.textContent).toBe(verbose);
    expect(host.querySelectorAll('[data-slot="trace-collapsible-trigger"]')[0]?.getAttribute('aria-expanded')).toBe('false');
  });
});
