import { types } from 'node:util';

/**
 * Passive model-facing declaration capture. See the accepted owner amendment
 * docs/report/VICT-PRESENTATION-QUOTA-REMOVAL-AMENDMENT-20261031.md.
 * No local content/size/depth/count quota is imposed. Descriptor-only inspection
 * rejects executable/hidden/hostile data without invoking it. The returned
 * deterministic deep-frozen owned snapshot never becomes argument authority:
 * Contract.parse and the existing profile/typed-IR fences remain authoritative.
 */

/** Stable, non-echoing presentation-capture failure codes. */
export type PresentationCaptureErrorCode =
  | 'VICT_PRESENTATION_INPUT_SCHEMA_REQUIRED'
  | 'VICT_PRESENTATION_INVALID'
  | 'VICT_PRESENTATION_DESCRIPTION_INVALID';

/** Structured presentation-capture failure (thrown at tool construction). */
export class VictPresentationError extends Error {
  readonly code: PresentationCaptureErrorCode;
  /** Bounded, non-echoing detail: stable labels only, never received values. */
  readonly detail: string;

  constructor(code: PresentationCaptureErrorCode, detail: string) {
    super(`capability presentation rejected (${code}): ${detail}`);
    this.name = 'VictPresentationError';
    this.code = code;
    this.detail = detail;
  }
}

/** @deprecated Historical quota metadata retained for source compatibility.
 * Construction does not enforce these quotas. No default replacement ceiling
 * exists; actual provider/platform limits remain upstream constraints. */
export const PRESENTATION_BOUNDS: Readonly<{
  readonly maxDepth: 8;
  readonly maxFieldsPerObject: 64;
  readonly maxArrayLength: 64;
  readonly maxTotalBytes: 32768;
  readonly maxDescriptionChars: 1024;
  readonly keyPattern: RegExp;
}> = Object.freeze({
  maxDepth: 8,
  maxFieldsPerObject: 64,
  maxArrayLength: 64,
  maxTotalBytes: 32768,
  maxDescriptionChars: 1024,
  // Bounded safe-key vocabulary for JSON-Schema property names; anything
  // outside fails closed (hostile or unrepresentable keys).
  keyPattern: /^[A-Za-z0-9_$.-]{1,64}$/,
});

/** Keys that can never appear in captured presentation data. */
const PROTOTYPE_NAMED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

// The safe character grammar remains; field-name length is not a content quota.
const SAFE_PRESENTATION_KEY = /^[A-Za-z0-9_$.-]+$/;

function captureValue(value: unknown, label: string): unknown {
  let captured:unknown;
  const active=new Set<object>();
  type Work={value:unknown;assign:(value:unknown)=>void;exit?:object};
  const stack:Work[]=[{value,assign:next=>{captured=next;}}];
  const reject=(detail:string):never=>{throw new VictPresentationError('VICT_PRESENTATION_INVALID',`${label}: ${detail}`);};
  while(stack.length){
    const work=stack.pop()!;
    if(work.exit){active.delete(work.value as object);Object.freeze(work.exit);continue;}
    const current=work.value;
    if(current===null||typeof current==='string'||typeof current==='boolean'){work.assign(current);continue;}
    if(typeof current==='number'){if(!Number.isFinite(current))reject('non-finite number');work.assign(current);continue;}
    if(typeof current!=='object')reject(`${typeof current} values cannot be captured (plain data only)`);
    // Native proxy detection precedes every prototype/descriptor/array read,
    // including revoked proxies. It invokes no attacker-controlled trap.
    if(types.isProxy(current))reject('proxies cannot be captured (plain data only)');
    const object=current as object;
    if(active.has(object))reject('cycles cannot be captured (plain data only)');
    const array=Array.isArray(object),proto=Object.getPrototypeOf(object);
    if(proto!==null&&proto!==(array?Array.prototype:Object.prototype))reject('exotic prototype - presentation captures plain data only');
    if(Object.getOwnPropertySymbols(object).length)reject('symbol-keyed fields cannot be captured (plain data only)');
    const descriptors=Object.getOwnPropertyDescriptors(object);
    const keys=Object.keys(descriptors).sort();
    const out:Record<string,unknown>|unknown[]=array?[]:{};
    const members: {key:string;value:unknown}[]=[];
    for(const key of keys){
      const descriptor=descriptors[key]!;
      if(array&&key==='length')continue; // Intrinsic own array data property.
      if(!SAFE_PRESENTATION_KEY.test(key)||PROTOTYPE_NAMED_KEYS.has(key))reject('a field name is outside the safe presentation vocabulary');
      if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=(object as unknown[]).length))reject('unknown array field cannot be captured (plain indexed data only)');
      if(!descriptor.enumerable)reject('a non-enumerable field cannot be captured (plain own enumerable data only)');
      if(descriptor.get!==undefined||descriptor.set!==undefined)reject('an accessor field (getter/setter) cannot be captured');
      members.push({key,value:descriptor.value});
    }
    if(array){
      if(members.length!==(object as unknown[]).length)reject('sparse array elements cannot be captured (plain indexed data only)');
      // Object keys sort lexically; arrays retain numeric JSON element order.
      members.sort((left,right)=>Number(left.key)-Number(right.key));
    }
    active.add(object);work.assign(out);stack.push({value:object,assign:()=>{},exit:out});
    for(const member of members.reverse())stack.push({value:member.value,assign:next=>{(out as Record<string,unknown>)[member.key]=next;}});
  }
  return captured;
}

/** Capture an exact deeply immutable descriptive schema, never execution authority. */
export function capturePresentationSchema(value: unknown, label: string): unknown {
  if(value===undefined)throw new VictPresentationError('VICT_PRESENTATION_INVALID',`${label}: no schema is declared`);
  const captured=captureValue(value,label);
  if(typeof captured!=='object'||captured===null||Array.isArray(captured))throw new VictPresentationError('VICT_PRESENTATION_INVALID',`${label}: the schema root must be a plain object`);
  return captured;
}

/**
 * Capture the exact capability description without a content quota. `undefined` (not declared)
 * is valid and returns `undefined`; any non-string or empty value
 * fails closed. The description is never rewritten, trimmed, or echoed
 * into errors.
 */
export function captureCapabilityDescription(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new VictPresentationError(
      'VICT_PRESENTATION_DESCRIPTION_INVALID',
      'the capability description must be a string',
    );
  }
  if (value.length === 0) {
    throw new VictPresentationError(
      'VICT_PRESENTATION_DESCRIPTION_INVALID',
      'the capability description must be nonempty',
    );
  }
  return value;
}
