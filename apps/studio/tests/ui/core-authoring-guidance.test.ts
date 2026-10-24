// @vitest-environment happy-dom
import { mount,tick,unmount } from 'svelte';
import { expect,it } from 'vitest';
import AuthoringGuidance from '../../src/lib/designer/AuthoringGuidance.svelte';
import { createShowcaseFixture } from '../../src/lib/designer/showcase.js';
import { screenAuthoringGuidance } from '../../src/lib/designer/placement.js';
import { compileScreen,screenIssues } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';

function readOnlyFixture(){
  const fixture=createShowcaseFixture('vict.ai.prompt-input');
  const node=fixture.document.nodes[fixture.targetNodeId];
  if(node.kind!=='component')throw Error('fixture must be a controlled component');
  const {outputs,...readOnlyNode}=node;
  return {...fixture,document:{...fixture.document,nodes:{...fixture.document.nodes,[node.id]:readOnlyNode}}};
}
it('shows bounded non-blocking guidance without mutating or rejecting source',async()=>{
  const {document:source,targetNodeId}=readOnlyFixture();
  const before=JSON.stringify(source);
  expect(compileScreen(source).ok).toBe(true);
  expect(screenIssues(source)).toEqual([]);
  expect(screenAuthoringGuidance(source)).toMatchObject({count:1,more:false,items:[{code:'UI_AUTHORING_CONTROLLED_UNBOUND',nodeId:targetNodeId}]});
  const instance=mount(AuthoringGuidance,{target:document.body,props:{document:source}});
  try {
    await tick();
    expect(document.querySelector('summary')?.textContent).toBe('Source guidance (1)');
    expect(document.querySelector('details')?.open).toBe(false);
    expect(document.querySelector('li')?.textContent).toContain(targetNodeId);
    expect(document.querySelector('li')?.textContent).toContain('read-only');
    const data=new Map<string,string>();
    const store=screenStore({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);}},source.id);
    expect(store.save({document:source,newStoredRevision:'saved-guidance',expectedStoredRevision:'r1'}).ok).toBe(true);
    expect(store.rawLoad().status).toBe('loaded');
    expect(JSON.stringify(source)).toBe(before);
  } finally {await unmount(instance);document.body.innerHTML='';}
});

it('bounds visible warnings while preserving their total',()=>{
  const {document:fixture,targetNodeId}=readOnlyFixture();
  const source={...fixture,nodes:{...fixture.nodes}};
  const node=source.nodes[targetNodeId];
  if(node.kind!=='component')throw Error('fixture');
  for(let i=0;i<24;i++) {
    const id=`extra-${i}`;
    source.nodes[id]={...node,id};
    const root=source.nodes[source.root];if(root.kind==='element')source.nodes[root.id]={...root,children:[...root.children,id]};
  }
  expect(screenAuthoringGuidance(source)).toMatchObject({count:25,more:true});
  expect(screenAuthoringGuidance(source).items).toHaveLength(20);
});
