<script lang="ts">
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { Checkbox } from '@victframework/ui-svelte/catalog/checkbox';
  import { Switch } from '@victframework/ui-svelte/catalog/switch';
  import { ToggleGroup } from '@victframework/ui-svelte/catalog/toggle-group';
  import { DateField } from '@victframework/ui-svelte/catalog/date-field';
  import { parseDate, type DateValue } from '@victframework/ui-svelte/dates';
  let checked = $state(false);
  let enabled = $state(true);
  let channels = $state<string[]>(['email']);
  let date = $state<DateValue | undefined>(parseDate('2026-10-08'));
</script>

<ControlScope locale="en-GB">
  <label><Checkbox.Root bind:checked name="confirmation" />Confirmation</label>
  <label><Switch.Root bind:checked={enabled}><Switch.Thumb /></Switch.Root>Updates</label>
  <ToggleGroup.Root type="multiple" bind:value={channels} aria-label="Channels"
    ><ToggleGroup.Item value="email">Email</ToggleGroup.Item><ToggleGroup.Item value="inbox"
      >Inbox</ToggleGroup.Item
    ><ToggleGroup.Item value="locked" disabled>Locked</ToggleGroup.Item></ToggleGroup.Root
  >
  <DateField.Root bind:value={date}
    ><DateField.Label>Due date</DateField.Label><DateField.Input name="due"
      >{#snippet children({ segments })}{#each segments as segment}<DateField.Segment
            part={segment.part}>{segment.value}</DateField.Segment
          >{/each}{/snippet}</DateField.Input
    ></DateField.Root
  >
  <output>{JSON.stringify({ checked, enabled, channels, date: date?.toString() })}</output>
</ControlScope>
