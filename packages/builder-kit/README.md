# @victframework/builder-kit

The Vict Builder Kit: the host-neutral protocol artifacts a fresh builder
(agent host or human) bootstraps from — generated context and task packs,
the capability catalog, typed repository tools behind default-deny
permission profiles, versioned schemas, and the `verify:builder-kit`
freshness gate.

Stage 08 deliverable. Authoritative specification:
`docs/architecture/STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md` (RATIFIED AND
FROZEN). This package is NOT a member of the current coordinated release
set (publication deferred, architecture D-3); it is distributed as an
integrity-recorded local artifact.

## Contents

- `src/canonical.ts` — canonical JSON serialization (key-sorted,
  prettier-parity, byte-stable) and the pack identity rule:
  `packId = SHA-256(canonical bytes with packId omitted)`.
- `src/validate/` — closed-vocabulary validators for
  `vict.builder.context-pack@1`, `vict.builder.task-pack@1`,
  `vict.builder.catalog@1`, `vict.builder.tools@1`,
  `vict.builder.profile@1`, `vict.builder.handoff@1`,
  `vict.builder.result@1`, `vict.builder.audit@1`.
- `schemas/*.schema.json` — the corresponding JSON Schema (draft
  2020-12) documents shipped with the package.
- `src/catalog/` — capability-catalog generation: an isolated,
  credential-free child process imports first-party pack modules and
  serializes their frozen declarative manifests (handlers never invoked,
  bodies never serialized); a static TypeScript-compiler scan (parsing
  only) proves enumeration completeness and fails closed with
  `catalog-unresolved` on anything it cannot resolve.
- `src/generate/` — the deterministic base-pack/task-pack generators and
  the `BUILDER-KIT.md` / `PACK.md` renderers.
- `src/runtime/` — the typed repository tools and the profile-enforcing
  wrapper (`fs.read`, `fs.write`, `shell.run`, `git.status|diff|log`,
  `git.commit`, `kit.verify|validate|generate`); `git.push` and all
  control/activation/publish shapes are absent; refusals are recorded as
  structured denial events.
- `src/verify/` — the freshness gate: regenerate-and-compare for both
  layers, identity recomputation with the §3.3 exclusions, catalog
  completeness/dangling checks, schema validation, canary hygiene, and the
  baseline comparison (committed, renamed, and untracked changes versus
  the task pack's pinned `baseTree` through the ignore manifest).
- `data/tools.json`, `data/profiles.json` — the `vict.builder.tools@1`
  manifest and the three default-deny profiles (`builder.read`,
  `builder.change`, `builder.selfhost`).

## CLI

```text
vict-builder-kit generate     regenerate the committed stable layer
vict-builder-kit catalog      regenerate the capability catalog
vict-builder-kit verify       run the freshness/identity/completeness gate
vict-builder-kit verify --app [--app-dir <dir>]  run the app-level freshness gate
vict-builder-kit validate <file>...
vict-builder-kit run --profile <name> --tool <tool> [--task-pack <file>] [--arg k=v ...]
vict-builder-kit task-pack --handoff <path> --base-tree <sha> --in-scope <glob> [--ignore <glob>] [--profile <name>]
vict-builder-kit init-app --app-dir <dir> --release-set <id> --kit-artifact <spec> --kit-sha256 <hex> --input <path> [--input <path> ...]
```

In the VICT workspace the npm scripts (`kit:generate`, `verify:builder-kit`)
run the CLI from source via tsx. The `bin` shim runs the built `dist`.

## External-app bootstrap (handoff WP-1)

`init-app` generates `BUILDER-KIT.md` plus the app-local base pack
(`docs/builder-kit/base-pack.json`, `vict.builder.app-pack@1`) into an
external application project: the app identity and every `--input` path are
recorded as content-addressed provenance, together with the consumed
platform release set and the kit artifact identity (D-1′). The generated
bootstrap carries the pack identity and mandates `verify --app` before
work; a red gate is a stop condition. `verify --app` checks the pack
schema, the canonical identity rule (packId over canonical bytes with
packId omitted), the bootstrap↔pack binding, per-input content drift /
unregistered inputs, and — once platform packages are installed — the
installed `@victframework/*` versions against the recorded release set
(the kit itself is a tool, not a platform member, and is excluded). The
path is checkout-independent: install the packed kit artifact into the
app and run it from there.

## Authority boundary

The kit supplies documents, typed tools, schemas, and verification — never
an agent loop or model calls. Builder repository access never implies
production activation, release publication, approval, secret, or role
authority. Product Agents receive no kit, no repository tools, and no
builder profiles on any path.
