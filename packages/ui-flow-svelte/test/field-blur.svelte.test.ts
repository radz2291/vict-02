import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import GraphFields from '../src/editor/GraphFields.svelte';
import type {GraphField,GraphValue} from '../src/editor/model.js';
describe('graph field draft commit boundaries',()=>{
  it('commits text and number drafts on blur without a per-key write or duplicate change/blur history',async()=>{
    const target=document.createElement('div');document.body.append(target);const writes:{id:string;value:GraphValue}[]=[];
    const fields:GraphField[]=[{id:'text',label:'Text',kind:'text'},{id:'factor',label:'Factor',kind:'number'}];
    const app=mount(GraphFields,{target,props:{fields,values:{text:'before',factor:2},owner:'node',onchange:(id,value)=>writes.push({id,value})}});flushSync();
    const text=target.querySelector<HTMLInputElement>('input[type=text]')!;text.value='draft';text.dispatchEvent(new Event('input',{bubbles:true}));expect(writes).toHaveLength(0);
    text.dispatchEvent(new FocusEvent('blur'));expect(writes).toEqual([{id:'text',value:'draft'}]);
    text.dispatchEvent(new Event('change',{bubbles:true}));expect(writes).toHaveLength(1);
    const number=target.querySelector<HTMLInputElement>('input[type=number]')!;number.value='3';number.dispatchEvent(new Event('change',{bubbles:true}));number.dispatchEvent(new FocusEvent('blur'));expect(writes.at(-1)).toEqual({id:'factor',value:3});expect(writes).toHaveLength(2);
    await unmount(app);target.remove();
  });
  it('ignores unchanged and readonly blur values',async()=>{
    const target=document.createElement('div');document.body.append(target);const writes:unknown[]=[];
    const app=mount(GraphFields,{target,props:{fields:[{id:'text',label:'Text',kind:'text'}],values:{text:'before'},owner:'node',readOnly:true,onchange:(...args)=>writes.push(args)}});flushSync();
    const text=target.querySelector<HTMLInputElement>('input')!;text.value='changed';text.dispatchEvent(new FocusEvent('blur'));expect(writes).toHaveLength(0);
    await unmount(app);target.remove();
  });
});
