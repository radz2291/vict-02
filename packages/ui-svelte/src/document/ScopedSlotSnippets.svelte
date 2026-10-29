<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { UiRenderInstruction, UiSlotScope } from '@victframework/ui';
  import type { UiScopedSlotFrame } from './extensions.js';
  import Self from './ScopedSlotSnippets.svelte';
  let {fills,scopes,names,index=0,slots={},renderFill,children}: {
    fills:Readonly<Record<string,readonly UiRenderInstruction[]>>;
    scopes:Readonly<Record<string,UiSlotScope>>;
    names:readonly string[];index?:number;
    slots?:Readonly<Record<string,Snippet<[UiScopedSlotFrame]>>>;
    renderFill:Snippet<[readonly UiRenderInstruction[],UiSlotScope,UiScopedSlotFrame]>;
    children:Snippet<[Readonly<Record<string,Snippet<[UiScopedSlotFrame]>>>]>;
  }=$props();
</script>
{#if index<names.length}
  {@const name=names[index]!}
  {#snippet fill(frame:UiScopedSlotFrame)}{@render renderFill(fills[name]??[],scopes[name]!,frame)}{/snippet}
  <Self {fills} {scopes} {names} index={index+1} slots={{...slots,[name]:fill}} {renderFill} {children}/>
{:else}{@render children(slots)}{/if}
