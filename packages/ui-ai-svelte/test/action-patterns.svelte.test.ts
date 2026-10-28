import {afterEach,describe,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import {authoringDigest,authoringImplementationCapabilities,createUiAuthoringRegistry} from '@victframework/ui';
import {actionPatternCompatibility,actionPatternDescriptors,actionPatternImplementations,actionPatternRegistrations} from '../src/authoring/action-patterns.js';
import {parseModelSelectorData,modelSelectorExample} from '../src/authoring/action-data.js';
import ActionPattern from '../src/authoring/ActionPattern.svelte';
let instance:ReturnType<typeof mount>|undefined;
const settle=async()=>{flushSync();await tick();flushSync();};
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';});
describe('AI action adapters',()=>{
  it('validates bounded versioned supplied options, rejecting ambiguous or unknown metadata',()=>{
    expect(parseModelSelectorData(modelSelectorExample).ok).toBe(true);
    for(const raw of ['{',JSON.stringify({version:2,models:[]}),JSON.stringify({version:1,models:[{id:'x',label:'X'},{id:'x',label:'Duplicate'}]}),JSON.stringify({version:1,models:[{id:'x',label:'X',secret:'no'}]}),JSON.stringify({version:1,models:[],execute:true}),'x'.repeat(65537)])expect(parseModelSelectorData(raw).ok).toBe(false);
  });
  it('has retained pins and registered seeds for all four supplied patterns',()=>{
    const pins=actionPatternDescriptors.map((descriptor,index)=>({id:descriptor.id,revision:descriptor.revision,descriptorDigest:authoringDigest(descriptor),capabilitiesDigest:authoringDigest(authoringImplementationCapabilities(actionPatternImplementations[index]!))}));
    if(process.env.VICT_GENERATE_ACTION_PINS==='1')console.log('ACTION_COMPATIBILITY_PINS',JSON.stringify(pins));
    expect(actionPatternCompatibility).toEqual(pins);
    const registry=createUiAuthoringRegistry([{schema:'vict.ui-authoring@1',packageName:'@victframework/ui-ai-svelte',packageVersion:'0.4.0-rc.1',registrations:actionPatternRegistrations,exportDispositions:[],compatibility:actionPatternCompatibility}],actionPatternImplementations,{requireCompatibility:true});
    expect(registry.issues).toEqual([]);
  });
  it('does not grant approval or restore authority, even when a component is clicked',async()=>{
    const target=document.createElement('div');document.body.append(target);const emit=vi.fn();
    instance=mount(ActionPattern,{target,props:{kind:'confirmation',props:{title:'Run supplied operation',description:'Host must decide'},io:{emit},occurrenceKey:'confirm',nodeId:'confirm'}});await settle();
    expect([...target.querySelectorAll('button')].every(button=>button.disabled)).toBe(true);
    await unmount(instance);instance=mount(ActionPattern,{target,props:{kind:'confirmation',props:{title:'Run supplied operation',description:'Host must decide',canDecide:true},io:{emit},occurrenceKey:'confirm',nodeId:'confirm'}});await settle();
    [...target.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Approve')!.click();await settle();
    expect(emit).toHaveBeenCalledWith('decision',true);
    expect(target.textContent).toContain('Approve');expect(target.textContent).not.toContain('Completed:');
  });
  it('shows invalid options clearly instead of rendering actionable guessed choices',async()=>{
    const target=document.createElement('div');document.body.append(target);
    instance=mount(ActionPattern,{target,props:{kind:'model-selector',props:{data:'invalid',allowActions:true},occurrenceKey:'models',nodeId:'models'}});await settle();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('invalid JSON');expect(target.querySelector('button')).toBeNull();
  });
  it('emits checkpoint and suggestion requests only after explicit host availability',async()=>{
    const target=document.createElement('div');document.body.append(target);const emit=vi.fn();
    instance=mount(ActionPattern,{target,props:{kind:'checkpoint',props:{label:'Saved checkpoint'},io:{emit},occurrenceKey:'checkpoint',nodeId:'checkpoint'}});await settle();
    expect(target.querySelector('button')).toBeNull();
    await unmount(instance);instance=mount(ActionPattern,{target,props:{kind:'checkpoint',props:{label:'Saved checkpoint',canRestore:true},io:{emit},occurrenceKey:'checkpoint',nodeId:'checkpoint'}});await settle();
    target.querySelector('button')!.click();expect(emit).toHaveBeenCalledWith('restore');
    await unmount(instance);instance=mount(ActionPattern,{target,props:{kind:'suggestion',props:{text:'Inspect sources',allowActions:true},io:{emit},occurrenceKey:'suggestion',nodeId:'suggestion'}});await settle();
    target.querySelector('button')!.click();expect(emit).toHaveBeenCalledWith('select','Inspect sources');
  });
  it('forwards semantic styling to real labels and action buttons, including completed status',async()=>{
    const target=document.createElement('div');document.body.append(target);
    const presentation={target:(part:string)=>({'data-ui-part':part,class:`authored-${part}`,style:'color:rgb(12, 34, 56)'})};
    instance=mount(ActionPattern,{target,props:{kind:'confirmation',props:{title:'Confirm',description:'Supplied explanation',canDecide:true},occurrenceKey:'confirm',nodeId:'confirm',presentation}});await settle();
    expect(target.querySelector('[data-ui-part="title"]')?.textContent).toBe('Confirm');
    expect(target.querySelector('[data-ui-part="description"]')?.textContent).toBe('Supplied explanation');
    for(const part of ['approve','deny']){
      const button=target.querySelector<HTMLElement>(`[data-ui-part="${part}"]`)!;
      expect(button.tagName).toBe('BUTTON');expect(button.classList.contains(`authored-${part}`)).toBe(true);expect(button.style.color).toBe('rgb(12, 34, 56)');
    }
    expect(target.querySelector('[data-ui-part="actions"]')?.querySelectorAll('button')).toHaveLength(2);
    await unmount(instance);instance=mount(ActionPattern,{target,props:{kind:'confirmation',props:{title:'Confirm',state:'completed'},occurrenceKey:'confirm',nodeId:'confirm',presentation}});await settle();
    expect(target.querySelector('[data-ui-part="status"]')?.textContent).toContain('Completed: Confirm');
    await unmount(instance);instance=mount(ActionPattern,{target,props:{kind:'checkpoint',props:{label:'Snapshot',canRestore:true},occurrenceKey:'checkpoint',nodeId:'checkpoint',presentation}});await settle();
    expect(target.querySelector('[data-ui-part="label"]')?.textContent).toBe('Snapshot');expect(target.querySelector('[data-ui-part="restore"]')?.tagName).toBe('BUTTON');
    await unmount(instance);instance=mount(ActionPattern,{target,props:{kind:'suggestion',props:{text:'Suggest',allowActions:true},occurrenceKey:'suggestion',nodeId:'suggestion',presentation}});await settle();
    expect(target.querySelector('[data-ui-part="select"]')?.tagName).toBe('BUTTON');expect(target.querySelector('[data-ui-part="select"]')?.classList.contains('authored-select')).toBe(true);
  });
});
