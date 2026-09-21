# VICT Model-Facing Capability-Schema Remediation — Independent Verification Audit (0.3.1-rc.1)

**Status: AUDIT COMPLETE — NOT CLEARED. Stable promotion to `0.3.1` is
REFUSED.** The candidate's release mechanics, provenance, registry state,
and provider-facing behavior are verified and correct, but the
independent red-team audit confirmed FOUR executable deviations from the
frozen remediation contract
(`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md`) §4/§5.
Per the audit mandate — "any confirmed executable violation of the frozen
remediation contracts blocks stable promotion" — the stable release is
blocked, no repair is performed in this audit, and the bounded
remediation is reported below. This audit is independent: every probe
below was authored and executed outside the VICT repository against
REGISTRY-INSTALLED packages, not against workspace source or
implementer assertions.

**Date:** 2026-09-22.
**Audited tree:** `97f4bea62aed8a90f1c88349c9899b8ee345b767`
(`HEAD == origin/main`, clean tracked tree, linear ancestry; untracked
`.pi/` preserved untouched and unread).
**Candidate identity (independently re-derived from the live registry):**
all 13 `@victframework/*` members at exactly `0.3.1-rc.1`; release-set
identity `vict-release-set@1/0.3.1-rc.1`; content ID recomputed
independently and MATCHING
`v1_b6e39c1f6d6f627c03dfe12e8eb4bc0b6b8bb7f7746b4b871cf00d3c7f7ae731`;
`vict-0.3.1-rc → 0.3.1-rc.1` on 13/13; `latest → 0.3.0` on 13/13;
stable `0.3.1` ABSENT on 13/13.

---

## 1. Part A — history, registry, and artifact audit (all verified)

1. **Freeze discipline.** `b7dbe8f…` (VICT B-1 contract) is a standalone
   1-file commit preceding all executable work; the Quellight counterpart
   `ffecfd7…` is likewise a standalone 1-file commit (verified in that
   repository). `456a2c0…` (evidence-recovery amendment) is standalone
   before its consumer `111d052…`.
2. **Ancestry.** `git merge-base --is-ancestor` clean; linear; per-commit
   file ownership matches the declared lanes (Lane A `d8532da…`:
   contracts/sdk only; Lane B `6d359a8…`: mastra + fixtures; release
   `948d8e5…`: manifests/lockfile/record/docs only).
3. **13/13 registry manifests at exactly `0.3.1-rc.1`.**
4. **Exact internal pins.** Every registry manifest's internal
   dependencies pin exactly `0.3.1-rc.1`; no `workspace:`/`file:`/`link:`/
   `git` specifiers in any published manifest (checked all 13).
5. **`vict-0.3.1-rc → 0.3.1-rc.1`** on 13/13.
6. **`latest → 0.3.0`** on 13/13.
7. **Stable `0.3.1` absent** on 13/13.
8. **Integrity equality.** Registry `dist.integrity` (sha512) equals (a)
   the SLSA subject digests 13/13 and (b) an INDEPENDENT Linux rebuild
   performed for this audit: fresh `git clone` of the public repository at
   `948d8e5…` inside WSL2 Ubuntu-24.04, Node v24.19.0, npm 11.19.1,
   `npm ci && npm run build && scripts/oidc-release.mjs pack` → 13/13
   tarballs BYTE-IDENTICAL to the registry artifacts (hex sha512 equality
   per package).
9. **Provenance 13/13** (fetched per package from the npm attestations
   endpoint, DSSE payload decoded): repository
   `https://github.com/radz2291/vict-02`, workflow
   `.github/workflows/release.yml`, ref `refs/heads/main`, `gitCommit
   948d8e514d5657e4b76df54e2168101c8e084267`, builder
   `https://github.com/actions/runner/github-hosted`, invocationId
   `…/actions/runs/35625570254/attempts/1`, subject sha512 == registry
   `dist.integrity` (base64↔hex equality) on 13/13.
10. **Publication and evidence runs.** Run `35625570254`
    (`release.yml`, `workflow_dispatch`, head `948d8e5…`): conclusion
    `failure` — truthfully terminal-failure, consistent with the recorded
    CDN-propagation verify failure; publication authority `id-token:
    write` lives only in `release.yml`. Run `35630175086`
    (`release-evidence.yml`, head `111d052…`, attempt 1): conclusion
    `success`; the workflow declares exactly `permissions: contents: read`
    and contains no publish step (engine subcommands `pack` and
    `verify-registry` only, plus a self-guard step). LIMITATION: the
    evidence artifact `m1-candidate-evidence-recovery` (6,724 bytes,
    not expired, id 10654387770) requires GitHub authentication to
    download; its sealed contents were not independently unpacked. Its
    substance was instead re-proven directly by this audit's independent
    registry reads, provenance decodes, Linux rebuild, and registry-only
    consumer proof.
11. **Registry-only consumer.** A consumer created OUTSIDE both
    repositories installed all 13 packages exclusively from
    `https://registry.npmjs.org/` at exact `0.3.1-rc.1` (lockfile
    integrity verified by npm); every probe in Part B ran against that
    install. The repository's own
    `verify:release-consumer -- --registry` also passed (exit 0).
12. **Release-set content ID** recomputed (sha256 over the sorted
    newline-joined `name@version` list, `v1_` prefix) — MATCHES.
13. **Stale job display name.** `.github/workflows/release-evidence.yml`
    line 65 still reads `name: Read-only candidate evidence recovery (13
    packages, 0.3.0-rc.1)`. Determination: COSMETIC ONLY. The enforced
    identity is the new candidate everywhere it is functional
    (`scripts/lib/evidence-rules.mjs` `version: '0.3.1-rc.1'`; workflow
    inputs default to `0.3.1-rc.1`/`948d8e5…`/`vict-0.3.1-rc`). No
    identity ambiguity exists in any executed check; recommend renaming
    the label in a later docs/CI commit.

## 2. Part B — behavioral audit (positive results, all verified)

All probes ran against the registry-installed candidate in an external
consumer directory.

1. **0.3.0 negative control.** Against released
   `@victframework/*@0.3.0` (separate registry consumer), the
   provider-facing input schema of a bridged capability is EXACTLY
   `{"type":"object"}` and the description is the bare governance
   sentence. (Also observed: 0.3.0's `defineContract` silently drops the
   then-nonexistent `descriptiveJsonSchema` field.)
2. **Provider-facing schema, real path.** A REAL `@mastra/core@1.64.0`
   `Agent` was constructed with the bridged tool and driven through a
   recording LanguageModelV2 stub to the model-call boundary. The
   provider-bound tool payload carries: tool name `qlt_proposal_draft`;
   description = governance sentence + bounded capability description;
   parameters = the FULL captured schema containing `proposalKind`,
   `content`, `required`, `additionalProperties: false`, the `claim`,
   `commitment`, and `open_loop` branches, every required nested field,
   `oneOf` composition — verified true for every token. The conversion
   path was traced in `@mastra/core` source: the agent loop converts the
   VICT Standard wrapper via `standardSchemaToJSONSchema`
   (`~standard.jsonSchema.input({target:'draft-07'})` then a JSON
   round-trip CLONE, so the deep-frozen capture is never mutated), then
   `fixTypelessProperties`. The frozen capture survives the real
   provider-facing conversion.
3. **Determinism / immutability.** Rebuilding the tool yields an
   identical capture; the captured snapshot is deep-frozen; mutating the
   author's declaration after construction cannot alter the built tool.
4. **Fail-closed construction.** A model-facing capability without a
   usable descriptive input schema refuses construction
   (`VICT_PRESENTATION_INPUT_SCHEMA_REQUIRED`); a non-string description
   refuses construction (`VICT_PRESENTATION_DESCRIPTION_INVALID`).
5. **Authority separation.** A lying descriptive schema becomes guidance
   verbatim and changes nothing else; `~standard.validate` delegates
   exactly to `Contract.parse` (partial args rejected despite the lying
   schema admitting them; valid args admitted); empty, single-field,
   wrong-kind, wrong-content, and unknown-field arguments are rejected
   with ZERO durable effect (zero invocations, zero durable intents) at
   the real tool surface; valid claim/commitment/open_loop arguments each
   cross the governed bridge exactly once with fenced `completed`
   settlement.
6. **Rejected-as-claimed.** Own accessors, classed instances, cyclic
   structures, prototype-named keys (`__proto__`, `constructor`,
   `prototype`), and revoked proxies are rejected with
   `VictPresentationError`; throwing `ownKeys`/`getOwnPropertyDescriptor`
   traps fail closed with stable non-echoing codes (canary text never
   echoed).

## 3. Part B — CONFIRMED FROZEN-CONTRACT DEVIATIONS (blocking findings)

All findings were reproduced against the REGISTRY-INSTALLED
`0.3.1-rc.1` candidate. Each is an executable deviation from the frozen
contract text; under the audit mandate each blocks stable promotion.

### B-1 (High) — §4 "total serialized size ≤ 32,768 bytes" is not measured as serialized bytes

Frozen §4: "total serialized size ≤ 32,768 bytes — any excess fails
closed." The implementation (`captureValue`/`CaptureAccount`) counts
JavaScript string `.length` (UTF-16 code units) for string VALUES, a flat
8 units per number/boolean, and NOTHING for keys, object structure, or
nulls. Probe: a descriptive schema of 16 string fields × 2,000 CJK
characters each — accounted ≈ 32,000 units, capture PASSES — while its
actual deterministic JSON-serialized UTF-8 size is **96,160 bytes**
(≈ 2.94× the frozen bound). Boundary probes confirm the implemented
accounting fails at 32,769 UNITS, not 32,769 bytes. The error text
("the serialized presentation exceeds the 32768-byte bound") claims byte
semantics the measurement does not have. The audit mandate pre-declared
this exact class: "JavaScript `.length` or approximate value accounting
is not equivalent. Any discrepancy is a contract finding." The
implementation report's §4 claim ("total bytes (32768)") is inaccurate as
to measurement.

### B-2 (Medium) — §4 "symbol-keyed fields are rejected" — they are silently DROPPED

Frozen §4: "plain own enumerable DATA only — own accessor properties
(getters or setters), functions, symbols, and symbol-keyed fields are
rejected." The capture enumerates via `Object.keys(descriptors)`, which
returns string keys only; an ENUMERABLE symbol-keyed own field is
neither rejected nor captured — it silently vanishes. Probe:
`obj[Symbol('enum-sym')] = 'symbol-payload'` on an otherwise plain
schema object → capture SUCCEEDS, captured value lacks the field, no
error is thrown. This violates both the frozen reject list and the
audit mandate's restatement ("rejected … without … silently dropping
fields"). Symbol VALUES are rejected (the `typeof` fallthrough), but
symbol-KEYED fields are not.

### B-3 (Medium) — §4 hostile-container rejection is not truthfully provided for plain-target proxies; attacker trap code executes during capture

Frozen §4: "exotic prototypes (anything other than `Object.prototype`
or `null`) are rejected — no proxies, no classed objects, no revoked or
hostile containers." Probes:

- A `Proxy` whose target is a plain object, with a `getPrototypeOf` trap
  returning `Object.prototype`, is CAPTURED (the trap executed).
- A plain-looking proxy with a side-effecting `ownKeys` trap is CAPTURED
  — attacker-controlled code ran during capture.
- A proxy with a lying `getOwnPropertyDescriptor` trap is CAPTURED with
  attacker-chosen DATA (`{"a":"attacker-chosen"}`) — attacker-chosen
  descriptor values enter the model-facing schema.
- Throwing traps and root proxy-wrapped arrays are rejected (stable
  codes, no echo), but only AFTER the attacker's trap code executed
  (array-proxy `get` trap ran 6 times before the root-object rejection).

The prototype check cannot detect a plain-target proxy in JavaScript;
the capture therefore does not — and in fairness CANNOT — truthfully
provide "hostile containers are rejected without executing
attacker-controlled behavior" as the frozen text promises. Per the
mandate ("If the JavaScript implementation cannot truthfully provide
that property, record a finding. Do not reinterpret the requirement to
fit the implementation."), this is recorded as a finding. Mitigations
that limit impact: presentation authors are trusted developers; the
capture output is always inert plain data (getters/functions rejected;
trap-provided values are data); `Contract.parse` remains the sole
authority; nothing model-facing exists when construction throws.

### B-4 (Low-Medium) — §5 negative control 3 does not hold for every prototype-key value shape

Frozen §5: "prototype-key arguments remain REJECTED with ZERO effect at
the real bridge" ("ALL permanent, ALL must hold"). At the REAL tool
surface (`tool.execute` through Mastra's createTool wrapper — the exact
surface the repository's own test drives), Mastra's input preprocessing
(`convertUndefinedToNull`) rewrites own enumerable `__proto__` keys
BEFORE either validation or the bridge parse:

- `__proto__: {"injected": true}` (object value; the one shape the repo
  test covers) → the rewritten input's prototype becomes the injected
  object → a plain-prototype-checking parse (Quellight's actual
  `isPlainObjectCandidate`, and the repo fixture equivalent) rejects →
  zero effect. ✔
- `__proto__: 5` (primitive value) → the assignment is a silent no-op;
  the key vanishes; the remaining VALID arguments execute with a durable
  effect. ✗
- `__proto__: null` → the input's prototype becomes `null`; a
  null-prototype-accepting parse (Quellight's actual check accepts
  `proto === null`) admits the remainder → executes. ✗

`constructor` keys pass through untouched and are rejected by the
fence. No prototype pollution occurs in any case, and whatever executes
is exactly an input the authoritative parse approved — the security
INTENT holds. But the frozen control as written ("prototype-key
arguments remain REJECTED with ZERO effect") is falsified for two value
shapes, and the silent strip happens in an upstream dependency the
bridge does not surface. Verified end-to-end with a Quellight-exact
parse against the registry-installed bridge.

### Non-blocking observations

- **O-1 (surface mapping, harmless):** the captured OUTPUT schema is
  reachable only via `tool.inputSchema['~standard'].jsonSchema.output()`;
  the tool's actual `outputSchema` wrapper exposes the generic
  `{"type":"object"}` on both `input()` and `output()`. Mastra's tool
  path never consumes an output JSON Schema for function tools, so no
  provider-facing guarantee is overclaimed — but the surface mapping
  differs from a strict reading of frozen §3.3(4).
- **O-2 (cosmetic):** the stale `0.3.0-rc.1` job display name (A.13).
- **O-3 (adjacent to B-2):** non-enumerable own string-keyed fields are
  silently skipped rather than rejected ("plain own enumerable data
  only" arguably permits skipping; folding it into the B-2/B-3 capture
  amendment is recommended).

## 4. Part D — authoritative verification ladder (VICT, untouched audited tree)

All steps exit 0, single run, no reruns, no alterations:

```text
HEAD 97f4bea…  tracked tree clean (untracked .pi/ untouched)
===== STEP: npm ci ===== EXIT=0
===== STEP: format:check ===== EXIT=0
===== STEP: lint ===== EXIT=0
===== STEP: typecheck ===== EXIT=0
===== STEP: build ===== EXIT=0
===== STEP: verify:release-set ===== EXIT=0
===== STEP: test (full suite ONCE) ===== EXIT=0  (124 files passed | 1 skipped; 2379 passed | 3 skipped)
===== STEP: pack (dry-run inspection) ===== EXIT=0
===== STEP: git diff --check ===== EXIT=0
===== STEP: npm audit --omit=dev ===== EXIT=0 (found 0 vulnerabilities)
===== STEP: verify:release-consumer -- --registry ===== EXIT=0 (ALL CHECKS PASSED; registry-only resolution proven)
```

The repository's own presentation test file passes 10/10 — consistent
with the findings above only because the repo probes cover a narrower
input space than this audit (see B-1..B-4 for the uncovered classes).

## 5. Verdict and smallest bounded remediation

**Verdict: NOT CLEARED — stable promotion to `0.3.1` is REFUSED.**
Quellight must NOT repin to a stable `0.3.1` (none exists; the candidate
pin stands). No repair is performed in this audit.

Smallest bounded remediation (all confined to the B-1 Lane B capture
plus contract text; no bridge authority changes, no consumer changes):

1. **B-1:** measure the §4 bound as actual serialized size — accumulate
   UTF-8 byte length per scalar AND per key/structure during the capture
   (or serialize the completed snapshot once and bound its
   `Buffer.byteLength(…, 'utf8')`); keep the 32,768 threshold; fix the
   error text to match the measured quantity. Alternatively, a separate
   frozen amendment may redefine the bound in explicit units — but the
   shipped measurement must then be labeled truthfully.
2. **B-2:** reject any object containing own symbol-keyed properties
   (compare `Reflect.ownKeys(value).length` with the string-key count —
   a two-line change) instead of dropping them.
3. **B-3:** a separate frozen §4 amendment stating the JS-providable
   truth — plain-target proxies cannot be detected, trap code may
   execute during inspection, trap-provided values are captured as
   inert data — optionally preceded by a cheap hardening (e.g., detect
   descriptor identity mismatch between two `getOwnPropertyDescriptors`
   reads and reject on divergence).
4. **B-4:** amend the §5 negative control to the truthfully-providable
   property ("prototype-key arguments never pollute, never bypass the
   authoritative parse, and object-valued `__proto__` injections are
   rejected with zero effect; upstream preprocessing may silently strip
   primitive/null `__proto__` keys before the fence") and/or add an
   adapter-level own-key guard so the original control holds verbatim.

After the amendment(s) and fixes land as separate commits with the
same ladder + registry discipline, a fresh independent verification can
re-examine this narrowed scope.

## 6. Status language

The `0.3.1-rc.1` candidate REMAINS a verification candidate. `latest`
remains `0.3.0`; stable `0.3.1` remains UNPUBLISHED (verified absent on
the registry during this audit). Nothing in this audit authorizes any
registry mutation, any live-provider proof, any consumer-product
behavior change, or any Quellight repin beyond the existing candidate
pin. The Quellight-side Execution-3 harness verification performed in
the same audit session is recorded separately in the Quellight
repository's independent audit report; Q6 remains not formally closed;
Execution 4 has not run and is not authorized; Phase Q7 remains blocked.
