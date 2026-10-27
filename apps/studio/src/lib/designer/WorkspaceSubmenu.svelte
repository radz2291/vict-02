<script lang="ts">
  import type {Snippet} from 'svelte';
  import {Menubar} from '@victframework/ui-svelte/catalog/menubar';
  let {label,children}:{label:string;children:Snippet}=$props();
</script>
<Menubar.Sub>
  <Menubar.SubTrigger>{label}<span aria-hidden="true">›</span></Menubar.SubTrigger>
  <Menubar.Portal><Menubar.SubContent aria-label={label} data-studio-typography class="studio-type-scope workspace-menu" align="start" alignOffset={-5} sideOffset={2} collisionPadding={8}>
    {@render children()}
  </Menubar.SubContent></Menubar.Portal>
</Menubar.Sub>
