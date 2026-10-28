import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import Drawer from '../Drawer.svelte';
import Carousel from '../Carousel.svelte';
import Navigation from '../Navigation.svelte';
import FilteredList from '../FilteredList.svelte';
import FirstVisit from '../FirstVisit.svelte';
import ActionButton from '../ActionButton.svelte';
import { patternAuthoringDescriptors } from './descriptors.js';
const components = [
  Drawer,
  Carousel,
  Navigation,
  FilteredList,
  FirstVisit,
  Navigation,
  Carousel,
  FilteredList,
  ActionButton,
  FirstVisit,
];
export const patternAuthoringImplementations: readonly UiSvelteComponentImplementation[] =
  patternAuthoringDescriptors.map((descriptor, index) => ({
    extensionId: descriptor.id,
    revision: descriptor.revision,
    rendererImplementationId: descriptor.rendererImplementationId!,
    abi: 'vict.ui-component-abi@1',
    slots: descriptor.slots ?? [],
    styleTargets: descriptor.styleTargets,
    component: components[index]!,
  }));
