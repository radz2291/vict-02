# VICT Model-Facing Capability-Schema Audit-Remediation Contract (FROZEN)

**Status:** Frozen remediation contract for findings B-1, B-2, B-3, and
B-4 of the independent verification
(`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-INDEPENDENT-VERIFICATION.md`)
— committed ALONE before any executable change (L0 freeze discipline).
**Frozen:** 2026-09-22, at VICT base
`9a5e9197b0a06ca18d74da0bfc9591d02bfc2233` (`HEAD == origin/main`, clean
tracked tree, linear ancestry) and Quellight base
`79e04fc5fd34777d238096fa016fc52801f82399` (`HEAD == origin/main`).
**Owner decision:** implement the audit's smallest bounded remediation;
because `0.3.1-rc.1` is immutable, publish a NEW coherent verification
candidate `0.3.1-rc.2`; mechanically repin Quellight to it; verify
everything offline. Stable `0.3.1` is NOT published. No provider
credential is accessed. Execution 4 does not run. Phase Q7 does not
begin.

Amendment rule (unchanged from the B-1 contract): if a frozen semantic
rule below must change, the affected lane stops, the defect is
documented, the contract is amended in its own separate commit, and the
affected work restarts from the amendment. No silent reinterpretation.
The existing B-1 safety contract
(`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md`) is NOT
weakened by this remediation — every rule below TIGHTENS it.

---

## 1. Exact remediated behaviors

### 1.1 B-1 — the §4 total bound is REAL serialized UTF-8 bytes

Frozen meaning: `total serialized size ≤ 32,768` counts the UTF-8 bytes
of the DETERMINISTICALLY SERIALIZED captured presentation — values, keys,
punctuation, containers, and JSON string escaping included.

* Implementation: after the capture completes, the snapshot is
  serialized with the SAME deterministic serialization the provider
  surface consumes (`JSON.stringify` over the deep-frozen,
  sorted-key-order snapshot) and the bound is enforced as
  `Buffer.byteLength(serialized, 'utf8') <= 32,768`. JavaScript
  `.length` (UTF-16 code units) and per-value flat approximations are NO
  LONGER used for the total bound.
* Retained bounds (unchanged): depth ≤ 8, object fields ≤ 64 per object,
  array length ≤ 64, string length ≤ 2048 CHARS (the per-string bound
  stays character-based; ONLY the total bound becomes byte-based),
  description ≤ 1024 chars.
* Boundary: a presentation whose deterministic serialization is EXACTLY
  32,768 UTF-8 bytes PASSES; 32,769 bytes FAILS.
* Fixtures that must fail: the audit's 16×2000-CJK-character schema
  (valid under every structural bound; ~96,160 serialized UTF-8 bytes).
* Failure: stable non-echoing `VictPresentationError`
  (`VICT_PRESENTATION_INVALID`); the error never echoes received values.

### 1.2 B-2 — symbol-keyed fields are REJECTED, never dropped

Any own symbol-keyed property on a captured container — ENUMERABLE OR
NOT — fails the capture. Symbol VALUES continue to be rejected
(unchanged). No captured field may ever vanish silently.

### 1.3 B-2/O-3 — non-enumerable own fields are REJECTED, never skipped

Any own non-enumerable string-keyed property on a captured container
fails the capture explicitly (previously silently skipped). "Plain own
enumerable DATA only" is enforced as a REJECTION property, not a filter.

### 1.4 B-3 — native proxy rejection BEFORE any inspection

* The capture consults Node's stable native proxy detection
  (`node:util` `types.isProxy`) BEFORE any other inspection of EVERY
  object or array value at EVERY depth — root, nested objects, and array
  elements — and in particular BEFORE `Array.isArray`-driven branching
  reads, `Object.getPrototypeOf`, `Reflect.ownKeys` /
  `Object.getOwnPropertyDescriptors`, and any property or array-element
  read.
* Any proxy — ordinary-target, array-target, nested, plain-target,
  lying-descriptor, or revoked — is REJECTED.
* PRE-IMPLEMENTATION PROOF OBLIGATION (discharged 2026-09-22, probe
  `probe-isproxy.mjs`): `types.isProxy` returns `true` for ordinary,
  array-target, revoked, nested, and plain-target proxies while
  executing EXACTLY ZERO of their traps (getPrototypeOf, ownKeys,
  getOwnPropertyDescriptor, get, and array traps instrumented and
  counted), returns `false` for ordinary plain objects, arrays,
  null-prototype objects, classed instances, and all primitives, and does
  not misclassify JSON.parse-created own `__proto__` data properties.
  Native detection is therefore SUFFICIENT; the lane proceeds. Had the
  probe failed, this lane would have stopped and reported the blocker
  instead of implementing — no contract amendment permitting trap
  execution is created.
* Ordinary plain and null-prototype containers REMAIN SUPPORTED exactly
  where previously allowed (no support regression).

### 1.5 B-4 — the raw-argument guard BEFORE upstream normalization

Frozen negative control 3 of the B-1 contract ("prototype-key arguments
remain REJECTED with ZERO effect at the real bridge") is RESTORED for
every value shape. The earliest VICT-owned raw tool-argument boundary is
the `execute` method of the tool object the bridge RETURNS: Mastra's
normalization (`convertUndefinedToNull` and friends) runs inside the
tool's own `execute` wrapper, so wrapping the returned tool's `execute`
lets VICT inspect the UNTOUCHED arguments before upstream preprocessing.
The wrapper:

* inspects the raw arguments with a bounded, passive, recursive guard:
  native proxy rejection first (same §1.4 discipline); own key NAMES
  checked against the hostile set `{__proto__, constructor, prototype}`
  at every reachable depth — regardless of the value's shape (object,
  primitive number/string/boolean, `null`, `undefined`), including keys
  inside arrays and own data properties created with
  `Object.defineProperty` (enumerable or not). Key-name checks precede
  any value read; only data descriptors of proxy-free plain containers
  are recursed into;
* NEVER executes hostile behavior: no getter, setter, iterator,
  `toJSON`, or proxy trap runs during the guard (proxies are rejected
  natively before inspection; accessor descriptors are never read;
  nothing is stringified or iterated);
* is cycle-safe (a revisited container fails closed) and bounded;
* on ANY violation returns the stable structured failure
  `victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED'`
  with ZERO durable intent, ZERO invocation, ZERO capability effect, no
  prototype pollution, and no raw value echo — BEFORE Mastra's
  normalization, validation, and the bridge's governed pipeline run;
* passes valid arguments through EXACTLY once, unchanged;
* does not patch Mastra in `node_modules`, does not vendor it, and does
  not depend on undocumented mutation of installed files — it reassigns
  the PUBLIC `execute` property of the VICT-created tool object after
  construction.

Accepted null-prototype containers (and ordinary plain containers)
WITHOUT prohibited own keys remain compatible.

### 1.6 Adjacent truthful cleanup (no redesign)

1. The stale evidence-workflow job display name (`0.3.0-rc.1`) becomes a
   version-neutral bounded label.
2. The descriptive output schema is wired TRUTHFULLY onto the real
   `outputSchema` wrapper: `tool.outputSchema['~standard'].jsonSchema.output()`
   returns the captured output schema exactly as frozen §3.3(4) already
   specifies (it previously exposed the generic `{type:'object'}` on the
   output wrapper). Permanent tests prove the surface. Documentation may
   then truthfully describe the input-only provider guarantee AND the
   now-truthful output surface.
3. `Contract.parse` remains the SOLE authority — unchanged.
4. All runtime effect, approval, fencing, settlement, and delivery
   behavior is preserved — unchanged.

## 2. Exact negative controls (ALL permanent, ALL must hold)

Capture-construction controls (fail tool construction with stable
non-echoing codes):

1. plain-target proxy rejected; `getPrototypeOf`, `ownKeys`,
   `getOwnPropertyDescriptor`, `get` traps execute EXACTLY ZERO times;
2. array-target proxy rejected; array traps execute EXACTLY ZERO times;
3. nested proxy (proxy value inside a plain container) rejected when the
   capture reaches it; its traps execute EXACTLY ZERO times;
4. revoked proxy rejected;
5. enumerable and non-enumerable own symbol-keyed properties rejected;
   symbol values rejected;
6. non-enumerable own string-keyed fields rejected (not skipped);
7. accessor fields, functions, cycles, exotic prototypes, prototype-named
   keys, and out-of-vocabulary keys continue to be rejected;
8. ordinary plain objects, arrays, and null-prototype containers without
   prohibited keys remain SUPPORTED (positive controls);
9. UTF-8 boundary: deterministic serialization of exactly 32,768 bytes
   passes; 32,769 bytes fails; the audit's multibyte (CJK) 16×2000
   fixture (~96,160 bytes) fails; escaped-string, nested-object, and
   array fixtures near the boundary behave exactly per measured bytes;
10. a hostile canary planted in any rejected capture input never appears
    in any error message or code.

Raw-argument controls (at the REAL tool surface and through the REAL
provider-tool conversion path):

11. own `__proto__` keys with object, primitive number, primitive string,
    boolean, `null`, and `undefined` values are each rejected with ZERO
    effect (the object-valued case additionally keeps its existing
    authoritative-parse rejection);
12. own `constructor` and `prototype` keys rejected likewise;
13. keys hidden via `Object.defineProperty` (non-enumerable own data
    properties) rejected;
14. hostile keys nested inside arrays-of-objects and deeper containers
    rejected;
15. hostile raw arguments produce `VICT_CAPABILITY_INPUT_CONTRACT_REJECTED`
    with zero invocation, zero durable intent, zero capability effect,
    and no prototype pollution of any reachable object;
16. hostile proxy arguments are rejected with EXACTLY ZERO trap
    executions;
17. valid proposal-shaped arguments continue to cross the real bridge
    exactly once (compatibility positive control);
18. accepted null-prototype argument containers without prohibited keys
    remain compatible;
19. the real provider-tool conversion path (real Mastra Agent, recording
    LanguageModelV2 stub) still receives the full captured schema and
    bounded description — the guard does not alter the provider-facing
    declaration.

## 3. Old-candidate discriminators

The permanent repaired-tree tests must FAIL against registry-installed
`0.3.1-rc.1` for all four findings, via these exact discriminators run in
a disposable external registry consumer (removed afterward):

* D-1 (B-1): the 16×2000-CJK schema is ACCEPTED by rc.1 construction
  (and wrongly presented) — the repaired construction REJECTS it;
* D-2 (B-2): an enumerable symbol-keyed field is silently DROPPED by
  rc.1 (construction succeeds; field absent from the presented schema) —
  the repaired capture REJECTS construction;
* D-3 (B-3): a plain-target lying-descriptor proxy is CAPTURED by rc.1
  (attacker-selected descriptor data enters the presented schema; the
  descriptor trap EXECUTES) — the repaired capture REJECTS with ZERO
  trap executions;
* D-4 (B-4): a primitive-valued own `__proto__` argument EXECUTES the
  capability with durable effect at the rc.1 real tool surface — the
  repaired tool returns `VICT_CAPABILITY_INPUT_CONTRACT_REJECTED` with
  ZERO effect.

## 4. Authority and compatibility invariants

* Runtime order UNCHANGED and mandatory:
  `model-facing schema guidance → received arguments → raw-argument
  guard (new, pre-normalization) → authoritative VICT Contract.parse →
  effect/approval policy → governed invocation`.
* The presentation schema is NEVER authority (unchanged); the
  `~standard.validate` member continues to delegate EXACTLY to the bound
  contract (unchanged); `Contract.parse` is untouched.
* No weakening of any existing capture bound; every §1 change TIGHTENS
  the B-1 contract's §4.
* `MASTRA_ADAPTER_REVISION` bumps `2 → 3` (the model-visible tool
  surface changes again: pre-normalization rejection + hardened capture).
* `0.3.1-rc.1` remains published, immutable, and installable; `latest`
  remains `0.3.0`; stable `0.3.1` remains UNPUBLISHED; the new candidate
  publishes ONLY under the existing candidate tag `vict-0.3.1-rc`.
* No provider credential, no live-provider proof, no consumer product
  behavior change, and no consumer release event is authorized.

## 5. Candidate identity (frozen)

* **All 13 packages at `0.3.1-rc.2`**; release-set identity
  `vict-release-set@1/0.3.1-rc.2`; content ID derived through the
  canonical release-set code (sha256 over the sorted newline-joined
  `name@0.3.1-rc.2` list, `v1_` prefix) and recorded in the
  implementation report; candidate dist-tag `vict-0.3.1-rc`; expected
  `latest` `0.3.0`; stable `0.3.1` absent.
* Publication ONLY through the frozen trusted-OIDC workflow
  (`.github/workflows/release.yml`) from an exact pushed main-lineage
  release-source commit; no npm token, login, OTP, `.npmrc`, or local
  publication anywhere. A terminal-failed publication workflow is NOT a
  completed release; the governed read-only evidence path applies only
  when its exact propagation-lag conditions recur.

## 6. Lane ownership (frozen)

* **Lane A** — B-1 real-byte bound (`presentation.ts` + tests).
* **Lane B** — B-2/B-3 capture hardening (`presentation.ts` + tests).
  Lane A and Lane B own the SAME file; they execute SEQUENTIALLY (A
  then B) and this is reported truthfully.
* **Lane C** — B-4 raw-argument guard (`raw-argument-guard.ts` +
  `tool-bridge.ts` wiring + `MASTRA_ADAPTER_REVISION` bump + the
  output-schema truthful wiring + tests through the real Mastra tool
  surface and provider conversion path).
* **Controls lane** — permanent negative controls + old-candidate
  discriminator runs (external disposable registry consumer).
* **Integration/release lane** — stale workflow label; 13-package
  candidate bump; lockfile; release-set record; ladders; publication;
  registry/provenance/rebuild/consumer evidence; evidence-path re-bind;
  documentation.
* Quellight lane — mechanical repin ONLY (see §8).

## 7. Verification and publication order (frozen)

1. Contract commit (alone) — this document.
2. Lane A commit; Lane B commit; Lane C commit (targeted suites green).
3. Permanent negative controls commit (full mastra test scope green).
4. Old-candidate discriminators executed against registry-installed
   `0.3.1-rc.1` in a disposable external consumer; results recorded;
   consumer removed.
5. Release-preparation commit (13 manifests `0.3.1-rc.2` + exact
   internal pins + regenerated lockfile + version-neutral evidence
   label); content ID recomputed.
6. Authoritative VICT ladder ONCE on the final frozen executable tree
   (`npm ci`, `format:check`, `lint`, `typecheck`, `build`,
   `verify:release-set`, `npm test`, pack + full tarball inspection,
   external packed-tarball consumer, `npm audit --omit=dev`,
   `git diff --check`).
7. Implementation report + status surfaces commit; push.
8. Publication via trusted OIDC dispatch of `release.yml` (`source_sha`
   = the pushed release-source commit, `version 0.3.1-rc.2`, `npm_tag
   vict-0.3.1-rc`); the run must conclude terminal-`success` including
   its own registry verification.
9. Post-publication registry evidence: 13/13 manifests at exactly
   `0.3.1-rc.2`; internal pins exact; `vict-0.3.1-rc → 0.3.1-rc.2`;
   `latest → 0.3.0`; stable `0.3.1` absent; provenance 13/13 bound to
   the release source, workflow, run; registry artifacts byte-equal to
   an independent Linux rebuild; registry-only consumer proof green;
   content ID recomputed and matching.
10. Evidence-path re-bind commit (read-only recovery machinery bound to
    the `0.3.1-rc.2` candidate) and documentation increment.
11. Quellight mechanical repin commit; Quellight offline ladder ONCE
    (no `verify:q6:live`); repin report; push.

No step may be reordered to publish before its evidence exists. Every
non-zero ladder result is diagnosed and disclosed; failures are never
silently rerun and assertions are never weakened.

## 8. Quellight mechanical repin (frozen)

After candidate publication and registry verification: change ONLY the
exact `@victframework/*` pins `0.3.1-rc.1 → 0.3.1-rc.2`, regenerate the
lockfile SOLELY from the public registry, update the central release-set
identity constants and the derived gates that assert them
(`scripts/lib/release-set.mjs` and the exact-pin literals in the
verification gates), and record a narrow candidate-repin report. Keep:
`qlt.proposal.draft@3`; profile revision 6; instruction revision 4; the
existing quiet-write policy. NO product, ceremony, memory, authority,
UI, provider, fixture, or Q6 acceptance change. The Q6 harness stands as
independently verified offline. Execution 4 is NOT run and NOT
authorized; Q6 remains not formally closed; Phase Q7 remains BLOCKED —
NOT BEGUN; Stage 07 remains In Progress. Historical reports and frozen
contracts remain byte-unchanged.

## 9. Status language

After this remediation: the VICT audit remediation is IMPLEMENTED and
the `0.3.1-rc.2` candidate is PUBLISHED — AWAITING FRESH INDEPENDENT
RE-VERIFICATION. It is never described as independently verified. A
stable `0.3.1` remains a separate later owner decision after that
re-verification. Quellight is exact-pinned to `0.3.1-rc.2`. Nothing here
authorizes any live-provider proof, any consumer release event, or any
stable publication.
