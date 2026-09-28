# Release Trusted-Publishing Contract — CONSOLIDATED Amendment Draft §16 (2026-09-27): facade retirement

**Status:** DRAFT amendment — presented for owner ratification on the
review branch `pi/ui-facade-retirement-r2` (based on the facade-retirement
candidate `pi/ui-facade-retirement-r1` @ `bac9c0164…`, itself based on the
verified authoring-tools tip `pi/ui-authoring-tools-r1` @ `bd8f580f…`),
with the release-readiness corrections of `pi/release-readiness-r3`
(release-readiness gaps corrected on top of the r2 tip `d8c70df2…`).
This branch prepares the candidate for final owner review: it resolves the
inherited root typecheck/lint/format findings, selects the NEW coherent
candidate version `0.4.0-rc.1` per the frozen §7 rule (the `0.3.1` line
is consumed), re-derives the set identity, and closes the three
release-readiness gaps (full normative consistency below; a fail-closed
pre-publication contract-authority gate; the first-publication bootstrap
for the two members that have no registry presence). This draft
CONSOLIDATES and SUPERSEDES the unratified §15 draft
(`RELEASE-TRUSTED-PUBLISHING-CONTRACT-AMENDMENT-DRAFT-2026-09-27.md`):
§15 re-derived the publication order for a 15-package candidate that
still carried the `renderer-svelte` compatibility facade; that
intermediate order is OBSOLETE for the final package graph, was NEVER
ratified, and is NOT authority for anything here — every derivation in
this draft starts from the RATIFIED §14 state plus machine validation
against the actual manifests. Nothing is published; the frozen contract
file (`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`) is NOT edited by
these branches; no Stage 8 criterion is amended; G3 remains HELD.

If the owner ratifies this draft, the frozen contract file changes in
EXACTLY the following ways (apply verbatim, nothing else):

- **Appendix A** replaces the §5 heading and body (through the order
  fence, immediately before `## 6.`);
- **Appendix B (part 1)** applies the twelve enumerated REMOVE/INSERT
  substitutions to the current-tense count norms in §§1, 2, 6, 8, 10,
  and 11, and to the header amendments-to-date line;
- **Appendix B (part 2)** appends the §16 amendment record — including
  **§16.5, the ratification sequence-deviation authorization**, which the
  owner must complete (authorize or direct reversion) as part of
  ratification.

Until ratification the frozen contract text remains the §14 state and
the repository refuses the gap fail-closed:
`node scripts/verify-contract-authority.mjs` is RED BY DESIGN on this
tree, and every registry-writing path (`oidc-release.mjs validate` and
`publish` — including resume paths — `publish-release.mjs --publish`,
`trust-bootstrap.mjs --execute`, `first-publish-bootstrap.mjs
--execute`) refuses at the contract-authority gate before any registry
call. Ordinary structural and packed-consumer checks
(`verify:release-set`, `verify:release-consumer`, `verify:builder-kit`,
the test suites) are NOT gated and remain usable — the correct state
between a draft and its ratification.

## Trigger (observed, not assumed)

Owner-directed compatibility-facade retirement (branch
`pi/ui-facade-retirement-r1`): the workspace removed the
`@victframework/renderer-svelte` package — a pure compatibility facade
whose only internal dependency was `@victframework/ui-svelte` and whose
every export was a re-export of the single permanent implementation that
has lived in `ui-svelte` since P5 (QA P5 verdict `P5 ARCHITECTURE
VERIFIED — RELEASE INTEGRATION PERMITTED`,
`qa-artifacts/p5-qa/P5-QA-REPORT.md`). Every current workspace consumer
(reference app, showcase, scaffolder templates and generated host, release
tooling) now imports `@victframework/ui-svelte` directly, including the
`theme.css` → `styles.css` style entry-point migration. The published
`renderer-svelte@0.3.1` (and all prior versions) remain on npm untouched
and installable by exact pin; nothing is unpublished, deprecated, or
republished.

Against the amended frozen rule (15-package inventory, §14), the
release-set gate fails closed BY DESIGN on this tree: the inventory
derives 14 members vs the recorded 15 and `renderer-svelte` is missing
from the frozen inventory — exactly the amendment trigger the contract's
amendment rule anticipates; the failure is the frozen semantics working,
never a silent reinterpretation.

## Amendment (the semantic rules change as follows; nothing else changes)

1. **Inventory (§5):** the coordinated release set is amended from the
   recorded 15-package set to exactly 14 packages by REMOVING
   `@victframework/renderer-svelte`. No member is added. The retired
   package's historical published versions remain registry-immutable
   lineage; only the FORWARD candidate set shrinks.

2. **Publication order (§5):** the frozen order becomes the 14-entry
   order below. Derivation, from RATIFIED state only: the §14 order
   placed `ui` at position 7, but the actual manifests' internal
   dependency graph now has `sdk` and `application` depending on `ui`
   (and `ui-svelte` depending on `application`, `sdk`, and `ui`), so the
   §14 order is no longer a topological linearization and every release
   action fails closed (the machine check
   `validateFrozenOrderIsTopological`). The corrected order moves ONLY
   `ui`, to immediately before its earliest internal dependent (`sdk`),
   and then DELETES the retired sink `renderer-svelte` (position 9):
   nothing depended on it and it depended only on `ui-svelte`, so the
   deletion cannot invalidate any linearization of the survivors. The
   resulting 14-entry order is machine-validated against the ACTUAL
   manifests on this branch (`validateFrozenOrderIsTopological` returns
   no problems).

   ```text
    1. @victframework/contracts
    2. @victframework/ui                    (ADDED 2026-09-26, §14; moved ahead of sdk, §16)
    3. @victframework/sdk                   (was 2 in §14; shifted by the §16 ui move)
    4. @victframework/kernel
    5. @victframework/runtime
    6. @victframework/store-sqlite
    7. @victframework/application
    8. @victframework/ui-svelte             (ADDED 2026-09-26, §14)
    9. @victframework/appdata-sqlite        (was 10 in §14)
   10. @victframework/scaffolder            (was 11 in §14)
   11. @victframework/control               (was 12 in §14)
   12. @victframework/mastra                (was 13 in §14)
   13. @victframework/server                (was 14 in §14)
   14. @victframework/cli                   (was 15 in §14)
   ```

3. **Derived set identity:** removing a member changes the content-
   derived identity by definition. The candidate set's recorded identity
   (RELEASE-COMPATIBILITY §2, re-derived with the frozen algorithm from
   the actual 14 manifests at the NEW coherent candidate version
   `0.4.0-rc.1`) is
   `v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399`.
   The intermediate 14-member `0.3.1` identity prepared on the r1 branch
   (`v1_e31858f1ba93a433…`) is NOT the identity of this candidate: the
   version selection to `0.4.0-rc.1` is itself a version change, and the
   contentId hashes `name@version` pairs, so it was superseded before any
   publication exactly like the 15-member `0.3.1` identity
   (`v1_3a82c0651bb4b0d…`) before it. No `0.3.1`-line prepared identity
   was ever published; none is a registry lineage entry.

3a. **Coherent candidate version (informational, frozen-rule
   application; no contract text changes):** the candidate set's coherent
   version is `0.4.0-rc.1`. (a) `0.3.1` is PUBLISHED and immutable —
   live registry reads on 2026-09-27 show `latest = 0.3.1` for all 13
   historical members (publish time `2026-09-22T04:53:06.374Z`; also
   `0.3.1-rc.2`; `ui`/`ui-svelte` return registry 404, no presence at
   any version) — so a coordinated 14-member set at `0.3.1` is
   impossible under the §6 unpublished-version rule, and the r1
   prepared record naming `0.3.1` was already un-publishable when
   filed; the recorded "NEW coherent version" requirement therefore
   binds with full force. (b) The candidate set differs from the
   published stable line (`0.3.1`) by two added members (`ui`,
   `ui-svelte`) and one retired member (`renderer-svelte`) plus the
   P1–P5 UI foundation — a minor step in the repository's 0.x
   convention. (c) Per §7 the line's first publication is the candidate
   `0.4.0-rc.1` under the non-latest tag `vict-0.4.0-rc`; stable `0.4.0`
   under `latest` only after independent verification. The version is
   NOT part of the frozen contract text (§6 validates it per release
   against the manifests' one coherent version), so this point records
   the selection; it requires no contract-word change.

4. **Derived counts (full normative consistency):** every current-tense
   count derived from the inventory is restated from 15 to 14 by the
   EXACT Appendix B (part 1) substitutions — manifests metadata proof
   (§1), workflow-rename blast radius (§2), coherent-version check (§6),
   unpublished-set checks (§6, §10), build/pack counts (§8), and the
   bootstrap allowlist and ceremony counts (§11) — each preserving the
   historical amendment markers (`§14: 13 → 15; §16: 15 → 14`). The
   historical amendment records (§8.1, §13, §14) are untouched:
   statements that were true of the 13- and 15-package states on their
   historical dates remain true as history. The bootstrap allowlist
   derives from the inventory SET (not the order); the retired facade's
   existing npm trust configuration is untouched history and simply
   leaves the publication path.

5. **Trust semantics (§11) — and the first-publication bootstrap
   exception:** no existing relationship is mutated; no re-configuration
   of the historical relationships is required. BUT the two NEW members
   (`ui`, `ui-svelte`) have NO registry presence, and npm's
   trusted-publisher configuration is a per-package setting on an
   EXISTING package (npm docs, "Trusted publishers": configuration
   happens under `npmjs.com → Packages → YOUR_PACKAGE → Settings →
   Trusted publishing`; the CLI `npm trust github <pkg>` likewise
   targets an existing package) — so they cannot be trusted, and under
   the frozen model could never publish. §11 is therefore amended by
   Appendix B with a narrowly scoped FIRST-PUBLICATION BOOTSTRAP
   exception: a separately owner-authorized one-time bootstrap
   (`scripts/first-publish-bootstrap.mjs`, dry by default) establishes
   their registry presence with the placeholder version
   `0.0.0-bootstrap.1` under a dedicated `bootstrap` dist-tag — a
   version shape that can never satisfy the §6 coordinated version rule,
   so the bootstrap can never consume or partially publish the
   coordinated `0.4.0-rc.1` set — through the historical local
   interactive-2FA path (the §13-precedent credential model, the ONLY
   registered exception to §4/§10 OIDC publication). Placeholder
   versions are registry-immutable lineage; `latest` stays unoccupied
   until the first real coordinated release of each package. Trust is
   configured afterward through §11's ordinary interface.

6. **Migration semantics (informational):** consumers migrate by
   replacing `@victframework/renderer-svelte` imports with
   `@victframework/ui-svelte` (identical public surface — the facade was
   a pure re-export) and the `@victframework/renderer-svelte/theme.css`
   style import with `@victframework/ui-svelte/styles.css` (the one
   production style source the facade's `theme.css` itself imported).
   Consumers pinned to published `renderer-svelte` versions keep working
   unchanged; the published facade is never removed from npm.

## Ratification sequence deviation (disclosed, not justified away)

The frozen amendment rule requires: "if a frozen semantic rule below
must change, the change is documented in a separate amendment commit
BEFORE any implementation consumes the amendment. No silent
reinterpretation; no amendment bundled with consuming implementation."

**The owner must know: this sequence was NOT satisfied for §16, and the
departure is recorded here instead of being explained away.** The
consuming implementation for the 14-package set was committed BEFORE any
ratification: `pi/ui-facade-retirement-r1` @
`bac9c01640d1aa4e6d1ee040969fae3d63136853` (release tooling, tests,
workflow wording, RELEASE-COMPATIBILITY), the owner-review preparation
`pi/ui-facade-retirement-r2` @ `d8c70df2d80169e38d951c4569e913ecfab49865`
(the `0.4.0-rc.1` manifest state, records, gates), and the
release-readiness corrections of `pi/release-readiness-r3`. An earlier
version of this draft sought to justify the departure "on the same model
as the §15 precedent" — that argument was WRONG and is withdrawn: §15
was never ratified, so there is no precedent; the only compliant
precedent is §14, whose amendment record preceded its consuming
implementation.

Mitigating facts (recorded, not exculpatory): no consuming
implementation created registry drift — nothing was published, no trust
was mutated, no frozen verifier was weakened, and every frozen check
failed closed in between, exactly as designed.

**The exact owner decision required (encoded as §16.5 in the Appendix B
record; ENFORCED by the authority gate):** upon ratification the owner
must record EXACTLY ONE decision line in the §16.5 section of the frozen
file, in the exact form `Owner decision recorded: ` immediately followed
by the chosen token — one of —

- **`Owner decision recorded: D-AUTHORIZE`** — retroactively authorize
  the consuming implementation commits named in §16.5 (and on this
  branch), accepting the sequence deviation as disclosed; the
  pre-publication authority gate verifies those commits ARE ancestors of
  the release source; or
- **`Owner decision recorded: D-REVERT`** — direct the reversion of the
  consuming implementation before ratification, so the
  amendment-then-implementation sequence is restored and the
  implementation is re-applied in a later commit; the authority gate
  verifies the named commits have actually been REMOVED from the release
  branch's history.

The same choice is repeated in the ratification commit message.
Ratification with NO decision line, with MORE THAN ONE, with a
malformed line, or with a choice that contradicts the branch's actual
history is INCOMPLETE, AMBIGUOUS, or CONTRADICTORY, and the
contract-authority gate stays red (fail-closed). A heading, a summary,
or a self-authored marker anywhere else is not an owner decision: only
this exact decision line inside §16.5 of the frozen contract counts.
On THIS implementation branch only an explicitly recorded D-AUTHORIZE
could ever permit the 14-package release path — D-REVERT requires the
implementation to be reverted first, and the gate refuses the
contradiction.

## Historical record preserved

The frozen §8.1 and §14 amendment records, §13 baseline, and the
pre-§14/§15/§16 order derivations remain untouched as history. The
evidence ladder (`scripts/release-evidence.mjs`) keeps verifying the
BOUND 13-member `0.3.1` candidate against its OWN recorded inventory
(pinned in `scripts/lib/evidence-rules.mjs`, which these branches do not
touch) — the historical evidence checks stay bound to their original
sets regardless of the candidate-set amendment.

## Implementation consumption status

Consuming implementation EXISTS on the branches listed in the deviation
section above and is presented for the owner's §16.5 decision — this is
the disclosed sequence deviation, not a claim of compliance. The
consuming changes on `pi/ui-facade-retirement-r1` were verification- and
tooling-only: `scripts/lib/release-set.mjs`
(`EXPECTED_RELEASE_PACKAGE_COUNT` 14, `FROZEN_PUBLISH_ORDER` per §2
above), `scripts/check-release-set.mjs`, `scripts/publish-release.mjs`,
`scripts/verify-release-consumer.mjs` (14 tarballs; the facade identity
probe replaced by a former-facade surface-completeness probe against the
direct `ui-svelte` package), `scripts/verify-stage5.mjs`,
`scripts/verify-stage6a.mjs`, `scripts/ui-{foundation,composition,workspace}.mjs`,
`scripts/test/trusted-publishing.test.mjs`, the `release.yml` wording and
input descriptions, `docs/RELEASE-COMPATIBILITY.md` §2/§3/§5/§6/§8, the
scaffolder's explicit release-set requirement and generated host imports,
and the example consumers. `pi/ui-facade-retirement-r2` added: the
coherent version `0.4.0-rc.1` in all 14 release manifests and their exact
internal pins, the workspace lockfile, the example consumer pins that
track the workspace version, the re-derived §2 record and provenance
(`docs/RELEASE-COMPATIBILITY.md`), the root typecheck/lint/format
closures (inherited findings fixed at root cause, checks unchanged), and
the regenerated builder-kit stable layer. `pi/release-readiness-r3`
added the release-readiness corrections: the fail-closed
contract-authority gate (`scripts/lib/contract-authority.mjs`,
`scripts/verify-contract-authority.mjs`; wired into
`oidc-release.mjs` validate+publish, `publish-release.mjs --publish`,
`trust-bootstrap.mjs --execute`, and `release.yml` immediately before
the publish step), the read-only trust preflight
(`scripts/lib/trust-preflight.mjs`,
`scripts/verify-trust-preflight.mjs`; set-wide refusal until all 14
members exist and carry the exact relationship), the owner-authorized
first-publication bootstrap (`scripts/first-publish-bootstrap.mjs`, dry
by default), and their regression tests
(`scripts/test/release-authority.test.mjs`). **Until the owner ratifies
this draft, no publication is authorized: the authority gate refuses
every registry write — including validate_only rehearsals and resume
paths — before any registry call, which is the correct state.** A future
publication additionally requires the authorized final release contract
(this draft, ratified) and the trust preflight reporting AUTHORIZED for
all 14 members.

## Explicitly unchanged by this amendment

The trusted repository identity (§1 repository), workflow filename (§2
`release.yml`), runner and toolchain pins (§3), OIDC permission model
and no-secret policy (§4 — the first-publication bootstrap exception is
a scoped, historical-credential-path exception recorded in §11, not a
change to §4), trigger and release inputs semantics (§6), candidate/
stable tag strategy (§7), build/pack step structure (§8), tarball
content-scan rules (§9), publication/resume/integrity semantics (§10
except the §16 count restatement), permanent verification requirements
(§12), freeze-time baseline (§13), and the §14 amendment record (§15
stays an unratified draft, superseded by this consolidation, and is not
authority for anything here).

## Appendix A — EXACT frozen-contract substitution for §5 (apply verbatim only upon ratification)

Upon owner ratification of this draft, the §5 heading and body of the
frozen contract file `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`
(from the `## 5.` heading through the closing order fence, immediately
before the `## 6.` heading) are replaced by EXACTLY the text between the
outer fences below. The version is intentionally absent from this text:
§6 validates the per-release coherent version against the manifests; the
inventory is version-independent.

````text
## 5. Release-set inventory (frozen; AMENDED 2026-09-26, §14; AMENDED
2026-09-27, §16 — facade retirement, 15 → 14)

The canonical inventory is derived from the publishable manifests under
`packages/*/package.json` and MUST remain exactly the recorded 14-package
`@victframework/*` set (`npm run verify:release-set` is the enforcing
gate; its rules — one coherent version, exact internal pins, recorded
content-derived identity, public access, Apache-2.0, Node engines — are
incorporated here by reference and unchanged). AMENDED 2026-09-27 (§16):
the `@victframework/renderer-svelte` compatibility facade is REMOVED
from the forward candidate set; its published versions remain registry-
immutable lineage installable by exact pin.

Dependency-topological publication order (frozen; derived from the
manifests' internal dependency graph):

```text
 1. @victframework/contracts
 2. @victframework/ui                    (ADDED 2026-09-26, §14; moved ahead of sdk, §16)
 3. @victframework/sdk                   (was 2 in §14; shifted by the §16 ui move)
 4. @victframework/kernel
 5. @victframework/runtime
 6. @victframework/store-sqlite
 7. @victframework/application
 8. @victframework/ui-svelte             (ADDED 2026-09-26, §14)
 9. @victframework/appdata-sqlite        (was 10 in §14)
10. @victframework/scaffolder            (was 11 in §14)
11. @victframework/control               (was 12 in §14)
12. @victframework/mastra                (was 13 in §14)
13. @victframework/server                (was 14 in §14)
14. @victframework/cli                   (was 15 in §14)
```
````

(Count validation note for the ratifier: the replacement order has
exactly 14 numbered entries; `renderer-svelte` appears nowhere in it;
the machine check `validateFrozenOrderIsTopological` returns no problems
against the actual manifests on this branch.)

## Appendix B — EXACT frozen-contract substitutions for the remaining current-tense norms + the §16 record (apply verbatim only upon ratification)

Part 1 restates the twelve count norms that §5's substitution alone
cannot reach, so EVERY normative rule becomes consistent with 14 while
the historical §14 statements stay untouched as history. Each entry is a
REMOVE (exact current frozen text) / INSERT (exact replacement) pair,
applied at the single location where the REMOVE text occurs.

**(B-1) Header, amendments-to-date line:**

```text
REMOVE: §14 (2026-09-26, 15-package release set).
INSERT: §14 (2026-09-26, 15-package release set); §16 (2026-09-27,
        14-package facade retirement).
```

**(B-2) §1, manifests metadata proof:**

```text
REMOVE: * All 15 published manifests carry (AMENDED 2026-09-26: 13 → 15; see
          §14)
INSERT: * All 14 published manifests carry (AMENDED 2026-09-26, §14:
          13 → 15; AMENDED 2026-09-27, §16: 15 → 14)
```

**(B-3) §2, workflow-rename blast radius:**

```text
REMOVE: invalidates the trust relationships of all 15 packages (AMENDED
          2026-09-26: 13 → 15; see §14)
INSERT: invalidates the trust relationships of all 14 packages (AMENDED
          2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)
```

**(B-4) §6, coherent-version input rule:**

```text
REMOVE: the ONE coherent version of all 15 manifests (AMENDED 2026-09-26:
          13 → 15; see §14)
INSERT: the ONE coherent version of all 14 manifests (AMENDED
          2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)
```

**(B-5) §6, unpublished-version rule:**

```text
REMOVE: UNPUBLISHED for all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)
INSERT: UNPUBLISHED for all 14 packages (AMENDED 2026-09-26, §14:
          13 → 15; AMENDED 2026-09-27, §16: 15 → 14)
```

**(B-6) §8, build count:**

```text
REMOVE: 4. `npm run build` — all 15 packages (AMENDED 2026-09-26: 13 → 15; see
          §14; AMENDED: moved ahead of the full suite; see §8.1);
INSERT: 4. `npm run build` — all 14 packages (AMENDED 2026-09-26, §14:
          13 → 15; AMENDED 2026-09-27, §16: 15 → 14; AMENDED: moved ahead
          of the full suite; see §8.1);
```

**(B-7) §8, pack count:**

```text
REMOVE: 6. `npm pack` of all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)
INSERT: 6. `npm pack` of all 14 packages (AMENDED 2026-09-26, §14:
          13 → 15; AMENDED 2026-09-27, §16: 15 → 14)
```

**(B-8) §10, unpublished-set rule without resume:**

```text
REMOVE: Without the input, all 15 must be unpublished (AMENDED
          2026-09-26: 13 → 15; see §14).
INSERT: Without the input, all 14 must be unpublished (AMENDED
          2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14).
```

**(B-9) §11, bootstrap inventory derivation:**

```text
REMOVE: derives the exact 15-package
          (AMENDED 2026-09-26: 13 → 15; see §14) inventory
INSERT: derives the exact 14-package
          (AMENDED 2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16:
          15 → 14) inventory
```

**(B-10) §11, bootstrap allowlist:**

```text
REMOVE: exact package allowlist (15 as of the 2026-09-26 amendment,
          §14; anything else aborts)
INSERT: exact package allowlist (14 as of the 2026-09-27 amendment,
          §16; anything else aborts)
```

**(B-11) §11, ceremony verification count:**

```text
REMOVE: all
          15 relationships are verified inside the window (AMENDED 2026-09-26:
          13 → 15; see §14 — the completed historical ceremony covered the
          original 13 and is preserved as history)
INSERT: all
          14 relationships are verified inside the window (AMENDED
          2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14 —
          the completed historical ceremonies are preserved as history)
```

**(B-12) §11, manual-configuration count:**

```text
REMOVE: The human never
          performs 15 separate manual package configurations.
INSERT: The human never
          performs 14 separate manual package configurations.
```

Part 2 appends the §16 amendment record to the END of the frozen file
(after the §14 record), verbatim. **§16.5 is the owner's recorded
decision required by the ratification-sequence deviation disclosed
above — ratification is INCOMPLETE without it.**

````text
## 16. Amendment (2026-09-27): 14-package release set (facade retirement)

**Cause observed (owner-directed facade retirement; independently
verified):** the workspace removed the `@victframework/renderer-svelte`
compatibility facade — a pure re-export of the single permanent
implementation in `@victframework/ui-svelte` — and migrated every
current consumer to direct `ui-svelte` imports. The published facade
versions remain on npm untouched. Against the amended frozen rule (§14,
15 packages) every release-set action failed closed BY DESIGN — the
amendment trigger the amendment rule anticipates.

**Amendment (the semantic rules change as follows; nothing else in this
contract changes):**

1. **Inventory and order (§5):** replaced verbatim by the §16
   substitution (exactly 14 packages; `renderer-svelte` REMOVED; `ui`
   moved ahead of `sdk` before the sink deletion; machine-validated
   topological order).
2. **Derived counts (§§1, 2, 6, 8, 10, 11):** every current-tense count
   derived from the inventory is restated from 15 to 14, preserving the
   historical amendment markers: manifests metadata proof (§1),
   workflow-rename blast radius (§2), coherent-version check (§6),
   unpublished-set checks (§6, §10), build/pack counts (§8), and the
   bootstrap allowlist and ceremony counts (§11).
3. **Trust semantics and first-publication bootstrap exception (§11):**
   no existing relationship is mutated. `@victframework/ui` and
   `@victframework/ui-svelte` have no registry presence; npm's
   trusted-publisher configuration is a per-package setting on an
   EXISTING package. Their FIRST registry presence may be established
   ONLY through the separately owner-authorized bootstrap
   (`scripts/first-publish-bootstrap.mjs`): placeholder version
   `0.0.0-bootstrap.1` under the `bootstrap` dist-tag — a shape that
   can never satisfy the §6 coordinated version rule — published through
   the historical local interactive-2FA path (§13 precedent), never
   through the coordinated release engine, never consuming a coordinated
   set version. Placeholder versions are registry-immutable lineage.
   The placeholders are REGISTRY-PRESENCE MARKERS, not functional
   releases: they carry the real built package content with the real
   dependency pins, so members whose dependencies pin the coordinated
   version are NOT installable until the coordinated set publishes —
   resolution fails by design, which keeps the placeholder from ever
   being consumed as a release. The coordinated set publishes only
   after ALL members' relationships are verified
   (`scripts/verify-trust-preflight.mjs` refuses any publication
   otherwise; a validated, set-bound operator-evidence artifact or a
   live authenticated check are the only accepted proofs).

### 16.5 Ratification sequence deviation — explicit owner authorization

The frozen amendment rule requires the amendment commit BEFORE any
implementation consumes the amendment. THIS RATIFICATION RECORDS A
DEPARTURE: the consuming implementation for the 14-package set was
committed BEFORE ratification — `pi/ui-facade-retirement-r1` @
`bac9c01640d1aa4e6d1ee040969fae3d63136853`, its owner-review
preparation `pi/ui-facade-retirement-r2` @
`d8c70df2d80169e38d951c4569e913ecfab49865`, and the release-readiness
corrections on `pi/release-readiness-r3`. No consuming implementation
created registry drift: nothing was published, no trust was mutated,
and every frozen verifier failed closed in between. The unratified §15
draft is NOT authority and is not relied on.

Upon ratification the owner records EXACTLY ONE decision line in this
section, in the exact form `Owner decision recorded: ` immediately
followed by the chosen token — D-AUTHORIZE (retroactively authorizing
the consuming implementation commits named above; the pre-publication
authority gate verifies they ARE ancestors of the release source) or
D-REVERT (directing the reversion of the consuming implementation
before ratification; the authority gate verifies the named commits have
actually been REMOVED from the release branch's history). The same
choice is repeated in the ratification commit message. A record with NO
decision line, with MORE THAN ONE, with a malformed line, or whose
choice contradicts the branch's actual history is INCOMPLETE, AMBIGUOUS,
or CONTRADICTORY, and the release path stays fail-closed. A heading, a
summary, or a self-authored marker anywhere else is not an owner
decision: only this exact decision line inside §16.5 of the frozen
contract counts.
````
