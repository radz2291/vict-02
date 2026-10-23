import { captureRenderedElement } from '@victframework/ui-ai-svelte';
import type { AgentCursor } from './agent-edits.js';

export interface CaptureMetadata {
  cursor: AgentCursor;
  capturedAt: string;
  viewport: { width: number; height: number; scrollLeft: number; scrollTop: number; devicePixelRatio: number };
  image: { width: number; height: number; sourceWidth: number; sourceHeight: number; offsetLeft: number; offsetTop: number; cropped: boolean };
  preview: { mode: 'design' | 'interact'; fingerprint: string; selection?: string; composition?: string };
}
export type CaptureResult = { ok: true; blob: Blob; metadata: CaptureMetadata } | { ok: false; code: string; message: string };
export interface CaptureState {
  cursor: AgentCursor;
  mode: 'design' | 'interact';
  state: unknown;
  selection?: string;
  composition?: string;
  structureOpen?: boolean;
}
const equalCursor = (a: AgentCursor, b: AgentCursor) => JSON.stringify(a) === JSON.stringify(b);

/** Capture and fence both source and transient preview state around asynchronous rasterization. */
export async function captureDesignerPreview(
  element: HTMLElement | undefined,
  expected: AgentCursor,
  getState: () => CaptureState | undefined,
  viewportElement?: HTMLElement,
): Promise<CaptureResult> {
  const before = getState();
  if (!before || !equalCursor(before.cursor, expected))
    return { ok: false, code: 'STUDIO_CAPTURE_STALE', message: 'The source changed. Read the current screen before requesting another image.' };
  if (!element || before.structureOpen)
    return { ok: false, code: 'STUDIO_CAPTURE_NOT_VISIBLE', message: 'Open Design or Interact to observe the rendered screen. Structure is a source view.' };
  const viewportTarget = viewportElement ?? element;
  const geometry = () => [element, viewportTarget].map(target => { const bounds = target.getBoundingClientRect(); return [bounds.x,bounds.y,bounds.width,bounds.height].join(','); }).join('|');
  const geometryToken = geometry();
  const rect = viewportTarget.getBoundingClientRect();
  const viewport = { width: Math.ceil(rect.width), height: Math.ceil(rect.height), scrollLeft: viewportTarget.scrollLeft, scrollTop: viewportTarget.scrollTop, devicePixelRatio: window.devicePixelRatio };
  const stateToken = JSON.stringify(before);
  try {
    const capture = await captureRenderedElement(element, viewportElement);
    const after = getState();
    if (!after || JSON.stringify(after) !== stateToken || geometry() !== geometryToken || viewportTarget.scrollLeft !== viewport.scrollLeft || viewportTarget.scrollTop !== viewport.scrollTop)
      return { ok: false, code: 'STUDIO_CAPTURE_STALE', message: 'The source or preview changed during capture. Request a fresh image.' };
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stateToken));
    if (JSON.stringify(getState()) !== stateToken || geometry() !== geometryToken || viewportTarget.scrollLeft !== viewport.scrollLeft || viewportTarget.scrollTop !== viewport.scrollTop) return { ok: false, code: 'STUDIO_CAPTURE_STALE', message: 'The preview changed while associating image metadata. Request a fresh image.' };
    const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const { blob, ...image } = capture;
    return { ok: true, blob, metadata: { cursor: before.cursor, capturedAt: new Date().toISOString(), viewport, image,
      preview: { mode: before.mode, fingerprint, ...(before.selection ? { selection: before.selection } : {}), ...(before.composition ? { composition: before.composition } : {}) } } };
  } catch (error) {
    return { ok: false, code: error instanceof Error && /^STUDIO_CAPTURE_[A-Z_]+$/.test(error.message) ? error.message : 'STUDIO_CAPTURE_FAILED', message: 'The browser could not capture this rendered preview. No visual observation was made.' };
  }
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
        body: JSON.stringify({ ok: false, code }),
      });
      if (refused.ok) return;
    }
    throw new Error(code);
  }
}
