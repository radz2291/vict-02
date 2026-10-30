import {describe,it,expect,vi} from 'vitest';import {mount,unmount,flushSync} from 'svelte';
import {memoryAssetStore,importMediaAsset,exportMediaArchive,type MediaAssetStore} from '../src/assets.js';import LibraryHost from './LibraryHost.svelte';
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nxoAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
const valid=(name:string)=>new File([png.slice().buffer],name,{type:'image/png'});
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,50));flushSync();};
function supply(input:HTMLInputElement,files:File[]){Object.defineProperty(input,'files',{configurable:true,value:files});input.dispatchEvent(new Event('change',{bubbles:true}));}
describe('media library partial-write recovery',()=>{
 it('opens each native picker through its named public control and retains specific removal naming',async()=>{
   const store=memoryAssetStore();await store.put(await importMediaAsset(valid('long-descriptive-captions-file.png')));
   const onselected=vi.fn(),target=document.createElement('div');document.body.append(target);const instance=mount(LibraryHost,{target,props:{store,onchange:vi.fn(),onselected}});await settle();
   const inputs=Array.from(target.querySelectorAll<HTMLInputElement>('input[type=file]'));
   const buttons=Array.from(target.querySelectorAll<HTMLButtonElement>('button.vict-btn'));
   for(const [index,label] of ['Supply media','Import media archive'].entries()){
     const input=inputs[index]!,open=vi.spyOn(input,'click').mockImplementation(()=>{});
     expect(input.hidden).toBe(true);expect(input.getAttribute('aria-label')).toBe(label);
     buttons.find(button=>button.textContent===label)!.click();expect(open).toHaveBeenCalledOnce();open.mockRestore();
   }
   const remove=buttons.find(button=>button.getAttribute('aria-label')==='Remove stored asset long-descriptive-captions-file.png');
   expect(remove?.textContent).toBe('Remove');expect(target.querySelector('[title="long-descriptive-captions-file.png"]')).not.toBeNull();
   target.querySelector<HTMLButtonElement>('[title="long-descriptive-captions-file.png"]')!.click();
   expect(onselected).toHaveBeenCalledWith((await store.list())[0]!.reference);expect(await store.list()).toHaveLength(1);
   remove!.click();await vi.waitFor(async()=>expect(await store.list()).toHaveLength(0));
   await settle();expect(target.textContent).toContain('Removed long-descriptive-captions-file.png');await unmount(instance);target.remove();
 });
 it('does not display or notify a different application after a pending upload finishes',async()=>{
   const old=memoryAssetStore(),next=memoryAssetStore();let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),entered=new Promise<void>(resolve=>started=resolve);
   const store:MediaAssetStore={get:ref=>old.get(ref),list:()=>old.list(),remove:ref=>old.remove(ref),async put(asset){started();await gate;await old.put(asset);}};
   const onchange=vi.fn(),target=document.createElement('div');document.body.append(target);const instance=mount(LibraryHost,{target,props:{store,onchange}});await settle();
   supply(target.querySelector<HTMLInputElement>('input[multiple]')!,[valid('old-application.png')]);await entered;instance.replaceHost('new-application',next);await settle();release();await vi.waitFor(async()=>expect(await old.list()).toHaveLength(1),{timeout:3000});await settle();
   expect(await old.list()).toHaveLength(1);expect(await next.list()).toHaveLength(0);expect(target.textContent).not.toContain('old-application.png');expect(onchange).not.toHaveBeenCalled();await unmount(instance);target.remove();
 });
 it('refreshes/notifies after one valid upload then an invalid file, preserving the successful bytes',async()=>{
   const store=memoryAssetStore(),onchange=vi.fn(),target=document.createElement('div');document.body.append(target);const instance=mount(LibraryHost,{target,props:{store,onchange}});await settle();
   supply(target.querySelector<HTMLInputElement>('input[multiple]')!,[valid('kept.png'),new File(['invalid mp4'],'bad.mp4',{type:'video/mp4'})]);await vi.waitFor(()=>expect(target.textContent).toContain('before upload stopped'),{timeout:3000});await settle();
   expect((await store.list()).map(asset=>asset.name)).toEqual(['kept.png']);expect(target.textContent).toContain('kept.png');expect(target.textContent).toContain('Imported 1 of 2 assets before upload stopped');expect(target.textContent).toContain('do not match');expect(onchange).toHaveBeenCalledOnce();
   await unmount(instance);target.remove();
 });
 it('refreshes/notifies after an archive storage failure without deleting earlier imported bytes',async()=>{
   const inputStore=memoryAssetStore();await inputStore.put(await importMediaAsset(valid('first.png')));const second=new Uint8Array(png);second[second.length-1]=second[second.length-1]!^1;await inputStore.put(await importMediaAsset(new File([second.buffer],'second.png',{type:'image/png'})));
   const archive=await exportMediaArchive(inputStore),retained=memoryAssetStore();let writes=0;
   const store:MediaAssetStore={get:ref=>retained.get(ref),list:()=>retained.list(),remove:ref=>retained.remove(ref),async put(asset){if(++writes===2)throw Error('Synthetic storage quota failure.');await retained.put(asset);}};
   const onchange=vi.fn(),target=document.createElement('div');document.body.append(target);const instance=mount(LibraryHost,{target,props:{store,onchange}});await settle();
   supply(target.querySelectorAll<HTMLInputElement>('input[type=file]')[1]!,[new File([archive],'archive.json',{type:'application/json'})]);await vi.waitFor(()=>expect(target.textContent).toContain('before archive import stopped'),{timeout:3000});await settle();
   expect(await retained.list()).toHaveLength(1);expect(target.textContent).toContain('first.png');expect(target.textContent).toContain('Imported 1 managed asset before archive import stopped');expect(target.textContent).toContain('quota failure');expect(onchange).toHaveBeenCalledOnce();
   await unmount(instance);target.remove();
 });
});
