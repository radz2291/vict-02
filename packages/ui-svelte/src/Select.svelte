<script lang="ts">
  import type { UiSelectOption } from '@victframework/ui';
  let { id, name, value, options, required = false, disabled = false, invalid = false, describedBy, onChange }:
    { id: string; name: string; value: string; options: readonly UiSelectOption[]; required?: boolean; disabled?: boolean; invalid?: boolean; describedBy?: string; onChange: (value: string) => void } = $props();
</script>
<select class="vict-input vict-select" {id} {name} {value} {required} {disabled}
  aria-invalid={invalid || undefined} aria-describedby={describedBy}
  onchange={(event) => onChange(event.currentTarget.value)}>
  <option value="">Choose an option</option>
  {#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
</select>
