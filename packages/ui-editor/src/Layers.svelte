<script lang="ts">
  /**
   * Layers — the reusable occurrence tree for editor surfaces (U2-07).
   *
   * Walks the COMPILED PLAN (the same source of truth the canvas renders):
   * elements, component frames (with slot fills), repeat templates (one
   * row per unique record identity), conditional branches and slot
   * fallbacks. Selecting an entry emits the exact occurrence key the
   * canvas annotates — no duplicated selection logic in the host.
   */
  import type { UiRenderPlan, UiRenderInstruction } from '@victframework/ui';
  import { occurrenceKey } from '@victframework/ui-svelte';

  interface Props {
    readonly plan: UiRenderPlan;
    readonly selectedOccurrence?: string;
    readonly onSelect?: (occurrence: string) => void;
    readonly ariaLabel?: string;
  }

  let { plan, selectedOccurrence, onSelect, ariaLabel = 'Layers' }: Props = $props();

  interface LayerEntry {
    readonly key: string;
    readonly label: string;
    readonly detail: string;
    readonly depth: number;
  }

  function labelFor(instruction: UiRenderInstruction): string {
    switch (instruction.kind) {
      case 'element':
        return `<${instruction.tag}>`;
      case 'text':
        return '“text”';
      case 'component':
        return `component ${instruction.definitionId}`;
      case 'repeat':
        return `repeat (${instruction.itemName})`;
      case 'conditional':
        return 'conditional';
      case 'slot':
        return `slot ${instruction.name}`;
      case 'unsupported':
        return `unsupported: ${instruction.feature}`;
      case 'extension':
        return `extension ${instruction.extensionId}`;
    }
  }

  let collapsed = $state(new Set<string>());

  function toggle(key: string): void {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsed = next;
  }

  function walk(
    instruction: UiRenderInstruction,
    depth: number,
    repeatKeys: readonly string[],
    out: LayerEntry[],
  ): void {
    const key = occurrenceKey(instruction.occurrenceKey, repeatKeys);
    let label = labelFor(instruction);
    let detail = '';
    if (instruction.kind === 'repeat') detail = `template for each ${instruction.itemName}`;
    if (instruction.kind === 'component') detail = `rev ${instruction.definitionRevision}`;
    if (instruction.kind === 'slot' && instruction.required) detail = 'required';
    out.push({ key, label, detail, depth });
    if (collapsed.has(key) && instruction.kind !== 'text') return;
    switch (instruction.kind) {
      case 'element':
        instruction.children.forEach((child) => walk(child, depth + 1, repeatKeys, out));
        break;
      case 'component': {
        walk(instruction.body, depth + 1, repeatKeys, out);
        for (const [slotName, fills] of Object.entries(instruction.slots)) {
          if (fills.length === 0) continue;
          out.push({
            key: `${key}::slot:${slotName}`,
            label: `slot fill: ${slotName}`,
            detail: '',
            depth: depth + 1,
          });
          fills.forEach((child) => walk(child, depth + 2, repeatKeys, out));
        }
        break;
      }
      case 'repeat':
        walk(instruction.template, depth + 1, repeatKeys, out);
        break;
      case 'conditional':
        instruction.branches.forEach((branch) => {
          out.push({
            key: `${key}::branch:${branch.when ?? 'else'}`,
            label: branch.when === undefined ? 'else' : `when ${branch.when}`,
            detail: '',
            depth: depth + 1,
          });
          branch.children.forEach((child) => walk(child, depth + 2, repeatKeys, out));
        });
        break;
      case 'slot':
        instruction.fallback.forEach((child) => walk(child, depth + 1, repeatKeys, out));
        break;
      case 'unsupported':
        instruction.children.forEach((child) => walk(child, depth + 1, repeatKeys, out));
        break;
      case 'text':
      case 'extension':
        break;
    }
  }

  const entries = $derived.by(() => {
    const out: LayerEntry[] = [];
    plan.structure.forEach((instruction) => walk(instruction, 0, [], out));
    return out;
  });
</script>

<nav class="uv-layers" aria-label={ariaLabel}>
  <h2>{ariaLabel}</h2>
  <ul role="tree" aria-label="Document layers">
    {#each entries as entry (entry.key)}
      <li role="treeitem" aria-level={entry.depth + 1} aria-selected={entry.key === selectedOccurrence}>
        <button
          type="button"
          class:uv-layer-selected={entry.key === selectedOccurrence}
          style:padding-left="{entry.depth * 14 + 8}px"
          onclick={() => (entry.key.includes('::') ? undefined : onSelect?.(entry.key))}
          title={entry.detail !== '' ? `${entry.label} — ${entry.detail}` : entry.label}
        >
          {entry.label}{#if entry.detail !== ''}<span class="uv-layer-detail"> {entry.detail}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</nav>
