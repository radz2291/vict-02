<script lang="ts">
  import { AspectRatio } from '@victframework/ui-svelte/catalog/aspect-ratio';
  import { Collapsible } from '@victframework/ui-svelte/catalog/collapsible';
  import { Label } from '@victframework/ui-svelte/catalog/label';
  import { LinkPreview } from '@victframework/ui-svelte/catalog/link-preview';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  import { ScrollArea } from '@victframework/ui-svelte/catalog/scroll-area';
  import { Separator } from '@victframework/ui-svelte/catalog/separator';
  import { Toolbar } from '@victframework/ui-svelte/catalog/toolbar';
  import Example from './Example.svelte';
  let output = $state('Document ready.');
  let showChanges = $state(true);
</script>

<Example family="aspect-ratio" title="Aspect ratio">
  <AspectRatio.Root ratio={16 / 9}
    ><div
      class="vict-control-panel"
      style="height:100%; display:grid; place-items:center; background:var(--vict-control-selected)"
    >
      Project cover · 16:9
    </div></AspectRatio.Root
  >
</Example>
<Example family="collapsible" title="Collapsible">
  <Collapsible.Root
    ><Collapsible.Trigger>Show handoff checklist</Collapsible.Trigger><Collapsible.Content
      ><ul>
        <li>Confirm the receiving team.</li>
        <li>Attach the latest brief.</li>
        <li>Agree on the review date.</li>
      </ul></Collapsible.Content
    ></Collapsible.Root
  >
</Example>
<Example family="label" title="Label">
  <Label.Root for="project-code">Project code</Label.Root><input
    id="project-code"
    class="vict-input"
    placeholder="For example, ONBOARD-26"
  />
  <p class="vict-control-help">Clicking the label focuses its associated field.</p>
</Example>
<Example family="link-preview" title="Link preview">
  <LinkPreview.Root openDelay={150}
    ><LinkPreview.Trigger href="/workspace">Product team workspace</LinkPreview.Trigger
    ><LinkPreview.Portal
      ><LinkPreview.Content sideOffset={8}
        ><div class="vict-control-stack" style="padding:12px">
          <strong>Product team</strong>
          <p>Shared conversation, review notes, and the next decisions.</p>
          <a href="/workspace">Open workspace</a>
        </div></LinkPreview.Content
      ></LinkPreview.Portal
    ></LinkPreview.Root
  >
  <p class="vict-control-help">
    Preview on hover or keyboard focus; the link works directly on touch.
  </p>
</Example>
<Example family="menubar" title="Menubar">
  <Menubar.Root aria-label="Document menus">
    <Menubar.Menu
      ><Menubar.Trigger>Document</Menubar.Trigger><Menubar.Portal
        ><Menubar.Content sideOffset={6}
          ><Menubar.Item onSelect={() => (output = 'Brief duplicated.')}
            >Duplicate brief</Menubar.Item
          ><Menubar.Item onSelect={() => (output = 'Document export started.')}
            >Export document</Menubar.Item
          ></Menubar.Content
        ></Menubar.Portal
      ></Menubar.Menu
    >
    <Menubar.Menu
      ><Menubar.Trigger>View</Menubar.Trigger><Menubar.Portal
        ><Menubar.Content sideOffset={6}
          ><Menubar.CheckboxItem bind:checked={showChanges}>Show changes</Menubar.CheckboxItem
          ><Menubar.Item disabled>Version comparison · unavailable</Menubar.Item></Menubar.Content
        ></Menubar.Portal
      ></Menubar.Menu
    >
  </Menubar.Root><span role="status">{output}</span>
</Example>
<Example family="scroll-area" title="Scroll area">
  <ScrollArea.Root type="always" style="height:180px"
    ><ScrollArea.Viewport tabindex={0} aria-label="Recent project activity"
      ><ol style="padding:16px 36px; margin:0">
        {#each Array.from({ length: 16 }, (_, index) => index + 1) as index}<li
            style="padding-block:5px"
          >
            Review note {index} added to the brief.
          </li>{/each}
      </ol></ScrollArea.Viewport
    ><ScrollArea.Scrollbar orientation="vertical"><ScrollArea.Thumb /></ScrollArea.Scrollbar
    ></ScrollArea.Root
  >
</Example>
<Example family="separator" title="Separator">
  <p>Project team</p>
  <Separator.Root />
  <p>Workspace settings</p>
  <div class="vict-control-row">
    <span>Private</span><Separator.Root orientation="vertical" /><span>3 members</span>
  </div>
</Example>
<Example family="toolbar" title="Toolbar">
  <Toolbar.Root aria-label="Brief editing tools"
    ><Toolbar.Button onclick={() => (output = 'Brief saved.')}>Save brief</Toolbar.Button
    ><Toolbar.Group type="multiple" aria-label="Text style"
      ><Toolbar.GroupItem value="bold" aria-label="Bold text">B</Toolbar.GroupItem
      ><Toolbar.GroupItem value="italic" aria-label="Italic text">I</Toolbar.GroupItem
      ></Toolbar.Group
    ><Toolbar.Link href="/requests">Requests</Toolbar.Link><Toolbar.Button disabled
      >Publish</Toolbar.Button
    ></Toolbar.Root
  >
  <p class="vict-control-help">Use arrow keys to move between tools; disabled tools are skipped.</p>
</Example>
