import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,createUiAuthoringRegistry,type UiDocument,type UiValue} from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import {catalogDescriptors,catalogImplementations} from '../../ui-svelte/src/catalog/components/catalog.js';
import {flowAuthoringDescriptors} from '../src/authoring/descriptors.js';
import {flowAuthoringImplementations} from '../src/authoring/implementations.js';
import {flowAuthoringPackage} from '../src/authoring/knowledge.js';
import {typedCompositionDocument} from './composition-fixtures.js';
import {parseGraphV2} from '../src/editor/model-v2.js';

/** Coding-authored leaf regression, not actual-agent/native application evidence. */
function source():UiDocument {
  const value=typedCompositionDocument('media','port-row-proof');
  for(const node of Object.values(value.nodes))if(node.kind==='component'&&node.definitionId==='vict.flow.port'){
    node.definitionId='vict.flow.port-row';node.revision='1';
    node.props={...node.props,color:{type:'literal',value:node.id==='settings-out'||node.id==='output-in'?'#14b8a6':'#a855f7'}};
  }
  return value;
}
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,45));flushSync();};
async function open(documentSource:UiDocument){
  const descriptors=[...catalogDescriptors,...flowAuthoringDescriptors],implementations=[...catalogImplementations,...flowAuthoringImplementations];
  const compiled=compileUiDocument(documentSource,defaultSemanticElementCatalog(),descriptors);
  expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)throw Error('Invalid fixture');
  const target=document.createElement('div');document.body.append(target);const writes:[string,UiValue][]=[];
  const app=mount(DocumentHost,{target,props:{plan:compiled.plan,localState:documentSource.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onStateChange:(key,value)=>writes.push([key,value])}});
  await settle();return {target,writes,async close(){await unmount(app);target.remove();}};
}
describe('named semantic port rows',()=>{
  it('installs a separately pinned compatible leaf and keeps bare-port identities',()=>{
    const registry=createUiAuthoringRegistry([flowAuthoringPackage],flowAuthoringImplementations,{requireCompatibility:true});
    expect(registry.issues).toEqual([]);
    expect(registry.descriptors.filter(d=>d.id==='vict.flow.port').map(d=>d.revision)).toEqual(['3','2','1']);
    expect(registry.descriptors.find(d=>d.id==='vict.flow.port-row')?.styleTargets).toEqual(['root','handle','socket','label','type']);
  });
  it('names all sockets by actual graph semantics and preserves ordinary per-node input writes',async()=>{
    const original=source(),view=await open(original);try{
      const rows=[...view.target.querySelectorAll<HTMLElement>('.graph-port-row')];expect(rows).toHaveLength(5);
      expect(rows.filter(r=>r.dataset.direction==='input')).toHaveLength(2);
      expect(rows.filter(r=>r.dataset.direction==='output')).toHaveLength(3);
      expect(rows.every(r=>!!r.querySelector('.port-row-label')?.textContent?.trim()&&!!r.querySelector('.port-row-type')?.textContent?.trim())).toBe(true);
      expect(view.target.querySelector('[data-node-port="sampler/source"] .svelte-flow__handle')?.getAttribute('aria-label')).toBe('input Prompt: text');
      expect(view.target.querySelector<HTMLElement>('[data-node-port="sampler/result"]')?.style.getPropertyValue('--vict-port-row-color')).toBe('#14b8a6');
      const inputs=[...view.target.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Shot prompt"]')];expect(inputs).toHaveLength(2);
      inputs[0].value='Updated first shot';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));await settle();
      const text=[...view.writes].reverse().find(([key])=>key==='graph')?.[1];expect(typeof text).toBe('string');
      const parsed=parseGraphV2(String(text));expect(parsed.ok).toBe(true);if(!parsed.ok)throw Error('Invalid graph');
      expect(parsed.graph.nodes.find(n=>n.id==='prompt-a')?.values.text).toBe('Updated first shot');
      expect(parsed.graph.nodes.find(n=>n.id==='prompt-b')?.values.text).toBe('Dusk on the mountain');
      expect(parsed.graph.edges).toEqual(JSON.parse(String(original.localState.graph.initial)).edges);
    }finally{await view.close();}
  });
  it('refuses duplicate semantic anchors even across bare and labeled presentations',async()=>{
    const documentSource=source(),card=documentSource.nodes['prompt-card'];if(card.kind!=='element')throw Error('Fixture');
    card.children.push('duplicate-port');documentSource.nodes['duplicate-port']={kind:'component',id:'duplicate-port',definitionId:'vict.flow.port',revision:'2',props:{id:{type:'literal',value:'result'}},slots:{}};
    const view=await open(documentSource);try{
      const duplicateAlerts=[...view.target.querySelectorAll('[role="alert"]')].filter(node=>node.textContent?.startsWith('Graph port unavailable or duplicated:'));
      expect(duplicateAlerts).toHaveLength(4);
      expect(view.target.querySelector('[data-node-port="prompt-a/result"]')).toBeNull();
      expect(view.target.querySelector('[data-node-port="prompt-b/result"]')).toBeNull();
      expect(view.writes.filter(([key])=>key==='graph')).toEqual([]);
    }finally{await view.close();}
  });
  it('keeps labels but disables connections when readonly and never emits unsafe color CSS',async()=>{
    const documentSource=source(),workspace=documentSource.nodes.workspace,row=documentSource.nodes['settings-out'];
    if(workspace.kind!=='component'||row.kind!=='component')throw Error('Fixture');
    workspace.props={...workspace.props,readOnly:{type:'literal',value:true}};
    row.props={...row.props,color:{type:'literal',value:'url(https://invalid.example/paint.svg)'}};
    const view=await open(documentSource);try{
      const output=view.target.querySelector<HTMLElement>('[data-node-port="sampler/result"]')!;
      expect(output.textContent).toContain('Frame');expect(output.querySelector('[role="alert"]')).not.toBeNull();
      expect(output.getAttribute('style')).not.toContain('url(');
      expect(view.target.querySelectorAll('.svelte-flow__handle.connectable')).toHaveLength(0);
      expect(view.writes.filter(([key])=>key==='graph')).toEqual([]);
    }finally{await view.close();}
  });
});
