# Remaining authored AI presentation quotas — 2026-10-31 follow-up

The final action-pattern wording scan found active parser truncation, not merely
stale prose. Under the owner's explicit removal of similar artificial limits,
this follow-up removes those remaining authored presentation quotas consistently.
No provider, action, approval, restore, filesystem or workflow authority changes.

Removed:

- `actionText`'s silent 16,000-character slice.
- Supplied model-selector JSON's 65,536-character ceiling, 100-model/30-effort
  counts and ID/label/group length ceilings.
- Passive public pattern JSON's 131,072-character ceiling, 16,000-character
  string ceiling and 100-record array ceiling.
- File-tree depth 12 and total 500-node ceilings. File validation is iterative,
  preserving global path uniqueness without relying on a recursive policy bound.
- Stale quota wording in action/passive descriptors and host-data disposition.

Semantic checks remain: exact version-1 and pattern-specific fields, known
roles/states, string/boolean/numeric types, finite nonnegative domain metrics,
safe-integer exit codes, nonempty/unique identities and globally unique file
paths. Unknown/private-reasoning fields still refuse. Confirmation's existing
state mapping and action availability defaults remain unchanged. No source
coercion, automatic migration or saved-data reinterpretation is introduced.

Only descriptive compatibility digests changed: the model-selector descriptor
and 15 passive public pattern descriptors. IDs/revisions, fields, style parts,
outputs and renderer capability digests remain the same. Before/after digests
are retained in `evidence-ai-remaining-caps-digests.json`.

Validation: 47/47 tests passed in the action/passive package suites, including
native UI preservation and emission of >16,000-character suggestion text, full
terminal output, 140 models/40 efforts with long identities/labels and >65 KB JSON,
140 large public step records with >131 KB JSON, and a 630-node/depth-30 file tree.
All 15 canonical pattern seeds, exact descriptor/capability compatibility checks,
legacy valid states, private/unknown/duplicate/type/state/numeric negatives and
existing nonexecution/intent checks pass. Scoped ESLint and whitespace checks pass.
These are offline parser/DOM tests, not browser/device/provider acceptance.

## Remaining caps outside the assigned authored-data paths

The authored parser/descriptor scan now finds only deterministic ID prefix/title
string slicing; it does not remove supplied content. No authored content/JSON/
array/tree-size quota remains in the inspected action/passive/chat paths.

Separate rendered-capture paths still contain these pre-existing application
policies, left untouched because they are outside this authored parser/descriptor
repair and need their own capture correctness review:

| File | Remaining policy |
| --- | --- |
| `src/capture.ts` | 524,288-byte output image, 1600×1200 pixel capture window |
| `src/capture-scroll.ts` | 6 MiB admitted raster data URI, 2,000 scanned nodes, 4 MiB fetched resource, 6 MiB serialized SVG |
| `src/capture-scroll.ts` | 8-second engine import and rendering deadlines; 5-second library HTTP/resource fetch and image decode/encode deadlines |

These numbers are **not asserted to be hardware limits**. The parent was notified
of their exact remaining scope before any broad claim that all limits are gone.
Positive/nonzero capture geometry, valid PNG/JPEG structure, origin/resource
admission and finite domain metrics are semantic checks, not content quotas.
Viewport/popup CSS sizes and 0–100 progress percentages are display/domain windows
and do not discard supplied data. Actual rendering, JavaScript allocation,
filesystem and provider constraints remain real and must be reported honestly.

No capture code, feedback/core files, running process, browser, provider, network
configuration, production service or saved authored source was changed. No
activation or push occurred.
