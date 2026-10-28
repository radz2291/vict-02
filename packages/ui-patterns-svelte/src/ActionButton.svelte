<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {Button} from '@victframework/ui-svelte/catalog/button';
  import {patternTarget} from './target.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  const label=$derived(String(props.label??'Action').trim()||'Action');
</script>
<Button.Root {...patternTarget(presentation,'root','vict-btn vict-btn--secondary vict-action-button')} type="button" disabled={props.disabled===true} aria-label={label} title={props.iconOnly===true?label:undefined} onclick={()=>io?.emit('activate',String(props.value??'action'))}>
  {#if io?.slots?.icon}<span {...patternTarget(presentation,'icon','vict-action-icon')} aria-hidden="true">{@render io.slots.icon()}</span>{/if}
  <span {...patternTarget(presentation,'label',props.iconOnly===true?'vict-action-label-hidden':'vict-action-label')}>{label}</span>
  {#if io?.slots?.trailingIcon}<span {...patternTarget(presentation,'trailingIcon','vict-action-icon')} aria-hidden="true">{@render io.slots.trailingIcon()}</span>{/if}
</Button.Root>
<style>:global(.vict-action-button){min-width:44px;min-height:44px}.vict-action-icon{display:inline-flex;align-items:center;justify-content:center;flex:none}.vict-action-label-hidden{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}</style>
