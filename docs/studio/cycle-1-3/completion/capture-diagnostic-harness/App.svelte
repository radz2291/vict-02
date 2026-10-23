<script lang="ts">
  import { DocumentHost, ControlScope } from '@victframework/ui-svelte';
  import { captureRenderedElement } from '@victframework/ui-ai-svelte';
  import { toSvg } from 'html-to-image';
  import { compileScreen, catalogDescriptors, catalogImplementations } from '../../../../../apps/studio/src/lib/designer/application.js';
  import source from '../../completion-evidence/authoring-final-1792791183630-document.json';
  import type { UiDocument } from '@victframework/ui';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '@victframework/ui-ai-svelte/styles.css';
  import '@victframework/ui-flow-svelte/styles.css';
  import '../../../../../apps/studio/src/lib/designer/workspace.css';
  import '../../../../../apps/studio/src/lib/designer/designer.css';
  const compiled = compileScreen(source as UiDocument);
  const plan = compiled.ok ? Object.values(compiled.plan.documentPlans ?? {})[0] : undefined;
  let frame = $state<HTMLDivElement>(); let viewport = $state<HTMLDivElement>();
  let events = $state<Record<string, unknown>[]>([]); let busy = $state(false); let preview = $state('');
  const note = (stage: string, detail: Record<string, unknown> = {}) => { events = [...events, { stage, ...detail }]; };
  function errorDetail(error: unknown) {
    return error instanceof Error ? { kind: error.constructor.name, name: error.name, message: error.message }
      : error instanceof Event ? { kind: error.constructor.name, type: error.type, target: error.target instanceof HTMLImageElement ? { tag: error.target.tagName, complete: error.target.complete, naturalWidth: error.target.naturalWidth, naturalHeight: error.target.naturalHeight, sourceLength: error.target.src.length } : null }
      : { kind: typeof error, description: String(error) };
  }
  async function loadImage(url: string, stage: string) {
    const image = new Image();
    try { await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url; }); note(stage, { ok: true, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }); return image; }
    catch (error) { note(stage, { ok: false, ...errorDetail(error) }); throw error; }
  }
  async function capture(actual: boolean, omitNonRenderedImages = false) {
    if (!frame || !viewport || busy) return;
    busy = true; events = []; if (preview) URL.revokeObjectURL(preview); preview = '';
    try {
      const rect = frame.getBoundingClientRect(); const clip = viewport.getBoundingClientRect();
      note('source', { sourceId: source.id, nodes: Object.keys(source.nodes).length, sourceWidth: rect.width, sourceHeight: rect.height, viewportWidth: clip.width, viewportHeight: clip.height, elements: frame.querySelectorAll('*').length, svgElements: frame.querySelectorAll('svg').length, svgNamespaceSamples: Array.from(frame.querySelectorAll('svg')).slice(0,4).map(svg => ({ namespace: svg.namespaceURI, xmlns: svg.getAttribute('xmlns'), xmlnsAttributeNamespace: svg.getAttributeNode('xmlns')?.namespaceURI ?? null })) });
      if (actual) {
        const result = await captureRenderedElement(frame, viewport); preview = URL.createObjectURL(result.blob);
        note('actual-captureRenderedElement', { ok: true, ...result, blob: { bytes: result.blob.size, type: result.blob.type } }); return;
      }
      await document.fonts.ready; note('fonts-ready');
      const style = getComputedStyle(frame);
      if (omitNonRenderedImages) note('diagnostic-image-filter', { omittedDisplayNoneImages: Array.from(frame.querySelectorAll('img')).filter(image => getComputedStyle(image).display === 'none').length, restriction: 'Only HTML img with computed display:none. Visible images and SVG definitions are retained.' });
      const svgUrl = await toSvg(frame, { width: Math.ceil(rect.width), height: Math.ceil(rect.height), pixelRatio: 1, style: { width: style.width, height: style.height, margin: '0' }, cacheBust: false,
        ...(omitNonRenderedImages ? { filter: (node: HTMLElement) => !(node instanceof HTMLImageElement && getComputedStyle(node).display === 'none') } : {}),
      });
      note('toSvg', { ok: true, urlCharacters: svgUrl.length });
      const raw = decodeURIComponent(svgUrl.slice(svgUrl.indexOf(',') + 1));
      const xml = new DOMParser().parseFromString(raw, 'image/svg+xml');
      const parserError = xml.querySelector('parsererror');
      note('original-xml-parse', { ok: !parserError, root: xml.documentElement.tagName, error: parserError?.textContent?.slice(0, 1200) ?? null, svgElements: xml.querySelectorAll('svg').length });
      if (parserError) return;
      await loadImage(svgUrl, 'original-svg-image-load');
      const width = Math.min(Math.ceil(Math.min(rect.right, clip.right) - Math.max(rect.left, clip.left)), 1600);
      const height = Math.min(Math.ceil(Math.min(rect.bottom, clip.bottom) - Math.max(rect.top, clip.top)), 1200);
      const left = Math.max(0, Math.ceil(clip.left - rect.left)); const top = Math.max(0, Math.ceil(clip.top - rect.top));
      const svg = xml.documentElement; svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height)); svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
      const serialized = new XMLSerializer().serializeToString(svg);
      const reparse = new DOMParser().parseFromString(serialized, 'image/svg+xml');
      note('cropped-xml-parse', { ok: !reparse.querySelector('parsererror'), error: reparse.querySelector('parsererror')?.textContent?.slice(0, 1200) ?? null, characters: serialized.length, width, height, left, top });
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`, 'cropped-svg-image-load');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d')!; context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0); note('drawImage', { ok: true });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      note('toBlob', { ok: !!blob, bytes: blob?.size ?? 0 }); if (blob) preview = URL.createObjectURL(blob);
    } catch (error) { note('capture-failed', errorDetail(error)); }
    finally { busy = false; }
  }
</script>
<div class="diagnostics">
  <h1>Large actual-rendered capture diagnostic</h1>
  <p>Isolated synthetic 151-node saved document. Actual DocumentHost/catalog implementations and Studio CSS. No provider calls or owner screens.</p>
  <button disabled={busy} onclick={()=>capture(true)}>Run actual capture helper</button>
  <button disabled={busy} onclick={()=>capture(false)}>Instrument SVG capture stages</button>
  <button disabled={busy} onclick={()=>capture(false,true)}>Instrument excluding display-none HTML images</button>
  <pre aria-label="Capture diagnostics">{JSON.stringify(events,null,2)}</pre>
  {#if preview}<img src={preview} alt="Actual captured diagnostic preview" />{/if}
  {#if !plan}<p>Compile refused: {JSON.stringify(compiled)}</p>{/if}
</div>
<ControlScope><div class="studio-workspace diagnostic-workspace"><div class="workspace-scroll" bind:this={viewport}><div class="design-frame workspace-screen" bind:this={frame}>{#if plan}<DocumentHost {plan} localState={(source as UiDocument).localState} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} dispatch={async()=>({ok:true})} navigate={()=>{}} ariaLabel="Diagnostic actual rendered canvas" />{/if}</div></div></div></ControlScope>
<style>
  :global(body){margin:0;background:#f4f6f9}.diagnostics{padding:18px;font:13px/1.4 system-ui,sans-serif}.diagnostics h1{font-size:20px}.diagnostics button{margin-right:12px;padding:8px}.diagnostics pre{max-height:360px;overflow:auto;white-space:pre-wrap}.diagnostics img{max-width:500px}.diagnostic-workspace{width:960px;height:585px;margin:0 18px 24px}.diagnostic-workspace .workspace-scroll{flex:none;height:585px;width:960px;box-sizing:border-box}.design-frame{width:909px;min-height:560px}
</style>
