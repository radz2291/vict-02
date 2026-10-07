import type { Component } from 'svelte';
import type { UiExtensionDescriptor, UiRenderInstruction } from '@victframework/ui';

/** Props-only ABI supported by the current compiled extension instruction.
 * Actions stay on authored elements. Components receive neither dispatch nor
 * hidden application data. Hosts explicitly mount public styles and themes.
 */
export interface UiSvelteExtensionProps {
  readonly props: Readonly<Record<string, unknown>>;
  readonly occurrenceKey: string;
  readonly nodeId: string;
}

/** Code registration is outside serialized source and requires exact identity. */
export interface UiSvelteExtensionImplementation {
  readonly extensionId: string;
  readonly revision: string;
  readonly rendererImplementationId: string;
  readonly component: Component<UiSvelteExtensionProps>;
}

export interface UiExtensionRenderDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export type UiSvelteExtensionResolution =
  | { readonly ok: true; readonly component: Component<UiSvelteExtensionProps> }
  | { readonly ok: false; readonly diagnostic: UiExtensionRenderDiagnostic };

/** Fail closed on absent, competing or unsupported registrations. Never guess
 * by extension id alone, or use a component belonging to a different revision.
 */
export function resolveSvelteExtension(
  instruction: Extract<UiRenderInstruction, { kind: 'extension' }>,
  descriptors: readonly UiExtensionDescriptor[],
  implementations: readonly UiSvelteExtensionImplementation[],
): UiSvelteExtensionResolution {
  const detail = {
    extensionId: instruction.extensionId,
    revision: instruction.revision,
    nodeId: instruction.nodeId,
  };
  const fail = (code: string, message: string): UiSvelteExtensionResolution => ({
    ok: false,
    diagnostic: { code, message, detail },
  });
  const matchingDescriptors = descriptors.filter(
    (entry) => entry.id === instruction.extensionId && entry.revision === instruction.revision,
  );
  if (matchingDescriptors.length !== 1)
    return fail(
      'UI_RENDER_EXTENSION_UNAVAILABLE',
      'Exactly one extension descriptor with the compiled identity is required.',
    );
  const descriptor = matchingDescriptors[0]!;
  if ((descriptor.events?.length ?? 0) > 0 || (descriptor.slots?.length ?? 0) > 0) {
    return fail(
      'UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
      'The current extension instruction supports props only; declared events and slots require a future compiled interface.',
    );
  }
  const matchingImplementations = implementations.filter(
    (entry) =>
      entry.extensionId === descriptor.id &&
      entry.revision === descriptor.revision &&
      entry.rendererImplementationId === descriptor.rendererImplementationId,
  );
  if (matchingImplementations.length !== 1)
    return fail(
      'UI_RENDER_EXTENSION_UNAVAILABLE',
      'Exactly one renderer implementation matching the declared identity is required.',
    );
  return { ok: true, component: matchingImplementations[0]!.component };
}
