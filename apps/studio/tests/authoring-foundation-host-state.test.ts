// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {graphFoundationExample} from '../src/lib/designer/foundation-examples.js';
import {patchAuthoredGraph,rebaseGraphRuntime} from '../src/lib/designer/graph-authoring.js';
import {previewVisibility} from '../src/lib/designer/preview-visibility.js';
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
describe('canonical graph and owned preview host boundaries',()=>{
  it('rebases an old manual graph mirror after a later agent edit while preserving unrelated temporary state',()=>{
    const source=graphFoundationExample();const key='graph';
    const original=source.localState[key]!.initial;
    const model=JSON.parse(String(original));
    const node=model.nodes[0];
    const changed=patchAuthoredGraph(source,'graphEditor',[{type:'setField',nodeId:node.id,fieldId:'notes',value:'Later agent correction'}],model.revision);
    expect(changed.ok).toBe(true);if(!changed.ok)throw Error(changed.message);
    const runtime=rebaseGraphRuntime(changed.document,{[key]:original,query:'keep this draft',counter:7});
    expect(JSON.parse(String(runtime[key])).nodes[0].values.notes).toBe('Later agent correction');
    expect(runtime.query).toBe('keep this draft');expect(runtime.counter).toBe(7);
    expect(source.localState[key]!.initial).toBe(original);
  });
  it('refuses a target fully clipped by a nested scroll container even when inside the browser viewport',()=>{
    const parent=document.createElement('div'),target=document.createElement('button');parent.style.overflow='hidden';parent.append(target);document.body.append(parent);
    vi.spyOn(parent,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,100,100));
    for(const key of ['offsetWidth','offsetHeight','clientWidth','clientHeight'])Object.defineProperty(parent,key,{configurable:true,value:100});
    vi.spyOn(target,'getBoundingClientRect').mockReturnValue(new DOMRect(10,130,40,30));
    vi.spyOn(target,'getClientRects').mockReturnValue([new DOMRect(10,130,40,30)] as unknown as DOMRectList);
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clipped'});
  });
  it('distinguishes partial intersection from hidden and unsupported shape clipping',()=>{
    const parent=document.createElement('div'),target=document.createElement('button');parent.style.overflow='auto';parent.append(target);document.body.append(parent);
    vi.spyOn(parent,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,100,100));
    for(const key of ['offsetWidth','offsetHeight','clientWidth','clientHeight'])Object.defineProperty(parent,key,{configurable:true,value:100});
    vi.spyOn(target,'getBoundingClientRect').mockReturnValue(new DOMRect(10,80,40,30));
    vi.spyOn(target,'getClientRects').mockReturnValue([new DOMRect(10,80,40,30)] as unknown as DOMRectList);
    expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
    parent.style.clipPath='circle(10px)';expect(previewVisibility(target)).toEqual({visible:false,reason:'clip-path-unverified'});
    parent.style.clipPath='none';parent.style.display='none';expect(previewVisibility(target)).toEqual({visible:false,reason:'hidden'});
  });
});
