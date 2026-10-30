import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,createUiAuthoringRegistry,type UiDocument} from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import {aiAuthoringDescriptors,aiConversationDescriptorV2} from '../../ui-ai-svelte/src/authoring/descriptors.js';
import {aiAuthoringImplementations} from '../../ui-ai-svelte/src/authoring/implementations.js';
import {aiAuthoringPackage} from '../../ui-ai-svelte/src/authoring/knowledge.js';
import {rootClassFor,styleRulesToCss} from '../src/document/logic.js';
// The native browser fixture executes the real built AI stylesheet. HappyDOM
// does not implement all of its selectors, so these tests use a deliberately
// stronger implementation-default selector to verify explicit author priority.
const implementationCss='.vict-ai.vict-ai [data-slot="bubble"] > [data-slot="bubble-content"] { background-color: #f1f3f7; } .vict-ai.vict-ai textarea { background-color: transparent; } .vict-rhea button { background-color: rgb(255,0,255); }';

const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,15));flushSync();};
function authored():UiDocument {
  const seed=aiAuthoringPackage.registrations.find(item=>item.descriptor.id===aiConversationDescriptorV2.id&&item.descriptor.revision==='2')!.seed!;
  return {schema:'vict.ui-document@1',id:'ai-part-proof',revision:'1',root:seed.root,nodes:Object.fromEntries(seed.nodes.map(node=>[node.id,node])),componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:seed.localState??{}};
}
describe('real AI part presentation and compatible contracts',()=>{
  it('preserves local precedence when the primary ABI target is named bubble',async()=>{
    const doc=authored();
    const descriptors=aiAuthoringDescriptors.map(descriptor=>descriptor.id==='vict.ai.message'&&descriptor.revision==='2'?{...descriptor,styleTargets:['bubble',...descriptor.styleTargets!.filter(name=>name!=='bubble')]}:descriptor);
    const implementations=aiAuthoringImplementations.map(implementation=>implementation.extensionId==='vict.ai.message'&&implementation.revision==='2'?{...implementation,styleTargets:['bubble',...implementation.styleTargets!.filter(name=>name!=='bubble')]}:implementation);
    const source:UiDocument={...doc,styleSources:{shared:{id:'shared',declarations:[{property:'color',value:{type:'text',value:'red'}}]}},nodes:{...doc.nodes,message:{...doc.nodes.message!,props:{role:{type:'literal',value:'user'},text:{type:'literal',value:'Primary bubble'}},localStyle:[{property:'color',value:{type:'text',value:'blue'}}],partStyles:{bubble:{styleSources:['shared']}}}}};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);if(!compiled.ok)throw Error(JSON.stringify(compiled));
    const host=document.createElement('div');document.body.append(host);const instance=mount(DocumentHost,{target:host,props:{plan:compiled.plan,extensionDescriptors:descriptors,extensionImplementations:implementations,localState:source.localState,dispatch:async()=>{},navigate:()=>{}}});
    try{await settle();expect(getComputedStyle(host.querySelector('[data-ui-node="message"][data-ui-part="bubble"]')!).color).toBe('blue');}finally{await unmount(instance);host.remove();}
  });
  it.each(['1','2'])('retains revision %s default markup without explicit part priority',async revision=>{
    const doc=authored();const source:UiDocument={...doc,nodes:Object.fromEntries(Object.entries(doc.nodes).map(([id,node])=>[id,node.kind==='component'?{...node,revision,...(id==='message'?{props:{role:{type:'literal',value:'user'},text:{type:'literal',value:'Default user message'}}}:{})}:node]))};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),aiAuthoringDescriptors);if(!compiled.ok)throw Error(JSON.stringify(compiled));
    const style=document.createElement('style');style.textContent=implementationCss;document.head.append(style);
    const host=document.createElement('div');host.className='vict-rhea';document.body.append(host);
    const instance=mount(DocumentHost,{target:host,props:{plan:compiled.plan,extensionDescriptors:aiAuthoringDescriptors,extensionImplementations:aiAuthoringImplementations,localState:source.localState,dispatch:async()=>{},navigate:()=>{}}});
    try{await settle();expect(host.querySelector('[data-slot="bubble-content"]')?.parentElement?.getAttribute('data-variant')).toBe('muted');expect(host.querySelector('button[aria-label="Send"]')).toBeTruthy();expect(styleRulesToCss(compiled.plan,rootClassFor(compiled.plan))).not.toContain('!important');}finally{await unmount(instance);host.remove();style.remove();}
  });
  it('declares explicit application theme roles without changing unthemed source',()=>{
    const doc=authored();const source:UiDocument={...doc,theme:{schema:'vict.ui-theme@1',roles:{surface:'#fff8e1',highlight:'#fbe9e7',highlightText:'#260e04',accent:'#00695c',accentText:'#fa1234'}},nodes:{...doc.nodes,message:{...doc.nodes.message!,props:{role:{type:'literal',value:'user'},text:{type:'literal',value:'Themed user'}}}}};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),aiAuthoringDescriptors);if(!compiled.ok)throw Error(JSON.stringify(compiled));
    const css=styleRulesToCss(compiled.plan,rootClassFor(compiled.plan));expect(css).toContain('--vict-theme-surface: #fff8e1');expect(css).toContain('--vict-theme-highlight: #fbe9e7');expect(doc.theme).toBeUndefined();
  });
  it('applies authored parts over stronger implementation defaults and exposes the assistant bubble',async()=>{
    const doc=authored(),conversation=doc.nodes.conversation!;
    if(conversation.kind!=='component')throw Error('seed');
    const source:UiDocument={...doc,conditions:{wide:{id:'wide',kind:'media',query:'(min-width: 1px)'}},styleSources:{partBase:{id:'partBase',declarations:[{property:'background-color',value:{type:'text',value:'#ff0000'}}],conditionId:'wide',pseudo:'focus'}},nodes:{...doc.nodes,
      conversation:{...conversation,slots:{...conversation.slots,messages:{name:'messages',children:['message','assistant']}}},
      message:{...doc.nodes.message!,props:{role:{type:'literal',value:'user'},text:{type:'literal',value:'User message'}},partStyles:{bubble:{styleSources:['partBase'],localStyle:[{property:'background-color',value:{type:'text',value:'#00695c'}},{property:'color',value:{type:'text',value:'#ffffff'}}]}}},
      assistant:{...doc.nodes.message!,id:'assistant',props:{role:{type:'literal',value:'assistant'},text:{type:'literal',value:'Assistant reply'}},partStyles:{bubble:{localStyle:[{property:'background-color',value:{type:'text',value:'#e0f2f1'}},{property:'border-color',value:{type:'text',value:'#00695c'}},{property:'border-width',value:{type:'text',value:'2px'}}]}}},
      prompt:{...doc.nodes.prompt!,partStyles:{field:{localStyle:[{property:'background-color',value:{type:'text',value:'#fffde7'}}]},send:{localStyle:[{property:'background-color',value:{type:'text',value:'#00695c'}}]}}},
    }};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),aiAuthoringDescriptors);if(!compiled.ok)throw Error(JSON.stringify(compiled));
    const style=document.createElement('style');style.textContent=implementationCss;document.head.append(style);
    const host=document.createElement('div');host.className='vict-rhea';document.body.append(host);
    const instance=mount(DocumentHost,{target:host,props:{plan:compiled.plan,extensionDescriptors:aiAuthoringDescriptors,extensionImplementations:aiAuthoringImplementations,localState:source.localState,dispatch:async()=>{},navigate:()=>{}}});
    try{await settle();
      const bubble=host.querySelector<HTMLElement>('[data-ui-node="message"][data-ui-part="bubble"]')!;
      const assistant=host.querySelector<HTMLElement>('[data-ui-node="assistant"][data-ui-part="bubble"]')!;
      expect(bubble).toBeTruthy();expect(assistant).toBeTruthy();
      expect(['#00695c','rgb(0, 105, 92)']).toContain(getComputedStyle(bubble).backgroundColor);
      expect(['#ffffff','rgb(255, 255, 255)']).toContain(getComputedStyle(bubble).color);
      bubble.tabIndex=0;bubble.focus();await settle();expect(['#00695c','rgb(0, 105, 92)']).toContain(getComputedStyle(bubble).backgroundColor);
      expect(['#e0f2f1','rgb(224, 242, 241)']).toContain(getComputedStyle(assistant).backgroundColor);
      expect(getComputedStyle(assistant).borderTopWidth).toBe('2px');
      expect(['#fffde7','rgb(255, 253, 231)']).toContain(getComputedStyle(host.querySelector('[data-ui-part="field"]')!).backgroundColor);
      expect(['#00695c','rgb(0, 105, 92)']).toContain(getComputedStyle(host.querySelector('[data-ui-part="send"]')!).backgroundColor);
    }finally{await unmount(instance);host.remove();style.remove();}
  });
  it('keeps normal root local rules above source root parts without elevating native element styles',async()=>{
    const doc=authored();
    const source:UiDocument={...doc,styleSources:{rootBase:{id:'rootBase',declarations:[{property:'color',value:{type:'text',value:'red'}}]}},nodes:{...doc.nodes,conversation:{...doc.nodes.conversation!,localStyle:[{property:'color',value:{type:'text',value:'blue'}}],partStyles:{root:{styleSources:['rootBase']}}}}};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),aiAuthoringDescriptors);if(!compiled.ok)throw Error(JSON.stringify(compiled));
    const css=styleRulesToCss(compiled.plan,rootClassFor(compiled.plan));
    expect(css).toContain('color: red !important');expect(css).toContain('color: blue !important');
    expect(css.indexOf('color: blue !important')).toBeGreaterThan(css.indexOf('color: red !important'));
    const host=document.createElement('div');document.body.append(host);const instance=mount(DocumentHost,{target:host,props:{plan:compiled.plan,extensionDescriptors:aiAuthoringDescriptors,extensionImplementations:aiAuthoringImplementations,localState:source.localState,dispatch:async()=>{},navigate:()=>{}}});
    try{await settle();expect(getComputedStyle(host.querySelector('[data-ui-node="conversation"][data-ui-part="root"]')!).color).toBe('blue');}finally{await unmount(instance);host.remove();}
    const normal:UiDocument={...doc,root:'native',nodes:{native:{kind:'element',id:'native',tag:'div',children:[],localStyle:[{property:'color',value:{type:'text',value:'blue'}}]}}};
    const native=compileUiDocument(normal,defaultSemanticElementCatalog(),aiAuthoringDescriptors);if(!native.ok)throw Error(JSON.stringify(native));
    expect(styleRulesToCss(native.plan,rootClassFor(native.plan))).not.toContain('!important');
  });
  it('retains exact revision 1 pins and adds versioned implementation-linked revision 2 parts',()=>{
    const registry=createUiAuthoringRegistry([aiAuthoringPackage],aiAuthoringImplementations,{requireCompatibility:true});
    expect(registry.issues).toEqual([]);
    // New public AI families may start at revision 1. Historical compatibility
    // belongs to these exact identities, not the global revision count.
    const historicalIds=['vict.ai.conversation','vict.ai.message','vict.ai.prompt-input'];
    const historical=registry.contracts.filter(item=>historicalIds.includes(item.descriptor.id)&&['1','2'].includes(item.descriptor.revision));
    expect(historical).toHaveLength(6);
    for(const revision of ['1','2'])
      expect(historical.filter(item=>item.descriptor.revision===revision).map(item=>item.descriptor.id).sort()).toEqual([...historicalIds].sort());
    for(const item of historical.filter(item=>item.descriptor.revision==='1'))
      expect(item.descriptor.styleTargets).toEqual(['root']);
    expect(registry.contracts.filter(item=>historicalIds.includes(item.descriptor.id)&&item.descriptor.revision==='3').map(item=>item.descriptor.id).sort()).toEqual(['vict.ai.message','vict.ai.prompt-input']);
  });
  it('places authored classes on actual conversation, bubble, textarea and action surfaces',async()=>{
    const doc=authored();
    const source:UiDocument={...doc,theme:{schema:'vict.ui-theme@1',roles:{surface:'#182030',text:'#fafafa',highlight:'#324050'}},nodes:{...doc.nodes,
      conversation:{...doc.nodes.conversation!,partStyles:{surface:{localStyle:[{property:'background-color',value:{type:'text',value:'#101820'}}]}}},
      message:{...doc.nodes.message!,props:{role:{type:'literal',value:'user'},text:{type:'literal',value:'Hello'}},partStyles:{bubble:{localStyle:[{property:'background-color',value:{type:'text',value:'#324050'}}]},text:{localStyle:[{property:'color',value:{type:'text',value:'#fafafa'}}]}}},
      prompt:{...doc.nodes.prompt!,partStyles:{field:{localStyle:[{property:'background-color',value:{type:'text',value:'#182030'}}]},send:{localStyle:[{property:'color',value:{type:'text',value:'#fafafa'}}]}}},
    }};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),aiAuthoringDescriptors);expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)return;
    const host=document.createElement('div');document.body.append(host);
    const instance=mount(DocumentHost,{target:host,props:{plan:compiled.plan,extensionDescriptors:aiAuthoringDescriptors,extensionImplementations:aiAuthoringImplementations,localState:source.localState,dispatch:async()=>{},navigate:()=>{}}});
    await settle();
    expect(host.querySelector('[data-ui-part="surface"][data-ui-node="conversation"]')?.className).toMatch(/part-/);
    expect(host.querySelector('[data-ui-part="bubble"]')?.getAttribute('data-slot')).toBe('bubble-content');
    expect(host.querySelector('[data-ui-part="field"]')?.tagName).toBe('TEXTAREA');
    expect(host.querySelector('[data-ui-part="send"]')?.tagName).toBe('BUTTON');
    const css=styleRulesToCss(compiled.plan,rootClassFor(compiled.plan));
    expect(css).toContain('--vict-color-surface: #182030');expect(css).toContain('--background: #182030');
    expect(css).toContain('background-color: #324050');
    await unmount(instance);host.remove();
  });
});
