import type { UiAuthoringPackage, UiAuthoringFragment } from '@victframework/ui';
import { mediaAuthoringDescriptors } from './descriptors.js';
import compatibility from './compatibility.json' with { type: 'json' };
export * from './descriptors.js';
export * from './implementations.js';
const labels = [
  'Image',
  'Video player',
  'Provider video embed',
  'Supplied or custom icon',
  'Editable vector graphic',
  'Media library',
];
const categories = ['image', 'video', 'embed', 'icon', 'vector', 'assets'];
export const mediaAuthoringPackage: UiAuthoringPackage = {
  schema: 'vict.ui-authoring@1',
  packageName: '@victframework/ui-media-svelte',
  packageVersion: '0.4.0-rc.1',
  compatibility,
  registrations: mediaAuthoringDescriptors.map((descriptor, index) => ({
    descriptor,
    label: labels[index]!,
    family: 'media',
    category: categories[index]!,
    purpose: `${labels[index]} through a reusable registered media capability.`,
    eligibility: { kind: 'standalone' },
    rules:
      descriptor.id === 'vict.media.asset-library'
        ? [
            {
              kind: 'hostRequirement',
              capability: 'media.asset-store@1',
              reason:
                'Owner-supplied bytes live outside canonical source, in an explicit application asset store.',
            },
          ]
        : [],
    guidance: [
      ...(descriptor.inspectionLimits ?? []),
      'Root and listed semantic parts are explicit style targets. Keep application labels, focus and button behavior when composing icons. Use canonical props/bindings; source presence alone is not loading/playback or interaction proof.',
    ],
    seed: {
      root: 'media',
      nodes: [
        {
          id: 'media',
          kind: 'component',
          definitionId: descriptor.id,
          revision: '1',
          ...(descriptor.id === 'vict.media.icon'
            ? { props: { name: { type: 'literal', value: 'search' } } }
            : {}),
        },
      ],
    } as UiAuthoringFragment,
  })),
  exportDispositions: [
    {
      name: 'AssetProvider',
      disposition: 'host-only',
      reason:
        'The consuming app supplies the explicit asset namespace/store and embed provider configuration.',
    },
    {
      name: 'createIconRegistry',
      disposition: 'host-only',
      reason:
        'Registry metadata search and custom inert pack registration support the agent-facing icon component.',
    },
    {
      name: 'asset archives',
      disposition: 'host-only',
      reason:
        'Explicit import/export moves bytes alongside canonical source without embedding binaries in it.',
    },
  ],
};
