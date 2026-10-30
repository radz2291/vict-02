import type {UiNode,UiRenderInstruction} from '@victframework/ui';

/** Editor presentation only. No icon is inferred from labels or component IDs. */
export const sourceIconPaths = {
 container:'M2 3h12v10H2z M2 6h12 M6 6v7',
 heading:'M4 3v10 M12 3v10 M4 8h8',
 text:'M3 4h10 M8 4v9 M5 13h6',
 input:'M2 4h12v8H2z M5 6v4',
 checkbox:'M3 3h10v10H3z M5 8l2 2 4-4',
 radio:'M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12 M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
 button:'M3 4h10l1 1v6l-1 1H3l-1-1V5z M5 8h6',
 select:'M2 4h12v8H2z M9 7l2 2 2-2',
 link:'M6 5H5a3 3 0 0 0 0 6h1 M10 5h1a3 3 0 0 1 0 6h-1 M5 8h6',
 image:'M2 3h12v10H2z M2 11l4-4 3 3 2-2 3 3 M10 5h.01',
 list:'M2 4h1 M5 4h9 M2 8h1 M5 8h9 M2 12h1 M5 12h9',
 table:'M2 3h12v10H2z M2 6h12 M6 3v10 M10 3v10 M2 10h12',
 component:'M8 2l6 6-6 6-6-6z',
 composition:'M2 4h5l2 2h5v7H2z',
 repeat:'M3 6V3h10l-2-2 M13 10v3H3l2 2 M13 3v4 M3 13V9',
 conditional:'M8 2l4 4-4 4-4-4z M8 10v4 M4 6H2v7 M12 6h2v7',
 slot:'M2 3h4 M10 3h4v10h-4 M6 13H2V3 M6 8h4 M8 6v4',
 portal:'M6 2H2v12h4 M8 8h6 M11 5l3 3-3 3',
 state:'M3 4c0-3 10-3 10 0s-10 3-10 0v8c0 3 10 3 10 0V4 M3 8c0 3 10 3 10 0',
 action:'M9 1L3 9h4l-1 6 7-9H9z',
 catalog:'M2 2h5v5H2z M9 2h5v5H9z M2 9h5v5H2z M9 9h5v5H9z',
 route:'M2 13V4h11 M10 1l3 3-3 3',
 reference:'M6 5H5a3 3 0 0 0 0 6h1 M10 5h1a3 3 0 0 1 0 6h-1 M5 8h6',
 style:'M3 3h10v3H3z M5 6v3h3v5 M8 9h3V6',
 token:'M2 3h7l5 5-6 6-6-6z M5 6h.01',
 asset:'M3 2h6l4 4v8H3z M9 2v4h4',
} as const;
export type SourceIconKey = keyof typeof sourceIconPaths;

/** Exact authored source is the authority; opaque components stay components. */
export function sourceIcon(node:UiNode|undefined, instruction?:Pick<UiRenderInstruction,'kind'> & {tag?:string}):SourceIconKey {
 const kind=node?.kind??instruction?.kind;
 if(kind==='text')return 'text';
 if(kind!=='element'){const structural:Readonly<Record<string,SourceIconKey>>={component:'component',extension:'component',repeat:'repeat',conditional:'conditional',slot:'slot',portal:'portal'};return structural[kind??'']??'container';}
 const tag=(node?.kind==='element'?node.tag:instruction?.tag??'').toLowerCase();
 if(/^h[1-6]$/.test(tag))return 'heading';
 if(tag==='input')return node?.kind==='element'&&node.attributes?.type==='checkbox'?'checkbox':node?.kind==='element'&&node.attributes?.type==='radio'?'radio':'input';
 const tags:Readonly<Record<string,SourceIconKey>>={textarea:'input',button:'button',select:'select',option:'select',p:'text',span:'text',label:'text',a:'link',img:'image',ul:'list',ol:'list',li:'list',table:'table'};
 return tags[tag]??'container';
}
