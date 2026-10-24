# Cycle 1.3 core — candidate and evidence

2026-10-24. **Implementation in progress; no final independent product verdict yet.**

Scope and criteria: [current architecture](CYCLE-1-3-CORE-AUTHORING.md). Full finding inventory: [crosswalk](CYCLE-1-3-CORE-FINDINGS.md). Required next UI round: [Cycle 1.4 handoff](CYCLE-1-4-HANDOFF.md) and [pinned catalog audit](CYCLE-1-4-CATALOG-AUDIT.json). Current branch is `codex/studio-cycle-1-3-core-authoring`, based exactly on `f95e2cbe80f7afd421f8224634ebc0cecd61c827`; main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Existing owner preview builds/tabs/source/provider configuration are preserved.

## Architecture gate

Initial design `bd9b75368f74697f40cf4616a3bc4d52e0387a7f` was independently **HELD** for registration/compatibility detail, semantic admission and visible Flow identity/lifecycle. Amended design `3f6a9182f706405679907be170ce921e8e2c21fc` independently **PASS — ready for bounded implementation**; report retained in evidence commit `18319838455fd0c71fc741a3a84c9bd3c4d57177`. [Full independent challenge and recheck](CYCLE-1-3-CORE-ARCHITECTURE-INDEPENDENT.md). No canonical blocker was identified. This is a design verdict, not an implementation or owner acceptance verdict.

## Builder observations before the first product candidate

- Root integration: six Studio files, **37/37 PASS**: core registered authoring, context admission, coverage, canonical agent edits, exact schema negatives and completion regressions. Command from `apps/studio`: `node ../../node_modules/vitest/vitest.mjs run tests/designer-core-authoring.test.ts tests/designer-context-placement.test.ts tests/designer-coverage.test.ts tests/designer-agent.test.ts tests/designer-schema-independent.test.ts tests/designer-agent-completion.test.ts --maxWorkers=1 --no-file-parallelism`.
- Earlier root run: 30 passed / seven failed. Five were existing diagnostic-code/message compatibility assertions; Studio now projects the same legacy context-refusal code while retaining the shared rule identity. Two were generated-key/count assumptions after package-owned seeds and eligible specialist compositions; tests now follow actual typed refs/outputs and package eligibility. No canonical or history assertion was removed. Another first integration fixture reused the baseline condition ID `compact`; the intended fresh condition uses `core-compact`, retaining duplicate-ID refusal.
- Specialist narrow real Svelte/DocumentHost tests demonstrate mounting, controlled AI input/send/stop, isolated Flow source targets, token cleanup and evaluated duplicate/endpoints refusal. These are Happy DOM tests, **not real-browser SVG geometry or provider evidence**. The builder retains exact command/results separately.
- Reliability checks use the real pinned offline engine plus explicit raster/transport simulations. They do not establish live-provider or actual browser recovery until the later candidate journeys.
- Shared neutral/editor/renderer builds and targeted registration/semantic/runtime tests are builder evidence. Historical pins and current live digests remain separate. New heading data h5/h6 extends the existing native semantic catalog; schema and existing identity behavior are unchanged.
- Retained warnings: existing renderer initial-plan capture, noninteractive span click accessibility notices and StateValuesPanel label association; no broad accessibility certification is claimed. Disk headroom checked before source isolation/build planning; no owner data/evidence cleanup.

Full Studio regressions, final types/build, actual provider/browser journeys, packed consumer and independent exact-candidate gate remain required. No recipe count, fixture, compilation or pushed builder source alone closes those criteria.
