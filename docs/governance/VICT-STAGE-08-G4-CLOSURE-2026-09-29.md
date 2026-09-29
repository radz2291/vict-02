# Stage 8 — Owner Formal Closure Record (2026-09-29)

> **Document type:** dated owner decision record — the formal closure of
> VICT Stage 8 ("Builder Kit and self-hosting") under reference §27.4 and
> the frozen gate ladder (architecture §5.1: "G4 … audit record; only the
> owner may close Stage 8"). Filed in `docs/governance/` per the
> Stage 8 workstream's established, owner-directed evidence location.
> **Frozen bytes are untouched**: the ratified architecture
> (`ba3fde1b…`), the ratified handoff (`4aa83c15…`), the historical
> `0.3.1` P2/P2B proof chain, all G3 evidence, and the G4 audit record are
> preserved unchanged; this record and the reference registration
> (v0.4.33, §0.39) are the dated amendment/disposition instruments.

## 1. The decision (owner, 2026-09-29)

The owner has reviewed the independent G4 audit at `c939df5`
(`docs/governance/VICT-STAGE-08-G4-INDEPENDENT-AUDIT-2026-09-29.md`,
audited tip `e1bddf2`, pushed and verified `origin/main == c939df5…`)
and **accepts the audit and its recommendation**. Per reference §22.3
("Only PASS, or an explicit owner decision accepting listed issues,
permits the next stage"), this is that explicit owner decision:

> **VICT Stage 8 is FORMALLY CLOSED as PASS WITH ISSUES.** The stage
> objective stands on evidence the independent auditor reproduced at
> every material point; the named issues below are accepted by the
> owner and remain attached to the closed stage until their scheduled
> follow-ups land. This closure is subject to the exact findings and
> limits in the G4 audit record, which are adopted without amendment.

- **Audit:** independent G4, verdict **PASS WITH ISSUES**, at `c939df5`
  (audited tip `e1bddf2`; frozen architecture `ba3fde1b…` and handoff
  `4aa83c15…` byte-verified by the auditor).
- **Dispositions cited:** D-6 and D-7 owner decisions of 2026-09-29
  (`docs/governance/VICT-STAGE-08-G3-OWNER-DISPOSITION-F6-EXCEPTION-2026-09-29.md`),
  the version disposition
  (`VICT-STAGE-08-G3-VERSION-DISPOSITION-2026-09-29.md`), the F6
  reconciliation, and the final G3 handoff.

## 2. Issues explicitly retained at closure (owner's words, recorded)

1. **F6 clause B remains a literal FAIL.** The owner accepts the
   navigation-only Edit-link island (`cmp.task-edit-link@1`) as the
   **bounded D-6 exception for this proof** — row navigation only; owns
   no task data; owns no governed action — exactly as bounded in the D-6
   disposition. The literal clause-B result is **not relabeled**. A
   **definition-driven table-cell link** (`columns[].link` or
   `rowNavigation`, per the F6 reconciliation §6 options) is **scheduled
   on the future formal UI track** (register item FT-1). No UI patch and
   no new release in the closed Stage 8 workstream.
2. **The missing last-14-days chart window remains an unmet part of the
   TaskLedger brief under D-7.** The built-in chart surface has no
   windowing field (verified by the auditor in the shipped grammar); the
   reconciled app charts the whole declared view and drops the window
   qualifier. **The TaskLedger brief is NOT recorded as fully
   satisfied.** **Chart windowing is scheduled on that track** (register
   item FT-2), together with the legacy pre-`count` row backfill
   decision.
3. **The single Builder Kit devDependency line is acknowledged.** The
   owner acknowledges the one added line
   (`@victframework/builder-kit` as a `file:` devDependency in the
   generated `package.json`); the auditor confirmed all 13 functional
   generated host files **byte-identical** to a fresh
   published-scaffolder build. F6 clause C stands as recorded: PASS on
   substance, one recorded tool addition.
4. **Audit findings carried as scheduled follow-ups:** **F-A and F-B**
   to tooling and release-test hygiene (register items FT-3, FT-4);
   **F-D** to the platform track (register item FT-5). **F-C is recorded
   as the observed worker-teardown/environment event** (a vitest worker
   crashed during teardown *after* all 2733 tests had passed; no code
   defect; register observation OBS-1, no action scheduled).
5. **The G4 verification ladder is recorded at its actual result: 11/13
   exit-zero on its first sequential run** (run A, 2026-09-29;
   `format:check`, `lint`, `typecheck`, both builds, `stage6a/6b/7a`,
   `release-set`, `clean-clone`, `builder-kit` exit 0; `npm test` and
   `verify:stage5` exit 1 with the environmental causes the auditor
   diagnosed and resolved in isolated/quiet reruns: 65/65 and 2733/2733
   respectively). **This is not rewritten as 13/13.** The substantive
   verification state of the audited tip was established green by the
   auditor's recorded reruns and isolated reproductions.

## 3. Requirement and stage status updates (evidence-bounded, §27.4.3–4)

- **Stage 8 (§23 table):** **Verified with non-blocking issues —
  FORMALLY CLOSED (2026-09-29; v0.4.33, §0.39).** Gate ladder record:
  G0 (owner ratification, v0.4.32) → G1 (kit implemented; corrective
  passes; ladders green — implementer records) → G2/P1 (two-pi
  process-repeatability + Codex distinct-host result; host-a
  integrated `5ceb557`; host-b and Codex preserved unmerged) →
  G3/P2 (frozen `0.3.1` proof preserved as history; owner version
  disposition selected the published `0.4.0-rc.1` set; fresh builder
  session `c6bb365`; reconciliation `0e6735a`; identity
  `v1_ecb2b4e7…`) → G4 (independent audit `c939df5`,
  PASS WITH ISSUES) → **this closure**.
- **BLD family (frozen architecture §6 — delivery statuses recorded here
  and in §0.39; the frozen table is not edited):**
  - **Verified:** BLD-002, BLD-003, BLD-004, BLD-005, BLD-006, BLD-008,
    BLD-009, BLD-010, BLD-011, BLD-013 — evidenced by the G4
    reproductions (provenance + deterministic regeneration zero-churn;
    fail-closed classes incl. a live `content-drift` catch on real byte
    drift and tested `pack-tamper`/`catalog-drift`/`baseline-escape`/
    `release-identity-drift`; validated results with observed counts;
    default-deny profiles and stop conditions; self-hosting P1;
    greenfield P2; the same-commit regeneration gate exercised by
    `fa8937c`; catalog generated from typed declarations). BLD-010's
    accepted R-3 boundary (host-mediated out-of-scope writes are
    detectable, not preventable) is unchanged.
  - **Verified with recorded qualification:** BLD-001 — bootstrappable
    from the same repository artifacts with no host-specific
    load-bearing configuration was exercised by **two distinct hosts
    (Pi, Codex)**; the Claude Code and human paths were not exercised
    in Stage 8 (ratified hosts unavailable; owner-authorized
    substitution). No host-onboarding work is scheduled by this
    closure.
  - **Not exercised (no conformance claim):** BLD-012 — no MCP surface
    shipped in Stage 8; the invariant stands untested and the protocol
    is complete without MCP by construction.
- **Kit prerelease correction (`5a82273` + `fa8937c`):** closed as
  mainline, regression-tested (4/4), artifact-reproduced
  (`fa7cea37…`) — the G1-era snapshot-corrected artifact (`9d20e1c7…`)
  remains the historical, honestly-labeled interim.

## 4. Release-set boundary confirmed (D-3 unchanged)

- `@victframework/builder-kit` is **NOT PUBLISHED**: registry lookup
  returns 404 (checked by the auditor at closure, 2026-09-29).
- The published coordinated set remains exactly
  `vict-release-set@1/0.4.0-rc.1` — **14 members, contentId
  `v1_2a70a29a…` — with the Builder Kit outside it**;
  `verify:release-set` green at the audited tip ("14 packages,
  0.4.0-rc.1"). The kit remains a **local, integrity-recorded artifact**
  per D-1′/D-3; its inclusion in any future release set is a separate,
  owner-authorized action.

## 5. Non-authorization

This closure authorizes **no package publication, no dist-tag movement,
no production activation, no Quellight change, and no automatic Stage 9
start.** Stages 9–11 remain outside all authorization; the next VICT or
Quellight increment requires a fresh owner planning decision (and, for
VICT, its own entry-contract ratification per the established pattern).
The G3 gate remains closed behind this record exactly as the ladder
defines: no proof, release, or activation work flows from closure.

## 6. Preservation statement

Byte-for-byte unchanged and authoritative:
`docs/architecture/STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md`
(`ba3fde1b…`), `docs/handoff/VICT-STAGE-08-BUILDER-KIT-HANDOFF.md`
(`4aa83c15…`), the entire `0.3.1` P2/P2B proof chain and the D-1′ pin,
all G3 records including the first-session result, correction history,
and every failed observation, the D-6/D-7 disposition records, and the
G4 audit record itself (filed at `c939df5`, not edited by this
closure). Corrections to this record, if ever needed, follow the
established discipline: new dated records, never edits.

**Stage 8 is formally closed. The issues are retained.**
