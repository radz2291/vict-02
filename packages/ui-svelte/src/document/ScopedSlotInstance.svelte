<script lang="ts">
  import { untrack,onDestroy,type Snippet } from 'svelte';
  import { copyUiValue,isUiValueOfType,stableJson,type UiSlotScope,type UiValue } from '@victframework/ui';
  import type { UiScopedSlotFrame } from './extensions.js';
  let {declaration,frame,generation,children,report}: {
    declaration:UiSlotScope;frame:UiScopedSlotFrame;generation:symbol;
    children:Snippet<[Readonly<Record<string,unknown>>,Readonly<Record<string,UiValue>>,(key:string,value:unknown)=>void,(name:string,payload?:UiValue)=>void]>;
    report:(code:string,message:string)=>void;
  }=$props();
  let alive=true;onDestroy(()=>{alive=false;});
  let local=$state<Record<string,UiValue>>(untrack(()=>Object.fromEntries(Object.entries(declaration.state??{}).filter(([,decl])=>!decl.controlled).map(([key,decl])=>[key,copyUiValue(decl.initial)]))));
  const resolved=$derived.by(()=>{
    const props:Record<string,unknown>={},state:Record<string,UiValue>={},errors:string[]=[];
    if(typeof frame.key!=='string'||!frame.key)errors.push('Scoped slot requires a nonempty stable key.');
    for(const decl of declaration.props){const value=frame.props[decl.name]??decl.default;if(decl.type==='array'?Array.isArray(value):isUiValueOfType(value,decl.type)){try{props[decl.name]=Array.isArray(value)?JSON.parse(stableJson(value)):value;}catch{errors.push(`Scoped prop '${decl.name}' is not serializable data.`);}}else errors.push(`Scoped prop '${decl.name}' has an incompatible value.`);}
    for(const [key,decl] of Object.entries(declaration.state??{})){const value=decl.controlled?(frame.state?.[key]??decl.initial):local[key];if(isUiValueOfType(value,decl.type))state[key]=copyUiValue(value);else errors.push(`Scoped state '${key}' has an incompatible value.`);}
    return {props,state,errors};
  });
  $effect(()=>{for(const message of resolved.errors)untrack(()=>report('UI_COMPONENT_SLOT_SCOPE_REJECTED',message));});
  const channels=$derived.by(()=>{
    const capturedFrame=frame,capturedDeclaration=declaration,capturedGeneration=generation;
    const capturedIdentity=stableJson({key:frame.key,props:resolved.props});
    const current=()=>alive&&generation===capturedGeneration&&stableJson({key:frame.key,props:resolved.props})===capturedIdentity;
    return {
      setState(key:string,value:unknown){
        const decl=capturedDeclaration.state?.[key];
        if(!current()||!decl||!isUiValueOfType(value,decl.type)){report('UI_COMPONENT_SLOT_SCOPE_REJECTED','Scoped state write was undeclared, expired or incorrectly typed.');return;}
        const copy=copyUiValue(value);
        if(decl.controlled)capturedFrame.onStateChange?.(key,copy);else local={...local,[key]:copy};
      },
      emit(name:string,payload?:UiValue){
        const decl=capturedDeclaration.outputs?.find(output=>output.name===name);
        if(!current()||!decl||(decl.payload==='void'?payload!==undefined:!isUiValueOfType(payload,decl.payload))){report('UI_COMPONENT_OUTPUT_REJECTED','Scoped output was undeclared, expired or incorrectly typed.');return;}
        capturedFrame.onOutput?.(name,payload===undefined?undefined:copyUiValue(payload));
      }
    };
  });
</script>
{#if resolved.errors.length}<span role="alert">{resolved.errors[0]}</span>{:else}{@render children(resolved.props,resolved.state,channels.setState,channels.emit)}{/if}
