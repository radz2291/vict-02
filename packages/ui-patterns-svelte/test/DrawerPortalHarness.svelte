<script lang="ts">
  import {setContext} from 'svelte';
  import {catalogImplementations,UI_PORTAL_TARGET} from '@victframework/ui-svelte';
  import Drawer from '../src/Drawer.svelte';
  let owner=$state<HTMLElement>(),open=$state(false),selected=$state('one');
  const SelectControl=catalogImplementations.find(item=>item.extensionId==='vict.catalog.select')!.component;
  setContext(UI_PORTAL_TARGET,()=>owner);
</script>
<main class="vict-controls vict-rhea" data-ui-application-viewport data-ui-owner-root="portal-proof" bind:this={owner}>
  <Drawer nodeId="drawer" occurrenceKey="drawer" props={{open,title:'Portal owner'}} io={{emit:(name,value)=>{if(name==='openChange')open=value===true;},slots:{body}}}/>
</main>
{#snippet body()}
  <SelectControl nodeId="choice" occurrenceKey="choice" props={{value:selected,options:[{value:'one',label:'One'},{value:'two',label:'Two'}]}} io={{emit:(name,value)=>{if(name==='valueChange'&&typeof value==='string')selected=value;}}} presentation={{ownerDocument:document,target:part=>({class:'','data-ui-owner':'portal-proof','data-ui-occ':'choice','data-ui-node':'choice','data-ui-part':part})}}/>
{/snippet}
