# VICT Stage 8 — Implementation Report (2026-09-26)

> Handoff-named deliverable (Stage 8 handoff, WP-8). Created once; this file
> is not edited afterward. Status claims below are implementation/evidence
> status only. **Stage 8 and every BLD requirement remain NOT Verified**;
> requirement maturity cells change only at §27.4, post-audit. No exit-gate
> satisfaction is declared by this report.

## 1. Objective and contract

Stage 8 delivered the Vict Builder Kit and proved it by self-hosting (P1)
and by a greenfield external application (P2), under the ratified and
frozen architecture `STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md` (raw-byte
SHA-256 `ba3fde1b…`, ratified G0 2026-09-24) and the Stage 8 handoff
(raw-byte SHA-256 `4aa83c15…`). Dispositions D-1′ (consumption medium),
D-2 (P1 host pairing, re-recorded 2026-09-26 as Pi plus Codex), D-3 (kit
distribution as an integrity-recorded local artifact), D-4 (generated
artifacts at rest), and D-5 (MSTR-012 reconciliation) were applied as
recorded.

## 2. What was delivered, by work package

- **WP-1 — `@victframework/builder-kit` (new package, v0.1.0, NOT a
  release-set member):** canonical JSON + pack identity rule;
  closed-vocabulary validators and JSON Schema for all `vict.builder.*`
  documents; deterministic base-pack/task-pack/app-pack generators and
  renderers; capability-catalog generation with the static
  fail-closed completeness scan (`catalog-unresolved`); typed repository
  tools behind default-deny profiles (`builder.read`, `builder.change`,
  `builder.selfhost`; `git.push` and all escalation shapes absent);
  `verify:builder-kit` freshness gate with per-class drift reasons and
  baseline comparison; external-app bootstrap (`init-app`) with
  content-addressed input provenance and the app-level gate
  (`verify --app`: schema, identity, bootstrap binding, input provenance,
  release-set identity).
- **WP-2 — VICT self-hosting wiring:** committed stable layer
  (`BUILDER-KIT.md`, base pack, capability catalog) with
  regenerate-and-compare (`kit:generate` / `verify:builder-kit`);
  accepted-task-scope record; tool wrapper enforcing profile + task-pack
  authority (wrapper refusals recorded).
- **WP-3 — permission profiles and control tools:** delivered per kit
  data (`tools.json`, `profiles.json`); escalation-shaped requests are
  stop conditions; publication/production/approval/role/secret authority
  absent from every profile.
- **WP-4 — gate and permanent negative controls:** pack determinism and
  identity-exclusion; per-class freshness drifts; schema rejection;
  profile enforcement; escalation shapes; secret canaries; baseline
  escape detection — permanent tests in the kit package and its gate.
- **WP-5 — documentation:** `BUILDER-KIT.md` protocol surface; kit README
  (bootstrap, task-pack authority, external-app bootstrap, authority
  boundary); governance records under `docs/governance/`.
- **WP-6 — Proof P1 (gate G2):** self-hosting equivalence exercised by
  multiple hosts on the byte-pinned card (`d6a40c2e…`). Two independent
  pi sessions (process repeatability: `p1/host-a` integrated, `p1/host-b`
  preserved) and one distinct-host Codex result
  (`codex/stage8-p1-builder-proof-20260926`, **unselected and unmerged**),
  evaluated in `VICT-STAGE-08-G2-P1-CODEX-COMPARISON-2026-09-26.md` and
  ratified evidence-complete by the owner (G2 disposition, 2026-09-26).
  Neither host is credited with the later pack-installation correction on
  `main`.
- **WP-7 — Proof P2 (gate G3):** greenfield "TaskLedger" from an empty
  project by a genuinely fresh isolated builder session; consumption per
  D-1′ (13 published `0.3.1` packages from the registry with lockfile
  integrity + the kit as a SHA-256-recorded local artifact; no
  publication). Brief and rubric byte-pinned separately
  (`046558c9…` / `b7531d5b…`). Evidence:
  `VICT-STAGE-08-G3-P2-EVIDENCE-2026-09-26.md`. Evaluator score: **7 of 8
  rubric criteria PASS (one with caveat); F3 FAIL** — single root defect
  (`PriorityBadge` import missing in the delivered table island; table
  never mounts in a real browser) plus a narrow-width sort-control gap.
  Governed durable action, contracts, persistence, kill/restart
  durability, and application-identity stability all verified.
- **WP-8 — this report.** Documentation reconciliation beyond this report
  (dated status notes for reference §23/§24) is deferred to the audit /
  closure step with the owner.

## 3. Verification ladder status at report time

- VICT monorepo (P2 worktree at `15e3bed` + kit sources): format/lint/
  typecheck/test/build and stages 5–7a ladders green in the recorded P1
  runs; `verify:builder-kit` **18/18**; `verify:release-set` **13 packages,
  0.3.1, `v1_1c695280d3afec5…`** (frozen set unchanged).
- P2 application: `verify --app` **5/5**; build exit 0; tests **33/33**;
  governed-action negative probes (`CONTRACT_REJECTED`,
  `TASK_NOT_FOUND`, `ALREADY_COMPLETE`); durable run ledger observed
  (activation-pinned run + 4 events); kill/restart state identity
  (digest `1d6d5cad…`); `applicationVersion v1_bc4389e0…` stable across
  content-identical rebuild; app-level negative controls
  (content-drift, pack-tamper) red→green as designed.

## 4. Known debt and open items (truthful, none masking)

1. **P2-DEFECT-1 (builder-side):** table island client crash (missing
   `PriorityBadge` import) — F3 FAIL as delivered; one-line root cause;
   fix decision belongs to the owner (bounded fix round vs accept-as-is).
2. Narrow-width sort controls hidden in the delivered table island
   (independent UX gap ≤640px).
3. Environment: npm arborist crash on this machine during plain
   `npm install` (worked around with `--legacy-peer-deps`; not a platform
   defect); an external process killer interrupted builder sessions
   (recorded; sessions resumed from persisted transcripts).
4. App-local base pack carries the provisional app identity from
   init-app time (no gate check; no authority impact).
5. Builder-side claims ("rendered rows in the built pages") were
   SSR/curl-based and are contradicted by the real-browser record for the
   client-rendered table — recorded in the P2 evidence record.

## 5. Standing boundaries

No release publication (release set unchanged at 0.3.1; the kit remains a
local artifact per D-3); no production activation; no Quellight access;
no product-agent surfaces; no gate weakening; no modification of existing
`docs/report/` evidence (this file created once per the handoff-named
exception); `.pi/` never read or written. **Explicit stop point: end of
WP-8 / G3 evidence package — before any owner closure decision, before
any independent-audit verdict, and before any Stage 9 work.**
