/** Host HTML composition restriction; source and runtime semantics are unchanged. */
import type { UiDocument } from '@victframework/ui';
import { compositionChildren } from './composition.js';
const buttons = new Set(['button','checkbox','switch','select','select-multiple','combobox','combobox-multiple','toggle','toolbar-button','navigation-menu.link']);
const wrappers = new Set(['dialog','alert-dialog','popover','tooltip','link-preview','dropdown-menu','context-menu','menubar.menu','collapsible','accordion-item','tabs-trigger']);
export function interactiveSlotConflicts(document: UiDocument): readonly { id:string; nodeId:string; parentId:string; slot:string }[] {
 const issues: {id:string;nodeId:string;parentId:string;slot:string}[] = [];
 for (const parent of Object.values(document.nodes)) {
  if (parent.kind !== 'component' || !wrappers.has(parent.definitionId.replace('vict.catalog.',''))) continue;
  for (const [slot,fill] of Object.entries(parent.slots ?? {})) {
   if (!['trigger','action','cancel'].includes(slot)) continue;
   const seen = new Set<string>();
   const visit = (id:string):void => {
    if (seen.has(id)) return; seen.add(id); const node = document.nodes[id]; if (!node) return;
    const interactive = node.kind === 'element' ? ['button','a','input','select','textarea','summary'].includes(node.tag) : node.kind === 'component' && buttons.has(node.definitionId.replace('vict.catalog.',''));
    if (interactive) issues.push({id:JSON.stringify([parent.id,slot,id]),nodeId:id,parentId:parent.id,slot});
    compositionChildren(node).forEach(visit);
   };
   fill.children.forEach(visit);
  }
 }
 return issues;
}
