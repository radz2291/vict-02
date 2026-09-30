# VICT Stage 09 — G3 ENTRY CONTRACT RE-REVIEW (FRESH INDEPENDENT REVIEWER, 2026-09-29)

**Scope.** Fresh independent re-review of the REPAIRED G3 entry contract bytes on
`codex/stage9-g3-proposal` @ `f61d01f75007fbe980bcf206cee899428aeceee6`
(ls-remote verified) after the first contract review
(`review/stage9-g3-contract-20260929` @ `8d020c9`, VERDICT REVISION REQUIRED:
0 blockers, 5 majors, 4 notes). This reviewer had NO role in any Stage 9
authoring or repair work; review only — this branch adds this report and
nothing else.

## 0. Inputs and commands run

- `git ls-remote` → `codex/stage9-g3-proposal` = `f61d01f` (verified live);
  VICT `main` = `510ef7e`; Quellight lineage unchanged in contract references.
- Prior review report read from `review/stage9-g3-contract-20260929` @ `8d020c9`.
- Repair diff `git diff 6d49c18..f61d01f` = EXACTLY two contract files
  (`docs/governance/VICT-STAGE-09-G3-PROPOSAL-2026-09-29.md` +28/-11,
  `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md` +62/-11). No code,
  no tests, no STATE change in the repair. Read line by line.
- **M-1 oracle existence check (independent, against the PUBLISHED artifact):**
  downloaded `https://registry.npmjs.org/@victframework/server/-/server-0.3.1.tgz`
  and `.../server-0.4.0-rc.1.tgz`; inspected `dist/commands.js` of each.
- Regression scans (§3).

## 1. Repair verification (independent, per finding)

| ID | Repair required | Verified | Result |
| --- | --- | --- | --- |
| M-1/S-2 | Target-derived pin oracle (compatibility.inspect + health.inspect commandSchema equality vs pinned 0.3.1 declaration; no registry self-echo; fail-closed; falsifier vs differently-schemad target) | Repair TEXT is present and well-shaped in handoff WP-G3-C item 1 (target-derived, self-echo banned, fail-closed, demo-target falsifier). BUT the named oracle was independently checked against the REAL 0.3.1 artifact and is contradicted → **BLOCKER B-1 below**. | TEXT PRESENT, ORACLE FALSIFIED |
| M-2/S-3 | Two distinct server-held credentials; operator executes both proof reads; agent-context credential only for refusal; per-credential `actor.whoami` recorded; single-actor fallback stated | Handoff item 2 (identity-evidence block): operator credential executes BOTH proof reads; distinct AGENT-CONTEXT credential used ONLY for the refusal demonstration; per-credential `whoami` (`actorId`/`roles`/`scopes`) recorded, distinctness demonstrated by the whoami DIFF; single-actor case falls to OD-R4 (NOT DEMONSTRATED, never simulated). The real 0.3.1 artifact DOES return all three fields from `actor.whoami` (verified in `dist/commands.js`) — the evidence mechanism exists. **Minor M-2-N1:** the repair text references "the refusal demonstration in item 8" but the scope list has items 1..7 — dangling cross-reference (the referent is the G3-C required-demonstrations list). | CONFIRMED (1 minor note) |
| M-3/P-2 | §0.1 symmetric agent-identity-refusal fallback (NOT DEMONSTRATED on existing tree → OD-R4; never simulated) + whoami-evidence sentence | §0.1 CONDITIONAL paragraph: "The same conditional applies symmetrically to the agent-identity refusal... truthfully recorded as NOT DEMONSTRATED on the existing tree... never simulated client-side... the target's own `actor.whoami` answers distinguish the single-actor fact from a demonstrated refusal." Handoff item 2 carries the matching sentence (single-actor whoami → OD-R4). Consistent, byte-located. | CONFIRMED |
| M-4/R-1 | OD-R4 trigger names the fresh independent verifier as decider (attempt logs + own reproduction; only verifier-confirmed impossibility authorizes the increment; Quellight's own governance restated) | Handoff G3-C OD-R4 paragraph: "the G3-C fresh INDEPENDENT VERIFIER decides — from the builder's attempt logs plus its own live reproduction"; "Only a verifier-confirmed, logged impossibility authorizes the OD-R4 Quellight increment, which then runs under QUELLIGHT'S OWN governance"; "The stage manager never edits Quellight to force a criterion." Exactly as directed. | CONFIRMED |
| M-5/C-1 | §4 and §5 marked SUPERSEDED/RESOLVED (retained lineage) consistent with §3.3 | §4 heading now "SUPERSEDED by the owner decision (OD-R3/OD-R6; retained for lineage)" with a SUPERSEDED blockquote naming the authoritative handoff and voiding "(only if Option 2)"; §5 heading "RESOLVED by the owner 2026-09-29 (OD-R1..R6...; retained for lineage)" with a SUPERSEDED/RESOLVED block; original tables/decision text preserved unmodified; pattern matches §3.3's marker. | CONFIRMED |
| Note P-1/(h) | Diff-scan falsifier on criterion (h) | Criterion (h): "(falsifier: the verifier diff-scans the product-view page for any Quellight-name/target-name branch outside the declared binding)". | CONFIRMED |
| Note N-3/(m) | Banner falsifier on criterion (m) | Criterion (m): "(falsifier: the banner must DIFFER between the demo target — reads present — and the Quellight target — reads absent; identical banners fail the criterion)." | CONFIRMED |

Not in the required-repair list, still outstanding from the prior review (both N-level, non-blocking): **N-1** the dual pre-amendment H1 title remains at proposal line ~1 (lineage-stable; demote at freeze editing); **N-4** criterion (b) still does not name the same-turn alignment oracle (shared turn identifier). Neither blocks.

## 2. BLOCKER B-1 (new finding; severity: BLOCKER) — the repaired M-1 oracle is contradicted by the real 0.3.1 artifact

**Location:** handoff WP-G3-C item 1, "Identity-pin oracle" block
(`codex/stage9-g3-proposal` @ `f61d01f`, the repair commit itself).

**Claim under test:** "the transport calls the target's own `compatibility.inspect`
and `health.inspect` ... and requires the returned `commandSchema` to match the
pinned 0.3.1 declaration EXACTLY: it must contain `agent.turn.get` and
`app.data.query`, and it must NOT contain the G1 operator reads." The task
rule applied: if the real artifact contradicts the contract's oracle → blocker.

**Independent artifact evidence (performed for this review):**
`registry.npmjs.org/@victframework/server/0.3.1` tarball, `dist/commands.js`:

1. **`commandSchema` is NOT a command list — it is an envelope version MARKER.**
   `health.inspect` returns `{ healthy, commandSchema: VICT_COMMAND_SCHEMA,
   turnExecutorComposed }` and `compatibility.inspect` returns
   `{ commandSchema, streamSchema, changesetSchema, turnSchema }` where
   `VICT_COMMAND_SCHEMA = 'vict.command@1'` (line 39). It is a single opaque
   string; it can never "contain `agent.turn.get`" or "contain/exclude" any
   command name. The full command list is `VICT_COMMANDS` — a **compile-time
   export of the npm package**, returned by NO inspect endpoint.
2. **Therefore the positive prong of the oracle cannot be evaluated against the
   pinned target as written.** A literal implementation would reject the REAL
   0.3.1 Quellight target (marker `vict.command@1` is not "a declaration that
   contains `agent.turn.get`") — i.e. the oracle as written FAILS on the very
   surface it exists to admit. Alternatively, an implementer forced to make it
   pass would satisfy the check using the package's own `VICT_COMMANDS`
   constant from the transport's own dependency — that is a build-time
   dependency self-echo, exactly the "registry self-echo alone is never
   sufficient evidence" pattern the repair itself bans, and not
   target-derived at all.
3. **The anti-regression prong is also vacuous under this oracle.** The marker
   is version-INVARIANT: I independently downloaded
   `@victframework/server@0.4.0-rc.1` and its `health.inspect`/`compatibility.inspect`
   return the IDENTICAL `commandSchema: 'vict.command@1'`
   (`rc/package/dist/commands.js` lines 716–724). Marker equality therefore
   CANNOT reject "a NEWER target that would silently add those reads" (the
   repair's own stated intent). No target-release version literal appears in
   the 0.3.1 HTTP surface (`dist/http.js`: no version header/field).
4. What IS accurate in the repair: the 0.3.1 `VICT_COMMANDS` array (in the
   artifact) contains `agent.turn.get` (line 61) and `app.data.query`, and
   contains NO G1 operator reads (`run.get`/`run.list`/`run.detail`/
   `run.events`/`run.waits`; only `run.cancel` exists). The pinned
   declaration's CONTENT is correct; the named ORACLE CARRIER
   (`commandSchema`) is wrong.

**Why this is a blocker, not a nuance:** every downstream claim inherits the
oracle — criteria (a), (k), capability honesty (m), the version-pin negative,
and the demo-target falsifier (I further verified the greenfield demo server
in THIS repo, `packages/server/src/commands.ts:2187-2196`, exposes the same
inspect commands with the same `vict.command@1` marker — so the demo-target
falsifier would also fail for the wrong reason under a literal reading). A
builder starting from this text either cannot implement it or implements a
self-echo. The falsified oracle cannot be frozen.

**Concrete repair (for the stage manager; decision is the contract's to
specify):** re-specify the pin oracle against surfaces that the 0.3.1 target
actually derives from its server, e.g. (combination, all target-derived):
(a) equality on the WHOLE inspect answer record (the marker fields
`commandSchema`/`streamSchema`/`changesetSchema`/`turnSchema`), which is
version-FAILOPEN so it cannot stand alone; (b) a BEHAVIORAL probe: transport
attempts `run.get` and requires the stable unknown-command refusal ON the
0.3.1 target (fail-closed if a newer target accepts it) — this is genuinely
target-derived and directly implements the "newer target silently adds reads
must fail" intent; (c) a target-DECLARED version identity check from
Quellight's own tree/config (the existing `vict-release-set@1/0.3.1` identity
literal disclosed read-only by the target application, per the D-3 target
entry), since the framework HTTP surface publishes no version. The falsifiers
(demo-target refusal; second differently-schemad target) stay, re-anchored to
the repaired oracle. Final naming is an owner/governance decision on the
repaired bytes; the artifact evidence above is the constraint.

## 3. Regression scan

- `git diff 6d49c18..f61d01f --name-only` = exactly the two contract files.
  No implementation authorization, no greenfield/publication path, no new
  scope introduced by the repair (verified line-by-line; the additions are
  the M-1/M-2/M-4 oracle-identity paragraphs, the "differently-schemad
  second target" falsifier, criterion (h)/(m) falsifiers, criterion (k)
  whoami-evidence wording, and the §0.1/§4/§5 markings).
- Security core statements unchanged in substance on the branch: handoff
  item 5 (server-held only, browser never holds a target credential, CSRF/
  Origin unchanged), item 2 (no mutation verb, no bypass, no invented data),
  item 7 + criterion (k)/(j) target isolation — all untouched by the repair
  diff except (k) gained the whoami/oracle-evidence clause, which STRENGTHENS
  it. The repair introduces only additional evidence requirements, no
  weakening.
- Frozen records vs `origin/main` @ `510ef7e` (TWO-dot diff):
  `docs/architecture/*` untouched (empty diff). `G2-CLOSURE` shows a diff,
  but `git log origin/main..f61d01f -- <closure file>` is EMPTY and
  `git show 0218f7b:<closure file>` is byte-identical to the branch copy:
  the closure record is **byte-untouched on the branch**; the two-dot delta
  is only because `main` advanced AFTER the branch point by `510ef7e`
  (the closure checker's LOW wording-note commit, which edits §5/§6 of the
  closure file on main itself). **R-R1 (NOTE):** the branch is based on
  `0218f7b`, one commit behind the contract's own named baseline
  (`origin/main = 510ef7e`, per handoff header). At freeze, the G3 files
  should be rebased/merged over the `510ef7e` wording note (a normal,
  non-forced integration of main-side governance wording), so the frozen
  contract names a baseline its branch actually contains. Not a content
  regression.
- STATE changes remain additive (the new dated G3 section + the G3 gate row
  NOT AUTHORIZED → AUTHORIZED under recorded decisions) — unchanged by the
  repair commit.

## 4. VERDICT: **REVISION REQUIRED** — 1 blocker

The five required repairs were each verified as TEXT-Present, and four of
them (M-2, M-3, M-4, M-5) plus both directed falsifier notes (h)/(m) are
confirmed correct against the bytes. No regression was found. But the M-1
pin oracle — the central security repair — was independently checked against
the published `@victframework/server@0.3.1` artifact and is **contradicted
by it** (B-1): `commandSchema` is an opaque, version-invariant envelope
marker (`vict.command@1`), identical on 0.3.1, on 0.4.0-rc.1, and on this
repo's own greenfield demo server; it can never "contain
`agent.turn.get`", and marker-equality cannot distinguish a newer target.
The oracle must be re-anchored to a genuinely target-derived, discriminating
surface (behavioral `run.get`-refusal probe + whole-inspect-record equality +
a target-declared version identity) before freeze.

### Findings index

| ID | Sev | Location | Summary / repair |
| --- | --- | --- | --- |
| B-1 | BLOCKER | handoff WP-G3-C item 1, Identity-pin oracle block | Oracle names `commandSchema` as carrying a commands declaration; the real 0.3.1 (and 0.4.0-rc.1, and the local greenfield demo server) return only the opaque marker `vict.command@1`. Literal oracle rejects the pinned target; reinterpreted, it collapses into a dependency self-echo; anti-newer-target prong vacuous. Re-anchor to behavioral probe + full inspect-record equality + target-declared version identity (see §2). |
| M-2-N1 | MINOR/M | handoff item 2 (repair of M-2) | "the refusal demonstration in item 8" — no item 8 exists (scope list ends at 7). Point to the G3-C required demonstrations (agent-identity refusal). |
| R-R1 | NOTE | branch base vs handoff header | Branch is at `0218f7b`; handoff names baseline `origin/main = 510ef7e` (one main-side LOW-wording commit later). Rebase/merge over `510ef7e` at freeze; no content conflict expected. |
| P-N2 | N | proposal line ~1 (unchanged) | Dual pre-amendment H1 still present (prior N-1, non-blocking). |
| P-N3 | N | handoff criterion (b) (unchanged) | Same-turn alignment oracle (shared turn id) still unnamed (prior N-4, non-blocking). |

### Repair-confirmation table (the requested per-finding result)

| Prior finding | Repair present at f61d01f? | Independently verified against artifact/byte? |
| --- | --- | --- |
| M-1 pin oracle | text present | NO — contradicted by the 0.3.1 artifact → B-1 |
| M-2 identity evidence | present | YES (whoami fields confirmed in artifact; one dangling-ref minor) |
| M-3 refusal fallback | present | YES (§0.1 + handoff consistent) |
| M-4 OD-R4 decider | present | YES (verifier named; Quellight governance restated) |
| M-5 §4/§5 marks | present | YES (consistent with §3.3) |
| (h) diff-scan falsifier | present | YES |
| (m) differ-between-targets falsifier | present | YES (but see B-1 caveat: the falsifier's premise survives; its mechanism must be re-anchored to the repaired oracle) |

Signed: fresh independent re-reviewer (no Stage 9 authoring or repair role),
2026-09-29. Review-only: this branch adds this report and nothing else.