import type {UiValueType,UiValue} from '@victframework/ui';
import {validateGraph,validateGraphV2,validateGraphV3} from '@victframework/ui-flow-svelte/model';

const count=(size:number,singular:string,plural=`${singular}s`)=>`${size} ${size===1?singular:plural}`;

/** Card presentation of declared starting data only. Never modifies state or evaluates behavior. */
export function stateSummary(type:UiValueType,initial:UiValue):string {
  const name=({string:'Text',boolean:'Boolean',number:'Number',stringList:'Text list',numberList:'Number list',isoDate:'Date',isoTime:'Time'} as const)[type];
  if(Array.isArray(initial))return `${name} · ${count(initial.length,'initial item')}`;
  if(typeof initial==='boolean')return `${name} · initially ${initial?'on':'off'}`;
  if(typeof initial==='number')return `${name} · starts at ${initial}`;
  if(typeof initial!=='string')return `${name} · declared starting value`;
  if(initial==='')return `${name} · starts empty`;
  const text=initial.trim();
  if(text.startsWith('{')||text.startsWith('[')){
    try {
      const value:unknown=JSON.parse(text);
      if(value&&typeof value==='object'&&!Array.isArray(value)){
        const schema=(value as {schema?:unknown}).schema;
        const checked=schema==='vict.flow-graph@1'?validateGraph(value):schema==='vict.flow-graph@2'?validateGraphV2(value):schema==='vict.flow-graph@3'?validateGraphV3(value):undefined;
        if(checked?.ok)return `Graph configuration · ${count(checked.graph.nodes.length,'node')} · ${count(checked.graph.edges.length,'connection')}`;
        return `JSON object · ${count(Object.keys(value).length,'field')}`;
      }
      if(Array.isArray(value))return `JSON array · ${count(value.length,'item')}`;
    }catch{ return `${name} · JSON-like text`; }
  }
  // Keep ordinary text readable without exposing control characters or splitting surrogate pairs.
  const preview=[...initial.replace(/\s+/g,' ').trim()];
  if(!preview.length)return `${name} · whitespace only`;
  return `${name} · starts with “${preview.length>32?preview.slice(0,31).join('')+'…':preview.join('')}”`;
}
