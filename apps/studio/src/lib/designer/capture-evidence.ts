/** Bounded capture diagnostics. No source content, DOM text or provider payloads. */
export interface CaptureEvidence {
  phase: 'source' | 'visibility' | 'raster' | 'metadata' | 'upload' | 'pre-inference' | 'inference' | 'revalidation';
  reason: string;
  expectedRevision?: string;
  actualRevision?: string;
  mode?: 'design' | 'interact';
  covered?: boolean;
  connected?: boolean;
  layout?: boolean;
  frame?: number[];
  frameBefore?: number[];
  viewport?: number[];
  viewportBefore?: number[];
  scroll?: number[];
  changed?: string[];
}
const phases = new Set(['source','visibility','raster','metadata','upload','pre-inference','inference','revalidation']);
/** Refusal uploads are untrusted. Project an allowlist and bound every field. */
export function captureEvidence(value: unknown): CaptureEvidence | undefined {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.phase !== 'string' || !phases.has(record.phase) || typeof record.reason !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(record.reason)) return;
  const result: CaptureEvidence = {phase:record.phase as CaptureEvidence['phase'],reason:record.reason};
  for(const key of ['expectedRevision','actualRevision'] as const) if(typeof record[key] === 'string')result[key]=record[key].slice(0,160);
  if(record.mode === 'design' || record.mode === 'interact')result.mode=record.mode;
  for(const key of ['covered','connected','layout'] as const)if(typeof record[key] === 'boolean')result[key]=record[key];
  for(const key of ['frame','frameBefore','viewport','viewportBefore','scroll'] as const){const items=record[key];if(Array.isArray(items)&&items.length<=4&&items.every(item=>typeof item==='number'&&Number.isFinite(item)&&Math.abs(item)<=1e7))result[key]=items;}
  if(Array.isArray(record.changed))result.changed=record.changed.filter((item):item is string=>typeof item==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(item)).slice(0,10);
  return result;
}
