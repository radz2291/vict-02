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
  it('retains root-only editor@1 and admits exact new editor@2 knowledge without changing the old pin',()=>{
    expect(flowEditorDescriptor.styleTargets).toEqual(['root']);
    expect(flowEditorDescriptorV2.styleTargets).toContain('node-body');
    expect(createUiAuthoringRegistry([flowAuthoringPackage],flowAuthoringImplementations,{requireCompatibility:true}).issues).toEqual([]);
    const registration=flowAuthoringPackage.registrations.find(item=>item.descriptor.id==='vict.flow.editor'&&item.descriptor.revision==='2')!;
    expect(registration.seed?.nodes.find(node=>node.kind==='component')?.revision).toBe('2');
  });
  for(const revision of ['1','2'])it(`renders editor@${revision} through the registered host with shared controls and real declared parts`,async()=>{
    const doc=source(revision),compiled=compileUiDocument(doc,defaultSemanticElementCatalog(),flowAuthoringDescriptors);
    expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)return;
    const target=document.createElement('div');document.body.append(target);
    const app=mount(DocumentHost,{target,props:{plan:compiled.plan,extensionDescriptors:flowAuthoringDescriptors,extensionImplementations:flowAuthoringImplementations,dispatch:async()=>undefined,navigate:()=>{}}});
    await settle();
    expect(target.querySelector('.vict-graph-editor[data-ui-part=root]')).not.toBeNull();
    expect(target.querySelector('.graph-toolbar[role=group] .vict-btn')).not.toBeNull();
    expect(target.querySelector('.graph-toolbar .vict-select')).not.toBeNull();
    expect(target.querySelector('[data-graph-node=a] .vict-textarea')).not.toBeNull();
    expect(target.querySelector('[data-graph-node=a] [aria-label="Collapse First"].vict-btn')).not.toBeNull();
    if(revision==='2'){
      for(const part of ['toolbar','canvas','inspector','node','node-header','node-body','field','port'])expect(target.querySelector(`[data-ui-part="${part}"]`),part).not.toBeNull();
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
