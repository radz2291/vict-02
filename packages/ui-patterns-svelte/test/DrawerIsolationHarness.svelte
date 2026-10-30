<script lang="ts">
  import Drawer from '../src/Drawer.svelte';
  let open=$state(false),alpha=$state('0.2');
  export function setOpen(value:boolean){open=value;}
  export function setAlpha(value:string){alpha=value;}
  export function isOpen(){return open;}
</script>
<main class="vict-controls vict-rhea" data-ui-application-viewport data-app="a" style="position:relative;overflow:auto">
  <Drawer nodeId="drawer-a" occurrenceKey="drawer-a" props={{open,title:'Owned drawer'}} io={{emit:(name,value)=>{if(name==='openChange')open=value===true;},slots:{body}}} presentation={{ownerDocument:document,target:part=>({class:'',style:part==='panel'?`--ui-binding-panel-alpha:${alpha};`:undefined})}}/>
</main>
<section data-ui-application-viewport data-app="b"><input aria-label="Sibling application input"/></section>
{#snippet body()}<button data-first>First owned control</button><input aria-label="Last owned input"/>{/snippet}
