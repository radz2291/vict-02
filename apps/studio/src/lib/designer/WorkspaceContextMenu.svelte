<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ContextMenu } from '@victframework/ui-svelte/catalog/context-menu';
  import { nativeContextTarget, type WorkspaceContext } from './workspace-context.js';
  let { scope, resolve, enabled = true, owns }: {
    scope?: HTMLElement; resolve: (target: Element) => WorkspaceContext | undefined; enabled?: boolean; owns?:(target:Element)=>boolean;
  } = $props();
  let open = $state(false);
  let context = $state<WorkspaceContext>();
  let trigger = $state<HTMLDivElement | null>(null);
  let returnTarget: HTMLElement | undefined;
  function eligible(event: Event) {
    const target = event.target;
    return enabled && target instanceof Element && (scope?.contains(target) || owns?.(target)) && !target.closest('.workspace-menu,.floating-selection,.structure-details,.source-details') ? target : undefined;
  }
  function invoke(target: Element, x: number, y: number) {
    if (nativeContextTarget(target)) return false;
    const next = resolve(target);
    if (!next) return false;
    context = next;
    returnTarget = target.closest<HTMLElement>('[data-ui-occ],.svelte-flow__node,[data-key]') ?? scope;
    next.prepare?.();
    // The menu's own virtual anchor receives the coordinates. It never wraps
    // the canvas/graph, so generic trigger styling cannot change their size.
    trigger?.dispatchEvent(new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true, cancelable: true }));
    return true;
  }
  onMount(() => {
    const pointer = (event: PointerEvent) => {
      const target = eligible(event);
      if (!target || event.button !== 2 || !resolve(target)) return;
      // Before EditorCanvas's document capture selection. Native editing keeps
      // its browser menu but must not reveal/move the floating editing palette.
      event.stopImmediatePropagation();
    };
    const menu = (event: MouseEvent) => {
      const target = eligible(event);
      if (target && invoke(target, event.clientX, event.clientY)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
      const target = eligible(event);
      if (!target) return;
      if (nativeContextTarget(target)) { event.stopImmediatePropagation(); return; }
      const box = target.getBoundingClientRect();
      if (invoke(target, box.left + Math.min(20, box.width), box.top + Math.min(24, box.height))) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('pointerdown', pointer, true);
    window.addEventListener('pointerup', pointer, true);
    window.addEventListener('contextmenu', menu, true);
    window.addEventListener('keydown', keyboard, true);
    return () => {
      window.removeEventListener('pointerdown', pointer, true); window.removeEventListener('pointerup', pointer, true);
      window.removeEventListener('contextmenu', menu, true); window.removeEventListener('keydown', keyboard, true);
    };
  });
  async function restoreFocus(event: Event) {
    event.preventDefault(); await tick();
    // An explicit command may hand focus to a drawer/editor. Restore only when
    // focus remained in the dismissed menu or fell back to the document body.
    const current = document.activeElement;
    if (!current || current === document.body || current.closest('[role="menu"]')) {
      if (returnTarget?.isConnected && !returnTarget.closest('[hidden],[inert]')) returnTarget.focus({ preventScroll: true });
      if (!returnTarget || document.activeElement !== returnTarget) scope?.querySelector<HTMLElement>('.uv-canvas,.svelte-flow__node.selected,[role="treeitem"]')?.focus({ preventScroll: true });
    }
  }
</script>
<ContextMenu.Root bind:open>
  <ContextMenu.Trigger bind:ref={trigger} class="workspace-context-anchor" aria-hidden="true" tabindex={-1} />
  <ContextMenu.Portal>
    <ContextMenu.Content class="workspace-menu" aria-label={context?.label ?? 'Context commands'} collisionPadding={8} sideOffset={2} onCloseAutoFocus={restoreFocus}>
      {#each context?.commands ?? [] as command}
        {#if command.separator}<ContextMenu.Separator />{/if}
        <ContextMenu.Item disabled={command.disabled} onSelect={() => command.run()}>{command.label}</ContextMenu.Item>
      {/each}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
<style>
  :global(.workspace-context-anchor) { position: fixed !important; left: 0; top: 0; width: 0 !important; height: 0 !important; min-width: 0 !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; border: 0 !important; pointer-events: none !important; overflow: hidden; }
</style>
