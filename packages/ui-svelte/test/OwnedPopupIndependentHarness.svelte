<script lang="ts">
  import OwnedMenuContent from '../src/OwnedMenuContent.svelte';
  let owner=$state<HTMLElement>(),parentTrigger=$state<HTMLButtonElement>(),childTrigger=$state<HTMLButtonElement>();
  let parentOpen=$state(true),childOpen=$state(true),parentRequests=$state(0),childRequests=$state(0);
</script>
<main data-ui-application-viewport bind:this={owner}>
  <button bind:this={parentTrigger}>Parent menu</button>
  <OwnedMenuContent id="independent-parent-menu" open={parentOpen} trigger={parentTrigger} {owner} initialFocus="none"
    onRequestClose={()=>{parentRequests++;parentOpen=false;}}>
    <button role="menuitem" bind:this={childTrigger} data-independent-child-trigger>Child menu</button>
    <OwnedMenuContent id="independent-child-menu" open={childOpen} trigger={childTrigger} {owner} initialFocus="none"
      onRequestClose={()=>{childRequests++;childOpen=false;}}>
      <button role="menuitem">Leaf item</button>
    </OwnedMenuContent>
  </OwnedMenuContent>
  <output data-parent-requests>{parentRequests}</output><output data-child-requests>{childRequests}</output>
</main>
