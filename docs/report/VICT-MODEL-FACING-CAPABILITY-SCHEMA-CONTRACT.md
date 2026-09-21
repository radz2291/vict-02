# VICT Model-Facing Capability-Schema Remediation Contract (FROZEN)

**Status:** Frozen remediation contract — committed ALONE before any
executable change (L0 freeze discipline).
**Frozen:** 2026-09-22, at VICT base
`153384877ae90b79c990636eba28fde2e50ae7d5` (`HEAD == origin/main`, clean
tracked tree, linear ancestry) and Quellight base
`1fa178bb5564534cdaa2a58037b74c2dfec9d500` (`HEAD == origin/main`).
**Finding remediated:** B-1 — the released VICT 0.3.0 Mastra bridge
converts every neutral contract into a Standard Schema whose JSON Schema
is only `{ "type": "object" }`, and stamps every tool with a generic
description, so the model never receives the capability's input
structure. This is a framework PRESENTATION defect — not a permission
defect, not a model-discretion failure, and never a reason to weaken
contract validation. The authoritative Quellight contract correctly
rejected every malformed attempt during the Q6 Execution-3 live run
before any durable effect.

Amendment rule: if a frozen semantic rule below must change, the affected
lane stops, the defect is documented, the contract is amended in its own
separate commit, and the affected work restarts from the amendment. No
silent reinterpretation; no amendment bundled with consuming
implementation.

---

## 1. Exact current defect (truthful statement)

`packages/mastra/src/tool-bridge.ts` (`standardSchemaFromContract`)
fabricates the model-facing JSON Schema of EVERY capability tool as
exactly `{ type: 'object' }` — regardless of the bound contract — and the
tool description is the generic governance sentence only. A model-facing
capability therefore reaches the provider with NO structure: no property
names, no per-kind content shapes, no required fields, no closed
additional-property rules. The observed consequence (Quellight Q6
Execution 3): the live model repeatedly attempted the proposal tool with
empty or single-field arguments; every attempt was rejected by the
authoritative contract fence; zero durable effect occurred; the proof
failed truthfully. The defect is the missing presentation layer between
the neutral contract and the provider-facing tool declaration.

## 2. Approved authority model (frozen)

* The runtime order is UNCHANGED and remains mandatory:
  `model-facing schema guidance → received arguments → authoritative
  VICT Contract.parse → effect/approval policy → governed invocation`.
* The presentation schema is NEVER authorization. It is never executed as
  validation, never consulted by `Contract.parse`, never consulted by any
  policy decision, and never stored as authority evidence. A descriptive
  schema that lies (claims fewer fields, looser types, or a different
  shape than the contract accepts) can only produce WORSE model guidance;
  it can never let an argument bypass the authoritative parse.
* The Mastra `~standard.validate` member continues to delegate EXACTLY to
  the bound neutral contract (`contract.parse`), unchanged. Only the
  non-executing `~standard.jsonSchema.input()/output()` presentation
  members change.
* The capability description is inert bounded metadata. It can never
  widen effect class, permissions, contract surface, or approval policy;
  tool names/descriptions cannot widen authority (existing bridge rule,
  restated).

## 3. Public API design (frozen)

### 3.1 Neutral presentation schema — `@victframework/contracts`

`ContractDefinition` and `Contract` gain ONE optional inert data member:

```ts
export interface ContractDefinition<T = unknown> {
  readonly id: string;
  readonly revision: string;
  readonly expected?: string;
  /**
   * OPTIONAL passive JSON Schema (plain JSON data, draft-07-compatible
   * vocabulary) describing the shape this contract accepts, for
   * non-authoritative presentation surfaces (model-facing tool schemas).
   * Never executed; never consulted by `parse`; never authority.
   */
  readonly descriptiveJsonSchema?: unknown;
  parse(input: unknown): ContractResult<T>;
}
```

* `defineContract` copies a declared `descriptiveJsonSchema` by reference
  into the frozen contract object (inert data; the SAFE BOUNDED CAPTURE
  of §4 happens at tool construction). The optional Zod adapter is
  unchanged (a zod-authored contract may still be given a descriptive
  schema through `defineContract`-style declaration fields on a future
  amendment; this remediation does not touch it).
* This member fulfills the System Reference §6 conceptual
  `describe?()` semantics in inert-data form: a contract can describe
  itself without any author code executing at capture time.

### 3.2 Bounded capability description — `@victframework/sdk`

`CapabilityDefinition` gains ONE optional inert member:

```ts
/** OPTIONAL bounded, human-readable, model-facing description of what
 * this capability does (what to send it, what it never does). Inert
 * presentation metadata: captured as bounded data at tool construction;
 * invalid presentation fails closed; can never widen authority. */
readonly description?: string;
```

Ownership (frozen): executable parsing remains owned by
`Contract.parse`; the descriptive JSON Schema belongs to the neutral
contract declaration; the bounded human-readable description belongs to
the capability definition. Names follow the existing authoring
vocabulary; nothing names or special-cases any consumer product.

### 3.3 Model-tool construction behavior — `@victframework/mastra`

For every model-facing capability tool, the bridge:

1. captures the capability `description` (§4) — a bounded string;
2. captures `input.descriptiveJsonSchema` through the §4 safe capture —
   REQUIRED: a model-facing capability that declares an input contract
   but lacks a USABLE descriptive input schema FAILS TOOL CONSTRUCTION
   (fail closed). The bridge NEVER fabricates a presentation schema and
   NEVER silently degrades to the misleading generic
   `{ "type": "object" }` input schema;
3. captures `output.descriptiveJsonSchema` through the §4 safe capture —
   OPTIONAL ("where applicable"): when declared, the tool's output
   presentation is the captured schema; when absent, the output
   presentation remains the neutral object shape (the output direction
   never guides argument generation, so the fail-closed rule of (2) does
   not apply to it);
4. exposes the captured input schema through the tool's provider-facing
   Standard-JSON-Schema declaration (`~standard.jsonSchema.input()`),
   and the captured output schema through `~standard.jsonSchema.output()`;
5. appends the captured bounded description to the tool description after
   the unchanged governance sentence
   (`VICT governed capability '<id>' (revision <rev>, effect '<effect>').`);
6. stamps the construction-time failure with stable non-echoing codes
   (`VICT_PRESENTATION_INPUT_SCHEMA_REQUIRED`,
   `VICT_PRESENTATION_INVALID`) — composition fails loudly, nothing
   model-facing exists on failure.

A capability that is never built into a model-facing tool (graph-only
execution) is unaffected by all of the above.

## 4. Safe capture (frozen)

Presentation metadata is captured as INERT BOUNDED DATA when the tool is
built. The capture is TOTAL and fail closed:

* plain own enumerable DATA only — own accessor properties (getters or
  setters), functions, symbols, and symbol-keyed fields are rejected;
* cycles and shared references that would recurse are rejected;
* exotic prototypes (anything other than `Object.prototype` or `null`)
  are rejected — no proxies, no classed objects, no revoked or hostile
  containers;
* prototype-named keys (`__proto__`, `constructor`, `prototype`) are
  rejected; keys must match the bounded safe-key pattern
  (`/^[A-Za-z0-9_$.-]{1,64}$/`) — JSON-Schema property names beyond this
  vocabulary fail closed;
* bounded: depth ≤ 8, object fields ≤ 64 per object, array length ≤ 64,
  string length ≤ 2048 chars, total serialized size ≤ 32,768 bytes,
  description ≤ 1024 chars — any excess fails closed;
* the captured value is a DEEP IMMUTABLE SNAPSHOT (deep-frozen plain
  data) with deterministic key order: mutation of the author's original
  object after tool construction can never alter the built tool;
* the capture reads no credentials, no runtime payload values, and no
  mutable runtime state — only the declaration data authored with the
  capability;
* output is deterministic: the same declaration always yields the same
  captured snapshot.

## 5. Compatibility and versioning rules (frozen)

* The remediation ships as coordinated candidate release set
  **`vict-release-set@1/0.3.1-rc.1`** — all 13 members at `0.3.1-rc.1`
  with exact internal candidate pins, published ONLY through the frozen
  trusted-OIDC workflow (`.github/workflows/release.yml`) under the
  candidate dist-tag **`vict-0.3.1-rc`**. `latest` REMAINS `0.3.0`;
  stable `0.3.1` remains UNPUBLISHED until a separate verified stable
  release decision.
* Compatibility: the neutral `Contract`/`CapabilityDefinition` additions
  are OPTIONAL fields — existing contracts and capabilities keep their
  meaning; graph-only execution is byte-identical. The ONE breaking rule
  is deliberate and frozen: constructing a MODEL-FACING capability tool
  without a usable descriptive input schema now fails construction
  (previously it silently produced the misleading generic schema).
  Model-facing capability authors adopt the additive presentation fields
  (mechanical, no behavior migration); consumers that never build
  model-facing tools are unaffected.
* `MASTRA_ADAPTER_REVISION` bumps `1 → 2` (the adapter's execution
  semantics — the model-visible tool surface — change; the same
  author/build revision discipline as capability handlers). The marker
  feeds `agentProfileVersion` exactly as before; consumers repin and
  reactivate through their own profile revisions.
* Exact negative controls (ALL permanent, ALL must hold):
  1. released VICT `0.3.0` exposes ONLY the generic object schema;
  2. the repaired bridge exposes the EXACT nested proposal-shaped schema
     (containing `proposalKind`, `content`, `required`,
     `additionalProperties: false`, `claim`, `commitment`, `open_loop`)
     through the REAL tool object's provider-facing declaration;
  3. empty, single-field, wrong-kind, wrong-content, unknown-field, and
     prototype-key arguments remain REJECTED with ZERO effect at the real
     bridge;
  4. a correctly shaped claim, commitment, and open loop each cross the
     real bridge (authoritative parse; governed invocation);
  5. descriptive-schema mutation after tool construction cannot alter the
     captured tool;
  6. a descriptive schema cannot bypass authoritative parsing (hostile or
     inaccurate schemas change guidance only, never validation);
  7. a model-facing capability without a usable descriptive input schema
     fails construction (no silent generic degradation).
* Release and consumer requirements: the complete VICT verification
  ladder (release-set coherence; format; lint; typecheck; build of all 13
  packages; the full test suite ONCE; pack; tarball identity inspection +
  content scan; isolated packed-tarball consumer proof) runs on the exact
  release source before publication; the in-workflow chain re-proves it
  and adds same-run registry verification, provenance, integrity, and a
  registry-only consumer proof. No npm login, OTP, token, local
  publication, or `.npmrc` anywhere. Tarballs are scanned for
  credentials, local paths, private artifacts, and source debris.
* The model-facing schema must survive build, pack, registry
  installation, and emitted declarations (proved by the consumer proof
  plus a registry-consumer probe of the published candidate).

## 6. Lane ownership (frozen)

* **Lane A** — contracts/SDK presentation API (`@victframework/contracts`
  types + `defineContract` capture; `@victframework/sdk` capability
  description; exports; authoring tests).
* **Lane B** — Mastra bridge and adversarial tests (`presentation.ts`
  safe capture; tool-bridge wiring; adapter revision bump; the permanent
  provider-facing schema test; negative controls 1–7 of §5).
* **Integration/release lane** — 13-package candidate bump, release-set
  record, ladder, publication, registry proof, documentation.

All lanes start from this freeze commit (or an explicit amendment
commit). Lane ownership is recorded truthfully in the implementation
report; if isolated parallel workers are unavailable, the lanes execute
sequentially with disjoint per-commit file ownership and that is reported
honestly. No coordinator abstraction is committed.

## 7. Status language

The `0.3.1-rc.1` candidate is a VERIFICATION CANDIDATE. Its completion
statement is: implemented and published — AWAITING INDEPENDENT
VERIFICATION. It is never described as independently verified. A stable
`0.3.1` release is a separate later decision after independent
verification. Nothing in this contract authorizes any live-provider
proof, any consumer product behavior change, or any consumer release
event.
