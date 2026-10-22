<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  let { label, value, activeMenu, trigger=$bindable(null), children }: {
    label:string; value:string; activeMenu:string;
    trigger?:HTMLButtonElement|null; children:Snippet;
  }=$props();
  function restoreFocus(event:Event) {
    event.preventDefault();
    const editing=globalThis.document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
    if(!activeMenu && !editing && !globalThis.document.querySelector('dialog[open]') && trigger?.isConnected)trigger.focus({preventScroll:true});
  }
</script>
<Menubar.Menu {value}>
  <Menubar.Trigger bind:ref={trigger}>{label}</Menubar.Trigger>
  <Menubar.Portal><Menubar.Content class="workspace-menu" sideOffset={6} collisionPadding={8} onCloseAutoFocus={restoreFocus}>
    {@render children()}
  </Menubar.Content></Menubar.Portal>
</Menubar.Menu>
