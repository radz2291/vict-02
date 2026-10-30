import type {
  UiAuthoringPackage,
  UiAuthoringFragment,
  UiExtensionDescriptor,
} from '@victframework/ui';
import { patternAuthoringDescriptors } from './descriptors.js';
import compatibility from './compatibility.json' with { type: 'json' };
const snippets: Record<
  string,
  { label: string; purpose: string; guidance: string[]; seed: UiAuthoringFragment }
> = {
  'vict.pattern.drawer': {
    label: 'Drawer / sheet',
    purpose:
      'Controlled in-application overlay with authored trigger, body and footer; focus and dismissal stay inside its application viewport.',
    guidance: [
      'Bind open and openChange to the same boolean local state. Put noninteractive text/icon content in trigger; do not nest a button inside a button. Body/footer accept normal authored components.',
      'Choose left/right/top/bottom, size in CSS pixels, and showTrigger=false only for deliberate externally controlled entry. No incidental launcher is inserted when disabled.',
      'Host must establish a positioned clipped application viewport. Test actual opened state, Tab/Shift+Tab, Escape, backdrop dismissal, scroll containment and focus return.',
    ],
    seed: {
      root: 'drawer',
      nodes: [
        {
          kind: 'component',
          id: 'drawer',
          definitionId: 'vict.pattern.drawer',
          revision: '1',
          props: { open: { type: 'ref', path: 'state.drawerOpen' } },
          outputs: { openChange: { setState: { key: 'drawerOpen' } } },
          slots: { body: { name: 'body', children: ['body'] } },
        },
        { kind: 'element', id: 'body', tag: 'p', children: ['text'] },
        { kind: 'text', id: 'text', content: { type: 'literal', value: 'Drawer content' } },
      ],
      localState: { drawerOpen: { key: 'drawerOpen', type: 'boolean', initial: false } },
    },
  },
  'vict.pattern.carousel': {
    label: 'Carousel',
    purpose:
      'Real controlled slide navigation with previous/next, indicators, keyboard buttons and horizontal pointer swipe.',
    guidance: [
      'Bind index and indexChange to the same numeric local state. slides is a stringList of managed asset references or supported image URLs when images=true, otherwise text. labels supplies image alternative text. Image slides use the shared media resolver and require the same application asset host as other managed images.',
      'Default no auto-rotation and no looping. Swipe changes slides only when clearly horizontal; vertical scroll stays native. Empty slides show an honest empty state.',
      'A carousel is distinct from tabs. Test first/last boundaries, swipe, keyboard activation, alt text and responsive sizing.',
    ],
    seed: {
      root: 'carousel',
      nodes: [
        {
          kind: 'component',
          id: 'carousel',
          definitionId: 'vict.pattern.carousel',
          revision: '1',
          props: {
            slides: { type: 'ref', path: 'state.slides' },
            index: { type: 'ref', path: 'state.slideIndex' },
          },
          outputs: { indexChange: { setState: { key: 'slideIndex' } } },
        },
      ],
      localState: {
        slides: {
          key: 'slides',
          type: 'stringList',
          initial: ['First slide', 'Second slide', 'Third slide'],
        },
        slideIndex: { key: 'slideIndex', type: 'number', initial: 0 },
      },
    },
  },
  'vict.pattern.navigation': {
    label: 'Adaptive navigation',
    purpose:
      'Real accessible navigation controls that collapse by container width and emit selected route/action identities.',
    guidance: [
      'items is visible labels; values is matching application-owned identities, falling back to labels. Bind activate to selected state or a declared application action. Merely rendering labels is not route wiring.',
      'The same controls adapt below 36rem container width. Active selection is supplied through selected; resizing must preserve application selection and drafts.',
    ],
    seed: {
      root: 'navigation',
      nodes: [
        {
          kind: 'component',
          id: 'navigation',
          definitionId: 'vict.pattern.navigation',
          revision: '1',
          props: {
            items: { type: 'ref', path: 'state.navItems' },
            selected: { type: 'ref', path: 'state.navSelection' },
          },
          outputs: { activate: { setState: { key: 'navSelection' } } },
        },
      ],
      localState: {
        navItems: {
          key: 'navItems',
          type: 'stringList',
          initial: ['Home', 'Messages', 'Settings'],
        },
        navSelection: { key: 'navSelection', type: 'string', initial: 'Home' },
      },
    },
  },
  'vict.pattern.filtered-list': {
    label: 'Filtered list',
    purpose:
      'Search input actually filters application-provided labels and emits useful selection output.',
    guidance: [
      'Bind query and queryChange to one string state; items is a stringList. All query words match case-insensitively. itemActivate emits the selected complete item; bind a real state/action outcome.',
      'This bounded client presentation handles up to 1000 items, not remote query pagination. Empty and no-results states are distinct.',
    ],
    seed: {
      root: 'list',
      nodes: [
        {
          kind: 'component',
          id: 'list',
          definitionId: 'vict.pattern.filtered-list',
          revision: '1',
          props: {
            items: { type: 'ref', path: 'state.listItems' },
            query: { type: 'ref', path: 'state.listQuery' },
          },
          outputs: {
            queryChange: { setState: { key: 'listQuery' } },
            itemActivate: { setState: { key: 'selectedItem' } },
          },
        },
      ],
      localState: {
        listItems: {
          key: 'listItems',
          type: 'stringList',
          initial: ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson'],
        },
        listQuery: { key: 'listQuery', type: 'string', initial: '' },
        selectedItem: { key: 'selectedItem', type: 'string', initial: '' },
      },
    },
  },
  'vict.pattern.first-visit': {
    label: 'First-visit campaign',
    purpose:
      'Explicit per-application/campaign acknowledgement with durable browser or session memory and declared visibility output.',
    guidance: [
      'applicationId and campaignId are required app-owned identities. Default scope=browser persists acknowledgement in this origin until the app changes resetKey or explicitly clears the campaign with the public helper. scope=session lasts in sessionStorage. No cross-device identity or browser-wide identity is implied.',
      'First visit means first unacknowledged visit; dismissal writes memory. allowReopen=false inserts no incidental re-open launcher. Opt in deliberately if desired.',
      'Body is content, not a modal by itself. Use showChange to control an actual drawer/dialog if a popup is intended. Its close action can set dismissed=true to acknowledge this campaign; the built-in Dismiss emits dismissedChange=true. memoryStatus reports ready/unavailable/invalid; unavailable storage means persistence cannot be promised. Test reload/new session/reset/storage denial independently.',
    ],
    seed: {
      root: 'visit',
      nodes: [
        {
          kind: 'component',
          id: 'visit',
          definitionId: 'vict.pattern.first-visit',
          revision: '1',
          props: {
            applicationId: { type: 'literal', value: 'my-application' },
            campaignId: { type: 'literal', value: 'welcome-v1' },
          },
          slots: { body: { name: 'body', children: ['welcome'] } },
        },
        {
          kind: 'text',
          id: 'welcome',
          content: { type: 'literal', value: 'Welcome to this application.' },
        },
      ],
    },
  },
};
snippets['vict.pattern.action-button'] = {
  label: 'Action button with icons',
  purpose:
    'A real accessible button with composable supplied/custom icon slots and typed application activation.',
  guidance: [
    'Keep label meaningful even when iconOnly=true; the glyph is decorative and never replaces the accessible name.',
    'Compose noninteractive vict.media.icon or vector content in icon/trailingIcon slots. Bind activate to selected state or a declared action with exact typed input; source presence alone is not execution evidence.',
    'disabled uses the native button disabled state and prevents activation. The component never submits a form implicitly.',
  ],
  seed: {
    root: 'action',
    nodes: [
      {
        kind: 'component',
        id: 'action',
        definitionId: 'vict.pattern.action-button',
        revision: '1',
        props: {
          label: { type: 'literal', value: 'Send message' },
          value: { type: 'literal', value: 'send' },
        },
        slots: { icon: { name: 'icon', children: ['actionIcon'] } },
        outputs: { activate: { setState: { key: 'lastAction' } } },
      },
      {
        kind: 'component',
        id: 'actionIcon',
        definitionId: 'vict.media.icon',
        revision: '1',
        props: {
          name: { type: 'literal', value: 'send' },
          decorative: { type: 'literal', value: true },
        },
      },
    ],
    localState: { lastAction: { key: 'lastAction', type: 'string', initial: '' } },
  },
};
function fragmentFor(descriptor: UiExtensionDescriptor): UiAuthoringFragment {
  const original = snippets[descriptor.id]!.seed;
  const fragment: UiAuthoringFragment = {
    ...original,
    nodes: original.nodes.map((node) =>
      node.id === original.root && node.kind === 'component'
        ? { ...node, revision: descriptor.revision }
        : node,
    ),
  };
  if (descriptor.id === 'vict.pattern.first-visit' && descriptor.revision === '2') {
    return {...fragment, nodes: fragment.nodes.map(node => node.id === fragment.root && node.kind === 'component'
      ? {...node, props: {...node.props, allowReset: {type: 'literal', value: true}, resetLabel: {type: 'literal', value: 'Reset welcome'}}}
      : node)};
  }
  if (descriptor.id !== 'vict.pattern.navigation' || descriptor.revision !== '2') return fragment;
  return {
    ...fragment,
    localState: {
      ...fragment.localState,
      navIcons: {
        key: 'navIcons',
        type: 'stringList',
        initial: ['home', 'message-circle', 'settings'],
      },
    },
    nodes: fragment.nodes.map((node) =>
      node.id === fragment.root && node.kind === 'component'
        ? { ...node, props: { ...node.props, icons: { type: 'ref', path: 'state.navIcons' } } }
        : node,
    ),
  };
}
export const patternAuthoringPackage: UiAuthoringPackage = {
  schema: 'vict.ui-authoring@1',
  packageName: '@victframework/ui-patterns-svelte',
  packageVersion: '0.4.0-rc.1',
  compatibility,
  registrations: patternAuthoringDescriptors.map((descriptor) => ({
    descriptor,
    ...snippets[descriptor.id]!,
    family: 'application-patterns',
    category: 'interactive',
    eligibility: { kind: 'standalone' as const },
    seed: fragmentFor(descriptor),
    examples: [fragmentFor(descriptor)],
    ...((descriptor.revision === '2' && ['vict.pattern.navigation', 'vict.pattern.carousel', 'vict.pattern.filtered-list'].includes(descriptor.id)) || descriptor.id === 'vict.pattern.action-button'
      ? {
          dependencies: [{ id: 'vict.media.icon', revision: '1' }],
          guidance: [
            ...snippets[descriptor.id]!.guidance,
            'Supplied icon names resolve through the installed media registry and its compact searchable manifest; custom authored Icons can replace glyph slots. Normal labels, controls and typed action/state bindings remain.',
          ],
        }
      : {}),
    ...(descriptor.id === 'vict.pattern.first-visit' && descriptor.revision === '2' ? {
      guidance: [...snippets[descriptor.id]!.guidance,
        'Revision 2 optionally enables allowReset and resetLabel. Its shared reset button stays available after dismissal and removes only this applicationId/campaignId/resetKey entry in the selected scope. Reset shows the body and emits dismissedChange=false and showChange=true; bind dismissedChange back to dismissed when controlling it. It does not clear any other application or campaign memory. Reset failures report unavailable and do not claim success. Reopening alone does not reset memory. Repeat dismissal/reset/reload using the same identities to verify genuine first-visit persistence.'],
    } : {}),
    rules:
      descriptor.id === 'vict.pattern.drawer'
        ? [{ kind: 'controlledPair' as const, prop: 'open', output: 'openChange', required: true }]
        : descriptor.id === 'vict.pattern.carousel'
          ? [
              {
                kind: 'controlledPair' as const,
                prop: 'index',
                output: 'indexChange',
                required: true,
              },
            ]
          : descriptor.id === 'vict.pattern.filtered-list'
            ? [
                {
                  kind: 'controlledPair' as const,
                  prop: 'query',
                  output: 'queryChange',
                  required: true,
                },
              ]
            : [],
  })),
  exportDispositions: [
    {
      name: './authoring',
      disposition: 'registered',
      reason:
        'Exact versioned scalar/list component ABI contracts with shared public implementations.',
    },
    {
      name: '.',
      disposition: 'host-only',
      reason:
        'Components and pure state/storage helpers for coded consumers; authoring uses installed exact descriptors.',
    },
  ],
};
