# VICT-M-1 — Candidate Evidence-Chain Recovery (B-1 REMEDIATION RECORD)

> **Class:** remediation implementation record for Blocking finding **B-1**
> of `docs/report/VICT-M-1-INDEPENDENT-VERIFICATION.md`, executed under the
> owner-approved, narrowly bounded amendment
> `docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`.
> This task published nothing, republished nothing, unpublished nothing,
> deprecated nothing, and changed no distribution tag and no trust
> relationship. It performed one READ-ONLY successor evidence run whose
> terminal-`success` conclusion and downloadable immutable artifact now
> stand as the publication evidence for the immutable `0.3.0-rc.1`
> candidate. **The original publication run `35530894104` remains
> truthfully terminal-`failure` and was never relabelled.** M-1 remains
> REMEDIATED, not verified: a fresh independent audit must still decide
> whether this closes B-1 and whether stable `0.3.0` is permitted.

**Date:** 2026-09-21.
**Working tree:** VICT `radz2291/vict-02` only. Quellight
(`0292e609b4b5ddfc9b7c065c3a415d5022e744ff`, `HEAD == origin/main`,
clean) was fetched once to confirm identity and otherwise left
byte-untouched and unread (no operator data opened).

---

## 1. Starting state (verified before any change)

| Anchor | SHA |
|---|---|
| VICT HEAD (== origin/main, clean tracked tree, linear ancestry) | `ece30fe0ae1ce904ca45d66ddd510a851f4f6235` |
| Quellight HEAD (== origin/main) | `0292e609b4b5ddfc9b7c065c3a415d5022e744ff` |
| Immutable candidate source | `a98dd015a3cb6f8e210447dcc89f5cdefab02ec9` |
| Original publication workflow run | `35530894104` (terminal-`failure`; publication completed, verify step failed) |
| Corrected release-engine ancestor | `8844f54e0a6d59f1d81f241eb7ce32d3bad21e8c` |
| Pre-M-1 VICT anchor | `0536d1e4467edd9c6be639eae40ca3dc7b48754a` |
| Trusted-publishing contract freeze | `f1cc939c642b31bb5c2fd9aae7a29220adbf0333` |
| M-1 contract freeze | `06672de21ab69e9e71904243bec9b8dcbc833241` |

No conflicting remediation, no stable `0.3.0`, and no Q6 work existed on
`origin/main`. All history-rewrite operations (reset, rebase,
force-push) were never used; the two commits below were pushed by normal
fast-forward after a fresh fetch. VICT's untracked `.pi/` material was
preserved untouched and unread.

## 2. Commits of this task

| Commit | Subject | Content |
|---|---|---|
| `98d59b64dd653c4205460a9bb0a10649baff7333` | `docs(release): amend the trusted-publishing evidence chain for the bounded M-1 candidate evidence recovery` | the amendment document ALONE (`docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`), committed before any executable change |
| `ba75d5b5df157ca08ac8a467968893c4790aee73` | `feat(release): add the read-only VICT-M-1 candidate evidence-recovery workflow` | `.github/workflows/release-evidence.yml`, `scripts/release-evidence.mjs`, `scripts/lib/evidence-rules.mjs`, `scripts/test/release-evidence.test.mjs` |

Implementation tip pushed (`HEAD == origin/main == ba75d5b…`, linear,
merge-free) before dispatch.

## 3. The evidence-only workflow (exact authority)

`.github/workflows/release-evidence.yml`:

* **Trigger:** `workflow_dispatch` ONLY (no push/tag/schedule), with
  three OPTIONAL inputs whose DEFAULTS are the bound identity
  (`source_sha a98dd015…`, `version 0.3.0-rc.1`,
  `npm_tag vict-0.3.0-rc`); any deviation fails the run closed.
* **Permissions:** exactly `contents: read` at the top level; no
  job-level override; NO `id-token: write`, no environment, no npm
  credential, no secret reference, no `NODE_AUTH_TOKEN`/`NPM_TOKEN`
  anywhere (unit-tested).
* **Runner/toolchain:** GitHub-hosted `ubuntu-latest` (the supported
  release runner), Node 24, npm pinned `11.19.1`, dependency cache
  disabled, `concurrency: vict-m1-candidate-evidence-recovery`
  (`cancel-in-progress: false`), `persist-credentials: false`.
* **Forbidden operations:** the workflow and its reachable scripts
  contain NO `npm publish`, `npm dist-tag`, `npm deprecate`,
  `npm unpublish`, `npm trust`, `npm login`, or `npm whoami`; the shared
  release engine is invoked ONLY through its non-mutating `pack` and
  `verify-registry` subcommands (statically enforced by an in-workflow
  guard step — subcommand allow-list + raw-text forbidden-command scan +
  exact-permissions match + no-interpolation scan — with the same audit
  deep-parsed by permanent unit tests; mutated-workflow fixtures fail
  closed). Even a hypothetically smuggled publish could not succeed:
  the run holds no OIDC write authority and no npm credential.
* **Source identity separation:** the engine runs from the evidence
  HEAD (asserting `8844f54…` is an ancestor and the corrected identity
  derivation is present); the candidate is independently detached as a
  worktree at the EXACT bound SHA (identity + clean-tree asserted) and
  all candidate install/build/pack runs there — current source code is
  never substituted for candidate package source.

## 4. The authoritative successor evidence run

| Property | Value |
|---|---|
| Run ID | `35558851493` |
| URL | `https://github.com/radz2291/vict-02/actions/runs/35558851493` |
| Workflow | `.github/workflows/release-evidence.yml` (run number 1) |
| Head | `ba75d5b5df157ca08ac8a467968893c4790aee73` |
| Event | `workflow_dispatch` (attempt 1; no re-run) |
| Started / completed (UTC) | `2026-09-21T03:50:07Z` / `2026-09-21T03:51:09Z` |
| Conclusion | **`success` (terminal)** — all 12 steps `success` |

Exactly ONE authoritative run was dispatched. No run failed and was
hidden or overwritten; no subsequent run exists for this workflow.

The run's job (timestamps from the jobs API): guard 03:50:19; candidate
`npm ci` + build + pack + scan 03:50:26–03:50:41; evidence chain
03:50:41–03:51:05; artifact upload 03:51:08. Run-log excerpts verified
post-flight: `13/13 members present at 0.3.0-rc.1; latest=0.2.0;
vict-0.3.0-rc=0.3.0-rc.1; stable absent`; `contentId
v1_9117e0cb…`; `13/13 provenance statements bind …`; `13/13 registry
artifacts hash-verified`; `13/13 rebuilt artifacts are byte-identical
AND content-identical`; `oidc-release: REGISTRY STATE VERIFIED for all
13 packages`; `scan-release-tarballs: ALL 13 TARBALLS CLEAN`;
`verify:release-consumer: ALL CHECKS PASSED`.

## 5. Evidence artifact (downloaded and inspected — not trusted from status)

| Property | Value |
|---|---|
| Artifact name | `m1-candidate-evidence-recovery` (run 35558851493, id `10620394255`) |
| Contents | one file, `m1-evidence-results.json` (6,748 bytes) |
| zip SHA-256 | `574aa48b3f1ac1cc6cdd2c7f46561847c0546b0033d26d7674cb55e08b2fa3b3` |
| JSON SHA-256 | `86c9153333ab790fa8014894e3119a98a828ec3c042d33459f90ebb72b01e774` |
| Schema | `vict-m1-evidence-recovery@1` |

The artifact binds: original publication run `35530894104`
(conclusion observed `failure` via the public API — still truthfully
failed, `head_sha` `a98dd015…`, path `.github/workflows/release.yml`);
the successor run (id 35558851493, attempt 1, URL, repository,
workflow ref); candidate source SHA; corrected engine SHA
(`8844f54…`, asserted ancestor of the evidence HEAD, with engine and
release-set-lib blob SHAs); all 13 package names and versions; all 13
registry integrity values; all 13 provenance identities (repository,
workflow path, ref, source `gitCommit`, GitHub-hosted builder id,
original-run invocationId, subject digest); the dependency graph from
the registry manifests; the COMPLETE corrected contentId; the
consumer-proof result (exit 0); and the seal
(`allChecksPassed: true`, zero failed sections, zero non-gated
sections). Self-scan of the serialized record (the repository's own
§9 credential/local-path rules): zero findings.

## 6. Required checks — all recorded, all passed (in the one run)

1. **Exact 13-package inventory at `0.3.0-rc.1`** — §7 table; member-set
   and inventory rules fail closed on any missing/extra member.
2. **Stable `0.3.0` absent** — proven per package (`stableAbsent: true`
   ×13).
3. **`latest` remains `0.2.0`** — per package dist-tag check.
4. **`vict-0.3.0-rc` → `0.3.0-rc.1`** — per package dist-tag check.
5. **Provenance identity** — all 13 SLSA v1 statements bind
   repository `https://github.com/radz2291/vict-02`, source SHA
   `a98dd015a3cb6f8e210447dcc89f5cdefab02ec9`, workflow
   `.github/workflows/release.yml`, GitHub-hosted builder, invocationId
   `…/actions/runs/35530894104/attempts/1`, and a subject sha512 equal
   to the registry `dist.integrity`. Content-level binding (the same
   scope as the independent audit); DSSE/Sigstore cryptographic
   verification was NOT performed and is recorded as such.
6. **Registry integrity captured** for all 13 (§7).
7. **Exact internal dependency pins** — every registry manifest's
   internal dependencies pin exactly `0.3.0-rc.1`; no
   `workspace:`/`file:`/`link:`/`git` specifiers; graph recorded.
8. **Rebuild from immutable source vs registry** — on the pinned Linux
   runner: **13/13 byte-identical (sha512) AND content-identical
   (extracted member sets, file bytes, tar entry modes)**, including
   `@victframework/cli` (mode `-rwxr-xr-x`, zero mode differences).
   The known Windows executable-mode observation was NOT hidden: the
   local Windows validation reproduced it exactly (12/13
   byte-identical; `cli` content-identical with ONLY
   `package/bin/vict.mjs` at `-rw-r--r--` vs registry `-rwxr-xr-x`;
   recorded in the local evidence file and here) — the Linux
   reconstruction is authoritative and resolves the observation.
9. **Corrected §2 content identity** — derived with the corrected
   engine's shared `deriveReleaseSetContentId` over the
   registry-derived member list:
   `v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4`
   (complete value; equals the contract-derived expected constant; the
   divergent JSON-stringify value `v1_77e334fa…` of the old engine is
   thereby retired).
10. **Registry-only external-consumer proof (same run)** —
    `verify:release-consumer -- --registry` executed at the candidate
    source (its own verifier, blob `14d19810…`; recorded set equals the
    bound set): **ALL CHECKS PASSED, exit 0**.
11. **External consumer resolution** — exact `0.3.0-rc.1` versions ×13,
    lockfile sha512 integrity ×13, every `@victframework/*` resolved
    URL on the public registry, no workspace/cache-concealed fallback,
    no `file:`/`link:`/`git` dependency, no monorepo leakage (verifier
    checks; strict typecheck, runtime composition with SQLite
    close/reopen, renderer composition all green).
12. **Content scan** — contract §9 rules over all 13 candidate tarballs
    (13/13 clean, standalone step AND inside the engine) and over the
    serialized evidence artifact itself (zero findings): no
    credentials, no tokens, no `.npmrc` content, no local absolute
    paths, no unrelated files.
13. **Corrected-engine `verify-registry` (read-only, bounded backoff)**
    — `REGISTRY STATE VERIFIED for all 13 packages` inside the same
    run.

## 7. The complete 13-package registry record (observed 2026-09-21)

All members at `0.3.0-rc.1`; dist-tags exactly
`{latest: 0.2.0, vict-0.3.0-rc: 0.3.0-rc.1}` per package; stable
`0.3.0` absent ×13; provenance gitCommit `a98dd015…` ×13;
rebuild byte+content identical ×13. Registry `dist.integrity`:

| # | Package | dist.integrity (sha512) |
|---|---------|-------------------------|
| 1 | `@victframework/contracts` | `sha512-jW5zpBmQZizIrFnLXe9VpAJXD2MBqvlKV9c3N2i1VJa0y7INSoGKU74pjAJXlcg/S5VpE4SlAXb8iWQG1JSz+g==` |
| 2 | `@victframework/sdk` | `sha512-pUjRPfix6oE+rqWPTdwi4ZMWGSBDNmOCDDUZMRMsacQjX/BSl2MupJEjiPe/PBKQ72RfCyz3yEx1ZFtZ8uS8BA==` |
| 3 | `@victframework/kernel` | `sha512-917XmeLA+NcPYAPviGJ8SIw8lC2fiq3Xb7OtZ7BkjQpnthRH1Dfk0c600ANjkWP9PF/0DLxt4vmL4HGpTK6ZlA==` |
| 4 | `@victframework/runtime` | `sha512-Y8dfHoMM1vGvtRaHoYQ5rRsTiaHHEwLdt6UJtFYjdh1YdXI0GZFKbUzAgweet3nFYjOZii/BUy6I4G/S458MEg==` |
| 5 | `@victframework/store-sqlite` | `sha512-2VQ52jFd/fETjkFBF+7CtvcTYJo4K5vgRqIj+fKdZQVeBqXlrrvI0toHOP6+g5aPYcMEvcE1+Wi+jCdRHPQjIA==` |
| 6 | `@victframework/application` | `sha512-NPkg5MYKl/cF/PrED78w9ohzCeFjuoXlZ+PzX50Y7KHg1rSa3FFQE4J2+WmF70zIvQPYo1qEc/ixaZAOLK/QRQ==` |
| 7 | `@victframework/renderer-svelte` | `sha512-MERPwpNo5Jq9H8OXK9czUHE4jn5CuZMI7u/dKFQ7X5IRUhsDIOzJK6tb91uNG87k91DDwY/e1ofWiizOXiEVPQ==` |
| 8 | `@victframework/appdata-sqlite` | `sha512-JgGgsBCMlr0MzHGJwoFm3XvQQkOPtDz0su4/u9+X04EJ2NxLTU/OcsNrO1zwZ+uiBn/99dw+1rU2SqmBrJoFkA==` |
| 9 | `@victframework/scaffolder` | `sha512-fhJ6znXTwNsogLF+pZnKssmjUsP+zU01E/ixNg0OYtyxr8doF7n/9C7Aud4obTHZlk7qjkc9YUfDfzOQdrZK6A==` |
| 10 | `@victframework/control` | `sha512-0lUsYzFsfXokfhR7NbjyTtVD18P2Jyiq4jK+VTJUsMmWmgiCl4Sp5SUfVOd7CF9b+hfI72lFOMl8VU9ydvNG9A==` |
| 11 | `@victframework/mastra` | `sha512-WbmuhqqlbI8N8eSU61ureeo6jsJCe9MpM6keyS3HYqyHt10mOBpY6xluyyB88D9D3c18CZ5d05trTlNtUjcz5A==` |
| 12 | `@victframework/server` | `sha512-NImQXOfuIPv8vGBcahHIifO1pR901haIC/oXvLlxnXZ7C2MM10Dg52VZ1BZQIco6j1tdTGaKoQ+hZl0t2HZssQ==` |
| 13 | `@victframework/cli` | `sha512-gmV71cPX1Na7mc9lr0pF/YC3GAtS1VK/PDVziPKZ7Y2KTk6vYnvOPiTAu0A+o5zzZSfEG6nsuoyVRSq5wc0Y1g==` |

Every value equals the audit's independently recorded table
(`VICT-M-1-INDEPENDENT-VERIFICATION.md` §4.3) — the registry state is
byte-for-byte unchanged from the audited state.

## 8. Negative controls (all executed before the authoritative run)

Permanent, in `scripts/test/release-evidence.test.mjs` (50 tests; whole
script suite 136/136 green):

* mutated dispatch defaults (any of the three inputs) → workflow audit
  refuses;
* added `id-token: write` → refuses; job-level permissions override →
  refuses; added `npm deprecate` step → refuses; engine publication
  subcommand (`oidc-release.mjs publish`) → refuses; non-dispatch
  trigger → refuses; input interpolation into a run block → refuses;
* stable `0.3.0` present → registry member state refuses; `latest`
  moved → refuses; candidate tag moved/missing → refuses; member
  missing → refuses; member extra → refuses;
* provenance mutations (gitCommit, repository, workflow path,
  invocationId, self-hosted builder, subject digest, undecodable
  payload) → each refuses;
* internal pin mutations (`^range`, wrong exact, `workspace:`,
  `file:`, `link:`, `git+ssh:`) → each refuses; wrong manifest version
  → refuses;
* rebuilt-bytes mismatch → refuses; content mismatch → refuses;
  exec-bit-only difference is recorded truthfully and still fails the
  gate;
* consumer-failure exit → evidence seal refuses (no successful
  conclusion possible);
* planted npm token, Windows `C:\Users` path, and runner `/home/…`
  path in evidence text → each detected by the self-scan.

Live fail-closed probes (local, real registry, read-only):

* `--source-sha ece30fe…` → BLOCKED (exit 1) at the bound-input gate;
* `--version 0.3.0-rc.2` → BLOCKED (exit 1);
* `--npm-tag latest` → BLOCKED (exit 1);
* `--expect-content-id v1_1111…` → BLOCKED (exit 1) at the contentId
  gate: computed `v1_9117e0cb…` != expected (deep gate, full ladder
  traversed);
* guard on a fixture workflow with a smuggled publication subcommand →
  exit 1 with named findings;
* full local ladder on the Windows host → failed CLOSED at the rebuild
  gate exactly on the audit's cli exec-bit observation (truthful;
  content-identical 13/13), and the corrected engine's local
  `verify-registry` failed closed on the same Windows artifact —
  confirming fail-closed behavior before dispatch.

## 9. No registry state changed; no npm authentication existed

* The workflow's complete authority is `contents: read`; no OIDC write,
  no environment, no npm token, no `.npmrc` involvement. No step, and
  no reachable code path, contains a registry-mutating command
  (statically enforced in-run and unit-tested).
* The run's own evidence proves the pre-existing state was only READ:
  integrity values, dist-tags, and provenance are byte-identical to the
  independent audit's records (§7), `latest` is `0.2.0` ×13, the
  candidate tag is `0.3.0-rc.1` ×13, stable `0.3.0` is absent ×13.
* No npm login, whoami, OTP, or token was used, requested, or created
  by this task. All registry access was unauthenticated public HTTP
  (packuments, tarballs, attestations) plus npm's public `view`/install
  reads; the only authenticated API calls were GitHub REST reads and
  the one workflow dispatch (repository administration by the owner
  identity, unrelated to npm).

## 10. Cleanup and final state

* Local validation artifacts (candidate worktree at `a98dd015…`,
  `.evidence-pack/`, local evidence JSON files, consumer log) were
  removed after use; no probe directory, worktree, or fixture survives.
* `.pi/` remained untouched and unread throughout.
* Quellight: `HEAD == origin/main == 0292e609b4b5ddfc9b7c065c3a415d5022e744ff`,
  clean, byte-untouched (no file opened, no data read, no commit, no
  push).
* VICT final: documentation commit appended (this report + status
  entries), pushed fast-forward; no tag created in either repository.

## 11. Standing

B-1's remediation is implemented and evidenced. Whether this successor
evidence closes B-1 is a decision for a FRESH INDEPENDENT VERIFICATION,
which must also complete the deferred audit scope
(`VICT-M-1-INDEPENDENT-VERIFICATION.md` §4.7). Until then: stable
`0.3.0` MUST NOT be published; Quellight MUST remain pinned to exact
`0.3.0-rc.1`; M-1 remains unclosed; Phase Q6 MUST NOT begin.
