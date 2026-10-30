import { getContext } from 'svelte';
import type { MediaAssetStore } from './assets.js';
import type { IconRegistry } from './icons.js';
export const MEDIA_HOST = Symbol.for('vict.ui-media.host@1');
export type EmbedProvider = 'youtube' | 'vimeo';
export interface MediaHost {
  readonly namespace: string;
  readonly assets: MediaAssetStore;
  readonly icons: IconRegistry;
  readonly embedProviders: readonly EmbedProvider[];
  readonly changed?: () => void;
}
export const mediaHost = () => getContext<MediaHost | undefined>(MEDIA_HOST);
export function embedUrl(provider: string, id: string): string {
  if (provider === 'youtube' && /^[a-zA-Z0-9_-]{11}$/.test(id))
    return `https://www.youtube-nocookie.com/embed/${id}`;
  if (provider === 'vimeo' && /^\d{1,12}$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  throw Error('Unsupported embed provider or invalid provider-specific video identity.');
}
