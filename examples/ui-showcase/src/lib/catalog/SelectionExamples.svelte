<script lang="ts">
  import { Checkbox } from '@victframework/ui-svelte/catalog/checkbox';
  import { Combobox } from '@victframework/ui-svelte/catalog/combobox';
  import { RadioGroup } from '@victframework/ui-svelte/catalog/radio-group';
  import { Select } from '@victframework/ui-svelte/catalog/select';
  import { Slider } from '@victframework/ui-svelte/catalog/slider';
  import { Switch } from '@victframework/ui-svelte/catalog/switch';
  import { Toggle } from '@victframework/ui-svelte/catalog/toggle';
  import { ToggleGroup } from '@victframework/ui-svelte/catalog/toggle-group';
  import Example from './Example.svelte';
  const teams = [
    { value: 'product', label: 'Product' },
    { value: 'support', label: 'Customer support' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'legal', label: 'Legal · unavailable', disabled: true },
  ];
  let team = $state('');
  let search = $state('');
  let selectedTeams = $state<string[]>(['product']);
  let selectedPeople = $state<string[]>(['maya']);
  let peopleSearch = $state('');
  const people = [
    { value: 'maya', label: 'Maya Chen' },
    { value: 'arun', label: 'Arun Patel' },
    { value: 'lin', label: 'Lin Tan' },
  ];
  let priority = $state('normal');
  let capacity = $state([20, 70]);
  let alerts = $state(true);
  let bold = $state(false);
  let alignment = $state('left');
  let channels = $state<string[]>(['email']);
</script>

<Example family="checkbox" title="Checkbox">
  <label class="vict-control-row"
    ><Checkbox.Root checked name="approval" />Require approval before handoff</label
  >
  <label class="vict-control-row"><Checkbox.Root indeterminate />Some tasks are selected</label>
  <label class="vict-control-row"><Checkbox.Root disabled />Managed by workspace owner</label>
</Example>
<Example family="combobox" title="Combobox">
  <label for="team-search" class="vict-control-label">Assign a team</label>
  <Combobox.Root type="single" bind:value={team} onOpenChange={() => (search = '')}>
    <Combobox.Input
      id="team-search"
      placeholder="Search teams…"
      oninput={(event) => (search = event.currentTarget.value)}
    />
    <Combobox.Portal
      ><Combobox.Content sideOffset={6}>
        {#each teams.filter((item) => item.label
            .toLowerCase()
            .includes(search.toLowerCase())) as item (item.value)}<Combobox.Item {...item}
            >{item.label}</Combobox.Item
          >{:else}<p class="vict-control-help" role="status">No matching teams.</p>{/each}
      </Combobox.Content></Combobox.Portal
    >
  </Combobox.Root>
  <label for="people-search" class="vict-control-label">Reviewers · multiple</label>
  <Combobox.Root
    type="multiple"
    bind:value={selectedPeople}
    onOpenChange={() => (peopleSearch = '')}
  >
    <Combobox.Input
      id="people-search"
      placeholder="Add reviewers…"
      oninput={(event) => (peopleSearch = event.currentTarget.value)}
    />
    <Combobox.Portal
      ><Combobox.Content sideOffset={6}>
        {#each people.filter((item) => item.label
            .toLowerCase()
            .includes(peopleSearch.toLowerCase())) as item (item.value)}<Combobox.Item {...item}
            >{item.label}</Combobox.Item
          >{:else}<p role="status">No matching reviewers.</p>{/each}
      </Combobox.Content></Combobox.Portal
    >
  </Combobox.Root>
  <span class="vict-control-help" aria-live="polite"
    >Reviewers: {selectedPeople
      .map((value) => people.find((person) => person.value === value)?.label ?? value)
      .join(', ') || 'None'}</span
  >
</Example>
<Example family="select" title="Select">
  <span id="select-teams-label" class="vict-control-label">Teams to notify · multiple</span>
  <Select.Root type="multiple" bind:value={selectedTeams}>
    <Select.Trigger aria-labelledby="select-teams-label"
      >{selectedTeams.length}
      {selectedTeams.length === 1 ? 'team' : 'teams'} selected ⌄</Select.Trigger
    >
    <Select.Portal
      ><Select.Content sideOffset={6}
        >{#each teams as item (item.value)}<Select.Item {...item}>{item.label}</Select.Item
          >{/each}</Select.Content
      ></Select.Portal
    >
  </Select.Root>
  <span id="priority-label" class="vict-control-label">Priority · single</span>
  <Select.Root type="single" bind:value={priority}
    ><Select.Trigger aria-labelledby="priority-label"
      >{priority === 'normal' ? 'Normal' : 'Urgent'} ⌄</Select.Trigger
    ><Select.Portal
      ><Select.Content sideOffset={6}
        ><Select.Item value="normal">Normal</Select.Item><Select.Item value="urgent"
          >Urgent</Select.Item
        ></Select.Content
      ></Select.Portal
    ></Select.Root
  >
</Example>
<Example family="radio-group" title="Radio group">
  <span id="delivery-label" class="vict-control-label">Delivery preference</span>
  <RadioGroup.Root value="digest" aria-labelledby="delivery-label">
    <label class="vict-control-row"><RadioGroup.Item value="digest" />Daily digest</label>
    <label class="vict-control-row"><RadioGroup.Item value="instant" />As updates happen</label>
    <label class="vict-control-row"><RadioGroup.Item value="sms" disabled />SMS · unavailable</label
    >
  </RadioGroup.Root>
</Example>
<Example family="slider" title="Slider">
  <span id="capacity-label">Capacity range: {capacity.join('–')}%</span>
  <Slider.Root
    type="multiple"
    bind:value={capacity}
    min={0}
    max={100}
    step={5}
    aria-labelledby="capacity-label"
  >
    {#snippet children({ thumbs })}<Slider.Range />{#each thumbs as thumb}<Slider.Thumb
          index={thumb}
          aria-label={thumb === 0 ? 'Minimum capacity' : 'Maximum capacity'}
        />{/each}{/snippet}
  </Slider.Root>
</Example>
<Example family="switch" title="Switch">
  <label class="vict-control-row"
    ><Switch.Root bind:checked={alerts}><Switch.Thumb /></Switch.Root>Notify me when a request
    changes</label
  >
  <label class="vict-control-row"
    ><Switch.Root disabled><Switch.Thumb /></Switch.Root>Organisation alerts · locked</label
  >
  <span role="status">Notifications {alerts ? 'on' : 'off'}.</span>
</Example>
<Example family="toggle" title="Toggle">
  <Toggle.Root bind:pressed={bold} aria-label="Bold formatting">Bold</Toggle.Root>
  <span class="vict-control-help">Formatting {bold ? 'enabled' : 'disabled'}.</span>
</Example>
<Example family="toggle-group" title="Toggle group">
  <ToggleGroup.Root type="single" bind:value={alignment} aria-label="Text alignment"
    ><ToggleGroup.Item value="left">Left</ToggleGroup.Item><ToggleGroup.Item value="center"
      >Centre</ToggleGroup.Item
    ><ToggleGroup.Item value="right">Right</ToggleGroup.Item></ToggleGroup.Root
  >
  <ToggleGroup.Root type="multiple" bind:value={channels} aria-label="Delivery channels"
    ><ToggleGroup.Item value="email">Email</ToggleGroup.Item><ToggleGroup.Item value="inbox"
      >Inbox</ToggleGroup.Item
    ><ToggleGroup.Item value="sms" disabled>SMS</ToggleGroup.Item></ToggleGroup.Root
  >
</Example>
