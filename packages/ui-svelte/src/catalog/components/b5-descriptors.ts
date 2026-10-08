import type { UiExtensionDescriptor } from '@victframework/ui';

/** B5 public catalog composition. Data stays in authored props, slots and outputs. */
const identity = {
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  rendererImplementationId: 'vict.svelte.catalog',
} as const;

export const catalogAvatarDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.avatar',
  props: [
    { name: 'src', type: 'string', default: "" },
    { name: 'alt', type: 'string', default: "" },
    { name: 'fallback', type: 'string', default: "" },
    { name: 'delayMs', type: 'number', default: 0 },
  ],
  outputs: [
  ],
  slots: ["fallback"],
  styleTargets: ["root", "image", "fallback"],
};

export const catalogAspectRatioDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.aspect-ratio',
  props: [
    { name: 'ratio', type: 'number', default: 1 },
  ],
  outputs: [
  ],
  slots: ["content"],
  styleTargets: ["root"],
};

export const catalogSeparatorDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.separator',
  props: [
    { name: 'orientation', type: 'string', default: "horizontal" },
    { name: 'decorative', type: 'boolean', default: false },
  ],
  outputs: [
  ],
  slots: [],
  styleTargets: ["root"],
};

export const catalogLabelDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.label',
  props: [
    { name: 'for', type: 'string', default: "" },
    { name: 'label', type: 'string', default: "" },
  ],
  outputs: [
  ],
  slots: ["content"],
  styleTargets: ["root"],
};

export const catalogScrollAreaDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.scroll-area',
  props: [
    { name: 'type', type: 'string', default: "hover" },
    { name: 'direction', type: 'string', default: "ltr" },
    { name: 'hideDelay', type: 'number', default: 600 },
    { name: 'horizontal', type: 'boolean', default: false },
  ],
  outputs: [
  ],
  slots: ["content"],
  styleTargets: ["root", "viewport"],
};

export const catalogToolbarDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.toolbar',
  props: [
    { name: 'label', type: 'string', default: "Tools" },
    { name: 'orientation', type: 'string', default: "horizontal" },
    { name: 'loop', type: 'boolean', default: true },
  ],
  outputs: [
  ],
  slots: ["tools"],
  styleTargets: ["root"],
};

export const catalogToolbarButtonDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.toolbar-button',
  props: [
    { name: 'label', type: 'string', default: "" },
    { name: 'disabled', type: 'boolean', default: false },
  ],
  outputs: [
    { name: 'press', payload: 'void' },
  ],
  slots: ["content"],
  styleTargets: ["root"],
};

export const catalogLinkPreviewDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.link-preview',
  props: [
    { name: 'open', type: 'boolean', default: false },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'title', type: 'string', default: '' },
    { name: 'description', type: 'string', default: '' },
    { name: 'href', type: 'string', default: "" },
    { name: 'openDelay', type: 'number', default: 700 },
    { name: 'closeDelay', type: 'number', default: 300 },
    { name: 'side', type: 'string', default: "bottom" },
    { name: 'sideOffset', type: 'number', default: 8 },
  ],
  outputs: [
    { name: 'openChange', payload: 'boolean' },
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger"],
};

export const catalogTooltipDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.tooltip',
  props: [
    { name: 'open', type: 'boolean', default: false },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'title', type: 'string', default: '' },
    { name: 'description', type: 'string', default: '' },
    { name: 'delay', type: 'number', default: 700 },
    { name: 'side', type: 'string', default: "bottom" },
    { name: 'sideOffset', type: 'number', default: 8 },
  ],
  outputs: [
    { name: 'openChange', payload: 'boolean' },
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger"],
};

export const catalogPopoverDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.popover',
  props: [
    { name: 'open', type: 'boolean', default: false },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: '' },
    { name: 'title', type: 'string', default: '' },
    { name: 'description', type: 'string', default: '' },
    { name: 'side', type: 'string', default: "bottom" },
    { name: 'sideOffset', type: 'number', default: 8 },
  ],
  outputs: [
    { name: 'openChange', payload: 'boolean' },
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger"],
};

export const catalogAlertDialogDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.alert-dialog',
  props: [
    { name: 'open', type: 'boolean', default: false },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: "" },
    { name: 'title', type: 'string', default: "" },
    { name: 'description', type: 'string', default: "" },
    { name: 'cancelLabel', type: 'string', default: "Cancel" },
    { name: 'confirmLabel', type: 'string', default: "Confirm" },
  ],
  outputs: [
    { name: 'openChange', payload: 'boolean' },
    { name: 'confirm', payload: 'void' },
  ],
  slots: ["trigger", "body", "cancel", "action"],
  styleTargets: ["root", "trigger", "cancel", "action"],
};

export const catalogTabsDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.tabs',
  props: [
    { name: 'value', type: 'string', default: "" },
    { name: 'label', type: 'string', default: "Sections" },
    { name: 'orientation', type: 'string', default: "horizontal" },
    { name: 'activationMode', type: 'string', default: "automatic" },
    { name: 'loop', type: 'boolean', default: false },
    { name: 'disabled', type: 'boolean', default: false },
  ],
  outputs: [
    { name: 'valueChange', payload: 'string' },
  ],
  slots: ["tabs", "panels"],
  styleTargets: ["root", "list"],
};

export const catalogTabsTriggerDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.tabs-trigger',
  props: [
    { name: 'value', type: 'string', default: "" },
    { name: 'label', type: 'string', default: "" },
    { name: 'disabled', type: 'boolean', default: false },
  ],
  outputs: [
  ],
  slots: ["content"],
  styleTargets: ["root"],
};

export const catalogTabsPanelDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.tabs-panel',
  props: [
    { name: 'value', type: 'string', default: "" },
  ],
  outputs: [
  ],
  slots: ["content"],
  styleTargets: ["root"],
};

export const catalogCollapsibleDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.catalog.collapsible',
  props: [
    { name: 'open', type: 'boolean', default: false },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'label', type: 'string', default: "Details" },
  ],
  outputs: [
    { name: 'openChange', payload: 'boolean' },
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger", "content"],
};

export const b5CatalogDescriptors: readonly UiExtensionDescriptor[] = [
  catalogAvatarDescriptor,
  catalogAspectRatioDescriptor,
  catalogSeparatorDescriptor,
  catalogLabelDescriptor,
  catalogScrollAreaDescriptor,
  catalogToolbarDescriptor,
  catalogToolbarButtonDescriptor,
  catalogLinkPreviewDescriptor,
  catalogTooltipDescriptor,
  catalogPopoverDescriptor,
  catalogAlertDialogDescriptor,
  catalogTabsDescriptor,
  catalogTabsTriggerDescriptor,
  catalogTabsPanelDescriptor,
  catalogCollapsibleDescriptor,
];
