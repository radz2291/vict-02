import type { UiDocument } from '@victframework/ui';
import { compositionNames } from '@victframework/ui-editor';

export const readableName = (value: string) => value.replace(/^vict\.catalog\./, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_.]/g, ' ').replace(/^./, first => first.toUpperCase());

/** Designer labels only: no edits to canonical tags, ids, bindings or values. */
export function studioNodeLabels(document: UiDocument): Record<string, string> {
  const text = (id: string) => {
    const node = document.nodes[id];
    return node?.kind === 'text' && node.content.type === 'literal' && typeof node.content.value === 'string' ? node.content.value.trim() : '';
  };
  const labels: Record<string, string> = {};
  const baseNames = compositionNames(document);
  const fieldLabels = new Map<string, string>();
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'element' && node.tag === 'label' && typeof node.attributes?.for === 'string') {
      const name = node.children.map(text).filter(Boolean).join(' ');
      if (name) fieldLabels.set(node.attributes.for, name);
    }
  }
  for (const node of Object.values(document.nodes)) {
    let label = baseNames.get(node.id) ?? 'Element';
    // Text leaves have their own label so hidden text does not add spurious
    // duplicate ordinals to its heading, paragraph or associated field.
    if(node.kind==='text')label=node.content.type==='literal'?`Text · ${node.content.value || 'Empty'}`:'Connected text';
    if (node.kind === 'element' && !node.attributes?.['aria-label']) {
      const content = node.children.map(text).filter(Boolean).join(' ');
      const semantic = ({label:'Label',select:'Select',option:'Option',textarea:'Text area',h4:'Heading',h5:'Heading',h6:'Heading',header:'Header',footer:'Footer',aside:'Aside'} as Record<string,string>)[node.tag];
      if (semantic) label = content ? `${semantic} · ${content}` : semantic;
      if (/^(h[1-6]|p)$/.test(node.tag) && content) label = content;
      const identity = typeof node.attributes?.id === 'string' ? node.attributes.id : node.id;
      const linked = fieldLabels.get(identity);
      if (linked && ['input','select','textarea'].includes(node.tag)) label = linked;
    }
    labels[node.id] = label;
  }
  return labels;
}

export const studioStateLabels:Readonly<Record<string,string>>={message:'Message',accepted:'Agreement',dialogOpen:'Dialog open',busy:'Submitting',actionError:'Action error',actionResult:'Action result'};
export const studioActionLabels:Readonly<Record<string,string>>={'demo.submit':'Submit'};
export function studioDisplayName(kind:string,id:string):string {
 return (kind==='state'?studioStateLabels[id]:kind==='action'?studioActionLabels[id]:undefined)??readableName(id);
}
/** Generated style names describe their actual owner and pseudo-state, never an ID suffix. */
export function studioStyleName(document:UiDocument,id:string):string {
 const style=document.styleSources[id];
 if(!style||!id.startsWith('src.'))return readableName(id);
 const owners=Object.values(document.nodes).filter(node=>node.styleSources?.includes(id));
 if(!owners.length)return readableName(id);
 const names=studioNodeLabels(document),owner=owners.length===1?names[owners[0]!.id]??'Object':'Shared';
 const state=style.pseudo?readableName(style.pseudo):style.conditionId?readableName(style.conditionId):'Base';
 return `${owner} · ${state} style`;
}
