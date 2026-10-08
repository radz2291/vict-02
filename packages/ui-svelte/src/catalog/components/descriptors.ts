/**
 * B1 catalog descriptors (frozen amendment §3.2 shapes; the five frozen
 * fixtures pin button/checkbox/select/dialog/appshell byte-level) plus the
 * three scalar wrappers (switch/toggle/radio-group, same S-scalar
 * mechanics). Descriptors are pure data registered OUTSIDE serialized
 * source; every component-ABI descriptor carries the events marker + `abi`
 * pair (amendment §10.3 — the gate is family-agnostic).
 */
import type { UiExtensionDescriptor } from '@victframework/ui';

const ABI = ['vict.ui-component-abi@1'] as const;

export const catalogButtonDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.button',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'label', type: 'string', default: '' },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'loading', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'press',
      payload: 'void',
      description: 'Fires on activation while not disabled/loading.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
};

export const catalogCheckboxDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.checkbox',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'checked', type: 'boolean', default: false },
    { name: 'indeterminate', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'checkedChange',
      payload: 'boolean',
      description: 'Fires when the user toggles the checkbox.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
  inspectionLimits: ['internal focus ring styling'],
};

export const catalogSelectDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.select',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'options', type: 'array' },
    { name: 'value', type: 'string', default: '' },
    { name: 'disabled', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'valueChange',
      payload: 'string',
      description: 'Fires with the newly selected value.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  slots: ['items'],
  styleTargets: ['root', 'content'],
};

export const catalogDialogDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.dialog',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'title', type: 'string', default: '' },
    { name: 'open', type: 'boolean', default: false },
  ],
  inspectionLimits: ['Focus management and closed internal parts are implementation-owned.'],
  outputs: [
    {
      name: 'openChange',
      payload: 'boolean',
      description: 'Fires for open requests and Escape/overlay closes.',
    },
  ],
  slots: ['body'],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root', 'trigger'],
};

export const catalogAppShellDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.appshell',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'title', type: 'string', default: '' },
    { name: 'navigation', type: 'array' },
    { name: 'path', type: 'string', default: '' },
    { name: 'navigationMode', type: 'string', default: 'sidebar' },
    { name: 'navigationAt', type: 'string', default: 'small' },
  ],
  outputs: [],
  slots: ['content'],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
};

export const catalogSwitchDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.switch',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'checked', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'checkedChange',
      payload: 'boolean',
      description: 'Fires when the user flips the switch.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
};

export const catalogToggleDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.toggle',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'pressed', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'pressedChange',
      payload: 'boolean',
      description: 'Fires when the user presses or releases the toggle.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
};

export const catalogRadioGroupDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.radio-group',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: [...ABI],
  props: [
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'options', type: 'array' },
    { name: 'value', type: 'string', default: '' },
  ],
  outputs: [
    {
      name: 'valueChange',
      payload: 'string',
      description: 'Fires with the newly selected value.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
};

/** All eight B1 descriptors in stable registration order. */
export const b1CatalogDescriptors: readonly UiExtensionDescriptor[] = [
  catalogButtonDescriptor,
  catalogCheckboxDescriptor,
  catalogSelectDescriptor,
  catalogDialogDescriptor,
  catalogAppShellDescriptor,
  catalogSwitchDescriptor,
  catalogToggleDescriptor,
  catalogRadioGroupDescriptor,
];
