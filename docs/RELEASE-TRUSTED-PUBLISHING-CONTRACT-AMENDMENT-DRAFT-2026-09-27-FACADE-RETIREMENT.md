# Release Trusted-Publishing Contract — CONSOLIDATED Amendment Draft §16 (2026-09-27): facade retirement

**Status:** DRAFT amendment — presented for owner ratification on the
review branch `pi/ui-facade-retirement-r2` (based on the facade-retirement
candidate `pi/ui-facade-retirement-r1` @ `bac9c0164…`, itself based on the
verified authoring-tools tip `pi/ui-authoring-tools-r1` @ `bd8f580f…`).
This branch prepares the candidate for final owner review: it resolves the
inherited root typecheck/lint/format findings, selects the NEW coherent
candidate version `0.4.0-rc.1` per the frozen §7 rule (the `0.3.1` line
is consumed), and re-derives the set identity. This draft
CONSOLIDATES and SUPERSEDES the unratified §15 draft
(`RELEASE-TRUSTED-PUBLISHING-CONTRACT-AMENDMENT-DRAFT-2026-09-27.md`):
§15 re-derived the publication order for a 15-package candidate that
still carried the `renderer-svelte` compatibility facade; that
intermediate order is OBSOLETE for the final package graph and is NOT
ratified here. Nothing is published; the frozen contract file
(`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`) is NOT edited by this
branch; no Stage 8 criterion is amended; G3 remains HELD.

If the owner ratifies this draft, the frozen contract's §5 heading and
body text is replaced by the EXACT substitution text in Appendix A below
(verbatim — apply nothing else). Until then the frozen contract text
remains the §14 state and release-set verification against the frozen
contract text is intentionally red — the correct fail-closed state
between a draft and its ratification (exactly the §14→implementation
precedent).

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

Against the amended frozen rule (15-package inventory, §14/§15 order),
the release-set gate fails closed BY DESIGN on this tree: the inventory
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
   order below. It is the §15 order with position 9 (`renderer-svelte`)
   DELETED — one deletion, no reordering — and was machine-validated
   against the ACTUAL manifests' internal dependency graph
   (`validateFrozenOrderIsTopological` returns no problems on this
   branch; `ui` retains the §15 position immediately before its earliest
   internal dependent `sdk`, because `sdk` and `application` depend on
   `ui`, and `ui-svelte` depends on `application`, `sdk`, and `ui`).

   ```text
    1. @victframework/contracts
    2. @victframework/ui                    (position per §15; was 7 in §14)
    3. @victframework/sdk                   (position per §15; was 2 in §14)
    4. @victframework/kernel
    5. @victframework/runtime
    6. @victframework/store-sqlite
    7. @victframework/application
    8. @victframework/ui-svelte             (was 8 in §14/§15)
    9. @victframework/appdata-sqlite        (was 10)
   10. @victframework/scaffolder            (was 11)
   11. @victframework/control               (was 12)
   12. @victframework/mastra                (was 13)
   13. @victframework/server                (was 14)
   14. @victframework/cli                   (was 15)
   ```

   The removal is order-safe because the facade was a SINK in the
   internal dependency graph: nothing depended on it, and it depended
   only on `ui-svelte` (which publishes earlier). Deleting a sink cannot
   invalidate any topological linearization of the survivors.

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

4. **Derived counts:** every count derived from the inventory changes
   with it — manifests metadata proof (§1), workflow-rename blast radius
   (§2), coherent-version check (§6), unpublished-set check (§6, §10),
   build/pack counts (§8), and the bootstrap allowlist (§11) — all now
   mean 14 for the candidate set. The bootstrap allowlist derives from
   the inventory SET (not the order); the retired facade's existing npm
   trust configuration is untouched history and simply leaves the
   publication path.

5. **Trust semantics (§11):** untouched. No relationship is mutated;
   no new ceremony is required. The historical 13+2 configuration record
   is preserved as filed.

6. **Migration semantics (new, informational):** consumers migrate by
   replacing `@victframework/renderer-svelte` imports with
   `@victframework/ui-svelte` (identical public surface — the facade was
   a pure re-export) and the `@victframework/renderer-svelte/theme.css`
   style import with `@victframework/ui-svelte/styles.css` (the one
   production style source the facade's `theme.css` itself imported).
   Consumers pinned to published `renderer-svelte` versions keep working
   unchanged; the published facade is never removed from npm.

## Historical record preserved

The frozen §8.1 and §14 amendment records, §13 baseline, and the
pre-§14/§15/§16 order derivations remain untouched as history. The
evidence ladder (`scripts/release-evidence.mjs`) keeps verifying the
BOUND 13-member `0.3.1` candidate against its OWN recorded inventory
(pinned in `scripts/lib/evidence-rules.mjs`, which this branch does not
touch) — the historical evidence checks stay bound to their original
sets regardless of the candidate-set amendment.

## Implementation consumption status

Per the amendment rule this draft is committed together with (not
BEFORE) its consuming implementation, on the same model as the §15
precedent: the implementation did not create registry drift (nothing was
published), and the verifier's fail-closed behavior fires in between.
The consuming changes on `pi/ui-facade-retirement-r1` were verification-
and tooling-only: `scripts/lib/release-set.mjs`
(`EXPECTED_RELEASE_PACKAGE_COUNT` 14, `FROZEN_PUBLISH_ORDER` per §2
above), `scripts/check-release-set.mjs`, `scripts/publish-release.mjs`,
`scripts/verify-release-consumer.mjs` (14 tarballs; the facade identity
probe replaced by a former-facade surface-completeness probe against the
direct `ui-svelte` package), `scripts/verify-stage5.mjs`,
`scripts/verify-stage6a.mjs`, `scripts/ui-{foundation,composition,workspace}.mjs`,
`scripts/test/trusted-publishing.test.mjs`, the `release.yml` wording and
input descriptions, `docs/RELEASE-COMPATIBILITY.md` §2/§3/§5/§6/§8, the
scaffolder's explicit release-set requirement and generated host imports,
and the example consumers. The owner-review preparation on
`pi/ui-facade-retirement-r2` added, on top of that state: the coherent
version `0.4.0-rc.1` in all 14 release manifests and their exact internal
pins, the workspace lockfile, the example consumer pins that track the
workspace version, the re-derived §2 record and provenance
(`docs/RELEASE-COMPATIBILITY.md`), the root typecheck/lint/format
closures (inherited findings fixed at root cause, checks unchanged), and
the regenerated builder-kit stable layer. **Until the owner ratifies
this draft, no publication is authorized and any release action against
the frozen contract text fails closed — which is the correct state.** A
future publication additionally requires the authorized final release
contract (this draft, ratified).

## Explicitly unchanged by this amendment

The trusted repository identity (§1), workflow filename (§2), runner and
toolchain pins (§3), OIDC permission model and no-secret policy (§4),
trigger and release inputs semantics (§6), candidate/stable tag strategy
(§7), build/pack step structure (§8), tarball content-scan rules (§9),
publication/resume/integrity semantics (§10), trust relationships
(§11), permanent verification requirements (§12), freeze-time baseline
(§13), and the §14 and §15 amendment records (the latter stays an
unratified draft, superseded by this consolidation).

## Appendix A — EXACT frozen-contract substitution text (apply verbatim only upon ratification)

Upon owner ratification of this draft, the ONLY change to the frozen
contract file `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md` is: the §5
heading line and the entire body of §5 (from the heading through the
closing order fence, immediately before the `## 6.` heading) are
replaced by EXACTLY the text below. No other byte of the frozen file
changes (the §14 amendment record at the end of the file remains as
filed history). The version is intentionally absent from this text: §6
validates the per-release coherent version against the manifests; the
inventory is version-independent.

```markdown
## 5. Release-set inventory (frozen; AMENDED 2026-09-26, §14; AMENDED
2026-09-27, §16 — facade retirement, 15 → 14)

The canonical inventory is derived from the publishable manifests under
`packages/*/package.json` and MUST remain exactly the recorded 14-package
`@victframework/*` set (`npm run
verify:release-set` is the enforcing
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
 2. @victframework/ui                    (ADDED 2026-09-26, §14)
 3. @victframework/sdk                   (position per §15)
 4. @victframework/kernel
 5. @victframework/runtime
 6. @victframework/store-sqlite
 7. @victframework/application
 8. @victframework/ui-svelte             (ADDED 2026-09-26, §14)
 9. @victframework/appdata-sqlite
10. @victframework/scaffolder
11. @victframework/control
12. @victframework/mastra
13. @victframework/server
14. @victframework/cli
```
```

(Count validation note for the ratifier: the replacement order has
exactly 14 numbered entries; `renderer-svelte` appears nowhere in it;
the relative order of every survivor equals its §15/§14 order; the
frozen verifier `validateFrozenOrderIsTopological` returns no problems
against the actual manifests on this branch.)
