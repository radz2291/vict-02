/**
 * `compileUiDocument` — resolve one validated document into a
 * `vict.ui-render-plan@1` (API-SPEC §4): resolved structure instructions,
 * style rules with explicit cascade layers, dynamic instruction records,
 * declared extension identities and occurrence provenance (sourceMap).
 *
 * Compilation never throws for invalid input and never executes author
 * code; fatal diagnostics abort with `{ ok: false, issues }`.
 */

import type {
  UiCatalogs,
  SemanticElementCatalog,
  UiAttributeValue,
  UiComponentDefinition,
  UiCondition,
  UiDocument,
  UiExpression,
  UiInteraction,
  UiNode,
  UiOutputBinding,
  UiOutputDecl,
  UiPseudoState,
  UiPropDecl,
  UiStyleSource,
  UiStyleValue,
  UiValueType,
} from './document.js';
import { UI_RENDER_PLAN_SCHEMA } from './document.js';
import { canonicalUiDocument } from './canonical.js';
import { hasErrors, uiDiagnostic, type UiDiagnostic } from './diagnostics.js';
import { checkExpression, checkExpressionTarget, repeatExpressionFields, type UiScopeInfo } from './expressions.js';
import { sha256 } from './sha256.js';
import { isUiValueOfType } from './values.js';
import { validateUiDocument } from './validate.js';

/** The component-ABI marker (amendment §3.2): declared as an events capability. */
export const UI_COMPONENT_ABI = 'vict.ui-component-abi@1' as const;

/** Declared extension metadata (registered OUTSIDE serialized source). */
export interface UiExtensionDescriptor {
  readonly id: string;
  readonly revision: string;
  readonly props: readonly UiPropDecl[];
  readonly events?: readonly string[];
  readonly slots?: readonly string[];
  /**
   * Component-ABI marker (amendment §3.2): required for descriptors
   * declaring `outputs` or renderable slots, must equal the events marker.
   */
  readonly abi?: typeof UI_COMPONENT_ABI;
  /** Declared outputs (the reusable interface instances wire). */
  readonly outputs?: readonly UiOutputDecl[];
  readonly styleTargets?: readonly string[];
  /** Declared renderer implementation identity (never serialized source). */
  readonly rendererImplementationId: string;
  /** Declared inspection limits surfaced to editors/verifiers. */
  readonly inspectionLimits?: readonly string[];
}

/** Occurrence provenance (persisted in the plan's sourceMap). */
export interface UiSourceMapEntry {
  readonly occurrenceKey: string;
  readonly documentId: string;
  readonly sourceNodeId: string;
  readonly componentInstancePath: readonly string[];
}

export type UiResolvedValue =
  | { readonly type: 'literal'; readonly value: string | number | boolean | null }
  | { readonly type: 'expression'; readonly expression: UiExpression }
  | { readonly type: 'token'; readonly id: string };

export interface UiStyleRule {
  readonly ruleId: string;
  readonly layer: 'token' | 'componentBase' | 'componentVariant' | 'source' | 'local';
  /** Normalized single class selector (or `:root` for the token layer). */
  readonly selector: string;
  /** Viewport/media condition id (CSS @media) when the rule is conditioned. */
  readonly mediaConditionId?: string;
  /** Container condition id (CSS @container) when the rule is conditioned. */
  readonly containerConditionId?: string;
  /** Pseudo state appended to the selector (`.class:hover`). */
  readonly pseudo?: UiPseudoState;
  readonly declarations: readonly { readonly property: string; readonly value: UiResolvedValue }[];
}

export type UiRenderInstruction =
  | {
      readonly kind: 'element';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly tag: string;
      readonly attributes: readonly { readonly name: string; readonly value: UiResolvedValue }[];
      readonly classes: readonly string[];
      readonly styleRuleIds: readonly string[];
      readonly interactions: readonly UiNodeExtractedInteraction[];
      readonly children: readonly UiRenderInstruction[];
    }
  | {
      readonly kind: 'text';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly content:
        | { readonly type: 'literal'; readonly value: string }
        | { readonly type: 'expression'; readonly expression: UiExpression };
    }
  | {
      readonly kind: 'component';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly definitionId: string;
      readonly definitionRevision: string;
      readonly propDecls: readonly UiPropDecl[];
      readonly propValues: Readonly<Record<string, UiExpression>>;
      /** Normalized class for the instance root (base/local style rules target it). */
      readonly classes: readonly string[];
      /** The definition body instruction tree (prop scope). */
      readonly body: UiRenderInstruction;
      /** Slot fillings resolved in the INSTANCE scope. */
      readonly slots: Readonly<Record<string, readonly UiRenderInstruction[]>>;
      readonly styleRuleIds: readonly string[];
    }
  | {
      readonly kind: 'extension';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly extensionId: string;
      /** The instance's EFFECTIVE revision (node pin, else registered-current). */
      readonly revision: string;
      readonly propDecls: readonly UiPropDecl[];
      readonly propValues: Readonly<Record<string, UiExpression>>;
      /**
       * Compile-artifact marker (amendment §3.3): ALWAYS emitted for
       * component-ABI descriptors — `[]` when the author wired no outputs.
       * Its absence on an abi@1 instruction marks a pre-amendment artifact.
       */
      readonly classes?: readonly string[];
      readonly styleRuleIds?: readonly string[];
      readonly styleTargets?: readonly string[];
      readonly outputDecls?: readonly UiOutputDecl[];
      /** Authored connections, compile-checked. */
      readonly outputBindings?: Readonly<Record<string, UiOutputBinding>>;
      /** Instance-scope slot fills (declared slots only). */
      readonly slots?: Readonly<Record<string, readonly UiRenderInstruction[]>>;
    }
  | {
      readonly kind: 'repeat';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly collection: UiExpression;
      readonly key: UiExpression;
      readonly itemName: string;
      readonly template: UiRenderInstruction;
    }
  | {
      readonly kind: 'conditional';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly branches: readonly {
        readonly when?: string;
        readonly children: readonly UiRenderInstruction[];
      }[];
    }
  | {
      readonly kind: 'slot';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly name: string;
      readonly required: boolean;
      readonly fallback: readonly UiRenderInstruction[];
    }
  | {
      readonly kind: 'unsupported';
      readonly nodeId: string;
      readonly occurrenceKey: string;
      readonly feature: string;
      readonly children: readonly UiRenderInstruction[];
    };

export interface UiNodeExtractedInteraction {
  readonly on: 'click' | 'change' | 'submit';
  readonly action: 'invokeAction' | 'navigate' | 'setState';
  readonly actionId?: string;
  readonly routeId?: string;
  readonly stateKey?: string;
  readonly params: Readonly<Record<string, UiExpression>>;
}

export interface UiRenderPlan {
  readonly schema: typeof UI_RENDER_PLAN_SCHEMA;
  readonly documentId: string;
  readonly revision: string;
  readonly sourceDigest: string;
  readonly diagnostics: readonly UiDiagnostic[];
  readonly structure: readonly UiRenderInstruction[];
  readonly style: {
    readonly rules: readonly UiStyleRule[];
    readonly layers: readonly (
      'token' | 'componentBase' | 'componentVariant' | 'source' | 'local'
    )[];
  };
  readonly dynamic: {
    readonly repeats: readonly { readonly nodeId: string; readonly itemName: string }[];
    readonly conditions: readonly UiCondition[];
  };
  readonly extensions: readonly { readonly extensionId: string; readonly revision: string }[];
  readonly sourceMap: readonly UiSourceMapEntry[];
}

export type UiCompileResult =
  | { readonly ok: true; readonly plan: UiRenderPlan }
  | { readonly ok: false; readonly issues: readonly UiDiagnostic[] };

export function compileUiDocument(
  document: UiDocument,
  semanticCatalog: SemanticElementCatalog,
  extensions: readonly UiExtensionDescriptor[] = [],
  catalogs: {
    readonly actionIds?: readonly string[];
    readonly routeIds?: readonly string[];
    readonly viewFields?: UiCatalogs['viewFields'];
    readonly opNames?: readonly string[];
    readonly stateTypes?: UiCatalogs['stateTypes'];
    /**
     * Derived action-input catalog (amendment §3.5):
     * `actionId → { inputName → primitive type }`, derived by
     * `@victframework/application` from the action registry's input
     * contracts and passed through at the application compile call site.
     */
    readonly actionInputs?: Readonly<Record<string, Readonly<Record<string, UiValueType>>>>;
  } = {},
): UiCompileResult {
  const validation = validateUiDocument(document, {
    elements: semanticCatalog,
    ...(catalogs.actionIds !== undefined ? { actionIds: catalogs.actionIds } : { actionIds: [] }),
    ...(catalogs.routeIds !== undefined ? { routeIds: catalogs.routeIds } : { routeIds: [] }),
    ...(catalogs.viewFields !== undefined ? { viewFields: catalogs.viewFields } : {}),
    ...(catalogs.opNames !== undefined ? { opNames: catalogs.opNames } : {}),
    stateTypes: catalogs.stateTypes,
  });
  // Document-level validation cannot resolve product references (no
  // application inputs here); those UI_DOC_UNKNOWN_COMPONENT /
  // UI_DOC_UNKNOWN_PRODUCT_REFERENCE / UI_DOC_UNSUPPORTED_FEATURE findings
  // are compiler-resolved below via `extensions` + the application compiler.
  // When the caller supplies no view-field catalog, view/record field
  // references are likewise UNRESOLVED-not-invalid (rule 4 is the joint
  // compiler's obligation): they become non-fatal plan diagnostics while
  // remaining visible. Only structural errors abort compilation here.
  const hasFieldCatalog = catalogs.viewFields !== undefined;
  const isDeferredProductRef = (issue: UiDiagnostic): boolean =>
    !hasFieldCatalog &&
    issue.code === 'UI_EXPR_UNKNOWN_REFERENCE' &&
    typeof issue.path === 'string' &&
    (issue.path.startsWith('view.') || issue.path.startsWith('record.'));
  const structural = validation.filter(
    (issue) =>
      issue.code !== 'UI_DOC_UNKNOWN_COMPONENT' &&
      !(issue.code === 'UI_DOC_UNKNOWN_PRODUCT_REFERENCE' && (issue.kind === 'action' ? catalogs.actionIds === undefined : issue.kind === 'route' ? catalogs.routeIds === undefined : true)) &&
      issue.code !== 'UI_DOC_UNSUPPORTED_FEATURE' &&
      !isDeferredProductRef(issue),
  );
  const deferredRefs = validation.filter(isDeferredProductRef);
  if (hasErrors(structural)) {
    return { ok: false, issues: structural };
  }
  catalogs = { ...catalogs, stateTypes: Object.fromEntries(Object.entries(document.localState ?? {}).map(([key, decl]) => [key, decl.type])) };
  const { bytes, contentDigest } = canonicalUiDocument(document);
  void bytes;
  const documentId = String(document.id);
  const issues: UiDiagnostic[] = validation.filter((issue) => issue.severity === 'warning');
  const rules: UiStyleRule[] = [];
  const sourceMap: UiSourceMapEntry[] = [];
  const extensionRefs: { extensionId: string; revision: string }[] = [];
  const nodes = (document.nodes ?? {}) as Record<string, UiNode>;
  const definitions = (document.componentDefinitions ?? {}) as Record<
    string,
    UiComponentDefinition
  >;
  const extensionById = new Map(extensions.map((extension) => [extension.id, extension]));

  // deterministic normalized class per node
  const docHash = sha256(documentId).slice(0, 8);
  const classFor = (nodeId: string): string =>
    `uv-${docHash}-${nodeId.replace(/[^A-Za-z0-9_-]/g, '_')}`;

  // ---- token defaults layer ----------------------------------------------
  const tokenDeclarations = Object.entries(
    (document.tokens ?? {}) as Record<string, { value: string }>,
  ).map(([tokenId, token]) => ({
    // CSS custom-property-safe name (declared token ids may contain dots)
    property: `--ui-token-${tokenId.replace(/[^A-Za-z0-9_-]/g, '_')}`,
    value: { type: 'literal', value: token.value } as UiResolvedValue,
  }));
  if (tokenDeclarations.length > 0) {
    rules.push({
      ruleId: `${docHash}-tokens`,
      layer: 'token',
      selector: ':root',
      declarations: tokenDeclarations,
    });
  }

  const compileStyleDeclarations = (
    declarations: readonly { property: string; value: UiStyleValue }[] | undefined,
    ruleId: string,
    layer: UiStyleRule['layer'],
    selector: string,
    gating?: {
      readonly conditionId?: string;
      readonly pseudo?: UiPseudoState;
    },
  ): string | undefined => {
    if (declarations === undefined || declarations.length === 0) return undefined;
    // Resolve the condition gate: media → @media, container → @container,
    // environment/variant → DECLARED UNSUPPORTED (the rule is dropped, never
    // silently applied unconditioned).
    let mediaConditionId: string | undefined;
    let containerConditionId: string | undefined;
    if (gating?.conditionId !== undefined) {
      const condition = (document.conditions ?? ({} as Record<string, UiCondition>))[
        gating.conditionId
      ];
      if (condition === undefined) {
        issues.push(
          uiDiagnostic(
            'UI_STYLE_CONDITION_UNKNOWN',
            `Unknown style condition '${gating.conditionId}'.`,
            {
              documentId,
              conditionId: gating.conditionId,
            },
          ),
        );
        return undefined;
      }
      if (condition.kind === 'media') mediaConditionId = condition.id;
      else if (condition.kind === 'container') containerConditionId = condition.id;
      else {
        issues.push(
          uiDiagnostic(
            'UI_DOC_UNSUPPORTED_FEATURE',
            `Style condition kind '${condition.kind}' is unsupported; the conditioned rule is dropped (declared limitation).`,
            { documentId, feature: `condition:${condition.kind}` },
          ),
        );
        return undefined;
      }
    }
    const compiled = declarations.map((declaration) => {
      let value: UiResolvedValue;
      if (declaration.value.type === 'text') {
        value = { type: 'literal', value: declaration.value.value };
      } else if (declaration.value.type === 'token') {
        value = { type: 'token', id: declaration.value.id };
      } else {
        value = { type: 'expression', expression: declaration.value.expression };
      }
      return { property: declaration.property, value };
    });
    rules.push({
      ruleId,
      layer,
      // The pseudo suffix travels in `rule.pseudo`; the RENDERER composes
      // `.class:pseudo` after its own escaping (a pseudo colon is selector
      // syntax — escaping it makes the rule unmatchable, see F1).
      selector,
      ...(mediaConditionId !== undefined ? { mediaConditionId } : {}),
      ...(containerConditionId !== undefined ? { containerConditionId } : {}),
      ...(gating?.pseudo !== undefined ? { pseudo: gating.pseudo } : {}),
      declarations: compiled,
    });
    return ruleId;
  };

  const occurrenceKey = (nodeId: string, instancePath: readonly string[]): string =>
    [documentId, nodeId, ...instancePath].join('|');

  let definitionExpansionGuard = 0;

  const compileNode = (
    nodeId: string,
    scope: { inDefinition: boolean; instancePath: readonly string[]; repeatItems?: UiScopeInfo['repeatItems']; propTypes?: UiScopeInfo['propTypes'] },
  ): UiRenderInstruction => {
    const node = nodes[nodeId];
    if (node === undefined) {
      // Validation catches this; defensively emit an explicit placeholder.
      return {
        kind: 'unsupported',
        nodeId,
        occurrenceKey: occurrenceKey(nodeId, scope.instancePath),
        feature: 'missing-node',
        children: [],
      };
    }
    const key = occurrenceKey(nodeId, scope.instancePath);
    sourceMap.push({
      occurrenceKey: key,
      documentId,
      sourceNodeId: nodeId,
      componentInstancePath: [...scope.instancePath],
    });
    switch (node.kind) {
      case 'element': {
        const styleRuleIds: string[] = [];
        for (const sourceId of node.styleSources ?? []) {
          const source = (document.styleSources ?? ({} as Record<string, never>))[sourceId] as
            UiStyleSource | undefined;
          const ruleId = compileStyleDeclarations(
            source?.declarations,
            `${classFor(nodeId)}-s${styleRuleIds.length}`,
            // Frozen cascade: style sources INSIDE a definition body are part
            // of the shared component presentation (component base layer);
            // sources attached at an INSTANCE site are the instance-override
            // layer ('source') and therefore win over the shared base.
            scope.inDefinition ? 'componentBase' : 'source',
            `.${classFor(nodeId)}`,
            { conditionId: source?.conditionId, pseudo: source?.pseudo },
          );
          if (ruleId !== undefined) styleRuleIds.push(ruleId);
        }
        const localRuleId = compileStyleDeclarations(
          node.localStyle,
          `${classFor(nodeId)}-l`,
          // Frozen cascade: a localStyle INSIDE a definition body is part of
          // the shared component presentation (component base layer) - it
          // must never compete with (let alone override, by CSS order) an
          // INSTANCE's localStyle, which is the innermost 'local' layer.
          scope.inDefinition ? 'componentBase' : 'local',
          `.${classFor(nodeId)}`,
        );
        if (localRuleId !== undefined) styleRuleIds.push(localRuleId);
        const attributes = Object.entries(node.attributes ?? {}).map(([name, value]) => ({
          name,
          value: resolveAttributeValue(value),
        }));
        return {
          kind: 'element',
          nodeId,
          occurrenceKey: key,
          tag: node.tag,
          attributes,
          classes: [...(node.classes ?? []), classFor(nodeId)],
          styleRuleIds,
          interactions: (node.interactions ?? []).map(extractInteraction),
          children: node.children.map((childId) => compileNode(childId, scope)),
        };
      }
      case 'text':
        return {
          kind: 'text',
          nodeId,
          occurrenceKey: key,
          content:
            node.content.type === 'literal'
              ? { type: 'literal', value: node.content.value }
              : { type: 'expression', expression: node.content.expression },
        };
      case 'component': {
        const definition = definitions[node.definitionId];
        if (definition === undefined) {
          const withId = extensions.filter((extension) => extension.id === node.definitionId);
          if (withId.length === 0) {
            issues.push(
              uiDiagnostic('EXTENSION_UNAVAILABLE', `Neither definition nor extension resolves.`, {
                extensionId: node.definitionId,
              }),
            );
            return {
              kind: 'unsupported',
              nodeId,
              occurrenceKey: key,
              feature: 'unresolved-component',
              children: [],
            };
          }
          // Effective revision (amendment §3.1/§4.1): the node pin when
          // present, else the registered-current descriptor revision (the
          // last registration for the id — today's exact semantics).
          const current = extensionById.get(node.definitionId)!;
          const effectiveRevision = node.revision ?? current.revision;
          const matches = withId.filter(entry => entry.revision === effectiveRevision);
          if (matches.length > 1) issues.push(uiDiagnostic('UI_COMPONENT_REVISION_UNRESOLVED',
            'Competing descriptors have the same effective identity.', { documentId, nodeId, extensionId: node.definitionId, revision: effectiveRevision }));
          const descriptor = matches.length === 1 ? matches[0] : undefined;
          if (descriptor === undefined) {
            // Fail closed: a pin matching no registered revision is a
            // compile diagnostic, never a silent fallback to another
            // revision (the render side also fails: no descriptor matches
            // the compiled identity).
            issues.push(
              uiDiagnostic(
                'UI_COMPONENT_REVISION_UNRESOLVED',
                `Instance pin (${node.definitionId}, ${effectiveRevision}) matches no registered descriptor revision.`,
                { documentId, nodeId, extensionId: node.definitionId, revision: effectiveRevision },
              ),
            );
            extensionRefs.push({ extensionId: node.definitionId, revision: effectiveRevision });
            return {
              kind: 'extension',
              nodeId,
              occurrenceKey: key,
              extensionId: node.definitionId,
              revision: effectiveRevision,
              propDecls: [],
              propValues: (node.props ?? {}) as Record<string, UiExpression>,
            };
          }
          const compiledExtension = compileExtensionInstance(
            node,
            descriptor,
            effectiveRevision,
            key,
            documentId,
            document,
            { ...catalogs, elements: semanticCatalog },
            (childId) => compileNode(childId, { ...scope, instancePath: [...scope.instancePath, `${nodeId}@${node.definitionId}`] }),
            { inDefinition: scope.inDefinition, repeatItems: scope.repeatItems ?? {}, propTypes: scope.propTypes },
          );
          issues.push(...compiledExtension.issues);
          extensionRefs.push({ extensionId: descriptor.id, revision: effectiveRevision });
          const styleRuleIds: string[] = [];
          if ((node.localStyle?.length ?? 0) > 0 || (node.styleSources?.length ?? 0) > 0 || (node.classes?.length ?? 0) > 0) {
            if ((descriptor.styleTargets?.length ?? 0) === 0) issues.push(uiDiagnostic('UI_COMPONENT_BINDING_INCOMPATIBLE',
              'This component declares no editable style target.', { documentId, nodeId, feature: 'component-style' }));
          }
          for (const sourceId of node.styleSources ?? []) {
            const source = document.styleSources[sourceId];
            const id = compileStyleDeclarations(source?.declarations, `${classFor(nodeId)}-s${styleRuleIds.length}`,
              scope.inDefinition ? 'componentBase' : 'source', `.${classFor(nodeId)}`, { conditionId: source?.conditionId, pseudo: source?.pseudo });
            if (id !== undefined) styleRuleIds.push(id);
          }
          const localId = compileStyleDeclarations(node.localStyle, `${classFor(nodeId)}-l`, scope.inDefinition ? 'componentBase' : 'local', `.${classFor(nodeId)}`);
          if (localId !== undefined) styleRuleIds.push(localId);
          return { ...compiledExtension.instruction, classes: [...(node.classes ?? []), classFor(nodeId)], styleRuleIds, styleTargets: descriptor.styleTargets ?? [] };
        }
        definitionExpansionGuard += 1;
        if (definitionExpansionGuard > 256) {
          issues.push(
            uiDiagnostic('UI_DOC_CYCLE', 'Definition expansion exceeded the safety bound.', {
              documentId,
              path: [node.definitionId],
            }),
          );
          definitionExpansionGuard -= 1;
          return {
            kind: 'unsupported',
            nodeId,
            occurrenceKey: key,
            feature: 'expansion-bound',
            children: [],
          };
        }
        const body = compileNode(definition.root, {
          inDefinition: true,
          propTypes: Object.fromEntries(definition.props.map(prop => [prop.name, prop.type])),
          instancePath: [...scope.instancePath, `${nodeId}@${node.definitionId}`],
        });
        definitionExpansionGuard -= 1;
        const slots: Record<string, readonly UiRenderInstruction[]> = {};
        for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
          slots[slotName] = fill.children.map((childId) => compileNode(childId, scope));
        }
        const styleRuleIds: string[] = [];
        // U2-01/U2-03: instance-attached style sources are part of the
        // instance override surface (cascade layer 'source') — the overlap
        // card and the intentional accent override rely on them.
        for (const sourceId of node.styleSources ?? []) {
          const instanceSource = (document.styleSources ?? ({} as Record<string, never>))[
            sourceId
          ] as UiStyleSource | undefined;
          const instanceRuleId = compileStyleDeclarations(
            instanceSource?.declarations,
            `${classFor(nodeId)}-s${styleRuleIds.length}`,
            'source',
            `.${classFor(nodeId)}`,
            { conditionId: instanceSource?.conditionId, pseudo: instanceSource?.pseudo },
          );
          if (instanceRuleId !== undefined) styleRuleIds.push(instanceRuleId);
        }
        if (definition.baseStyle !== undefined) {
          const base = (document.styleSources ?? ({} as Record<string, never>))[
            definition.baseStyle
          ] as { declarations?: readonly { property: string; value: UiStyleValue }[] } | undefined;
          const ruleId = compileStyleDeclarations(
            base?.declarations,
            `${classFor(nodeId)}-b`,
            'componentBase',
            `.${classFor(nodeId)}`,
          );
          if (ruleId !== undefined) styleRuleIds.push(ruleId);
        }
        const localRuleId = compileStyleDeclarations(
          node.localStyle,
          `${classFor(nodeId)}-l`,
          'local',
          `.${classFor(nodeId)}`,
        );
        if (localRuleId !== undefined) styleRuleIds.push(localRuleId);
        return {
          kind: 'component',
          nodeId,
          occurrenceKey: key,
          definitionId: node.definitionId,
          definitionRevision: node.revision ?? definition.revision,
          propDecls: definition.props,
          propValues: (node.props ?? {}) as Record<string, UiExpression>,
          classes: [...(node.classes ?? []), classFor(nodeId)],
          body,
          slots,
          styleRuleIds,
        };
      }
      case 'repeat':
        return {
          kind: 'repeat',
          nodeId,
          occurrenceKey: key,
          collection: node.collection,
          key: node.key,
          itemName: node.itemName,
          template: compileNode(node.templateRoot, { ...scope, repeatItems: { ...scope.repeatItems, [node.itemName]: repeatExpressionFields(node.collection, catalogs.viewFields) } }),
        };
      case 'conditional':
        return {
          kind: 'conditional',
          nodeId,
          occurrenceKey: key,
          branches: node.branches.map((branch) => ({
            ...(branch.when !== undefined ? { when: branch.when } : {}),
            children: branch.children.map((childId) => compileNode(childId, scope)),
          })),
        };
      case 'slot':
        return {
          kind: 'slot',
          nodeId,
          occurrenceKey: key,
          name: node.name,
          required: node.required === true,
          fallback: (node.fallback ?? []).map((childId) => compileNode(childId, scope)),
        };
      case 'portal':
        issues.push(
          uiDiagnostic(
            'UI_DOC_UNSUPPORTED_FEATURE',
            'Portal rendering is unsupported; its logical child ownership stays in occurrence provenance (U2-02).',
            {
              documentId,
              nodeId,
              feature: 'portal',
            },
          ),
        );
        return {
          kind: 'unsupported',
          nodeId,
          occurrenceKey: key,
          feature: 'portal',
          children: node.children.map((childId) =>
            // Occurrence identity carries the portal ownership segment so a
            // node presented through a portal keeps its LOGICAL owner in
            // provenance even while the visual placement is unsupported.
            compileNode(childId, {
              inDefinition: scope.inDefinition,
              instancePath: [...scope.instancePath, `portal:${nodeId}:${node.target.overlayId}`],
            }),
          ),
        };
    }
  };

  const structure: UiRenderInstruction[] = [
    compileNode(String(document.root), { inDefinition: false, instancePath: [] }),
  ];

  const conditions = Object.values((document.conditions ?? {}) as Record<string, UiCondition>);
  const repeats: { nodeId: string; itemName: string }[] = [];
  const collectRepeats = (instruction: UiRenderInstruction): void => {
    if (instruction.kind === 'repeat') {
      repeats.push({ nodeId: instruction.nodeId, itemName: instruction.itemName });
      collectRepeats(instruction.template);
    } else if (instruction.kind === 'element') {
      instruction.children.forEach(collectRepeats);
    } else if (instruction.kind === 'component') {
      collectRepeats(instruction.body);
      Object.values(instruction.slots).forEach((children) => children.forEach(collectRepeats));
    } else if (instruction.kind === 'extension') {
      Object.values(instruction.slots ?? {}).forEach(children => children.forEach(collectRepeats));
    } else if (instruction.kind === 'conditional') {
      instruction.branches.forEach((branch) => branch.children.forEach(collectRepeats));
    } else if (instruction.kind === 'slot') {
      instruction.fallback.forEach(collectRepeats);
    } else if (instruction.kind === 'unsupported') {
      instruction.children.forEach(collectRepeats);
    }
  };
  structure.forEach(collectRepeats);

  if (hasErrors(issues)) return { ok: false, issues };

  const plan: UiRenderPlan = {
    schema: UI_RENDER_PLAN_SCHEMA,
    documentId,
    revision: String(document.revision),
    sourceDigest: contentDigest,
    diagnostics: [...issues, ...deferredRefs],
    structure,
    style: {
      rules,
      layers: ['token', 'componentBase', 'componentVariant', 'source', 'local'],
    },
    dynamic: { repeats, conditions },
    extensions: extensionRefs,
    sourceMap,
  };
  return { ok: true, plan };
}

interface UiCompileCatalogs {
  readonly elements: SemanticElementCatalog;
  readonly actionIds?: readonly string[];
  readonly routeIds?: readonly string[];
  readonly viewFields?: UiCatalogs['viewFields'];
  readonly opNames?: readonly string[];
  readonly stateTypes?: UiCatalogs['stateTypes'];
  readonly actionInputs?: Readonly<Record<string, Readonly<Record<string, UiValueType>>>>;
}

interface CompileExtensionOutcome {
  readonly instruction: Extract<UiRenderInstruction, { kind: 'extension' }>;
  readonly issues: UiDiagnostic[];
}

/**
 * Compile one descriptor-backed component instance (amendment §3.2–§3.7):
 * the ABI gate, effective-revision carry, always-emitted `outputDecls`
 * (the compile-artifact marker), compile-checked output bindings and
 * typed prop checks, and instance-scope slot fills (declared slots only —
 * undeclared fills are REJECTED, never silently dropped).
 */
function compileExtensionInstance(
  node: Extract<UiNode, { kind: 'component' }>,
  descriptor: UiExtensionDescriptor,
  effectiveRevision: string,
  occurrenceKey: string,
  documentId: string,
  document: UiDocument,
  catalogs: UiCompileCatalogs,
  compileChild: (childId: string) => UiRenderInstruction,
  lexicalScope: UiScopeInfo,
): CompileExtensionOutcome {
  const issues: UiDiagnostic[] = [];
  const hasOutputs = (descriptor.outputs?.length ?? 0) > 0;
  const hasSlots = (descriptor.slots?.length ?? 0) > 0;
  const isComponentAbi = descriptor.abi !== undefined || hasOutputs || hasSlots;
  if (
    isComponentAbi &&
    (descriptor.abi !== UI_COMPONENT_ABI ||
      descriptor.events?.length !== 1 ||
      descriptor.events[0] !== UI_COMPONENT_ABI)
  ) {
    // Malformed component-ABI descriptor: missing `abi`, missing the events
    // marker, or a disagreeing marker/abi pair (§5.1). The render side
    // re-checks and fail-closes independently.
    issues.push(
      uiDiagnostic(
        'UI_COMPONENT_ABI_UNSUPPORTED',
        `Descriptor '${descriptor.id}' declares component-ABI surface without a consistent ${UI_COMPONENT_ABI} marker/abi pair.`,
        { documentId, nodeId: node.id, extensionId: descriptor.id, revision: effectiveRevision },
      ),
    );
  }

  // --- typed prop checks for descriptor instances (§5.1, built here) ------
  for (const [propName, expression] of Object.entries(node.props ?? {})) {
    const propDecl = descriptor.props.find((candidate) => candidate.name === propName);
    if (propDecl === undefined) {
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNKNOWN_PROP',
          `Descriptor '${descriptor.id}' declares no prop '${propName}'.`,
          { documentId, nodeId: node.id, definitionId: descriptor.id, prop: propName },
        ),
      );
      continue;
    }
    issues.push(...checkExpressionTarget(expression, propDecl.type, catalogs, lexicalScope, documentId, node.id));
  }
  for (const prop of descriptor.props) {
    if (prop.default !== undefined && (prop.type === 'array' || !isUiValueOfType(prop.default, prop.type))) {
      issues.push(uiDiagnostic(prop.type === 'isoDate' || prop.type === 'isoTime' ? 'UI_DOC_INVALID_LITERAL' : 'UI_EXPR_TYPE_MISMATCH', `Invalid default for prop '${prop.name}'.`, { documentId, nodeId: node.id, expected: prop.type, actual: typeof prop.default }));
    }
  }

  // --- output bindings (§3.5/§5.1) -----------------------------------------
  const outputDecls = isComponentAbi ? (descriptor.outputs ?? []) : undefined;
  const authoredBindings = node.outputs ?? {};
  for (const [outputName, binding] of Object.entries(authoredBindings)) {
    if (outputDecls === undefined) {
      issues.push(uiDiagnostic('UI_COMPONENT_ABI_UNSUPPORTED', 'Output bindings require a component ABI descriptor.', { documentId, nodeId: node.id, extensionId: descriptor.id }));
      break;
    } // non-ABI descriptor: nothing declared to check against
    const decl = outputDecls.find((candidate) => candidate.name === outputName);
    if (decl === undefined) {
      issues.push(
        uiDiagnostic(
          'UI_COMPONENT_OUTPUT_UNKNOWN',
          `Descriptor '${descriptor.id}' declares no output '${outputName}'.`,
          { documentId, nodeId: node.id, extensionId: descriptor.id, output: outputName },
        ),
      );
      continue;
    }
    if ('setState' in binding) {
      const stateDecl = (document.localState ?? {})[binding.setState.key];
      if (stateDecl !== undefined) {
        if (decl.payload === 'void' || stateDecl.type !== decl.payload) {
          // Widened compatibility compares declared types with NO coercion
          // (§10.1a boundary 7); a 'void' payload equals no state type.
          issues.push(
            uiDiagnostic(
              'UI_COMPONENT_BINDING_INCOMPATIBLE',
              `Output '${outputName}' payload ${decl.payload} is incompatible with state '${binding.setState.key}' type ${stateDecl.type}.`,
              {
                documentId,
                nodeId: node.id,
                output: outputName,
                payload: decl.payload,
                stateKey: binding.setState.key,
                stateType: stateDecl.type,
              },
            ),
          );
        } else if (binding.setState.value !== undefined) {
          issues.push(
            ...checkBindingExpression(
              binding.setState.value,
              stateDecl.type,
              decl.payload,
              catalogs,
              documentId,
              node.id,
              lexicalScope,
            ),
          );
        }
      }
    } else if ('invokeAction' in binding) {
      const inputTypes = catalogs.actionInputs?.[binding.invokeAction.actionId];
      for (const [inputName, expression] of Object.entries(binding.invokeAction.input ?? {})) {
        if (inputTypes === undefined) {
          // No derived input catalog: expression validity only ($output
          // typed); shape checking stays with the dispatcher's contract
          // checks (unchanged authority).
          issues.push(
            ...checkBindingExpression(
              expression,
              undefined,
              decl.payload,
              catalogs,
              documentId,
              node.id,
              lexicalScope,
            ),
          );
          continue;
        }
        const expected = inputTypes[inputName];
        if (expected === undefined) {
          issues.push(
            uiDiagnostic(
              'UI_COMPONENT_BINDING_INCOMPATIBLE',
              `Action '${binding.invokeAction.actionId}' declares no input '${inputName}'.`,
              {
                documentId,
                nodeId: node.id,
                output: outputName,
                actionId: binding.invokeAction.actionId,
                input: inputName,
              },
            ),
          );
          continue;
        }
        issues.push(
          ...checkBindingExpression(
            expression,
            expected,
            decl.payload,
            catalogs,
            documentId,
            node.id,
            lexicalScope,
          ),
        );
      }
    }
  }

  // --- slot fills: declared slots only (§3.7) -------------------------------
  const slots: Record<string, readonly UiRenderInstruction[]> = {};
  for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
    if (!(descriptor.slots ?? []).includes(slotName)) {
      // Undeclared fills are REJECTED at compile (today's path silently
      // dropped them — one of the gaps this contract closes).
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNKNOWN_COMPONENT',
          `Descriptor '${descriptor.id}' declares no slot '${slotName}'.`,
          { documentId, nodeId: node.id, definitionId: `${descriptor.id}#${slotName}` },
        ),
      );
      continue;
    }
    slots[slotName] = fill.children.map(compileChild);
  }

  const instruction: Extract<UiRenderInstruction, { kind: 'extension' }> = {
    kind: 'extension',
    nodeId: node.id,
    occurrenceKey,
    extensionId: descriptor.id,
    revision: effectiveRevision,
    propDecls: descriptor.props,
    propValues: (node.props ?? {}) as Record<string, UiExpression>,
    ...(outputDecls !== undefined ? { outputDecls } : {}),
    ...(outputDecls !== undefined ? { outputBindings: authoredBindings } : {}),
    ...(Object.keys(slots).length > 0 ? { slots } : {}),
  };
  return { instruction, issues };
}

function resolveAttributeValue(value: UiAttributeValue): UiResolvedValue {
  if (typeof value === 'string') return { type: 'literal', value };
  return { type: 'expression', expression: value };
}

function extractInteraction(interaction: UiInteraction): UiNodeExtractedInteraction {
  const base = { on: interaction.on } as UiNodeExtractedInteraction;
  if (interaction.action === 'invokeAction') {
    return {
      ...base,
      action: 'invokeAction',
      actionId: interaction.actionId,
      params: interaction.input ?? {},
    };
  }
  if (interaction.action === 'navigate') {
    return {
      ...base,
      action: 'navigate',
      routeId: interaction.routeId,
      params: interaction.params ?? {},
    };
  }
  return {
    ...base,
    action: 'setState',
    stateKey: interaction.key,
    params: { value: interaction.value },
  };
}

/** Binding targets use the same value-aware checker as properties. */
function checkBindingExpression(
  expression: UiExpression, expected: UiValueType | undefined, payloadType: UiValueType | 'void',
  catalogs: UiCatalogs, documentId: string, nodeId: string, lexicalScope: UiScopeInfo,
): UiDiagnostic[] {
  const scope = { ...lexicalScope, output: payloadType };
  return expected === undefined
    ? checkExpression(expression, catalogs, scope, documentId, nodeId)
    : checkExpressionTarget(expression, expected, catalogs, scope, documentId, nodeId, 'UI_COMPONENT_BINDING_INCOMPATIBLE');
}
