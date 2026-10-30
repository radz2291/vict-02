<script lang="ts">
  import {setContext} from 'svelte';
  import OwnedTooltip from '../src/OwnedTooltip.svelte';
  import {UI_PORTAL_TARGET} from '../src/document/extensions.js';
  let {disabled=false, open=false, delay=0}: {disabled?:boolean;open?:boolean;delay?:number}=$props();
  let outlet=$state<HTMLDivElement>();
  let replacement=$state(false);
  let explicitId=$state(false);
  const uid=$props.id();
  setContext(UI_PORTAL_TARGET,()=>outlet);
</script>
<section data-ui-owner-root="tooltip-a">
  <div data-testid="tooltip-source">
    <OwnedTooltip {open} {disabled} {delay} id={explicitId?`${uid}-changed-tip`:undefined} ownerId="tooltip-a" scopeClass="tooltip-scope" data-ui-owner="tooltip-a" data-ui-occ="help" data-ui-part="tip">
      {#snippet trigger(attributes)}{#if replacement}<button {...attributes} disabled={disabled} aria-label="Owned help" aria-describedby="existing-description">Replaced help</button>{:else}<button {...attributes} disabled={disabled} aria-label="Owned help" aria-describedby="existing-description">Help</button>{/if}{/snippet}
      Supplied tooltip text
    </OwnedTooltip>
  </div>
  <div bind:this={outlet} data-testid="tooltip-outlet"></div>
  <button aria-label="Replace tooltip trigger" onclick={()=>replacement=!replacement}>Replace trigger</button>
  <button aria-label="Change tooltip ID" onclick={()=>explicitId=!explicitId}>Change tooltip ID</button>
</section>
<section data-ui-owner-root="tooltip-b"><input aria-label="Sibling input"/></section>
<span id="existing-description">Existing host description</span>
