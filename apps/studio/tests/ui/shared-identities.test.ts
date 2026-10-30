// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,canonicalUiDocument,type UiNode} from '@victframework/ui';
import {Layers,SourceIdentity,sourceIcon} from '@victframework/ui-editor';
import Relationships from '../../src/lib/designer/SelectionRelationships.svelte';
import {projectStructure,structureId,structureNodePresentation} from '../../src/lib/designer/structure.js';
import {selectionIdentity} from '../../src/lib/designer/selection-presentation.js';
import {newScreen} from '../../src/lib/designer/application.js';
let apps:ReturnType<typeof mount>[]=[];
afterEach(async()=>{for(const app of apps)await unmount(app);apps=[];document.body.innerHTML='';});
async function settle(){flushSync();await tick();await tick();}
const fixture=()=>({...newScreen('Identity review','identity-review'),nodes:{screen:{id:'screen',kind:'element' as const,tag:'main',children:['heading']},heading:{id:'heading',kind:'element' as const,tag:'h1',children:['text']},text:{id:'text',kind:'text' as const,content:{type:'literal' as const,value:'Create your workspace'}}}});
it('uses one source icon in Layers, Structure and Selection without merging Heading and Text identities',async()=>{
 const source=fixture(),digest=canonicalUiDocument(source).contentDigest,graph=projectStructure(source),compiled=compileUiDocument(source,defaultSemanticElementCatalog());if(!compiled.ok)throw Error('Invalid fixture');
 apps.push(mount(Layers,{target:document.body,props:{document:source,plan:compiled.plan}}));await settle();
 document.querySelector<HTMLButtonElement>('[data-key="identity-review|heading"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await settle();
 for(const [id,icon] of [['heading','heading'],['text','text']] as const){
  const node=graph.nodes.find(n=>n.data.sourceId===id)!;
  expect(document.querySelector(`[data-key="identity-review|${id}"] [data-source-icon]`)?.getAttribute('data-source-icon')).toBe(icon);
  expect(structureNodePresentation(source,node.data).iconKey).toBe(icon);
  expect(selectionIdentity(source,graph,{kind:'node',id:node.id}).iconKey).toBe(icon);
 }
 const intent=vi.fn();apps.push(mount(Relationships,{target:document.body,props:{document:source,graph,items:[{kind:'node',id:structureId(source.id,'node','heading')}],onIntent:intent}}));await settle();
 const endpoint=document.querySelector<HTMLButtonElement>('.endpoint[aria-label="Text · Create your workspace"]')!;
 expect(endpoint.querySelector('[data-source-icon]')?.getAttribute('data-source-icon')).toBe('text');
 expect(endpoint.textContent).toContain('Text inside Heading');expect(endpoint.title).toContain(structureId(source.id,'node','text'));
 endpoint.dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));await settle();expect(intent).toHaveBeenCalledWith({kind:'node',id:structureId(source.id,'node','text'),occurrence:'identity-review|text'},'toggle');
 expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});
it('classifies authored controls and structural kinds without name or ID suffix heuristics',()=>{
 const native=(tag:string,attributes={})=>({id:'Heading.checkbox',kind:'element',tag,attributes,children:[]} as UiNode);
 expect(sourceIcon(native('h3'))).toBe('heading');expect(sourceIcon(native('input',{type:'checkbox'}))).toBe('checkbox');expect(sourceIcon(native('input',{type:'radio'}))).toBe('radio');expect(sourceIcon(native('input'))).toBe('input');
 for(const kind of ['component','repeat','conditional','slot','portal'] as const)expect(sourceIcon({kind,id:'fake',definitionId:'anything.checkbox'} as UiNode)).toBe(kind);
 expect(sourceIcon(native('custom-heading'))).toBe('container');expect(sourceIcon(undefined)).toBe('container');expect(sourceIcon(undefined,{kind:'extension'})).toBe('component');expect(sourceIcon(undefined,{kind:'element',tag:'h2'})).toBe('heading');
});
it('places metadata under the name in the shared identity without making it part of the icon row',async()=>{
 apps.push(mount(SourceIdentity,{target:document.body,props:{icon:'text',name:'Create your workspace',context:'Text inside Heading · exact-source-id'}}));await settle();
 const identity=document.querySelector('.source-identity')!;expect([...identity.children].map(child=>child.className.split(' ')[0])).toEqual(['identity-icon','identity-name','identity-context']);
 expect(identity.querySelector('.identity-name')?.textContent).toBe('Create your workspace');expect(identity.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});
