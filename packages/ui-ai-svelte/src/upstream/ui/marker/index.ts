import Content from './marker-content.svelte';
import Icon from './marker-icon.svelte';
import Root from './marker.svelte';
import { markerVariants, type MarkerVariant } from './marker.variants.js';

export {
  Root,
  Icon,
  Content,
  markerVariants,
  type MarkerVariant,
  //
  Root as Marker,
  Icon as MarkerIcon,
  Content as MarkerContent,
};
