<script lang="ts">
  import AssetProvider from '../src/AssetProvider.svelte';
  import Embed from '../src/Embed.svelte';
  import { memoryAssetStore } from '../src/assets.js';
  import type { EmbedProvider } from '../src/context.js';

  let { provider = 'youtube', videoId = 'abcdefghijk', title = 'Supplied video',
    providers = ['youtube', 'vimeo'] }: {
      provider?: string; videoId?: string; title?: string; providers?: readonly EmbedProvider[];
    } = $props();
  const store = memoryAssetStore();
  export function replaceSource(nextProvider: string, nextId: string) {
    provider = nextProvider; videoId = nextId;
  }
  export function replaceProviders(next: readonly EmbedProvider[]) { providers = next; }
</script>

<AssetProvider namespace="embed-lifecycle-test" {store} embedProviders={providers}>
  <Embed nodeId="embed" occurrenceKey="embed" props={{ provider, videoId, title }} />
</AssetProvider>
