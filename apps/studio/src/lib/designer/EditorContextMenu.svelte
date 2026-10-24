<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { ContextMenu } from '@victframework/ui-svelte/catalog/context-menu';
  export type ContextCommand = { label: string; action: () => void; disabled?: boolean; separator?: boolean };
  let { children, commands, prepare, validate = () => true, disabled = false, label, class: className = '', ref = $bindable<HTMLElement | null>(null) }: {
    children: Snippet; commands: ContextCommand[]; prepare: (target: Element) => boolean;
    disabled?: boolean; label: string; class?: string; ref?: HTMLElement | null; validate?: () => boolean;
  } = $props();
  let returnTarget: HTMLElement | undefined;
  function native(target: Element) { return !!target.closest('input,textarea,select,[contenteditable=true],[data-ui-tool-body],.uv-floating-selection'); }
  function context(event: MouseEvent) {
    if (disabled) return;
    if (!(event.target instanceof Element) || native(event.target)) { event.stopPropagation(); return; }
    returnTarget = event.target.closest<HTMLElement>('.svelte-flow__node,[role=treeitem],[data-ui-occ],[tabindex]') ?? ref ?? undefined;
    if (!prepare(event.target)) { event.preventDefault(); event.stopPropagation(); }
  }
  function keyboard(event: KeyboardEvent) {
    if (disabled || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) || !(event.target instanceof Element) || !ref?.contains(event.target) || native(event.target)) return;
    event.preventDefault(); event.stopPropagation();
    const target = event.target;
    const bounds = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left + Math.min(24, bounds.width / 2), clientY: bounds.top + Math.min(24, bounds.height / 2) }));
  }
  function restore(event: Event) {
    event.preventDefault();
    // A command may deliberately focus an editor. Only restore an abandoned menu focus.
    void tick().then(() => {
      const current = document.activeElement;
      if (returnTarget?.isConnected && (!current || current === document.body || current.closest('[role=menu]'))) returnTarget.focus({ preventScroll: true });
    });
  }
</script>
<svelte:window onkeydowncapture={keyboard} />
<ContextMenu.Root>
  <ContextMenu.Trigger {disabled} bind:ref class={`editor-context-target ${className}`} aria-label={label} tabindex={0} oncontextmenucapture={context}>
    {@render children()}
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content class="workspace-menu studio-context-menu" collisionPadding={8} onCloseAutoFocus={restore}>
      {#each commands as command}
        {#if command.separator}<ContextMenu.Separator />{/if}
        <ContextMenu.Item disabled={command.disabled} onSelect={() => { if (validate()) command.action(); }}>{command.label}</ContextMenu.Item>
      {/each}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
<style>
  :global(.editor-context-target) { min-width: 0; min-height: 0; }
  :global(.editor-context-target:focus-visible) { outline: 2px solid #5269bd; outline-offset: -2px; }
</style>
