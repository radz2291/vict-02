# Structure test repair and keyboard behavior

Owner request: repair the12 inherited failing tests without weakening their
behavioral checks, investigate real defects, verify the affected suite and close.
Starting checkpoint:68e27fbf; installed product at task start:20e26253.

**CLOSED — all12 targeted failures repaired and verified.**
Installed product: `a629b40818ba367daf79850c80d9abb7fe02df1c`.
This maintenance follow-up preserves the earlier bounded Option2 closure and
does not award a new whole-foundation independent review or broader milestone closure.

## Retained behavior checks

| Original failures | Repair |
| --- | --- |
| Two label assertions | Expect Studio's explicit Agreement/Submit presentation while retaining canonical controlling-state identity, declaration semantics and source-preservation checks. |
| Three Designer commands | Read the supported canonical source panel rather than querying preview elements through the parent DOM. Verify exact clone content/bindings, placement under the original parent, exact text-leaf ownership, single-step Undo, unchanged stored screen, and unchanged working source after discarding a blocked draft. |
| Seven Structure cases | Exercise Object → Inspect, the current Fit all launcher, actual disabled controls plus defensive keyboard refusal, state-to-Data handoff, scoped Escape/focus restoration, and move-dialog acknowledgement/refusal. Assert dialog.open rather than requiring removal of a retained dialog element. |

No original case is skipped or deleted. Duplicate and Undo still run through
Designer commands and its real EditorBridge; they are not mocked operations.

## Real defects uncovered

The corrected inspection tests exposed Escape consuming a node's relationship
highlight before closing inspection. A subsequent node Escape also bypassed the
normal deselection callback. Shared handling now closes inspection first and
distinguishes connection-group tracing from ordinary node selection.

Focus restoration also targeted menu content that remained connected while
hidden. It now remembers the visible menu launcher and rejects hidden/inert
return targets. The capture handler additionally ignores nodes outside its own
Structure root, protecting other canvas instances.

Tests retain selected identity and focus assertions, add grouped-connection
Escape priority/clearing, and challenge an outside canvas node. Move tests now
check both refused and acknowledged requests. The first repaired-suite failures
remain evidence; later test-harness corrections for an empty fixture and
unmeasured SVG edges are recorded separately from product defects.

## Verification

Raw logs are retained in
[the evidence directory](foundation-evidence/structure-test-repair-20261101/).
The original12 baseline failures remain historical observations in the prior
shared-Structure delivery record. They must not be described as current failures
after this repair passes. Whole-repository test health is a separate scope.

- **31/31 tests across six files pass**, including all25 existing cases in the
  three original files, one added grouped-connection Escape case, and five
  adjacent connection/public-package cases. No cases were skipped or removed.
- Final Studio type checking and changed-test/verifier ESLint pass.
- The shared package check passes with0 errors and5 existing warnings. Studio
  production build passes. Existing Svelte/shortcut warnings and unavailable
  localhost fixture requests remain visible in raw logs; none is counted as a
  failed test or an asserted production service result.
- The isolated consumer passes4/4 DOM checks and its production build. Nine
  installed packages/645 nonmanifest files match; Structure is freshly checked
  and packed, eight unchanged packages are exact verified reuse.
- Native installed-consumer Escape closes inspection first, restores focus to
  visible Object, retains both selected edges, then clears the group on the next
  Escape. Activated Studio likewise closes its host-owned Selection pane first,
  retains the selected source, and then clears it through the node Escape path.
- The user's currently open Evidence desk r1.r7 source is byte-identical before
  and after activation. No authored document edit or Save was performed.

Seal SHA256:
`2ce5498b2d0b954a2100802cd1121df965a2266ea1019ee03bce6e5894b051f1`.
The integrator's reproducible pre/post checks match343 staged inputs,398 installed
files,93 retained historical proof files and the complete398-file previous build.
The preserved20 build is at
`C:/Users/RZ1/AppData/Local/Temp/vict-pre-structure-tests-20e26253-20261101-build`.
These are explicitly integrator checks, separate from the earlier independent
review of20e26253. No push, main merge or publication occurred.

The browser connection initially rejected stale controls; a supported control
reset restored the existing tab. No PC restart or replacement of the user's
document was needed. An extra test fixture initially had no relationships, then
incorrectly relied on unmeasured SVG edge mounting; those failed harness runs
remain alongside the final green run.
