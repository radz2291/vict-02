# U1 INDEPENDENT FALSIFICATION REVIEW — codex/ui-foundation-u1

Reviewer role: independent verifier (did not implement the candidate; adversarial falsification only).
Repository: https://github.com/radzis91/vict-02 → https://github.com/radz2291/vict-02
Worktree: `C:/Users/RZ1/Desktop/RZ/vict-02-u1`, branch `codex/ui-foundation-u1`.

## Tested snapshot

| Item | Value |
| --- | --- |
| Evidence commit (HEAD tested) | `fbe2451e28d04b7177703de26e72abb84d3a1389` |
| Exact candidate commit (on top of base) | `351d3e5` |
| Base (U0 closure) | `97346903e0c1a242b4bab0477c92bc3f34c43c38` |
| origin/main verified live | `4d2df037d8a82d36c60bf1bff16919650643ce22` (unmoved) |
| Branch on origin | **not pushed** (`git ls-remote` returns no entry) |
| Working tree at review end | clean (temp harness config deleted; throwaway base worktree removed) |
| No force-push | reflog linear; merge-base(HEAD, origin/main) = `4d2df03…`; 20 commits ahead, no main merge |

## Environment

- Windows 11, Node v22.13.1, npm 11.19.1 (matches the U0-named measurement environment).
- Chrome via CDP on :9222 (browser-tools), dev server `vite dev --port 5210` serving THIS pinned worktree (PID verified before use).
- All 8 requested workspaces built cleanly (`npm run build -w …contracts …ui-preview`); example production build (`vite build` + adapter-node) also succeeds.

## Scope discipline

`git diff 9734690..HEAD --name-only` → only `docs/ui-foundation/*` (3 files), `packages/{ui,ui-svelte,sdk,application,ui-editor,ui-preview}`, `examples/ui-authoring-proof/*`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.prettierignore`, `package-lock.json` (workspace lockfile, allowed by handoff §3). No `apps/studio`, no Stage 9 bytes, no main merge, no force-push. ✅

---

## Per-criterion verdicts

### U1-01 Canonical source and identity — **PASS**

Shipped suite `packages/application/test/ui-identity.test.ts`: 11/11 PASS.

My 12 verifier-authored adversarial attacks (`u1-falsify/identity-adversarial.test.ts`), all correctly repelled:

| Attack | Outcome |
| --- | --- |
| A1 pin authority AGREEING with catalog (positive control) | compiles ✅ |
| A2 node-registry/property insertion-order permutation | digest + applicationVersion invariant ✅ |
| A3 child ARRAY reorder (ordered semantics) | digest AND version change ✅ |
| A4 payload-ordering attack: {rev 2, rev 10} both input orders + triple duplicate identical entries | version invariant; adding rev 3 changes it ✅ |
| A5 single-document SELF definition cycle (`def.a` → own body) | rejected `UI_DOC_CYCLE` ✅ |
| A6 single-document A→B→A definition cycle | rejected `UI_DOC_CYCLE` ✅ |
| A7 presentation-mode rule: uiDocument+layout / neither / uiDocument+layoutMode | all rejected `UI_APP_PRESENTATION_MODE_INVALID` ✅ |
| A8 screen → nonexistent documentId | `UI_DOC_REFERENCE_DANGLING` ✅ |
| A9 cross-document navigation loop (A↔B routes) | compiles, no false cycle ✅ |
| A10 release with matching version but wrong renderer revision | rejected ✅ |
| A11 canonicalUiDocument defenses (cyclic, class instance, NaN) | throw `CanonicalUiError` ✅ |
| A12 @3 empty catalog w/ document screen fails; @1≠@2 | as specified ✅ |

Plus shipped coverage: same-(id,revision)-different-bytes collisions (catalog AND pin authority), old-release binding → `RELEASE_APPLICATION_MISMATCH`, "10"<"2"<"3" payload ordering.

NOTE-1: `orderUiDocumentIdentityEntries` orders via JS `<` (UTF-16 code-unit order), not true code-point order; divergence only for astral characters vs U+E000–U+FFFF. Determinism/totality unaffected → no identity risk.

### U1-02 One renderer — **PASS**

- `src/lib/product/compile.ts` is the single `inspectionPlan()`; both `routes/inspection/[id]/+page.svelte` and `routes/studio/+page.svelte` import it; both render via `DocumentHost` (`@victframework/ui-svelte`). No second handwritten frontend exists.
- Shipped `entry-isolation.test.ts` (text scan) passes; I attacked its blind spot with a REAL bundle-level analysis: fresh `vite build`; scanned server entries + transitive chunk closure (`compile.js`, `domain.js`, `index.js`) and all client chunks/nodes for `EditorBridge|PreviewSession|applyUiEdit|UiEditSession|ui-editor|ui-preview`. Zero hits in the product graph; the ONLY artifacts containing editor/preview symbols are `entries/pages/studio/_page.svelte.js` and client node 4 (the studio route) — legitimate.

### U1-03 Source-aware editing — **PASS**

My 8 verifier-authored transaction attacks (`edit-adversarial.test.ts`), all repelled correctly:
- B1 stale `expectedDocumentRevision` → `UI_DOC_STALE_REVISION`, zero mutation, not dirty.
- B2 requestId replay same payload reconciles to recorded result; different payload → `UI_EDIT_REQUEST_CONFLICT`.
- B3 replay after undo does NOT resurrect the recorded document (conflict).
- B4 remove-with-references (child / **definition root** / repeat templateRoot) → `UI_EDIT_REFERENCE_REMAINS` (nested in per-command diagnostics), no mutation.
- B5 cycle-creating move (root into own descendant) → rejected; the valid insert from the SAME failed transaction left **no partial effect**.
- B6 multi-command atomicity both orderings (invalid+valid, valid+invalid) → whole transaction rejected, `canUndo()` still false.
- B7 duplicate node insert (intra-transaction and existing id) → `UI_DOC_DUPLICATE_NODE_ID` (nested), no mutation.
- B8 layered authority: session defers unknown route ids (disclosed DECISIONS §U1 item 3).

Browser evidence: clicking the canvas title element selected the canvas (`canvas-has-selection`) and the Inspector showed **"Source node n.title"** — exact source-occurrence mapping; "Quick edit: accent color" applied a style through the exported transactional commands (working revision 1#0→1#1, injected CSS rule for `n_title`, title computed color = accent token).

### U1-04 Round trip — **PASS** (one MINOR finding)

- C1 undo/redo advance the revision monotonically (content reverts, `#seq` grows); redo stack cleared by a new edit.
- C2 expected-revision save advances stored revision (numeric `1`→`2`, non-numeric `.rN`); stale save rejected `UI_DOC_STALE_REVISION`; no silent last-write-wins.
- C3 reopen over saved bytes preserves node ids, child order, local styles and text bindings; history cleared; reopened session enforces its own revision space.
- C4 bridge save routes through the store port (see MINOR-3 below).
- Real browser chain: click node → inspector edit → Undo (1#2, content reverted, "saved" because content==stored) → Redo (1#3, unsaved) → **Save ("Saved as stored revision 2")** → **Reload stored** → fresh session `2#0`, accent style still applied, 20 occurrence classes (source IDs) intact.
- NOTE-2: the store is an in-memory closure — a full browser page reload resets it. Process-reopen durability is demonstrated at session level ("Reload stored") and in `editor-roundtrip.test.ts`, not across browser restarts. Acceptable for U1's single-writer proof; must become a real store before U3-05.

### U1-05 Product path — **FAIL** (BLOCKER-1)

What IS proven (shipped `product.test.ts` + my D1–D7 + live browser):
- approve (supervisor, correct `expectedDomainRevision`) → status approved, `domainRevision`+1, activity entry, dependent views refresh — verified live: "Inspection approved — status and activity refreshed.", trail gained "s.hart: Inspection approved".
- approve as technician → `DATA_UNAUTHORIZED`, state unchanged (verified live on i-102).
- reject without reason → rejected, unchanged; with reason → `rejected` + reason stored.
- revise by non-assigned actor denied; assigned technician revise clears decision fields, trail preserved.
- undeclared mutation → `DATA_MUTATION_NOT_DECLARED`; double-approve → transition-rejected, unchanged.
- stale decision → contract-conflict code, unchanged.

What BREAKS the criterion: the declared decision action attached to the AUTHORED document (`n.approveButton` → `inspection.approve`) does **not** use the actual adapter/dispatch path in either host:
- `examples/ui-authoring-proof/src/routes/inspection/[id]/+page.svelte:142` and `studio/+page.svelte:273` pass `dispatch={async () => ({ ok: true })}` to `DocumentHost`, whose own source states dispatch is "the ONLY way actions run" (`packages/ui-svelte/src/document/DocumentHost.svelte`; `RenderNode.svelte:76` awaits it).
- Live-verified: clicking the authored "Approve inspection" button changes nothing — no feedback, status stays submitted, no activity entry, no error. The click silently resolves through the stub.
- The product page simultaneously displays: *"The document's Approve button and this control dispatch the SAME declared action through the SAME adapter boundary."* — **this on-screen claim is false**, and it is visible in the shipped walkthrough screenshot (`walkthrough/detail-1440x900.png`).
- Nothing in DECISIONS-AND-EVIDENCE §U1, U1-HANDOFF, or the evidence index discloses the stub. This is a silent substitution at the execution boundary.

Criterion text: "Declared decision action uses the actual adapter/double dispatch path" — falsified for the document-declared path. The real journey works only through the native host control and the studio's separate "Run approve" preview button.

Required repair (builder/integrator, not verifier): wire `dispatch={(actionId, input) => server.dispatch(actionId, input, { role, actorId })}` (or the preview session dispatch in the studio) into both DocumentHost instances; correct the on-screen note; add a product-level test that clicks the authored button through the real host; then re-verify U1-05 and the browser journey.

### U1-06 Preview boundary — **PASS WITH NOTES** (1 MAJOR, 1 MINOR)

Proven: shipped `packages/ui-preview/test/session.test.ts` (suite green) + my E1–E5, E7 + live browser:
- Undeclared op → `SCENARIO_COVERAGE_MISSING`, nothing ran.
- `implementation: 'unavailable'` denies **even when a real double IS registered** — declaration wins, no real-handler effect (E2).
- Missing required double denies with "the real handler was NOT invoked" (E3, live).
- Reset during a latency-fenced in-flight op → `SESSION_STALE`, dropped; new session keeps seed state; mutation never leaks (E4, live latency scenario).
- Seeds reset coherently (E7).
- Permission denial for a declared actor (technician) → `OPERATION_DENIED`, double not invoked (E5).
- Browser: switching to `missingCoverage` and running approve shows "SCENARIO_COVERAGE_MISSING — Operation 'inspection.approve' is not implemented in this scenario; nothing ran."

MAJOR-1 (gate bypass, preview-only): `session.ts` gates with `if (!permitted && this.actor.permissions.length > 0)` — an actor declared with `permissions: []` bypasses the gate entirely and the registered double IS invoked (probe-confirmed: "DOUBLE INVOKED (bypass confirmed)"). Contradicts the disclosed gating behavior (DECISIONS §U1 item 4). Blast radius is preview simulation only — real adapter enforcement verified intact (U1-05). Must fix before U3 relies on preview permission scenarios.

MINOR-2 (unawaited double): `#runCapabilityOp` returns `value: invoke(input)` without awaiting. A rejecting async double yields `ok: true` with a rejected Promise as value (probe-confirmed: "run() already reported ok:true", promise settles REJECTED). A caller that ignores `value` never learns of the failure.

### U1-07 Native and accessible — **PASS WITH NOTES**

- Renderer conformance: root renderer project 14 files / 108 tests PASS; `packages/application/test/conformance.test.ts` green within the 1040-test application/sdk/ui-editor run. The renderer consumes VICT boundaries (`DocumentHost`/`RenderNode` compiled-plan rendering; action dispatch below the renderer boundary).
- Keyboard: on `/inspection/i-103` every control (breadcrumb link, authored Approve, native Approve) is tab-reachable (focus sequence verified). Studio controls reachable; canvas text-selection is click-only — **disclosed** (DECISIONS §U1 item 6, U2-06 scope).
- Focus visibility: no author CSS removes outlines (no `outline:none` rules anywhere); UA default focus ring intact. No custom `:focus-visible` styling — baseline, not a violation.
- Form association: all Inspector inputs/selects carry `aria-label`s ("Style property", "Token id", "Style value", "Attribute name/value", "Action id", "Route id"); the token checkbox is wrapped in a `<label>Token value…</label>`.
- Status roles: feedback and preview notes use `role="status"`; "Inspection not found." uses `role="alert"`.
- MINOR-4 (a11y): denial/error feedback (e.g. `DATA_UNAUTHORIZED: Approve requires qlt.inspection.approve.`) is announced via polite `role="status"` rather than assertive `role="alert"` — visible but easily missed by assistive tech at decision time.
- The two svelte-check a11y WARNINGS (canvas selection span) match the builder's disclosure exactly.

### U1-08 Runnable quality — **PASS WITH NOTES**

- Measurement (`measure-u1.ts`, my rerun): workload **1,966 authored nodes** (~2× the frozen 1,000), 100 repeated occurrences, 20 transactions → **compile p95 45.7 ms** (budget 250), **edit feedback p95 33.4 ms** (budget 100), **scenario reset p95 0.4 ms** (budget 1000). My attempt to break the budgets with the harness' fixed (larger-than-required) workload failed. Studio UI shows a live "Last command round trip … (budget ≤ 100 ms)" readout.
- NOTE-5: the harness measures session/compile feedback in Node, not browser paint; the disclosed method is preserved and reproducible.
- Console sweep (my own CDP `Runtime.enable`+`Log.enable`+`Page.navigate` script): `/`, `/inspection/i-101`, `/inspection/i-102?as=technician`, `/inspection/i-999-does-not-exist` (error state), repeat visits, `/studio` twice, plus resize-during-render pokes (1440→700→1024→390): **16 messages, all `debug` (vite dev), ZERO errors/warnings/exceptions**. My attempt to produce an unexplained console error failed.
- Screenshots reviewed: all six committed `walkthrough/*.png` at 1440×900 / 1024×768 / 390×844, plus my own live captures (evidence/verify-detail-1440x900.png, verify-detail-390x844.png, verify-studio-1440x900.png). Responsive structure stacks coherently at 390; no clipped controls found.
- NOTE-6 (visual, non-blocking): the authored Approve button renders with UA-default styling next to the styled native control; severity badges are inconsistent ("HIGH severity" vs bare "low"); studio canvas shows the extension placeholder as raw "Unsupported feature: unresolved-component" text (truthful, per disclosed extension limits).

---

## Findings register

| ID | Severity | Criterion | Finding | User effect | Next check |
| --- | --- | --- | --- | --- | --- |
| BLOCKER-1 | **BLOCKER** | U1-05 | DocumentHost `dispatch` stubbed to `() => ({ok:true})` in BOTH hosts (`inspection/[id]/+page.svelte:142`, `studio/+page.svelte:273`); authored Approve button silently no-ops; on-screen claim "SAME declared action through the SAME adapter boundary" is false; undisclosed | A user clicking the document's own Approve control gets silent nothing; the product loop is only reachable via the host fallback control | Builder repairs dispatch wiring + note, adds product-level click test; affected re-verification of U1-05 + browser journey |
| MAJOR-1 | MAJOR | U1-06 | Empty `permissions: []` actor bypasses the preview capability gate (double invoked) | Misleading permission-UX testing in preview; no real-domain effect (adapter enforcement intact) | Fix gate to deny when the op root is not permitted regardless of list length; add regression test before U3 |
| MINOR-2 | MINOR | U1-06 | Rejecting async double returns `ok:true` with unawaited rejected Promise as `value` | Simulated capability failure can surface as success, error surfaces late/never | Await the double inside the settle path; map rejection to a structured failure code |
| MINOR-3 | MINOR | U1-04 | `EditorBridge.save()` advances session state before the port write; failed port write desyncs session/store (store skips revision 2; session reports clean) | Latent only — U1 proof port cannot fail (in-memory single writer) | Move the port write before the session mutation, or roll back on port failure |
| MINOR-4 | MINOR | U1-07 | Denial/error feedback announced via polite `role="status"` instead of `role="alert"` | Screen-reader users may miss time-sensitive denials | Use assertive role for error/denial feedback |
| MINOR-5 | MINOR | U1-08/U1-06 | Studio preview panel has no pending state or duplicate-submit prevention during the 800 ms latency approve | Scenario-4's "duplicate-submit prevented" observable is met only by the product decision control, not the preview panel | Disable Run approve while in flight (product control already does this correctly) |
| NOTE-1 | NOTE | U1-01 | Identity ordering uses UTF-16 `<` not code-point order (diverges only for astral chars) | None (determinism unaffected) | Optional: implement true code-point comparator |
| NOTE-2 | NOTE | U1-04 | Save durability is in-memory; full page reload resets the store | Owner cannot demo survival across browser restart | Real store arrives with U3-05 |
| NOTE-3 | NOTE | U1-05 | Adapter emits `DATA_CONTRACT_REJECTED`/`DATA_UNAUTHORIZED` where PROOF-DESIGN §1.2 sketches `DOMAIN_CONFLICT`/`OPERATION_DENIED` (preview uses those exact codes) | Naming inconsistency across boundaries | Reconcile names in a later stage document; semantics (state unchanged) correct everywhere |
| NOTE-4 | NOTE | U1-08 | Measurement harness measures Node-side feedback, not browser paint | Method disclosed and preserved | Add browser-side timing in a later stage |

## Regression classification (root `npm test`: 3 failed / 2882 passed / 3 skipped, 167 files)

| Failure | Files untouched by U1 diff? | Focused re-run @ candidate HEAD | Focused re-run @ base 9734690 (throwaway worktree, same node_modules) | Classification |
| --- | --- | --- | --- | --- |
| `scripts/test/bootstrap-artifact.test.mjs` (suite) | yes (`scripts/` untouched) | PASS | PASS | Environmental: transient under full-suite parallel load |
| `scripts/test/release-authority.test.mjs` — preflight exit 1 expected, got 3221225794 (0xC0000142 STATUS_DLL_INIT_FAILED) | yes | PASS | PASS | Environmental: Windows child-process init flake under load |
| `packages/builder-kit/test/app-bootstrap.test.ts` — tamper exit 3221225794 + packId `…630` vs `…63b` | yes (`packages/builder-kit` untouched) | PASS | PASS | Environmental: same child-process flake class; the one-off packId mismatch did not reproduce |

No U1 regression found. Note: DECISIONS §U1 item 7 documents SIX environmental failures verified in the builder's environment; in mine only these three materialized and none reproduced on focused re-runs at either SHA. Vitest/vite versions verified identical between base and candidate lockfiles (4.1.11 / 6.4.3) before the base re-run.

## Commands (reproduction)

```
git rev-parse HEAD                        # fbe2451e28d04b7177703de26e72abb84d3a1389
git fetch origin main && git rev-parse origin/main   # 4d2df037d8a82d36c60bf1bff16919650643ce22
npm run build -w @victframework/contracts -w @victframework/kernel -w @victframework/ui \
  -w @victframework/sdk -w @victframework/runtime -w @victframework/application \
  -w @victframework/ui-svelte -w @victframework/ui-preview
npx vitest run packages/application/test/ui-identity.test.ts          # 11 pass
npx vitest run packages/ui-preview packages/ui                        # 152 pass
npx vitest run packages/ui-editor packages/sdk packages/application   # 1040 pass
npx vitest run --project renderer                                     # 108 pass
cd examples/ui-authoring-proof && npx vitest run                      # 13 pass
cd examples/ui-authoring-proof && npx vitest run test/entry-isolation.test.ts
npx vitest run --config u1-falsify.config.ts   # 40 verifier-authored adversarial tests (config deleted after)
cd examples/ui-authoring-proof && npx tsx test/measure-u1.ts
npm test                                       # 3 failed (environmental, classified above)
node C:/Users/RZ1/Desktop/RZ/u1-falsify/console-sweep-u1.mjs
```

Scratch harness (verifier-authored, outside the repo): `C:/Users/RZ1/Desktop/RZ/u1-falsify/` — `identity-adversarial.test.ts`, `edit-adversarial.test.ts`, `product-preview-adversarial.test.ts`, `probe-preview.test.ts`, `console-sweep-u1.mjs`, `root-suite.log`.

## Verdict

**U1 GATE FAIL** — pending repair of BLOCKER-1 (U1-05 dispatch stub + false on-screen claim). Everything else I attempted to falsify held: identity semantics, one-renderer isolation, transaction atomicity, round trip, adapter path (via the host control), preview coverage/fencing, accessibility baseline, budgets, console cleanliness. After the builder's repair (small, in-scope: wire real dispatch in both hosts, correct the note, add the click-through test), affected re-verification of U1-05/U1-08 plus the browser journey should be sufficient for a fresh gate decision; MAJOR-1/MINOR-2 should be fixed in the same repair window since both touch `ui-preview` before U3 depends on it.

The candidate may not proceed to push as a passing gate in its current state.
