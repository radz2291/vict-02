// @vitest-environment happy-dom
import {flushSync,mount,unmount} from 'svelte';
import {afterEach,expect,it,vi} from 'vitest';
import Cycle14Showcase from '../../src/lib/designer/Cycle14Showcase.svelte';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';});

it('renders the shared evidence UI in a clearly simulated public Popover, including complete/partial and source-region limits',async()=>{
 instance=mount(Cycle14Showcase,{target:document.body});
 flushSync();
 expect(document.body.textContent).toContain('Agent measurements and observed regions · SIMULATED');
 expect(document.body.textContent).toContain('not a real run or captured image');
 document.querySelector<HTMLButtonElement>('.evidence-demo-trigger')!.click();flushSync();
 await vi.waitFor(()=>expect(document.querySelector('[aria-label="Simulated Chat evidence"]')?.textContent).toContain('Turn measurements'));
 const content=()=>document.querySelector<HTMLElement>('[aria-label="Simulated Chat evidence"]')!;
 expect(content().textContent).toContain('SIMULATED evidence');
 expect(content().textContent).toContain('12 tool calls');
 expect(content().textContent).toContain('6 receipt-derived edits including cleanup.');
 expect(content().textContent).toContain('tool-active interval union: 12.0 s');
 expect(content().textContent).toContain('earlier source in this turn');
 expect(content().textContent).toContain('matched final source of this turn');
 expect(content().textContent).toContain('within 560×1400');
 expect(content().textContent).toContain("Region labels compare with the completed turn's final source;");
 expect(content().textContent).toContain('they do not track later source, runtime or viewport changes.');
 expect(content().textContent).toContain('Offscreen content and interactions remain unverified.');
 expect(content().textContent).toContain('exact provider latency is unavailable.');
 document.querySelector<HTMLButtonElement>('[aria-label="Close simulated evidence"]')!.click();flushSync();
 await vi.waitFor(()=>expect(document.querySelector('[aria-label="Simulated Chat evidence"]')).toBeNull());
 const state=document.querySelector<HTMLSelectElement>('#agent-evidence-state')!;
 state.querySelector<HTMLOptionElement>('option[value="partial"]')!.selected=true;
 state.dispatchEvent(new Event('change',{bubbles:true}));flushSync();
 expect(state.value).toBe('partial');
 document.querySelector<HTMLButtonElement>('.evidence-demo-trigger')!.click();flushSync();
 await vi.waitFor(()=>expect(content()?.textContent).toContain('Partial browser measurements; the server completion receipt was not received.'));
 expect(content().textContent).toContain('Provider requests and token usage unavailable.');
 expect(content().textContent).toContain('2 receipt-derived edits including cleanup.');
 expect(content().textContent).not.toContain('Reported authoring usage:');
 expect(content().textContent).not.toContain('Observed regions');
 expect(content().textContent).toContain('Exact model steps and cost unavailable.');
 document.querySelector<HTMLButtonElement>('[aria-label="Close simulated evidence"]')!.click();flushSync();
 await vi.waitFor(()=>expect(document.querySelector('[aria-label="Simulated Chat evidence"]')).toBeNull());
 state.querySelector<HTMLOptionElement>('option[value="unavailable"]')!.selected=true;
 state.dispatchEvent(new Event('change',{bubbles:true}));flushSync();
 document.querySelector<HTMLButtonElement>('.evidence-demo-trigger')!.click();flushSync();
 await vi.waitFor(()=>expect(content()?.textContent).toContain('Token usage unavailable.'));
 expect(content().textContent).toContain('No confirmed edit.');
 expect(content().textContent).toContain('0 receipt-derived edits including cleanup.');
 expect(content().textContent).toContain('2 authoring model requests · 0 image requests.');
 expect(content().textContent).not.toContain('Partial browser measurements;');
 expect(content().textContent).not.toContain('Reported authoring usage:');
 expect(content().textContent).not.toContain('Observed regions');
});


it('shows the quiet chronological Chat example with expandable Input and Result, honestly marked simulated',async()=>{
 instance=mount(Cycle14Showcase,{target:document.body});flushSync();
 const demo=document.querySelector<HTMLElement>('[aria-label="Quiet Chat presentation example"]')!;
 expect(demo.textContent).toContain('SIMULATED');expect(demo.textContent).toContain('not a real agent turn');
 expect([...demo.querySelectorAll('[data-event-kind]')].map(n=>n.getAttribute('data-event-kind'))).toEqual(['text','activity','text']);
 const trigger=demo.querySelector<HTMLButtonElement>('[data-event-kind="activity"] button')!;expect(trigger.getAttribute('aria-expanded')).toBe('false');trigger.click();flushSync();
 await vi.waitFor(()=>expect(trigger.getAttribute('aria-expanded')).toBe('true'));
 expect(demo.querySelector('[aria-label="Tool input"]')?.textContent).toContain('"query": "nodes"');expect(demo.querySelector('[aria-label="Tool result"]')?.textContent).toContain('"ok": true');
});
