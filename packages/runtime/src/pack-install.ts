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
 * and only then are contracts, capabilities, and declared doubles
 * registered ATOMICALLY.
 *
 * Audit remediation (HIGH-04-A): installation is a registry-level STAGED
 * BATCH. Every contract, capability, and declared double is validated and
 * preflighted (including collisions against the live registry and inside
 * the batch) BEFORE any live map is touched; the complete batch commits
 * only when every step succeeds. A failed installation leaves the registry
 * byte-for-byte semantically unchanged: no capability, contract, or double
 * from the attempted pack is resolvable afterwards. There is no best-effort
 * rollback of partially registered entries because nothing is registered
 * until success is certain.
 *
 * Audit remediation (MED-04-B): the pack's declared doubles
 * (`manifest.doubles` + `bindings.doubles`) are installed atomically WITH
 * the pack. A pack-declared double is eligible ONLY in the modes its
 * manifest declares (`modes: ['test','simulate']`); it never runs in
 * normal mode. No manual `runtime.registerDouble` call is needed.
 *
 * There is no remote loading, no automatic package installation, and no
 * untrusted execution anywhere in this path.
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
  const declaredDoubles = new Map(
    (pack.manifest.doubles ?? []).map((entry) => [entry.capabilityId, entry]),
  );

  // Atomic staged batch: every validation, preflight collision check, and
  // effective registration happens against the staging overlay. The live
  // registry is committed only after ALL steps succeed.
  runtime.installCapabilityPackBatch((staging) => {
    // Register each distinct contract object once (shared frozen contracts
    // keep their object identity). Registration inside the batch validates
    // every contract against the live registry + the staged overlay.
    const registeredContracts = new Set<string>();
    for (const binding of pack.bindings.capabilities) {
      for (const contract of [binding.input, binding.output]) {
        if (contract && !registeredContracts.has(contract.id)) {
          staging.registerContract(contract);
          registeredContracts.add(contract.id);
        }
      }
    }

    // Preflight + stage every effective capability registration without
    // mutating any live map.
    const installed: string[] = [];
    for (const binding of pack.bindings.capabilities) {
      const declaration = declared.get(binding.id);
      if (!declaration) {
        continue; // validated above
      }
      staging.registerCapability({
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

    // Install the declared bound doubles atomically with the pack (MED-04-B).
    // Eligibility is the manifest's declared `modes` (default: test +
    // simulate); a declared double never runs in normal mode.
    for (const double of pack.bindings.doubles ?? []) {
      const declaration = declaredDoubles.get(double.capabilityId);
      staging.registerDouble(double.capabilityId, double.invoke, {
        modes: declaration?.modes ?? ['test', 'simulate'],
      });
    }
  });

  return { installed: Object.freeze(pack.bindings.capabilities.map((binding) => binding.id)) };
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
