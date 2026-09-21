# VICT Model-Facing Capability-Schema Remediation — Implementation Report

**Status:** IMPLEMENTED AND PUBLISHED — `vict-release-set@1/0.3.1-rc.1`
candidate published through the trusted-OIDC workflow and re-proved by
the read-only successor evidence run — **AWAITING INDEPENDENT
VERIFICATION.** `latest` remains `0.3.0`; stable `0.3.1` remains
UNPUBLISHED. This report makes no claim of independent verification.

**Date:** 2026-09-22.
**Frozen contract:**
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md`
(committed alone at `b7dbe8f…`, before any executable change).
**Amendment:**
`docs/report/VICT-0.3.1-RC1-EVIDENCE-RECOVERY-AMENDMENT.md`
(committed alone at `456a2c0…`, before the consuming evidence-recovery
re-bind).

## 1. Root cause (B-1)

The released 0.3.0 Mastra bridge (`standardSchemaFromContract` in
`packages/mastra/src/tool-bridge.ts`) fabricated the model-facing JSON
Schema of EVERY capability tool as exactly `{ "type": "object" }`,
regardless of the bound neutral contract, and stamped every tool with a
generic description. A model-facing capability therefore reached the
provider with no structure at all. The Quellight Q6 Execution-3 live run
demonstrated the consequence: the model repeatedly attempted the proposal
tool with empty or single-field arguments and every attempt was rejected
by the authoritative contract fence — zero durable effect, truthful
failure. This was a framework PRESENTATION defect; contract validation
was never weakened and never needed to be.

## 2. Public API design (smallest general solution; framework-neutral)

* `@victframework/contracts`: `ContractDefinition`/`Contract` gain ONE
  optional inert data member, `descriptiveJsonSchema` — a passive,
  draft-07-style plain-JSON description of the accepted shape. `defineContract`
  copies a declared field into the frozen contract object. It is never
  executed and never consulted by `parse` (fulfills the System Reference
  §6 conceptual `describe?()` semantics in inert-data form).
* `@victframework/sdk`: `CapabilityDefinition` gains ONE optional member,
  `description` — a bounded human-readable model-facing description.
* Ownership: parsing stays owned by `Contract.parse`; the descriptive
  schema belongs to the neutral contract declaration; the bounded
  description belongs to the capability definition. No consumer-product
  name appears anywhere in the framework.

## 3. Authority separation (proven, permanent)

The runtime order is unchanged: model-facing schema guidance → received
arguments → authoritative `Contract.parse` → effect/approval policy →
governed invocation. The bridge's `~standard.validate` still delegates
EXACTLY to the bound contract; only the non-executing
`~standard.jsonSchema.input()/output()` presentation members changed.
Permanent tests prove: a lying/hostile descriptive schema changes
guidance only — empty, single-field, wrong-kind, wrong-content,
unknown-field, and prototype-key arguments are rejected with ZERO
durable effect (rejected at Mastra's pre-execute authoritative
validation — the Execution-3 mechanism — or at the bridge's own parse),
while correctly shaped claim/commitment/open_loop arguments cross the
real bridge.

## 4. Safe capture (Mastra bridge)

`packages/mastra/src/presentation.ts` captures presentation metadata as
inert bounded data at tool construction: plain own enumerable data only
(accessors, functions, symbols, cycles, exotic prototypes, and
prototype-named keys rejected); bounded depth (8), fields (64/object),
arrays (64), strings (2048), total bytes (32768), description (1024);
deep-frozen deterministic snapshot; no credentials or runtime payload
values; mutation after construction can never alter the built tool.
Invalid presentation metadata FAILS TOOL CONSTRUCTION
(`VictPresentationError`, stable codes `VICT_PRESENTATION_INPUT_SCHEMA_REQUIRED`
/ `VICT_PRESENTATION_INVALID` / `VICT_PRESENTATION_DESCRIPTION_INVALID`).
A model-facing capability without a usable descriptive input schema
refuses construction — the bridge never fabricates the misleading
generic schema. The tool description appends the captured bounded
description after the unchanged governance sentence.
`MASTRA_ADAPTER_REVISION` bumps `1 → 2`.

## 5. Provider-facing schema proof

`packages/mastra/test/tool-bridge.presentation.test.ts` (10 tests)
inspects the REAL tool object's `~standard.jsonSchema.input()` — the
exact surface Mastra converts into provider `parameters` — and asserts
the full nested proposal-shaped schema (`proposalKind`, `content`,
`required`, `additionalProperties: false`, and the `claim`,
`commitment`, `open_loop` branches), the bounded description,
determinism, and all authority-separation controls. OLD-TREE NEGATIVE
CONTROL: the same schema probe run against released 0.3.0 (worktree at
`1533848…`) FAILS — 0.3.0 exposes only `{ "type": "object" }`; the
repaired tree passes 10/10. The schema survives build and pack (dist
probe equal to the declaration) and the emitted declarations typecheck.

## 6. Candidate identity, provenance, and verification state

* **Release source:** `948d8e514d5657e4b76df54e2168101c8e084267`
  (pushed fast-forward; `HEAD == origin/main` at dispatch; clean tree;
  manifests + lockfile + release-set record only).
* **Pre-publication ladder (exact source, all exit 0):** release-set
  coherence (`0.3.1-rc.1`, `v1_b6e39c1f…`), format, lint, typecheck,
  build 13/13, full test suite ONCE (2379 passed / 3 skipped), pack 13,
  tarball scan 13/13 clean, isolated packed-tarball consumer proof,
  dist-level model-facing schema probe (equal to the declaration).
* **Publication run `35625570254`** (`.github/workflows/release.yml`,
  event `workflow_dispatch`, attempt 1): full in-workflow chain green;
  ALL 13 PACKAGES PUBLISHED in the frozen dependency-topological order
  under `vict-0.3.1-rc` through npm OIDC trusted publishing; the FINAL
  same-run registry verification failed on CDN propagation lag (2/13 not
  yet visible after 12 read-only re-checks) — the run concluded
  terminal-`failure` on verification timing only; the publication is
  complete and immutable (no token, login, OTP, or local publication).
* **Amendment `456a2c0…` + re-bind `111d052…`:** the read-only successor
  evidence run was re-bound to this candidate (bounded identity:
  version `0.3.1-rc.1`, source `948d8e5…`, run `35625570254`, tag
  `vict-0.3.1-rc`, latest `0.3.0`, forbidden stable `0.3.1`).
* **Successor evidence run `35630175086`**
  (`.github/workflows/release-evidence.yml`, permissions exactly
  `contents: read`; pack/verify-registry engine subcommands only):
  **terminal-`success`** — 13/13 registry manifests at exactly
  `0.3.1-rc.1`; dist-tags `vict-0.3.1-rc → 0.3.1-rc.1`, `latest → 0.3.0`;
  per-package registry `dist.integrity` EQUALITY against the rebuilt
  candidate source (Linux rebuild, npm 11.19.1, byte-identical);
  SLSA v1 provenance 13/13 binding repository `radz2291/vict-02`,
  workflow `.github/workflows/release.yml`, ref `refs/heads/main`,
  `gitCommit 948d8e5…`, the GitHub-hosted builder, invocationId
  `…/actions/runs/35625570254/attempts/1`, and subject digests equal to
  the registry artifacts; release-set content identity
  `v1_b6e39c1f…` recomputed and matching; registry-only consumer proof
  green (artifact `m1-candidate-evidence-recovery`, run 35630175086).
* **Registry integrity (sha512 dist.integrity, all proven equal to the
  rebuilt artifacts):** contracts `KFcw8bfN…`, sdk `8hU63wUp…`, kernel
  `KM/8/YMw…`, runtime `JZvUNU1Q…`, store-sqlite `g77ZyGpq…`, application
  `E03wyiYX…`, renderer-svelte `3DiVnuHa…`, appdata-sqlite `GthWL68E…`,
  scaffolder `8sOb+xIa…`, control `zt4g64np…`, mastra `Rzly8gbQ…`,
  server `cWJIKDc/…`, cli `A003GD1n…` (full values in the registry
  packuments and the evidence artifact).
* **Exact internal pins:** every registry manifest pins its internal
  dependencies at exactly `0.3.1-rc.1`; no `workspace:`/`file:`/`link:`/
  `git` specifiers anywhere.
* Tarballs scanned before publication: no credentials, no local paths,
  no private artifacts, no source debris.

## 7. Commits (all on main; linear; fast-forward push)

| Commit | Content |
| --- | --- |
| `b7dbe8f…` | the frozen remediation contract (alone) |
| `d8532da…` | Lane A — contracts/SDK presentation API + tests |
| `6d359a8…` | Lane B — Mastra presentation capture, bridge wiring, adapter revision 2, permanent provider-facing schema test + adversarial controls; fixture schema adoption |
| `948d8e5…` | candidate `0.3.1-rc.1` release source (13 manifests, lockfile, release-set record) — PUBLISHED |
| `456a2c0…` | evidence-recovery amendment (alone) |
| `111d052…` | evidence recovery re-bound to `0.3.1-rc.1` |

Lanes were executed SEQUENTIALLY — no isolated parallel workers were
available in the execution environment; per-commit file ownership was
disjoint and no coordinator abstraction was committed.

## 8. Awaiting independent verification

This candidate is a VERIFICATION CANDIDATE. It is NOT independently
verified. A stable `0.3.1` release (published under `latest` through the
same workflow after independent verification) is a separate later owner
decision. No Quellight behavior, no live-provider proof, and no consumer
release event is authorized by this report.
