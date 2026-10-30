<script lang="ts">
  import type {UiSvelteComponentProps} from '../src/document/extensions.js';
  let {io}:UiSvelteComponentProps=$props();
  let values=$state<Record<string,boolean>>({a:false,b:false});
  let keys=$state(['a','b']);let tick=$state(0);let last=$state('none');
</script>
<button onclick={()=>tick++}>Rerender {tick}</button><button onclick={()=>keys=keys.filter(key=>key!=='a')}>Remove a</button>
<output>{last}</output>
{#each keys as key (key)}<section data-frame={key}>
  {#if io?.scopedSlots?.body}{@render io.scopedSlots.body({key,props:{id:key,rows:[{}]},state:{checked:values[key]!},onStateChange:(name,value)=>{if(name==='checked')values={...values,[key]:value as boolean};},onOutput:(name,payload)=>last=`${key}:${name}:${String(payload)}`})}{/if}
</section>{/each}
