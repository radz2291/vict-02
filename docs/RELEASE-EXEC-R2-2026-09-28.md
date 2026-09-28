# Release execution record R2 — bootstrap + trust + evidence (2026-09-28)

> Companion to docs/RELEASE-DISPATCH-RUNBOOK-2026-09-28.md (steps A–C
> executed) and the owner authorization artifact. Publication (steps
> D–E) is dispatched after this record lands on main. G3 remains HELD.

## Owner authorization

The owner approved the one-time first-publication bootstrap in the
release-execution session (2026-09-28), verbatim: "My approval is
explicit: I authorize the one-time first-publication bootstrap for
exactly @victframework/ui and @victframework/ui-svelte at
0.0.0-bootstrap.1 under the bootstrap tag, as described in the prepared
authorization draft. I also want you to continue through the 0.4.0-rc.1
candidate release once every ratified gate passes." The approval (with
its stated constraints — no bypass token, no gate weakening, no
contract change, no reuse of the 13 historical relationships for the
new two, no credentials/2FA in chat) is recorded in the executed
authorization artifact committed alongside this record. No signature or
npm account identity was invented; the interactive publishes were
performed by the owner in their own authenticated session.

## Automation investigation (pre-interactive, per the owner's instruction)

No compliant no-2FA route exists. npm trusted publishing is a
per-package setting on an EXISTING package (the CLI `npm trust github`
E404s on absent packages), so the GitHub OIDC workflow cannot create
the two new names; and contract §16 (item 3) fixes the placeholder
publish mechanics to the historical local interactive-2FA path (§13
precedent), "never through the coordinated release engine". The
machine's stored GitHub credential (classic, scopes gist/repo/workflow)
was found suitable ONLY for workflow dispatch — it plays no part in npm
publishing. Conclusion: interactive npm 2FA is contract-mandated and
technically unavoidable; it was the only owner-interactive step.

## Executed (all times local, 2026-09-28)

1. Clean checkout of origin/main `6ada80a83f59a8b83a1723ffa1629930ed6f7017`
   (verified HEAD, clean tree). `verify-contract-authority` → AUTHORIZED.
   Dry plan: exactly `@victframework/ui`, `@victframework/ui-svelte`
   absent. `--inspect` (after the full workspace build — in a fresh
   clone the target workspaces' builds need their siblings' `dist/`
   type declarations): both placeholder artifacts complete and truthful
   (ui: 9,124 bytes / 10 files; ui-svelte: 55,582 bytes / 135 files),
   byte-identical to the reviewed worktree artifacts. Focused suite on
   the clean checkout + script patch: 232/232 (7 files).
2. Owner performed `npm login` + `first-publish-bootstrap --execute`:
   both placeholders published at `0.0.0-bootstrap.1` under the
   `bootstrap` tag through interactive WebAuthn 2FA (the §16 exception;
   §13 historical path). Registry-immutable.
3. `trust-bootstrap --execute`: configured + verified the 14 exact
   relationships (radz2291/vict-02 / release.yml / publish / no
   environment). The first run stopped fail-closed at
   `@victframework/scaffolder` when npm's five-minute 2FA grace
   expired; a later run found 13 already-exact, configured
   `@victframework/contracts` (which had not carried an exact
   relationship), and the registry end-state was verified exact for all
   14 through the evidence capture below. No conflicting relationship
   was ever mutated; no relationship was reused across packages.
4. `capture-trust-evidence` (schema v2): two captures failed partial —
   npm's ~5-minute web-auth grant expired mid-capture (9/14, then 11/14
   successful reads); the schema correctly records failed reads as
   `unverifiable` and the preflight refuses them. A final capture with
   all 14 successful reads is committed as the release evidence
   artifact (qa-artifacts/trust-evidence/0.4.0-rc.1-2026-09-28.json)
   and binds to `0.4.0-rc.1` +
   `v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399`
   inside the 24-hour freshness window.

## npm platform constraint discovered: `latest` cannot be deleted

The authorization draft promised "`latest` stays unoccupied" for the
two new packages. npm's registry REFUSES to delete the `latest`
dist-tag (authenticated `npm dist-tag rm <pkg> latest` → `400 Bad
Request` on DELETE .../dist-tags/latest, reproduced twice with a fresh
session + browser 2FA). `latest` is mandatory once a package exists and
was auto-initialized to the first published version. Recorded end-state
instead: `latest` pins `0.0.0-bootstrap.1` on the two new packages
(platform-forced), which remains harmless to every ratified rule — the
coordinated set publishes under `vict-0.4.0-rc` (never via `latest`),
the §6 coordinated version rule never reads `latest`, the placeholder
version shape can never satisfy the coordinated rule, and
`verify:release-set`/`verify:release-consumer` bind versions and
integrity, not tags. The commitment is amended BY THIS RECORD to "the
placeholder is never presented or consumed as a release through any
ratified path", and `first-publish-bootstrap.mjs` was patched to detect
and report the npm-auto-created tag honestly (removal attempted,
E400/EOTP surfaced fail-closed) instead of silently promising an
impossible end-state. No frozen contract text was changed.

## Tooling corrections (reviewed, tested)

Two operator-tooling patches, both proven against npm's tightened 2FA
policy (HTTP 401 → EOTP now gates even read-only `npm trust list`):

1. `scripts/first-publish-bootstrap.mjs` execute path now enforces the
   promised `latest` end-state explicitly after publishing (probe →
   attempt removal → fail-closed with the exact manual remedy if npm
   refuses or the 2FA grant is missing) — npm auto-creates `latest` on
   a package's first publish and then refuses to delete it (E400), so
   the tool must never promise that end-state silently.
2. `scripts/capture-trust-evidence.mjs` gained the same OTP-retry flow
   trust-bootstrap already used: on an EOTP challenge it re-runs THE
   SAME official command interactively (stdio inherited) so the
   operator completes the browser authentication, then repeats the
   captured read inside the grace window — the recorded output still
   comes from the script's own official-command spawn (schema,
   bindings, provenance unchanged). With this patch a full 14/14
   capture completes with the operator answering only the browser
   prompts the script itself raises (three were needed on 2026-09-28 —
   npm's five-minute grant expired twice mid-run and the retry
   recovered each time).

Focused suite green (232/232, 7 files) on both patches.
