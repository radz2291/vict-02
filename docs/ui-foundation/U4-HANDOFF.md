# U4 handoff — built-artifact reuse and Studio-agent handoff

**PREPARED — IMPLEMENTATION NOT AUTHORIZED.**

This document is the implementation-ready plan for U4 (frozen STAGES §6,
criteria U4-01…U4-07). It was prepared on the documentation branch
`codex/ui-foundation-u4-handoff` (from the U3 closure records `16df3bf…`) by
the U3 stage manager, independently reviewed (see
[U4-HANDOFF-REVIEW-01](reviews/u4/U4-HANDOFF-REVIEW-01.md)). Nothing in it
authorizes implementation; the owner must explicitly authorize U4 using the
authorization prompt at the end of this document.

## 0. Entry authority (verify live before starting)

| Item | Value at preparation | Verify |
| --- | --- | --- |
| U3 final records (entry) | `16df3bf155fa2a8c9ca0de67996dc6d73450f659` = `origin/codex/ui-foundation-u3` | `git ls-remote` |
| Combined verified implementation | `952d92da5131d6ab595b45b3bf18bc7ce3b3466d` (records-only descendant of reviewed `e0dd026…`) | in history |
| Frozen amended U0 authority | `9ec87f3e7eb8eb7793f972111258940aac635346` (STAGES §6 = U4 criteria; API-SPEC 6.2/7/10) | `git show` |
| Main baseline (untouched) | `4d2df037d8a82d36c60bf1bff16919650643ce22` | `git ls-remote` |
| U3 verdict | CLOSED: PASS WITH NON-BLOCKING FINDINGS (gate + owner criterion satisfied) | [U3-HANDOFF](U3-HANDOFF.md) closure section |

If any ref moved, stop and reconcile before starting. Preserve the closed
branches (`codex/ui-foundation-u3`, `codex/ui-foundation-u3-experience`)
untouched.

## 1. Proposed implementation branch and scope

- **Branch**: `codex/ui-foundation-u4` from the then-current
  `codex/ui-foundation-u3` tip (or from this handoff's records tip if the
  owner prefers the docs ancestry). Worktree-isolated; never the main
  checkout.
- **Allowed paths**:
  - `examples/u4-consumer/` (NEW — the independent clean consumer; the only
    new example),
  - `packages/ui-editor/` — **packaging repair only** (F3): fix the four
    TS2307 Svelte-declaration errors AND give the package an emitting build
    (its build is currently `noEmit: true` typecheck-only and cannot produce
    dist at all); no editor behavior/logic change. Fallback if emit-based
    dist proves disruptive: adopt the ui-svelte-style source-exports
    packaging — an explicit, recorded choice (see §10), not a silent one,
  - `packages/*/test/`, `scripts/` — new packaging/consumer tests and the
    pack script,
  - `docs/ui-foundation/` — records (coverage, walkthrough, review reports),
  - `examples/README.md` + consumer README (documentation),
  - `.gitignore`/`.prettierignore` — scoped additions for artifacts/evidence.
- **Out of scope (unauthorized)**: `apps/studio` integration, Stage 9,
  merge to main, npm publication, deployment, any frozen-contract change
  (document schema, extension bridge semantics, registry identity rules),
  the §5 amendment of the design document.

## 2. Mapping the frozen criteria to concrete work and evidence

| Criterion | Concrete work | Evidence (recorded where) |
| --- | --- | --- |
| **U4-01 Packaging** | `npm pack` the closure set (§4); record tarball contents + public exports per package; verify no original-app-source imports or repo source aliases are possible from the tarballs | `docs/ui-foundation/reviews/u4/U4-COVERAGE.md` + `U4-ARTIFACTS.md` (contents listing, sizes, sha256s, exports table) |
| **U4-02 Independent consumer** | `examples/u4-consumer/` installs packed tarballs from local copies; renders an authored document source (document elements + one extension); runs a declared preview interaction via `@victframework/ui-preview`; mounts `@victframework/ui-editor` editor modules (canvas/inspector) on that source; loads a document extension through the bridge; **plus the representative component proof** (§3) | consumer tests + browser screenshots (`reviews/u4/consumer/`) |
| **U4-03 Build parity & bundle separation** | production build of the consumer; the finished app's render behavior equals the preview session's for the same source; **editor/simulator infrastructure absent from the application bundle** — prove by bundle inspection (no `ui-editor`/`ui-preview` module ids in the app chunk graph) | `U4-COVERAGE.md` §parity + build logs (`reviews/u4/evidence/`) |
| **U4-04 Agent speed (unfamiliar-agent exercise)** | bounded brief (§7) given to an agent with no prior repo context; record elapsed time per step, setup commands run, validations performed, repairs needed, manual interventions | `reviews/u4/U4-AGENT-EXERCISE-01.md` (honest log; no invented speed target) |
| **U4-05 Complete walkthrough** | final inspection/page/workspace use and required negatives demonstrated independently: approve flow with Button feedback; checklist checkbox → submit; AppShell nav incl. responsive; Dialog focus/portal; negatives (undeclared action refused; denied permission; stale source failsafe; missing extension placeholder) | `reviews/u4/U4-WALKTHROUGH.md` + screenshots; reproduced by the final verifier |
| **U4-06 Handoff artifacts** | APIs + mounting example, identity/dispatch/theme contracts, limitations, exact artifact list, retained integration findings — delivered as the consumer README + `U4-COVERAGE.md` (the "concrete integration route for the existing Studio") | those documents |
| **U4-07 Final gate** | fresh independent verifier (did not implement) at the exact final candidate; per-criterion PASS/FAIL/NOT DEMONSTRATED; affected post-review changes rechecked | `reviews/u4/U4-VERIFY-01.md` (+ recheck reports) |

**Additional owner requirement (explicit, not relabellable):** the
representative component proof of
[U4-COMPONENT-INTEGRATION-DESIGN](U4-COMPONENT-INTEGRATION-DESIGN.md) §1 —
Button (declared action, disabled/loading/feedback), catalog Checkbox
(checked-value binding → declared submission), Sidebar/AppShell (navigation,
active selection, responsive), Dialog + Select (value change, focus, portal).
If any required behavior cannot be reproduced with the existing
implementations, it is a **FAIL (or NOT DEMONSTRATED) of the reuse
requirement** — it must not be downgraded to a minor finding to obtain a
reuse PASS.

## 3. The representative component proof (summary; full design in the design doc)

Route: **registered components (P3) + document elements (P2)** — no frozen-
contract changes. Each proof specifies canonical source representation,
exposed properties, value/event connections, selection/source-occurrence
ownership, Inspector editing + save/reload, theme mounting, keyboard/focus/
disabled/error behavior, and the action boundary (see design doc §1.1–1.4).
Component presentation internals stay opaque **when explicitly declared**;
business state, action identities and their connections remain visible in
the persisted application definition / document source.

## 4. Public artifacts and exports to consume (pack list)

Pack (from the implementation branch, after `npm run build`):

- `@victframework/ui` (dist) — document model, compiler, edit ops
- `@victframework/ui-svelte` (source exports incl. `src`; declared deps
  `bits-ui`, `@internationalized/date`, workspace deps; `peerDependencies`
  svelte) — renderer, built-ins, catalog, extension bridge, ComponentSlot,
  styles
- `@victframework/application` (dist) — registry, application compiler,
  conformance suite
- `@victframework/sdk` (dist) — definition DSL
- `@victframework/ui-editor` (**after the F3 packaging repair** — emitting
  dist, or source-exports fallback per §10) — editor modules
- `@victframework/ui-preview` (dist) — preview orchestration
- transitive workspace deps required by the above (contracts, kernel,
  runtime, control, store-sqlite / appdata-sqlite if the consumer persists
  durably — recommended minimal set recorded during implementation)

Consumer installs **copies** of the packed tarballs (`file:` paths into a
`vendor/` directory committed or restored by a setup script — never
`link:../../packages/...`). Svelte source inside `ui-svelte` is legitimate
package content consumed through its public exports; U4-01 must demonstrate
the tarball contains everything the consumer needs (that is the
"everything required" distinction from reaching into the original checkout).

## 5. Build / install / launch commands (shape; final text in the consumer README)

```bash
# repo root, implementation branch
npm ci --ignore-scripts && npm run build        # package dists (incl. repaired ui-editor)
npm run build -w @victframework/ui-preview
node scripts/pack-u4-artifacts.mjs              # npm pack closure set -> dist-packs/ + sha256 manifest

# consumer (examples/u4-consumer)
npm install                                     # installs vendored tarballs
npm run build && npm run preview                # production parity check
npm run dev                                     # http://localhost:<port>
```

Prerequisites: Node 22.13+ (built-in `node:sqlite` if durably persisting);
the one-time package build. No repository source aliases; no workspace
links; no imports from other examples.

## 6. Required positive and negative checks

**Positive** (each with recorded evidence): document source renders in the
consumer; declared preview interaction runs (port-driven session); editor
modules mount and save an edit back to the persisted source; extension loads
(descriptor + implementation); the four component proofs of §3; preview ≡
production render for the same source; bundle separation proven; unfamiliar-
agent exercise completes.

**Negative** (each must refuse visibly and safely): undeclared action from a
registered surface (host refuses pre-dispatch); action denied by the
boundary (permission) with declared feedback and unchanged state; missing or
mismatched extension implementation (visible unavailable placeholder +
diagnostic); extension descriptor declaring events/slots
(`UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`); corrupt/incompatible saved
source (bytes preserved, disclosed fallback — consumer-side analogue of the
U3 studio behavior); stale document revision on save (edit-session refusal).

## 7. Unfamiliar-agent exercise — bounded brief

Give an agent with no prior repo context ONLY: the consumer README, the
packed artifacts, and this task — "install the artifacts, launch the
consumer, add one document-authored screen with a button wired to a declared
action, and one registered catalog checkbox surface; verify both in the
browser." Record: elapsed time per step, setup commands actually run,
validations performed, repairs needed, manual interventions. No performance
target is invented and no universal development-speed claim is made; the
recorded numbers describe this one bounded exercise.

## 8. Independent review, repair, recheck responsibilities

- Verification of the *implementation* is not part of this preparation
  phase.
- During U4: a fresh independent verifier (did not implement, worktree-
  isolated at the exact candidate) owns the U4-07 gate; the manager repairs
  in-scope findings; affected-surface rechecks follow every repair; failed
  reports are preserved verbatim (`reviews/u4/`).
- This handoff itself was independently reviewed at preparation time
  (documentation-only; reviewer authored nothing in it):
  [U4-HANDOFF-REVIEW-01](reviews/u4/U4-HANDOFF-REVIEW-01.md) (sha256
  `0b4c3ef3c0b118d89a46cd1066ab639abe2ce1d42530c7f8b03fdd71d777a97e`,
  imported verbatim) — **round 1 verdict: FAIL (revision required)** at
  candidate `ebc3461…`: F-1 blocker (this document cited its review report
  before the report existed — resolved by importing it with this repair
  commit), F-2 blocker (ui-editor packaging posture misstated: source-only
  package, `noEmit` typecheck-only build — §allowed-paths and carry-forwards
  corrected), F-3 blocker (design §1.1 used the non-exported ActionButton —
  redesigned onto public exports Button + ActionFeedback + actionFeedback),
  F-4..F-7 minor (public-export list accuracy; 38 recipes vs 41 coverage
  families; Dialog portal target = ControlScope root; stray "ComponentScope";
  date transposition), F-8 process (the branch was local-only at review
  time; it is pushed before handoff delivery and the final records report
  the live remote SHA). All package-capability claims in the documents were
  verified true by the reviewer. Affected recheck (round 2, same reviewer)
  at the first repair `f6bca52…`: **FAIL** — narrow and mechanical: three
  superseded "type-level"/"dist-declared" statements survived (including
  the operative authorization prompt), the push claim was premature, and
  two table nits (blockquote-prefixed rows; ControlScope public surface is
  the `./controls` subpath, not a root export). Round-2 repairs committed
  (`6b9e328…`). Round 3 (final narrow recheck, same reviewer) at `6b9e328…`:
  **FAIL** on one remaining defect class — the §8 record had not actually
  been updated (silent no-op string replacement) — plus a cosmetic table
  break (raw newline mid-cell in the ui-svelte row); every corrected
  statement verified truthful. This commit fixes both; the imported report
  carries all three rounds (final sha256
  `3b41263d1ce53ab629a804da9264730d9119704a2723b023fae302990b98d0db`;
  round-1 section byte-identical to `0b4c3ef3…`). Round 4 (verification of
  this exact fix, same reviewer, at `2202499…`): **PASS WITH NON-BLOCKING
  FINDINGS** — all round-3 defects verified fixed against actual file
  bytes; NF-1 (this round-4 record) and NF-2 (branch push) are
  delivery-coupled completions, resolved by the delivery records commit
  and push of the documentation branch.

## 9. Founder checkpoint and stop boundary

After U4-07 passes, the founder checkpoint opens: the owner experiences the
consumer (launch from the README; the §3 proofs; the walkthrough) and
accepts or returns findings. **U4 closes only on owner acceptance plus the
verified gate.** U4 closure implies nothing about npm publication, merge to
main, existing-Studio integration or production activation (frozen STAGES
§6). The manager stops at the founder checkpoint; any next stage requires a
new authorization.

## 10. Carry-forwards (owned, with next checks)

| Item | Origin | U4 obligation | Next check |
| --- | --- | --- | --- |
| ui-editor cannot produce a consumable build (four TS2307 declaration errors AND a `noEmit` typecheck-only build script) | U2 F3, re-confirmed U3 (V-F2), sharpened by handoff review round 1 | **repair as in-scope package maintenance**: emitting build (repo dist conventions or documented source-exports fallback) + the four declaration fixes; no behavior change; record before/after | U4-01/U4-02 packaging + consumer editor mount |
| Fresh-checkout tests require built dependency artifacts (unit suite fails without dists) | U3 N-2 | pack script + consumer setup must encode the build order; record in README | U4-01 |
| Extension/authoring evidence to reproduce if the bridge changes | U3 combined verifier (forgery matrix, state-values tests) | bridge is NOT changed in U4; if any bridge file changes, reproduce `document-extensions.test.ts` + forgery matrix + state-values tests | pre-merge check |
| Saved-source diagnostic wiped on detail first mount (fails safe; studio discloses) | U3 V-F1 | consumer implements the disclosed-fallback correctly; the diagnostic-wipe fix remains owned by U3+ product-host UX (NOT a U4 obligation) | U4-05 walkthrough (consumer-side); V-F1 fix at next product-host pass |
| Catalog family statuses (3 deferred families) | catalog-coverage.json | consumer uses only families recorded "styled and usable" / "supported direct composition" | U4-02 |
| Frozen-contract changes (incl. design-doc §5 amendment) | this cycle | **not authorized in U4**; any amendment needs explicit owner authority | owner decision |

## 11. Exact deliverables and evidence locations

- `examples/u4-consumer/` (committed) + its README (handoff artifact per
  U4-06)
- `scripts/pack-u4-artifacts.mjs` + `dist-packs/` manifest (sha256s;
  tarballs themselves not committed — manifest + reproducible script only)
- `docs/ui-foundation/U4-COVERAGE.md`, `U4-ARTIFACTS.md`,
  `U4-WALKTHROUGH.md`, `U4-AGENT-EXERCISE` record
- `docs/ui-foundation/reviews/u4/` — independent reports + evidence
  (bytes-preserved via scoped `.gitattributes`)
- STATE / DECISIONS / U4-HANDOFF status reconciliation at closure

## 12. U4 implementation authorization prompt (copy-paste when ready)

> Authorize U4 for radz2291/vict-02 per docs/ui-foundation/U4-HANDOFF.md at
> its recorded tip (PREPARED — IMPLEMENTATION NOT AUTHORIZED → AUTHORIZED).
> Implement on a new isolated branch codex/ui-foundation-u4 from the U3
> closure lineage: repair ui-editor packaging (F3: emitting build + the four
> TS2307 declaration fixes, per the handoff's allowed-paths scope), pack the
> closure set, build examples/u4-consumer strictly from packed artifacts
> (no workspace links, source aliases or original-example imports), deliver
> the representative component proof (Button declared-action
> disabled/loading/feedback; catalog Checkbox checked→declared submission;
> AppShell navigation/active/responsive; Dialog focus/portal + Select value
> change), preview/production parity with bundle separation, the
> unfamiliar-agent bounded exercise, the complete walkthrough with required
> negatives, and the handoff artifacts. Frozen contracts must not change.
> Then run the fresh independent U4-07 gate, repair in-scope findings with
> affected rechecks, preserve all reports, and stop at the founder
> checkpoint with acceptance PENDING. No npm publication, merge to main,
> apps/studio integration, or deployment.
