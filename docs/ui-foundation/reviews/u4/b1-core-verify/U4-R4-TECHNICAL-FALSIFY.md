# U4 round-4 INDEPENDENT TECHNICAL FALSIFICATION — U4-R4-TECHNICAL-FALSIFY

- **Verifier**: fresh independent verifier (vict.vict-verifier, round 4, run ce4c87fc-858d-48a4-b517-8a767ac447ca). Not the builder.
- **Tested SHA (verified via git)**: `32d8465aa9c810e4285995549a562957c85d2e36` (branch lineage `codex/ui-foundation-u4-full-catalog-repair-03`), checked out into an isolated clone at `C:/Users/RZ1/Desktop/RZ/u4-r4-techfalsify` (local clone with `--no-hardlinks`; the source checkout at `C:/Users/RZ1/Desktop/RZ/vict-02` was never touched; nothing committed, nothing pushed).
- **Environment**: Windows, Node v22.13.1, npm 11.19.1, vitest v4.1.11, happy-dom renderer project. All adversarial input was SYNTHETIC DOM input (KeyboardEvent / PointerEvent / input events) in happy-dom, labelled as such in the probe files. No real orders, no publishing, no secrets.
- **Claims under test**: round-4 verifier claims, docs/ui-foundation/reviews/u4/b1-core-verify/U4-FULL-CATALOG-VERIFY-03.md §16–§20. NOTE: at the pinned SHA that file ends at §15; §16–§20 exist only in the round-4 workspace copy (`vict-02-u4-repair-verify-04`), i.e. they describe work whose committed bytes are partly NOT in the candidate tree (details under Claims 1–3).

## OVERALL VERDICT (per claim)

| # | Claim | Verdict |
| --- | --- | --- |
| 1 | Full battery at the candidate: 3113 passed / 0 failed / 3 skipped (`npm test`) | **FALSIFIED** — actual **3102 passed / 1 failed / 3 skipped** (3106 total), deterministic |
| 2 | The 10 round-3a pinned oracles pass unchanged (incl. corrected `probe-datefield-supply`) | **PARTIALLY FALSIFIED** — 9 of the oracle files pass unchanged; the "corrected" `probe-datefield-supply` does NOT exist at the candidate and the candidate's committed version FAILS deterministically |
| 3 | New verifier oracles: `probe-command-label-search`, `state-values-panel-numeric-list.svelte.test.ts`, `probe-host-isolation` | **FALSIFIED as candidate claims** — all three files are ABSENT at `32d8465`; their substance PASSES against candidate sources when run from the verify-04 branch bytes (3/3, 4/4, 3/3) |
| 4 | Adversarial attempts (rapid selection duplicates; earlier-day ordering; PM→AM→PM; unmount mid-flight; author-while-canvas-runs; invalid StateValuesPanel values; partial-label search) | **NOT FALSIFIED** — every repair held; no genuine candidate defect found; all initial adversarial-probe failures were probe artifacts (documented below) |
| 5 | Packed closure `node scripts/pack-u4-consumer.mjs` with own `U4_ISOLATED_ROOT` → `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`, 16/16, bits-ui 2.19.3 exactly | **UNVERIFIED — INCOMPLETE** — the re-run was cut off by the session timeout and was NOT completed by this verifier; no `ISOLATED PACKED-ARTIFACT VERIFICATION` line was observed; no fresh isolated bits-ui resolution check was performed |

**Roll-up**: the round-4 gate numbers (§20: 3113/0/3; §20a launch instructions promising 3113/0/3 directly from `git checkout 32d8465 … npm test`) are **not reproducible at the frozen candidate**. Git forensics shows the round-4 verifier's own commits (`b874205` → `674408d` → `a18b782`, branch `codex/ui-foundation-u4-repair-verify-04`, parented directly on the candidate) carry the corrected `probe-datefield-supply` probe, the three new oracle files, and the historical file; the claimed 3116-test battery arithmetically equals the candidate's 3106 tests plus exactly those 10 new tests. The gate battery was therefore run on candidate+verifier-commit tree, not on the candidate — the report does not state this.

## Claim 1 — full battery at the candidate

Command: `npm ci` → OK (esbuild postinstall allowScripts warnings only); `npm run build` (root) → clean; `npm run build -w @victframework/ui-preview` → clean **only after** the root build (running it first fails with TS2307 `Cannot find module '@victframework/ui'` — ui-preview consumes sibling workspace dists; the documented order is root build first; F14's structural fact that root `build` omits `ui-preview`/`ui-editor` is confirmed from `package.json`).

`npm test` (full battery) at `32d8465`:

```
Test Files  1 failed | 189 passed | 1 skipped (191)
     Tests  1 failed | 3102 passed | 3 skipped (3106)
EXIT=1
```

The single failure:

```
FAIL |renderer| packages/ui-svelte/test/probe-datefield-supply.test.ts >
  disclosed defect A isolation: single DateField external supply >
  tracks non-empty external changes, clears and restores
AssertionError: non-empty external change: expected '12/10/2026' to be '09/10/2026'
  ❯ packages/ui-svelte/test/probe-datefield-supply.test.ts:28:49
```

Determinism: `npx vitest run packages/ui-svelte/test/probe-datefield-supply.test.ts` → **1 failed (1) on 3 consecutive runs**. This is not flake.

Root cause in candidate bytes: the committed probe calls `flushSync()` only once after mount; the fixture's `setValue` is a bare Svelte 5 `$state` write (no flush), and the assertions read the DOM synchronously — before any supported update boundary — so the display is stale (`12/10/2026`). §16's description ("the committed probe now reads the display through `flushSync()`") is true of the verify-04 branch, not of the candidate: `git diff b874205 32d8465 -- <probe>` shows the candidate reverted to the round-3 (pre-correction) bytes last touched by `599b612`. The historical preservation file `packages/ui-svelte/test/historical/probe-datefield-supply-v1.historical.ts` claimed in §16 is likewise absent at the candidate (`git cat-file -e 32d8465:<path>` fails).

## Claim 2 — the 10 round-3a pinned oracles (individual runs at the candidate)

| Oracle file | Result at 32d8465 |
| --- | --- |
| `probe-date-range-picker.test.ts` | **5/5 PASS** (verbose: end-only mount display; first selection exactly one `startChange`; completing start-only exactly one `endChange`; restart from complete exactly the end-clear; end-only selection ordered with display agreement) |
| `probe-date-clear-sequence.test.ts` | **4/4 PASS** (full-clear sequence, empty convention, intact endpoint, restoration, incremental Backspace preserved) |
| `probe-time-hour-cycle.test.ts` | **5/5 PASS** (en-GB 12h, en-GB 24h, en-US 12h controls + adapter agreement + dayPeriod 13:30→01:30 flip) |
| `probe-range-external-state.test.ts` | **3/3 PASS** |
| `probe-b5-interactive.test.ts` | **5/5 PASS** (incl. `B5: tooltip controlled-open (KNOWN DEFECT probe) > renders content when the authored open state is true`) |
| `probe-datefield-supply.test.ts` | **0/1 FAIL** (deterministic; see Claim 1 — corrected bytes absent from candidate) |

The 9 calendar/clear/time/tooltip/external-state oracles pass unchanged; the A1 single-field supply oracle is the one failure. The repair itself is real (the corrected probe passes against the same candidate sources — verified on the verify-04 bytes, below) — what is falsified is the gate claim that the candidate's own battery is green.

## Claim 3 — new verifier oracles

Presence at candidate (`git cat-file -e 32d8465:<path>`): `packages/ui-svelte/test/probe-command-label-search.test.ts` **MISSING**; `packages/ui-editor/test/state-values-panel-numeric-list.svelte.test.ts` **MISSING**; `packages/ui-svelte/test/probe-host-isolation.test.ts` (+ `HostIsoFixture.svelte`) **MISSING**; `packages/ui-svelte/test/historical/probe-datefield-supply-v1.historical.ts` **MISSING**. All exist only on `origin/codex/ui-foundation-u4-repair-verify-04` (commit `b874205`).

Substance check (I copied the verify-04 test bytes into my clone's working tree — staged only, never committed — and ran them against candidate sources):

- `probe-command-label-search.test.ts` → **3/3 PASS** (label fragment finds value-differing item, non-matches hide; value search + authored empty slot; Enter activation emits the authored VALUE `'export'`, not the label)
- `state-values-panel-numeric-list.svelte.test.ts` → **4/4 PASS** (valid draft applies + input clears; `1e999` invalid path surfaces validation, keeps draft, never seeds; removal filters via onChange only; scalar finite-number guard)
- `probe-host-isolation.test.ts` → **3/3 PASS** (two hosts, per-host supply isolation, owner-stamped portal that dies with its host, runtime-vs-authored session separation, post-unmount interactivity)

So the repairs these oracles pin hold against candidate sources; the round-4 report's presentation of them as part of the candidate's evidence base (and of the 3113/0/3 battery) is not reproducible from the candidate.

## Claim 4 — adversarial probes (SYNTHETIC input, my clone only, never committed)

Files written by me: `packages/ui-svelte/test/r4f-adversarial.test.ts` (12 tests) and `packages/ui-editor/test/r4f-state-values-invalid.svelte.test.ts` (6 tests). Final state: **18/18 PASS**, stable across two consecutive runs. Attack-by-attack:

- **Rapid duplicate emissions via keyboard**: three rapid selections with no awaits between → exactly the four coherent transitions, zero duplicates; re-Enter on the picked start emits exactly one `startChange ''` (deliberate clear, not a duplicate); two unflushed Enters → exactly-once, display agrees with the cleared state. **Dedup held.**
- **End-only range then pick an EARLIER day** (`2026-10-10` vs mounted end `2026-10-16`): ordered restart pair `{startChange '2026-10-10'}, {endChange ''}`, no reversed display, no `aria-invalid`, window completable afterwards exactly once. **Ordering guard held.**
- **en-GB 12h PM→AM→PM** (adapter path, 13:30): ArrowDown→AM, ArrowUp→PM, plus three unflushed rapid toggles landing AM — visible text, `aria-valuenow`, `aria-valuetext` agree at every step. **Held.**
- **Unmount a host mid-flight**: pending supply write + open portal, destroy before any flush → portal removed from the document, zero stale portals, sibling unaffected, keeps toggling and accepting supply; two queued supplies (A and B) with A torn down → survivor renders its own supply. **Held.**
- **Author a transaction while the canvas runs**: `applyTransaction` accepted between SYNTHETIC runtime interactions; source updated, revision advances, undoable; runtime state loop unaffected; the stale-`expectedDocumentRevision` replay of the same `requestId` is **rejected** and applies nothing. **Held.**
- **Invalid values through StateValuesPanel**: `1e999` and `Infinity` rejected with "List members must be finite numbers.", draft kept verbatim, no onChange; `abc` never applied (no crash, no NaN); `-3` IS applied (guard is finiteness, not sign — recorded actual, by design of the pinned guard); scalar non-finite rejected; remove-on-empty no-op, panel still functional. **Held.**
- **Partial-label command search**: `PREPARE` (case-insensitive) matches only its item; mid-word `viewer` matches only the reviewer item; single `e` keeps both; rapid consecutive queries without awaits converge on the last query. **Held.**

### R4-FALSIFY D edge findings — exact failing assertions and assessment

Two adversarial failures were observed during iteration and are recorded honestly:

1. `AssertionError: sibling unaffected by the torn-down host: expected '05/01/2026' to be '20/03/2026'` (r4f-adversarial.test.ts:290, first D test).
   **Assessment: PROBE ARTIFACT, not a candidate defect.** My `mountHost()` helper never supplied host B its own initial value, so B correctly displayed the fixture's per-instance default (`visitDate: '2026-01-05'`). No cross-host leakage was involved; the committed `probe-host-isolation` sets each host's supply immediately after mount, mine did not. After supplying B its own initial value the test passes and isolation holds.
2. `AssertionError: expected 1 to be +0` (tooltip portal count in the second D test).
   **Assessment: PROBE ARTIFACT, not a candidate defect.** The leftover portal belonged to the FIRST D test's surviving host B (left with `tipOpen: true`) because my D-describe `mountHost()` did not register an `afterEach` cleanup; the portal from the previous test leaked into the next test's document. After registering cleanups, both D tests pass and the portal-ownership contract holds.

Also recorded (probe-artifact class, for the next adversary): my initial wrong expectations that Enter-on-selected-start is a no-op (actual: one coherent clear emission) and that from-complete restart emits start-first (actual: `{endChange ''}` then `{startChange}`, exactly once each — the end-only restart pins start-first; the order asymmetry between the two restart contexts is a MINOR non-blocking observation with no user effect, since both are exactly-once coherent pairs with agreeing display).

No genuine candidate defect was found by any adversarial attempt.

## Claim 5 — packed closure (INCOMPLETE — timeout)

Command attempted (my own fresh root, never the round-4 evidence directory):

```
cd C:/Users/RZ1/Desktop/RZ/u4-r4-techfalsify
U4_ISOLATED_ROOT="C:/Users/RZ1/Desktop/RZ/u4-r4-falsify-consumer" node scripts/pack-u4-consumer.mjs
```

**The command was aborted by the session timeout. It was NOT completed by me.** I never observed `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`, no 16/16 consumer-suite result, and performed no fresh isolated bits-ui version check — claim 5 is therefore **unverified** by this verifier. What would verify it: re-running the command above to completion and capturing the script's own OK line + 16/16 + `bits-ui@2.19.3` resolution inside `U4_ISOLATED_ROOT`. Script facts confirmed by inspection: it honors `U4_ISOLATED_ROOT` (line 24), deletes the target root, and emits the OK line (line 154) only after its full pack → isolate → rewrite → install → build → test pipeline. Partial artifacts from the aborted run are confined to my temp clone and my own `u4-r4-falsify-consumer` directory.

## Findings ledger

- **BLOCKER-CLASS (gate integrity, not runtime)**: §20 battery "3113/0/3" and §20a launch instruction are not reproducible at `32d8465`; actual 3102/1/3 with a deterministic failure. Severity: high (gate claim), user effect: none at runtime (the failing probe is a verifier-oracle timing defect in committed probe bytes, not in shipped component behavior).
- **F-R4-1**: candidate's committed `probe-datefield-supply.test.ts` asserts before a Svelte 5 update boundary; corrected bytes live only on the verifier branch (`b874205`). The round-4 report (§16) describes the corrected probe as "committed" without stating it is not on the candidate branch. Severity: medium (evidence accuracy).
- **F-R4-2**: the three "new verifier oracles" and the historical file are absent at the candidate; §20a's clean-clone launch instructions cannot reproduce them or the 3116-test total. Severity: medium (reproducibility).
- **F-R4-3 (observation, non-blocking)**: from-complete restart emits `{endChange ''}` before `{startChange}`; end-only restart emits start-first. Both exactly-once and coherent; order asymmetry undocumented. Severity: low.
- **F-R4-4 (observation, non-blocking)**: numeric-list guard is finiteness, not sign — negative members are applied (recorded actual; consistent with the pinned contract wording).
- **F14 (confirmed structurally)**: root `build` omits `@victframework/ui-preview` (and `ui-editor`); `build -w @victframework/ui-preview` fails before a root build. Delivery finding, as already recorded by round 4.
- **Not verified (unverified, needs completion)**: packed closure OK/16/16/bits-ui 2.19.3 — the re-run was cut off by timeout and must be re-run by a verifier before any gate reliance on my behalf.
- Probe artifacts of MY OWN documented above are excluded from findings against the candidate; all were fixed in my clone and the suite passes 18/18 twice.

## Hygiene statement

No repairs were made to the candidate. Nothing was committed or pushed by me. Writes were confined to (a) my temp clone `C:/Users/RZ1/Desktop/RZ/u4-r4-techfalsify` (including 4 files staged from the verify-04 ref for substance-checking and my 2 untracked adversarial probe files — clearly labelled synthetic) and (b) my report file plus my own `U4_ISOLATED_ROOT` scratch directory. The source checkout at `C:/Users/RZ1/Desktop/RZ/vict-02` was only read (read-only git commands).
