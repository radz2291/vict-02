<script lang="ts">
  import { onMount } from 'svelte';
  import { layoutGraph } from '@victframework/ui-flow-svelte';
  import type { UiDocument } from '@victframework/ui';
  import StructureView from '../../../../../apps/studio/src/lib/designer/StructureView.svelte';
  import '@victframework/ui-flow-svelte/styles.css';
  import source from '../structure/browser-fixture.json';
  const sourceDocument = { ...source, id: 'structure-responsive-synthetic' } as UiDocument;
  let selectedNodeId = $state('screen');
  let notice = $state('Component geometry fixture. Authoring callbacks are intentionally not connected.');
  onMount(() => {
    let frame = 0;
    let secondFrame = 0;
    let pending = false;
    let diagnosticSignature = '';
    const bounds = (element: Element) => {
      const rectangle = element.getBoundingClientRect();
      return { x: +rectangle.x.toFixed(2), y: +rectangle.y.toFixed(2), width: +rectangle.width.toFixed(2), height: +rectangle.height.toFixed(2), right: +rectangle.right.toFixed(2), bottom: +rectangle.bottom.toFixed(2) };
    };
    const measure = () => {
      pending = false;
      const dom = globalThis.document;
      const cards = [...dom.querySelectorAll<HTMLElement>('.svelte-flow__node')].map(element => ({ label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80), ...bounds(element) })).filter(rectangle => rectangle.width > 0 && rectangle.height > 0);
      let overlapCount = 0;
      for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
        const first = cards[a]!; const second = cards[b]!;
        if (first.x < second.right - .5 && second.x < first.right - .5 && first.y < second.bottom - .5 && second.y < first.bottom - .5) overlapCount++;
      }
      const controls = [...dom.querySelectorAll<HTMLElement>('.structure-view button,.structure-view input,.structure-view select,.structure-view summary')].map(element => ({ label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 70), tag: element.tagName.toLowerCase(), ...bounds(element) })).filter(rectangle => rectangle.width > 0 && rectangle.height > 0);
      const canvas = dom.querySelector('.structure-canvas');
      const component = dom.querySelector('.structure-view');
      const layoutStatus = dom.querySelector('.structure-layers [role=status]')?.textContent ?? '';
      const metrics = {
        label: 'Actual browser DOM measurements — synthetic component width simulation',
        measuredAt: new Date().toISOString(),
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
        documentClientWidth: dom.documentElement.clientWidth,
        documentScrollWidth: dom.documentElement.scrollWidth,
        bodyScrollWidth: dom.body.scrollWidth,
        horizontalDocumentOverflow: dom.documentElement.scrollWidth > dom.documentElement.clientWidth + 1,
        component: component ? bounds(component) : null,
        canvas: canvas ? bounds(canvas) : null,
        layoutStatus,
        viewportTransform: dom.querySelector<HTMLElement>('.svelte-flow__viewport')?.style.transform,
        renderedCards: cards.length, overlapCount, cards,
        controls,
        buttonsOutsideViewport: controls.filter(control => control.tag === 'button' && (control.x < -1 || control.right > window.innerWidth + 1)),
        controlsOutsideViewport: controls.filter(control => control.x < -1 || control.right > window.innerWidth + 1),
        limits: 'DOM geometry only. This does not prove narrow keyboard input, a mobile device, real Studio handoffs or authored edits.',
      };
      window.parent.postMessage({ type: 'vict-structure-responsive-dom', metrics }, window.location.origin);
      if (layoutStatus.startsWith('Layout unavailable') && diagnosticSignature !== `${window.innerWidth}:${cards.length}`) {
        diagnosticSignature = `${window.innerWidth}:${cards.length}`;
        const viewport = dom.querySelector('.svelte-flow__viewport');
        const zoom = viewport ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a || 1 : 1;
        const measuredNodes = [...dom.querySelectorAll<HTMLElement>('.svelte-flow__node')].map(element => {
          const rect = element.getBoundingClientRect();
          return { id: element.dataset.id ?? '', position: { x: 0, y: 0 }, data: {}, measured: { width: rect.width / zoom, height: rect.height / zoom } };
        });
        const measuredEdges = [...dom.querySelectorAll<SVGElement>('.svelte-flow__edge')].flatMap(element => {
          try { const [source, target] = JSON.parse(decodeURIComponent(element.dataset.id ?? '')); return [{ id: element.dataset.id ?? '', source, target }]; }
          catch { return []; }
        });
        void layoutGraph(measuredNodes, measuredEdges, { engine: 'elk', direction: 'RIGHT' }).then(result => window.dispatchEvent(new CustomEvent('vict-harness-diagnostic', { detail: { label: 'Separate test-only layout invocation on actual DOM-measured geometry passed; does not replace component result', engine: result.engine, nodes: result.nodes.length, edges: result.edges.length } }))).catch(error => window.dispatchEvent(new CustomEvent('vict-harness-diagnostic', { detail: { label: 'Explicit test-only layout error from actual DOM-measured geometry', error: { name: error?.name, message: error?.message, stack: error?.stack } } })));
      }
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(measure); });
    };
    const resize = new ResizeObserver(schedule);
    const dom = globalThis.document;
    if (dom.documentElement instanceof Node) resize.observe(dom.documentElement);
    const mutation = new MutationObserver(schedule);
    const component = globalThis.document.querySelector('.component-host');
    if (component instanceof Node && component instanceof Element) { resize.observe(component); mutation.observe(component, { attributes: true, childList: true, subtree: true, characterData: true }); }
    window.addEventListener('resize', schedule);
    schedule();
    return () => { resize.disconnect(); mutation.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
  });
</script>

<main>
  <div class="test-context"><strong>Component width simulation</strong><span role="status">{notice}</span></div>
  <div class="component-host"><StructureView document={sourceDocument} revision="responsive-fixture-r1" {selectedNodeId}
    onSelect={occurrence => { selectedNodeId = occurrence.split('|')[1] ?? 'screen'; notice = `Inspected source ${selectedNodeId} within the synthetic component fixture.`; }}
    onMove={() => { notice = 'Read-only harness: containment edits are verified separately in real Studio.'; return false; }}
    onNotice={message => notice = message}
    onNavigate={request => notice = `Harness callback only: ${request.destination} requested. Real editor handoffs are verified separately in Studio.`} /></div>
</main>

<style>
  :global(html), :global(body) { margin: 0; width: 100%; min-width: 0; font: 12px/1.4 system-ui, sans-serif; }
  :global(#app) { min-height: 100vh; }
  main { display: flex; flex-direction: column; height: 100vh; min-height: 0; min-width: 0; }
  .test-context { display: flex; flex-direction: column; gap: 4px; padding: 10px; color: #334155; background: #eef2ff; border-bottom: 1px solid #cbd5e1; }
  .component-host { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; }
</style>
