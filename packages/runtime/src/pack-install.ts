import type { CapabilityPack, PackIssue } from '@vict/sdk';
import { validateCapabilityPack } from '@vict/sdk';
import type { VictRuntime } from './runtime.js';
import { VictRuntimeError } from './errors.js';
import type { RuntimeErrorCode } from './errors.js';

/**
 * Stage 04: explicit, LOCAL capability-pack installation.
 *
 * Loading a pack is a deliberate act: the manifest is cross-validated
 * against the executable bindings (missing, duplicate, extra, or
 * revision-mismatched bindings fail deterministically), the declared
 * Vict compatibility is checked against the consuming runtime's version,
 * and only then are contracts and capabilities registered. There is no
 * remote loading, no automatic package installation, and no untrusted
 * execution anywhere in this path.
 */

/** The public Vict compatibility this runtime provides. */
export const VICT_RUNTIME_COMPAT_VERSION = '0.1.0';

/**
 * Permission grants live on the RUNTIME (createRuntime({ authority })),
 * never on the install call: authorization is a runtime-level decision.
 * A pack installed without its required grants registers fine, but
 * invoking a capability whose declared permissions are ungranted fails
 * BEFORE the handler runs (VICT_RUNTIME_PERMISSION_DENIED).
 */

/** Install a capability pack into one runtime. Throws structured VictRuntimeErrors on failure. */
export function installCapabilityPack(
  runtime: VictRuntime,
  pack: CapabilityPack,
): { readonly installed: readonly string[] } {
  const validation = validateCapabilityPack(pack, {
    victVersion: VICT_RUNTIME_COMPAT_VERSION,
  });
  if (!validation.ok) {
    throw packInvalidError(pack, validation.issues);
  }
  const declared = new Map(pack.manifest.capabilities.map((entry) => [entry.id, entry]));

  // Register each distinct contract object once (shared frozen contracts
  // keep their object identity).
  const registeredContracts = new Set<string>();
  for (const binding of pack.bindings.capabilities) {
    for (const contract of [binding.input, binding.output]) {
      if (contract && !registeredContracts.has(contract.id)) {
        runtime.registerContract(contract);
        registeredContracts.add(contract.id);
      }
    }
  }

  const installed: string[] = [];
  for (const binding of pack.bindings.capabilities) {
    const declaration = declared.get(binding.id);
    if (!declaration) {
      continue; // validated above
    }
    runtime.registerCapability({
      id: binding.id,
      revision: binding.revision,
      effect: declaration.effect,
      invoke: binding.invoke,
      ...(declaration.idempotency !== undefined ? { idempotency: declaration.idempotency } : {}),
      ...(binding.input !== undefined ? { input: binding.input } : {}),
      ...(binding.output !== undefined ? { output: binding.output } : {}),
      ...(declaration.permissions !== undefined
        ? { permissions: [...declaration.permissions] }
        : {}),
      ...(declaration.configuration !== undefined
        ? { configuration: [...declaration.configuration] }
        : {}),
      ...(declaration.requiredConfiguration !== undefined
        ? { requiredConfiguration: [...declaration.requiredConfiguration] }
        : {}),
      ...(declaration.secrets !== undefined ? { secrets: [...declaration.secrets] } : {}),
      ...(declaration.requiredSecrets !== undefined
        ? { requiredSecrets: [...declaration.requiredSecrets] }
        : {}),
    });
    installed.push(binding.id);
  }

  return { installed: Object.freeze(installed) };
}

function packInvalidError(pack: CapabilityPack, issues: readonly PackIssue[]): VictRuntimeError {
  const code: RuntimeErrorCode = 'VICT_PACK_INVALID';
  const summary = issues
    .slice(0, 5)
    .map((issue) => `${issue.code}: ${issue.message}`)
    .join(' | ');
  return new VictRuntimeError(
    code,
    `Capability pack '${pack.manifest.id}' is not installable: ${summary}`,
    {
      packId: pack.manifest.id,
      issues: issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path,
      })),
    },
  );
}
