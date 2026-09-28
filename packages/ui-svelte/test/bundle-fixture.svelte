<script lang="ts">
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { Checkbox } from '@victframework/ui-svelte/catalog/checkbox';
  let checked = $state(false);
</script>

<ControlScope><label><Checkbox.Root bind:checked />Confirm handoff</label></ControlScope>
