// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {workspaceControl} from './studio-menu.js';
let app:ReturnType<typeof mount>|undefined;
async function settle(){flushSync();await tick();await tick();}
function control(name:string){const button=workspaceControl(name);expect(button,name).toBeDefined();return button!;}
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';localStorage.clear();});
it('keeps the text selected through Relationships and Locate while marking and explaining its containing label',async()=>{
 const seed=newScreen('Text location','text-location'),source={...seed,revision:'r1.r1',nodes:{screen:{id:'screen',kind:'element' as const,tag:'main',children:['label']},label:{id:'label',kind:'element' as const,tag:'label',children:['text']},text:{id:'text',kind:'text' as const,content:{type:'literal' as const,value:'Work email'}}}};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
 app=mount(Designer,{target:document.body});await settle();control('Structure').click();await settle();control('Selection panel').click();await settle();control('Relationships').click();await settle();
 document.querySelector<HTMLButtonElement>('.endpoint[aria-label="Label · Work email"]')!.click();await settle();document.querySelector<HTMLButtonElement>('.endpoint[aria-label="Text · Work email"]')!.click();await settle();
 expect(document.querySelector('.selection-identity-card .identity-context')?.textContent).toBe('Text inside Label · Work email');control('Overview').click();await settle();
 const label=document.querySelector<HTMLElement>('.design-frame label')!;Object.defineProperty(label,'getClientRects',{configurable:true,value:()=>[{width:120,height:20}]});label.scrollIntoView=vi.fn();control('Locate text on canvas ↗').click();await settle();await settle();
 expect(control('Design').getAttribute('aria-pressed')).toBe('true');expect(label.getAttribute('data-ui-selection-proxy-for')).toBe('["text-location|text"]');expect(label.hasAttribute('data-ui-selected')).toBe(true);expect(document.querySelector('.design-frame [data-ui-node=text]')?.hasAttribute('data-ui-selected')).toBe(false);
 expect(document.querySelector('.source-details header')?.textContent).toContain('Text inside Label · Work email');expect(document.querySelector('.text-location-explanation')?.textContent).toContain('The text remains selected');expect(document.querySelector('.designer-footer')?.textContent??document.body.textContent).not.toContain('This source has no visible canvas element');
 control('Technical information').click();await settle();expect(document.querySelector('.source-details')?.textContent).toContain('text-location|text');expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
