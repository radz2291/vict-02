import type {
  ApplicationDataAdapter,
  ApplicationPlan,
  CompileReleaseContext,
  FrozenApplicationRelease,
} from '@vict/application';
import { compileApplicationRelease } from '@vict/application';
import { APPLICATION_RELEASE_SCHEMA } from '@vict/sdk';
import type { ApplicationRelease } from '@vict/sdk';

/**
 * Release compilation for the Stage 04 proof deployment.
 *
 * TRUST BOUNDARY (RE-AUDIT MED-04-G-R): the binding context is built ONLY
 * from the ACTUAL deployment objects — the real renderer instance, the
 * component-registry identity snapshot, the real application-data adapter,
 * and the activation selection result. The release manifest itself is
 * never accepted as proof of deployed identity, and the verification
 * context is never copied back out of the manifest.
 */

/** The ACTUAL binding objects of one proof deployment. */
export interface ProofReleaseBindings {
  /** The compiled immutable plan this release binds. */
  readonly plan: ApplicationPlan;
  /** The ACTUAL renderer instance of this deployment. */
  readonly renderer: { readonly id: string; readonly revision: string };
  /** The ACTUAL component registry of this deployment. */
  readonly componentRegistry: {
    identity(): {
      readonly registryId: string;
      readonly revision: string;
      readonly components: readonly { readonly componentId: string; readonly revision: string }[];
    };
  };
  /** The ACTUAL application-data adapter of this deployment. */
  readonly dataAdapter: Pick<ApplicationDataAdapter, 'id' | 'revision'>;
  /** The activation version this deployment actually selected. */
  readonly selectedActivationVersion: string;
}

/** Compile the proof release from its ACTUAL binding objects. */
export function compileProofRelease(bindings: ProofReleaseBindings): FrozenApplicationRelease {
  const registryIdentity = bindings.componentRegistry.identity();
  const renderer = { id: bindings.renderer.id, revision: bindings.renderer.revision };
  const dataAdapter = { id: bindings.dataAdapter.id, revision: bindings.dataAdapter.revision };
  const manifest: ApplicationRelease = {
    schema: APPLICATION_RELEASE_SCHEMA,
    applicationId: bindings.plan.applicationId,
    applicationRevision: bindings.plan.applicationRevision,
    applicationVersion: bindings.plan.applicationVersion,
    // The manifest declares the deployment's ACTUAL identities.
    renderer,
    components: {
      registryId: registryIdentity.registryId,
      revision: registryIdentity.revision,
      components: [...registryIdentity.components],
    },
    dataAdapter,
    victCompatibility: '^0.1.0',
    activation: {
      kind: 'reference',
      activationVersion: bindings.selectedActivationVersion,
    },
  };
  // The verification context is sourced from the ACTUAL objects — the
  // renderer instance, the registry identity snapshot, the adapter
  // instance, and the activation selection — never from the manifest.
  const context: CompileReleaseContext = {
    renderer,
    componentRegistry: registryIdentity,
    dataAdapter,
    selectedActivationVersion: bindings.selectedActivationVersion,
  };
  const result = compileApplicationRelease(manifest, bindings.plan, context);
  if (!result.ok) {
    throw new Error(
      `proof release compilation failed: ${result.issues.map((issue) => issue.code).join(', ')}`,
    );
  }
  return result.release;
}