# G1 integration + browser journey plan (stage manager)

Branch to integrate into: `codex/stage9-g1-foundation` (worktree
`C:/Users/RZ1/Desktop/RZ/vict-02-g1`). Builder branches:
`codex/stage9-g1-studio-server` (worktree -a), `codex/stage9-g1-studio-app`
(worktree -b). Interface base: `fd2f57d`.

## Integration sequence

1. Read both builder reports (`qa-artifacts/stage9-g1/*-report.md`) + SHAs.
2. `git merge codex/stage9-g1-studio-server` then
   `git merge codex/stage9-g1-studio-app` (no overlaps expected; conflicts =
   interface violation → reconcile in favor of the agreed contract).
3. Full gates in the integration worktree:
   `npm run build` · `npm run check -w vict-studio` · `npm run test -w vict-studio`
   · `npm run lint` · `npm run format:check` ·
   `node scripts/verify-stage9-inventory.mjs` ·
   `npx vitest run --project unit packages/server` · full
   `npx vitest run --project unit` (report N/(N+1) with FT-4 visible).
4. Fix integration defects directly (integrator role); builder defects go
   back to the owning track for repair.

## Journey tooling

- Terminal A: `node apps/studio/scripts/demo-target.mjs` (target on
  127.0.0.1:4310, actors `actor-studio-operator` [no run.detail] and
  `actor-studio-detail` [+run.detail], seeded completed + failed/blocked run
  with events, waits, full-retention output).
- Terminal B: `npm run dev -w vict-studio` (Studio on :5173).
- Browser (browser-tools skill): login (operator/studio-local-pass) →
  dashboard (connection states incl. absent/unreachable/rejected targets
  via registry entries) → /runs list (NO row links; FT-1 text) →
  /runs/:failedRunId (summary + events + waits) → /activations,
  /releases, /audit. Keyboard tab-through; responsive ~390px + ~1280px.
  Screenshots → qa-artifacts/stage9-g1/shots/.

## Direct-API negatives (curl, no browser)

- No session: GET / → 303 /login; JSON GET /runs via fetch w/o cookie → 401.
- Bad CSRF: POST JSON without/with wrong x-vict-csrf → 403.
- Origin missing/foreign → 403.
- Protected detail (D-5): direct call to target /vict/v1/runs/:id/detail
  with operator token → 403 VICT_ACTOR_SCOPE_DENIED; with detail token → 200
  protectedAvailable:true + output bytes; then audit.search shows
  run.detail.accessed with actor + timestamp; summary-retention run →
  protectedAvailable:false truthfully.
- Leakage canary: string-scan ALL browser-bound bytes (HTML, JSON, hydration)
  for target token + human secret → zero hits.

## Evidence record (docs/governance/VICT-STAGE-09-G1-EVIDENCE-2026-09-29.md)

Candidate SHAs (checkpoint → amendment → scaffold → integrated), verifier
report SHA, criterion matrix (a-d + D-2/D-5/D-6/D-7 slices), FT-4
classification ref, journey proof list, failures kept.
