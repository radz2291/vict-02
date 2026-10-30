# Actual export static-device-preview preparation

This is preparation evidence, not an Android, browser, LAN, or owner-acceptance pass.
No server, firewall rule, wireless debugging, network profile, Studio bind, account,
provider, or browser configuration was changed. The live Studio remains separate.

The reusable `scripts/prepare-export-device-preview.mjs` consumes an actual supported
one-screen application export and prepares a disposable static consumer. It copies
the JSON bytes unchanged and records SHA-256 before and after production build.
There is no replacement authored screen, seed, or component-specific fixture.
The generic shell compiles the original document and validates the resulting plan
against the public installed renderer registrations before building browser assets.

The exact seven packed public artifacts come from the retained F0YKQr inventory.
All tar SHA-256 values and all 510 installed nonmanifest files must match that
inventory. This reuses those artifacts; it is not a fresh package build and does
not establish that a later package source revision is represented.

Only catalog, Flow and Media registrations are installed. AI, Patterns, custom
registrations, or other missing component definitions refuse through authoritative
compilation/renderer validation. Nonempty media archives or source asset inventories
refuse before dependency installation/build. No media verification is bypassed.
The application envelope is retained byte-for-byte; this one-screen preview renders
its attached document rather than implementing a complete application backend.
Backend dispatch returns an explicit unavailable result and a visible message.
Document local state and graph interactions use normal shared DocumentHost behavior;
state is session-only. Reloading restores the exported initial state.

## Reproduce preparation

From the continuation repository, use a destination that does not exist:

```powershell
node scripts/prepare-export-device-preview.mjs `
  docs/studio/foundation-evidence/architecture-realignment-20261030/actual-agent-live-20261030/stage-1-supported-export.json `
  C:/Users/RZ1/AppData/Local/Temp/vict-export-device-preview-stage1-final-20261030 `
  C:/Users/RZ1/AppData/Local/Temp/vict-realignment-consumer-F0YKQr/artifacts
```

An optional fourth argument selects a different successful consumer inventory.
The script never overwrites an existing destination. Failed preparations retain
their report/logs. Dependencies use the seven local packs and normal consumer
tooling versions with install scripts disabled; no server is started.

The prepared static root is the destination's `dist` directory. Serve **only** that
directory with an independently reviewed GET/HEAD-only static server after the
connection step is authorized. Do not serve the repository, parent destination,
Studio, auth files, source tree, package cache, or a reverse proxy. No serving script
or LAN listener is included in this change.

## Wireless prerequisites and device checks

Read-only adapter inspection found Wi-Fi IPv4 `192.168.1.6/24`, with Windows network
category Public and enabled firewall profiles. Those observations may change.
The phone must be on a network able to reach the PC's Wi-Fi address. Firewall
permission and client isolation are unproven; do not silently change either.
The separate preview must bind only to the chosen Wi-Fi address and an unused
dedicated port; Studio stays at `http://127.0.0.25:5626`.

After static serving is reviewed and authorized, give the owner the exact LAN URL.
They should open it in their own Android browser and record the device/browser,
portrait/landscape layout, focused input with software keyboard, visible viewport
and safe-area behavior, touch controls, graph gestures where applicable, and reset
after reload. A desktop size preview does not satisfy those checks.

Plain HTTP LAN preview does not establish secure-context features such as clipboard
or managed-media digest import. The retained Stage 1 actual export has no managed
media and no source assets. Later exports must be assessed independently.

## Retained observations

The first preparation passed compile/renderer validation and production build.
It emitted an initial-prop-capture warning and a large-chunk warning. The source
export remained unchanged. Its report/logs are retained as `initial-*`; it was not
a failed authored-app observation and is not discarded.

The final script captures both output streams in logs and uses explicit one-time
Svelte `untrack` for its single immutable bundle mount. Final report/logs and the
independent PowerShell source/copy/build SHA-256 comparison are retained alongside
this document. The large browser bundle warning is a preparation limitation, not
a physical-device performance result.
