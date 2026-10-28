# Independent launcher review

Snapshot: the two uncommitted launcher files above HEAD `3c396ad9284b699e8121f39d2602ece26870455a`; exact file hashes in `launcher-independent.json`.
Verdict: **FAIL - ordinary bounded repairs required before sealing**.

The PowerShell parser reports zero errors. `-ValidateOnly` exits 0, reports the expected address/model and `ServerStarted: false`. It returns before listener inventory, environment assignments and process startup. No server, browser, provider, listener inventory or network request was made by this review.

1. **LAUNCH-01, medium:** The endpoint predicate checks HTTPS, host, path and forbidden URL fields, but not the port. A pure local Uri/predicate probe confirms `https://api.z.ai:8443/api/coding/paas/v4` passes. Require port 443 so the fixed approved endpoint remains fixed. No actual request was attempted.
2. **LAUNCH-02, medium:** The occupied-address check only matches `127.0.0.25`; a wildcard listener at `0.0.0.0:5626` can already occupy the requested binding, and a dual-stack `::` listener may also overlap. Refuse applicable wildcard listeners, or conservatively refuse any listener on 5626. Preserve the existing no-stop behavior. This is a static control-flow finding; no listener probe was run.
3. **LAUNCH-03, low:** Windows `Start-Process -ArgumentList` joins supplied arguments; the absolute script argument is currently unquoted. A repository path containing spaces can split the launcher path. Quote that absolute argument. The present checkout path contains no spaces; no process was started to reproduce this portability case.

Safe properties confirmed: three-level repository resolution from `$PSScriptRoot`; fixed host/port/origin/model and selected existing model entry; no credential value read/printed/copied by this helper; existing auth/model file references passed to the normal loader; hidden process; timestamped prior-log copies; no kill, firewall, isolation, authentication or persistent permission change. The existing loader's inherited `ZAI_API_KEY` precedence remains unchanged, consistent with the documentation's normal inheritance statement.

The two reviewed files remain unedited by the verifier. A repaired exact-commit snapshot needs a bounded recheck. This verdict concerns the durable helper, not the separately approved and already completed relaunch or the active AI trial.
