<script lang="ts">
  import * as HoverCard from '../upstream/ui/hover-card/index.js';
  import {Button} from '../upstream/ui/button/index.js';
  import {safeExternalUrl} from '../upstream/markdown/safe-url.js';
  import type {Citation} from './types.js';
  let {source}:{source:Citation}=$props();
</script>
<HoverCard.Root><HoverCard.Trigger>{#snippet child({props})}<Button {...props} variant="outline" size="xs">{source.title}</Button>{/snippet}</HoverCard.Trigger><HoverCard.Content><p>{source.excerpt??source.title}</p>{#if safeExternalUrl(source.url)}<a href={safeExternalUrl(source.url)} target="_blank" rel="noopener noreferrer">Open source</a>{/if}</HoverCard.Content></HoverCard.Root>
