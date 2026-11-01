# Independent compact port presentation repair review

Source reviewed: `14973bc5e9faba4426164f98ae06b5b33ea3dd95`.
Pre-polish source: `3dfdde4ecb5567bc03130426482076d5344e3530`.

**Source PASS for the bounded appearance repair; successor native/artifact proof
is separate.** Runtime product differences are exactly two Flow Svelte CSS files.
No production/runtime script logic, descriptors, compatibility pins, saved schemas
or Studio runtime paths changed. The same commit also records proof-harness/test
cleanup outside production, whose scope must not be confused with runtime logic.

Integrator-native `12-compact-before.json` demonstrated two concrete defects:
the new label button's `font:inherit` overrode the intended12px label size to14px;
an empty side still occupied half the grid. Crop's name wrapped at its compact
authored width. These are retained failed presentation observations, not a claim
that all3df native/data checks failed.

The repair replaces the font shorthand with inherited family/weight/line-height,
leaving the existing12px label rule effective. It hides an empty column and uses
one track only when a direct child column is empty; mixed input/output columns
retain their two tracks. The observed prior DOM already reports `:empty` true,
so the selector addresses actual rendered slots rather than an assumed snippet
presence flag. Reference sockets, row registration, owning handles and all graph
admission/history behavior are untouched.

Row@1's default span remains unchanged. Row@2 and the existing explicit r1.r18
application adoption need no source migration or new agent edit. Its authoring
receipts remain attributed to3df; final149 rendering must receive fresh native
font/grid/boundary checks. Prior source/parity, source preservation, Structure
move/Undo and app Save/export/reopen evidence remain reusable at their exact scope.

No new physical-device, universal typography/accessibility or performance claim
is awarded by this source-only review.

## Rhea cascade follow-up

Source149 was not accepted for closure: integrator-native
`13-compact-after.json` confirmed one-sided collapse, but actual font size remained
14px. Rhea's `.vict-rhea.vict-rhea :where(button,input,select,textarea){font:inherit}`
at `ui-svelte/src/rhea.css:52` has specificity(0,2,0), equal to the compiled149
single-label selector; its later shorthand resets font size. This is a retained
failed native observation, not a relabeled12px pass.

Successor source `11200357a0883dda7f2b35637901c4e217eb01b9` changes only the
production label selector to `.graph-port-row .port-row-label`. Independent Svelte
compilation yields `.graph-port-row.svelte-hash .port-row-label:where(.svelte-hash)`,
specificity(0,3,0), which outranks that ordinary reset independent of load order.
Explicit authored part declarations still receive `!important` through
`ui-svelte/src/document/logic.ts:154/189`, so the stronger default does not remove
the public part-style override boundary.

**Source PASS for112's bounded cascade correction.** No production/runtime script,
API, descriptor, schema or application-source edit is introduced. Real host-context
native font/grid confirmation and exact successor artifact verification remain
required before integration closure. The isolated consumer fixture now includes
Rhea plus the actual14px parent context, preserving the regression trigger.
