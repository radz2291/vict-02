<script lang="ts">
  import type {UiSlotScope,UiValue} from '@victframework/ui';
  import ScopedSlotInstance from '../src/document/ScopedSlotInstance.svelte';
  type Channels={write:(key:string,value:unknown)=>void;emit:(name:string,payload?:UiValue)=>void};
  let {onCapture,onWrite,onOutput,onDiagnostic}:{onCapture:(channels:Channels)=>void;onWrite:(key:string,value:UiValue)=>void;onOutput:(name:string,value?:UiValue)=>void;onDiagnostic:(code:string)=>void}=$props();
  const declaration:UiSlotScope={schema:'vict.ui-slot-scope@1',props:[],state:{draft:{key:'draft',type:'string',initial:'',controlled:true}},outputs:[{name:'choose',payload:'string'}]};
  let generation=$state(Symbol('source'));
  const frame={key:'same-live-occurrence',props:{},state:{draft:''},onStateChange:(key:string,value:UiValue)=>onWrite(key,value),onOutput:(name:string,value?:UiValue)=>onOutput(name,value)};
  export function replacePlan(){generation=Symbol('next-source');}
  function capture(_node:HTMLElement,channels:Channels){onCapture(channels);return {update(next:Channels){onCapture(next);}};}
</script>
<ScopedSlotInstance {declaration} {frame} {generation} report={(code)=>onDiagnostic(code)}>
  {#snippet children(_props,_state,write,emit)}<span use:capture={{write,emit}}>Scoped channel probe</span>{/snippet}
</ScopedSlotInstance>
