# VICT Stage 09 — G3 ENTRY CONTRACT REVIEW (FRESH INDEPENDENT REVIEWER, 2026-09-29)

**Scope.** Fresh independent reviewer challenge of the G3 ENTRY CONTRACT
BYTES on `codex/stage9-g3-proposal` @ `6d49c18` (ls-remote verified) against
baseline `origin/main` @ `510ef7e`, prior to contract freeze. The reviewer
had no role in any Stage 9 authoring work; this review changes no audited
bytes. Priority per owner directive: the narrow transport's security and
product boundaries.

**Reviewed bytes:**
1. `docs/governance/VICT-STAGE-09-G3-PROPOSAL-2026-09-29.md` (as amended: §0/§0.1 + superseded §3.3 lineage)
2. `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md` (WP-G3-A/B/C, ownership matrix, evaluation criteria, verification pattern)
3. `docs/governance/VICT-STAGE-09-STATE.md` — new dated G3 section + G3 gate row

**Fidelity checks run:**
- `git ls-remote` → VICT `main` = `510ef7e`, `codex/stage9-g3-proposal` = `6d49c18` (both verified live).
- Quellight `ls-remote main` = `5f709a5` — **unchanged**; the SHA pinned in the contract still matches the live ref (no finding).
- `git diff origin/main...HEAD --stat` = exactly 3 files (proposal +357, handoff +206, STATE ±4). `docs/governance/VICT-STAGE-09-G2-*`, G0/G1 records, and `docs/architecture/*` are **byte-untouched** on this branch. Verified directly, not by claim.
- Superseded §0.1-decision lineage: the original "Option 2 recommended" §3.3 text is RETAINED and explicitly marked SUPERSEDED; the two pre-amendment H1 title lines are retained (see N-1).
- Owner decisions OD-R1..R6: read against the handoff/proposal/STATE; the STATE §0 summary is verbatim-faithful to the proposal's §0 list (surface, greenfield OUT, narrow version-aware transport, no 0.4 adoption/repin, FT-1 as G3-A before G3-B, OD-R4 conditional existing-repo increment, planning-annex-only publication posture, per-gate freeze→candidate→fresh-verifier→bounded-repair→re-verification + separate exit audit). Stop conditions recorded in handoff §0. All present.
- Baselines cross-checked: frozen `STAGE-09-STUDIO-AND-RECOVERY.md` D-1..D-10, D-2 mechanics paragraph, D-3, D-7, D-8 (verbatim quote in proposal §3.1 verified against the frozen architecture bytes), B-1; G2 closure record; `AGENTS.md` rules.

---

## SECURITY REVIEW (priority)

**S-1 — No browser-held target credential path.** Handoff WP-G3-C item 5
("server-held only (the Studio target registry pattern, D-2/D-7). The
browser never holds a target credential."), the frozen D-2 mechanics
(HttpOnly SameSite session, session-bound CSRF token, no target token sent
to the browser), and the review falsifier for criterion (g) ("inspect
browser storage/network for target tokens") are consistent and testable.
CSRF/Origin checks are explicitly "unchanged". No wording anywhere opens a
browser-held-credential path. **No finding.**

**S-2 (M) — The "fail-closed identity pin" has no specified verification SOURCE.**
Handoff item 1: the target-registry entry "declares the expected target
release identity (0.3.1)... the transport verifies the declared identity
and FAILS CLOSED on mismatch." But nowhere — proposal §0/§0.1, handoff, or
STATE — is it stated *what target-side evidence* the pin verifies against
(the target's `vict-release-set@1/0.3.1` identity literal? an endpoint?
the D-3 binding's served declaration? A header?). The negative
demonstration exists ("mismatched version pin" in the direct-API negative
set), but a positive pin check against an *unspecified* oracle is not
verifiable as written: a builder could "verify" 0.3.1 by echo-checking the
registry entry against itself, and every downstream claim ((a), (k),
capability banner (m)) inherits that weakness. **Repair:** add one sentence
to handoff item 1 naming the verification oracle (e.g. the release identity
as declared by the target's application server over the D-3 pilot binding,
cross-checked against the registry's declared 0.3.1 — byte/source
specified in the G3-C plan before builder start), plus a falsifier that a
registry entry edited to a wrong version while the target still answers
must still FAIL CLOSED.

**S-3 (M) — Credential/identity composition of the two reads is unspecified.**
The same-turn proof needs `agent.turn.get` AND the operator-actor
`qlt.inspection` query. The handoff declares "the browser never holds a
target credential" but never states which server-held identity issues EACH
read: does `agent.turn.get` run under a distinct agent identity (where is
that credential held, D-2/D-7-wise), or under the operator actor? Under
criterion (d) ("agent-identity refusal: presenting agent identity to the
operator surface is refused") the two identities must be *distinct and
demonstrably distinct*, otherwise the refusal criterion collapses into
tautology. This composition gap also makes the direct-API "no-credential
case" negative hard to operationalize. **Repair:** in handoff item 5,
state per-read identity: which server-held credential executes
`agent.turn.get` (agent-side identity, server-held) and which executes
`qlt.inspection` (operator actor), and require the refusal demonstration to
use the actual agent identity against the operator-authorized surface. See
also P-2.

**S-4 — "through the target's own authorization": proxy-through-Studio risk.**
Handoff item 2 says the reads go "through the target's own authorization
(its application-server/auth as-is). No mutation verb, no bypass," and the
frozen D-2 paragraph independently requires the target VICT command
boundary to authorize the mapped operator actor with "a Studio session
alone grants no VICT scope." Read together, a proxy of target calls through
Studio's own actor would violate both texts; the direct-API negative set
(unauthorized scope, no-credential case) gives falsifiable enforcement.
The wording is sufficient as written. **No finding**, but the repair to
S-3 should name the identity holder explicitly so "as-is" has a concrete
referent.

**S-5 — "No invented inspection data" is testable.** Criterion (f) carries
the falsifier "mutated/absent reads must render truthful banners"; item 4
restricts rendering to "ONLY returned projections"; item 2 forbids fallback
that fabricates. Verifiable as written. **No finding.**

**S-6 — Target isolation is concrete.** Item 7 ("cross-target requests fail
closed; a target mismatch is refused, not re-routed"), direct-API negative
"cross-target isolation attempt", criterion (j), and the G2-era
fail-closed precedence (8196d21) together make this verifiable. **No
finding.**

---

## PRODUCT-BOUNDARY REVIEW

**P-1 (N) — "No Quellight-specific UI behavior" is directionally precise but lacks
a mechanical falsifier.** Item 6's "definition-driven... no
Quellight-specific UI behavior or branching beyond the declared binding"
and criterion (h) are checkable but only by reviewer judgment. **Repair
(suggest, non-blocking):** add a diff-scan falsifier to criterion (h): no
Quellight/`qlt`/product-specific literals in the product-view rendering
code (`apps/studio/src/routes/product/**`) outside the target-registry
binding and version/identity labeling paths.

**P-2 (M) — Agent-identity refusal claimed PROVABLE on 0.3.1 without a defined
fallback.** Proposal §0.1 lists "preservation of the agent-identity
refusal" under PROVABLE on the single-actor, hard-coded-grant 0.3.1 tree —
the same tree for which the *denial* criterion was honestly downgraded to
CONDITIONAL (§0.1 CONDITIONAL; handoff G3-C denial paragraph). The refusal
criterion faces an analogous mechanical question: does the 0.3.1 target
actually distinguish an agent identity from an operator identity on the
operator surface such that a refusal is demonstrable, or is the distinction
unavailable for the same configuration reasons? As written this is NOT a
contradiction (it may well be demonstrable), but the contract treats the
two sibling criteria asymmetrically with no stated fallback. **Repair:**
add a symmetric truthfulness clause to the handoff's agent-identity refusal
paragraph: "If the existing tree cannot demonstrate the refusal as
distinct identity behavior, the G3-C gate records NOT DEMONSTRATED (or the
OD-R4 increment path if it is what the refusal needs) rather than
simulating it client-side," and at G3-C verify the mechanical basis
first. This makes the §0.1 claim a to-verify expectation at G3-C, not an
unreviewed assumption.

**P-3 — Capability banner silence/degradation detectable.** Item 3 + criterion
(m) require the banner and forbid silent degrade; the falsifier set for
(f) covers banner rendering on absent/failed reads. Slightly under-specified
(see N-3), but detectable. **No finding.**

**P-4 — Same-turn panel forces both reads target-returned.** Item 4: BOTH
sides rendered, "using ONLY returned projections; absent/failed reads
render truthful banners" + criterion (b) "agent.turn.get + qlt.inspection
getTurn aligned on one turn". Sufficient. **No finding** (alignment
mechanism note in N-4).

---

## SCOPE / ORDER

**R-1 (M) — OD-R4 conditional trigger is not operationalized.** Handoff G3-C:
"If the existing tree (single local actor, hard-coded grant) cannot
demonstrate this, the OD-R4 path runs." WHO determines this and on WHAT
evidence is unstated. Left as written, the builder could self-certify the
trigger and walk into a Quellight repo change without independent
confirmation — exactly the pattern the stop conditions exist for. **Repair:**
in the G3-C denial paragraph, require: the G3-C builder attempts denial on
the existing governed surfaces and records the attempt logs; the fresh
independent verifier (or stage manager, with the verifier's confirmation)
reviews those logs; only a verifier-confirmed non-demonstrability
authored the OD-R4 increment proposal, which then needs Quellight-side
governance authorization AND owner sign-off before any Quellight edit.
(Note: proposal §3.2/§5 correctly require the increment to "originate and
be recorded under Quellight's own governance"; the handoff's conditional
paragraph omits that requirement — include it.)

**R-2 — No line touches greenfield or publication.** Standing prohibitions
(handoff §0), proposal STATUS and §6, and the G3-exit row
("publication only by a later explicit owner decision") are consistent; a
full-text scan found no line authorizing a greenfield edit, a publication,
or a product activation. OD-R5's planning annex is consistently
planning-only. **No finding.**

**R-3 — G3-A before G3-B.** Enforced in WP-G3-B's header ("after G3-A"),
proposal §4 sequencing, OD-R3, and criterion structure (G3-B uses "FT-1
navigation only"). **No finding.**

**R-4 — No contradiction with frozen records.** D-3 pilot binding is
explicitly the governing precedent (§0.1, item 1); D-8 IN is honored
(G3-C is the D-8 proof with its prerequisites honestly split into
provable/conditional/unproven); D-2/D-7 honored (item 5); B-1 honored
(FT-1 is the frozen D-1 disposition, executed as the named separately
gated increment — no island). **No finding.**

---

## LINEAGE

- Frozen G0–G2 records (`VICT-STAGE-09-G0*`, `G1*`, `G2*`) and
  `docs/architecture/*`: byte-untouched on this branch (verified by diff).
- STATE changes are additive only: one new dated G3-authorized section +
  the G3 gate row update (NOT AUTHORIZED → AUTHORIZED under recorded
  decisions). Gate-table conventions preserved.
- Superseded §3.3 lineage retained and marked; original recommendation
  text present unmodified.
- **L-1 (N):** the amended proposal retains the PRE-amendment H1 title
  ("PROPOSED... no implementation authorized") above the amended title
  (line ~1 vs ~3). This is lineage-stable but the dual title invites
  mis-citation; consider demoting the first title to a quoted lineage
  block like §3.3's marker during freeze editing (non-blocking; the
  STATUS block and §0 make the operative intent unambiguous).

---

## INTERNAL CONSISTENCY

**C-1 (M) — Post-amendment proposal body (§4, §5) is materially superseded but NOT marked.**
The proposal declares "superseded text below is marked, not deleted" — and
§3.3 is properly marked — but §4's G3-C row still reads "Quellight same-turn
proof — **only if Option 2** | Quellight governed adoption increment + ..." and
still says "G3-C runs in parallel ... once OD-1/OD-3 are decided," while §5's
OD-R1 still presents "bridge down / greenfield adoption (recommended) / hold"
as an OPEN decision and OD-R2 still frames 0.4-rc adoption as live. Under the
recorded OD-R1/R2, Option 2's adoption-fragment scope ("minimal proof-only
scope (adoption pin + second operator actor + ...)") is materially superseded:
the adoption pin is OUT; the increment is conditional (denial-path only) and
never an adoption. §4's "only if Option 2" now literally conflicts with §0's
recorded decision. **Repair:** mark the affected §4 row and the §5 OD-R1/OD-R2
decision paragraphs with explicit SUPERSEDED-BY-§0 markers (same pattern as
§3.3), so the operative decision lives in exactly one unambiguous place (§0 +
handoff) before freeze. This is the largest remaining ambiguity in the bytes.

**C-2 — STATE gate row vs proposal sequencing.** STATE row says "G3-A →
G3-B → G3-C per gate loops"; proposal §4 (superseded-era text) parallelizes
G3-C. With C-1 repaired, the STATE sequential reading is fine (G3-C's
Quellight-side conditional increment may overlap but its Studio-side claims
come last); note this at freeze. Folded into C-1.

**C-3 (N) — Ownership matrix exclusivity.** Exclusive paths cover all named
artifacts: G3-A (platform files + Studio definition + test), G3-B
(`apps/studio/src/routes/runs/**`, reads, journey), G3-C (transport +
registry entry + `routes/product/**`), integrator (STATE, seams, evidence),
verifiers (read-only). One soft seam: the Studio Application Definition
(`definition.ts`) is assigned to G3-A only, but G3-C item 1's target-registry
entry arguably is also a declaration-space change — it is correctly owned by
G3-C's lane and does not touch `definition.ts`, so no conflict exists today;
if G3-C ever needs a definition-side change, it goes to integration
reconciliation per §2's conflict rule. No repair required.

**C-4 — Evaluation criteria completeness.** Same-turn pairing (b), allow
(c), denial (e), refusal (d), safe projections/no invented data (f),
no browser-held credential (g), direct-API negatives (i), target isolation
(j), target/version evidence (k), old-target truthfulness (m) — all present
and each maps to a required demonstration. Complete modulo the M/N repairs
above.

---

## MISSING-BY-DIRECTIVE SCAN

- Evidence of actual target/version used: specified (handoff item 4, criterion (k)).
- Truthful old-target connection test: present (criterion (m) + §0.1 truthful-behavior clause; see N-3 for falsifier).
- Publication: correctly absent (OD-R5 boundary preserved).
- Quellight byte-untouched check: present (criterion (l) with verifier re-check mechanics).
- Owner-directive stop conditions: present verbatim in handoff §0.

**N-1 (N)** dual H1 title (see L-1). **N-2 (N)** — none. **N-3 (N):** add an
explicit falsifier to criterion (m): with the run.* reads removed/unavailable
on the target fixture, the banner must appear and no silent feature omission
may be detectable by comparison with the capability list. **N-4 (N):** the
"aligned on one turn" check (criterion (b)) should name the alignment
oracle — the turn identifier common to both returned records — so alignment
is verifiable from returned data rather than fixture assumption.

---

## VERDICT: **REVISION REQUIRED** (no blockers; freeze after the M repairs)

No security blocker was found: server-held-credentials, CSRF/Origin, target
isolation, fail-closed pin intent, and no-invented-data requirements are all
present and falsifiable. The required revisions are precision repairs
(M-1/S-2 pin oracle, M-2/S-3 read-identity composition, M-3/P-2 refusal
fallback, M-4/R-1 OD-R4 trigger operatorization, M-5/C-1 superseding marks),
after which the contract is FREEZE-READY. Lineage, scope prohibitions, and
frozen-record fidelity all PASS.

### Findings index

| ID | Sev | Location | Summary |
| --- | --- | --- | --- |
| M-1/S-2 | M | handoff WP-G3-C item 1; criteria (a)(k) | identity pin has no named verification oracle; add source + wrong-pin falsifier |
| M-2/S-3 | M | handoff WP-G3-C items 2/5; criteria (c)(d)(i) | per-read identity/credential composition unspecified (agent vs operator) |
| M-3/P-2 | M | proposal §0.1; handoff G3-C refusal criterion (d) | agent-identity refusal claimed provable on single-actor tree without the symmetric fallback §0.1 gives denial |
| M-4/R-1 | M | handoff G3-C denial demonstration; OD-R4 conditional | trigger "existing tree cannot demonstrate" has no named decider/evidence path; Quellight-own-governance requirement omitted from handoff conditional |
| M-5/C-1 | M | proposal §4 G3-C row ("only if Option 2"); §5 OD-R1/OD-R2 | materially superseded text unmarked, contradicting §0's recorded OD-R1/R2; mark like §3.3 |
| N-1/L-1 | N | proposal line 1 (pre-amendment H1) | dual title; demote to quoted lineage |
| N-3 | N | handoff criteria (m) | add banner falsifier (no silent feature omission) |
| N-4 | N | handoff criteria (b) | name the same-turn alignment oracle (shared turn id) |
| P-1 (opt) | N | handoff item 6; criterion (h) | optional diff-scan falsifier for Quellight-specific UI |

Signed: fresh independent reviewer (no Stage 9 authoring role), 2026-09-29.
Review-only: this branch adds this report and nothing else.