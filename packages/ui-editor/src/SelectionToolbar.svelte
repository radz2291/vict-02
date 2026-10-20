<script lang="ts">
  import type { UiDocument } from '@victframework/ui';
  import { compositionName, compositionParent } from './composition.js';
  import { setBaseStyle, type TransactionDraft } from './commands.js';
  import { editableStyle } from './inspector-ux.js';
  import { literalTextTarget } from './selection-tools.js';
  let { document, nodeId, onApply, onEdit, onDuplicate, onRemove, floating = false, showArrange = true, onInspect }: {
    document: UiDocument; nodeId?: string; onApply: (draft: TransactionDraft) => boolean;
    onEdit: () => void; onDuplicate: () => void; onRemove: () => void;
    floating?: boolean;
    showArrange?: boolean; onInspect?: () => void;
  } = $props();
  const node = $derived(nodeId ? document.nodes[nodeId] : undefined);
  const parent = $derived(nodeId ? compositionParent(document, nodeId) : undefined);
  const styleNode = $derived(node?.kind === 'text' && parent ? document.nodes[parent.nodeId] : node);
  const stylable = $derived(styleNode?.kind === 'element');
  const container = $derived(styleNode?.kind === 'element' && ['main', 'section', 'div', 'article', 'header', 'footer', 'aside', 'nav'].includes(styleNode.tag));
  const text = $derived(nodeId ? literalTextTarget(document, nodeId) : undefined);
  function value(property: string) {
    const value = styleNode ? editableStyle(document, styleNode.id, property) : undefined;
    return value?.type === 'text' ? value.value : '';
  }
  function style(property: string, text: string) {
    if (stylable && styleNode) onApply(setBaseStyle(document, { requestId: crypto.randomUUID(), nodeId: styleNode.id, property, value: text ? { type: 'text', value: text } : undefined }));
  }
  function direction(value: string) {
    if (!styleNode) return;
    const requestId = crypto.randomUUID();
    const commands = [['display', 'flex'], ['flex-direction', value]].flatMap(([property, value]) => setBaseStyle(document, { requestId, nodeId: styleNode!.id, property: property!, value: { type: 'text', value: value! } }).commands);
    onApply({ requestId, reason: 'Change layout direction', commands });
  }
  function reorder(delta: number) {
    if (!parent || !nodeId) return;
    onApply({ requestId: crypto.randomUUID(), reason: 'Reorder selection', commands: [{ op: 'move', nodeId, newParentId: parent.nodeId, slotName: parent.slotName, index: parent.children.indexOf(nodeId) + delta }] });
  }
</script>
<div class="selection-toolbar" class:floating aria-label="Selection tools">
  {#if !floating}<span class="selection-name" title="Formatting edits the base presentation. Use Inspector for responsive rules.">{nodeId ? compositionName(document, nodeId) : 'Select an element'}</span>{/if}
  {#if text}<button type="button" onclick={onEdit} title="Edit text · F2 or double-click">Edit text</button>{/if}
  {#if stylable}
    {#if !container}
    <label>Size<input aria-label="Font size" type="number" min="6" max="240" value={parseFloat(value('font-size')) || ''} placeholder="Auto" onchange={event => style('font-size', event.currentTarget.value ? `${event.currentTarget.value}px` : '')} /></label>
    <button type="button" aria-label="Bold" aria-pressed={['600', '700', 'bold'].includes(value('font-weight'))} onclick={() => style('font-weight', ['600', '700', 'bold'].includes(value('font-weight')) ? '400' : '700')}><b>B</b></button>
    <label>Align<select aria-label="Text alignment" value={value('text-align') || 'start'} onchange={event => style('text-align', event.currentTarget.value)}><option value="start">Left</option><option value="center">Center</option><option value="end">Right</option></select></label>
    <label title="Text color">Color<input aria-label="Text color" type="color" value={/^#[\da-f]{6}$/i.test(value('color')) ? value('color') : '#263246'} onchange={event => style('color', event.currentTarget.value)} /></label>
    {:else}
      <label>Flow<select aria-label="Layout direction" value={value('flex-direction') || 'column'} onchange={event => direction(event.currentTarget.value)}><option value="column">Vertical</option><option value="row">Horizontal</option></select></label>
      <label>Gap<input aria-label="Layout gap" type="number" min="0" max="200" value={parseFloat(value('gap')) || 0} onchange={event => style('gap', `${event.currentTarget.value}px`)} /></label>
      <label>Padding<input aria-label="Container padding" type="number" min="0" max="200" value={parseFloat(value('padding')) || 0} onchange={event => style('padding', `${event.currentTarget.value}px`)} /></label>
      <label>Fill<input aria-label="Container fill" type="color" value={/^#[\da-f]{6}$/i.test(value('background-color')) ? value('background-color') : '#ffffff'} onchange={event => style('background-color', event.currentTarget.value)} /></label>
    {/if}
  {/if}
  {#snippet arrangement()}
  <button type="button" aria-label="Move earlier" disabled={!parent || !nodeId || parent.children.indexOf(nodeId) < 1} onclick={() => reorder(-1)} title="Move earlier · Alt+↑">↑</button>
  <button type="button" aria-label="Move later" disabled={!parent || !nodeId || parent.children.indexOf(nodeId) >= parent.children.length - 1} onclick={() => reorder(1)} title="Move later · Alt+↓">↓</button>
  <button type="button" disabled={!parent} onclick={onDuplicate} title="Duplicate · Ctrl+D">Duplicate</button>
  <button type="button" disabled={!parent} onclick={onRemove} title="Delete selection · Delete">Delete</button>
  {/snippet}
  {#if onInspect}<button type="button" onclick={onInspect}>Properties…</button>{/if}
  {#if showArrange}{#if floating}<details><summary aria-label="More selection tools">More</summary><div class="more-tools">{@render arrangement()}</div></details>{:else}<span class="spacer"></span>{@render arrangement()}{/if}{/if}
</div>
<style>
  .selection-toolbar { display:flex; align-items:center; gap:5px; padding:5px 10px; min-height:38px; border-bottom:1px solid #dce2eb; background:#fff; overflow-x:auto; flex-shrink:0; font:11px/1.4 system-ui,sans-serif; color:#536176; }
  .selection-name { max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:7px; font-weight:600; }
  label { display:flex; align-items:center; gap:4px; white-space:nowrap; }
  button,input,select { font:inherit; color:#34425a; background:#fff; border:1px solid #dce2eb; border-radius:4px; height:27px; padding:3px 6px; }
  button { cursor:pointer; white-space:nowrap; } button:hover,button[aria-pressed=true] { background:#edf1ff; color:#405abd; } button:disabled { opacity:.35; }
  input[type=number] { width:52px; } input[type=color] { width:27px; padding:2px; } .spacer { flex:1; }
  :focus-visible { outline:2px solid #5269bd; outline-offset:1px; }
  .floating { flex-wrap:wrap; overflow:visible; border:0; border-radius:8px; padding:6px; min-height:0; gap:5px; }
  .floating, .floating * { box-sizing:border-box; }
  details { position:relative; } summary { cursor:pointer; padding:6px; color:#5269bd; font-size:11px; }
  .more-tools { display:flex; flex-wrap:wrap; gap:4px; padding-top:5px; }
</style>
