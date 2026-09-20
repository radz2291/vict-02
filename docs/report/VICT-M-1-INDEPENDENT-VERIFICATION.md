# VICT-M-1 — Independent Verification (AUDIT-ONLY — VERDICT: NOT CLEARED FOR STABLE RELEASE)

> **Class:** independent audit record. This audit was performed by a
> fresh, independent auditor with no reliance on the implementation
> report, workflow summaries, claimed test counts, or claimed integrity
> values as proof. The M-1 implementation was audited as hostile
> evidence; expectations were derived from the frozen remediation
> contract, pre-M-1 behavior, governing VICT architecture, registry
> artifacts, actual source, and fresh independent probes. This is an
> AUDIT-ONLY record: **stable `0.3.0` was NOT published, Quellight was
> NOT repinned, M-1 was NOT formally closed, and Phase Q6 was NOT
> begun.** Only this report file was created and committed.

**Audit date:** 2026-09-21.
**Audited VICT tree:** `d1273da6cbc04622ce5af8241267f59ed163ba37`
(`HEAD == origin/main`, clean tracked tree, linear ancestry).
**Audited Quellight tree:** `0292e609b4b5ddfc9b7c065c3a415d5022e744ff`
(`HEAD == origin/main`, clean tracked tree, linear ancestry).

---

## 1. Verdict

```text
VERDICT: NOT CLEARED — CONDITIONAL STABLE RELEASE REFUSED

Findings: 1 Blocking · 0 High · 0 Medium · 0 Low · 4 Observations
```

The stable `0.3.0` publication, the Quellight stable repin, the M-1
formal closure, and Phase Q6 are **not permitted** under the audit gate
(0 Blocking / 0 High / 0 Medium required). The sole Blocking finding is
**B-1 — the candidate publication run is terminal-FAILURE and its only
durable publication-evidence artifact carries a provably divergent
release-set identity** (§4.1). Every other audited dimension passed,
including full candidate content authenticity (§4.3) — the refusal is an
evidence-chain refusal, not a content-authenticity refusal.

## 2. Resolved identities

| Anchor | Full SHA |
|---|---|
| VICT HEAD (== origin/main) | `d1273da6cbc04622ce5af8241267f59ed163ba37` |
| VICT candidate release source (run `35530894104` head, provenance subject) | `a98dd015a3cb6f8e210447dcc89f5cdefab02ec9` |
| VICT pre-M-1 negative-control anchor | `0536d1e4467edd9c6be639eae40ca3dc7b48754a` |
| Quellight HEAD (== origin/main) | `0292e609b4b5ddfc9b7c065c3a415d5022e744ff` |
| Quellight audited executable/ladder commit | `0fb4050` (ancestor of HEAD) |
| Quellight pre-M-1 negative-control anchor | `1d1c9f6ebb3187f85abea1f7f3db1c3f6976e0e9` |
| VICT M-1 contract freeze (alone, before executable changes) | `06672de21ab69e9e71904243bec9b8dcbc833241` |
| VICT M-1 implementation (Lane A) | `e123f0e85fe8fc7c9b29a2f0f9a00d0247528ff3` |
| VICT M-1 negative-control tests (Lane B) | `44cec8a` |
| VICT candidate release preparation (Lane C) | `f126ec5` |
| Post-publication release-engine correction (after release source) | `8844f54e0a6d59f1d81f241eb7ce32d3bad21e8c` |
| Publication workflow run | `35530894104` (run 7, `workflow_dispatch`, `.github/workflows/release.yml`) |

## 3. Audit Area 1 — history and boundedness (PASS, full)

1. **Contract committed alone first:** `06672de` touches exactly
   `docs/report/VICT-M-1-REMEDIATION-CONTRACT.md` (+326), and precedes
   all executable changes. PASS.
2. **Amendment discipline:** the only semantic amendment (`1a209f2`,
   trusted-publishing contract §8.1: build before the full suite) is a
   standalone docs commit, consumed afterwards by `c75f3ae`. PASS.
3. **Linear attribution:** both repositories are merge-free; the chain
   contract → implementation → focused tests → release preparation →
   release-infrastructure fixes → release source → documentation is
   linearly attributable; changed-file inventories were re-derived from
   git (`git diff --name-status 0536d1e..HEAD`, `1d1c9f6..HEAD`, and
   per-commit `--name-status`). PASS.
4. **Release source == run source:** run `35530894104` `head_sha` ==
   `a98dd015…`; all 13 provenance statements bind
   `gitCommit = a98dd015…`; the release source is an ancestor of both
   HEAD and `origin/main` (fetch re-verified; remote tip == local tip in
   both repositories). PASS.
5. **Changes after the release source:** `8844f54` (release-engine
   verification logic — content-id derivation + read-only verify
   backoff; fully disclosed in commit message, implementation report
   §8, and this audit §4.1), `3712d0c` (docs report), `d1273da` (docs
   system reference). Fully disclosed. PASS with note: the engine at
   HEAD is NOT the engine that executed the candidate run.
6. **Historical evidence byte-identical:** every tracked file under
   `docs/` at `0536d1e` — all Stage/Night/Q-era reports and frozen
   evidence — is byte-identical at HEAD except the three disclosed
   release/system documents
   (`RELEASE-COMPATIBILITY.md`,
   `RELEASE-TRUSTED-PUBLISHING-CONTRACT.md` via its documented
   amendment, `VICT-SYSTEM-REFERENCE.md`). PASS.
7. **Q5 remains formally closed:** Quellight decision register D-Q5-5
   (`VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED`) unchanged;
   M-1 recorded as OPEN-with-deadline only. PASS.
8. **No Q6 / live-provider work:** no provider, credential, or Q6
   behavior appears in either M-1 diff window; `verify:live-provider`
   untouched; no git tags exist in either repository; npm has no stable
   `0.3.0` (§4.3). PASS.

## 4. Findings

### 4.1 B-1 (BLOCKING) — candidate publication run is terminal-failure; its recorded release-set identity provably diverges from the frozen algorithm

Independently established from the public GitHub API, the engine source
at the exact release source, and the implementer's own disclosure:

1. Run `35530894104` concluded **`failure`** (all seven runs of the
   workflow history failed; no successful run exists). Steps 1–15
   succeeded, including step 15 "Publish the exact tarballs (OIDC — no
   token of any kind)". **Step 16 "Verify registry state and record
   release evidence" FAILED**; the contract-mandated
   `verify:release-consumer -- --registry` (contract §10, same run)
   therefore never executed in the publication run.
2. The frozen trusted-publishing contract §10 makes same-run
   post-publication verification mandatory ("Any mismatch fails the
   run") and §11.6 requires monitoring "to terminal completion". The
   run's own fail-closed design declared this run failed. The audit
   item "terminal success" (required for the candidate run) is **not
   met**.
3. The durable `release-evidence` artifact recorded by the run carries a
   contentId derived by the WRONG algorithm: the engine at
   `a98dd015…` (`commandPublish`) hashes a `JSON.stringify` of the
   member list, while the recorded RELEASE-COMPATIBILITY §2 algorithm is
   sha256 over the sorted newline-joined `name@version` list. The
   divergence is acknowledged and repaired by `8844f54` — committed
   AFTER the release source — whose own message states the run artifact
   "recorded a JSON-stringify-based digest … producing a divergent
   evidence identity (observed on run 35530894104)". The corrected
   engine has never executed any run.
4. Because `0.3.0-rc.1` is immutable under the never-republish guard,
   the defective evidence chain can never be regenerated for the
   candidate by re-running the workflow (any re-publish attempt fails
   closed; there is no valid resume point with all 13 published).
5. Disposition: the stable `0.3.0` release decision must rest on a
   candidate whose publication evidence chain is intact. It is not. The
   stable publication is REFUSED by this audit. The remediation is
   implementation work outside the audit mandate (see §9).

### 4.2 Severity note

Even under the most lenient classification (High), finding B-1 exceeds
the 0-Blocking/0-High/0-Medium gate; the audit outcome is identical
under either classification.

### 4.3 Registry, provenance, and content authenticity (PASS — recorded because it bounds B-1's blast radius)

Independently verified through unauthenticated public registry queries
and a disposable rebuild at the exact release source (worktree at
`a98dd015…`, `npm ci` + `npm run build` + the repository's own pack
engine; worktree and all artifacts removed afterward):

* All 13 packages expose exactly `0.3.0-rc.1`; `latest` is `0.2.0` and
  the candidate tag `vict-0.3.0-rc` → `0.3.0-rc.1` on every package;
  stable `0.3.0` does not exist anywhere on the registry.
* All 13 provenance statements (SLSA v1) bind
  `git+https://github.com/radz2291/vict-02@refs/heads/main`,
  workflow `.github/workflows/release.yml`, `workflow_dispatch`,
  `gitCommit = a98dd015…` — truthful.
* Runner was GitHub-hosted (`ubuntu-latest`, runner group
  "GitHub Actions"). Workflow at `a98dd015…` declares exactly
  `contents: read` + `id-token: write`; no `NODE_AUTH_TOKEN`, no
  `secrets.*`, no npm token anywhere; publish uses the OIDC exchange.
* The engine at `a98dd015…` publishes the frozen §5 topological order
  and enforces the never-republish guard (all-unpublished or
  byte-identical resume proof; "never overwrite or re-publish a used
  version"). No partial publication: all 13 versions are present.
* Rebuild comparison: **12/13 tarballs are byte-identical
  (sha512-equal) to the registry artifacts.** `@victframework/cli`
  differs ONLY in the tar entry mode of `package/bin/vict.mjs`
  (registry `0755`, Windows rebuild `0644`); the file content is
  byte-identical, the file is committed mode `100755`, and this audit
  host is Windows with `core.filemode=false` — the registry artifact is
  exactly what a Linux (GitHub-hosted) checkout of `a98dd015…`
  produces. Content authenticity: **13/13 PROVEN**; the candidate set
  is what `a98dd015…` builds.

Registry integrity values (sha512, base64), all independently matched
against the source rebuild:

| Package | dist.integrity (registry == rebuild) |
|---|---|
| `contracts` | `jW5zpBmQZizIrFnLXe9VpAJXD2MBqvlKV9c3N2i1VJa0y7INSoGKU74pjAJXlcg/S5VpE4SlAXb8iWQG1JSz+g==` |
| `sdk` | `pUjRPfix6oE+rqWPTdwi4ZMWGSBDNmOCDDUZMRMsacQjX/BSl2MupJEjiPe/PBKQ72RfCyz3yEx1ZFtZ8uS8BA==` |
| `kernel` | `917XmeLA+NcPYAPviGJ8SIw8lC2fiq3Xb7OtZ7BkjQpnthRH1Dfk0c600ANjkWP9PF/0DLxt4vmL4HGpTK6ZlA==` |
| `runtime` | `Y8dfHoMM1vGvtRaHoYQ5rRsTiaHHEwLdt6UJtFYjdh1YdXI0GZFKbUzAgweet3nFYjOZii/BUy6I4G/S458MEg==` |
| `store-sqlite` | `2VQ52jFd/fETjkFBF+7CtvcTYJo4K5vgRqIj+fKdZQVeBqXlrrvI0toHOP6+g5aPYcMEvcE1+Wi+jCdRHPQjIA==` |
| `application` | `NPkg5MYKl/cF/PrED78w9ohzCeFjuoXlZ+PzX50Y7KHg1rSa3FFQE4J2+WmF70zIvQPYo1qEc/ixaZAOLK/QRQ==` |
| `renderer-svelte` | `MERPwpNo5Jq9H8OXK9czUHE4jn5CuZMI7u/dKFQ7X5IRUhsDIOzJK6tb91uNG87k91DDwY/e1ofWiizOXiEVPQ==` |
| `appdata-sqlite` | `JgGgsBCMlr0MzHGJwoFm3XvQQkOPtDz0su4/u9+X04EJ2NxLTU/OcsNrO1zwZ+uiBn/99dw+1rU2SqmBrJoFkA==` |
| `scaffolder` | `fhJ6znXTwNsogLF+pZnKssmjUsP+zU01E/ixNg0OYtyxr8doF7n/9C7Aud4obTHZlk7qjkc9YUfDfzOQdrZK6A==` |
| `control` | `0lUsYzFsfXokfhR7NbjyTtVD18P2Jyiq4jK+VTJUsMmWmgiCl4Sp5SUfVOd7CF9b+hfI72lFOMl8VU9ydvNG9A==` |
| `mastra` | `WbmuhqqlbI8N8eSU61ureeo6jsJCe9MpM6keyS3HYqyHt10mOBpY6xluyyB88D9D3c18CZ5d05trTlNtUjcz5A==` |
| `server` | `NImQXOfuIPv8vGBcahHIifO1pR901haIC/oXvLlxnXZ7C2MM10Dg52VZ1BZQIco6j1tdTGaKoQ+hZl0t2HZssQ==` |
| `cli` | `gmV71cPX1Na7mc9lr0pF/YC3GAtS1VK/PDVziPKZ7Y2KTk6vYnvOPiTAu0A+o5zzZSfEG6nsuoyVRSq5wc0Y1g==` |

### 4.4 O-1 (Observation) — publish ORDER not independently provable from public metadata

Registry packument `time` values are CDN/replication-lagged (the first
stamped version coincides with the job's completion second; the last
stamps ~70s later) and are not order-authoritative; the observed
timestamp order deviates from the frozen §5 order but timestamps cannot
establish a violation. Workflow job logs require repository-admin API
authentication, which this audit neither holds nor requests. The engine
source provably iterates the frozen order and the publish step exited 0.
Recorded as an audit limitation, not a violation.

### 4.5 O-2 (Observation) — Windows exec-bit container difference (resolved)

See §4.3, `cli` bullet. Fully explained; corroborative of the
GitHub-hosted Linux build, not adverse.

### 4.6 O-3 (Observation) — untracked local debris in the VICT working tree

`CANARY-H1B-d4319803-probe.db`, `tmp-dbg.db`, and `vict-debug-4QkPli/`
are git-ignored, not part of the tracked tree, and were left untouched
per the no-modification rule. Cosmetic; no effect on any audited
identity.

### 4.7 O-4 (Observation) — audit scope boundary (FastGate)

Because finding B-1 is dispositive (no stable-release decision can
follow regardless of any other result), the audit did not execute the
full candidate authoritative ladder, the full 14-probe external
program, or the registry-only consumer ladder a second time. The
bounded verification actually performed is recorded in §5–§7. Should
B-1 be remediated, a fresh independent verification must cover the
remaining areas at full depth before any stable release.

## 5. Audit Area 2 — the old defect (PASS at source level)

At the pre-M-1 anchors: `qlt.proposal.draft@1` declared
`QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT = 'read'`
(Quellight `1d1c9f6…`,
`src/lib/sharedworld/ceremony-contract.ts` line 152; revision `'1'`,
line 144), while the same capability durably creates a pending proposal
row (the durable-state behavior that survives into `@2` unchanged and is
proven by the current focused suite: proposal row `status 'proposed'`,
`page.total === 1`). The pre-M-1 framework
(`0536d1e…`, `packages/mastra/src/tool-bridge.ts`) derived
`requiresApproval = effect === 'write' || effect === 'irreversible'`
with NO host-policy channel and NO disposition vocabulary — so the false
`read` declaration was the sole reason the write completed in-turn
quietly, and no truthful quiet-write representation existed. Changing
only the declaration to `write` therefore necessarily enters the
approval-required path (nothing else could suppress it). PASS (source
level; the one-time runtime reproduction in disposable worktrees was
not re-executed — §4.7).

## 6. Audit Areas 3–5 — M-1 semantics, durable evidence, migration (PASS at source + focused-suite level)

Independently reviewed the complete Lane A/Lane B diffs against the
frozen contract:

* **Runtime** (`e123f0e`, `control-types.ts`): closed two-member
  `EffectApprovalDisposition`, `VICT_EFFECT_POLICY_IDENTITY =
  'vict-effect-policy@1'`, three optional intent-immutable record
  members — exactly contract §3.1.
* **Control** (`agent-turns.ts`): the decision evidence is accepted only
  as bridge-supplied intent input and stamped at intent time; no path
  from capability code. PASS.
* **Mastra** (`tool-bridge.ts`): exact-match `(capabilityId,
  capabilityRevision)` entries only; fail-closed validation at tool
  build with exactly the four stable non-echoing codes of contract §6;
  validation resolves targets against the FULL pinned envelope before
  any tool exists; non-write targets (read/pure/irreversible) rejected;
  `hostQuietWriteApprovalFor` independently requires resolved effect
  `write` (irreversible can never be exempted even by a hostile entry);
  no wildcard form exists; defaults byte-equivalent when absent.
  PASS.
* **store-sqlite**: migration 10 `m1-approval-decision-evidence` is
  exactly the frozen §7 shape (three ADD COLUMN + one derived UPDATE;
  historical `effect` values untouched; unambiguous fixed-0.2.0-rule
  backfill; ordered forward-only per-migration atomic discipline);
  adapter persists/maps with absent-member-for-NULL shape stability and
  writes the three columns only on the intent insert (no update path).
  PASS.
* **Quellight adoption** (`c55489f`): capability advanced to
  `@2`/`write` (declaration and profile revision 4), composition
  supplies the exact one-entry host policy
  (`qlt.host-policy.quiet-write@1`) through the trusted
  composition-dependency channel only; existing test modifications are
  confined to the revision/release-identity bumps ('1'→'2',
  '0.2.0'→'0.3.0-rc.1') — no assertion weakened. PASS.
* **Focused suites executed by this audit** (implementer-authored, run
  read-only on the audited trees, corroborated by the source review
  above): VICT `tool-bridge.quiet-write.test.ts` +
  `m1-approval-evidence.test.ts` — 11/11 passed; Quellight
  `test/m1-truthful-effect.test.ts` (real composition, real SQLite,
  real governed path: `effect='write'`, `approvalRequired=false`,
  `approvalDisposition='host-policy-write-without-separate-approval'`,
  `effectPolicyIdentity='vict-effect-policy@1'`, zero approval rows,
  zero open approvals, zero awaiting-approval events, proposal row
  inert (`listClaims` total 0), evidence preserved across restart) —
  passed. The Quellight aggregate ladder (`npm ci`;
  `verify:consumer`; `verify:quellight`; `npm audit --omit=dev`;
  `git diff --check`) previously ran green on exactly this audited tree
  (session record, post-adoption). PASS at this depth; full depth
  deferred per §4.7.

## 7. Audit Area 6 — Quellight behavior (PASS at source level)

The M-1 window touches only the capability identity/effect, the profile
revision, the composition policy, the release identity, and additive
tests: proposal ceremony, memory modes, inspection, context assembly,
turn admission, and restart behavior are unchanged (inventories
re-derived from git; the unchanged files are byte-identical to the
anchor). The agent envelope remains exactly one capability,
`qlt.proposal.draft@2`; decision-verb refusals and the user-only
canonicalization path are enforced by files untouched in this window
and covered by the unweakened permanent suites. No live provider was
called by this audit.

## 8. Authentication attestation

No npm token, login, OTP, `.npmrc`, or local `npm publish` was used,
requested, or created by this audit. `npm whoami` was never invoked.
All registry evidence was obtained through unauthenticated public HTTP;
all workflow evidence through unauthenticated GitHub REST reads. The
one-time trust bootstrap and the OIDC publication itself were performed
by the implementation task through the documented browser ceremonies
(frozen bootstrap record); this audit neither repeated nor altered them.

## 9. Required next action (owner decision — NOT performed by this audit)

1. Amend the frozen trusted-publishing contract via a documented,
   standalone amendment that authorizes a READ-ONLY, non-publishing
   evidence run (or equivalent owner-approved mechanism) that re-executes
   the corrected `8844f54` engine's `verify-registry` +
   `verify:release-consumer -- --registry` against the immutable
   `0.3.0-rc.1` set from the exact release source `a98dd015…`, records a
   terminal-success evidence artifact with the CORRECT §2 contentId
   (`vict-release-set@1/0.3.0-rc.1`, content
   `v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4`),
   and explicitly preserves the history of run `35530894104` as the
   publication event with its failed verify step.
2. After such a terminal-success evidence run exists, re-run this
   independent audit's remaining scope (§4.7) and re-evaluate the
   conditional stable release.
3. Until then: **stable `0.3.0` MUST NOT be published; Quellight MUST
   remain pinned to exact `0.3.0-rc.1`; M-1 MUST remain unclosed; Phase
   Q6 MUST NOT begin.**

## 10. Preservation and cleanup statement

Both repositories were left byte-identical to their audited tips except
for this report file. No worktree, probe directory, fixture, database,
or artifact created by this audit survives (the disposable rebuild
worktree, its `node_modules`, the pack directory, and the tarball
comparison fixtures were removed and pruned). Neither `.pi/` (VICT) nor
`.quellight-data` (Quellight) was accessed. No history was rewritten; no
force-push, reset, or rebase occurred; the push of this report is
fast-forward only.
