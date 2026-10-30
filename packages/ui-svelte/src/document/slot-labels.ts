import type { UiRenderInstruction } from '@victframework/ui';
import { evaluateComponentPropValues, resolveValue, type DocumentScope } from './logic.js';

/** Compatibility presentation for old documents that placed controls inside native trigger buttons.
 * Source is preserved; only the invalid nested control's label is presented. New edits are guarded.
 */
export function interactiveSlotLabels(
  slots: Readonly<Record<string, readonly UiRenderInstruction[]>>, scope: DocumentScope,
): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {};
  function inspect(node: UiRenderInstruction): { text: string; interactive: boolean } {
    if (node.kind === 'text') return { text: node.content.type === 'literal' ? node.content.value : String(resolveValue({type:'expression',expression:node.content.expression},scope)??''), interactive:false };
    let children: readonly UiRenderInstruction[] = [];
    let interactive = false;
    let label = '';
    if (node.kind === 'element') {
      children = node.children;
      interactive = ['button','a','input','select','textarea','summary'].includes(node.tag) || node.attributes.some(attribute=>['tabindex','contenteditable'].includes(attribute.name));
    } else if (node.kind === 'extension') {
      const values = evaluateComponentPropValues(node,scope).values;
      label = typeof values.label === 'string' ? values.label : '';
      interactive = /(?:button|link|input|select|checkbox|switch|toggle|menu|popover|dialog|tooltip|collapsible|combobox|slider|calendar)/i.test(node.extensionId);
      children = Object.values(node.slots??{}).flat();
    } else if (node.kind === 'component') children = [node.body];
    else if (node.kind === 'conditional') children = node.branches.flatMap(branch=>branch.children);
    else if (node.kind === 'slot') children = node.fallback;
    else if (node.kind === 'repeat') children = [node.template];
    else if (node.kind === 'unsupported') children = node.children;
    const nested = children.map(inspect);
    return {text:label || nested.map(item=>item.text).filter(Boolean).join(' '),interactive:interactive||nested.some(item=>item.interactive)};
  }
  for (const name of ['trigger','action','cancel']) {
    const items = (slots[name]??[]).map(inspect);
    if (items.some(item=>item.interactive)) labels[name] = items.map(item=>item.text).filter(Boolean).join(' ') || (name==='trigger'?'Open':name==='action'?'Confirm':'Cancel');
  }
  return labels;
}
