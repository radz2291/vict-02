# Builder evidence provenance

Working branch: `codex/studio-cycle-1-1`; isolated worktree from
`d7401bef6e48330796c74ec00c86db9622d48cdf`. No owner acceptance is recorded here.

## Original candidate and retained red observations

Original product `9c3675c42fc28f719b7052932177eb8461db5a30`.
`check-results.json` describes that earlier run: Studio check/designer check/build
passed, full tests failed (128/129). A successful build alone did not establish
production runtime correctness. Independent report at `31a3a357c95ea9243be58341a44230b56a1e0d88`
found the production native-import failure and returned FAIL.

`cycle-build.log` retains the initial root ENOSPC build. `cycle-typecheck.log`
is the subsequent passing root typecheck; `cycle-lint.log` is the clean scoped
lint output. `agent-mastra*`, `seam-diagnostic.log`, and `repair-tests.log` retain
failed/intermediate diagnosis; do not infer a final verdict from filenames.
`repair-check.log` retains a caught typing failure; numbered later checks are
clean. `repair-tests-4.log` passed assertions but exposed roughly 76-second Stop
liveness and was superseded by the host-abort repair.

## Real provider browser evidence

The original candidate ran live with the owner-selected z.ai `glm-5.3-flash`.
`live-registration.jpg` shows the registration form and targeted email change;
`live-registration-targeted.json` is its canonical source read through Document
Source. `live-add-move.jpg` shows add/move, `live-saved-reopened.jpg` shows saved
reopen, and `live-stale-refused.jpg` shows refusal after a manual revision change.
These are builder development-server observations, not the repaired candidate's
independent production acceptance. Turn/profile IDs and exact steps are in the
[builder report](../CYCLE-1-1-REPORT.md).

## Repaired exact source

Product `8be9ce86dc981ae8c284b4f354a12a3afad8fc8e`.
`repair-tests-5.log`: 6/6 focused tests, including real existing Mastra composition
with explicitly offline models and provider seam probes; Stop observed 1.68s.
`studio-tests-repaired.log`: full pinned local Vitest 3.2.7 suite,22files/132tests
PASS (141.85s). `repair-check-4.log`, `repair-lint-final.log`: check/lint PASS.
These deterministic probes complement, and do not substitute for, live provider
proof.

`studio-build-repaired.log` is an INTERRUPTED build: stopped by the builder to
release disk/resources during independent verification. It is not a PASS.
Subsequent final production build/bundle evidence, when present, uses distinct
filenames. The independent report records its own separate checkout, exact
candidate, environmental retries, actual production runtime and live-provider
walkthrough. Historical observations remain retained rather than rewritten.

`production-build-8be.log`: subsequent repaired production adapter-node build
PASS. `client-boundary-8be.json`: static dependency/byte scan PASS, including
actual selected provider credential checked in memory (not recorded), no server
composition in all 45 client files, authoring excluded from saved-replay closure.
This is a static scan, not a browser network trace.

`production-targeted-8be.jpg`, `production-saved-8be.jpg`, and
`production-reopened-8be.jpg`: repaired production 5591 actual z.ai selected-field
edit, canonical Save, then full page reload. `production-saved-source-8be.json`
is the canonical source read through the UI. `production-source-diff-8be.json`
compares with the earlier captured registration: only revision and email
placeholder differ. VICT turn `turn-aee0f7f8-f7dd-4f5d-b469-5d03a4f0fa33`.

Stored builder logs normalize line endings, trailing spaces/tabs and empty final
lines only, so repository whitespace checks remain meaningful. Failure messages,
assertions and results are retained. Original/stored SHA-256 pairs and the exact
normalization method are recorded in `log-normalization.json`.
