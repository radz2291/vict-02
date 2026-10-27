<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {mediaHost} from './context.js';import {createIconRegistry} from './icons.js';import VectorGraphic from './VectorGraphic.svelte';import Vector from './Vector.svelte';
  let {props,presentation,occurrenceKey,nodeId}:UiSvelteComponentProps=$props();const host=mediaHost(),supplied=createIconRegistry();
  const target=$derived(presentation?.target('root'));
  const icon=$derived((host?.icons??supplied).resolve(String(props.pack??'lucide'),String(props.name??'circle-help'),String(props.revision??'1.27.0')));
  const size=$derived(Math.max(8,Math.min(512,Number(props.size)||20)));
  const decorative=$derived(props.decorative!==false), label=$derived(String(props.label??''));
</script>
<span {...target} class={`${target?.class??''} vict-media-icon`} aria-hidden={decorative?'true':undefined} role={!decorative?'img':undefined} aria-label={!decorative?label||icon?.label||'Unknown icon':undefined}>
  {#if props.source||props.data}<span style:width={`${size}px`} style:height={`${size}px`}><Vector {occurrenceKey} {nodeId} props={{source:String(props.source??''),data:String(props.data??''),decorative:true}}/></span>{:else if icon?.component}{@const Glyph=icon.component}<Glyph {size} strokeWidth={Math.max(.5,Math.min(4,Number(props.strokeWidth)||1.75))} aria-hidden="true"/>{:else if icon?.vector}<VectorGraphic graphic={icon.vector} width={size} height={size} decorative/>{:else}<span data-media-icon-missing title="Unknown icon identity">?</span>{/if}
</span>
<style>.vict-media-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:-.15em;flex:none;line-height:1;color:inherit}</style>
