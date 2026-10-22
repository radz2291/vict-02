# Independent original-candidate assessment — FAIL

Product candidate: `9c3675c42fc28f719b7052932177eb8461db5a30`, remotely
equal to `codex/studio-cycle-1-1` before checkout. Baseline `origin/main`
remained `d7401bef6e48330796c74ec00c86db9622d48cdf`; authority
`f2492507ef298827324d5684da2660c26d973a75`.

The independent verifier created a new checkout and branch
`codex/studio-cycle-1-1-verification`. No product repair was made. Dependencies
were reused through junctions from the builder checkout; framework source bytes
are unchanged. Studio source, build outputs and browser origin are independent.
No owner-origin storage or servers were reset. Production used `127.0.0.1:5592`.

## Blocking finding V-1: final production bundle cannot load the agent route

Own `npm run build -w vict-studio` completed successfully. Serving that output
with adapter-node and `ORIGIN=http://127.0.0.1:5592` produced HTTP 500 for both
authenticated and unauthenticated `GET /api/designer-agent`. Browser login and
Designer worked, but chat showed `Agent connection unavailable`.

The server reported:

```text
Error: Could not dynamically require "@libsql/win32-x64-msvc".
Please configure the dynamicRequireTargets or/and ignoreDynamicRequires
option of @rollup/plugin-commonjs appropriately for this require call to work.
```

The stack's `commonjsRequire → requireNative → requireLibsql` occurred inside
the generated `build/server/chunks/designer-agent-http-*.js`. Vite inlines the
linked workspace Mastra package into SSR output, leaving `@mastra/*` imports.
Adapter-node then bundles transitive dependencies not declared as production
dependencies of Studio, including the native loader. The builder confirmed the
diagnosis and owns the bounded repair. [HTTP results](original-http-boundary.json),
[browser observations](inspect-browser.json), [screenshot](inspect-initial.png).

## Other evidence and retained observations

- Source review: canonical transactions, synchronous browser compare/validate/apply,
  same EditorBridge, exact quiet-write capability policy, cookie-derived actor,
  route-local content-type/CSRF guards, bounded requests/streams and ephemeral
  per-turn operational/Mastra storage are present.
- `npm run check -w vict-studio` passed. The first full suite passed 129/129 using
  root Vitest 4.1.11 because only root dependencies had initially been linked.
  This is supplementary evidence, not the authoritative Studio-local 3.2.7
  runner. Studio-local dependency junctions were subsequently added while keeping
  verifier-owned caches; the repaired candidate must run with the intended runner.
- Four independently authored editing probes passed: mismatch/draft/replay refusal,
  invalid second-operation atomicity, undo/reopen ABA protection, executable
  attribute/prototype-key/unknown-command rejection. [Final probe log](independent-probes-fixed.log).
- Retained verifier harness mistakes: the first npm exec invocation parsed
  `--config` incorrectly; the next probe attempted to add an already existing
  heading during its reopen test. The helper was corrected to modify the existing
  heading. Both failed logs remain. These are harness errors, not product findings.
- The builder separately observed an intermittent provider rejection hang after
  an acknowledged effect. That failed observation is retained by the builder;
  this verifier's initial full run did not reproduce it. It still requires the
  builder's proposed repair and independent recheck.
- Live-provider acceptance was intentionally held after the builder superseded
  this candidate. No real-provider PASS is inferred from deterministic fixtures.

Next allowed action: bounded builder repair, push an exact new candidate and
independently reverify. This report grants no owner acceptance, main integration,
Stage 9 closure or Cycle 1.2 authority.
