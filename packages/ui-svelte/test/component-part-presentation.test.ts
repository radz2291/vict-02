import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,createUiAuthoringRegistry,type UiDocument} from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import {aiAuthoringDescriptors,aiConversationDescriptorV2} from '../../ui-ai-svelte/src/authoring/descriptors.js';
import {aiAuthoringImplementations} from '../../ui-ai-svelte/src/authoring/implementations.js';
import {aiAuthoringPackage} from '../../ui-ai-svelte/src/authoring/knowledge.js';
import {rootClassFor,styleRulesToCss} from '../src/document/logic.js';

const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,15));flushSync();};
function authored():UiDocument {
  const seed=aiAuthoringPackage.registrations.find(item=>item.descriptor.id===aiConversationDescriptorV2.id&&item.descriptor.revision==='2')!.seed!;
  return {schema:'vict.ui-document@1',id:'ai-part-proof',revision:'1',root:seed.root,nodes:Object.fromEntries(seed.nodes.map(node=>[node.id,node])),componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:seed.localState??{}};
}
describe('real AI part presentation and compatible contracts',()=>{
  it('retains exact revision 1 pins and adds versioned implementation-linked revision 2 parts',()=>{
    const registry=createUiAuthoringRegistry([aiAuthoringPackage],aiAuthoringImplementations,{requireCompatibility:true});
    expect(registry.issues).toEqual([]);
    expect(registry.contracts.filter(item=>item.descriptor.revision==='1')).toHaveLength(3);
    expect(registry.contracts.filter(item=>item.descriptor.revision==='2')).toHaveLength(3);
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
