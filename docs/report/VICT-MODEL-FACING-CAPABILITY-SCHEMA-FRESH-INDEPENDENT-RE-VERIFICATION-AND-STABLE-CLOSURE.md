# VICT Model-Facing Capability Schema — Fresh Independent Re-Verification and Stable Closure

**Status:** INDEPENDENT AUDIT COMPLETE — **CLEARED, ZERO Blocking / ZERO
High / ZERO Medium findings** (4 Low, disclosed below); the conditional
stable release `@victframework/*@0.3.1` was published, independently
verified, and Quellight was repinned. **The B-1..B-4 remediation is
FORMALLY CLOSED.**
**Date:** 2026-09-22.
**Auditor:** fresh independent agent; no implementation-report claim,
test name, workflow conclusion, or prior agent assertion was accepted as
proof. Every substantive claim below was rederived from Git, the public
npm registry, registry attestations, the GitHub API, or independently
authored probes executed against REGISTRY-INSTALLED artifacts.

---

## 1. SHA ledger (exact, verified)

| Subject | SHA |
| --- | --- |
| VICT base HEAD == origin/main (audit start) | `b4f2e357fcbcf2e9c112731f5f810124b9320c28` |
| Quellight base HEAD == origin/main (audit start) | `8dcd3c003d5e256e55f8b998e2649abdac0411d0` |
| rc.2 release source (pushed main lineage) | `a7b0018c460581e5425df80e56b0ccf309a4b4a4` |
| rc.2 publication run (workflow_dispatch, `release.yml`) | `35661159776` (terminal-`failure`, verification-timing class; NEVER relabelled) |
| rc.2 read-only evidence run (`release-evidence.yml`) | `35662077320` (terminal-`success`) |
| rc.2 candidate identity | `vict-release-set@1/0.3.1-rc.2` = `v1_55d1ad2eb0afaf0e487b3e0b457069e7cfe2ac0bdaed7d443a13287287f0e31f` (recomputed, matched) |
| STABLE release source (pushed main lineage) | `446453fc4f6837e50a0bf3254b47d6a208f5b491` |
| STABLE publication run (workflow_dispatch, `release.yml`, `npm_tag latest`) | `35688234026` (terminal-`failure`, verification-timing class; NEVER relabelled) |
| STABLE read-only evidence run (amendment-re-bound `release-evidence.yml`) | `35689362749` (terminal-`success`) |
| Evidence-recovery amendment commit (alone) | `87b5180d4a428bed525158e24dda725fa1b993b1` |
| STABLE release-set identity | `vict-release-set@1/0.3.1` = `v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583` (recomputed via the canonical code AND independently, matched) |
| Quellight stable-repin commit | `1fae9f3c8fe1de206ce9f58c6dc0d97512d260ec` |

Both repositories verified: tracked trees clean at start; linear
ancestry (no merges); VICT `.pi/` and Quellight `.quellight-data`
preserved and never opened. All pushes were normal fast-forwards after
fresh fetches.

## 2. Actual release-preparation attribution (finding 1 — Low)

The implementation report attributes the 13 manifests, the lockfile, the
release-set record, and the workflow-label correction to `378d0bf…`.
**Git attribution proves the work is SPLIT:**

| Commit | Subject (NOT relied upon) | Actual content (derived from `git show --stat` and diffs) |
| --- | --- | --- |
| `8242e62` | "style(mastra): prettier formatting and import hygiene…" | **12 of the 13 manifest version bumps** (all except `packages/mastra/package.json`), the **lockfile** regeneration (82 lines), the **release-set record** in `docs/RELEASE-COMPATIBILITY.md` (identity, content ID, all 13 entries), the **workflow-label correction** (`.github/workflows/release-evidence.yml`, "0.3.0-rc.1" → version-neutral), PLUS genuine formatting of mastra sources/tests |
| `378d0bf` | "chore(release): candidate 0.3.1-rc.2 release preparation…" (message claims ALL of the above) | **only `packages/mastra/package.json`** (the 13th manifest) |
| `a7b0018` | "fix(mastra): repair strict typecheck errors…" | the test repair: `packages/mastra/test/tool-bridge.audit-remediation.test.ts` (+17/−8) — this repair is what made the rc.2 authoritative ladder green (the prior ladder at `88d9875` had typecheck EXIT=2 and test EXIT=1, per the retained session history) |

**Classification:** commit-message/report ATTRIBUTION inaccuracy —
non-blocking (**Low**). The release-source identity `a7b0018…` REMAINS
VALID: `git diff a7b0018..b4f2e35 -- packages/ package-lock.json` is
EMPTY (package source identical), and every published artifact was
independently verified against the registry, not against the messages.
This audit record states the actual attribution.

## 3. Historical-report formatting (finding 2 — Low, truthful non-blocking evidence-history correction)

Quellight commit `8dcd3c00` modified the Phase Q6 Execution-3
independent-verification report while earlier records claimed historical
reports byte-unchanged. A COMPLETE diff and a semantic/token-equivalence
comparison prove the change is **strictly formatting-only**:

* token sequences identical: 1503 = 1503 (whitespace-insensitive);
* non-whitespace character streams byte-identical: 10,380 = 10,380;
* SHA-like token multisets identical; status/keyword multisets identical
  (PASS/FAIL/severity/exit/revision tokens); whitespace-normalized
  paragraph multisets identical;
* the diff itself is a prettier line-reflow (wrapped-list continuation),
  driven by `verify:quellight`'s format gate covering `docs/*.md`.

**Disposition:** truthful non-blocking evidence-history correction
(**Low**). The historical report was NOT rewritten again.

## 4. Old defects independently reproduced (registry `0.3.1-rc.1`, disposable external consumer, removed afterward)

rc.1 installability proven (public-registry install into a disposable
consumer). Independently authored negative controls (contract-derived,
not implementation-derived):

* **B-1 reproduced (D-1):** a structurally in-bounds presentation of 16×
  2000 CJK characters (32,688 UTF-16 code units — would pass a
  char-based bound; **96,688 true serialized UTF-8 bytes**) was ACCEPTED
  by rc.1 construction and wrongly presented to the model. rc.1's bound
  counted `text.length` (UTF-16), confirmed in the installed
  `dist/presentation.js`.
* **B-2 reproduced (D-2):** an enumerable own symbol-keyed field and a
  non-enumerable own string-keyed field were SILENTLY DROPPED (rc.1
  construction succeeded; both canaries absent from the presented
  schema).
* **B-3 reproduced (D-3):** a plain-target lying-descriptor proxy was
  CAPTURED: the `getOwnPropertyDescriptor`, `ownKeys`, and
  `getPrototypeOf` traps EXECUTED (3 traps) and attacker descriptor data
  entered the presented schema.
* **B-4 reproduced (D-4):** at the REAL Mastra tool surface (real
  governed bridge, quiet-write policy, in-memory stores), own
  `__proto__` keys with number/string/boolean/null/undefined values and
  a defineProperty non-enumerable form VANISHED before validation and
  the capability effect EXECUTED (5/5 shapes; `accepted:true` each).

The disposable consumer was removed after the discriminator runs.

## 5. Repaired candidate verified (registry-installed `0.3.1-rc.2`, disposable consumer, removed afterward)

All probes below ran against registry-installed `0.3.1-rc.2`
(adapter revision `3` confirmed — the contract-required bump).

### B-1 — true serialized UTF-8 bound (ALL PASS)

With an independently implemented canonical serializer (sorted keys,
UTF-8 byte length):

* exactly **32,768** bytes → ACCEPTED; **32,769** → REJECTED
  (`VICT_PRESENTATION_INVALID`, byte-bound detail);
* CJK 16×2000: 32,688 chars / **96,688 bytes** → REJECTED by bytes; a
  mixed CJK+ASCII fixture (26,564 chars / 74,564 bytes) → REJECTED; a
  CJK fixture under the byte bound (15,449 bytes) → ACCEPTED;
* escaped strings count serialized expansion: quote-heavy fixtures —
  escaped at exactly 32,768 bytes → ACCEPTED; 32,769 → REJECTED;
  control characters verified escaped (`\n\t\0\\`);
* keys/punctuation/arrays/structure count: 40×60-char-key structure
  (3,352 bytes) ACCEPTED; a 64-item array structure (133,339 bytes)
  REJECTED;
* **keys-only oversized**: a breadth-designed fixture (347,168 bytes;
  no string anywhere; all per-string/depth/field bounds valid) REJECTED
  with the pure total-byte message; the in-bound variant of the same
  shape ACCEPTED (isolates the byte cause);
* genuinely in-bound large schema (27,501 bytes) ACCEPTED;
* rejection STABLE (two runs byte-identical), bounded (detail ≤ 200
  chars), and NON-ECHOING (planted canaries — including multibyte —
  never appear in code, detail, or message).

### B-2 — symbol and hidden properties (ALL PASS)

REJECTED at construction (`VICT_PRESENTATION_INVALID`, never dropped):
enumerable own symbol key; non-enumerable own symbol key; non-enumerable
own string key; symbol VALUES at root field, nested object, array
element, and deep positions.

### B-3 — hostile proxies (ALL PASS)

12 shape×position combinations (object-target / array-target /
plain-empty-target / lying-descriptor × root / nested / array-element)
all REJECTED with **EXACTLY ZERO** of 13 instrumented traps executed;
revoked proxy REJECTED; deep-nested proxy REJECTED with zero traps; no
attacker canary ever entered any snapshot. Positive controls: plain
objects, arrays, null-prototype containers, and a JSON-parsed harmless
`__proto__x`-keyed schema all remain ACCEPTED (no false rejections).

### B-4 — raw dangerous-key boundary (ALL PASS)

Exercised through (1) direct bridge execution, (2) the REAL Mastra tool
surface, (3) a REAL `@mastra/core` Agent with an offline recording
LanguageModelV2 stub, and (4) Quellight's EXACT capability contract
(`qlt.proposal.draft@3`, faithfully re-declared from Quellight source;
three-branch presentation + closed parse):

* **key matrix**: own `__proto__` / `constructor` / `prototype` ×
  {object, number, string, boolean, null, undefined} values ×
  {JSON-enumerable, defineProperty non-enumerable, inside arrays} —
  every case returns EXACTLY
  `{ victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED' }`
  with ZERO durable intent, ZERO invocation, ZERO effect;
* hostile behavior never executes: getters/setters/iterator/`toJSON`/
  thenable — ZERO runs; hostile proxies (root and nested) — ZERO traps;
* no hostile value echoed by any VICT refusal envelope; no prototype
  pollution (`Object.prototype`/`Function.prototype`/`Array.prototype`
  probes clean);
* valid input crosses EXACTLY once (3/3 direct calls; and through the
  REAL agent loop: model-issued valid tool-call → effect executed
  exactly once → `{accepted:true, proposalId:…}`);
* hostile MODEL-controlled tool-call through the REAL agent loop:
  refused with ZERO effect and zero pollution;
* null-prototype argument containers (root and deep) remain compatible;
* `Contract.parse` remains the semantic authority:
  `tool.inputSchema['~standard'].validate` delegates EXACTLY to the
  bound contract (a presentation-permitting but contract-invalid input
  is rejected with the `vict-contract-rejected` marker);
* the Quellight contract matrix (malformed, partial, unknown-field,
  wrong-kind, wrong-content, hostile-key cases) — ALL rejected with zero
  effects.

### Presentation truthfulness (ALL PASS)

* the REAL agent hands the model layer the COMPLETE three-branch schema
  (proposalKind/content; claim; commitment; open_loop; commitmentKey;
  loopKind; epistemicType; honestyState; required;
  additionalProperties:false; oneOf; not the generic `{type:'object'}`);
* description bounded (650 chars) and truthful: carries the governed
  prefix, the capability description, revision 3, effect `write`, and no
  hiding instructions;
* the output schema is wired to the CORRECT surface:
  `tool.outputSchema['~standard'].jsonSchema.output()` returns the
  captured accepted/refused union (rc.1 comparison: rc.1 exposed the
  generic `{type:'object'}` here — the O-1 fix is discriminated);
* mutation after construction cannot change captured presentation
  (adversarial mutation of the declaration after building the tool left
  the presented schema unchanged; no mutation canary appeared);
* malformed/partial/wrong-kind/wrong-content/unknown-field arguments
  produce ZERO effect (rejected at the Mastra validation layer or the
  VICT guard/contract, per layer).

## 6. Candidate release chain (recomputed, not trusted)

* 13/13 manifests at exactly `0.3.1-rc.2`; exact internal dependency
  pins 13/13 (no ranges/tags/workspace/file/link/git).
* Content ID recomputed by two independent implementations (this
  audit's own and the canonical `scripts/check-release-set.mjs`):
  `v1_55d1ad2e…` — MATCH.
* Tarball integrity 13/13: downloaded registry artifacts match
  `dist.integrity` (sha512).
* SLSA provenance 13/13: bound to `radz2291/vict-02`, `refs/heads/main`,
  `.github/workflows/release.yml`, gitCommit `a7b0018…`, run
  `35661159776` (workflow_dispatch).
* Dist-tags: `vict-0.3.1-rc → 0.3.1-rc.2`; `latest → 0.3.0`; stable
  `0.3.1` ABSENT; rc.1 remains published, immutable, and INSTALLABLE
  (proven by installation).
* Linux rebuild identity: the read-only evidence run `35662077320`
  (GitHub-hosted Linux runner, Node 24, npm 11.19.1) rebuilt at the
  bound source, packed, and scanned — terminal-`success`; its artifact
  was NOT downloadable unauthenticated (recorded truthfully; its
  substantive claims were independently rederived from registry +
  provenance data as instructed). Corroborating local rebuild (Windows):
  13/13 content-identical; 12/13 byte-identical tarballs; `cli` differs
  ONLY in the tar metadata exec-bit of `bin/vict.mjs` (0755 on the
  Linux-published artifact vs 0644 from a Windows checkout) — zero
  content difference.
* Publication run `35661159776` remains truthfully terminal-`failure`
  (publish step success; verify step failure — propagation lag); the
  evidence run `35662077320` is read-only (`contents: read` exactly)
  and terminal-`success`. Neither was reinterpreted.

## 7. Candidate ladders (authoritative; run once each on clean frozen trees)

### VICT (at HEAD == origin/main == `b4f2e35…`; package source identical to `a7b0018…`)

| Step | Exit |
| --- | --- |
| `npm ci` | 0 |
| `npm run format:check` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run build` | 0 |
| `npm run verify:release-set` | 0 (13 packages, 0.3.1-rc.2, `v1_55d1ad2e…`) |
| `npm test` (full suite, ONCE) | 0 — **2408 passed \| 3 skipped (2411)**; 125 files passed \| 1 skipped |
| pack (13 tarballs) + inspection/scan + registry-tarball comparison | 0 (see §6) |
| registry-only external consumer vs rc.2 | PASS (all §5 suites) |
| `npm audit --omit=dev` | 0 (0 vulnerabilities) |
| `git diff --check` | 0 |

### Quellight (read-only, at HEAD == origin/main == `8dcd3c0…`)

Exact pins 10/10 at `0.3.1-rc.2`; lockfile resolves ONLY public-registry
rc.2 artifacts; capability/profile revisions and the three-branch schema
match the repaired VICT contract (`qlt.proposal.draft@3`, profile 6,
instructions 4, quiet-write `qlt.host-policy.quiet-write@1`); the Q6
harness and offline worker behavior unchanged; no provider call anywhere.

| Step | Exit |
| --- | --- |
| `npm ci` | 0 |
| `npm run verify:consumer` | 0 (N-1 + N-2 negative control) |
| `npm run verify:quellight` | run 1 FAILED (browser-stop-check), runs 2–3 FAILED (test:node) — ALL DIAGNOSED (finding 4); disclosed rerun **0 — PASS** |
| `npm run verify:stage7c` | 0 (N-C1..N-C25; live gate NOT executed — N-C24 negative control) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `git diff --check` | 0 |

`verify:q6:live` was NEVER executed. Live Execution 4 was not run and is
not authorized. Q7 did not begin.

## 8. Findings and severity

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| 1 | Low | Release-preparation attribution split across `8242e62`/`378d0bf`/`a7b0018` vs the report's single-commit claim | Recorded (§2); release-source identity remains valid |
| 2 | Low | `8dcd3c00` touched a historical report | Strictly formatting-only (§3); truthful non-blocking evidence-history correction |
| 3 | Low | Upstream `@mastra/core` validation-error formatting echoes model-supplied args ("Provided arguments: …") on schema-INVALID input before VICT's guard | Pre-existing (identical in registry rc.1 — proven); upstream surface, not VICT-owned; zero effect, zero pollution; VICT refusal envelopes are non-echoing (proven) |
| 4 | Low | Quellight `test:node` isolation race: `q6-live-parent-worker.test.ts` counts `qlt-q6-live-*` entries in the GLOBAL OS tmpdir while the parallel `q6-live-offline-matrix.test.ts` legitimately allocates same-prefix workspaces | Pre-existing (introduced by the earlier Quellight remediation tests, before the rc.2 repin; unchanged by `8dcd3c00`); the gate invariant itself HOLDS (5/5 isolated passes + mechanism proof); no product/candidate impact; recommendation: private tmpdir root or disjoint prefix for offline-matrix allocations |

**Blocking: 0. High: 0. Medium: 0.** The conditional stable release was
therefore authorized and executed.

## 9. Conditional stable release (executed and verified)

* Stable tree: `446453fc…` — 13 manifests `0.3.1`, exact stable internal
  pins, lockfile workspace metadata updated, release-set record
  `vict-release-set@1/0.3.1` = `v1_1c695280…`. STABLE LADDER (once): npm
  ci, format, lint, typecheck, build, verify:release-set, full test
  suite (2408 passed \| 3 skipped), audit (0), git diff --check — ALL
  exit 0.
* **Payload equivalence**: all 13 stable tarballs proven content-
  equivalent to the audited rc.2 tarballs modulo version/pin metadata
  (13/13 file-level comparison).
* Publication run `35688234026` (`release.yml`, OIDC, inputs
  `source_sha 446453fc…`, `version 0.3.1`, `npm_tag latest`): full
  pre-publication chain green; ALL 13 PACKAGES PUBLISHED; same-run
  verification failed on CDN propagation lag → terminal-`failure`
  (truthful; never relabelled).
* Read-only evidence run `35689362749`: terminal-`success` under the
  stable evidence-recovery amendment `87b5180…`
  (`docs/report/VICT-0.3.1-STABLE-EVIDENCE-RECOVERY-AMENDMENT.md`;
  retained-tag bound `vict-0.3.1-rc = 0.3.1-rc.2`; forbidden-stable
  guard disabled for the stable class; evidence-engine tests 50/50).
* Independent registry verification: 13/13 manifests at `0.3.1`;
  `latest → 0.3.1`; `vict-0.3.1-rc → 0.3.1-rc.2` RETAINED; tarball
  integrity 13/13; SLSA provenance 13/13 (source `446453fc…`, run
  `35688234026`, `release.yml`); content ID recomputed and matching;
  registry-only disposable consumer at exactly `0.3.1` (removed
  afterward) proves the repaired surface end-to-end.
* No version was republished or unpublished; rc.1 and rc.2 retained;
  `latest` advanced only after the full chain.

## 10. Quellight stable repin (completed)

Mechanical repin `0.3.1-rc.2 → 0.3.1` (ten exact pins; lockfile
regenerated solely from the public registry; central release-set
identity and EVERY derived verification literal updated in the same
commit — the 0.3.0-era desynchronization class did not recur; a
repo-wide sweep confirms no live-code rc.2 references). Offline ladder
on the final stable-pinned tree: consumer PASS; quellight PASS (first
run hit the disclosed finding-4 race; disclosed rerun green); stage7c
PASS; audit clean; diff-check clean. Full record:
Quellight `docs/report/QUELLIGHT-STAGE-07C-STABLE-REPIN-0.3.1.md`
(commit `1fae9f3…`, pushed fast-forward).

## 11. Cleanup

Both disposable registry consumers (rc.1, rc.2, stable) and all local
pack/compare scratch directories were removed from the audit workspace;
no repository file outside the committed changes was touched; no
provider credential, `auth.json`, `.npmrc`, npm token, OTP, or
`OLLAMA_API_KEY` was accessed at any time; no live provider call
occurred.

## 12. Closure statement

The VICT B-1..B-4 model-facing capability-schema remediation is
INDEPENDENTLY VERIFIED and FORMALLY CLOSED.
`@victframework/*@0.3.1` is the STABLE release. Quellight is
exact-pinned to `0.3.1`. Quellight Q6 remains NOT formally closed (the
live ceremony proof has not passed); Execution 4 has NOT run and is NOT
authorized; Phase Q7 remains BLOCKED — NOT BEGUN; Stage 07 remains In
Progress.

**Next permitted action:** only the owner-authorized Q6 live ceremony
proof (Execution 4) can reopen the Q6 chain; until an owner grants it,
no live execution, no Q7 work, and no further release event is
authorized.
