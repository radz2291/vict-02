# Scoped graph ownership baseline reproduction

Source under test: exact graph-authoring.ts bytes copied from 4c40cc656328c50d16d28492ae5245bf509ccb6e before changes. No owner application or storage was touched. Fixture: existing nestedCompositionDocument plus same-name lexical-binding challenge.

Command (Studio directory): node node_modules/vitest/vitest.mjs run tests/baseline-graph-ownership.test.ts

Observed 2026-10-30: 3 tests, 3 failed, exit 1.

- Nested keys: expected ['graph']; received ['graph','innerGraph'].
- Exact Designer synchronization loop: TypeError: Cannot read properties of undefined (reading 'initial').
- Controlled scoped graph bound to state.graph with document state of same name: node-only patch unexpectedly succeeded and selected document source. Expected refusal; received true.

The temporary baseline module/test are removed after observation; permanent graph-scoped-ownership.test.ts retains regression cases. The first attempt to start this test while npm installation was incomplete failed because the vitest command shim was unavailable. Direct runner then failed collecting because UI dist was not built. Neither environmental run collected tests or counts as behavior proof. After the normal package build, the three baseline assertions above executed and failed.

This is independent reproduction of the reported mismatch, not an independent verdict on the eventual repair. Studio bridge integration and exact-candidate verification remain required.
