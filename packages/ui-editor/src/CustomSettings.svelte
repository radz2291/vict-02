<script lang="ts">
 import {untrack} from 'svelte';
 import type {UiDocument,UiExpression,UiStyleValue} from '@victframework/ui';
 import ToolPages from './ToolPages.svelte';
 import ExpressionEditor from './ExpressionEditor.svelte';
 let {document,attributeNodeId,disabled=false,blockedProperties,blockedAttributes,readStyle,origin,onStyle,onAttribute,onDraftChange}: {
  document:UiDocument;attributeNodeId?:string;disabled?:boolean;blockedProperties:readonly string[];blockedAttributes:readonly string[];
  readStyle:(property:string)=>UiStyleValue|undefined;origin:(property:string)=>string;
  onStyle:(property:string,value?:UiStyleValue)=>boolean|void;onAttribute:(name:string,value?:UiExpression)=>boolean|void;onDraftChange:(dirty:boolean)=>void;
 }=$props();
 let active=$state('css');
 let property=$state('');let raw=$state('');let mode=$state<'text'|'token'>('text');let tokenId=$state('');let attribute=$state('');let dirty=$state(false);
 const reserved=$derived(blockedProperties.includes(property.trim()));
 const attrReserved=$derived(blockedAttributes.includes(attribute.trim()));
 const tokens=$derived(Object.keys(document.tokens));
 const attributeValue=$derived.by(()=>{const node=attributeNodeId?document.nodes[attributeNodeId]:undefined;const value=node?.kind==='element'?node.attributes?.[attribute.trim()]:undefined;return typeof value==='string'?{type:'literal' as const,value}:value;});
 function mark(next:boolean){dirty=next;onDraftChange(next);}
 function load(){const saved=readStyle(property.trim());mode=saved?.type==='token'?'token':'text';tokenId=saved?.type==='token'?saved.id:'';raw=saved?.type==='text'?saved.value:'';mark(false);}
 function apply(value?:UiStyleValue){if(disabled || !property.trim() || reserved)return;mark(false);if(onStyle(property.trim(),value)===false)mark(true);}
 const sourceKey=$derived(JSON.stringify(document));
 $effect(()=>{sourceKey;untrack(load);});
</script>
<svelte:window onkeydown={event=>{if(event.key==='Escape' && active==='css' && dirty && !event.defaultPrevented){event.preventDefault();event.stopPropagation();load();}}}/>
<ToolPages bind:active pages={[{id:'css',label:'Custom CSS'},...(attributeNodeId?[{id:'attributes',label:'Attributes'}]:[])]} label="Custom setting pages" locked={dirty}>
 {#snippet children(page)}
  {#if page==='css'}
   <label>CSS property<input aria-label="Custom CSS property" bind:value={property} disabled={dirty || disabled} onchange={load} placeholder="e.g. box-shadow"/></label>
   {#if reserved}<p>This setting already has a Format control. Named values and resets are in Rules → Values & reset.</p>
   {:else if property.trim()}<fieldset {disabled}>
    <label>Value source<select aria-label="Custom CSS source" value={mode} onchange={event=>{mode=event.currentTarget.value as 'text'|'token';mark(true);}}><option value="text">Fixed value</option><option value="token">Named value</option></select></label>
    {#if mode==='token'}<label>Named value<select aria-label="Custom CSS token" value={tokenId} onchange={event=>{tokenId=event.currentTarget.value;mark(true);}}><option value="">Choose a named value…</option>{#each tokens as id}<option value={id}>{id} · {document.tokens[id]?.value}</option>{/each}</select></label>{:else}<label>CSS value<input aria-label="Custom CSS value" bind:value={raw} oninput={()=>mark(true)}/></label>{/if}
    <div class="actions"><button type="button" disabled={mode==='token'?!tokens.includes(tokenId):!raw.trim()} onclick={()=>apply(mode==='token'?{type:'token',id:tokenId}:{type:'text',value:raw.trim()})}>Apply CSS</button><button type="button" disabled={!readStyle(property.trim())} onclick={()=>apply()}>Reset CSS</button>{#if dirty}<button type="button" onclick={load}>Cancel</button>{/if}</div>
    <p>{origin(property.trim())}</p>
   </fieldset>{/if}
  {:else}
   <label>Attribute name<input aria-label="Custom attribute name" bind:value={attribute} disabled={dirty} placeholder="e.g. data-category"/></label>
   {#if attrReserved}<p>This attribute already has a Content control. Edit it there.</p>{:else if attribute.trim()}{#key attribute.trim()}<ExpressionEditor compact label="Custom attribute" type="string" value={attributeValue} references={Object.entries(document.localState).filter(([,decl])=>decl.type==='string').map(([key])=>`state.${key}`)} onDraftChange={mark} onCommit={value=>onAttribute(attribute.trim(),value)}/>{/key}{/if}
   <p>Attributes apply at every screen size. Source validation checks supported names and values.</p>
  {/if}
 {/snippet}
</ToolPages>
<style>
 label {display:grid;gap:4px;margin:4px 0;font-size:11px;}input,select,button {font:11px 'Segoe UI',system-ui,sans-serif;box-sizing:border-box;min-width:0;border:1px solid #dce2eb;border-radius:4px;padding:5px 7px;background:white;color:#34425a;}input,select {width:100%;min-height:27px;}fieldset {border:0;margin:0;padding:0;min-width:0;}p {font-size:11px;line-height:1.4;color:#78869c;overflow-wrap:anywhere;margin:6px 0;}.actions {display:flex;gap:5px;margin-top:5px;}button {cursor:pointer;} :disabled {opacity:.45;cursor:default;}:focus-visible {outline:2px solid #5269bd;outline-offset:-1px;}
</style>
