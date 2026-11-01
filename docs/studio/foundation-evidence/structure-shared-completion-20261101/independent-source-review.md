# Independent Option 2 source review

Reviewer: `/root/structure_independent_review`, 1 November 2026.

## Initial result: repair required

Reviewed product candidate `c39e6aa739b9801e16f81666387c635feca42d80`, following
initial extraction `54e7357d9832f3d0985409ede9fcde38f415693d`. Baseline is
`f483088f29785f973ffa1bb5131081c0936e1b47`. This is a source/parity review, not a
native browser/device observation or whole-task closure verdict.

**F1, medium: missing host presentation context in rendered card summaries.**
The shared explorer's card-data construction calls `structureNodePresentation`
without `context`, although the helper recomputes conditional/repeat summaries
using `context.presentation.displayName`. Therefore a caller's friendly state
names are honored by projection and inspection, then discarded by the actual
card renderer. The direct Studio helper wrapper added in c39 does not repair
this internal shared call. Forward context consistently in every internal
presentation call and verify an actual mounted conditional card with a custom
state label. The initial observation must remain after repair.

The inspector facts call also omits descriptor/action context. That omission is
inherited from the baseline, rather than newly introduced by extraction; forwarding
the existing context is a compatible correction during the same repair.

## Independently checked boundaries

- The optional public Structure package depends on editor and flow; neither
  package depends back on Structure. No private Studio import was found in its
  implementation. Studio retains thin labels/context/navigation/transaction
  adapters rather than a second implementation.
- All 23 declared relation roles and visitor logic remain. The semantics diff
  consists of optional presentation callbacks and forwarding them to condition/
  branch descriptions. Grouping/tracing/geometry/placement and selection helpers
  preserve the original implementation and identities.
- Reference handles explicitly disable connect/start/end. Separate move handles
  are enabled only in move mode. Exact document/revision/occurrence checks precede
  existing `moveRelative` transaction drafts; no independent canonical graph,
  persistence store, history or execution authority was introduced.
- Port row@1's descriptor and visible-type default remain pinned. Row@2 is an
  explicit new identity with names-only default and public `showType`; type
  details remain in accessible labels and keyboard/hover disclosure. Independent
  column slots preserve ordinary application-owned composition. Actual measured
  geometry and saved-app adoption require separate live evidence.
- The layout helper respects explicit ELK/Dagre at every size and retains the
  generation fence. Removing the forced engine override does not promise large
  ELK latency or universal layout performance.

## Independent cross-baseline experiment

Seven cases pass against old baseline modules extracted into a fresh temporary
directory: binding, definition, repeat, scoped output, style, clarity, and the
preserved actual Campaign Foundry r1.r17 source. The final run additionally
compares direct node presentation. Checks cover exact projected nodes/edges,
compact projection, port/member groups, source facts, search/filter/collapse,
focused disclosure including Infinity, and unchanged canonical source.

Command: `npx vitest run --config docs/studio/foundation-evidence/structure-shared-completion-20261101/independent-parity.config.ts`.
Recorded final pure-parity run: **7/7 pass**, Vitest4.1.11, 57.02 seconds total,
1.76 seconds of test execution. This is additional source parity evidence; do not
sum it with overlapping builder cases as unique coverage.

The first verifier-only collection attempt failed on an untransformed Bits
`.svelte` dependency. The evidence config was corrected to inline the same
dependencies as the existing Flow test setup; no product change was made for
that collection failure. Windows line endings in extracted baseline TS files
are normalized by Git; declarations/logic come from the exact baseline commit.

## Repair and affected recheck

Final reviewed source: `3dfdde4ecb5567bc03130426482076d5344e3530`.
The four omitted internal presentation calls now forward context; inspector facts
also receive `{descriptors,...context}`. Optional downstream host destinations
are hidden when no `onNavigate` callback exists, while the Studio adapter supplies
that callback. No source schema, command authority or history ownership changed.

F1 is **resolved**. The actual mounted conditional card first failed on c39:
`Shown when Accepted is on · 1 item` did not include `Friendly consent`.
The identical assertion passes on3df, along with all seven old/new parity cases:
**8/8 across two files**, log `independent-repaired-final.log`. The source remains
unchanged through rendering. Existing five ui-svelte transformation warnings
remain; no universal accessibility or performance verdict is awarded.

Two additional mounted-explorer navigation cases pass on the same source,
`independent-navigation.log`: a standalone caller sees no unavailable host
destinations; supplying `onNavigate` retains Reveal in Layers and delivers the
exact selected source identity to that callback. These are DOM-fixture checks,
not native-browser or actual-agent actions.

The builder's matched baseline logs were independently inspected. Original f483
reproduces the same three Designer-mounted toolbar failures and seven older
Structure UI expectations, with the same nine toolbar checks passing. A separate
baseline clarity run reproduces two alias expectations (`Agreement` versus
`Accepted`, `Requests Submit` versus `Requests Submit (simulated)`). These are
retained inherited failures, **not passing regression cases**. The first baseline
clarity collection attempt also failed and was retained before the corrected
comparison. Additional source parity above provides a direct old/new comparison
rather than assuming those red assertions are harmless.

**Final source verdict: QUALIFIED PASS.** No unresolved source blocker remains in
the inspected Option2 extraction, compatibility or context repair. This verdict
does not award full integration closure. Installed public-artifact proof,
production build/seal, native Structure and port interaction, actual-agent app
adoption, Save/reopen/export, and scoped closure remain separate evidence. Existing
Android evidence does not become a new physical-device test of this candidate.
