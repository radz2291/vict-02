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
/** Complete examples belong in discoverable contracts, not only package README. */
export const mediaVectorExample={schema:'vict.vector@1',viewBox:'0 0 120 80',nodes:[{tag:'rect',attributes:{width:120,height:80,rx:12,fill:'#143d52'}},{tag:'circle',attributes:{cx:42,cy:40,r:25,fill:'#ff3d81'}},{tag:'path',attributes:{d:'M55 65 L80 15 L105 65 Z',fill:'#27d3b5'}}]};
const vectorExampleJson=JSON.stringify(mediaVectorExample);
const vectorGuidance=[
  'data is a JSON string, not SVG markup. Complete small valid multi-colour example: '+vectorExampleJson,
  'Grammar: {schema:"vict.vector@1",viewBox:"minX minY positiveWidth positiveHeight",nodes:[{tag,attributes?:{name:string|finiteNumber},children?:[node]}]}. Tags: g,path,rect,circle,ellipse,line,polyline,polygon,defs,linearGradient,radialGradient,stop,clipPath,mask. Use d for path geometry; rect x/y/width/height/rx/ry; circle cx/cy/r; ellipse cx/cy/rx/ry; line x1/y1/x2/y2; polygon/polyline points. groups accept children and transform. Fill/stroke/opacity and stroke-width/linecap/linejoin are explicit attributes; currentColor follows the surrounding theme, explicit brand colours remain unchanged.',
  'Gradients/clips/masks: place definitions inside a defs node, declare unique local id attributes, and reference them with fill:"url(#id)", clip-path:"url(#id)" or mask:"url(#id)". linearGradient accepts x1/y1/x2/y2 and stop children with offset and stop-color. IDs are namespaced per rendered occurrence. Never insert scripts, HTML, event attributes, style attributes, external resources or invented geometry keys. Up to500 nodes/depth16; agent prop strings are separately bounded by the tool schema.',
];
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
      'Media source props use an exact supplied HTTP(S) URL, same-origin absolute path, or asset:sha256:<full 64-character digest> from registry assets. The closed canonical registry does not declare MIME or prove bytes exist. Check real owner-supplied metadata; video source needs video, poster needs image, captions needs WebVTT, and vector/custom icon source needs a managed inert SVG. Do not invent image assets or assume an empty registry prevents URL images.',
      ...(['vict.media.vector','vict.media.icon'].includes(descriptor.id)?vectorGuidance:[]),
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
            : descriptor.id==='vict.media.vector'?{props:{data:{type:'literal',value:vectorExampleJson},label:{type:'literal',value:'Three-colour geometric mark'}}}:{}),
        },
      ],
    } as UiAuthoringFragment,
    ...(['vict.media.icon','vict.media.vector'].includes(descriptor.id)?{examples:[{root:'vector-example',nodes:[{id:'vector-example',kind:'component',definitionId:descriptor.id,revision:'1',props:{data:{type:'literal',value:vectorExampleJson},label:{type:'literal',value:'Three-colour geometric mark'},...(descriptor.id==='vict.media.icon'?{decorative:{type:'literal',value:false}}:{})}}]} as UiAuthoringFragment]}:{}),
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
