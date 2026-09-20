# VICT-M-1 Remediation — Implementation and Candidate Publication Record

**Status:** Implemented and published as the verification candidate
`vict-release-set@1/0.3.0-rc.1`. **VICT-M-1 is NOT independently verified
and NOT closed** — it is remediated and awaiting independent
verification. Q5 remains formally closed; Phase Q6 remains not begun.

**Date:** 2026-09-21.
**Governing frozen contract:** `docs/report/VICT-M-1-REMEDIATION-CONTRACT.md`
(freeze commit `06672de…`, committed ALONE before any executable change).
**Release infrastructure:** trusted GitHub-OIDC publishing
(`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`; workflow
`.github/workflows/release.yml`). No npm token, no npm login, no npm OTP,
and no local `npm publish` were used, requested, or required anywhere in
this task; local `npm whoami` was never run (it is no longer a release
preflight).

## 1. Commits of this task (VICT)

| Commit | Subject | Content |
|---|---|---|
| `06672de…` | `docs(control): freeze the VICT-M-1 remediation contract` | the frozen remediation contract ALONE (L0) |
| `e123f0e…` | `feat(control): independent truthful effect and approval-decision evidence (VICT-M-1)` | Lane A: runtime record types, control intent path, SQLite migration 10 + adapter, Mastra bridge policy, public exports |
| `44cec8a…` | `test(control): permanent VICT-M-1 negative controls for quiet-write policy and decision evidence` | Lane B: focused suites (mastra quiet-write controls 3–11; store-sqlite evidence/migration controls 12–13) |
| `f126ec5…` | `chore(release): prepare VICT 0.3.0-rc.1 candidate` | Lane C: 13 manifests at `0.3.0-rc.1`, exact internal pins, lockfile, recorded release-set identity |
| `9f891f1…` | `fix(release): treat an omitted resume input as no resume point` | release-engine defect fix observed at the first dispatch (run 35529329279, pre-publication, registry-guard step) + regression tests |
| `003102b…` | `fix(release): detach the release checkout at the exact SHA after a full-ref fetch` | checkout robustness after GitHub lost the SHA-isolated fetch for the pushed tip (runs 35529604540/35529798221, pre-publication) |
| `1a209f2…` | `docs(release): amend the trusted-publishing contract §8.1 — build precedes the full suite` | contract AMENDMENT committed ALONE (first clean-runner execution exposed the ladder-order defect; run 35530469973) |
| `c75f3ae…` | `fix(release): run the full suite after the coordinated build (contract §8.1)` | consumes the §8.1 amendment |
| `a98dd01…` | `fix(release): repair the build-step YAML name` | YAML parse fixup caught by the permanent workflow-structure suite |
| `8844f54…` | `fix(release): align the evidence content-id derivation and tolerate registry propagation lag` | post-publication engine corrections (evidence identity derivation; read-only verify retry/backoff) |

## 2. Old and new behavior

* OLD (0.2.0): `qlt.proposal.draft@1` created a durable pending proposal
  row while DECLARING `effect: 'read'`; the untruthful declaration was the
  only reason the 0.2.0 default policy (`write`/`irreversible` → approval)
  let it complete in-turn. No per-invocation approval decision or policy
  basis was durably recorded anywhere.
* NEW (0.3.0-rc.1): the capability is pinned at `@2` and truthfully
  declares `effect: 'write'`; the approval decision is INDEPENDENT of the
  effect declaration and is durably recorded on every invocation at intent
  time with a closed-code basis and a versioned policy identity; the
  Quellight composition supplies the EXACT host quiet-write entry so the
  ratified single-actor envelope stays quiet; defaults are byte-equivalent
  when no host policy is supplied.

## 3. Public API and authority model (as implemented)

* `@victframework/runtime`: `EffectApprovalDisposition`
  (`'default-effect-policy'` | `'host-policy-write-without-separate-approval'`),
  `EFFECT_APPROVAL_DISPOSITIONS`, `VICT_EFFECT_POLICY_IDENTITY =
  'vict-effect-policy@1'`, and three intent-immutable members on
  `AgentToolInvocationRecord` (`approvalRequired?`, `approvalDisposition?`,
  `effectPolicyIdentity?`).
* `@victframework/control`: `AgentTurnService.recordToolInvocationIntent`
  stamps the bridge-resolved evidence onto the durable record at intent
  time; no later command mutates it.
* `@victframework/mastra`: `HostQuietWriteApprovalEntry`,
  `HostQuietWriteApprovalPolicy`, `CapabilityBridgeDeps.quietWriteApprovals`,
  `BridgeCapabilityPolicy.approvalDisposition`, and
  `validateHostQuietWriteApprovalPolicy` with the four stable codes
  (`VICT_HOST_QUIET_WRITE_POLICY_MALFORMED_ENTRY`,
  `..._DUPLICATE_ENTRY`, `..._UNRESOLVED_TARGET`, `..._TARGET_NOT_WRITE`).
  Validation is fail-closed at tool-build time against the FULL resolved
  envelope; `irreversible` targets are permanently refused; no wildcard
  form exists; the policy is reachable only through composition
  dependencies, so a capability cannot exempt itself.

## 4. Durable evidence and migration

* Migration **10** `m1-approval-decision-evidence` (ordered, forward-only,
  per-migration atomic): three columns added to `vict_agent_tool_invocation`
  (`approval_required INTEGER`, `approval_disposition TEXT`,
  `effect_policy_identity TEXT`) and one backfill derived ONLY from the
  NOT-NULL closed-vocabulary `effect` column under the fixed 0.2.0 rule
  (write/irreversible → required; read/pure → not; disposition
  `default-effect-policy`; identity `vict-effect-policy@1`). Historical
  effects are never rewritten; the derivation is unambiguous for every
  legacy row; rollback-on-failure and newer-schema refusal are proven by
  permanent tests.
* Evidence immutability: claim, fence, settlement, reconciliation, and
  restart never write the three fields; the idempotent re-record returns
  the ORIGINAL snapshot (permanent test coverage).

## 5. Old-tree negative controls (disposable worktree; removed afterward)

Reproduced at Quellight `1d1c9f6…` with the published 0.2.0 set installed
from the public registry (probe uncommitted; worktree removed after the
run):

* **NC1 (old truth):** the real offline conversation path recorded the
  proposal-creating invocation as `capabilityId=qlt.proposal.draft`,
  `capabilityRevision=1`, `effect=read`, with NO approval-decision
  evidence (`approvalRequired`/`approvalDisposition`/`effectPolicyIdentity`
  all absent) and 0 approval rows. PASS.
* **NC2 (declaration-only flip, uncommitted):** the SAME invocation with
  only the declaration flipped to `write` entered the 0.2.0
  approval-required path — `effect=write`, turn `awaiting-approval`,
  exactly 1 durable pending approval row. PASS.

## 6. Permanent negative-control results (VICT focused suites)

`packages/mastra/test/tool-bridge.quiet-write.test.ts` (7 tests, green)
covers controls 3–11 of the frozen matrix: quiet write executes and
records `write`/`approvalRequired=false`/`host-policy-write-without-
separate-approval`/`vict-effect-policy@1` with zero approval rows and
zero awaiting-approval events (3, 10); removing the policy restores the
approval-required path (4); wrong ID/revision never exempted (5); seven
malformed/duplicate/unmatched/read/irreversible entry cases fail closed
at build with the stable codes (6, 9-build); capability self-exemption is
inert (7); ordinary writes keep the default requirement (8); irreversible
without policy still requires approval (9-runtime); terminal replay
without a second effect (11).
`packages/store-sqlite/test/m1-approval-evidence.test.ts` (4 tests,
green) covers migration backfill preserving every unrelated column (13),
atomic rollback of a failing migration 10, evidence immutability through
claim/settlement/restart/idempotent re-record (12), and the migration
name/shape source guard.
Existing suites were NOT weakened; all 584 tests of the four affected
packages pass.

## 7. Release: exact source, workflow run, and registry proof

* **Release-source commit (published bytes' provenance):**
  `a98dd015a3cb6f8e210447dcc89f5cdefab02ec9` (pushed; `origin/main`
  confirmed at the same SHA immediately before dispatch).
* **Release-set identity:** `vict-release-set@1/0.3.0-rc.1`, content ID
  `v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4`
  (recorded algorithm: sha256 over the sorted newline-joined
  `name@version` list; `npm run verify:release-set` green, 13 packages).
* **Candidate tag:** `vict-0.3.0-rc` (the frozen closed-vocabulary tag for
  `X.Y.Z-rc.N`). `latest` remains `0.2.0` on all 13; stable `0.3.0` is NOT
  published.
* **Workflow run (successful publication):**
  `35530894104` — https://github.com/radz2291/vict-02/actions/runs/35530894104
  — checkout/detach of the exact SHA, Node 24 + npm 11.19.1, input/lineage/
  registry-guard validation, `npm ci`, release-set gate, format/lint/
  typecheck, build of all 13, FULL test suite once (all green on the
  clean runner after the §8.1 amendment), pack + tarball scan (13/13
  clean), isolated packed-tarball consumer proof, then **OIDC publication
  of all 13 packages in frozen topological order — zero npm tokens, zero
  OTPs** (publish step exit 0; the run's own verify step then failed on
  immediate stale CDN reads — see §8).
* **Prior failed runs (all diagnosed and corrected through normal
  commits; all pre-publication except the final verify step):**
  `35529329279` (engine refused the empty resume input; fix `9f891f1`),
  `35529604540` + `35529798221` (GitHub SHA-isolated fetch cache lost the
  freshly pushed tip; checkout made ref-based + exact-SHA detach in
  `003102b`), `35530469973` (first clean-runner full suite; cross-process
  fixtures require built outputs; contract §8.1 amendment `1a209f2` +
  reorder `c75f3ae`).

### 7.1 The 13-package candidate table

The table below records every member at `0.3.0-rc.1` with the published
`dist.integrity` (from the workflow's evidence artifact). Post-run
independent verification compared the LIVE registry `dist.integrity` of
all 13 against this table: **13/13 equal**.

| # | Package | Version | dist.integrity (sha512, published) |
|---|---------|---------|------------------------------------|
| 1 | `@victframework/contracts` | 0.3.0-rc.1 | `sha512-jW5zpBmQZizIrFnLXe9VpAJXD2MBqvlKV9c3N2i1VJa0y7INSoGKU74pjAJXlcg/S5VpE4SlAXb8iWQG1JSz+g==` |
| 2 | `@victframework/sdk` | 0.3.0-rc.1 | `sha512-pUjRPfix6oE+rqWPTdwi4ZMWGSBDNmOCDDUZMRMsacQjX/BSl2MupJEjiPe/PBKQ72RfCyz3yEx1ZFtZ8uS8BA==` |
| 3 | `@victframework/kernel` | 0.3.0-rc.1 | `sha512-917XmeLA+NcPYAPviGJ8SIw8lC2fiq3Xb7OtZ7BkjQpnthRH1Dfk0c600ANjkWP9PF/0DLxt4vmL4HGpTK6ZlA==` |
| 4 | `@victframework/runtime` | 0.3.0-rc.1 | `sha512-Y8dfHoMM1vGvtRaHoYQ5rRsTiaHHEwLdt6UJtFYjdh1YdXI0GZFKbUzAgweet3nFYjOZii/BUy6I4G/S458MEg==` |
| 5 | `@victframework/store-sqlite` | 0.3.0-rc.1 | `sha512-2VQ52jFd/fETjkFBF+7CtvcTYJo4K5vgRqIj+fKdZQVeBqXlrrvI0toHOP6+g5aPYcMEvcE1+Wi+jCdRHPQjIA==` |
| 6 | `@victframework/application` | 0.3.0-rc.1 | `sha512-NPkg5MYKl/cF/PrED78w9ohzCeFjuoXlZ+PzX50Y7KHg1rSa3FFQE4J2+WmF70zIvQPYo1qEc/ixaZAOLK/QRQ==` |
| 7 | `@victframework/renderer-svelte` | 0.3.0-rc.1 | `sha512-MERPwpNo5Jq9H8OXK9czUHE4jn5CuZMI7u/dKFQ7X5IRUhsDIOzJK6tb91uNG87k91DDwY/e1ofWiizOXiEVPQ==` |
| 8 | `@victframework/appdata-sqlite` | 0.3.0-rc.1 | `sha512-JgGgsBCMlr0MzHGJwoFm3XvQQkOPtDz0su4/u9+X04EJ2NxLTU/OcsNrO1zwZ+uiBn/99dw+1rU2SqmBrJoFkA==` |
| 9 | `@victframework/scaffolder` | 0.3.0-rc.1 | `sha512-fhJ6znXTwNsogLF+pZnKssmjUsP+zU01E/ixNg0OYtyxr8doF7n/9C7Aud4obTHZlk7qjkc9YUfDfzOQdrZK6A==` |
| 10 | `@victframework/control` | 0.3.0-rc.1 | `sha512-0lUsYzFsfXokfhR7NbjyTtVD18P2Jyiq4jK+VTJUsMmWmgiCl4Sp5SUfVOd7CF9b+hfI72lFOMl8VU9ydvNG9A==` |
| 11 | `@victframework/mastra` | 0.3.0-rc.1 | `sha512-WbmuhqqlbI8N8eSU61ureeo6jsJCe9MpM6keyS3HYqyHt10mOBpY6xluyyB88D9D3c18CZ5d05trTlNtUjcz5A==` |
| 12 | `@victframework/server` | 0.3.0-rc.1 | `sha512-NImQXOfuIPv8vGBcahHIifO1pR901haIC/oXvLlxnXZ7C2MM10Dg52VZ1BZQIco6j1tdTGaKoQ+hZl0t2HZssQ==` |
| 13 | `@victframework/cli` | 0.3.0-rc.1 | `sha512-gmV71cPX1Na7mc9lr0pF/YC3GAtS1VK/PDVziPKZ7Y2KTk6vYnvOPiTAu0A+o5zzZSfEG6nsuoyVRSq5wc0Y1g==` |


### 7.2 Registry-only consumer proof (post-run, local, registry-only)

`npm run verify:release-consumer -- --registry` at the release source —
exact `0.3.0-rc.1` versions resolved ONLY from `https://registry.npmjs.org/`
(lockfile integrity metadata, strict typecheck, runtime + renderer
composition) — ALL CHECKS PASSED.

## 8. Honest limitation recorded from the successful run

The successful run's final step (`verify-registry`) failed AFTER
publication: every publish had already exited 0, but the immediate
registry reads returned stale packuments (npm CDN propagation lag), so
the step reported all 13 versions "missing". Independent verification
performed minutes later (this task) proved all 13 versions, tags, and
integrity values correct and equal to the run's own packed artifacts
(13/13). Two engine corrections were committed for future releases
(`8844f54`): the evidence content-id derivation now uses the recorded
algorithm (the run's artifact recorded a JSON-stringify-based digest,
`v1_77e334fa…` — the authoritative recorded identity remains
`v1_9117e0cb…`), and verification retries read-only with bounded backoff.
No registry mutation of any kind followed publication.

## 9. Verification summary (local, per lane discipline)

* Focused development suites: `tool-bridge.quiet-write` (7), `m1-approval-
  evidence` (4), affected-package suites 584/584, script suite 55/55 —
  all green.
* Pre-dispatch at the release source: `format:check`, `lint`,
  `typecheck`, `build` (13), `verify:release-set`, pack (13) +
  `scan-release-tarballs` (13/13 clean), packed-tarball
  `verify:release-consumer`, `git diff --check` — all exit 0.
* The authoritative full ladder ran ONCE in the release workflow (§7).
* Post-publication: registry-only consumer verifier (§7.2) + the
  13/13 registry↔artifact integrity comparison (§7.1).

## 10. Limitations and audit readiness

* The successful workflow run is terminal-FAILURE due solely to the
  post-publication verify step's stale reads (§8); the publication and
  pre-publication chain within it are complete and green. Independent
  post-publication verification is complete and green. Auditors should
  weigh both facts (run log and §7.1/§7.2 evidence are reproducible).
* `npm pack` is not byte-deterministic across machines for a
  content-identical tree (tar/gzip metadata); the binding integrity proof
  is registry == the workflow's own packed artifact (13/13), with
  content-level equality of the release source re-proven by extraction
  (13/13 file lists and file bytes).
* Evidence artifacts: the workflow `release-evidence` artifact
  (`release-results.json`) is referenced by run `35530894104`; its
  recorded contentId reflects the pre-`8844f54` derivation (§8).
* M-1 is REMEDIATED, not verified: independent verification, the stable
  `0.3.0` release decision, and the Quellight stable repin remain
  future work. Q6 has not begun.
