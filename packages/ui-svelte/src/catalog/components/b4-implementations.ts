/** B4 uses public catalog primitives; the bridge owns declared authority. */
import type { UiSvelteComponentImplementation } from '../../document/extensions.js';
import B4DropdownMenu from './B4DropdownMenu.svelte';
import B4ContextMenu from './B4ContextMenu.svelte';
import B4Menubar from './B4Menubar.svelte';
import B4MenubarMenu from './B4MenubarMenu.svelte';
import B4MenuItem from './B4MenuItem.svelte';
import B4MenuSub from './B4MenuSub.svelte';
import B4MenuCheckboxItem from './B4MenuCheckboxItem.svelte';
import B4MenuCheckboxGroup from './B4MenuCheckboxGroup.svelte';
import B4MenuRadioGroup from './B4MenuRadioGroup.svelte';
import B4MenuRadioItem from './B4MenuRadioItem.svelte';
import B4MenuGroup from './B4MenuGroup.svelte';
import B4MenuSeparator from './B4MenuSeparator.svelte';
import B4Command from './B4Command.svelte';
import B4CommandItem from './B4CommandItem.svelte';
import B4CommandGroup from './B4CommandGroup.svelte';
import B4NavigationMenu from './B4NavigationMenu.svelte';
import B4NavigationMenuItem from './B4NavigationMenuItem.svelte';
import B4NavigationMenuLink from './B4NavigationMenuLink.svelte';
import B4NavigationMenuSub from './B4NavigationMenuSub.svelte';

export const b4CatalogImplementations: readonly UiSvelteComponentImplementation[] = [
  {
    "extensionId": "vict.catalog.dropdown-menu",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4DropdownMenu
  },
  {
    "extensionId": "vict.catalog.context-menu",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4ContextMenu
  },
  {
    "extensionId": "vict.catalog.menubar",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "menus"
    ],
    "required": [
      "menus"
    ],
    "component": B4Menubar
  },
  {
    "extensionId": "vict.catalog.menubar.menu",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenubarMenu
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuItem
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.sub",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuSub
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.checkbox-item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuCheckboxItem
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.checkbox-group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuCheckboxGroup
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.radio-group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuRadioGroup
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.radio-item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuRadioItem
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "heading",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuGroup
  },
  {
    "extensionId": "vict.catalog.dropdown-menu.separator",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [],
    "required": [],
    "component": B4MenuSeparator
  },
  {
    "extensionId": "vict.catalog.context-menu.item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuItem
  },
  {
    "extensionId": "vict.catalog.context-menu.sub",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuSub
  },
  {
    "extensionId": "vict.catalog.context-menu.checkbox-item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuCheckboxItem
  },
  {
    "extensionId": "vict.catalog.context-menu.checkbox-group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuCheckboxGroup
  },
  {
    "extensionId": "vict.catalog.context-menu.radio-group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuRadioGroup
  },
  {
    "extensionId": "vict.catalog.context-menu.radio-item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuRadioItem
  },
  {
    "extensionId": "vict.catalog.context-menu.group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "heading",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuGroup
  },
  {
    "extensionId": "vict.catalog.context-menu.separator",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [],
    "required": [],
    "component": B4MenuSeparator
  },
  {
    "extensionId": "vict.catalog.menubar.item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuItem
  },
  {
    "extensionId": "vict.catalog.menubar.sub",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuSub
  },
  {
    "extensionId": "vict.catalog.menubar.checkbox-item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuCheckboxItem
  },
  {
    "extensionId": "vict.catalog.menubar.checkbox-group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuCheckboxGroup
  },
  {
    "extensionId": "vict.catalog.menubar.radio-group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuRadioGroup
  },
  {
    "extensionId": "vict.catalog.menubar.radio-item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4MenuRadioItem
  },
  {
    "extensionId": "vict.catalog.menubar.group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "heading",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4MenuGroup
  },
  {
    "extensionId": "vict.catalog.menubar.separator",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [],
    "required": [],
    "component": B4MenuSeparator
  },
  {
    "extensionId": "vict.catalog.command",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items",
      "empty"
    ],
    "required": [
      "items"
    ],
    "component": B4Command
  },
  {
    "extensionId": "vict.catalog.command.item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4CommandItem
  },
  {
    "extensionId": "vict.catalog.command.group",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "heading",
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4CommandGroup
  },
  {
    "extensionId": "vict.catalog.navigation-menu",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4NavigationMenu
  },
  {
    "extensionId": "vict.catalog.navigation-menu.item",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root",
      "content"
    ],
    "slots": [
      "trigger",
      "content"
    ],
    "required": [
      "content"
    ],
    "component": B4NavigationMenuItem
  },
  {
    "extensionId": "vict.catalog.navigation-menu.link",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "content"
    ],
    "required": [],
    "component": B4NavigationMenuLink
  },
  {
    "extensionId": "vict.catalog.navigation-menu.sub",
    "revision": "1",
    "rendererImplementationId": "vict.svelte.catalog",
    "abi": "vict.ui-component-abi@1",
    "styleTargets": [
      "root"
    ],
    "slots": [
      "items"
    ],
    "required": [
      "items"
    ],
    "component": B4NavigationMenuSub
  },
];
