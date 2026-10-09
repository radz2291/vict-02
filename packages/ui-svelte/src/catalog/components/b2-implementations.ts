import type { UiSvelteComponentImplementation } from '../../document/extensions.js';
import { b2CatalogDescriptors } from './b2-descriptors.js';
import Select from './B2Select.svelte';
import SelectItem from './B2SelectItem.svelte';
import Combobox from './B2Combobox.svelte';
import ComboboxItem from './B2ComboboxItem.svelte';
import ToggleGroup from './B2ToggleGroup.svelte';
import ToggleGroupItem from './B2ToggleGroupItem.svelte';
import Accordion from './B2Accordion.svelte';
import AccordionItem from './B2AccordionItem.svelte';
function implementation(name: string, component: UiSvelteComponentImplementation['component']): UiSvelteComponentImplementation {
  const descriptor = b2CatalogDescriptors.find(entry => entry.id === `vict.catalog.${name}`)!;
  return { extensionId: descriptor.id, revision: descriptor.revision, rendererImplementationId: descriptor.rendererImplementationId!, abi: 'vict.ui-component-abi@1', styleTargets: descriptor.styleTargets, slots: descriptor.slots ?? [], component };
}
export const b2CatalogImplementations: readonly UiSvelteComponentImplementation[] = [
  implementation('select-multiple', Select),
  implementation('select-item', SelectItem),
  implementation('combobox', Combobox),
  implementation('combobox-multiple', Combobox),
  implementation('combobox-item', ComboboxItem),
  implementation('toggle-group', ToggleGroup),
  implementation('toggle-group-multiple', ToggleGroup),
  implementation('toggle-group-item', ToggleGroupItem),
  implementation('accordion', Accordion),
  implementation('accordion-multiple', Accordion),
  implementation('accordion-item', AccordionItem),
];
