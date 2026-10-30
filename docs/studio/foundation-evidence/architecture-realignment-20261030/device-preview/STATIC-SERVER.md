# Sealed static preview server candidate

The separate helper `scripts/serve-export-device-preview.mjs` serves only the
successful preparation report's exact production file inventory. It does not
import Studio or packages, proxy requests, run actions, serve source/report files,
list directories, write files, or use credentials. It never binds a wildcard.
The static export remains unchanged.

The root must equal the preparation's explicit `destination/dist`. The report must
have its successful preparation status and match the supplied SHA-256. Every
listed file must be a regular file whose real path remains within that root and
whose SHA-256 matches the report. The exported application's hash must also match
the preparation's original-export hash. Verified bytes are sealed in memory before
listening; later disk modifications are not served. Inventory/file/memory limits
are enforced. Unknown inventory content types refuse startup.

Only GET and HEAD are supported. The request Host must match the exact bind
address/port. URL length and decoding are bounded; traversal, backslashes, encoded
separators, malformed encodings, hidden paths and queries refuse. There is no SPA
fallback for unknown paths. Successful responses carry correct content types,
`X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. Errors reveal no
filesystem paths. Cookie/auth headers are neither used nor logged.

## Candidate Wi-Fi command — not executed

From the continuation repository, after review and explicit authorization to start
this separate listener:

```powershell
node scripts/serve-export-device-preview.mjs `
  C:/Users/RZ1/AppData/Local/Temp/vict-export-device-preview-stage1-final-20261030/dist `
  C:/Users/RZ1/AppData/Local/Temp/vict-export-device-preview-stage1-final-20261030/preview-report.json `
  4fa3efa94dac093b42a6f012b2a3b04f60e6be03319e73a267512a751976b2b3 `
  192.168.1.6 `
  5630
```

This would expose only `http://192.168.1.6:5630/`. The private address must still be
assigned locally; the helper refuses otherwise. Port 5630 availability and inbound
Wi-Fi reachability remain unproven. It refuses the Studio port 5626. Startup errors
do not stop or replace any existing listener. Ctrl+C stops this helper only.

Wi-Fi was observed as Public with enabled firewall profiles. No firewall/profile,
wireless ADB, router, Studio bind, or network changes are authorized or performed by
this helper. If Android cannot reach the preview, retain the observation and stop
to identify the prerequisite. Do not silently broaden the binding or change rules.

## Local smoke evidence

`server-loopback-smoke.mjs` starts and stops only its own temporary child bound to
`127.0.0.1` on an available temporary port. Its report records 15 grouped checks:
real prepared bytes and content types, security/cache headers, HEAD behavior,
unsupported methods, missing/listing/source/backend/report paths, raw/encoded
traversal and malformed paths, Host fencing, report-hash and output-hash fencing,
wildcard/public/Studio-port refusal, junction escape refusal, and original export
preservation. Tamper/junction checks use a separate retained temporary fixture;
the actual prepared output is never modified.

Run from the repository root:

```powershell
node docs/studio/foundation-evidence/architecture-realignment-20261030/device-preview/server-loopback-smoke.mjs
node --check scripts/serve-export-device-preview.mjs
```

All checks passed. The smoke child exited. No LAN listener was started, no browser
or physical device was used, and no Android result or owner acceptance is claimed.
The prior preview's backend, media, session-state and bundle-size limitations still
apply; see `PREPARATION.md`.
