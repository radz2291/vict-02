# Presentation quota removal amendment — 2026-10-31

Status: accepted direct owner amendment for the local unreleased candidate. This records existing explicit authorization, not a proposal awaiting ratification. No publication, activation, provider or owner-data authority is granted.

The owner instructed removal of the artificial limit and similar unnecessary limits, with protection owned by shared VICT/Mastra packages and Studio remaining a thin consumer. That instruction supersedes the presentation quotas frozen in `VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md` §4, the related audit-remediation contract, and `VICT-PRESENTATION-STRING-BOUND-AMENDMENT-20261028.md`. Earlier contracts and failed observations remain preserved.

Remove the default total serialized-byte, nesting-depth, field-count, array-length, schema-string and capability-description quotas from shared Mastra presentation capture. Remove their numeric `PRESENTATION_BOUNDS` members rather than replace them with larger thresholds. The remaining safe field-name grammar and prohibited prototype-named keys remain declared shared rules. The adapter admission revision advances to distinguish the relaxed construction semantics; no release or saved-document migration is implied.

Capture remains descriptor-driven, passive plain data: reject proxies before inspection; reject cycles, exotic prototypes, accessors without invocation, functions, symbols/symbol keys, non-enumerable/unknown array members, nonfinite numbers, unsupported values, unsafe field names and prototype-named keys. Keep the object schema-root requirement, nonempty string description requirement, deterministic key ordering and deeply frozen owned snapshots. Presentation never replaces authoritative contract parsing, grants execution authority, or admits unknown semantic fields in capability/profile/argument contracts.

Use iterative capture so the removed fixed depth guard does not become unbounded recursive traversal. Existing finite valid declarations retain the same captured bytes and identity. Hostile data still fails construction with stable non-echoing errors. Actual provider context/schema support, machine resources and JavaScript serialization capacity remain real upstream/platform constraints and must be reported honestly rather than hidden by a local task quota.

Executable changes follow this amendment in a separate commit. Tests must cover metadata beyond 32,768 bytes, deep/wide data, exact full content and immutability, the existing hostile cases, and unchanged valid profile identity vectors.
