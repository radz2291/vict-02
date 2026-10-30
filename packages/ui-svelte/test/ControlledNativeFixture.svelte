<script lang="ts">
  import type {UiRenderPlan} from '@victframework/ui';
  import RenderNode from '../src/document/RenderNode.svelte';
  let {plan}:{plan:UiRenderPlan}=$props();
  let state=$state<Record<string,unknown>>({text:'A',checked:false,number:2});
  let accepted=true;
  export function allow(value:boolean){accepted=value;}
  export function snapshot(){return {...state};}
</script>
<RenderNode instruction={plan.structure[0]!} {plan} scope={{state,tokens:{}}} instancePath={[]} repeatKeys={[]} slotFills={{}} dispatch={async()=>undefined} navigate={()=>{}} setState={(key,value)=>{if(accepted)state={...state,[key]:value};}}/>
