import {expect,it} from 'vitest';
import {capturePresentationSchema,captureCapabilityDescription} from '../src/presentation.js';
it.each([
 ['bytes',{type:'object',description:'x'.repeat(40000)}],
 ['fields',Object.fromEntries(Array.from({length:100},(_,i)=>[`field${i}`,i]))],
 ['array',{enum:Array.from({length:100},(_,i)=>`item${i}`)}],
 ['depth',Array.from({length:100}).reduce<Record<string,unknown>>(value=>({items:value}),{type:'string'})],
] as const)('captures %s without local quotas',(_name,input)=>{expect(capturePresentationSchema(input,'baseline')).toEqual(input);});
it('captures long descriptions without a content quota',()=>{const description='x'.repeat(2000);expect(captureCapabilityDescription(description)).toBe(description);});
it('preserves deterministic bytes for preexisting finite declarations',()=>{expect(JSON.stringify(capturePresentationSchema({z:[{b:false,a:1}],a:'exact'},'finite'))).toBe('{"a":"exact","z":[{"a":1,"b":false}]}');});
