/**
 * B1 catalog implementations: each wraps its public/styled component and
 * receives ONLY the IO contract (`io.emit` + declared slot snippets) — no
 * dispatcher, no application data (amendment §3.4 emit-only authority).
 * Identity is exact: `(extensionId, revision, rendererImplementationId,
 * abi)`; the bridge fail-closes on absent/competing registrations.
 */
import type { UiSvelteComponentImplementation } from '../../document/extensions.js';
import Button from './CatalogButton.svelte';
import Checkbox from './CatalogCheckbox.svelte';
import Select from './CatalogSelect.svelte';
import Dialog from './CatalogDialog.svelte';
import AppShell from './CatalogAppShell.svelte';
import Switch from './CatalogSwitch.svelte';
import Toggle from './CatalogToggle.svelte';
import RadioGroup from './CatalogRadioGroup.svelte';

export const b1CatalogImplementations: readonly UiSvelteComponentImplementation[] = [
  {
    extensionId: 'vict.catalog.button',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: Button,
  },
  {
    extensionId: 'vict.catalog.checkbox',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: Checkbox,
  },
  {
    extensionId: 'vict.catalog.select',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root', 'content'],
    slots: [],
    component: Select,
  },
  {
    extensionId: 'vict.catalog.dialog',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root', 'trigger'],
    slots: ['body'],
    required: ['body'],
    component: Dialog,
  },
  {
    extensionId: 'vict.catalog.appshell',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: ['content'],
    required: ['content'],
    component: AppShell,
  },
  {
    extensionId: 'vict.catalog.switch',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: Switch,
  },
  {
    extensionId: 'vict.catalog.toggle',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: Toggle,
  },
  {
    extensionId: 'vict.catalog.radio-group',
    revision: '1',
    rendererImplementationId: 'vict.svelte.catalog',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: RadioGroup,
  },
];
