<script lang="ts">
  import {patternTarget} from './target.js';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { MediaIcon } from '@victframework/ui-media-svelte';
  import { stringItems, slideIndex } from './state.js';
  let { props, io, presentation, occurrenceKey, nodeId }: UiSvelteComponentProps = $props();
  const slides = $derived(stringItems(props.slides));
  const index = $derived(slideIndex(Number(props.index ?? 0), slides.length, props.loop === true));
  let startX = 0;
  let startY = 0;
  let swiping = false;
  const change = (next: number) => { const value = slideIndex(next, slides.length, props.loop === true); if (value !== index) io?.emit('indexChange', value); };
  const id = $props.id();
</script>
<section {...patternTarget(presentation,'root','vict-carousel')} aria-roledescription="carousel" aria-label={String(props.label ?? 'Gallery')}>
  <div {...patternTarget(presentation,'viewport','vict-carousel-viewport')} onpointerdown={(event) => { swiping=true; startX=event.clientX; startY=event.clientY; }} onpointercancel={()=>{swiping=false;}} onpointerup={(event) => { if(!swiping)return;swiping=false;const dx=event.clientX-startX,dy=event.clientY-startY; if (Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5) change(index+(dx<0?1:-1)); }} role="group" aria-label="Slides">
    {#each slides as slide, i}
      <div {...presentation?.target('slide')} id={`${id}-${i}`} class="vict-carousel-slide" role="group" aria-roledescription="slide" aria-label={`${i+1} of ${slides.length}`} hidden={i!==index}>
        {#if props.images === true}<img src={slide} alt={stringItems(props.labels)[i] ?? `Slide ${i+1}`} draggable="false" />{:else}<p>{slide}</p>{/if}
      </div>
    {/each}
    {#if !slides.length}<p role="status">No slides</p>{/if}
  </div>
  <div {...patternTarget(presentation,'controls','vict-carousel-controls')}>
    <button type="button" aria-label="Previous slide" disabled={!slides.length || (props.loop!==true && index===0)} onclick={()=>change(index-1)}>
      {#if io?.slots?.previousIcon}<span {...presentation?.target('previousIcon')} aria-hidden="true">{@render io.slots.previousIcon()}</span>{:else if props.previousIcon}<span {...presentation?.target('previousIcon')} aria-hidden="true"><MediaIcon {nodeId} occurrenceKey={`${occurrenceKey}:previous-icon`} props={{pack:String(props.iconPack??'lucide'),revision:String(props.iconRevision??'1.27.0'),name:String(props.previousIcon),decorative:true,size:20}} /></span>{/if}<span>Previous</span>
    </button>
    <span aria-live="polite" aria-atomic="true">{slides.length ? `${index+1} / ${slides.length}` : '0 / 0'}</span>
    <button type="button" aria-label="Next slide" disabled={!slides.length || (props.loop!==true && index===slides.length-1)} onclick={()=>change(index+1)}>
      {#if io?.slots?.nextIcon}<span {...presentation?.target('nextIcon')} aria-hidden="true">{@render io.slots.nextIcon()}</span>{:else if props.nextIcon}<span {...presentation?.target('nextIcon')} aria-hidden="true"><MediaIcon {nodeId} occurrenceKey={`${occurrenceKey}:next-icon`} props={{pack:String(props.iconPack??'lucide'),revision:String(props.iconRevision??'1.27.0'),name:String(props.nextIcon),decorative:true,size:20}} /></span>{/if}<span>Next</span>
    </button>
  </div>
  <div {...patternTarget(presentation,'indicators','vict-carousel-indicators')} aria-label="Choose slide">
    {#each slides as _,i}<button type="button" aria-label={`Go to slide ${i+1}`} aria-current={i===index?'true':undefined} aria-controls={`${id}-${i}`} onclick={()=>change(i)}>{i+1}</button>{/each}
  </div>
</section>
<style>.vict-carousel{min-width:0}.vict-carousel-viewport{overflow:hidden;touch-action:pan-y}.vict-carousel-slide{margin:0;min-width:0}.vict-carousel-slide[hidden]{display:none}.vict-carousel-slide img{display:block;width:100%;max-height:70dvh;object-fit:contain}.vict-carousel-controls,.vict-carousel-indicators{display:flex;gap:.5rem;align-items:center;justify-content:center;padding:.5rem}button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;background:var(--vict-surface,var(--vict-color-surface,#fff));color:var(--vict-text,var(--vict-color-text,#172033));border:1px solid var(--vict-border,var(--vict-color-border,#d8dce5));font:inherit;min-height:44px;min-width:44px}button[aria-current=true]{outline:2px solid currentColor;outline-offset:2px}</style>
