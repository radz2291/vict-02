<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Plus from '@lucide/svelte/icons/plus';
  import FileText from '@lucide/svelte/icons/file-text';
  import Search from '@lucide/svelte/icons/search';
  import Info from '@lucide/svelte/icons/info';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import * as Trace from './upstream/ui/trace/index.js';
  import * as CodeBlock from './upstream/ui/code-block/index.js';
  import * as MessageScroller from './upstream/ui/message-scroller/index.js';
  import * as Message from './upstream/ui/message/index.js';
  import * as Bubble from './upstream/ui/bubble/index.js';
  import * as InputGroup from './upstream/ui/input-group/index.js';
  import * as Marker from './upstream/ui/marker/index.js';
  import * as Item from './upstream/ui/item/index.js';
  import * as HoverCard from './upstream/ui/hover-card/index.js';
  import * as Collapsible from './upstream/ui/collapsible/index.js';
  import * as Tooltip from './upstream/ui/tooltip/index.js';
  import * as DropdownMenu from './upstream/ui/dropdown-menu/index.js';
  import * as Attachment from './upstream/ui/attachment/index.js';
  import { Button } from './upstream/ui/button/index.js';
  import { Badge } from './upstream/ui/badge/index.js';
  import { Progress } from './upstream/ui/progress/index.js';
  import { Input } from './upstream/ui/input/index.js';
  import { Textarea } from './upstream/ui/textarea/index.js';
  import { Separator } from './upstream/ui/separator/index.js';
  import Markdown from './upstream/markdown/markdown.svelte';

  const instance = $props.id();
  const buttonVariants = ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const;
  const textSizes = ['xs', 'sm', 'default', 'lg'] as const;
  const iconSizes = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;
  const bubbleVariants = ['default', 'secondary', 'muted', 'tinted', 'outline', 'ghost', 'destructive'] as const;
  const code = 'const greeting = "Hello, VICT";\nconsole.log(greeting);';
  const diffCode = 'const oldName = "world";\n' + code + '\n// Plain line';
  let action = $state('No local action yet.');
  let input = $state('Editable local text');
  let notes = $state('This text remains only in this showcase.');
  let reaction = $state(0);
  let progress = $state(45);
  let checks = $state<string[]>(['details']);
  let density = $state('comfortable');
  let attachmentVisible = $state(true);
  let messages = $state(Array.from({ length: 8 }, (_, index) => ({ id: `example-${index}`, text: `Local message ${index + 1}` })));
</script>

{#snippet heading(title: string, parts: string, description: string)}
  <div class="flex flex-col gap-1">
    <h3 class="text-lg font-semibold">{title}</h3>
    <p class="text-sm text-muted-foreground">{description}</p>
    <p class="text-xs text-muted-foreground"><span class="font-medium">Parts:</span> {parts}</p>
  </div>
{/snippet}

<div class="vict-ai flex min-w-0 flex-col gap-6" data-primitive-showcase>
  <header class="flex flex-col gap-2">
    <h2 class="text-2xl font-semibold">UI building blocks</h2>
    <p class="text-sm text-muted-foreground">19 visual families, composed from the pinned upstream components. Controls change local examples only. Part names refer to canonical exports; their long-form aliases use the same components.</p>
    <p role="status" aria-live="polite" class="text-sm">{action}</p>
  </header>

  <div class="grid min-w-0 gap-6 lg:grid-cols-2">
    <section data-ui-family="button" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Button', 'Root / Button', 'All variants and sizes, including labeled icon actions and disabled state.')}
      <div class="flex flex-wrap items-center gap-2">
        {#each buttonVariants as variant}<Button {variant} onclick={() => action = `${variant} button clicked locally.`}>{variant}</Button>{/each}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {#each textSizes as size}<Button {size} variant="outline" onclick={() => action = `${size} button clicked locally.`}>{size}</Button>{/each}
        {#each iconSizes as size}<Button {size} variant="secondary" aria-label={`Add (${size})`} onclick={() => action = `Add ${size} clicked locally.`}><Plus /></Button>{/each}
        <Button disabled>Disabled</Button>
      </div>
    </section>

    <section data-ui-family="badge" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Badge', 'Badge', 'Six variants, including an icon label. Status labels do not imply execution.')}
      <div class="flex flex-wrap gap-2">{#each buttonVariants as variant}<Badge {variant}>{variant}</Badge>{/each}<Badge variant="outline"><Check /> Reviewed fixture</Badge></div>
    </section>

    <section data-ui-family="bubble" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Bubble', 'Root, Group, Content, Reactions', 'All seven visual variants; a local reaction is composed beneath the final bubble.')}
      <Bubble.Group>
        {#each bubbleVariants as variant}<Bubble.Root {variant}><Bubble.Content>{variant} bubble</Bubble.Content></Bubble.Root>{/each}
        <Bubble.Root variant="muted">
          <Bubble.Content>React to this local example.</Bubble.Content>
          <Bubble.Reactions><Button size="xs" variant="outline" aria-label="Like local bubble" onclick={() => reaction += 1}>+1 {reaction}</Button></Bubble.Reactions>
        </Bubble.Root>
      </Bubble.Group>
    </section>

    <section data-ui-family="message" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Message', 'Root, Group, Avatar, Content, Header, Footer', 'Grouped messages with initials avatars, headers, footers and opposite alignment. No remote avatar request.')}
      <Message.Group>
        <Message.Root>
          <Message.Avatar class="size-8 text-xs" aria-label="Example author initials">EV</Message.Avatar>
          <Message.Content>
            <Message.Header>Example author · 10:30</Message.Header>
            <Bubble.Root variant="muted"><Bubble.Content>A composed message.</Bubble.Content></Bubble.Root>
            <Message.Footer>Local fixture · delivered</Message.Footer>
          </Message.Content>
        </Message.Root>
        <Message.Root align="end"><Message.Content><Message.Header>You</Message.Header><Bubble.Root variant="default" align="end"><Bubble.Content>Reply example.</Bubble.Content></Bubble.Root><Message.Footer>Local fixture</Message.Footer></Message.Content></Message.Root>
      </Message.Group>
    </section>

    <section data-ui-family="message-scroller" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Message scroller', 'Provider, Root, Viewport, Content, Item, Button', 'Scroll within the bounded region. Scroll buttons appear when the corresponding edge is out of view; Provider supplies their shared context.')}
      <div class="h-48 min-h-0 rounded-xl border">
        <MessageScroller.Provider>
          <MessageScroller.Root>
            <MessageScroller.Viewport role="region" aria-label="Local message scroller" tabindex={0}>
              <MessageScroller.Content class="flex flex-col gap-4 p-4">
                {#each messages as message (message.id)}<MessageScroller.Item messageId={message.id}><Message.Root><Message.Content><Bubble.Root variant="muted"><Bubble.Content>{message.text}</Bubble.Content></Bubble.Root></Message.Content></Message.Root></MessageScroller.Item>{/each}
              </MessageScroller.Content>
            </MessageScroller.Viewport>
            <MessageScroller.Button direction="start" /><MessageScroller.Button direction="end" />
          </MessageScroller.Root>
        </MessageScroller.Provider>
      </div>
      <Button variant="outline" size="sm" onclick={() => messages = [...messages, { id: `example-${messages.length}`, text: `Local message ${messages.length + 1}` }]}>Append local message</Button>
    </section>

    <section data-ui-family="trace" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Trace', 'Root, Line, Icon, Title, Description, Collapsible, CollapsibleTrigger, CollapsibleContent', 'Complete, pending, running and error rows with a genuine disclosure.')}
      <Trace.Root>
        <Trace.Line><Trace.Icon><Check /></Trace.Icon><Trace.Title>Completed fixture</Trace.Title><Trace.Description>1s</Trace.Description></Trace.Line>
        <Trace.Line status="pending"><Trace.Icon><Info /></Trace.Icon><Trace.Title>Pending fixture</Trace.Title></Trace.Line>
        <Trace.Line status="running"><Trace.Icon><LoaderCircle class="animate-spin" /></Trace.Icon><Trace.Title>Running fixture</Trace.Title></Trace.Line>
        <Trace.Collapsible open><Trace.CollapsibleTrigger><Trace.Line status="error"><Trace.Icon><X /></Trace.Icon><Trace.Title>Failed fixture — toggle details</Trace.Title></Trace.Line></Trace.CollapsibleTrigger><Trace.CollapsibleContent>Escaped public error detail. No operation is running.</Trace.CollapsibleContent></Trace.Collapsible>
      </Trace.Root>
    </section>

    <section data-ui-family="code-block" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Code block', 'Root, Header, Title, Actions, CopyButton, Content, Line, Footer', 'Numbered source, explicit diff line variants, a clipboard action and footer. Copy uses the browser clipboard.')}
      <CodeBlock.Root size="sm">
        <CodeBlock.Header><CodeBlock.Title>example.ts</CodeBlock.Title><CodeBlock.Actions><CodeBlock.CopyButton value={diffCode} /></CodeBlock.Actions></CodeBlock.Header>
        <CodeBlock.Content lineNumbers wrap class="max-h-48">
          <CodeBlock.Line code={'const oldName = "world";'} variant="removed" />
          <CodeBlock.Line code={'const greeting = "Hello, VICT";'} variant="added" />
          <CodeBlock.Line code="console.log(greeting);" variant="highlighted" />
          <CodeBlock.Line code="// Plain line" />
        </CodeBlock.Content>
        <CodeBlock.Footer>Diff fixture · TypeScript</CodeBlock.Footer>
      </CodeBlock.Root>
      <CodeBlock.Root variant="destructive" size="sm"><CodeBlock.Content code="Error: example validation failed" wrap /></CodeBlock.Root>
    </section>

    <section data-ui-family="input-group" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Input group', 'Root, Addon, Button, Input, Text, Textarea', 'Inline and block addons, an editable input, multiline field and a local action.')}
      <InputGroup.Root>
        <InputGroup.Addon><Search /><InputGroup.Text>Find</InputGroup.Text></InputGroup.Addon>
        <InputGroup.Input aria-label="Grouped search" bind:value={input} />
        <InputGroup.Addon align="inline-end"><InputGroup.Button onclick={() => action = `Local search text: ${input}`}>Search</InputGroup.Button></InputGroup.Addon>
      </InputGroup.Root>
      <InputGroup.Root><InputGroup.Textarea aria-label="Grouped notes" bind:value={notes} /><InputGroup.Addon align="block-end"><InputGroup.Text>{notes.length} characters</InputGroup.Text><InputGroup.Button onclick={() => action = 'Grouped notes inspected locally.'}>Inspect</InputGroup.Button></InputGroup.Addon></InputGroup.Root>
      <InputGroup.Root><InputGroup.Input aria-label="Invalid grouped field" aria-invalid="true" value="Invalid fixture" /><InputGroup.Addon align="inline-end"><InputGroup.Text>Needs correction</InputGroup.Text></InputGroup.Addon></InputGroup.Root>
      <InputGroup.Root><InputGroup.Input aria-label="Disabled grouped field" disabled value="Disabled fixture" /></InputGroup.Root>
    </section>

    <section data-ui-family="input" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Input', 'Root / Input', 'Editable, invalid and disabled states with associated labels.')}
      <label for={`${instance}-input`}>Example name</label><Input id={`${instance}-input`} bind:value={input} />
      <label for={`${instance}-invalid`}>Invalid name</label><Input id={`${instance}-invalid`} aria-invalid="true" aria-describedby={`${instance}-input-error`} value="?" /><p id={`${instance}-input-error`} class="text-sm text-destructive">Example validation message.</p>
      <Input aria-label="Disabled name" value="Read-only fixture" disabled />
    </section>

    <section data-ui-family="textarea" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Textarea', 'Root / Textarea', 'Editable, invalid and disabled multiline states.')}
      <label for={`${instance}-notes`}>Example notes</label><Textarea id={`${instance}-notes`} bind:value={notes} />
      <Textarea aria-label="Invalid notes" aria-invalid="true" aria-describedby={`${instance}-notes-error`} value="Incomplete fixture" /><p id={`${instance}-notes-error`} class="text-sm text-destructive">Example validation message.</p>
      <Textarea aria-label="Disabled notes" disabled value="Disabled fixture" />
    </section>

    <section data-ui-family="marker" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Marker', 'Root, Icon, Content', 'Default, separator and border markers inside a conversation or activity list.')}
      {#each ['default', 'separator', 'border'] as const as variant}<Marker.Root {variant}><Marker.Icon><Info /></Marker.Icon><Marker.Content>{variant} marker</Marker.Content></Marker.Root>{/each}
    </section>

    <section data-ui-family="item" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Item', 'Root, Group, Separator, Header, Footer, Media, Content, Title, Description, Actions', 'A small list with metadata, an icon, a local action and a separator.')}
      <Item.Group>
        <Item.Root variant="outline"><Item.Header>Example collection</Item.Header><Item.Media variant="icon"><FileText /></Item.Media><Item.Content><Item.Title>Design notes</Item.Title><Item.Description>A local list item with supporting detail.</Item.Description></Item.Content><Item.Actions><Button size="sm" variant="outline" onclick={() => action = 'Design notes selected locally.'}>Select</Button></Item.Actions><Item.Footer>Updated in this fixture</Item.Footer></Item.Root>
        <Item.Separator />
        <Item.Root size="sm"><Item.Content><Item.Title>Second item</Item.Title><Item.Description>Compact list row</Item.Description></Item.Content></Item.Root>
      </Item.Group>
    </section>

    <section data-ui-family="attachment" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Attachment', 'Root, Group, Media, Content, Title, Description, Trigger, Actions, Action', 'A real overlay trigger and independent remove action. Upload/error labels are fixtures; no files are uploaded.')}
      <Attachment.Group>
        {#if attachmentVisible}<Attachment.Root><Attachment.Media><FileText /></Attachment.Media><Attachment.Content><Attachment.Title>notes.txt</Attachment.Title><Attachment.Description>Text · local fixture</Attachment.Description></Attachment.Content><Attachment.Trigger aria-label="Inspect notes attachment" onclick={() => action = 'notes.txt selected locally.'} /><Attachment.Actions><Attachment.Action aria-label="Remove notes attachment" onclick={() => { attachmentVisible = false; action = 'Attachment removed from this example.'; }}><X /></Attachment.Action></Attachment.Actions></Attachment.Root>{/if}
        {#each ['idle', 'uploading', 'processing', 'error'] as const as state}<Attachment.Root {state} size="sm"><Attachment.Media><FileText /></Attachment.Media><Attachment.Content><Attachment.Title>{state}.txt</Attachment.Title><Attachment.Description>{state} fixture</Attachment.Description></Attachment.Content></Attachment.Root>{/each}
      </Attachment.Group>
      {#if !attachmentVisible}<Button size="sm" variant="outline" onclick={() => attachmentVisible = true}>Restore attachment example</Button>{/if}
    </section>

    <section data-ui-family="progress" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Progress', 'Root / Progress', 'Determinate progress with an accessible label and local adjustment.')}
      <Progress value={progress} aria-label="Example progress" /><p class="text-sm">{progress}% fixture progress</p>
      <div class="flex gap-2"><Button size="sm" variant="outline" onclick={() => progress = Math.max(0, progress - 10)}>Decrease</Button><Button size="sm" variant="outline" onclick={() => progress = Math.min(100, progress + 10)}>Increase</Button></div>
    </section>

    <section data-ui-family="collapsible" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Collapsible', 'Root, Trigger, Content', 'A provider and trigger compose one keyboard-operable disclosure.')}
      <Collapsible.Root><Collapsible.Trigger>{#snippet child({ props })}<Button {...props} variant="outline">Toggle local details</Button>{/snippet}</Collapsible.Trigger><Collapsible.Content class="pt-3 text-sm">This content is controlled by the upstream Collapsible context.</Collapsible.Content></Collapsible.Root>
    </section>

    <section data-ui-family="tooltip" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Tooltip', 'Provider, Root, Trigger, Content, Portal (inside Content)', 'Hover or focus the trigger. Content mounts through its upstream Portal; no nested standalone portal is needed.')}
      <Tooltip.Provider delayDuration={100}><Tooltip.Root><Tooltip.Trigger>{#snippet child({ props })}<Button {...props} variant="outline" size="icon" aria-label="About tooltip example"><Info /></Button>{/snippet}</Tooltip.Trigger><Tooltip.Content>Tooltip content in a portal</Tooltip.Content></Tooltip.Root></Tooltip.Provider>
    </section>

    <section data-ui-family="hover-card" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Hover card', 'Root, Trigger, Content, Portal (inside Content)', 'Hover or focus to preview contextual content. The content uses the existing portal composition.')}
      <HoverCard.Root openDelay={100}><HoverCard.Trigger>{#snippet child({ props })}<Button {...props} variant="link">Preview local record</Button>{/snippet}</HoverCard.Trigger><HoverCard.Content><p class="font-medium">Local preview</p><p class="text-sm text-muted-foreground">Contextual information without navigation or a network request.</p></HoverCard.Content></HoverCard.Root>
    </section>

    <section data-ui-family="dropdown-menu" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Dropdown menu', 'Root, Trigger, Content, Portal, Group, GroupHeading, Label, Item, Shortcut, Separator, CheckboxGroup, CheckboxItem, RadioGroup, RadioItem, Sub, SubTrigger, SubContent', 'Open the portaled menu to use checkbox/radio selections and a submenu. Portals are composed internally by Content and SubContent.')}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>{#snippet child({ props })}<Button {...props} variant="outline">Open example menu</Button>{/snippet}</DropdownMenu.Trigger>
        <DropdownMenu.Content class="w-64">
          <DropdownMenu.Label>Local controls</DropdownMenu.Label>
          <DropdownMenu.Group><DropdownMenu.GroupHeading>Actions</DropdownMenu.GroupHeading><DropdownMenu.Item onSelect={() => action = 'Menu item selected locally.'}>Inspect<DropdownMenu.Shortcut>↵</DropdownMenu.Shortcut></DropdownMenu.Item><DropdownMenu.Item disabled>Unavailable fixture action</DropdownMenu.Item></DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.CheckboxGroup bind:value={checks}><DropdownMenu.GroupHeading>Visible detail</DropdownMenu.GroupHeading><DropdownMenu.CheckboxItem value="details">Details</DropdownMenu.CheckboxItem><DropdownMenu.CheckboxItem value="timestamps">Timestamps</DropdownMenu.CheckboxItem></DropdownMenu.CheckboxGroup>
          <DropdownMenu.Separator />
          <DropdownMenu.RadioGroup bind:value={density}><DropdownMenu.GroupHeading>Density</DropdownMenu.GroupHeading><DropdownMenu.RadioItem value="comfortable">Comfortable</DropdownMenu.RadioItem><DropdownMenu.RadioItem value="compact">Compact</DropdownMenu.RadioItem></DropdownMenu.RadioGroup>
          <DropdownMenu.Sub><DropdownMenu.SubTrigger>More examples</DropdownMenu.SubTrigger><DropdownMenu.SubContent><DropdownMenu.Item onSelect={() => action = 'Submenu action selected locally.'}>Local submenu action</DropdownMenu.Item></DropdownMenu.SubContent></DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <p class="text-sm">Selection: {checks.join(', ') || 'none'} · {density}</p>
    </section>

    <section data-ui-family="separator" class="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
      {@render heading('Separator', 'Root / Separator', 'Horizontal and vertical separators use the same primitive with explicit orientation.')}
      <p class="text-sm">Above</p><Separator /><p class="text-sm">Below</p>
      <div class="flex h-8 items-center gap-4 text-sm"><span>Left</span><Separator orientation="vertical" /><span>Right</span></div>
    </section>
  </div>

  <section data-ui-utilities class="flex min-w-0 flex-col gap-3 rounded-2xl border p-4">
    <h3 class="text-lg font-semibold">Nonvisual utilities and export aliases</h3>
    <p class="text-sm text-muted-foreground">use-highlighted-code and highlighter are internal utilities, not standalone UI families. Highlighting is represented through the safe Markdown composition below. The MessageScroller hooks require its Provider and support the scroller example; they are not standalone controls. Variant factories and TypeScript types describe these components. Long-form export aliases refer to the same displayed parts.</p>
    <Markdown content={'```typescript\n' + code + '\n```'} />
  </section>
</div>
