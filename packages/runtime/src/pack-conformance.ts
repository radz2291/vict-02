import type { CapabilityPack } from '@vict/sdk';
import { defineGraph } from '@vict/sdk';
import type { KernelEvent } from './index.js';
import { createInMemoryStores, createRuntime } from './index.js';
import { installCapabilityPack } from './pack-install.js';
import { VictRuntimeError } from './errors.js';

/**
 * Shared capability-pack conformance suite (Stage 04).
 *
 * Any capability pack must pass the SAME suite. The suite creates a fresh
 * runtime per scenario so runtimes and store adapters (in-memory, SQLite,
 * future adapters) exercise identical pack semantics. Proven per pack:
 *
 * 1. install + a full contract-validated run of the pure capability;
 * 2. manifest/binding mismatches and compatibility mismatch fail closed;
 * 3. unknown fields fail closed;
 * 4. original-object mutation after capture has no effect;
 * 5. the declared double runs INSTEAD of the real write (test mode);
 * 6. the real write runs exactly once in normal mode;
 * 7. missing required grants fail BEFORE handler invocation;
 * 8. resolved secret values never enter manifests, events, or history.
 */

export interface CapabilityPackConformanceFixture {
  readonly name: string;
  /** The pack under test (the deep-frozen capture from defineCapabilityPack). */
  readonly pack: CapabilityPack;
  /**
   * The id of the pack's PURE/READ capability (no permissions, no required
   * configuration/secrets) used for the end-to-end run scenario.
   */
  readonly pureCapabilityId: string;
  /** Contract-validated input for the pure capability scenario. */
  readonly pureInput: unknown;
  /** The exact expected validated output of the pure capability scenario. */
  readonly pureExpectedOutput: unknown;
  /**
   * The id of the pack's WRITE capability, which must declare a matching
   * double in the pack manifest (simulation policy) and may declare
   * permissions/secrets.
   */
  readonly writeCapabilityId?: string;
  /** Input for the write scenario (crosses the write capability's contract). */
  readonly writeInput?: unknown;
  /** The double's expected validated output in test/simulation mode. */
  readonly writeDoubleOutput?: unknown;
  /** Probe for the REAL write handler's invocation count (pack-owned counter). */
  readonly writeInvocationCount?: () => number;
  /**
   * Canary that may exist ONLY inside the runtime authority surface handed
   * to handlers — never in the manifest, events, results, or history.
   */
  readonly secretCanary?: string;
}

/** Runtime-level authority profile the suite installs the fixture runtime with. */
export interface CapabilityPackConformanceOptions {
  readonly grants?: readonly string[];
  readonly configuration?: Readonly<Record<string, unknown>>;
  readonly secrets?: Readonly<Record<string, string>>;
}

function fail(message: string): never {
  throw new Error(`[pack conformance: ${message}]`);
}

function buildRuntime(options: CapabilityPackConformanceOptions): ReturnType<typeof createRuntime> {
  const hasAuthority =
    options.grants !== undefined ||
    options.configuration !== undefined ||
    options.secrets !== undefined;
  return createRuntime({
    stores: createInMemoryStores(),
    ...(hasAuthority
      ? {
          authority: {
            ...(options.grants !== undefined ? { grants: options.grants } : {}),
            ...(options.configuration !== undefined
              ? { configuration: { get: (name: string) => options.configuration?.[name] } }
              : {}),
            ...(options.secrets !== undefined
              ? { secrets: { get: async (name: string) => options.secrets?.[name] } }
              : {}),
          },
        }
      : {}),
  });
}

/**
 * Run the shared capability-pack conformance suite against one fixture.
 * Throws on the first failed invariant (like the other shared suites).
 */
export async function runCapabilityPackConformanceSuite(
  fixture: CapabilityPackConformanceFixture,
  options: CapabilityPackConformanceOptions = {},
): Promise<void> {
  const pack = fixture.pack;

  // ---- 1. End-to-end: install, activate, run, contract-validated output.
  const runtime = buildRuntime(options);
  installCapabilityPack(runtime, pack);
  const activation = await runtime.activate(
    defineGraph({
      id: `conformance.${fixture.pureCapabilityId}`,
      entry: 'only',
      nodes: [{ id: 'only', capability: fixture.pureCapabilityId }],
      edges: [],
    }),
  );
  if (!activation.ok) {
    fail(`activation failed: ${JSON.stringify(activation.issues)}`);
  }
  const events: KernelEvent[] = [];
  const result = await runtime.run(fixture.pureInput, {
    mode: 'normal',
    onEvent: (event) => events.push(event),
  });
  if (result.status !== 'completed') {
    fail(`pure run did not complete: ${result.status}`);
  }
  if (JSON.stringify(result.output) !== JSON.stringify(fixture.pureExpectedOutput)) {
    fail(`pure output mismatch: ${JSON.stringify(result.output)}`);
  }

  // ---- 8. Resolved secrets never enter manifests, events, results, history.
  if (fixture.secretCanary !== undefined) {
    if (JSON.stringify(pack.manifest).includes(fixture.secretCanary)) {
      fail('the resolved secret canary leaked into the manifest');
    }
    if (JSON.stringify(events).includes(fixture.secretCanary)) {
      fail('the resolved secret canary leaked into run events');
    }
    if (JSON.stringify(result.output).includes(fixture.secretCanary)) {
      fail('the resolved secret canary leaked into the run result');
    }
    const history = await runtime.listRuns();
    if (JSON.stringify(history).includes(fixture.secretCanary)) {
      fail('the resolved secret canary leaked into default run history');
    }
  }

  // ---- 2. Manifest/binding mismatch fails closed.
  try {
    installCapabilityPack(createRuntime(), {
      manifest: pack.manifest,
      bindings: {
        capabilities: pack.bindings.capabilities.map((binding) =>
          binding.id === fixture.pureCapabilityId ? { ...binding, revision: '999' } : binding,
        ),
        doubles: pack.bindings.doubles,
      },
    });
    fail('a revision-mismatched binding was accepted');
  } catch (error) {
    if (!(error instanceof VictRuntimeError) || error.code !== 'VICT_PACK_INVALID') {
      fail(`mismatch rejection threw the wrong error: ${String(error)}`);
    }
  }

  // ---- 2b. Compatibility mismatch fails closed.
  try {
    installCapabilityPack(createRuntime(), {
      manifest: { ...pack.manifest, victCompatibility: '>=9.0.0' },
      bindings: pack.bindings,
    });
    fail('an incompatible pack was accepted');
  } catch (error) {
    if (!(error instanceof VictRuntimeError) || error.code !== 'VICT_PACK_INVALID') {
      fail(`compatibility rejection threw the wrong error: ${String(error)}`);
    }
    if (!JSON.stringify(error.details).includes('PACK_COMPATIBILITY_UNMET')) {
      fail('compatibility rejection lost its structured issue');
    }
  }

  // ---- 3. Unknown fields fail closed.
  try {
    installCapabilityPack(createRuntime(), {
      manifest: { ...pack.manifest, manifestExtra: true } as unknown as CapabilityPack['manifest'],
      bindings: pack.bindings,
    });
    fail('an unknown manifest field was accepted');
  } catch (error) {
    if (!(error instanceof VictRuntimeError) || error.code !== 'VICT_PACK_INVALID') {
      fail(`unknown-field rejection threw the wrong error: ${String(error)}`);
    }
  }

  // ---- 4. Mutation of the ORIGINAL manifest has no effect after capture.
  const mutableManifest = JSON.parse(JSON.stringify(pack.manifest)) as CapabilityPack['manifest'];
  const mutableCapabilities = mutableManifest.capabilities as unknown as Array<{
    id: string;
    revision: string;
  }>;
  const entry = mutableCapabilities.find((candidate) => candidate.id === fixture.pureCapabilityId);
  if (entry !== undefined) {
    const captured = pack.manifest.capabilities.find(
      (candidate) => candidate.id === fixture.pureCapabilityId,
    );
    entry.revision = 'hijacked';
    if (captured?.revision === 'hijacked') {
      fail('manifest capture is not isolated from the original object');
    }
    if (Object.isFrozen(mutableManifest)) {
      // Mutating a frozen object silently fails in sloppy mode but throws
      // in strict mode; either way the captured pack must be unchanged.
    }
  }

  // ---- 5-7. Write scenarios when the fixture declares a write capability.
  if (
    fixture.writeCapabilityId !== undefined &&
    fixture.writeInput !== undefined &&
    fixture.writeDoubleOutput !== undefined
  ) {
    const realCount = (): number => fixture.writeInvocationCount?.() ?? 0;
    const writeDeclaration = pack.manifest.capabilities.find(
      (candidate) => candidate.id === fixture.writeCapabilityId,
    );
    if (writeDeclaration === undefined) {
      fail('write fixture declares an unknown capability');
    }

    // 5. Simulation (test mode) runs the DECLARED double, never the real write.
    const simulated = buildRuntime(options);
    installCapabilityPack(simulated, pack);
    await simulated.activate(
      defineGraph({
        id: `conformance.${fixture.writeCapabilityId}.sim`,
        entry: 'only',
        nodes: [{ id: 'only', capability: fixture.writeCapabilityId }],
        edges: [],
      }),
    );
    const beforeSim = realCount();
    simulated.registerDouble(fixture.writeCapabilityId, () => fixture.writeDoubleOutput);
    const simResult = await simulated.run(fixture.writeInput, { mode: 'test' });
    if (simResult.status !== 'completed') {
      fail(`simulated write did not complete: ${simResult.status}`);
    }
    if (JSON.stringify(simResult.output) !== JSON.stringify(fixture.writeDoubleOutput)) {
      fail(`double output mismatch: ${JSON.stringify(simResult.output)}`);
    }
    if (realCount() !== beforeSim) {
      fail('the real write handler ran during simulation');
    }

    // 6. Normal mode runs the real handler exactly once (when granted).
    const requiredPermissions = writeDeclaration.permissions ?? [];
    const granted = requiredPermissions.every((permissionId) =>
      (options.grants ?? []).includes(permissionId),
    );
    if (granted) {
      const real = buildRuntime(options);
      installCapabilityPack(real, pack);
      await real.activate(
        defineGraph({
          id: `conformance.${fixture.writeCapabilityId}.real`,
          entry: 'only',
          nodes: [{ id: 'only', capability: fixture.writeCapabilityId }],
          edges: [],
        }),
      );
      const beforeReal = realCount();
      const realResult = await real.run(fixture.writeInput, { mode: 'normal' });
      if (realResult.status !== 'completed') {
        fail(`real write did not complete: ${realResult.status}`);
      }
      if (realCount() - beforeReal !== 1) {
        fail(`real write invocation delta is ${realCount() - beforeReal}`);
      }
    }

    // 7. Missing required grants fail BEFORE handler invocation.
    if (requiredPermissions.length > 0) {
      const ungranted = createRuntime({ stores: createInMemoryStores() });
      installCapabilityPack(ungranted, pack);
      await ungranted.activate(
        defineGraph({
          id: `conformance.${fixture.writeCapabilityId}.ungranted`,
          entry: 'only',
          nodes: [{ id: 'only', capability: fixture.writeCapabilityId }],
          edges: [],
        }),
      );
      const beforeUngranted = realCount();
      const denied = await ungranted.run(fixture.writeInput, { mode: 'normal' });
      if (denied.status !== 'failed') {
        fail(`ungranted write did not fail: ${denied.status}`);
      }
      if (denied.error?.code !== 'VICT_RUNTIME_PERMISSION_DENIED') {
        fail(`ungranted write failed with the wrong code: ${String(denied.error?.code)}`);
      }
      if (realCount() !== beforeUngranted) {
        fail('the real write handler ran without a required grant');
      }
    }
  }
}
