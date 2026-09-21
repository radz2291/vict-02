# VICT-M-1 — Independent Re-Verification (AUDIT VERDICT: CLEARED FOR STABLE RELEASE)

> **Class:** fresh independent re-verification record. This audit was
> performed by an agent that did not participate in the VICT-M-1
> remediation, the candidate publication, or the evidence-chain recovery.
> No completion report was accepted by assertion: every claim below was
> re-established from the public registry, the public GitHub API,
> downloaded artifacts, fresh rebuilds, disposable runtime probes, and
> the repositories themselves. Frozen and historical documents were read
> as evidence and none was modified.

**Audit date:** 2026-09-21.
**Audited VICT tree:** `f301a75aa066486c3be6f88a438e85736915f70d`
(`HEAD == origin/main`, clean tracked tree, linear ancestry — 0 merge
commits; re-fetched immediately before and after the audit).
**Audited Quellight tree:** `0292e609b4b5ddfc9b7c065c3a415d5022e744ff`
(`HEAD == origin/main`, clean tracked tree, linear ancestry, 0 tags).

---

## 1. Verdict

```text
VERDICT: CLEARED — CONDITIONAL STABLE RELEASE PERMITTED

Findings: 0 Blocking · 0 High · 0 Medium · 2 Low · 3 Observations
```

Blocking finding **B-1** of
`docs/report/VICT-M-1-INDEPENDENT-VERIFICATION.md` is **CLOSED by this
re-verification**: the publication evidence chain of the immutable
`0.3.0-rc.1` candidate is intact through the owner-authorized,
read-only successor evidence run, every deferred audit-scope item
(former §4.7) has been executed at full depth with negative controls,
and the candidate content, provenance, semantics, and consumer behavior
are independently proven. The stable `0.3.0` publication, the Quellight
exact repin, and the formal closure of VICT-M-1 are **PERMITTED**. The
two Low findings and three Observations are non-blocking and are
recorded for the record; none gates the release.

## 2. Resolved identities

| Anchor | Full SHA / value |
|---|---|
| VICT HEAD (== origin/main, audited) | `f301a75aa066486c3be6f88a438e85736915f70d` |
| Quellight HEAD (== origin/main, audited) | `0292e609b4b5ddfc9b7c065c3a415d5022e744ff` |
| Immutable candidate source (provenance subject) | `a98dd015a3cb6f8e210447dcc89f5cdefab02ec9` |
| Original audit report commit | `ece30fe0ae1ce904ca45d66ddd510a851f4f6235` |
| Evidence-recovery amendment (alone, before implementation) | `98d59b64dd653c4205460a9bb0a10649baff7333` |
| Evidence-recovery implementation | `ba75d5b5df157ca08ac8a467968893c4790aee73` |
| Corrected release engine | `8844f54e0a6d59f1d81f241eb7ce32d3bad21e8c` |
| M-1 contract freeze (alone, before executable work) | `06672de21ab69e9e71904243bec9b8dcbc833241` |
| Pre-M-1 negative-control anchors | VICT `0536d1e4…`, Quellight `1d1c9f6e…` |
| Original publication run | `35530894104` — **terminal-`failure`** (verified live; never relabelled) |
| Successor evidence run | `35558851493` — **terminal-`success`, attempt 1** (verified live) |
| Candidate release-set identity | `vict-release-set@1/0.3.0-rc.1` |
| Candidate contentId (independently recomputed) | `v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4` |

## 3. Audit Area 1 — history, amendment legitimacy, boundedness (PASS)

1. **Freeze discipline:** `06672de` (M-1 contract, alone) precedes all
   executable M-1 work; `f1cc939` (trusted-publishing contract freeze)
   and `98d59b6` (evidence-recovery amendment, ALONE — one file, +212)
   each precede their consuming implementations (`94e8e7d`/`ba75d5b`);
   `1a209f2` (§8.1 amendment, alone) precedes `c75f3ae`. Linear,
   merge-free attribution re-derived from git for both repositories.
2. **Candidate publication source:** run `35530894104` `head_sha` ==
   `a98dd015…` (live API check); all 13 SLSA statements bind the same
   `gitCommit`; `release.yml` blob at HEAD is byte-identical to the
   release source (`28b53a71…` in both). The engine correction
   `8844f54` was committed only AFTER the publication run completed
   (run window 19:00:53–19:03:48Z; commit 19:24:38Z).
3. **B-1 divergence reproduced from first principles:** the engine at
   `a98dd015…` hashed `JSON.stringify(memberList)`; recomputing that
   algorithm yields exactly `v1_77e334fa…`, which is what the ORIGINAL
   run's downloaded `release-evidence` artifact (artifact `10611306330`)
   records. The recorded §2 algorithm (sha256 over the sorted
   newline-joined `name@version` list) yields `v1_9117e0cb…`. Both
   recomputations were performed independently in this audit. The
   original run is preserved truthfully terminal-`failure`.
4. **Recovery boundedness:** `98d59b6` changed exactly the amendment
   document; `ba75d5b` changed exactly `.github/workflows/release-evidence.yml`,
   `scripts/release-evidence.mjs`, `scripts/lib/evidence-rules.mjs`,
   `scripts/test/release-evidence.test.mjs` — no package source, no
   registry-facing surface. `git diff a98dd015..HEAD -- packages/` is
   EMPTY: no publishable source changed after the release source.
5. **Quellight untouched during recovery:** its last commit predates the
   amendment; the audited tree is unchanged, clean, and equal to its
   remote. **No Q6 work exists** in either repository;
   `verify:live-provider` and the model seam are byte-unchanged through
   both M-1 windows.
6. **Amendment judged as bounded evidence recovery:** the workflow is
   dispatch-only, `contents: read` only, bound to one exact candidate
   identity by constant comparison (not prefix match), expires with this
   case, and grants no publication/tag authority (Area 2). It is not a
   general relaxation of release proof: the frozen publication path,
   never-republish guard, and pre-publication ladder are untouched.

## 4. Audit Area 2 — evidence workflow authority and reachability (PASS)

Independently verified from the workflow text, the reachable engine
code, and the permanent unit tests (50 `release-evidence` tests +
`trusted-publishing` suite, all green in the audit's own ladder run):

* Trigger is `workflow_dispatch` ONLY (no push/tag/schedule/call);
  the in-workflow guard refuses any other trigger.
* Permissions are exactly `contents: read` at the top level; no
  `id-token: write`, no environment, no `secrets.*`, no
  `NODE_AUTH_TOKEN`/`NPM_TOKEN`/`_authToken`, no `.npmrc`, and no
  interpolation into any run block (inputs pass as env vars).
* Reachable scripts: `release-evidence.mjs` (guard/verify — pure
  evaluation and fail-closed exits) and the release engine ONLY through
  `pack` and `verify-registry` (non-mutating subcommands; enforced by an
  in-run static allow-list step AND permanent tests that fail closed on
  mutated fixtures: added `id-token: write`, job-level permission
  override, smuggled `publish`/`deprecate`/`trust`, non-dispatch
  triggers, input interpolation, mutated dispatch defaults).
* Bound identity: dispatch inputs DEFAULT to the bound candidate
  (`a98dd015…`, `0.3.0-rc.1`, `vict-0.3.0-rc`); any deviation fails the
  run at the bound-input gate (proven live by the implementer's negative
  probes and re-proven locally in this audit's tree by the unit suite;
  `--expect-content-id` is a full-value comparison — prefix match is
  insufficient by construction).
* The candidate is checked out as a detached worktree at the EXACT SHA
  (identity + clean-tree asserted); engine code runs from the evidence
  HEAD only after proving `8844f54…` is an ancestor and the corrected
  identity derivation is present. Even a hypothetical registry mutation
  could not be authorized: the run holds no OIDC write and no npm
  credential of any kind.

## 5. Audit Area 3 — original and successor runs, evidence artifact (PASS)

* `35530894104`: live API — `completed`/`failure`, attempt 1, head
  `a98dd015…`, path `.github/workflows/release.yml`, run number 7.
  All 7 runs of the publication workflow are attempt-1 and
  terminal-failure; no run exists after it (no hidden rerun, no
  conflicting stable/Q6 publication work).
* `35558851493`: live API — `completed`/`success`, attempt 1, head
  `ba75d5b…`, path `.github/workflows/release-evidence.yml`, run
  number 1. The workflow has EXACTLY ONE run in its history: no failed
  successor attempt, no hidden rerun.
* Evidence artifact downloaded and inspected (not trusted from status):
  artifact `10620394255` (`m1-candidate-evidence-recovery`), zip
  SHA-256 `574aa48b3f1ac1cc6cdd2c7f46561847c0546b0033d26d7674cb55e08b2fa3b3`,
  payload `m1-evidence-results.json` SHA-256
  `86c9153333ab790fa8014894e3119a98a828ec3c042d33459f90ebb72b01e774`,
  schema `vict-m1-evidence-recovery@1`, GitHub runId/attempt match the
  live API. All 13 sections `ok:true`; seal `allChecksPassed: true`
  with zero failed and zero non-gated sections — and every bound value
  in it was RECOMPUTED by this audit (Area 4/5), not trusted.

## 6. Audit Area 4 — content identity, registry state, provenance, rebuild (PASS)

**Registry recompute (fresh implementation, no repository engine code):**
all 13 `@victframework/*` packages expose exactly `0.3.0-rc.1`; every
downloaded tarball's own SHA-512 equals its `dist.integrity`; `latest`
is `0.2.0` ×13; `vict-0.3.0-rc` is `0.3.0-rc.1` ×13; stable `0.3.0` is
absent ×13; every registry manifest pins its internal dependencies at
exactly `0.3.0-rc.1` with no `workspace:`/`file:`/`link:`/`git`
specifiers. The §2 content identity recomputed from the registry-derived
member set equals
`v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4`
EXACTLY — and equals the successor artifact's recorded value.

**Provenance:** all 13 SLSA v1 attestations (fetched fresh from
`registry.npmjs.org/-/npm/v1/attestations/…`, DSSE payload decoded)
bind repository `https://github.com/radz2291/vict-02`, workflow
`.github/workflows/release.yml`, ref `refs/heads/main`,
`gitCommit = a98dd015…`, GitHub-hosted builder, invocationId
`…/actions/runs/35530894104/attempts/1` (the ORIGINAL publication run),
and a subject name/sha512 that matches the registry `dist.integrity`
digest of each package. 13/13, zero problems.

**Linux authoritative rebuild:** a fresh unauthenticated clone in
WSL2 Ubuntu 24.04 (the project's supported Linux environment, Node
v24.19.0), npm pinned `11.19.1`, detached at `a98dd015…` (identity +
clean tree asserted), `npm ci` + `npm run build` + the repository pack
engine: **13/13 tarballs are BYTE-IDENTICAL (SHA-512) to the live
registry artifacts**, including `@victframework/cli` (mode `-rwxr-xr-x`,
zero mode differences). The earlier Windows CLI mode-byte observation
(audit §4.3/O-2) is thereby resolved authoritatively: the registry
artifacts are exactly what the candidate source produces on the
supported Linux release runner.

## 7. Audit Area 5 — registry-only consumer proof and negative controls (PASS)

* `npm run verify:release-consumer -- --registry` executed in this
  audit against the public registry: exact `0.3.0-rc.1` resolution ×13,
  registry-resolved URLs, lockfile sha512 integrity ×13, strict
  typecheck, runtime composition over real SQLite with close/reopen,
  application-definition compile + renderer composition — ALL CHECKS
  PASSED (exit 0).
* Independent negative controls (disposable directory): with the
  registry made unreachable, `npm install @victframework/*` FAILS and
  installs NOTHING (no workspace, cache, file, link, git, monorepo, or
  VICT-checkout fallback); with `--offline` and a cold cache it fails
  identically. Quellight's own verifier carries the same
  unreachable-registry negative control (N-2) and held in its ladder.

## 8. Audit Area 6 — M-1 semantic proof (PASS, full depth incl. former §4.7 scope)

**Old defect reproduced (runtime, negative-controlled):** in a disposable
Quellight worktree at `1d1c9f6…` with the published `0.2.0` set, the
REAL offline conversation path drafted a proposal through
`qlt.proposal.draft@1` and durably recorded `effect='read'` with NO
approval-decision evidence (the 0.2.0 record has no such fields), zero
approval rows, zero awaiting-approval events, turn completed quietly,
one inert pending proposal created. **Negative control:** flipping ONLY
the declared effect to `write` (uncommitted) put the SAME invocation
into the approval-required path — intent `effect='write'`, turn
`awaiting-approval`, exactly one durable pending approval, exactly one
`tool.awaiting_approval` event, ZERO proposal rows (the effect never
ran). The false `read` declaration is thereby proven to have been the
sole cause of the unclassified quiet write.

**Candidate semantics (independent probes against the PUBLISHED
`0.3.0-rc.1` packages, 10/10 passed, each with negative controls):**

1. exact host quiet-write policy → intent records `effect='write'`,
   `approvalRequired=false`,
   `approvalDisposition='host-policy-write-without-separate-approval'`,
   `effectPolicyIdentity='vict-effect-policy@1'`; zero approval rows,
   zero awaiting-approval events; capability executed exactly once;
2. NEGATIVE CONTROL: no policy → the same write requires approval
   (`default-effect-policy`), effect NOT executed, one open approval;
3. NEGATIVE CONTROL: wrong-revision entry → no exemption;
4. unknown capability target in the policy → `…_UNRESOLVED_TARGET` at
   build, before any tool exists;
5. `read` target → `…_TARGET_NOT_WRITE`; 6. `irreversible` target →
   `…_TARGET_NOT_WRITE` (permanently unexemptable); 7. malformed
   entries → `…_MALFORMED_ENTRY`; 8. duplicate entries →
   `…_DUPLICATE_ENTRY`;
9. evidence survives restart and idempotent replay (same tool-call
   occurrence re-reads the ORIGINAL record — same invocationId, evidence
   byte-identical, exactly one effect; terminal replay is a safe bounded
   envelope, never raw output);
10. SQLite: the durable record carries the truthful evidence across a
    real close/reopen.

**Source-level review** (full M-1 window `0536d1e..HEAD`, 7 src files,
exactly the contract-authorized surfaces): the default rule
(`write`/`irreversible` → approval) is unchanged and can never weaken;
the host policy is validated FAIL CLOSED against the FULL resolved
envelope before any model-facing tool exists; there is no wildcard, no
capability-controlled path to the policy, and VICT contains NO
Quellight exemption (Quellight appears only in comments as a future
consumer). Quellight's composition supplies exactly ONE entry
(`qlt.proposal.draft`, revision `2`, identity
`qlt.host-policy.quiet-write@1`) through the trusted composition channel;
the envelope resolves ONLY that capability at ONLY revision `2`; no
executable `@1/read` alias remains (finding L-1 below records stale
text only). Agent authority remains proposal-only; decision verbs,
Memory Mode authority, retention, and the ceremony are untouched by the
M-1 windows (inventories re-derived; the Quellight M-1 test diff is
strictly identity bumps + one additive test file — no assertion
weakened). Quellight's real-composition focused suite
(`test/m1-truthful-effect.test.ts`) passed in this audit (1/1) and again
inside the authoritative ladder: quiet write truthfully classified
`write`, quiet ONLY through the host-owned policy, inert pending
material only, transcript intact.

**Migration:** migration 10 `m1-approval-decision-evidence` is exactly
the frozen §7 shape (three ADD COLUMN + one fixed-0.2.0-rule backfill
derived only from the NOT-NULL closed-vocabulary `effect` column);
historical effects are never rewritten; per-migration atomicity and
newer-schema refusal are proven by permanent tests (in the full ladder).

## 9. Audit Area 7 — canonical verification ladders (PASS, each run ONCE)

**VICT (frozen tree `f301a75…`, Windows, Node v22.13.1):** `npm ci` (0);
`verify:release-set` (0 — 13 packages, `0.3.0-rc.1`, `v1_9117e0cb…`);
`format:check` (0); `lint` (0); `typecheck` (0); `build` 13/13 (0);
**full test suite once — 2364 passed / 3 skipped, 124 files, exit 0**
(includes the focused M-1 suites: `tool-bridge.quiet-write` +
`m1-approval-evidence` = 11/11, re-run once more in isolation for the
record — 11/11 — and the 50-test evidence-workflow suite);
pack (0 — 13 canonical tarballs); tarball scan (0 — 13/13 clean);
isolated packed-tarball `verify:consumer` (0);
registry-only `verify:release-consumer -- --registry` (0);
`npm audit --omit=dev` (0 vulnerabilities); `git diff --check` (0).
No reruns; no assertion weakened; no timeout changed.

**Quellight (frozen tree `0292e60…`, exact RC pins):** `npm ci` (0);
`verify:consumer` (0 — registry-only exact-pin proof + N-2
unreachable-registry negative control held); `verify:quellight` (0 —
format, typecheck, governed-mutation gate, node-side suites including
the M-1 real-composition evidence, zero-warning dev-start gate, UI
islands, production build with closed-allowlist build-log scan,
real-browser hydration/responsive/axe check, Stop regression with
old-commit negative control, real-browser ceremony recovery,
credential/canary/local-path scan over 221 files, `git diff --check`);
`npm audit --omit=dev` (0 vulnerabilities); `git diff --check` (0).
No operator data (`.quellight-data`) was opened; VICT `.pi/` material
was preserved untouched and unread.

## 10. Findings

### 10.1 Low findings (non-blocking)

* **L-1 — stale `@1` literals in Quellight invariant/doc text.** Five
  Quellight files (`context-contract.ts`, `inspection-contract.ts`,
  `inspection-surface.ts`, `policy-contract.ts`) still carry the phrase
  "the envelope stays exactly `qlt.proposal.draft@1`" in permanent
  invariant strings and doc comments. Every EXECUTABLE surface uses the
  `QLT_PROPOSAL_CAPABILITY_REVISION = '2'` constant, the tests that
  assert these invariants check only stable substrings, and no behavior
  is affected — but the frozen text misdescribes the envelope revision.
  Disposition: documentation-hygiene correction in a later Quellight
  commit; no release impact.
* **L-2 — stale content ID in a Quellight verifier header comment.**
  `scripts/verify-consumer.mjs`'s header still cites the 0.2.0-era
  content ID (`v1_7a557983…`) next to the 0.3.0-rc.1 identity; the
  executable gate correctly enforces `v1_9117e0cb…` via
  `scripts/lib/release-set.mjs`. Cosmetic; no gate impact.

### 10.2 Observations

* **O-1 —** the recovery record §5 states the evidence artifact JSON is
  "6,748 bytes"; that value is the ZIP size (the JSON payload is 41,985
  bytes). Both recorded SHA-256 values (zip and JSON) are correct and
  were re-verified in this audit.
* **O-2 (carried) —** provenance is verified at the CONTENT level
  (decoded SLSA payloads, full field binding, subject-digest equality);
  DSSE/Sigstore cryptographic signature verification was not performed
  by this audit (the same scope the first audit recorded).
* **O-3 (carried) —** the publish ORDER inside the original run remains
  unprovable from public metadata (CDN-lagged timestamps); the engine
  provably iterates the frozen topological order and the publish step
  exited 0.

## 11. Authentication attestation

No npm token, login, OTP, `.npmrc`, or local `npm publish` was used,
requested, or created by this audit; `npm whoami` was never invoked. All
registry evidence was obtained through unauthenticated public HTTP; all
GitHub evidence through the public REST API (plus read-only artifact
downloads with the repository owner's existing GitHub credential — the
same class of authenticated GitHub REST read the recovery record
discloses). No trust relationship was created or altered.

## 12. Preservation and cleanup statement

Both repositories were left byte-identical to their audited tips except
for this report file. The old-tree probe worktree, the probe directory,
the WSL rebuild clone, negative-control fixtures, and downloaded
artifacts were removed after use. `.pi/` (VICT) and `.quellight-data`
(Quellight) were never opened. No history was rewritten; no reset,
rebase, force-push, or tag creation occurred; pushes are fast-forward
only.

## 13. Decision

The evidence chain of the immutable `0.3.0-rc.1` candidate is intact and
independently verified; the full deferred audit scope has been executed
and passed. **The stable `0.3.0` release through the existing
`.github/workflows/release.yml` (GitHub OIDC trusted publishing, no
credentials of any kind), the Quellight exact repin to `0.3.0`, and the
formal closure of VICT-M-1 are PERMITTED.** Phase Q6 planning remains
permitted but must not begin as part of that release.
