import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { compileUiDocument, defaultSemanticElementCatalog, createUiAuthoringRegistry, type UiDocument } from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import GraphFields from '../src/editor/GraphFields.svelte';
import { flowAuthoringDescriptors, flowEditorDescriptor, flowEditorDescriptorV2 } from '../src/authoring/descriptors.js';
import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
import { flowAuthoringPackage } from '../src/authoring/knowledge.js';
import { graphFixture } from './editor-fixture.js';
import { serializeGraph } from '../src/editor/model.js';

const settle = async () => { flushSync(); await new Promise(resolve => setTimeout(resolve, 40)); flushSync(); };
function source(revision: string): UiDocument {
  return {schema:'vict.ui-document@1',id:`graph-parts-${revision}`,revision:'1',root:'graph',
    nodes:{graph:{kind:'component',id:'graph',definitionId:'vict.flow.editor',revision,props:{graph:{type:'literal',value:serializeGraph(graphFixture())}},
      ...(revision === '2' ? {partStyles:{'node-body':{localStyle:[{property:'background-color',value:{type:'text',value:'#123456'}}]},toolbar:{localStyle:[{property:'padding',value:{type:'text',value:'18px'}}]}}} : {})}},
    componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{}};
}
describe('graph shared component and versioned presentation conformance',()=>{
  it('retains exact legacy contracts but excludes both revisions from new authoring without recipes',()=>{
    expect(flowEditorDescriptor.styleTargets).toEqual(['root']);
    expect(flowEditorDescriptorV2.styleTargets).toContain('node-body');
    expect(createUiAuthoringRegistry([flowAuthoringPackage],flowAuthoringImplementations,{requireCompatibility:true}).issues).toEqual([]);
    const registrations=flowAuthoringPackage.registrations.filter(item=>item.descriptor.id==='vict.flow.editor');
    expect(registrations.map(item=>item.descriptor.revision)).toEqual(['1','2']);
    for(const registration of registrations){
      expect(registration.eligibility.kind).toBe('excluded');
      expect(registration.eligibility.reason).toBeTruthy();
      expect(registration.seed).toBeUndefined();
      expect(registration.examples).toBeUndefined();
    }
  });
  for(const revision of ['1','2'])it(`renders editor@${revision} through the registered host with shared controls and real declared parts`,async()=>{
    const doc=source(revision),compiled=compileUiDocument(doc,defaultSemanticElementCatalog(),flowAuthoringDescriptors);
    expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)return;
    const target=document.createElement('div');document.body.append(target);
    const app=mount(DocumentHost,{target,props:{plan:compiled.plan,extensionDescriptors:flowAuthoringDescriptors,extensionImplementations:flowAuthoringImplementations,dispatch:async()=>undefined,navigate:()=>{}}});
    await settle();
    expect(target.querySelector('.vict-graph-editor[data-ui-part=root]')).not.toBeNull();
    expect(target.querySelector('.graph-toolbar,.graph-inspector,[aria-label="Graph tools"],[aria-label="Graph selection"],.svelte-flow__controls,.svelte-flow__minimap')).toBeNull();
    for(const label of ['Node family','Add node','Undo','Redo','Copy','Paste','Duplicate','Delete selected','Fit all','Focus selection','Arrange','Find nodes','Connect or reconnect','Graph clipboard']){
      expect([...target.querySelectorAll('button,label,summary')].some(element=>element.textContent?.trim()===label),label).toBe(false);
    }
    expect(target.querySelector('[data-graph-node=a] .vict-textarea')).not.toBeNull();
    expect(target.querySelector('[data-graph-node=a] [aria-label="Collapse First"].vict-btn')).not.toBeNull();
    if(revision==='2'){
      for(const part of ['canvas','node','node-header','node-body','field','port'])expect(target.querySelector(`[data-ui-part="${part}"]`),part).not.toBeNull();
      for(const part of ['toolbar','inspector'])expect(target.querySelector(`[data-ui-part="${part}"]`),part).toBeNull();
      const css=[...document.querySelectorAll('style')].map(node=>node.textContent).join('\n');
      expect(css).toContain('#123456');expect(css).toContain('18px');
    }else expect(target.querySelector('[data-ui-part="node-body"]')).toBeNull();
    await unmount(app);target.remove();
  });
  it('labels the real Bits select trigger through presentation while preserving the accepted catalog prop contract',async()=>{
    const target=document.createElement('div');document.body.append(target);
    const app=mount(GraphFields,{target,props:{owner:'node',fields:[{id:'mode',label:'Mode',kind:'select',options:['trim','upper']}],values:{mode:'trim'},onchange:()=>{}}});
    await settle();
    expect(target.querySelector('[data-select-trigger]')?.getAttribute('aria-label')).toBe('Mode');
    await unmount(app);target.remove();
  });
});
