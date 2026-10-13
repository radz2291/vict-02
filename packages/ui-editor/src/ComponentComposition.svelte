<script lang="ts">
  import type { UiDocument, UiNode, UiExtensionDescriptor, UiEditCommand } from '@victframework/ui';
  import { compositionName } from './composition.js';
  import type { EditorLabels } from './inspector-ux.js';
  import type { TransactionDraft } from './commands.js';
  let { document, node, descriptor, onApply, labels = {} }: { document: UiDocument; node: Extract<UiNode, { kind: 'component' }>; descriptor: UiExtensionDescriptor; labels?: EditorLabels; onApply: (draft: TransactionDraft) => void } = $props();
  let choices = $state<Record<string, string>>({});
  let serial = 0;
  function fill(slot: string, children: readonly string[]): void {
    onApply({ requestId: `composition-${node.id}-${++serial}-${Date.now()}`, reason: `Compose ${slot}`,
      commands: [{ op: 'fillSlot', nodeId: node.id, slotName: slot, children }] });
  }
  function reorder(slot: string, index: number, delta: number): void {
    const children = [...(node.slots?.[slot]?.children ?? [])];
    const destination = index + delta;
    if (destination < 0 || destination >= children.length) return;
    const previous = children[index]!;
    children[index] = children[destination]!;
    children[destination] = previous;
    fill(slot, children);
  }
  function add(slot: string, selected: string): void {
    const commands: UiEditCommand[] = [];
    for (const owner of Object.values(document.nodes)) {
      if (owner.kind !== 'component') continue;
      for (const [name, fill] of Object.entries(owner.slots ?? {})) {
        if (fill.children.includes(selected)) commands.push({ op: 'fillSlot', nodeId: owner.id,
          slotName: name, children: fill.children.filter(id => id !== selected) });
      }
    }
    commands.push({ op: 'fillSlot', nodeId: node.id, slotName: slot,
      children: [...(node.slots?.[slot]?.children ?? []), selected] });
    onApply({ requestId: `composition-${node.id}-${++serial}-${Date.now()}`, reason: `Move content to ${slot}`, commands });
    choices[slot] = '';
  }
  const available = $derived.by(() => {
    // Component fills can move atomically with the frozen fillSlot command.
    // Other source parents retain their ownership; detached content can be reused.
    const unavailable = new Set<string>([node.id, document.root]);
    for (const owner of Object.values(document.nodes)) {
      if (owner.kind === 'element' || owner.kind === 'portal') owner.children?.forEach(id => unavailable.add(id));
      else if (owner.kind === 'repeat') unavailable.add(owner.templateRoot);
      else if (owner.kind === 'slot') owner.fallback?.forEach(id => unavailable.add(id));
      else if (owner.kind === 'conditional') owner.branches.forEach(branch => branch.children.forEach(id => unavailable.add(id)));
    }
    for (const definition of Object.values(document.componentDefinitions ?? {})) {
      unavailable.add(definition.root);
      Object.values(definition.slots ?? {}).forEach(slot => slot.fallback?.forEach(id => unavailable.add(id)));
    }
    return Object.values(document.nodes).filter(candidate => !unavailable.has(candidate.id) &&
      (candidate.kind === 'element' || candidate.kind === 'text' || candidate.kind === 'component'));
  });
</script>

{#if descriptor.slots?.length}
  <section aria-label="Component composition">
    <h3>Content composition</h3>
    <p>Slot content appears inside this component. Select its children in Layers to edit them.</p>
    {#each descriptor.slots as slot (slot)}
      {@const children = node.slots?.[slot]?.children ?? []}
      <div class="slot-fill">
        <h4>{slot}</h4>
        <ol>
          {#each children as id, index (`${id}-${index}`)}
            <li><span title={id}>{compositionName(document, id, labels)}</span>
              <div class="child-actions">
              <button type="button" aria-label={`Move ${compositionName(document, id, labels)} earlier in ${slot}`} disabled={index === 0} onclick={() => reorder(slot, index, -1)}>↑</button>
              <button type="button" aria-label={`Move ${compositionName(document, id, labels)} later in ${slot}`} disabled={index === children.length - 1} onclick={() => reorder(slot, index, 1)}>↓</button>
              <button class="remove" type="button" aria-label={`Remove ${compositionName(document, id, labels)} from ${slot}`} onclick={() => fill(slot, children.filter((_, position) => position !== index))}>Remove</button>
              </div>
            </li>
          {/each}
        </ol>
        {#if available.some(candidate => !children.includes(candidate.id))}
        <label>Add existing content
          <select aria-label={`${slot} content node`} bind:value={choices[slot]}>
            <option value="">Choose content…</option>
            {#each available.filter(candidate => !children.includes(candidate.id)) as candidate (candidate.id)}
              <option value={candidate.id}>{compositionName(document, candidate.id, labels)}</option>
            {/each}
          </select>
        </label>
        <button type="button" disabled={!choices[slot]} onclick={() => { const selected = choices[slot]; if (selected) add(slot, selected); }}>Add to {slot}</button>
        {:else}<p>Use Insert to add content to this slot.</p>{/if}
      </div>
    {/each}
  </section>
{/if}

<style>
  section {display:grid;gap:10px;padding:10px 14px;min-width:0;font:inherit;color:inherit;}
  h3,h4,p {margin:0;} h3 {font-size:12px;font-weight:600;} h4 {font-size:11px;font-weight:600;text-transform:capitalize;}
  p {color:var(--ui-editor-muted,#667085);font-size:11px;line-height:1.5;}
  .slot-fill {display:grid;gap:8px;padding:10px;border:1px solid var(--ui-editor-line,#d7dce5);border-radius:6px;background:var(--ui-editor-input,#fff);min-width:0;}
  ol {list-style:none;padding:0;margin:0;display:grid;gap:8px;}
  li {display:grid;gap:6px;min-width:0;padding-bottom:8px;border-bottom:1px solid var(--ui-editor-line,#d7dce5);}
  li span {overflow-wrap:anywhere;font-size:11px;line-height:1.5;}
  .child-actions {display:flex;gap:4px;}
  button,select {font:inherit;box-sizing:border-box;border:1px solid var(--ui-editor-line,#d7dce5);border-radius:4px;background:var(--ui-editor-input,#fff);color:inherit;padding:6px 8px;min-height:28px;}
  button {cursor:pointer;} button:disabled {opacity:.45;cursor:default;}
  .child-actions button {min-width:30px;} .remove {color:#a13c4b;margin-left:auto;}
  select {width:100%;min-width:0;} label {display:grid;gap:5px;font-size:11px;}
  :focus-visible {outline:2px solid var(--ui-editor-accent,#355cc9);outline-offset:2px;}
</style>
