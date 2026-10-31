# Independent public Graph3 admission finding

Exact integrated source `a6c7d30522f263f39e3f724bf5c15c08f111192d`, public
package candidate `0e73b1181e52e0233cf4cdfd2972d00258f9b208` (integrator
cherry-pick `73428d08`). Review checkout
`C:/Users/RZ1/.codex/worktrees/vict-edge-v3-independent-20261101`, branch
`codex/independent-edge-v3-20261101`. Reviewer did not author the public Flow
package change. The reviewer did author the separate Studio adapter; no
independent verdict on that adapter is supplied here.

**F-EDGE-01: public object admission can substitute unsafe data during cloning.**
Medium contract-admission finding; public package readiness is FAIL pending repair.

`validateGraphV3` and `parseGraphOperationsV3` inspect finite plain-data shape,
then clone via `JSON.parse(JSON.stringify(value))`. A Proxy with ordinary own
descriptors can supply a virtual `toJSON` method through its get trap. The shape
check sees a valid graph or width operation; cloning calls that method, which
substitutes `edgeDefaults.color` or operation appearance color with a forbidden
`url(https://attacker.invalid/...)` value. Both APIs return `ok:true`.

`apps/studio/tests/independent-public-graph-v3.test.ts` contains independent
reproductions. `public-model-initial.log`:2 failed /2 passed. No source repair was
made. This is an object-API/canonical-data contract violation, not a demonstrated
Studio JSON transport, provider, credential or private execution bypass. The test
uses static strings only and makes no external request. Shape validation and
snapshot cloning must operate on the same owned passive data rather than invoking
caller-controlled JSON hooks after admission; the integrator assigns repair.

Normal installed package resolution is used without source aliases. Fresh
`npm ci --ignore-scripts --no-audit --no-fund` installed718 dependencies.573
unchanged dependency dist files were copied into this checkout and SHA256 checked
against the retained builder artifact manifest after comparing complete package
source trees (`a8a1acfc` versus `a6c7d305`, equal). This is reused dependency build
output, not an independent clean dependency build. Flow's documented public entry
exports `src/index.ts`; it has no dist entry and resolves within this review
checkout. Further independent reducer/scoped-control challenges are in progress.

No root mutation, owner-data change, browser/provider call, service activation,
push, main merge, publication or owner acceptance occurred.
