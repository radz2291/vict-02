# Authoring Vict applications — vocabulary, check, and per-role examples

Everything an Application Definition may say is a **closed vocabulary**
enforced by `compileApplication` in `@victframework/application`. This
guide shows how to discover that vocabulary and check a definition
quickly — without writing a throwaway test or reading compiler internals.

## 1. Discover the legal vocabulary

```sh
vict vocabulary            # human summary: roles, kinds, tones, tokens…
vict vocabulary --json     # the full machine-readable descriptor
```

`--json` exposes, in one stable, sorted document:

- allowed **surface roles** (`@1` and `@2`) with the allowed **fields per
  role** (e.g. a `table` surface takes `viewId`, `queryActionId`,
  `rowAction`, `columns`, `searchFields`, `pageSize`, …);
- allowed **fields per definition object** (application, routes, screens,
  views, forms, actions, resources, theme, …; `…V2` entries are the `@2`
  extensions);
- **bindings**: action kinds and their per-kind fields, form-field
  widgets, sort directions, component `props`/`input` source kinds;
- **composition choices**: application/page composition, region
  presentation, screen layout modes, action-feedback outcomes;
- **closed values**: status tones, chart kinds, resource field types,
  theme token names, schema versions;
- every **diagnostic code** the compiler can emit.

The descriptor is **derived from the same constants the compiler
enforces** (`APPLICATION_VOCABULARY` in `@victframework/application`, the
composition/feedback tables in `@victframework/ui`, and the schema/token/
widget constants in `@victframework/sdk`). It is generated, not
hand-written, so it cannot drift from the validator. Programs can import
it directly: `describeApplicationVocabulary()`.

Three vocabulary facts worth calling out (all visible in the examples):

- the application-level `resources` member holds **references**
  (`{ resourceId, revision }`); the full resource definitions are passed
  alongside the application (the module's `resources` export);
- component surfaces/columns reference entries declared in the
  application's `components` member (`{ componentId, revision }`), and
  island `input` bindings are closed objects — exactly one of
  `{ param }`, `{ record }` or `{ view }`;
- a `status` surface declares a record `field` XOR a static `value`, with
  `tones` from the closed tone vocabulary.

## 2. Check a definition (no server, no test file)

```sh
vict check src/lib/application/definition.ts          # human diagnostics
vict check src/lib/application/definition.ts --json   # machine-readable
```

- The module must export the definition the way the generated host does:
  named `application` (+ optional `resources`, `contracts`,
  `capabilities`, `components`), or a `default` export that is the
  definition itself or `{ application, resources }`. Contracts and
  capabilities are reduced to the identity entries the compiler reads.
- **Exit codes**: `0` valid · `1` usage error (missing file, no
  recognizable export) · `4` invalid definition (structured diagnostics
  on stderr; with `--json`, a stable result object on stdout) · `5`
  unexpected execution error. Operator command codes (0/1/2/3) are
  unchanged and reserved.
- Diagnostics carry the compiler's stable **issue codes** and safe
  **paths** (`application.screens[s.tasks].surfaces[tb.tasks]`), and —
  where the vocabulary can speak — the **allowed values** (e.g. an
  unknown surface role lists the legal roles; an unknown field lists the
  legal fields; a bad sort direction lists `asc, desc`).
- Compilation **never executes author handlers** (no capability runs, no
  data access) and never touches a store: it is the same pure compiler
  the platform server uses at propose time.

### TypeScript workflow (smallest practical toolchain)

`vict check` loads `.ts`/`.mts` definitions through **Node's built-in
type stripping** — no tsconfig, no bundler, no ts-node:

1. Node **≥ 22.13** (the packages' `engines` floor). On 22.x the `vict`
   bin transparently re-execs itself with `--experimental-strip-types`;
   from Node 23.6 stripping is default-on.
2. Only **erasable TypeScript** is supported: type annotations,
   `interface`s, generics, and `satisfies` work; `enum`, `namespace`,
   decorators, and parameter properties do NOT (they are not erasable).
   The generated app definitions are erasable by design.
3. The definition's imports (`@victframework/sdk`, …) resolve from the
   app's own `node_modules` — the standard install provides them. A
   minimal fresh app needs only:
   `npm install @victframework/sdk @victframework/application @victframework/cli`
   (or the packed candidate tarballs) and one definition file.
4. `.js`/`.mjs` definitions are loaded directly; a `.json` definition is
   not accepted (definitions carry frozen structures produced by the
   `define*` helpers, which are code, not data).

Known limits of this workflow: the experimental type-stripping warning
appears on stderr on Node 22.x; erasable-only syntax as above; the CLI
and the definition must resolve the same `@victframework/*` package
copies (a standard npm layout always does).

## 3. Per-role examples (compile-checked in CI)

Each file below is a complete, standalone definition that compiles with
zero issues. `packages/application/test/authoring-examples.test.ts`
imports and compiles every one on every CI run, so the guide cannot
silently go stale. They document the **definition vocabulary** — the
41-family visual component catalog is a separate, rendered surface.

| Example | Shows |
| --- | --- |
| [table.ts](examples/table.ts) | table with **declared sort**, sortable columns, a **row action** (capability), a **component-island cell**, search fields, page size, query action |
| [form.ts](examples/form.ts) | create/edit forms, `select` widget with `options`, mutation actions with **declared feedback** |
| [dashboard.ts](examples/dashboard.ts) | **count** and **chart** surfaces over filtered/sorted views, empty state |
| [conversation.ts](examples/conversation.ts) | conversation surface with message/author fields and a governed send action |
| [detail-list.ts](examples/detail-list.ts) | `detail` and `list` surfaces bound to views |
| [component-island.ts](examples/component-island.ts) | component surfaces with static `props` and **context bindings** (`record:<field>`, `param:<name>`) |
| [overlays.ts](examples/overlays.ts) | **dialog** and **drawer** overlays with content surfaces |
| [regions-composition.ts](examples/regions-composition.ts) | **responsive regions**: split layout, region presentation, application/page composition, navigation collapse breakpoint |
| [navigation.ts](examples/navigation.ts) | nav labels/groups/order, parameter routes, breadcrumbs, an **@2 redirect route** |
| [states-conditions.ts](examples/states-conditions.ts) | screen **states** (loading/empty/failure/…), `status` surface tones, tabs, `visibleWhen`/`disabledWhen` conditions |

Check any of them directly:

```sh
vict check docs/authoring/examples/table.ts
```

## 4. Provenance and governance

Introduced by the authoring-tools slice on branch `pi/ui-authoring-tools-r1`
(candidate; nothing merged to `main`, nothing published). The `vict check`
and `vict vocabulary` commands are additive local commands of
`@victframework/cli`; all operator commands, their payloads, and their
exit codes are unchanged and remain covered by the real-HTTP CLI suite.
The compiler's validation behavior is unchanged: the vocabulary export and
the `ui` rule-table refactor reuse the very constants validation always
used.
