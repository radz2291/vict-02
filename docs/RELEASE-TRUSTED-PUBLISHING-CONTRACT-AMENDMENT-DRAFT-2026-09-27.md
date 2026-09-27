# Release Trusted-Publishing Contract — Amendment Draft §15 (2026-09-27)

**Status:** DRAFT amendment, authored on the verification branch
`qa/ui-recon-verify-8141812` (pinned candidate `8141812`). It records the
order amendment that `scripts/lib/release-set.mjs` already requires to
stay a faithful verifier of the ACTUAL manifests, and it is presented for
owner ratification. Nothing is published; the frozen contract file itself
is NOT edited by this branch; no Stage 8 criterion is amended; G3 remains
HELD.

## Trigger (observed on the pinned tree, not assumed)

The TaskLedger platform work (merged into the reconciliation candidate via
`0f4b29f`) gave two release-set members new internal dependencies:

* `@victframework/sdk` → `@victframework/ui` (presentation-intent types)
* `@victframework/application` → `@victframework/ui` (same)

The §14 frozen order placed `ui` at position 7 — AFTER both `sdk` (2) and
`application` (6). The frozen order therefore stopped being a
dependency-topological linearization of the actual manifests, and every
release action now FAILS CLOSED exactly as the contract requires
(`deriveReleaseInventory` reports, verbatim, on candidate `8141812`):

```
frozen publication order violated: '@victframework/application' (position 5) depends on '@victframework/ui' (position 6) which publishes later
frozen publication order violated: '@victframework/sdk' (position 1) depends on '@victframework/ui' (position 6) which publishes later
```

These are the two pre-existing `scripts/test/trusted-publishing.test.mjs`
failures recorded in `docs/UI-RECONCILIATION-2026-09-27.md` §4. They are
NOT a product defect: the new dependency direction is the intended
TaskLedger architecture (`sdk`/`application` consume `ui`'s closed
presentation-intent vocabulary). What went stale is the recorded ORDER,
which §14 derived from the then-current graph ("`ui` … immediately before
its only internal dependent").

## Amendment (the semantic rule changes as follows; nothing else changes)

1. **Publication order (§5) only.** The frozen order is re-derived from
   the ACTUAL manifests' internal dependency graph with ONE move:
   `@victframework/ui` is placed immediately before its EARLIEST internal
   dependent (`sdk`). The relative order of the original 13 entries is
   preserved, and the §14 positions of `ui-svelte` and `renderer-svelte`
   (verified at §14 against the same rule) are unchanged.

   ```text
    1. @victframework/contracts
    2. @victframework/ui                    (MOVED 2026-09-27, §15; was 7)
    3. @victframework/sdk                   (was 2)
    4. @victframework/kernel                (was 3)
    5. @victframework/runtime               (was 4)
    6. @victframework/store-sqlite          (was 5)
    7. @victframework/application           (was 6)
    8. @victframework/ui-svelte             (unchanged from §14)
    9. @victframework/renderer-svelte       (unchanged from §14)
   10. @victframework/appdata-sqlite        (was 10)
   11. @victframework/scaffolder            (was 11)
   12. @victframework/control               (was 12)
   13. @victframework/mastra                (was 13)
   14. @victframework/server                (was 14)
   15. @victframework/cli                   (was 15)
   ```

   Verified by machine against the manifests on candidate `8141812`
   (`validateFrozenOrderIsTopological` returns no problems; member set,
   coherent version `0.3.1`, exact internal pins, and content-derived set
   identity are all UNCHANGED — the sorted `name@version` list that feeds
   `deriveReleaseSetContentId` is order-independent, so the recorded
   release-set identity does not move).

2. **Derived counts:** none. The amendment changes no count. The 15-member
   inventory, the coherent-version rule, the exact-pin rule, the tarball
   scan rules, the tag strategy, and the trust relationships (§11) are all
   untouched.

3. **Trust semantics (§11):** untouched. Order does not affect the trust
   relationships; the bootstrap allowlist is derived from the inventory
   SET, not the order.

## Implementation consumption status

Per the amendment rule this draft is committed together with (not BEFORE)
its consuming implementation, because the implementation did not create
the drift — the upstream TaskLedger dependency addition did, and the
verifier's fail-closed behavior fired in between. The consuming
verification-only changes on `qa/ui-recon-verify-8141812` are:

* `scripts/lib/release-set.mjs` — `FROZEN_PUBLISH_ORDER` restated per §15
  (comment cites this draft).
* `scripts/test/trusted-publishing.test.mjs` — the stale position
  assertions updated to the §15 order (ui at 2, sdk at 3, application at
  7; ui-svelte 8 / renderer-svelte 9 unchanged). The checks' strength is
  unchanged: the same "no problems", exact-order, and topological
  linearization assertions run against the same real manifests; only the
  recorded positions they compare against moved with the re-derived
  order.

**Until the owner ratifies §15 into the frozen contract,** the frozen
contract's §5 order block remains the §14 order and release-set
verification against the frozen contract text stays red — which is the
correct fail-closed state. The verifier now fails closed only on REAL
graph drift, not on the recorded order being behind the graph.

## Explicitly unchanged by this amendment

The trusted repository identity (§1), workflow filename (§2), runner and
toolchain pins (§3), OIDC permission model and no-secret policy (§4),
inventory SET and content-derived identity (§5), trigger and release
inputs (§6), candidate/stable tag strategy (§7), build/pack steps (§8),
tarball content-scan rules (§9), publication/resume/integrity semantics
(§10), trust semantics (§11), permanent verification requirements (§12),
freeze-time baseline (§13), and the §14 amendment record.
