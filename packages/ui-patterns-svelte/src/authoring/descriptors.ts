import type { UiExtensionDescriptor } from '@victframework/ui';
const identity = {
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  rendererImplementationId: 'vict.svelte.patterns',
} as const;
export const drawerDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.pattern.drawer',
  props: [
    { name: 'open', type: 'boolean', default: false },
    { name: 'title', type: 'string', default: 'Menu' },
    { name: 'triggerLabel', type: 'string', default: 'Open menu' },
    { name: 'showTrigger', type: 'boolean', default: true },
    { name: 'side', type: 'string', default: 'left' },
    { name: 'size', type: 'number', default: 320 },
    { name: 'dismissible', type: 'boolean', default: true },
  ],
  outputs: [{ name: 'openChange', payload: 'boolean' }],
  slots: ['trigger', 'body', 'footer'],
  styleTargets: ['root', 'trigger', 'backdrop', 'panel', 'header', 'body', 'footer'],
  inspectionLimits: [
    'In-application inline overlay. The host must mark a positioned clipped application viewport with data-ui-application-viewport. No global Studio/body portal or global scroll lock.',
  ],
};
export const carouselDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.pattern.carousel',
  props: [
    { name: 'label', type: 'string', default: 'Gallery' },
    { name: 'slides', type: 'stringList', default: [] },
    { name: 'labels', type: 'stringList', default: [] },
    { name: 'images', type: 'boolean', default: false },
    { name: 'index', type: 'number', default: 0 },
    { name: 'loop', type: 'boolean', default: false },
  ],
  outputs: [{ name: 'indexChange', payload: 'number' }],
  slots: [],
  styleTargets: ['root', 'viewport', 'slide', 'controls', 'indicators'],
  inspectionLimits: [
    'Controlled image/text slides; bind indexChange to the same numeric state as index. No automatic rotation; vertical touch scrolling remains available.',
  ],
};
export const navigationDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.pattern.navigation',
  props: [
    { name: 'label', type: 'string', default: 'Main navigation' },
    { name: 'menuLabel', type: 'string', default: 'Menu' },
    { name: 'items', type: 'stringList', default: [] },
    { name: 'values', type: 'stringList', default: [] },
    { name: 'selected', type: 'string', default: '' },
  ],
  outputs: [{ name: 'activate', payload: 'string' }],
  slots: [],
  styleTargets: ['root', 'trigger', 'items', 'item'],
  inspectionLimits: [
    'Container-adaptive button navigation; activate must bind to a declared application action or selection state. Does not invent routes.',
  ],
};
export const filteredListDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.pattern.filtered-list',
  props: [
    { name: 'label', type: 'string', default: 'Searchable list' },
    { name: 'searchLabel', type: 'string', default: 'Search' },
    { name: 'emptyLabel', type: 'string', default: 'No matching items' },
    { name: 'items', type: 'stringList', default: [] },
    { name: 'query', type: 'string', default: '' },
  ],
  outputs: [
    { name: 'queryChange', payload: 'string' },
    { name: 'itemActivate', payload: 'string' },
  ],
  slots: [],
  styleTargets: ['root', 'search', 'items', 'item'],
};
export const firstVisitDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.pattern.first-visit',
  props: [
    { name: 'applicationId', type: 'string', default: '' },
    { name: 'campaignId', type: 'string', default: '' },
    { name: 'resetKey', type: 'string', default: '' },
    { name: 'scope', type: 'string', default: 'browser' },
    { name: 'dismissed', type: 'boolean', default: false },
    { name: 'dismissLabel', type: 'string', default: 'Dismiss' },
    { name: 'allowReopen', type: 'boolean', default: false },
    { name: 'reopenLabel', type: 'string', default: 'Show offer' },
  ],
  outputs: [
    { name: 'showChange', payload: 'boolean' },
    { name: 'memoryStatus', payload: 'string' },
    { name: 'dismissedChange', payload: 'boolean' },
  ],
  slots: ['body'],
  styleTargets: ['root', 'body', 'dismiss'],
  inspectionLimits: [
    'First unacknowledged visit per application/campaign/reset key. Dismissal is persisted in origin-scoped localStorage by default or sessionStorage when scope=session. Storage failure is reported; persistence is never claimed when unavailable. No cross-device visitor identity.',
  ],
};
const iconIdentityProps = [
  { name: 'iconPack', type: 'string', default: 'lucide' },
  { name: 'iconRevision', type: 'string', default: '1.27.0' },
] as const;
/** New identities retain every revision-1 contract/pin unchanged. */
export const navigationIconDescriptor: UiExtensionDescriptor = {
  ...navigationDescriptor,
  revision: '2',
  props: [
    ...navigationDescriptor.props,
    ...iconIdentityProps,
    { name: 'menuIcon', type: 'string', default: 'menu' },
    { name: 'icons', type: 'stringList', default: [] },
  ],
  slots: ['triggerIcon'],
  styleTargets: [...navigationDescriptor.styleTargets!, 'triggerIcon', 'itemIcon'],
  inspectionLimits: [
    ...navigationDescriptor.inspectionLimits!,
    'Icon names use the installed versioned media registry; triggerIcon can compose an authored supplied/custom Icon. Labels and activation values remain independent of decorative glyphs.',
  ],
};
export const carouselIconDescriptor: UiExtensionDescriptor = {
  ...carouselDescriptor,
  revision: '2',
  props: [
    ...carouselDescriptor.props,
    ...iconIdentityProps,
    { name: 'previousIcon', type: 'string', default: 'chevron-left' },
    { name: 'nextIcon', type: 'string', default: 'chevron-right' },
  ],
  slots: ['previousIcon', 'nextIcon'],
  styleTargets: [...carouselDescriptor.styleTargets!, 'previousIcon', 'nextIcon'],
};
export const filteredListIconDescriptor: UiExtensionDescriptor = {
  ...filteredListDescriptor,
  revision: '2',
  props: [
    ...filteredListDescriptor.props,
    ...iconIdentityProps,
    { name: 'searchIcon', type: 'string', default: 'search' },
  ],
  slots: ['searchIcon'],
  styleTargets: [...filteredListDescriptor.styleTargets!, 'searchIcon'],
};
export const actionButtonDescriptor: UiExtensionDescriptor = {
  ...identity,
  id: 'vict.pattern.action-button',
  props: [
    { name: 'label', type: 'string', default: 'Action' },
    { name: 'value', type: 'string', default: 'action' },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'iconOnly', type: 'boolean', default: false },
  ],
  outputs: [{ name: 'activate', payload: 'string' }],
  slots: ['icon', 'trailingIcon'],
  styleTargets: ['root', 'label', 'icon', 'trailingIcon'],
  inspectionLimits: [
    'Activation emits the declared string value; bind to real state or a declared application action. Label remains the accessible name for icon-only rendering. Icon slots accept noninteractive authored graphics, never nested buttons.',
  ],
};
export const firstVisitResetDescriptor: UiExtensionDescriptor = {
  ...firstVisitDescriptor,
  revision: '2',
  props: [
    ...firstVisitDescriptor.props,
    { name: 'allowReset', type: 'boolean', default: false },
    { name: 'resetLabel', type: 'string', default: 'Reset welcome' },
  ],
  styleTargets: [...firstVisitDescriptor.styleTargets!, 'reset'],
  inspectionLimits: [
    ...firstVisitDescriptor.inspectionLimits!,
    'Optional reset removes only the current application/campaign/resetKey entry in the selected storage scope. The reset control remains after dismissal. Successful reset shows content and emits dismissedChange=false and showChange=true. Storage failure reports unavailable without claiming a successful reset.',
  ],
};
export const patternAuthoringDescriptors = [
  drawerDescriptor,
  carouselDescriptor,
  navigationDescriptor,
  filteredListDescriptor,
  firstVisitDescriptor,
  navigationIconDescriptor,
  carouselIconDescriptor,
  filteredListIconDescriptor,
  actionButtonDescriptor,
  firstVisitResetDescriptor,
] as const;
