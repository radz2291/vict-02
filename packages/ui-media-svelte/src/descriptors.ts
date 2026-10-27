import type { UiExtensionDescriptor } from '@victframework/ui';
const base = {
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  rendererImplementationId: 'vict.svelte.media.authoring',
  slots: [],
} as const;
export const mediaImageDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.media.image',
  styleTargets: ['root', 'image', 'caption'],
  props: [
    { name: 'source', type: 'string', default: '' },
    { name: 'alt', type: 'string', default: '' },
    { name: 'fit', type: 'string', default: 'cover' },
    { name: 'aspectRatio', type: 'string', default: 'auto' },
    { name: 'caption', type: 'string', default: '' },
    { name: 'eager', type: 'boolean', default: false },
  ],
  outputs: [
    { name: 'loaded', payload: 'void' },
    { name: 'failed', payload: 'string' },
  ],
  inspectionLimits: [
    'Managed references require an asset host; external supplied URLs load in the browser. Actual image loading is distinct from source presence.',
  ],
};
export const mediaVideoDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.media.video',
  styleTargets: ['root', 'player', 'caption'],
  props: [
    { name: 'source', type: 'string', default: '' },
    { name: 'poster', type: 'string', default: '' },
    { name: 'captions', type: 'string', default: '' },
    { name: 'language', type: 'string', default: 'en' },
    { name: 'captionLabel', type: 'string', default: 'Captions' },
    { name: 'label', type: 'string', default: 'Video' },
    { name: 'caption', type: 'string', default: '' },
  ],
  outputs: [
    { name: 'playing', payload: 'boolean' },
    { name: 'ended', payload: 'void' },
    { name: 'failed', payload: 'string' },
  ],
  inspectionLimits: [
    'Native controls and playsinline. No implicit autoplay. Codec support and playback/captions require actual browser exercise; a screenshot does not prove them.',
  ],
};
export const mediaEmbedDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.media.embed',
  styleTargets: ['root', 'frame'],
  props: [
    { name: 'provider', type: 'string', default: 'youtube' },
    { name: 'videoId', type: 'string', default: '' },
    { name: 'title', type: 'string', default: 'Embedded video' },
  ],
  outputs: [],
  inspectionLimits: [
    'Only youtube and vimeo identities are supported; the application host must explicitly enable providers. No arbitrary iframe HTML/URL. Cross-origin frame pixels and playback are not guaranteed observable.',
  ],
};
export const mediaIconDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.media.icon',
  styleTargets: ['root'],
  props: [
    { name: 'pack', type: 'string', default: 'lucide' },
    { name: 'name', type: 'string', default: 'circle-help' },
    { name: 'revision', type: 'string', default: '1.27.0' },
    { name: 'size', type: 'number', default: 20 },
    { name: 'strokeWidth', type: 'number', default: 1.75 },
    { name: 'decorative', type: 'boolean', default: true },
    { name: 'label', type: 'string', default: '' },
    { name: 'source', type: 'string', default: '' },
    { name: 'data', type: 'string', default: '' },
  ],
  outputs: [],
  inspectionLimits: [
    'A bounded supplied Lucide manifest is installed; discover exact pack/name/revision. Custom icons accept a managed inert SVG source or vict.vector@1 JSON data. Decorative icons need a separately labelled control; meaningful icons require label.',
  ],
};
export const mediaVectorDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.media.vector',
  styleTargets: ['root'],
  props: [
    { name: 'data', type: 'string', default: '' },
    { name: 'source', type: 'string', default: '' },
    { name: 'label', type: 'string', default: 'Vector graphic' },
    { name: 'decorative', type: 'boolean', default: false },
  ],
  outputs: [],
  inspectionLimits: [
    'Editable data is a validated vict.vector@1 JSON string. A managed inert SVG source is an alternative; data takes precedence. Supports paths/shapes/groups/transforms/gradients/clips/masks with local references, no scripts/HTML/external resources.',
  ],
};
export const mediaAssetLibraryDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.media.asset-library',
  styleTargets: ['root', 'toolbar', 'list'],
  props: [{ name: 'label', type: 'string', default: 'Media library' }],
  outputs: [
    {
      name: 'selectedAsset',
      payload: 'string',
      description:
        'Stable asset:sha256 reference for an explicitly selected/imported asset. Bind to the source state of image/video/vector/icon.',
    },
  ],
  inspectionLimits: [
    'Owner file input/import/export only; no automatic search, paid acquisition or remote ingestion. Origin-local bytes require explicit archive export/import for portability. Removal can leave authored references unresolved.',
  ],
};
export const mediaAuthoringDescriptors = [
  mediaImageDescriptor,
  mediaVideoDescriptor,
  mediaEmbedDescriptor,
  mediaIconDescriptor,
  mediaVectorDescriptor,
  mediaAssetLibraryDescriptor,
] as const;
