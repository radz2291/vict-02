<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import { floatingPlacement } from './floating-position.js';
  let { canvas, occurrence, children, revealSignal, preferred = 'above', fallbackOccurrences = [], pinned = false }: { canvas: HTMLElement; occurrence: string; children: Snippet; revealSignal?: symbol; preferred?: 'above' | 'below'; fallbackOccurrences?: readonly string[]; pinned?: boolean } = $props();
  let palette = $state<HTMLElement>();
  let placement = $state<{ left: number; top: number; width: number }>();
  let dismissed = $state(false);
  // Keep fixed tools outside authored container-query/transform containing blocks.
  function portal(element: HTMLElement) {
    globalThis.document.body.append(element);
    return { destroy() { element.remove(); } };
  }
  $effect(() => { occurrence; revealSignal; dismissed = false; });
  $effect(() => {
    const root = canvas, selected = occurrence, preference = preferred, ancestors = fallbackOccurrences;
    let frame = 0, disposed = false;
    let observed: Element | undefined;
    const observer = new ResizeObserver(() => schedule());
    function measure() {
      frame = 0;
      if (disposed || !palette) return;
      const owner = root.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
      const owned = [...globalThis.document.querySelectorAll<HTMLElement>('[data-ui-occ]')].filter(el => el.dataset.uiOwner === owner);
      let target: HTMLElement | undefined;
      // Closed slot contents can have source selection without a rendered occurrence.
      // Anchor their tools to the nearest visible owner without changing source selection.
      for (const key of [selected, ...ancestors]) {
        const matches = owned.filter(el => el.dataset.uiOcc === key);
        target = matches.find(el => el.hasAttribute('data-ui-primary') && el.getBoundingClientRect().width > 0) ?? matches.find(el => el.getBoundingClientRect().width > 0);
        if (target) break;
      }
      while (target && target !== root && !target.getBoundingClientRect().width) target = target.parentElement ?? undefined;
      if (!owner || !target) { placement = undefined; return; }
      if (observed !== target) { if (observed) observer.unobserve(observed); observer.observe(target); observed = target; }
      const box = target.getBoundingClientRect();
      let left = 8, right = innerWidth - 8, top = 8, bottom = innerHeight - 8;
      // Keep tools inside the visible editing surface, including independently scrolling panes.
      let scroller: HTMLElement | undefined;
      for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left + 8); right = Math.min(right, bounds.right - 8); }
        if (!scroller && /(auto|scroll)/.test(style.overflowY)) scroller = ancestor;
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top + 8); bottom = Math.min(bottom, bounds.bottom - 8); }
      }
      const actualHeight = palette.getBoundingClientRect().height || 42;
      const body = palette.querySelector<HTMLElement>('[data-ui-tool-body]');
      const cap = body ? Number.parseFloat(getComputedStyle(body).maxHeight) : NaN;
      // Place the capped envelope once, while the visible surface fits its
      // content. Switching to a taller page then cannot flip the header.
      const height = body && Number.isFinite(cap) ? Math.max(actualHeight, cap + actualHeight - body.getBoundingClientRect().height) : actualHeight;
      const candidate = floatingPlacement(box, { left, right, top, bottom }, height, preference, untrack(()=>placement));
      const overlaps = candidate && box.left < candidate.left+candidate.width && box.right > candidate.left && box.top < candidate.top+height && box.bottom > candidate.top;
      const dock = innerWidth <= 600 || overlaps;
      const next = dock ? { left:Math.max(left,Math.min(box.left,right-Math.min(480,right-left))), top:Math.max(top,bottom-height), width:Math.min(480,right-left) } : candidate;
      // When no free above/below region exists, use a stable bottom lane and
      // reveal the selected object in the remaining canvas. Large containers
      // retain their top edge; they cannot fit in a smaller visible viewport.
      if (dock && next && scroller) {
        const available = next.top-top-12;
        const delta = box.height <= available ? (box.bottom > next.top-12 ? box.bottom-next.top+12 : box.top < top ? box.top-top : 0) : box.top > top+4 || box.top < top ? box.top-top : 0;
        if (Math.abs(delta)>1) scroller.scrollTop += delta;
      }
      if (JSON.stringify(next) !== JSON.stringify(untrack(() => placement))) placement = next;
    }
    function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(measure); }
    const mutations = new MutationObserver(schedule);
    mutations.observe(globalThis.document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'], subtree: true });
    observer.observe(root); if (palette) observer.observe(palette);
    globalThis.addEventListener('scroll', schedule, true);
    globalThis.addEventListener('resize', schedule);
    void tick().then(schedule);
    return () => { disposed = true; cancelAnimationFrame(frame); mutations.disconnect(); observer.disconnect(); globalThis.removeEventListener('scroll', schedule, true); globalThis.removeEventListener('resize', schedule); };
  });
  function keyboard(event: KeyboardEvent) {
    const editable = event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable);
    if (event.key === 'F10' && !editable) { event.preventDefault(); dismissed = false; void tick().then(() => (palette?.querySelector<HTMLElement>('[role=tab][aria-selected=true]') ?? palette?.querySelector<HTMLElement>('button:not(:disabled):not([data-ui-dismiss]),input,select'))?.focus()); }
    if (!pinned && event.key === 'Escape' && palette?.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); dismissed = true; canvas.focus({ preventScroll: true }); }
  }
  function pointer(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : undefined;
    if (target && palette?.contains(target)) return;
    const owner = canvas.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
    if (pinned) return;
    dismissed = !owner || target?.closest<HTMLElement>('[data-ui-owner]')?.dataset.uiOwner !== owner;
  }
</script>
<svelte:window onkeydown={keyboard} onpointerdowncapture={pointer} />
<div class="floating-selection" use:portal bind:this={palette} aria-label="Floating selection tools" style:left={`${placement?.left ?? 0}px`} style:top={`${placement?.top ?? 0}px`} style:width={`${placement?.width ?? 480}px`} style:visibility={placement && !dismissed ? 'visible' : 'hidden'}>
  <button data-ui-dismiss type="button" class="dismiss" aria-label="Hide tools" title="Hide tools · Escape. F10 restores them." disabled={pinned} onclick={()=>{dismissed=true;canvas.focus({preventScroll:true});}}>×</button>
  {@render children()}
</div>
<style>
  .dismiss {position:absolute;right:5px;top:5px;width:22px;height:22px;border:0;border-radius:4px;background:transparent;color:#78869c;font:16px/1 system-ui;cursor:pointer;z-index:1;}.dismiss:hover {background:#edf1ff;}.dismiss:disabled {opacity:.35;cursor:default;}.dismiss:focus-visible {outline:2px solid #5269bd;}
  .floating-selection { box-sizing:border-box; position:fixed; z-index:var(--ui-editor-floating-layer,1000); max-width:calc(100vw - 16px); border:1px solid #d6ddea; border-radius:8px; background:white; box-shadow:0 5px 22px #25334f26,0 1px 3px #25334f14; }
</style>
