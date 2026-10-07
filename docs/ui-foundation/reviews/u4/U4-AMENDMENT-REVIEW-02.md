# U4 COMPONENT-AMENDMENT REPAIR — INDEPENDENT CONTRACT REVIEW (R2; repair round 1)

- Reviewer: fresh independent reviewer; authored none of the reviewed material; review-only (repo untouched; working tree left as found).
- Candidate tested: `0ad3a2a6a9abd0a8dbd3ae361f7db190634071bf` (branch `codex/ui-foundation-u4-component-amendment`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u4-handoff`, tree clean; branch ahead of origin by 1).
- Base for delta: `24347a0`. Delta: `git diff 24347a0..0ad3a2a -- docs/ui-foundation` (15 files, +651/−83; all under `docs/ui-foundation/**`).
- Legacy reference: `952d92da5131d6ab595b45b3bf18bc7ce3b3466d`.
- Method: falsification. Every claim below was checked against `git show` source bytes, fixture bytes, or an independent re-run — not against the amendment's own prose.

## A. Legacy Checkbox counterexample — CONFIRMED

1. **Source truth.** `git show 952d92d:packages/ui-svelte/src/document/extensions.ts` → `resolveSvelteExtension` reads exactly: `id`+`revision` (descriptor match, lines ~46–51), `events`/`slots` (fail-closed gate, line 58: `(descriptor.events?.length ?? 0) > 0 || (descriptor.slots?.length ?? 0) > 0` → `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`), and `extensionId`/`revision`/`rendererImplementationId` (impl match, ~66–74). `abi` and `outputs` are **never referenced** anywhere in the file. The amendment §4.3 sentence "reads only id, revision, events, slots and rendererImplementationId; abi/outputs are silently ignored" is byte-true.
2. **Shipped copy is faithful.** `docs/ui-foundation/reviews/u4/abi-probe/extensions.legacy.ts` (3074 bytes) is identical, comments included, to the `git show` extraction I pulled independently.
3. **Probe evidence consistent with source.** `probe-output.txt` (5/5 PASS) matches what the source must do: marker-less abi+outputs descriptor ACCEPTED (C1), marker-bearing descriptor rejected by the legacy gate itself (C2), props-only ACCEPTED (C3), untyped-event descriptor rejected (C4), no-impl `UI_RENDER_EXTENSION_UNAVAILABLE` (C5).
4. **Independent re-derivation (my own harness, temp dir, repo untouched).** I extracted the legacy file via `git show`, hand-stripped only type syntax to `.mjs`, transcribed the **pre-repair** fixture descriptor from `git show 24347a0:docs/ui-foundation/fixtures/component-contract/checkbox-valid.json` (confirms the frozen fixture as first published had `abi`+`outputs`, **no** `events`/`slots`), and re-ran C1–C5: **5/5 outcomes match the recorded probe** (`C:/Users/RZ1/AppData/Local/Temp/u4-r2-rederive/`). C2 independently re-derived: descriptor + `events:["vict.ui-component-abi@1"]` → `ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`, raised by the legacy code itself.
5. The pre-repair freeze claim ("old renderer rejects via the descriptor `abi` field") is thereby falsified exactly as the repair states.

**MINOR-1 (reproducibility of the committed harness, not honesty):** `probe.mjs` as committed (a) imports `./extensions.legacy.mjs`, which is **not committed** (only the `.ts`), and (b) takes C1's descriptor from `./checkbox-valid.json` as-is, expecting it marker-less — but the repaired committed fixture now carries the marker, so a verbatim re-run today yields C1=FAIL (4/5). The recorded run corresponds to the pre-repair fixture (`24347a0`; `abi-compat-probe.json` C1 "input" describes it precisely, so the evidence lineage is honest and unambiguous). I re-derived the outcomes by assembling exactly that input. Severity: minor; effect: reviewer friction reproducing the recorded run from the committed files alone.

## B. Compatibility matrix (§4.3) and rejection mechanism — CONFIRMED, no overclaim found

Row-by-row against legacy/current source:

| Row | Checked against | Result |
| --- | --- | --- |
| Old documents/descriptors → new compiler+renderer: byte-identical | New-side rows are explicitly covered by the §4.3 "Evidence limits" paragraph: "New compiler/renderer rows are contract requirements until implemented — they have NOT been runtime-tested." Legacy half (validation tolerant, digests transparent, identity preserved) verified: see below. | Correctly scoped; no overclaim |
| New output-enabled documents → old compiler drops instance fields | `compile.ts@952d92d` extension branch (lines 439–447) emits `kind/nodeId/occurrenceKey/extensionId/revision/propDecls/propValues` only; reads `node.props` only; echoes `extension.revision`; ignores `node.revision`/`node.outputs`/`node.slots`. Descriptor is code-registered, so the marker survives → old resolver rejects (probe C2). | VERIFIED from source + probe |
| New compiled instructions → old renderer | Resolution rejects via the descriptor marker — probe C2, and §4.3 labels it "resolver-level result". Downstream legacy rendering explicitly out of scope (resolution never succeeds). | Honest as stated |
| Old compiled instructions → new renderer | New-side contract requirement (`UI_COMPONENT_ABI_UNSUPPORTED`, §5.2); covered by the Evidence-limits paragraph. | Correctly scoped |
| New document → old validator accepted | `validate.ts@952d92d`: hard schema check (`UI_DOC_UNKNOWN_SCHEMA`, lines 57–68) then property-based checks; the `case 'component'` (line 503 ff.) inspects `definitionId`/`props`/`slots` of **stored** definitions only — **no unknown-field rejection sweep exists**. Canonicalizer (`canonical.ts`) is generic recursive stable-JSON → digests new fields transparently. | VERIFIED |
| Props-only extensions unchanged | Probe C3/C4 + source line 58 (any events/slots entries fail closed; none → resolve). | VERIFIED |

Additional §4.3/§4.2 mechanics verified:
- `extensionById = new Map(extensions.map(e => [e.id, e]))` (compile.ts:241) — "id-keyed, last-registration-wins" is exact.
- `UI_DOC_UNKNOWN_COMPONENT` is compiler-deferred: compile filters it out of structural errors (compile.ts:220–226) and resolves extensions itself; unresolvable → `EXTENSION_UNAVAILABLE` (423–431). Matches §3.1's characterization.
- §3.1 "the extension compile branch today emits the descriptor's own revision and never reads `node.revision`" — true (compile.ts:443–444).
- §3.7 "today such [undeclared descriptor-instance slot] fills are silently dropped" — true (extension branch returns an instruction with no slots; `node.slots` unread).
- `computeApplicationVersion` (application/compile.ts:1209–1257) hashes A-03 uiDocument identity entries, referenced resource/view/action revisions, and the application `components` list — §4.2's identity-affecting claims are true.
- §3.2's events gate **is** enforced by the legacy path (extensions.ts:58, above). The claim "markers are never wired as DOM events" is correctly scoped as a **new-side contract** rule for component-ABI-aware compilers/renderers; legacy consumers never reach wiring because they reject at resolution. No existing-behavior overclaim.
- §5.2's `reportDiagnostic` claim: channel exists; `RenderNode.svelte:69` reports `extension.diagnostic` (the same failure object `UI_RENDER_EXTENSION_UNAVAILABLE` rides today).

**INFO-1:** §3.2 "The **one** fail-closed descriptor check the current renderer performs" is loose: the resolver also fail-closes on descriptor/implementation *counts* (`UI_RENDER_EXTENSION_UNAVAILABLE`). The intended meaning — the only fail-closed check on descriptor **interface fields** — is correct. Suggest "the one interface-field gate" at next touch.
**INFO-2:** "Every legacy consumer rejects such a descriptor…" — in this repo there is exactly **one** legacy consumer of descriptor `events`/`slots` (the probed resolver; `ui-editor` Inspector's events list is DOM-window events; `ui/src/compile.ts:37` only declares the field). True in-repo; the plural invites over-reading beyond the repo. The §4.3 evidence-limits paragraph already scopes the probe as resolver-level, which contains the risk.

## C. Corrected types — CONSISTENT

- `outputDecls?: readonly UiOutputDecl[]` with `UiOutputDecl {name, payload: 'void'|UiPrimitiveType, description?}` (§3.2/§3.3) — consistent everywhere used (§3.3 always-emit rule, §4.3 matrix, §5.2, fixtures, README).
- `outputBindings: Readonly<Record<string, UiOutputBinding>>` matches the node field `outputs?: Readonly<Record<string, UiOutputBinding>>` (§3.1) and fixture instance shapes.
- `slots: Readonly<Record<string, readonly UiRenderInstruction[]>>` — byte-shape-identical to what the existing `kind:'component'` instruction already carries (compile.ts `UiRenderInstruction` component variant). The "mirrors what component instructions already carry" claim is exact.
- `UiSvelteComponentImplementation` extends the legacy identity triple (same three fields as `UiSvelteExtensionImplementation@952d92d`) + `abi`/`slots`/`required` — consistent with §4.1/§5.2.
- `emit(output, payload?: string|number|boolean)` — exactly `UiPrimitiveType` (`packages/ui/src/document.ts:25`), so `'void'|UiPrimitiveType` payload declarations line up with the IO contract.
- "the expression language has no array literal — verified": true — `UiExpression` literal domain is `string|number|boolean|null` (document.ts:30–31); array-typed props can only bind refs/ops, matching §3.2's array-reference rule and `select-valid.json` (`options` → `{type:'ref',path:'view.countries'}`).
- Fixtures' instruction shapes match §3.3: legacy-shape cases carry `propDecls`/`propValues` only; new-shape cases add `outputDecls`/`slots`.

## D. Action-input derivation and allowed-path consistency — CONFIRMED

- `packages/application/src/ui-attach.ts` **is** the `compileUiDocument` call site and passes exactly the named catalogs today: lines 55–59 (input: `actionIds`, `routeIds`, `viewFields`), 273–278 (`catalogsFor()`), **311–315** (`compileUiDocument(fact.document, catalogsFor().elements, extensionRegistry, { actionIds, routeIds, …viewFields })`). §3.5's "the same call that passes actionIds/routeIds/viewFields today" is accurate.
- `inputContractId`/`inputContractRevision` exist as declared action-registry fields in `packages/application/src/compile.ts` (lines 194–236: `local` carries `inputContractId`; `query`/`mutation`/`capability` carry both) — the derivation source §3.5 names is real.
- §4.3's `@victframework/application` bullet now **requires** the bounded addition ("ONE bounded addition is required and is explicitly part of the later U4 allowed scope") and names the same integration point; it closes with "Any further application-package need is a recorded scope decision at the gate". The contradiction is gone: grep for "no change is anticipated"/"no application change" across the amendment, design and matrix returns **nothing**.
- The two smaller deltas are consistent with this: `U4-COMPONENT-INTEGRATION-DESIGN.md` item 4 and `U4-COMPONENT-REUSE-MATRIX.md` rows now name the events-marker gate (probe-verified) and the `ui-attach.ts` integration ("in the later U4 allowed scope"), with new-side work honestly marked `C` (contract, not in source).

## E. Operative U4 authorization prompt (U4-HANDOFF.md §12.2) — negatives match; pin residue recorded

- §12.2 item (5) negatives: unknown output / incompatible binding / wrong-typed prop literal / `$output` scope leak / required slot unfilled / unresolvable revision pin / missing-mismatched implementation / ABI mismatch / stale and rejected emits — **all nine map 1:1 onto the amended diagnostics** (`UI_COMPONENT_OUTPUT_UNKNOWN`, `UI_COMPONENT_BINDING_INCOMPATIBLE`, `UI_EXPR_TYPE_MISMATCH`, `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID`, `UI_COMPONENT_SLOT_REQUIRED`, `UI_COMPONENT_REVISION_UNRESOLVED`, `UI_COMPONENT_UNAVAILABLE`, `UI_COMPONENT_ABI_UNSUPPORTED`, `UI_COMPONENT_OUTPUT_STALE`/`UI_COMPONENT_OUTPUT_REJECTED`). No stale negative survives.
- **What §12.2 pins, exactly:** (1) `docs/ui-foundation/U4-HANDOFF.md` "at its recorded tip (PREPARED — IMPLEMENTATION NOT AUTHORIZED → AUTHORIZED)"; (2) "the frozen component amendment `docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` (`vict.ui-component-abi@1`, **payload commit SHA recorded in `docs/ui-foundation/U4-AMENDMENT-FREEZE.md`**)". §12.2 names **no SHA directly**; it delegates the payload SHA to the freeze record. That record is byte-preserved and pins payload `68e166f` — so **§12.2 transitively pins the superseded payload today**, and neither §12.2 nor the handoff's status block (line ~259: "The amendment is FROZEN as a candidate: payload commit `68e166f…` … This document's operative scope … and the section 12.2 prompt are aligned with the frozen amendment.") carries any supersession flag. Only the amendment itself records the supersession (§4.3: "The first freeze (`68e166f…`, superseded)").

**MINOR-2 (required follow-through of the pending supersede step):** before any §12.2 authorization, the supersede step must (a) create the new freeze record for the repaired payload, (b) repoint §12.2's delegation at it, and (c) correct the handoff status block. Until then an implementer holding only the handoff would lawfully resolve the pin to known-false bytes. Mitigation today: the amendment's own status line ("PROPOSED — UNDER INDEPENDENT REVIEW; implementation NOT authorized") blocks implementation, and this is the expected mid-cycle state per the owner's ordering (repair → re-review → supersede freeze). Severity: minor now; becomes a blocker only if a new freeze lands without the repoint.

## F. Fixtures — PASS

- All eight fixture files parse (`node -e JSON.parse`): abi-compat-probe, appshell-content, button-action, checkbox-valid, dialog-slot, invalid-cases, render-failures, select-valid.
- **Five** component-ABI descriptors (`vict.catalog.checkbox/select/button/dialog/appshell`) each carry `abi: "vict.ui-component-abi@1"` **and** the matching `events: ["vict.ui-component-abi@1"]` marker; dialog/appshell additionally declare `slots` (renderable slots ⇒ marker required — consistent with §3.2); appshell declares no outputs (slots-only — allowed).
- `abi-compat-probe.json` records **C1 ACCEPTED honestly** (input explicitly labelled "the pre-repair fixture descriptor … no events, no slots") and **C2 REJECTED**, plus honest controls — matching my independent 5/5 re-derivation. Not retro-fitted to "should".
- `render-failures.json` old-plan case honestly omits `outputDecls` with the note "the legacy extension-instruction shape (propDecls/propValues only, verified at 952d92d); the new compiler always emits outputDecls for abi@1 descriptors" → `UI_COMPONENT_ABI_UNSUPPORTED` — coherent with §3.3's always-emit rule. Revision-pin case (`UI_COMPONENT_REVISION_UNRESOLVED`), competing/mismatched impl cases, slot-unavailable, stale/rejected emits — all match §5.1–§5.3.
- README manifest matches the files, states "contract examples — NOT runtime evidence", the marker convention, and the "codes marked 'compile, built by the amendment' do not exist in today's validator" convention. Consistent.
- **INFO-3:** the undeclared-slot-fill case expects `UI_DOC_UNKNOWN_COMPONENT` without the "built by the amendment" annotation; today that code exists only as the *validate-deferred* code (and today's compile silently drops such fills). The amendment §3.7/§5.1 state this precisely; the bare fixture expectation could be misread as existing compile behavior. Trivial.

## G. Scope / preservation — PASS

- `git diff --name-only 24347a0..0ad3a2a` lists **only** `docs/ui-foundation/**` (15 files).
- Byte-preservation confirmed by blob identity between tips:
  - `docs/ui-foundation/U4-AMENDMENT-FREEZE.md` → `e7a81971c409d164a4a43528a8d5db70c32da858` (both tips, IDENTICAL)
  - `docs/ui-foundation/reviews/u4/U4-AMENDMENT-REVIEW-01.md` → `af251fb780f8360c9cdfaa327131e8676b762559` (IDENTICAL)
  - `docs/ui-foundation/reviews/u4/FREEZE-CHECK-01.md` → `c22e08320a5da3046675107bae8b69f46ec21050` (IDENTICAL)
- Authoring requirement intact: amendment §1 owner quote (registered components "must not substitute for the required document-authored catalog proof"); §2(3) keeps all seven frozen U4 criteria governing; §6 requires the **same catalog control** through select → edit exposed properties/bindings → undo/redo → save → reload → finished app, native controls only as labelled comparison examples; §3.4 emit-only authority (authoring-route implementations never receive the dispatcher). Handoff §12.2(4) carries the same-control proofs with "FAIL or NOT DEMONSTRATED, never a non-blocking finding", and "All seven frozen U4 criteria and the packaging/isolation requirements stay governing". No registered-component workaround returned.
- Source-claim spot-checks supporting §6/§3.7 (pre-dating this delta, verified anyway): `Button.svelte` has **no** `loading` prop; `ActionButton.svelte` implements `pending` + `aria-busy` + `'Working…'` + disabled-while-pending; `AppShell.svelte:28` uses matchMedia `960px`/`720px`; `packages/ui/src/index.ts:112` carries the quoted sentence "Route IDs and navigation policy stay with the renderer." verbatim.

## H. New unsupported claims introduced by the repair — NONE FOUND

Greped the added lines of the delta for `verified|always|never|probe` and resolved each hit:
- Every "verified/probe-verified" claim resolves to a real, independently reproducible fact (legacy resolver bytes; extension-branch drop; validator tolerance; canonicalizer; identity hashing; reportDiagnostic channel; 720/960 matchMedia; index.ts quote; Button/ActionButton claims). The strongest ones I re-derived mechanically, not by reading prose.
- "always emits `outputDecls` for abi@1 descriptors" is a **new-side contract rule**, consistently labelled as such (§3.3, §4.3, §5.2, render-failures note, README) and covered by the Evidence-limits paragraph — not presented as existing behavior.
- "never wire it as an event listener" is new-side contract (§3.2), correctly scoped.
- Residual wording imprecisions are recorded as INFO-1/INFO-2/INFO-3 above; none rises to a blocking or evidentiary defect.

## Findings summary

| ID | Severity | Anchor | Finding | User effect |
| --- | --- | --- | --- | --- |
| MINOR-1 | minor | reviews/u4/abi-probe/probe.mjs (+ abi-probe dir) | Committed harness not runnable as-is: imports uncommitted `extensions.legacy.mjs` (only `.ts` shipped) and C1 reads the now-marker-bearing `checkbox-valid.json` while expecting the pre-repair descriptor; verbatim re-run gives 4/5. Recorded output corresponds to the pre-repair fixture (`24347a0`), precisely described in `abi-compat-probe.json` C1. Independently re-derived 5/5. | Reviewer friction reproducing the recorded run from committed files alone; evidence lineage itself honest |
| MINOR-2 | minor | U4-HANDOFF.md §12.2 + status block (~line 259) | Operative prompt transitively pins superseded payload `68e166f` (delegates to byte-preserved `U4-AMENDMENT-FREEZE.md`; no supersession flag in the handoff). Must be closed by the supersede step (new freeze record + §12.2 repoint + status-line correction) before any §12.2 authorization. Amendment §4.3 records "(68e166f…, superseded)"; amendment status line blocks implementation meanwhile. | Mis-authorization risk only if the supersede step is skipped or a new freeze lands without the repoint |
| INFO-1 | info | U4-COMPONENT-AMENDMENT.md §3.2 | "The one fail-closed descriptor check" is loose (resolver also fail-closes on counts); intended meaning (only interface-field gate) correct | Possible momentary misreading |
| INFO-2 | info | §3.2 / abi-compat-probe.json | "Every legacy consumer" = exactly one in-repo consumer (the probed resolver); evidence-limits paragraph already scopes it | Plural could be over-read beyond the repo |
| INFO-3 | info | fixtures/component-contract/invalid-cases.json (undeclared slot case) | Expects `UI_DOC_UNKNOWN_COMPONENT` without the "built by the amendment" annotation; today's compile silently drops such fills (code exists today only as validate-deferred) | Trivial misread risk |

No blockers. Every attacked claim either held against source/bytes or is honestly scoped as a new-side contract requirement; the counterexample, the gate choice, the type corrections, the action-input ownership, the fixture set, scope and byte-preservation all verify.

U4 AMENDMENT REVIEW R2: PASS WITH NON-BLOCKING FINDINGS
