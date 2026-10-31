/** Internal passive JSON ownership boundary. Never read a source property value. */
export type PassiveJsonResult={ok:true;value:unknown}|{ok:false};
export function passiveJsonSnapshot(input:unknown):PassiveJsonResult{
 try{
  let result:unknown;
  const active=new Set<object>();
  const stack:({input:unknown;assign:(value:unknown)=>void}|{exit:object})[]=[{input,assign:value=>{result=value;}}];
  while(stack.length){
   const item=stack.pop()!;
   if('exit' in item){active.delete(item.exit);continue;}
   const source=item.input;
   if(source===null||typeof source==='string'||typeof source==='boolean'){item.assign(source);continue;}
   if(typeof source==='number'){if(!Number.isFinite(source))return {ok:false};item.assign(Object.is(source,-0)?0:source);continue;}
   if(typeof source!=='object'||active.has(source))return {ok:false};
   const array=Array.isArray(source),prototype=Object.getPrototypeOf(source);
   if(array?prototype!==Array.prototype&&prototype!==null:prototype!==Object.prototype&&prototype!==null)return {ok:false};
   const descriptors=Object.getOwnPropertyDescriptors(source),keys=Reflect.ownKeys(descriptors);
   const length=array?descriptors.length?.value:undefined;
   if(array&&(!Number.isSafeInteger(length)||length<0||keys.length!==length+1))return {ok:false};
   for(const key of keys){
    if(typeof key!=='string'||key==='__proto__')return {ok:false};
    if(array&&key==='length')continue;
    const descriptor=descriptors[key]!;
    if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return {ok:false};
    if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=length))return {ok:false};
   }
   const owned:unknown[]|Record<string,unknown>=array?new Array(length):Object.create(null);
   item.assign(owned);active.add(source);stack.push({exit:source});
   // Reverse scheduling retains JSON own-key order without retaining aliases.
   for(let index=keys.length-1;index>=0;index--){
    const key=keys[index] as string;if(array&&key==='length')continue;
    const value=descriptors[key]!.value;
    // Definitions on the owned container cannot invoke a source setter.
    stack.push({input:value,assign:value=>Object.defineProperty(owned,key,{value,writable:true,enumerable:true,configurable:true})});
   }
  }
  return {ok:true,value:result};
 }catch{return {ok:false};}
}
/** Appearance helpers project their declared fields without copying whole graphs.
 * Descriptor access may reject a throwing Proxy, but never invokes its get trap. */
export function passiveJsonFields(input:unknown,fields:readonly string[]):PassiveJsonResult{
 try{
  if(input===null||typeof input!=='object'||Array.isArray(input))return {ok:false};
  const prototype=Object.getPrototypeOf(input);
  if(prototype!==Object.prototype&&prototype!==null)return {ok:false};
  const descriptors=Object.getOwnPropertyDescriptors(input),projected=Object.create(null);
  for(const key of Reflect.ownKeys(descriptors)){
   if(typeof key!=='string'||key==='__proto__')return {ok:false};
   const descriptor=descriptors[key]!;
   if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return {ok:false};
   if(fields.includes(key))Object.defineProperty(projected,key,{value:descriptor.value,writable:true,enumerable:true,configurable:true});
  }
  return passiveJsonSnapshot(projected);
 }catch{return {ok:false};}
}
