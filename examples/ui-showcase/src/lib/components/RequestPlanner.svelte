<script lang="ts">
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope, CalendarGrid, ChevronDown } from '@victframework/ui-svelte/controls';
  import { useVictActions } from '@victframework/ui-svelte/component-actions';
  import { DropdownMenu } from '@victframework/ui-svelte/catalog/dropdown-menu';
  import { Select } from '@victframework/ui-svelte/catalog/select';
  import { DatePicker } from '@victframework/ui-svelte/catalog/date-picker';
  import { Accordion } from '@victframework/ui-svelte/catalog/accordion';
  import { Checkbox } from '@victframework/ui-svelte/catalog/checkbox';
  import { ActionFeedback } from '@victframework/ui-svelte';
  import { actionFeedback, type UiActionFeedback } from '@victframework/ui';
  import { parseDate, type DateValue } from '@victframework/ui-svelte/dates';
  import { tick, onDestroy } from 'svelte';
  let { submitActionId }: { submitActionId: string } = $props();
  const actions = useVictActions();
  const teams = [
    { value: 'Product', label: 'Product' },
    { value: 'Engineering', label: 'Engineering' },
    { value: 'Operations', label: 'Operations' },
  ];
  let name = $state('');
  let team = $state('');
  let date = $state<DateValue | undefined>(parseDate('2026-10-08'));
  let followUp = $state(true);
  let note = $state('');
  let priority = $state(50);
  let pending = $state(false);
  let feedback = $state<UiActionFeedback | null>(null);
  let errors = $state<Record<string, string>>({});
  let form = $state<HTMLFormElement>();
  let active = true;
  onDestroy(() => {
    active = false;
  });
  function clearResult() {
    if (feedback?.kind === 'success') feedback = null;
  }
  function template(kind: 'launch' | 'review') {
    name = kind === 'launch' ? 'Prepare the onboarding launch' : 'Review the product brief';
    team = 'Product';
    priority = kind === 'launch' ? 75 : 50;
    errors = {};
    clearResult();
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;
    feedback = null;
    errors = {
      ...(!name.trim() ? { name: 'Give this request a name.' } : {}),
      ...(!team ? { team: 'Choose the receiving team.' } : {}),
      ...(!date ? { date: 'Choose a review date.' } : {}),
    };
    if (Object.keys(errors).length) {
      await tick();
      form
        ?.querySelector<HTMLElement>('[aria-invalid="true"]:is(input,button,[tabindex])')
        ?.focus();
      return;
    }
    pending = true;
    try {
      const result = await actions.run(submitActionId, {
        name: name.trim(),
        rank: priority,
        payload: team,
        startDate: date!.toString(),
        zeroCheck: followUp,
        comment: note,
      });
      if (!active) return;
      if (result)
        feedback = actionFeedback(
          result,
          { success: 'Request scheduled. You can find it in All requests.' },
          true,
        );
      if (result?.fieldErrors) errors = result.fieldErrors;
    } catch {
      if (active) feedback = actionFeedback({ ok: false }, {}, true);
    } finally {
      if (active) pending = false;
    }
  }
</script>

<ControlScope>
  <form
    class="vict-control-stack"
    bind:this={form}
    onsubmit={submit}
    novalidate
    data-testid="request-planner"
  >
    <div class="vict-control-row">
      <h2 style="margin:0; flex:1">Plan a request</h2>
      <DropdownMenu.Root
        ><DropdownMenu.Trigger disabled={pending}>Start from a template</DropdownMenu.Trigger
        ><DropdownMenu.Portal
          ><DropdownMenu.Content sideOffset={6}
            ><DropdownMenu.Item onSelect={() => template('launch')}
              >Onboarding launch</DropdownMenu.Item
            ><DropdownMenu.Item onSelect={() => template('review')}
              >Product review</DropdownMenu.Item
            ></DropdownMenu.Content
          ></DropdownMenu.Portal
        ></DropdownMenu.Root
      >
    </div>
    <p class="vict-control-help">Give the next team the context and a date to work towards.</p>
    <div>
      <label for="planner-name" class="vict-control-label">Request name</label><input
        class="vict-input"
        id="planner-name"
        maxlength={80}
        bind:value={name}
        oninput={() => {
          delete errors.name;
          clearResult();
        }}
        aria-invalid={!!errors.name}
        aria-describedby={errors.name ? 'planner-name-error' : undefined}
        disabled={pending}
      />{#if errors.name}<span id="planner-name-error" class="vict-field-error">{errors.name}</span
        >{/if}
    </div>
    <div>
      <span id="planner-team-label" class="vict-control-label">Receiving team</span><Select.Root
        type="single"
        bind:value={team}
        onValueChange={() => {
          delete errors.team;
          clearResult();
        }}
        disabled={pending}
        ><Select.Trigger
          aria-labelledby="planner-team-label"
          aria-invalid={!!errors.team}
          aria-describedby={errors.team ? 'planner-team-error' : undefined}
          ><span>{team || 'Choose a team'}</span><ChevronDown /></Select.Trigger
        ><Select.Portal
          ><Select.Content sideOffset={6} align="start" collisionPadding={16}
            >{#each teams as option (option.value)}<Select.Item {...option}
                >{option.label}</Select.Item
              >{/each}</Select.Content
          ></Select.Portal
        ></Select.Root
      >{#if errors.team}<span id="planner-team-error" class="vict-field-error">{errors.team}</span
        >{/if}
    </div>
    <DatePicker.Root
      bind:value={date}
      onValueChange={() => {
        delete errors.date;
        clearResult();
      }}
      placeholder={parseDate('2026-10-01')}
      disabled={pending}
      errorMessageId={errors.date ? 'planner-date-error' : undefined}
      weekStartsOn={1}
    >
      <DatePicker.Label>Review date</DatePicker.Label>
      <div class="vict-control-row">
        <DatePicker.Input aria-describedby={errors.date ? 'planner-date-error' : undefined}
          >{#snippet children({ segments })}{#each segments as segment}<DatePicker.Segment
                part={segment.part}
                aria-describedby={errors.date ? 'planner-date-error' : undefined}
                >{segment.value}</DatePicker.Segment
              >{/each}{/snippet}</DatePicker.Input
        ><DatePicker.Trigger
          class="vict-btn vict-btn--secondary"
          aria-label="Choose review date"
          aria-invalid={!!errors.date}
          aria-describedby={errors.date ? 'planner-date-error' : undefined}
          >Calendar</DatePicker.Trigger
        >
      </div>
      <DatePicker.Portal
        ><DatePicker.Content sideOffset={8} collisionPadding={16} class="vict-control-panel"
          ><DatePicker.Calendar
            >{#snippet children({ months, weekdays })}<CalendarGrid
                {months}
                {weekdays}
              />{/snippet}</DatePicker.Calendar
          ><DatePicker.Close class="vict-btn vict-btn--quiet">Close calendar</DatePicker.Close
          ></DatePicker.Content
        ></DatePicker.Portal
      >
    </DatePicker.Root>
    {#if errors.date}<span class="vict-field-error" id="planner-date-error">{errors.date}</span
      >{/if}
    <Accordion.Root type="single"
      ><Accordion.Item value="handoff"
        ><Accordion.Header><Accordion.Trigger>Handoff details</Accordion.Trigger></Accordion.Header
        ><Accordion.Content
          ><div class="vict-control-stack">
            <label class="vict-control-row"
              ><Checkbox.Root
                bind:checked={followUp}
                onCheckedChange={clearResult}
                disabled={pending}
              />Ask the receiving team to confirm</label
            ><label for="planner-note" class="vict-control-label">Notes for the team</label
            ><textarea
              id="planner-note"
              class="vict-textarea"
              maxlength={500}
              bind:value={note}
              oninput={clearResult}
              disabled={pending}
              rows={3}
            ></textarea>
          </div></Accordion.Content
        ></Accordion.Item
      ></Accordion.Root
    >
    <div class="vict-control-row">
      <button
        class="vict-btn vict-btn--primary"
        type="submit"
        disabled={pending}
        aria-busy={pending}>{pending ? 'Scheduling…' : 'Schedule request'}</button
      ><ActionFeedback {feedback} actionId={submitActionId} />
    </div>
  </form>
</ControlScope>
