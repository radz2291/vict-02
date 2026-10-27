<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {patternTarget} from './target.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  const label=$derived(String(props.label??'Action').trim()||'Action');
</script>
<button {...patternTarget(presentation,'root','vict-action-button')} type="button" disabled={props.disabled===true} aria-label={label} title={props.iconOnly===true?label:undefined} onclick={()=>io?.emit('activate',String(props.value??'action'))}>
  {#if io?.slots?.icon}<span {...patternTarget(presentation,'icon','vict-action-icon')} aria-hidden="true">{@render io.slots.icon()}</span>{/if}
  <span {...patternTarget(presentation,'label',props.iconOnly===true?'vict-action-label-hidden':'vict-action-label')}>{label}</span>
  {#if io?.slots?.trailingIcon}<span {...patternTarget(presentation,'trailingIcon','vict-action-icon')} aria-hidden="true">{@render io.slots.trailingIcon()}</span>{/if}
</button>
<style>.vict-action-button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;font:inherit;min-width:44px;min-height:44px;padding:.5rem .75rem;border:1px solid var(--vict-border,var(--vict-color-border,#d8dce5));border-radius:.25rem;background:var(--vict-surface,var(--vict-color-surface,#fff));color:var(--vict-text,var(--vict-color-text,#172033))}.vict-action-button:disabled{opacity:.55;cursor:not-allowed}.vict-action-icon{display:inline-flex;align-items:center;justify-content:center;flex:none}.vict-action-label-hidden{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}</style>
