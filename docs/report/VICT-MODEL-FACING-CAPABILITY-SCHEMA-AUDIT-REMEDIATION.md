# VICT Model-Facing Capability-Schema Audit Remediation — Implementation Report

**Status:** IMPLEMENTED — candidate `vict-release-set@1/0.3.1-rc.2`
prepared for publication — **AWAITING FRESH INDEPENDENT
RE-VERIFICATION.** `latest` remains `0.3.0`; stable `0.3.1` remains
UNPUBLISHED; `0.3.1-rc.1` remains published, immutable, and installable.
This report makes no claim of independent verification.

**Date:** 2026-09-22.
**Frozen remediation contract:**
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`
(committed ALONE at `ec3dea0…`, before any executable change).
**Authoritative findings:**
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-INDEPENDENT-VERIFICATION.md`.

## 1. Exact handling of the four findings

### B-1 — the §4 total bound is now TRUE serialized UTF-8 bytes

`capturePresentationSchema` (Lane A, `presentation.ts`) enforces the
bound as `Buffer.byteLength(JSON.stringify(snapshot), 'utf8') <= 32768`
over the deterministic (sorted-key) deep-frozen snapshot — values, keys,
punctuation, containers, and JSON string escaping included. The UTF-16
unit approximation is removed. Retained bounds: depth 8, fields
64/object, arrays 64, strings 2048 chars, description 1024 chars.
Boundary evidence (permanent controls): a schema whose serialization is
EXACTLY 32,768 bytes passes; 32,769 bytes fails; the audit's 16×2000-CJK
schema (serialized 96,145 bytes in the repaired-tree measurement,
> 90,000 asserted) fails construction with the UTF-8 bound as the
rejection reason; a 16×2048-quote-char schema (~65KB serialized; exactly
32,768 `.length` units under the old accounting — the old boundary
value) now fails; a keys-only ~274KB schema (zero-length string values;
~0 units under the old accounting) now fails. A ~32.6KB in-bounds
presentation still constructs and presents (compatibility).

### B-2 — symbol-keyed fields are REJECTED, never dropped

Any own symbol-keyed property of a captured container — enumerable or
not — fails construction (`VICT_PRESENTATION_INVALID`); symbol values
continue to be rejected. Permanent controls reject both enumerable and
non-enumerable symbol keys; the old-candidate discriminator D-2 proves
rc.1 silently dropped them.

### B-2/O-3 — non-enumerable own string-keyed fields are REJECTED

Previously silently skipped; now an explicit fail-closed rejection.

### B-3 — native proxy rejection BEFORE any inspection

Every object/array at every depth is checked with Node's stable
`util.types.isProxy` BEFORE `Array.isArray` branching reads, prototype
reads, descriptor inspection, and any property/array-element read.
**Pre-implementation proof obligation DISCHARGED** (probe
`probe-isproxy.mjs`, 2026-09-22): native detection returns `true` for
ordinary, array-target, revoked, nested, and plain-target proxies while
executing EXACTLY ZERO of their traps (13 trap types instrumented and
counted), returns `false` for all ordinary containers and primitives,
and does not misclassify JSON.parse-created own `__proto__` data
properties. The lane therefore proceeded; no contract amendment
permitting trap execution was created. Permanent controls prove EXACTLY
ZERO trap executions on rejection for plain-target, array-target,
nested, lying-descriptor, and revoked proxies — at the capture level AND
at tool construction. Ordinary plain and null-prototype containers
remain supported (positive controls). Array element accessors are
rejected before any element value is read (descriptor-driven element
capture).

### B-4 — the raw-argument guard BEFORE upstream normalization

The earliest VICT-owned boundary that still sees UNTOUCHED arguments is
the `execute` method of the tool object the bridge RETURNS (Mastra's
`convertUndefinedToNull` normalization runs INSIDE that method, before
validation and before the governed pipeline). Lane C reassigns that
PUBLIC property with a guarded wrapper
(`raw-argument-guard.ts` + `tool-bridge.ts` wiring); no Mastra file in
`node_modules` is patched, vendored, or mutated. The guard:

* rejects native proxies FIRST (zero traps), never reads accessor
  values, never stringifies, never iterates — no getter, setter,
  iterator, `toJSON`, or hostile proxy trap executes;
* rejects own `__proto__`/`constructor`/`prototype` keys at any
  reachable depth REGARDLESS of value shape — object, primitive
  number/string/boolean, `null`, `undefined` — including keys inside
  arrays and own data properties created with `Object.defineProperty`
  (enumerable or not; name checks precede any value read);
* is cycle-safe and depth-bounded, failing closed;
* returns the stable structured failure
  `victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED'`
  with ZERO durable intent, ZERO invocation, ZERO capability effect, no
  prototype pollution, and no raw value echo;
* passes valid arguments through exactly once; accepted null-prototype
  containers without prohibited keys remain compatible;
* `Contract.parse` remains the SOLE authority (an additional fail-closed
  pre-boundary, never a replacement).

Proven through all four mandated surfaces (permanent controls): (1)
direct bridge execution — the full value-shape matrix rejected with zero
effects under a deliberately PERMISSIVE parse (isolating the guard);
(2) the actual Mastra tool surface — `tool.execute` of the REAL Mastra
Tool instance (marker asserted); (3) the REAL provider-tool conversion
path — a REAL `@mastra/core` `Agent` with a recording LanguageModelV2
stub captures the provider-bound tool payload carrying the FULL nested
proposal schema and bounded description of the GUARDED tool (the guard
does not alter the provider-facing declaration); (4) a Quellight-exact
proposal parser (accepts `Object.prototype` OR `null` prototypes) — the
exact rc.1 bypass arguments (primitive-valued and null-valued own
`__proto__` plus a valid remainder) are now rejected with zero effects;
valid args and a null-prototype container without prohibited keys still
cross exactly once.

### Adjacent truthful cleanup

* The stale evidence-workflow display name (`0.3.0-rc.1`) is now the
  version-neutral "Read-only candidate evidence recovery (13 packages,
  bounded identity)".
* The captured output schema now rides the REAL `outputSchema` wrapper
  (`tool.outputSchema['~standard'].jsonSchema.output()` returns the
  captured output presentation) — exactly what the frozen B-1 contract
  §3.3(4) already specified; permanent controls prove the surface and
  that the neutral `input()` member is unchanged.
* `MASTRA_ADAPTER_REVISION` bumps `2 → 3` (the model-visible tool
  surface changed); test fixtures now reference the constant
  symbolically.

## 2. Old-candidate discriminators (registry-installed `0.3.1-rc.1`)

Executed 2026-09-22 in a disposable external registry consumer (all 13
packages installed from `https://registry.npmjs.org/` at exact
`0.3.1-rc.1`), script `discriminators-b1-b4.mjs` — ALL FOUR FINDINGS
CONFIRMED on rc.1:

* **D-1 (B-1):** the 16×2000-CJK schema — serialized 96,145 UTF-8 bytes,
  far above the 32,768 bound — was ACCEPTED by rc.1 construction and
  presented in full;
* **D-2 (B-2):** an enumerable symbol-keyed field was SILENTLY DROPPED
  (construction succeeded; zero symbol keys in the presented schema; no
  error);
* **D-3 (B-3):** a plain-target lying-descriptor proxy was CAPTURED —
  the descriptor trap EXECUTED (1 time) and the attacker-chosen value
  `ATTACKER-CHOSEN` entered the presented schema;
* **D-4 (B-4):** a primitive-valued own `__proto__` argument DISAPPEARED
  in upstream normalization and the valid remainder was approved by the
  Quellight-exact parse and EXECUTED (exactly one capability effect).

The repaired tree's permanent controls (29 tests,
`packages/mastra/test/tool-bridge.audit-remediation.test.ts`) fail on
none of these shapes and prove the fixes. The disposable consumer was
removed after the runs (its `node_modules` deleted; probe scripts remain
outside the repositories as ephemeral audit tooling).

## 3. Verification state

Full authoritative ladder executed ONCE on the final frozen executable
tree (results recorded in the run transcript; all exit 0): `npm ci`,
`format:check`, `lint`, `typecheck`, `build`, `verify:release-set`
(13 packages, `0.3.1-rc.2`, `v1_55d1ad2e…`), `npm test` (full suite
once), pack + complete tarball inspection, external packed-tarball
consumer, `npm audit --omit=dev`, `git diff --check`. Publication and
post-publication registry/provenance/rebuild/consumer evidence are
recorded below as they complete.

## 4. Commits (all on main; linear; fast-forward push)

| Commit | Content |
| --- | --- |
| `ec3dea0…` | the frozen audit-remediation contract (alone) |
| `539bbe6…` | Lane A — B-1 real serialized UTF-8 byte bound |
| `14e892a…` | Lane B — B-2/B-3 native proxy rejection; symbol/hidden-field rejection |
| `0b48989…` | Lane C — B-4 raw-argument guard; truthful output-schema surface; adapter revision 3 |
| `980f9d9…` | permanent negative controls (29 tests) |
| `8242e62…` | formatting/import hygiene for the remediation changes |
| `378d0bf…` | candidate `0.3.1-rc.2` release preparation (13 manifests, lockfile, release-set record, version-neutral evidence label) |
| this commit | implementation report + status increment |

Lanes A and B own the same file and executed SEQUENTIALLY as separate
commits (reported truthfully); no coordinator abstraction was committed.

## 5. Status language

The `0.3.1-rc.2` candidate is a VERIFICATION CANDIDATE — awaiting FRESH
INDEPENDENT RE-VERIFICATION. `latest` remains `0.3.0`; stable `0.3.1`
remains UNPUBLISHED (a separate later owner decision after independent
re-verification). `0.3.1-rc.1` remains published and immutable. Nothing
here authorizes any live-provider proof, any provider credential access,
Execution 4, Phase Q7, or any consumer release event. Q6 remains not
formally closed; Phase Q7 remains BLOCKED — NOT BEGUN; Stage 07 remains
In Progress.
