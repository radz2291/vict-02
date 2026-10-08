import type { UiSvelteComponentImplementation } from '../../document/extensions.js';
import Avatar from './B5Avatar.svelte';
import AspectRatio from './B5AspectRatio.svelte';
import Separator from './B5Separator.svelte';
import Label from './B5Label.svelte';
import ScrollArea from './B5ScrollArea.svelte';
import Toolbar from './B5Toolbar.svelte';
import ToolbarButton from './B5ToolbarButton.svelte';
import LinkPreview from './B5LinkPreview.svelte';
import Tooltip from './B5Tooltip.svelte';
import Popover from './B5Popover.svelte';
import AlertDialog from './B5AlertDialog.svelte';
import Tabs from './B5Tabs.svelte';
import TabsTrigger from './B5TabsTrigger.svelte';
import TabsPanel from './B5TabsPanel.svelte';
import Collapsible from './B5Collapsible.svelte';

const identity = {
  revision: '1',
  rendererImplementationId: 'vict.svelte.catalog',
  abi: 'vict.ui-component-abi@1',
} as const;

export const b5CatalogImplementations: readonly UiSvelteComponentImplementation[] = [
  { ...identity, extensionId: 'vict.catalog.avatar', component: Avatar, slots: ["fallback"], styleTargets: ["root", "image", "fallback"] },
  { ...identity, extensionId: 'vict.catalog.aspect-ratio', component: AspectRatio, slots: ["content"], styleTargets: ["root"], required: ["content"] },
  { ...identity, extensionId: 'vict.catalog.separator', component: Separator, slots: [], styleTargets: ["root"] },
  { ...identity, extensionId: 'vict.catalog.label', component: Label, slots: ["content"], styleTargets: ["root"] },
  { ...identity, extensionId: 'vict.catalog.scroll-area', component: ScrollArea, slots: ["content"], styleTargets: ["root", "viewport"], required: ["content"] },
  { ...identity, extensionId: 'vict.catalog.toolbar', component: Toolbar, slots: ["tools"], styleTargets: ["root"], required: ["tools"] },
  { ...identity, extensionId: 'vict.catalog.toolbar-button', component: ToolbarButton, slots: ["content"], styleTargets: ["root"] },
  { ...identity, extensionId: 'vict.catalog.link-preview', component: LinkPreview, slots: ["trigger", "content"], styleTargets: ["root", "trigger"], required: ["content"] },
  { ...identity, extensionId: 'vict.catalog.tooltip', component: Tooltip, slots: ["trigger", "content"], styleTargets: ["root", "trigger"], required: ["content"] },
  { ...identity, extensionId: 'vict.catalog.popover', component: Popover, slots: ["trigger", "content"], styleTargets: ["root", "trigger"], required: ["content"] },
  { ...identity, extensionId: 'vict.catalog.alert-dialog', component: AlertDialog, slots: ["trigger", "body", "cancel", "action"], styleTargets: ["root", "trigger", "cancel", "action"], required: ["body"] },
  { ...identity, extensionId: 'vict.catalog.tabs', component: Tabs, slots: ["tabs", "panels"], styleTargets: ["root", "list"], required: ["tabs", "panels"] },
  { ...identity, extensionId: 'vict.catalog.tabs-trigger', component: TabsTrigger, slots: ["content"], styleTargets: ["root"] },
  { ...identity, extensionId: 'vict.catalog.tabs-panel', component: TabsPanel, slots: ["content"], styleTargets: ["root"], required: ["content"] },
  { ...identity, extensionId: 'vict.catalog.collapsible', component: Collapsible, slots: ["trigger", "content"], styleTargets: ["root", "trigger", "content"], required: ["content"] },
];
