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
  UiPropDecl,
  UiStyleSource,
  UiStyleValue,
} from './document.js';
import { UI_RENDER_PLAN_SCHEMA } from './document.js';
import { canonicalUiDocument } from './canonical.js';
import { hasErrors, uiDiagnostic, type UiDiagnostic } from './diagnostics.js';
import { sha256 } from './sha256.js';
import { validateUiDocument } from './validate.js';

/** Declared extension metadata (registered OUTSIDE serialized source). */
export interface UiExtensionDescriptor {
  readonly id: string;
  readonly revision: string;
  readonly props: readonly UiPropDecl[];
  readonly events?: readonly string[];
  readonly slots?: readonly string[];
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
      readonly revision: string;
      readonly propDecls: readonly UiPropDecl[];
      readonly propValues: Readonly<Record<string, UiExpression>>;
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
  } = {},
): UiCompileResult {
  const validation = validateUiDocument(document, {
    elements: semanticCatalog,
    ...(catalogs.actionIds !== undefined ? { actionIds: catalogs.actionIds } : { actionIds: [] }),
    ...(catalogs.routeIds !== undefined ? { routeIds: catalogs.routeIds } : { routeIds: [] }),
    ...(catalogs.viewFields !== undefined ? { viewFields: catalogs.viewFields } : {}),
    ...(catalogs.opNames !== undefined ? { opNames: catalogs.opNames } : {}),
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
      issue.code !== 'UI_DOC_UNKNOWN_PRODUCT_REFERENCE' &&
      issue.code !== 'UI_DOC_UNSUPPORTED_FEATURE' &&
      !isDeferredProductRef(issue),
  );
  const deferredRefs = validation.filter(isDeferredProductRef);
  if (hasErrors(structural)) {
    return { ok: false, issues: structural };
  }
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
    mediaConditionId?: string,
  ): string | undefined => {
    if (declarations === undefined || declarations.length === 0) return undefined;
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
      selector,
      ...(mediaConditionId !== undefined ? { mediaConditionId } : {}),
      declarations: compiled,
    });
    return ruleId;
  };

  const occurrenceKey = (nodeId: string, instancePath: readonly string[]): string =>
    [documentId, nodeId, ...instancePath].join('|');

  let definitionExpansionGuard = 0;

  const compileNode = (
    nodeId: string,
    scope: { inDefinition: boolean; instancePath: readonly string[] },
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
            'source',
            `.${classFor(nodeId)}`,
            source?.conditionId,
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
          const extension = extensionById.get(node.definitionId);
          if (extension === undefined) {
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
          extensionRefs.push({ extensionId: extension.id, revision: extension.revision });
          return {
            kind: 'extension',
            nodeId,
            occurrenceKey: key,
            extensionId: extension.id,
            revision: extension.revision,
            propDecls: extension.props,
            propValues: (node.props ?? {}) as Record<string, UiExpression>,
          };
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
          instancePath: [...scope.instancePath, `${nodeId}@${node.definitionId}`],
        });
        definitionExpansionGuard -= 1;
        const slots: Record<string, readonly UiRenderInstruction[]> = {};
        for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
          slots[slotName] = fill.children.map((childId) => compileNode(childId, scope));
        }
        const styleRuleIds: string[] = [];
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
          classes: [classFor(nodeId)],
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
          template: compileNode(node.templateRoot, scope),
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
            'Portal rendering is pending beyond the U1 slice.',
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
          children: node.children.map((childId) => compileNode(childId, scope)),
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
    } else if (instruction.kind === 'conditional') {
      instruction.branches.forEach((branch) => branch.children.forEach(collectRepeats));
    } else if (instruction.kind === 'slot') {
      instruction.fallback.forEach(collectRepeats);
    } else if (instruction.kind === 'unsupported') {
      instruction.children.forEach(collectRepeats);
    }
  };
  structure.forEach(collectRepeats);

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
