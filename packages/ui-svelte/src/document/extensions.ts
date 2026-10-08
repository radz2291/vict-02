import type { Component, Snippet } from 'svelte';
import type {
  UiExtensionDescriptor,
  UiOutputDecl,
  UiRenderInstruction,
  UiValue,
} from '@victframework/ui';

/** The component-ABI marker (amendment §3.2) — declared as an events capability. */
export const UI_COMPONENT_ABI = 'vict.ui-component-abi@1' as const;

/** Props-only ABI supported by the current compiled extension instruction.
 * Actions stay on authored elements. Components receive neither dispatch nor
 * hidden application data. Hosts explicitly mount public styles and themes.
 */
export interface UiSvelteExtensionProps {
  readonly props: Readonly<Record<string, unknown>>;
  readonly occurrenceKey: string;
  readonly nodeId: string;
  /** Declared rendered targets, including portal ownership and selection metadata. */
  readonly presentation?: UiComponentPresentation;
}

/** Code registration is outside serialized source and requires exact identity. */
export interface UiSvelteExtensionImplementation {
  readonly extensionId: string;
  readonly revision: string;
  readonly rendererImplementationId: string;
  readonly component: Component<UiSvelteExtensionProps>;
  readonly styleTargets?: readonly string[];
}

/**
 * The typed output channel (amendment §3.4). Implementations receive `emit`
 * and nothing else: no dispatcher, no adapters, no application data beyond
 * evaluated declared props. Delivery is declared-only and payload-typed;
 * the bridge copies array payloads before delivery (§10.1a ownership).
 */
export interface UiSvelteComponentIO {
  /** Emit a declared output. Only declared names are delivered. */
  readonly emit: (output: string, payload?: UiValue) => void;
  readonly slots?: Readonly<Record<string, Snippet>>;
  readonly action?: UiComponentActionStatus;
}

/** Props + IO contract for a component-ABI implementation (amendment §3.4). */
export interface UiSvelteComponentProps extends UiSvelteExtensionProps {
  readonly io?: UiSvelteComponentIO;

}

/**
 * A registered component implementation. Identity follows the extension
 * pattern (exact match, fail-closed on absent/competing registrations)
 * extended with the ABI and slot-capability fields the contract requires.
 */
export interface UiSvelteComponentImplementation {
  readonly extensionId: string;
  readonly revision: string;
  readonly rendererImplementationId: string;
  /** Must equal the descriptor's `abi`; mismatch is fail-closed (§5.2). */
  readonly abi: typeof UI_COMPONENT_ABI;
  /** Descriptor slot names this implementation can render (capability). */
  readonly slots: readonly string[];
  /** Exposed presentation targets this implementation actually forwards. */
  readonly styleTargets?: readonly string[];
  /** Subset of `slots` the implementation contract requires to be filled. */
  readonly required?: readonly string[];
  readonly component: Component<UiSvelteComponentProps>;
}

export interface UiExtensionRenderDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export type UiSvelteExtensionResolution =
  | { readonly ok: true; readonly component: Component<UiSvelteExtensionProps> }
  | { readonly ok: false; readonly diagnostic: UiExtensionRenderDiagnostic };

export type UiSvelteComponentResolution =
  | {
      readonly ok: true;
      readonly kind: 'component';
      readonly component: Component<UiSvelteComponentProps>;
      readonly descriptor: UiExtensionDescriptor;
      readonly outputDecls: readonly UiOutputDecl[];
    }
  | {
      readonly ok: true;
      readonly kind: 'extension';
      readonly component: Component<UiSvelteExtensionProps>;
    }
  | { readonly ok: false; readonly diagnostic: UiExtensionRenderDiagnostic };

/** True when the descriptor declares component-ABI surface (§3.2). */
export function isComponentAbiDescriptor(descriptor: UiExtensionDescriptor): boolean {
  return (
    descriptor.abi !== undefined ||
    (descriptor.outputs?.length ?? 0) > 0 ||
    (descriptor.slots?.length ?? 0) > 0
  );
}

/**
 * Resolve one compiled extension instruction to a component, fail-closed
 * (amendment §4.1/§5.2):
 *
 * - exactly one descriptor matches `(extensionId, instruction.revision)`;
 * - a component-ABI descriptor (marker in `events`) requires the compiled
 *   artifact marker (`outputDecls` always emitted by the amended compiler)
 *   — a pre-amendment plan artifact is `UI_COMPONENT_ABI_UNSUPPORTED`;
 * - exactly one implementation matches the declared identity, and its
 *   `abi` equals the descriptor's `abi` (`UI_COMPONENT_ABI_UNSUPPORTED`);
 * - a filled slot outside the implementation's capability set is
 *   `UI_COMPONENT_SLOT_UNAVAILABLE`; an unfilled required slot is
 *   `UI_COMPONENT_SLOT_REQUIRED`.
 *
 * Props-only descriptors without the marker keep the exact legacy
 * resolution (untyped non-marker events still fail closed via
 * `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`).
 */
export function resolveSvelteComponent(
  instruction: Extract<UiRenderInstruction, { kind: 'extension' }>,
  descriptors: readonly UiExtensionDescriptor[],
  implementations: readonly (UiSvelteExtensionImplementation | UiSvelteComponentImplementation)[],
): UiSvelteComponentResolution {
  const detail = {
    extensionId: instruction.extensionId,
    revision: instruction.revision,
    nodeId: instruction.nodeId,
  };
  const fail = (code: string, message: string): UiSvelteComponentResolution => ({
    ok: false,
    diagnostic: { code, message, detail },
  });
  const matchingDescriptors = descriptors.filter(
    (entry) => entry.id === instruction.extensionId && entry.revision === instruction.revision,
  );
  if (matchingDescriptors.length !== 1)
    return fail(
      matchingDescriptors.some(
        (entry) => entry.events?.length === 1 && entry.events[0] === 'vict.ui-component-abi@1',
      )
        ? 'UI_COMPONENT_UNAVAILABLE'
        : 'UI_RENDER_EXTENSION_UNAVAILABLE',
      'Exactly one descriptor with the compiled identity is required.',
    );
  const descriptor = matchingDescriptors[0]!;
  const componentAbi = isComponentAbiDescriptor(descriptor);
  if (!componentAbi) {
    // Legacy props-only path (unchanged): the interface gate, identity
    // rules AND diagnostic codes behave exactly as before this amendment.
    if ((descriptor.events?.length ?? 0) > 0 || (descriptor.slots?.length ?? 0) > 0) {
      return fail(
        'UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
        'The current extension instruction supports props only; declared events and slots require a future compiled interface.',
      );
    }
    const legacyMatches = implementations.filter(
      (entry): entry is UiSvelteExtensionImplementation =>
        entry.extensionId === descriptor.id &&
        entry.revision === descriptor.revision &&
        entry.rendererImplementationId === descriptor.rendererImplementationId &&
        (entry as UiSvelteComponentImplementation).abi === undefined,
    );
    if (legacyMatches.length !== 1)
      return fail(
        'UI_RENDER_EXTENSION_UNAVAILABLE',
        'Exactly one renderer implementation matching the declared identity is required.',
      );
    if (((instruction.styleRuleIds?.length ?? 0) > 0 || (instruction.classes?.length ?? 0) > 1) &&
      descriptor.styleTargets?.some(target => !legacyMatches[0]!.styleTargets?.includes(target))) {
      return fail('UI_COMPONENT_STYLE_UNAVAILABLE', 'The legacy implementation does not forward the declared style target.');
    }
    return { ok: true, kind: 'extension', component: legacyMatches[0]!.component };
  }
  // Component-ABI path: the marker must be present and consistent, and the
  // compiled artifact must carry the outputDecls marker (§3.3/§4.3).
  if (
    descriptor.abi !== UI_COMPONENT_ABI ||
    descriptor.events?.length !== 1 ||
    descriptor.events[0] !== UI_COMPONENT_ABI
  ) {
    return fail(
      'UI_COMPONENT_ABI_UNSUPPORTED',
      'The descriptor declares component-ABI surface without a consistent marker/abi pair.',
    );
  }
  if (instruction.outputDecls === undefined) {
    return fail(
      'UI_COMPONENT_ABI_UNSUPPORTED',
      'The compiled instruction lacks outputDecls for an abi@1 descriptor (pre-amendment artifact).',
    );
  }
  const abiMatches = implementations.filter(
    (entry): entry is UiSvelteComponentImplementation =>
      (entry as UiSvelteComponentImplementation).abi === UI_COMPONENT_ABI &&
      entry.extensionId === descriptor.id &&
      entry.revision === descriptor.revision &&
      entry.rendererImplementationId === descriptor.rendererImplementationId,
  );
  if (abiMatches.length !== 1)
    return fail(
      'UI_COMPONENT_UNAVAILABLE',
      'Exactly one component implementation matching the declared identity and ABI is required.',
    );
  const implementation = abiMatches[0]!;
  if (implementation.abi !== descriptor.abi) {
    return fail(
      'UI_COMPONENT_ABI_UNSUPPORTED',
      'Descriptor ABI and implementation ABI must be the same literal.',
    );
  }
  if ((instruction.styleRuleIds?.length ?? 0) > 0 || (instruction.classes?.length ?? 0) > 1) {
    if ((descriptor.styleTargets?.length ?? 0) === 0 || descriptor.styleTargets?.some(target => !implementation.styleTargets?.includes(target))) {
      return fail('UI_COMPONENT_STYLE_UNAVAILABLE', 'The implementation cannot forward the declared style target.');
    }
  }
  const filledSlots = Object.keys(instruction.slots ?? {});
  for (const slotName of filledSlots) {
    if (!descriptor.slots?.includes(slotName) || !implementation.slots.includes(slotName)) {
      return fail(
        'UI_COMPONENT_SLOT_UNAVAILABLE',
        `The implementation cannot render the declared, filled slot '${slotName}'.`,
      );
    }
  }
  for (const slotName of implementation.required ?? []) {
    const fill = instruction.slots?.[slotName];
    if (fill === undefined || fill.length === 0) {
      return fail('UI_COMPONENT_SLOT_REQUIRED', `The required slot '${slotName}' has no fill.`);
    }
  }
  return {
    ok: true,
    kind: 'component',
    component: implementation.component,
    descriptor,
    outputDecls: instruction.outputDecls,
  };
}

/** Fail closed on absent, competing or unsupported registrations. Never guess
 * by extension id alone, or use a component belonging to a different revision.
 */
export function resolveSvelteExtension(
  instruction: Extract<UiRenderInstruction, { kind: 'extension' }>,
  descriptors: readonly UiExtensionDescriptor[],
  implementations: readonly UiSvelteExtensionImplementation[],
): UiSvelteExtensionResolution {
  const resolution = resolveSvelteComponent(instruction, descriptors, implementations);
  if (resolution.ok) {
    return resolution.kind === 'extension'
      ? { ok: true, component: resolution.component }
      : {
          ok: false,
          diagnostic: {
            code: 'UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
            message: 'A component-ABI descriptor reached the props-only resolver.',
            detail: { extensionId: instruction.extensionId, revision: instruction.revision },
          },
        };
  }
  return { ok: false, diagnostic: resolution.diagnostic };
}

/** Attributes must be spread on a real declared root/part, never a measurement wrapper. */
export interface UiComponentTargetAttributes {
  readonly class: string;
  readonly style?: string;
  readonly 'data-ui-owner'?: string;
  readonly 'data-ui-primary'?: string;
  readonly 'data-ui-node'?: string;
  readonly 'data-ui-occ'?: string;
  readonly 'data-ui-part'?: string;
  readonly onpointerdown?: (event: PointerEvent) => void;
}
export interface UiComponentPresentation {
  /** The first declared style target owns instance styles; other targets expose inspection. */
  readonly target: (name: string) => UiComponentTargetAttributes;
}

/** Execution status is ephemeral presentation state, separate from authored bindings. */
export interface UiComponentActionStatus {
  readonly pending: boolean;
  readonly feedback: import('@victframework/ui').UiActionFeedback | null;
}
export interface UiActionStateConnection {
  readonly pending?: string;
  readonly error?: string;
  readonly result?: string;
  readonly successValues?: Readonly<Record<string, UiValue>>;
}
