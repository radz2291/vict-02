import { captureRenderedElement } from '@victframework/ui-ai-svelte';
import type { AgentCursor } from './agent-edits.js';
import { captureEvidence, type CaptureEvidence } from './capture-evidence.js';

export interface CaptureMetadata {
  cursor: AgentCursor;
  capturedAt: string;
  viewport: { width: number; height: number; scrollLeft: number; scrollTop: number; devicePixelRatio: number };
  image: { width: number; height: number; sourceWidth: number; sourceHeight: number; offsetLeft: number; offsetTop: number; cropped: boolean };
  preview: { mode: 'design' | 'interact'; fingerprint: string; selection?: string; composition?: string };
}
export type CaptureResult = { ok: true; blob: Blob; metadata: CaptureMetadata } | { ok: false; code: string; message: string; diagnostics?: CaptureEvidence };
export interface CaptureState {
  cursor: AgentCursor;
  mode: 'design' | 'interact';
  state: unknown;
  selection?: string;
  composition?: string;
  structureOpen?: boolean;
}
const equalCursor = (a: AgentCursor, b: AgentCursor) => JSON.stringify(a) === JSON.stringify(b);

/** DocumentHost ownership is per rendered instance. Studio/Inspector overlays
 * have another owner (or none), even when they use the same control library. */
function previewCaptureGuard(frame: HTMLElement) {
  const ownerIds = () => new Set([...(frame.matches('[data-ui-owner-root]') ? [frame] : []), ...frame.querySelectorAll<HTMLElement>('[data-ui-owner-root]')].map(root => root.dataset.uiOwnerRoot).filter((value): value is string => !!value));
  const owners = ownerIds();
  const belongs = (node: Element) => owners.has(node.getAttribute('data-ui-owner') ?? '');
  const owned = () => Array.from(frame.ownerDocument.querySelectorAll<HTMLElement>('[data-ui-owner]')).filter(belongs);
  const visible = (node: HTMLElement) => {
    if (!node.isConnected || !node.getClientRects().length) return false;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false;
    for (let current: HTMLElement | null = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    }
    return true;
  };
  const portals = () => owned().filter(node => !frame.contains(node) && visible(node));
  const signature = () => JSON.stringify({
    owners: [...ownerIds()],
    // Includes internally controlled/unbound preview state that is not present
    // in canonical localState, plus native current values used in the image.
    controls: Array.from(frame.querySelectorAll('*')).map(node => ({
      tag: node.tagName, attributes: Array.from(node.attributes, attribute => [attribute.name, attribute.value]),
      focused: node === frame.ownerDocument.activeElement || node.contains(frame.ownerDocument.activeElement), hovered: node.matches(':hover'),
      text: node.childElementCount === 0 ? node.textContent : undefined, scrollLeft: node.scrollLeft, scrollTop: node.scrollTop,
      value: node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement ? node.value : undefined,
      inputChecked: node instanceof HTMLInputElement ? node.checked : undefined,
    })),
  });
  let changed = false;
  function touchesPreview(node: Node, descendants = false): boolean {
    const element = node instanceof Element ? node : node.parentElement;
    if (!element) return false;
    if (frame.contains(element) || belongs(element)) return true;
    if (element.closest('[data-ui-owner]') && belongs(element.closest('[data-ui-owner]')!)) return true;
    return descendants && Array.from(element.querySelectorAll('[data-ui-owner]')).some(belongs);
  }
  function recordChanges(records: MutationRecord[]) {
    for (const record of records) if (touchesPreview(record.target, record.type === 'attributes') || [...record.addedNodes, ...record.removedNodes].some(node => touchesPreview(node, true))) changed = true;
  }
  const observer = new MutationObserver(recordChanges);
  observer.observe(frame.ownerDocument.body, { subtree: true, childList: true, attributes: true, characterData: true });
  return { portals, signature, changed: () => { recordChanges(observer.takeRecords()); return changed; }, stop: () => observer.disconnect() };
}
const portalRefusal = (): Extract<CaptureResult,{ok:false}> => ({ ok: false, code: 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED', message: 'An open preview dialog, menu or popup is outside the capture frame. Its appearance was not observed. Close it before capturing this frame; open portalled overlays are not supported by this image path.' });

/** Capture and fence both source and transient preview state around asynchronous rasterization. */
export async function captureDesignerPreview(
  element: HTMLElement | undefined,
  expected: AgentCursor,
  getState: () => CaptureState | undefined,
  viewportElement?: HTMLElement,
): Promise<CaptureResult> {
  const before = getState();
  const bounds = (target: HTMLElement | undefined) => { if(!target)return undefined;const r=target.getBoundingClientRect();return [r.x,r.y,r.width,r.height]; };
  const frameBefore=bounds(element);const viewportBefore=bounds(viewportElement??element);
  const refuse = (code:string,message:string,phase:CaptureEvidence['phase'],reason:string,changed?:string[]):CaptureResult => ({ok:false,code,message,diagnostics:captureEvidence({phase,reason,expectedRevision:expected.revision,actualRevision:getState()?.cursor.revision,mode:getState()?.mode,covered:getState()?.structureOpen,connected:element?.isConnected,layout:element?!!element.getClientRects().length:undefined,frame:bounds(element),frameBefore,viewport:bounds(viewportElement??element),viewportBefore,scroll:viewportElement?[viewportElement.scrollLeft,viewportElement.scrollTop]:undefined,changed})});
  if (!before || !equalCursor(before.cursor, expected))
    return refuse('STUDIO_CAPTURE_STALE','The source changed. Read the current screen before requesting another image.','source','cursor-mismatch',['source']);
  if (!element || before.structureOpen)
    return refuse('STUDIO_CAPTURE_NOT_VISIBLE','Reveal the Design or Interact preview, then retry observation without replaying edits.','visibility',!element?'frame-missing':'preview-covered');
  const viewportTarget = viewportElement ?? element;
  const geometry = () => [element, viewportTarget].map(target => { const bounds = target.getBoundingClientRect(); return [bounds.x,bounds.y,bounds.width,bounds.height].join(','); }).join('|');
  const geometryToken = geometry();
  const rect = viewportTarget.getBoundingClientRect();
  const viewport = { width: Math.ceil(rect.width), height: Math.ceil(rect.height), scrollLeft: viewportTarget.scrollLeft, scrollTop: viewportTarget.scrollTop, devicePixelRatio: window.devicePixelRatio };
  const stateToken = JSON.stringify(before);
  const guard = previewCaptureGuard(element);
  const changedFences=(renderedToken:string)=>{const changes:string[]=[];if(JSON.stringify(getState())!==stateToken)changes.push('source-or-preview');if(geometry()!==geometryToken)changes.push('geometry');if(viewportTarget.scrollLeft!==viewport.scrollLeft||viewportTarget.scrollTop!==viewport.scrollTop)changes.push('scroll');if(guard.changed())changes.push('dom-mutation');if(guard.signature()!==renderedToken)changes.push('rendered-controls');return changes;};
  try {
    if (guard.portals().length) return {...portalRefusal(),...{diagnostics:captureEvidence({phase:'visibility',reason:'external-preview-portal',mode:before.mode,expectedRevision:expected.revision})}};
    const renderedStateToken = guard.signature();
    const capture = await captureRenderedElement(element, viewportElement);
    if (guard.portals().length) return {...portalRefusal(),diagnostics:captureEvidence({phase:'raster',reason:'external-preview-portal',mode:before.mode,expectedRevision:expected.revision})};
    const after = getState();
    if (!after || JSON.stringify(after) !== stateToken || geometry() !== geometryToken || viewportTarget.scrollLeft !== viewport.scrollLeft || viewportTarget.scrollTop !== viewport.scrollTop || guard.changed() || guard.signature() !== renderedStateToken)
      return refuse('STUDIO_CAPTURE_STALE','The preview changed during capture. Retry observation after it settles.','raster','preview-changed',changedFences(renderedStateToken));
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${stateToken}\n${renderedStateToken}`));
    if (guard.portals().length) return {...portalRefusal(),diagnostics:captureEvidence({phase:'metadata',reason:'external-preview-portal',mode:before.mode,expectedRevision:expected.revision})};
    if (JSON.stringify(getState()) !== stateToken || geometry() !== geometryToken || viewportTarget.scrollLeft !== viewport.scrollLeft || viewportTarget.scrollTop !== viewport.scrollTop || guard.changed() || guard.signature() !== renderedStateToken) return refuse('STUDIO_CAPTURE_STALE','The preview changed while associating image metadata. Retry observation.','metadata','preview-changed',changedFences(renderedStateToken));
    const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const { blob, ...image } = capture;
    return { ok: true, blob, metadata: { cursor: before.cursor, capturedAt: new Date().toISOString(), viewport, image,
      preview: { mode: before.mode, fingerprint, ...(before.selection ? { selection: before.selection } : {}), ...(before.composition ? { composition: before.composition } : {}) } } };
  } catch (error) {
    const code=error instanceof Error && /^STUDIO_CAPTURE_[A-Z_]+$/.test(error.message)?error.message:'STUDIO_CAPTURE_FAILED';
    const reason=error && typeof error==='object' && 'captureReason' in error ? String(error.captureReason):'raster-failed';
    return refuse(code,'The browser could not capture this rendered preview. No visual observation was made.',code==='STUDIO_CAPTURE_NOT_VISIBLE'?'visibility':'raster',reason);
  } finally { guard.stop(); }
}

export async function uploadVisualCapture(captureId: string, csrf: string, result: CaptureResult, signal: AbortSignal): Promise<void> {
  const response = await fetch(`/api/designer-agent/capture/${encodeURIComponent(captureId)}`, {
    method: 'POST', signal,
    headers: result.ok
      ? { 'content-type': 'image/jpeg', 'x-vict-csrf': csrf, 'x-vict-capture': encodeURIComponent(JSON.stringify(result.metadata)) }
      : { 'content-type': 'application/json', 'x-vict-csrf': csrf },
    body: result.ok ? result.blob : JSON.stringify(result),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => undefined);
    const code = typeof detail?.code === 'string' && /^STUDIO_CAPTURE_[A-Z_]+$/.test(detail.code) ? detail.code : 'STUDIO_CAPTURE_UPLOAD_REFUSED';
    // An admitted browser request can still reject image bytes/metadata. Deliver
    // that deterministic refusal to its pending tool instead of presenting it
    // as a provider connection interruption or waiting for the upload timeout.
    if (result.ok && response.status >= 400 && response.status < 500 && ![401,403,404].includes(response.status)) {
      const refused = await fetch(`/api/designer-agent/capture/${encodeURIComponent(captureId)}`, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'x-vict-csrf': csrf },
        body: JSON.stringify({ ok: false, code,diagnostics:{phase:'upload',reason:'image-admission-refused',expectedRevision:result.metadata.cursor.revision} }),
      });
      if (refused.ok) return;
    }
    throw new Error(code);
  }
}
