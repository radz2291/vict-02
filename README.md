# Vict

An agent-native application operating layer. Important application behaviour is
represented as an explicit, inspectable graph that can eventually be versioned
and safely changed by humans and agents together.

This repository is the greenfield Night 01 kernel:

- `packages/contracts` — executable input/output promises
- `packages/kernel` — pure graph compilation and execution semantics
- `packages/runtime` — stateful composition: capabilities, policy, traces
- `packages/sdk` — the public authoring facade
- `examples/ara-proof` — deterministic, offline ARA conversation proof

## Quick start

```bash
npm install
npm test        # 69 deterministic, offline tests
npm run example # run the ARA proof
npm run bench   # execution benchmark
```

## Documentation

- `docs/architecture/NIGHT-01-FOUNDATION.md` — what was built and why
- `docs/nightly/VICT-NIGHT-01-REPORT.md` — Night 01 evidence report
