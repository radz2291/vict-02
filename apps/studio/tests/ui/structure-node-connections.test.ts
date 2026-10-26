// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import StructureView from '../../src/lib/designer/StructureView.svelte';
import {clarityFixture} from '../fixtures/structure-clarity.js';
import {bindingFixture} from '../fixtures/structure-semantics.js';
import {structureId} from '../../src/lib/designer/structure.js';

let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';});
async function settle(){flushSync();await tick();await tick();}
async function start(source=clarityFixture(140),focus=structureId(source.id,'state','message')){
 const callbacks={onSelect:vi.fn(),onMove:vi.fn(()=>false),onNotice:vi.fn()};
 instance=mount(StructureView,{target:document.body,props:{document:source,revision:'r1',focusSelection:focus,...callbacks}});
 await settle();return callbacks;
}
function node(id:string){return [...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node=>node.dataset.id===id)!;}
it('keeps a large shared dependency to one counted socket row without dropping visible consumers',async()=>{
 const source=clarityFixture(140),before=JSON.stringify(source);
 await start(source);
 const provider=node(structureId(source.id,'state','message'));
 const rows=provider.querySelectorAll('.connection-row');
 expect(rows).toHaveLength(1);expect(rows[0]?.getAttribute('data-port')).toBe('out-value');
 expect(rows[0]?.textContent).toContain('Value');expect(rows[0]?.textContent).toContain('24');
 expect(document.querySelectorAll('.svelte-flow__node')).toHaveLength(25);
 expect(rows[0]?.getAttribute('title')).toBe('Outgoing Value · 24 declared references');
 expect(JSON.stringify(source)).toBe(before);
});
it('separates Value, Fallback and Updates at their actual read-only endpoint rows',async()=>{
 const source=bindingFixture();await start(source,structureId(source.id,'node','field'));
 const rows=[...document.querySelectorAll<HTMLElement>('.connection-row')];
 expect(rows.some(row=>row.dataset.port==='in-value')).toBe(true);
 expect(rows.some(row=>row.dataset.port==='in-fallback')).toBe(true);
 expect(rows.some(row=>row.dataset.port==='out-updates')).toBe(true);
 for(const socket of document.querySelectorAll<HTMLElement>('.declared-connection-handle')){
  expect(socket.getAttribute('aria-hidden')).toBe('true');expect(socket.tabIndex).toBe(-1);
  expect(socket.classList.contains('connectable')).toBe(false);
 }
});
