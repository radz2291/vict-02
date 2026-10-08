<script lang="ts">
  import type { UiDocument, UiNode, UiExtensionDescriptor } from '@victframework/ui';
  import type { TransactionDraft } from './commands.js';
  let { document, node, descriptor, onApply }: { document: UiDocument; node: Extract<UiNode, { kind: 'component' }>; descriptor: UiExtensionDescriptor; onApply: (draft: TransactionDraft) => void } = $props();
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
    [children[index], children[destination]] = [children[destination], children[index]];
    fill(slot, children);
  }
  const available = $derived(Object.values(document.nodes).filter(candidate => candidate.id !== node.id &&
    (candidate.kind === 'element' || candidate.kind === 'text' || candidate.kind === 'component')));
</script>

{#if descriptor.slots?.length}
  <section aria-label="Component composition">
    <h3>Content composition</h3>
    <p>Slot fills are canonical source. Select their children in Layers to edit properties, text and connections.</p>
    {#each descriptor.slots as slot (slot)}
      {@const children = node.slots?.[slot]?.children ?? []}
      <div class="slot-fill">
        <strong>{slot}</strong>
        <ol>
          {#each children as id, index (`${id}-${index}`)}
            <li><span>{id}</span>
              <button type="button" aria-label={`Move ${id} earlier in ${slot}`} disabled={index === 0} onclick={() => reorder(slot, index, -1)}>↑</button>
              <button type="button" aria-label={`Move ${id} later in ${slot}`} disabled={index === children.length - 1} onclick={() => reorder(slot, index, 1)}>↓</button>
              <button type="button" aria-label={`Remove ${id} from ${slot}`} onclick={() => fill(slot, children.filter((_, position) => position !== index))}>Remove</button>
            </li>
          {/each}
        </ol>
        <label>Add authored content to {slot}
          <select aria-label={`${slot} content node`} bind:value={choices[slot]}>
            <option value="">Choose a source node…</option>
            {#each available.filter(candidate => !children.includes(candidate.id)) as candidate (candidate.id)}
              <option value={candidate.id}>{candidate.id} ({candidate.kind})</option>
            {/each}
          </select>
        </label>
        <button type="button" disabled={!choices[slot]} onclick={() => { fill(slot, [...children, choices[slot]]); choices[slot] = ''; }}>Add to {slot}</button>
      </div>
    {/each}
  </section>
{/if}

<style>
  section { display: grid; gap: 10px; }
  h3, p { margin: 0; }
  p { color: #637083; font-size: 12px; }
  .slot-fill { display: grid; gap: 6px; }
  ol { padding-left: 20px; margin: 0; }
  li { margin-block: 4px; }
  button, select { font: inherit; }
  button { margin-left: 4px; }
  label { display: grid; gap: 4px; }
</style>
