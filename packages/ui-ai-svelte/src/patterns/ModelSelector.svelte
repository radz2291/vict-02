<script lang="ts">
  import * as DropdownMenu from '../upstream/ui/dropdown-menu/index.js';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import type {ModelOption} from './types.js';
  let {models, model, efforts=[], effort='', onModelChange,onEffortChange}:{models:readonly ModelOption[];model:string;efforts?:readonly ModelOption[];effort?:string;onModelChange?:(id:string)=>void;onEffortChange?:(id:string)=>void}=$props();
</script>
<div class="flex gap-2">
<DropdownMenu.Root><DropdownMenu.Trigger disabled={!onModelChange}>{#snippet child({props})}<InputGroup.Button {...props} size="sm">{models.find(m=>m.id===model)?.label??model}<ChevronDown/></InputGroup.Button>{/snippet}</DropdownMenu.Trigger><DropdownMenu.Content align="start"><DropdownMenu.RadioGroup value={model} onValueChange={onModelChange}>{#each models as item (item.id)}<DropdownMenu.RadioItem value={item.id} closeOnSelect>{item.label}</DropdownMenu.RadioItem>{/each}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Root>
{#if efforts.length}<DropdownMenu.Root><DropdownMenu.Trigger disabled={!onEffortChange}>{#snippet child({props})}<InputGroup.Button {...props} size="sm">{efforts.find(m=>m.id===effort)?.label??effort}<ChevronDown/></InputGroup.Button>{/snippet}</DropdownMenu.Trigger><DropdownMenu.Content align="start"><DropdownMenu.RadioGroup value={effort} onValueChange={onEffortChange}>{#each efforts as item (item.id)}<DropdownMenu.RadioItem value={item.id} closeOnSelect>{item.label}</DropdownMenu.RadioItem>{/each}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Root>{/if}
</div>
