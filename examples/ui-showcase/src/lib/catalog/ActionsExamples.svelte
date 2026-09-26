<script lang="ts">
  import { Accordion } from '@victframework/ui-svelte/catalog/accordion';
  import { AlertDialog } from '@victframework/ui-svelte/catalog/alert-dialog';
  import { Button } from '@victframework/ui-svelte/catalog/button';
  import { Command } from '@victframework/ui-svelte/catalog/command';
  import { ContextMenu } from '@victframework/ui-svelte/catalog/context-menu';
  import { Dialog } from '@victframework/ui-svelte/catalog/dialog';
  import { DropdownMenu } from '@victframework/ui-svelte/catalog/dropdown-menu';
  import { Popover } from '@victframework/ui-svelte/catalog/popover';
  import { Tooltip } from '@victframework/ui-svelte/catalog/tooltip';
  import Example from './Example.svelte';
  let result = $state('No action selected.');
  let archived = $state(false);
  let archiveOpen = $state(false);
  let commandOpen = $state(false);
  let watching = $state(true);
  let sort = $state('recent');
</script>

<Example family="button" title="Button">
  <div class="vict-control-row">
    <Button.Root class="vict-btn vict-btn--primary" onclick={() => (result = 'Draft saved.')}
      >Save draft</Button.Root
    >
    <Button.Root disabled>Export unavailable</Button.Root>
    <Button.Root disabled aria-busy="true">Saving…</Button.Root>
  </div>
</Example>
<Example family="accordion" title="Accordion">
  <Accordion.Root type="multiple" value={['handoff']}>
    <Accordion.Item value="handoff"
      ><Accordion.Header
        ><Accordion.Trigger>What happens after handoff?</Accordion.Trigger></Accordion.Header
      ><Accordion.Content
        >The receiving team reviews the brief and confirms an owner.</Accordion.Content
      ></Accordion.Item
    >
    <Accordion.Item value="changes"
      ><Accordion.Header
        ><Accordion.Trigger>Can I change the schedule?</Accordion.Trigger></Accordion.Header
      ><Accordion.Content>You can update the date until the request is accepted.</Accordion.Content
      ></Accordion.Item
    >
    <Accordion.Item value="locked" disabled
      ><Accordion.Header
        ><Accordion.Trigger>Retention policy · managed by your owner</Accordion.Trigger
        ></Accordion.Header
      ><Accordion.Content>Locked</Accordion.Content></Accordion.Item
    >
  </Accordion.Root>
</Example>
<Example family="alert-dialog" title="Alert dialog">
  <p>A destructive confirmation keeps the decision explicit.</p>
  <AlertDialog.Root bind:open={archiveOpen}>
    <AlertDialog.Trigger>Archive project</AlertDialog.Trigger>
    <AlertDialog.Portal
      ><AlertDialog.Overlay /><AlertDialog.Content>
        <AlertDialog.Title>Archive the onboarding project?</AlertDialog.Title>
        <AlertDialog.Description
          >The project leaves the active list. A workspace owner can restore it later.</AlertDialog.Description
        >
        <div class="vict-control-row">
          <AlertDialog.Cancel>Keep project</AlertDialog.Cancel><AlertDialog.Action
            onclick={() => {
              archived = true;
              archiveOpen = false;
            }}>Archive project</AlertDialog.Action
          >
        </div>
      </AlertDialog.Content></AlertDialog.Portal
    >
  </AlertDialog.Root>
  <span role="status">{archived ? 'Project archived.' : 'Project is active.'}</span>
</Example>
<Example family="command" title="Command">
  <Command.Root label="Workspace commands">
    <Command.Input aria-label="Find a command" placeholder="Search commands…" />
    <Command.List
      ><Command.Viewport>
        <Command.Empty>No matching commands. Try “request”.</Command.Empty>
        <Command.Group
          ><Command.GroupHeading>Workspace</Command.GroupHeading><Command.GroupItems>
            <Command.Item
              value="create-request"
              keywords={['new', 'intake']}
              onSelect={() => (result = 'Create request selected.')}>Create a request</Command.Item
            >
            <Command.Item value="view-schedule" onSelect={() => (result = 'Schedule opened.')}
              >View schedule</Command.Item
            >
            <Command.Item value="delete-workspace" disabled
              >Delete workspace · owner only</Command.Item
            >
          </Command.GroupItems></Command.Group
        >
      </Command.Viewport></Command.List
    >
  </Command.Root>
  <Dialog.Root bind:open={commandOpen}
    ><Dialog.Trigger>Open command palette</Dialog.Trigger><Dialog.Portal
      ><Dialog.Overlay /><Dialog.Content>
        <Dialog.Title>Workspace commands</Dialog.Title><Dialog.Description
          >Find a task and press Enter to run it.</Dialog.Description
        >
        <Command.Root label="Command palette"
          ><Command.Input
            aria-label="Search workspace commands"
            placeholder="Search tasks…"
          /><Command.List
            ><Command.Viewport
              ><Command.Empty>No matching tasks.</Command.Empty><Command.Item
                value="schedule-review"
                onSelect={() => {
                  result = 'Review scheduling selected.';
                  commandOpen = false;
                }}>Schedule a review</Command.Item
              ><Command.Item
                value="open-requests"
                onSelect={() => {
                  result = 'Requests selected.';
                  commandOpen = false;
                }}>Open requests</Command.Item
              ></Command.Viewport
            ></Command.List
          ></Command.Root
        >
        <Dialog.Close>Close commands</Dialog.Close>
      </Dialog.Content></Dialog.Portal
    ></Dialog.Root
  >
</Example>
<Example family="context-menu" title="Context menu">
  <ContextMenu.Root>
    <ContextMenu.Trigger tabindex={0} class="vict-control-panel"
      >Project brief — right-click or press Shift+F10.</ContextMenu.Trigger
    >
    <ContextMenu.Portal
      ><ContextMenu.Content>
        <ContextMenu.Item onSelect={() => (result = 'Link copied for the project brief.')}
          >Copy brief link</ContextMenu.Item
        >
        <ContextMenu.CheckboxItem bind:checked={watching}>Watch updates</ContextMenu.CheckboxItem>
        <ContextMenu.Item disabled>Delete brief · owner only</ContextMenu.Item>
      </ContextMenu.Content></ContextMenu.Portal
    >
  </ContextMenu.Root>
  <p class="vict-control-help">Touch users can use the equivalent Project actions menu below.</p>
</Example>
<Example family="dialog" title="Dialog">
  <Dialog.Root
    ><Dialog.Trigger>Edit workspace name</Dialog.Trigger><Dialog.Portal
      ><Dialog.Overlay /><Dialog.Content>
        <Dialog.Title>Name your workspace</Dialog.Title><Dialog.Description
          >Choose a name your team will recognise.</Dialog.Description
        >
        <label class="vict-control-label" for="workspace-name">Workspace name</label><input
          class="vict-input"
          id="workspace-name"
          value="Product team"
        />
        <div class="vict-control-row"><Dialog.Close>Save name</Dialog.Close></div>
      </Dialog.Content></Dialog.Portal
    ></Dialog.Root
  >
</Example>
<Example family="dropdown-menu" title="Dropdown menu">
  <DropdownMenu.Root
    ><DropdownMenu.Trigger>Project actions</DropdownMenu.Trigger><DropdownMenu.Portal
      ><DropdownMenu.Content sideOffset={6}>
        <DropdownMenu.Item onSelect={() => (result = 'Project link copied.')}
          >Copy project link</DropdownMenu.Item
        >
        <DropdownMenu.CheckboxItem bind:checked={watching}>Watch updates</DropdownMenu.CheckboxItem>
        <DropdownMenu.Separator />
        <DropdownMenu.Sub
          ><DropdownMenu.SubTrigger>Sort requests</DropdownMenu.SubTrigger><DropdownMenu.SubContent
            sideOffset={6}
          >
            <DropdownMenu.RadioGroup bind:value={sort}
              ><DropdownMenu.RadioItem value="recent">Most recent</DropdownMenu.RadioItem
              ><DropdownMenu.RadioItem value="priority">Highest priority</DropdownMenu.RadioItem
              ></DropdownMenu.RadioGroup
            >
          </DropdownMenu.SubContent></DropdownMenu.Sub
        >
        <DropdownMenu.Item disabled>Delete project · owner only</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal
    ></DropdownMenu.Root
  >
  <p class="vict-control-help">Watching: {watching ? 'yes' : 'no'} · Sort: {sort}</p>
</Example>
<Example family="popover" title="Popover">
  <Popover.Root
    ><Popover.Trigger>Sharing details</Popover.Trigger><Popover.Portal
      ><Popover.Content sideOffset={8}>
        <div class="vict-control-stack" style="padding: 12px">
          <strong>Visible to the Product team</strong>
          <p>Only invited members can edit this brief.</p>
          <Popover.Close>Close details</Popover.Close>
        </div>
      </Popover.Content></Popover.Portal
    ></Popover.Root
  >
</Example>
<Example family="tooltip" title="Tooltip">
  <Tooltip.Provider delayDuration={100}
    ><Tooltip.Root
      ><Tooltip.Trigger aria-label="Explain review time">Review time ⓘ</Tooltip.Trigger
      ><Tooltip.Portal
        ><Tooltip.Content role="tooltip" sideOffset={8}
          >Most requests are reviewed within two working days.</Tooltip.Content
        ></Tooltip.Portal
      ></Tooltip.Root
    ></Tooltip.Provider
  >
</Example>
<p role="status" data-testid="catalog-action-result">{result}</p>
