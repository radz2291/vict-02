# VICT Trusted-Publishing Evidence-Recovery Amendment

**Status:** Owner-approved, narrowly bounded amendment to the release
evidence chain — committed ALONE before any executable change.
**Date:** 2026-09-21 (committed after the audit commit `ece30fe0…`).
**Amends:** the evidence-chain provisions of
`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md` (§10 post-publication
verification and evidence recording) for THIS CASE ONLY. The frozen
contract text, the frozen M-1 remediation contract, and all historical
reports remain byte-for-byte unchanged; this document is the amendment
of record.
**Governing audit:** `docs/report/VICT-M-1-INDEPENDENT-VERIFICATION.md`
(verdict `NOT CLEARED — CONDITIONAL STABLE RELEASE REFUSED`, finding
B-1, required next action §9.1).
**Scope guard:** this amendment does NOT implement VICT-M-1, does NOT
change any package version, does NOT publish, republish, unpublish,
deprecate, or retag anything, does NOT change any trust relationship,
does NOT repin Quellight, and does NOT begin Phase Q6.

Amendment rule: this amendment is consumed only by a dedicated,
READ-ONLY, evidence-only workflow and its supporting engine. If any
semantic rule below must change, the change is documented in a further
standalone amendment commit BEFORE implementation consumes it. No
silent reinterpretation; no amendment bundled with consuming
implementation.

---

## 1. Truthful record of finding B-1 and the failed run

The publication workflow run **35530894104**
(`https://github.com/radz2291/vict-02/actions/runs/35530894104`,
`workflow_dispatch`, `.github/workflows/release.yml`, head
`a98dd015a3cb6f8e210447dcc89f5cdefab02ec9`) is and remains
**terminal-`failure`**. Its steps 1–15 succeeded, including step 15
"Publish the exact tarballs (OIDC — no token of any kind)": all 13
candidate packages were published. Its step 16 "Verify registry state
and record release evidence" **FAILED** on immediate stale CDN reads,
so the contract-mandated same-run
`verify:release-consumer -- --registry` never executed in that run.
The run is never to be relabelled as successful.

Additionally, the durable `release-evidence` artifact recorded by that
run carries a contentId derived by the WRONG algorithm (a
JSON.stringify-based digest, observed `v1_77e334fa…`) instead of the
recorded `RELEASE-COMPATIBILITY.md` §2 algorithm. The engine correction
`8844f54e0a6d59f1d81f241eb7ce32d3bad21e8c` (committed AFTER the release
source) aligns the derivation with the recorded algorithm; that
corrected engine has never executed any run. The independent audit
recorded all of this as Blocking finding **B-1**: the candidate
publication evidence chain is defective, and no stable-release decision
can rest on it.

## 2. Why the immutable candidate cannot be republished

The candidate `0.3.0-rc.1` is an immutable published version of the
coordinated release set. The never-republish guard (frozen contract
§6/§10, engine-enforced) forbids overwriting, re-publishing, or
unpublishing ANY used version, and `0.3.0-rc.1` is used: all 13 member
versions exist on the public registry with valid provenance. Any
attempt to regenerate the evidence chain by re-running the publication
workflow would therefore fail closed at the registry guard (there is no
valid resume point with all 13 published), and any successful
"re-publication" would be a violation, not a remedy. The evidence
defect is in the EVIDENCE CHAIN, not in the registry content: the
independent audit separately proved full candidate content
authenticity (13/13 provenance-bound, integrity-verified rebuild
comparison). The only admissible repair is therefore a READ-ONLY
successor evidence mechanism that re-derives the publication evidence
from the registry and the immutable source, without touching the
registry.

## 3. Strict eligibility for successor evidence recovery

A successor evidence run is eligible to stand as the publication
evidence for this candidate if and only if ALL of the following hold:

1. **Exact bounded identity** (§4) — any deviation fails the run.
2. **Read-only execution** — the successor workflow carries exactly
   `permissions: contents: read`, requests no `id-token: write`, no
   environment, no npm credential, and no secret, and invokes no
   registry-mutating command of any kind.
3. **Registry integrity proof** — the exact 13 members exist at
   `0.3.0-rc.1`, every registry `dist.integrity` is captured, and
   equals the SHA-512 integrity of the artifact rebuilt from the
   immutable candidate source on the pinned supported Linux runner.
4. **Provenance proof** — every member's SLSA v1 provenance binds the
   frozen repository `radz2291/vict-02`, source commit
   `a98dd015a3cb6f8e210447dcc89f5cdefab02ec9`, workflow
   `.github/workflows/release.yml`, and the original publication run.
5. **Corrected identity algorithm** — the corrected engine's frozen §2
   release-set identity derivation (sha256 over the sorted
   newline-joined `name@version` list, prefixed `v1_`) is computed from
   the registry-derived member set and equals the contract-derived
   expected value recorded in §4.
6. **Same-run registry-only external-consumer proof** —
   `verify:release-consumer -- --registry` (or its exact
   repository-defined equivalent) passes against the public registry in
   the SAME successor evidence run; a consumer failure prevents any
   successful conclusion.
7. **Terminal success and immutable artifact** — the run concludes
   terminal-`success` only when every check passed, and records a
   downloadable immutable evidence artifact binding the identities of
   §8.
8. **No authorization transfer** — the mechanism grants no publication
   authority and no authority over distribution tags; it cannot be used
   to publish, republish, unpublish, deprecate, or retag anything.

## 4. Bound identity of this recovery (exact, complete)

This recovery is bounded to EXACTLY the following candidate and no
other:

```text
version: 0.3.0-rc.1
source: a98dd015a3cb6f8e210447dcc89f5cdefab02ec9
publication run: 35530894104
package count: 13
registry: https://registry.npmjs.org/
```

Derived and equally binding:

```text
release-set identity: vict-release-set@1/0.3.0-rc.1
corrected contentId (expected):
  v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4
corrected engine commit: 8844f54e0a6d59f1d81f241eb7ce32d3bad21e8c
candidate dist-tags (required state):
  latest        -> 0.2.0 (never a candidate)
  vict-0.3.0-rc -> 0.3.0-rc.1
stable 0.3.0: MUST NOT exist on the registry for any member
original run conclusion: failure (never relabelled)
```

The successor evidence engine must fail closed unless the corrected
contentId computed from the registry-derived member set equals the
complete value above (prefix-match alone is insufficient).

## 5. Registry integrity and provenance verification (required)

The successor evidence run must, in one run:

* capture the registry `dist.integrity` of all 13 members at
  `0.3.0-rc.1`;
* prove each equals the SHA-512 integrity of the tarball rebuilt from
  the immutable candidate source `a98dd015…` on the pinned supported
  Linux runner (GitHub-hosted, the supported release runner), and prove
  content-level equality of the rebuilt and registry artifacts;
* fetch and decode each member's SLSA v1 provenance from the registry
  attestation endpoint and prove the exact bindings of §3.4 (including
  the invocationId of the original publication run and the tarball
  subject digest binding to the registry integrity);
* prove the registry-manifest dependency graph of all 13 members pins
  exactly `0.3.0-rc.1` with one coherent set and no
  `workspace:`/`file:`/`link:`/`git` specifiers;
* prove stable `0.3.0` does not exist for any member and the dist-tag
  state is exactly the §4 required state;
* scan all candidate artifacts and the evidence artifact itself for
  credentials, local absolute paths, `.npmrc` content, tokens, and
  unrelated files (fail closed).

The known Windows executable-mode observation (audit §4.3/O-2: a
Windows rebuild of `@victframework/cli` differs from the registry
artifact ONLY in the `bin/vict.mjs` tar entry mode, content
byte-identical) must not be hidden: the authoritative reconstruction is
the Linux-runner rebuild, and its result is recorded truthfully either
way.

## 6. External-consumer proof (required, same run)

The successor evidence run must execute the repository's registry-only
consumer verifier — `npm run verify:release-consumer -- --registry`
(executed at the immutable candidate source, whose recorded
compatibility set is exactly the bounded candidate) — proving exact
`0.3.0-rc.1` resolution for all 13 members from
`https://registry.npmjs.org/` only, lockfile integrity hashes for every
member, no workspace/cache-concealed fallback, no `file:`/`link:`/`git`
dependency, no monorepo leakage, and the passing typecheck + runtime +
renderer composition. Any failure fails the run closed.

## 7. Forbidden operations (absolute)

The successor evidence mechanism must never authorize or perform:
package publication, republishing, unpublishing, deprecation, trust
changes (`npm trust`), distribution-tag mutation (`npm dist-tag`,
`latest` movement, candidate-tag removal or re-creation), `npm login`,
`npm whoami`, or any use of npm credentials or tokens. It may never
broaden into a general release-repair platform: it is bounded to the
exact candidate of §4 and expires with this case.

## 8. Evidence artifact binding (required)

The downloadable immutable artifact must bind, in one JSON record:
the original publication run (id, truthful terminal-`failure`
conclusion, workflow path); the successor evidence run (id, URL,
conclusion inputs, timestamps); the candidate source SHA; the corrected
engine SHA; all 13 package names and versions; the registry integrity
values; the provenance identities; the dependency graph; the COMPLETE
corrected contentId; and the external-consumer result. The artifact
must contain no credential material, no `.npmrc` content, no tokens,
and no local absolute paths (fail closed on any finding).

## 9. Standing of the audit gate (unchanged)

This amendment repairs the evidence chain only. It does NOT clear the
audit gate: an independent verification must still decide whether this
successor evidence closes B-1 and whether the remaining audited scope
(audit §4.7) passes at full depth. Until that fresh independent
verification permits it, stable `0.3.0` MUST NOT be published,
Quellight MUST remain pinned to exact `0.3.0-rc.1`, M-1 MUST remain
unclosed, and Phase Q6 MUST NOT begin.
