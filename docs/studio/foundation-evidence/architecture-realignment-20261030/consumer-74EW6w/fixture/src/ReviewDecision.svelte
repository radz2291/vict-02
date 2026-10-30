<script lang="ts">
import {Select,type UiSvelteComponentProps} from '@victframework/ui-svelte';
let {props,io,presentation,occurrenceKey}:UiSvelteComponentProps=$props();
const choices=[{value:'pending',label:'Pending'},{value:'revise',label:'Request revision'},{value:'approved',label:'Approved'}];
</script>
<label {...presentation?.target('root')} class={['nodrag nopan nowheel',presentation?.target('root').class??''].join(' ')} data-consumer-control="decision">
  Decision
  <Select id={'decision-'+occurrenceKey} name="decision" value={String(props.value)} options={choices} onChange={value=>io?.emit('valueChange',value)}/>
</label>