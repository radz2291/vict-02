// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {previewVisibility} from '../src/lib/designer/preview-visibility.js';
vi.mock('@victframework/ui-ai-svelte',()=>({captureRenderedElement:vi.fn()}));
import {previewFacts} from '../src/lib/designer/visual-observation.js';

afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
function fixture(rect:DOMRect,metrics:{offsetWidth:number;offsetHeight:number;clientLeft:number;clientTop:number;clientWidth:number;clientHeight:number}){
  const parent=document.createElement('div'),target=document.createElement('button');
  parent.style.overflow='hidden';parent.append(target);document.body.append(parent);
  vi.spyOn(parent,'getBoundingClientRect').mockReturnValue(rect);
  for(const [key,value]of Object.entries(metrics))Object.defineProperty(parent,key,{configurable:true,value});
  const place=(box:DOMRect)=>{vi.spyOn(target,'getBoundingClientRect').mockReturnValue(box);vi.spyOn(target,'getClientRects').mockReturnValue([box] as unknown as DOMRectList);};
  return {parent,target,place};
}
const metrics={offsetWidth:100,offsetHeight:100,clientLeft:10,clientTop:10,clientWidth:70,clientHeight:70};

function ownedSurface(parent:HTMLElement,node:string,part:string,role?:string,owner='app'){
  const surface=document.createElement('div');
  surface.dataset.uiOwner=owner;surface.dataset.uiNode=node;surface.dataset.uiPart=part;
  if(role)surface.setAttribute('role',role);
  parent.append(surface);
  const box=new DOMRect(20,20,100,60);
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(surface,'getClientRects').mockReturnValue([box] as unknown as DOMRectList);
  return surface;
}

describe('truthful owned overlay inventory',()=>{
  it('does not mistake message content or ordinary panel parts for an open overlay',()=>{
    const frame=document.createElement('div'),root=document.createElement('main');
    root.dataset.uiOwnerRoot='app';frame.append(root);document.body.append(frame);
    ownedSurface(root,'message-1','content');ownedSurface(root,'message-2','content');ownedSurface(root,'inspector','panel');
    expect(previewFacts(frame).ownedOverlays).toBe(0);
  });
  it('counts visible owned semantic overlays independently of the requested target, excluding hidden and other owners',()=>{
    const frame=document.createElement('main');frame.dataset.uiOwnerRoot='app';document.body.append(frame);
    ownedSurface(frame,'message','content');
    ownedSurface(document.body,'drawer','panel','dialog');
    const hidden=ownedSurface(document.body,'closed','content','menu');hidden.style.display='none';
    ownedSurface(document.body,'studio-menu','content','menu','studio');
    const facts=previewFacts(frame,{nodeId:'message',part:'content'});
    expect(facts.ownedOverlays).toBe(1);
    expect(facts.targets.map(item=>item.nodeId)).toEqual(['message']);
  });
});
describe('owned preview client-box clipping',()=>{
  it('does not count an ancestor border as visible overflow content',()=>{
    const {target,place}=fixture(new DOMRect(0,0,100,100),metrics);place(new DOMRect(2,30,6,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clipped'});
  });
  it('excludes scrollbar gutters and keeps a genuine partial client-box intersection',()=>{
    const {target,place}=fixture(new DOMRect(0,0,100,100),metrics);place(new DOMRect(85,30,10,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clipped'});
    place(new DOMRect(75,30,10,10));expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
  });
  it('uses clientTop and clientHeight to exclude horizontal borders and gutters',()=>{
    const {target,place}=fixture(new DOMRect(0,0,100,100),metrics);place(new DOMRect(30,85,10,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clipped'});
  });
  it('accounts for a left-hand scrollbar through clientLeft',()=>{
    const {target,place}=fixture(new DOMRect(0,0,100,100),{...metrics,clientLeft:25,clientWidth:65});place(new DOMRect(12,30,10,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clipped'});
  });
  it('converts client metrics through positive independent axis scaling',()=>{
    const {parent,target,place}=fixture(new DOMRect(100,50,200,150),{offsetWidth:100,offsetHeight:50,clientLeft:5,clientTop:4,clientWidth:80,clientHeight:40});
    parent.style.transform='matrix(2,0,0,3,100,50)';place(new DOMRect(101,70,8,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clip-geometry-unverified'});
    place(new DOMRect(115,70,10,10));expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
  });
  it('only clips an axis whose overflow establishes clipping',()=>{
    const {parent,target,place}=fixture(new DOMRect(0,0,100,100),metrics);parent.style.overflow='';parent.style.overflowX='clip';parent.style.overflowY='visible';place(new DOMRect(30,200,10,10));
    expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
  });
  it('refuses rotated or skewed client-box geometry rather than overclaim visibility',()=>{
    const {parent,target,place}=fixture(new DOMRect(0,0,100,100),metrics);place(new DOMRect(30,30,10,10));parent.style.transform='matrix(1,0.2,0,1,0,0)';
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clip-geometry-unverified'});
  });
  it('refuses an individual reflected scale whose client-box origin is reversed',()=>{
    const {parent,target,place}=fixture(new DOMRect(0,0,100,100),metrics);place(new DOMRect(30,30,10,10));parent.style.setProperty('scale','-1 1');
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clip-geometry-unverified'});
  });
  it('refuses missing layout metrics in a DOM fake instead of using an oversized border box',()=>{
    const {target,place}=fixture(new DOMRect(0,0,100,100),{...metrics,offsetWidth:0});place(new DOMRect(30,30,10,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clip-geometry-unverified'});
  });
  it('does not promote rounded integer layout measurements to exact fractional clip edges',()=>{
    const {parent,target,place}=fixture(new DOMRect(0,0,99.6,100),{offsetWidth:100,offsetHeight:100,clientLeft:10,clientTop:10,clientWidth:80,clientHeight:80});
    parent.style.width='79.6px';parent.style.border='10px solid black';place(new DOMRect(89.61,30,0.02,5));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'clip-geometry-unverified'});
    place(new DOMRect(30,30,10,10));expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
  });
  it('does not claim a bounding-box corner clipped by rounded overflow is visible',()=>{
    const {parent,target,place}=fixture(new DOMRect(0,0,100,100),{offsetWidth:100,offsetHeight:100,clientLeft:0,clientTop:0,clientWidth:100,clientHeight:100});
    parent.style.borderRadius='50px';place(new DOMRect(1,1,5,5));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'rounded-clip-unverified'});
    place(new DOMRect(40,40,20,20));expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
  });
  it('handles percentage elliptical radii conservatively under independent axis scaling',()=>{
    const {parent,target,place}=fixture(new DOMRect(100,50,200,100),{offsetWidth:100,offsetHeight:50,clientLeft:0,clientTop:0,clientWidth:100,clientHeight:50});
    parent.style.transform='matrix(2,0,0,2,100,50)';parent.style.borderRadius='50%';place(new DOMRect(101,51,5,5));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'rounded-clip-unverified'});
    place(new DOMRect(180,90,20,10));expect(previewVisibility(target)).toEqual({visible:true,reason:'visible'});
  });
  it('refuses an unresolved radius expression instead of falling back to a rectangular clip',()=>{
    const {parent,target,place}=fixture(new DOMRect(0,0,100,100),metrics);parent.style.borderTopLeftRadius='calc(10px + 5%)';place(new DOMRect(30,30,10,10));
    expect(previewVisibility(target)).toEqual({visible:false,reason:'rounded-clip-unverified'});
  });
});
