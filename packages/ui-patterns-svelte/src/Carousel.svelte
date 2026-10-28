<script lang="ts">
  import {patternTarget} from './target.js';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import {Button} from '@victframework/ui-svelte/catalog/button';
  import { MediaIcon, MediaImage } from '@victframework/ui-media-svelte';
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
  <div {...patternTarget(presentation,'viewport','vict-carousel-viewport')} ondragstart={event=>event.preventDefault()} onpointerdown={(event) => { swiping=true; startX=event.clientX; startY=event.clientY; }} onpointercancel={()=>{swiping=false;}} onpointerup={(event) => { if(!swiping)return;swiping=false;const dx=event.clientX-startX,dy=event.clientY-startY; if (Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5) change(index+(dx<0?1:-1)); }} role="group" aria-label="Slides">
    {#each slides as slide, i}
      <div {...patternTarget(presentation,'slide','vict-carousel-slide')} id={`${id}-${i}`} role="group" aria-roledescription="slide" aria-label={`${i+1} of ${slides.length}`} hidden={i!==index}>
        {#if props.images === true}<MediaImage {nodeId} occurrenceKey={`${occurrenceKey}:slide:${i}`} props={{source:slide,alt:stringItems(props.labels)[i] ?? `Slide ${i+1}`,fit:'contain',eager:i===index}} />{:else}<p>{slide}</p>{/if}
      </div>
    {/each}
    {#if !slides.length}<p role="status">No slides</p>{/if}
  </div>
  <div {...patternTarget(presentation,'controls','vict-carousel-controls')}>
    <Button.Root class="vict-btn vict-btn--secondary" type="button" aria-label="Previous slide" disabled={!slides.length || (props.loop!==true && index===0)} onclick={()=>change(index-1)}>
      {#if io?.slots?.previousIcon}<span {...presentation?.target('previousIcon')} aria-hidden="true">{@render io.slots.previousIcon()}</span>{:else if props.previousIcon}<span {...presentation?.target('previousIcon')} aria-hidden="true"><MediaIcon {nodeId} occurrenceKey={`${occurrenceKey}:previous-icon`} props={{pack:String(props.iconPack??'lucide'),revision:String(props.iconRevision??'1.27.0'),name:String(props.previousIcon),decorative:true,size:20}} /></span>{/if}<span>Previous</span>
    </Button.Root>
    <span aria-live="polite" aria-atomic="true">{slides.length ? `${index+1} / ${slides.length}` : '0 / 0'}</span>
    <Button.Root class="vict-btn vict-btn--secondary" type="button" aria-label="Next slide" disabled={!slides.length || (props.loop!==true && index===slides.length-1)} onclick={()=>change(index+1)}>
      {#if io?.slots?.nextIcon}<span {...presentation?.target('nextIcon')} aria-hidden="true">{@render io.slots.nextIcon()}</span>{:else if props.nextIcon}<span {...presentation?.target('nextIcon')} aria-hidden="true"><MediaIcon {nodeId} occurrenceKey={`${occurrenceKey}:next-icon`} props={{pack:String(props.iconPack??'lucide'),revision:String(props.iconRevision??'1.27.0'),name:String(props.nextIcon),decorative:true,size:20}} /></span>{/if}<span>Next</span>
    </Button.Root>
  </div>
  <div {...patternTarget(presentation,'indicators','vict-carousel-indicators')} aria-label="Choose slide">
    {#each slides as _,i}<Button.Root class="vict-btn vict-btn--secondary" type="button" aria-label={`Go to slide ${i+1}`} aria-current={i===index?'true':undefined} aria-controls={`${id}-${i}`} onclick={()=>change(i)}>{i+1}</Button.Root>{/each}
  </div>
</section>
<style>.vict-carousel{min-width:0}.vict-carousel-viewport{overflow:hidden;touch-action:pan-y}.vict-carousel-slide{margin:0;min-width:0}.vict-carousel-slide[hidden]{display:none}.vict-carousel-slide :global(img){max-height:70dvh}.vict-carousel-controls,.vict-carousel-indicators{display:flex;gap:.5rem;align-items:center;justify-content:center;padding:.5rem}.vict-carousel :global([data-button-root]){min-height:44px;min-width:44px}.vict-carousel :global([aria-current=true]){outline:2px solid var(--vict-color-focusRing,currentColor);outline-offset:2px}</style>
