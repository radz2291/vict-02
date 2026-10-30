# Repeatable local Studio launch

Use the normal Windows terminal or supported per-command approved outside execution.
The earlier isolated process could bind the address while inbound browser traffic
was dropped. This helper does not modify isolation, firewall, proxy or permissions.

From the repository root, build when needed:

```powershell
npm run build -w @victframework/mastra
npm run build -w vict-studio
```

Keep an existing working server until its replacement builds/configuration are ready.
For a running server, verify the listener's child process and its Studio launcher
parent before an authorized stop; the start helper deliberately refuses an occupied
address and never stops processes itself. Builds replace their output, so use a
separate staging tree to validate first when preserving live output is required.

Prepare that tree with the checked-in helper rather than copying `apps/studio`
Private verification evidence omitted from this public checkpoint; see VICT-PAUSED-PUBLIC-HANDOFF-20261030.md for evidence limits.
The helper preflights that declared JSON input, installed dependencies and tracked
Studio files before creating anything; it refuses an existing stage, verifies
copied hashes, writes `studio-build-inputs.json`, and links installed dependencies.
It does not copy credentials, install packages, build, or change the live service.
The manifest reports working-tree cleanliness and dependency link targets. Those
links use the checkout's workspace sources; they are not a frozen dependency copy.
Keep the reviewed source stable while building and associate its hashes separately.

```powershell
$studioStage = Join-Path $env:LOCALAPPDATA 'Temp/vict-studio-build-candidate'
.\apps\studio\scripts\prepare-build-stage.ps1 -StageRoot $studioStage -ValidateOnly
.\apps\studio\scripts\prepare-build-stage.ps1 -StageRoot $studioStage
npm run build --prefix (Join-Path $studioStage 'apps/studio')
```

Use a fresh stage name for each candidate. Keep failed build logs and include
required-input/manifest checks when associating a staged build with its source.

Validate and launch:

```powershell
.\apps\studio\scripts\start-local-existing-config.ps1 -ValidateOnly
.\apps\studio\scripts\start-local-existing-config.ps1
```

The fixed address is `http://127.0.0.25:5626`; model is `zai/glm-5.3-flash`.
The helper passes the existing `%USERPROFILE%/.pi/agent/auth.json` and `models.json`
references to `launch-agent.mjs`, selecting the existing `zai-key1` Coding Plan
entry. That loader resolves credentials normally; no key belongs in this script,
command arguments, logs or a reconstructed parent environment. The launcher keeps
the existing body-limit default. Other application configuration uses its normal
unchanged defaults/inheritance.

Logs remain `%LOCALAPPDATA%/Temp/vict-studio-out.log` and `vict-studio-err.log`;
earlier logs are copied to timestamped siblings. The new process is hidden.
Confirm the listener and use the supported internal browser. `Listening` alone
does not prove reachability. Preserve the same origin to retain saved browser apps.
