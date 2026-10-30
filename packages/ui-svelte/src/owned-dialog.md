# Application-owned dialog content

`OwnedDialogContent` and `createOwnedDialogBehavior` are public coded-consumer infrastructure exported by `@victframework/ui-svelte`. They are not a new authored identity or an application state/history engine. Registered components such as `vict.pattern.drawer@1` compose them behind their existing canonical props, outputs and part targets. Existing document-modal `Overlay` and `CatalogDialog@1` behavior/pins are unchanged.

Use this adapter when a dialog belongs to one application element while other applications or Studio controls in the same document remain operable. It renders a named native `role="dialog"` and deliberately omits `aria-modal="true"`: it does not make the whole document modal. Shared catalog CSS and caller-supplied presentation attributes/style remain on the actual content element.

```svelte
<script lang="ts">
  import {OwnedDialogContent} from '@victframework/ui-svelte';
  import {Dialog} from '@victframework/ui-svelte/catalog/dialog';
  let open=$state(false),owner=$state<HTMLElement>(),trigger=$state<HTMLButtonElement|null>(null);
  const id=$props.id(),titleId=`${id}-title`;
</script>
<main class="vict-controls vict-rhea" data-ui-application-viewport bind:this={owner}>
  <Dialog.Root bind:open>
    <Dialog.Trigger bind:ref={trigger}>
      {#snippet child({props})}<button {...props} aria-controls={open?id:undefined}>Open</button>{/snippet}
    </Dialog.Trigger>
    {#if open}
      <Dialog.Overlay />
      <OwnedDialogContent {id} {owner} {trigger} aria-labelledby={titleId} onRequestClose={()=>open=false}>
        <Dialog.Title id={titleId}>Application dialog</Dialog.Title>
        <Dialog.Close>Close</Dialog.Close>
      </OwnedDialogContent>
    {/if}
  </Dialog.Root>
</main>
```

Load public `styles.css`, `catalog.css`, then optional `rhea.css`. The host owns overlay placement/clipping; the Drawer supplies its sheet geometry. `owner` must be the actual same-document containing element, or omission resolves the closest `[data-ui-application-viewport]`. A nested marked/registered application is a different owner even when it is a DOM descendant. Missing ownership reports an inline error; it never falls back to a body-wide scope. Supply meaningful `aria-label` or `aria-labelledby`, stable content/title IDs, and the public Trigger child API to preserve library handlers/ref attachments while explicitly wiring `aria-controls` to the owned content ID.

`onRequestClose('escape'|'outside')` requests an update of the host's existing controlled `open` state. `dismissible=false` preserves the layer on Escape/outside input; the explicit public Close control still works. The adapter adds focus/key/pointer listeners only to its owner. Its stack and optional scroll lock are keyed by that exact element. Nested dialogs in one owner use the top layer; independent applications do not share layer arbitration. No document/body scroll or user-select lock is introduced. `lockScroll` is opt-in and restores only the owner's previous overflow after its last layer releases.

Tab boundaries use actual visible/eligible controls, exclude hidden/inert/disabled and nested-application content, retain positive tabindex order, and respect radio name/form/tree groups. A checked radio elsewhere in that native group can exclude an owned Tab stop; it never grants focus or portal authority outside the owner. Initial/return focus also requires `document.hasFocus()` and a verified active same-origin embedding frame chain. Inactive or cross-origin/unverifiable embedding skips automatic focus rather than speculating. Return focus never overrides a sibling application's current focus.

For a public catalog Select/Popover portaled inside the same owner, the adapter recognizes only rendered popup roles with an exact renderer-issued `data-ui-owner` and `data-ui-occ` pairing. A live ARIA control/ownership/description/active-option relation supplies the link. Expanded popup triggers lacking a control ID require one unique exact occurrence/declared-role match; closed, ambiguous, mismatched, nested-application and foreign-document branches are rejected. Coded hosts may supply exact `branches` element references, subject to the same actual owner/document boundary. This is not blanket permission for every portal. A verified open child popup retains its own library Escape handling before the owned dialog handles a later Escape.

This adapter does not rewrite pre-existing child popup implementations or certify their own document-level Escape/focus policies. Cross-origin embedded content and closed shadow trees retain their own interaction boundaries; no arbitrary descendant-frame control is introduced. DOM tests are supporting evidence, not native browser, assistive-technology, physical-device or owner acceptance.
