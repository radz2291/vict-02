/**
 * `vict.ui-document@1` — the canonical UI document model (API-SPEC §3).
 *
 * Pure data: every value here is JSON-serializable canonical form. No
 * functions, no DOM, no framework types. Frozen at U0; U1 implements the
 * bounded slice (element/text/component, simple repeat, literal and typed
 * references, basic interactions, local state, token/local styles, a
 * viewport condition) and keeps later capabilities explicitly pending.
 */

export const UI_DOCUMENT_SCHEMA = 'vict.ui-document@1';
export const UI_RENDER_PLAN_SCHEMA = 'vict.ui-render-plan@1';
export const UI_EDIT_SCHEMA = 'vict.ui-edit@1';
export const UI_SCENARIO_SCHEMA = 'vict.ui-scenario@1';

export type NodeId = string;
export type DefinitionId = string;
export type StyleSourceId = string;
export type TokenId = string;
export type ConditionId = string;
export type StateKey = string;
export type AssetId = string;

/** Primitive expression/value types shared by props, state and fields. */
export type UiPrimitiveType = 'string' | 'number' | 'boolean';
/** Catalog field types: primitives plus array-valued fields (repeat collections). */
export type UiFieldType = UiPrimitiveType | 'array';

/** Finite, declarative expression tree (API-SPEC §5). Never `eval`. */
export type UiExpression =
  | { readonly type: 'literal'; readonly value: string | number | boolean | null }
  | { readonly type: 'ref'; readonly path: string }
  | {
      readonly type: 'compare';
      readonly op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
      readonly left: UiExpression;
      readonly right: UiExpression;
    }
  | {
      readonly type: 'boolean';
      readonly op: 'and' | 'or' | 'not';
      readonly terms: readonly UiExpression[];
    }
  | {
      readonly type: 'conditionalValue';
      readonly when: UiExpression;
      readonly then: UiExpression;
      readonly otherwise: UiExpression;
    }
  | { readonly type: 'op'; readonly name: string; readonly args: readonly UiExpression[] };

/** Text content: a literal or a typed expression. */
export type UiTextContent =
  | { readonly type: 'literal'; readonly value: string }
  | { readonly type: 'expression'; readonly expression: UiExpression };

/** Attribute/prop values: a literal string or an expression. */
export type UiAttributeValue = string | UiExpression;

/** One interaction declared on a node (U1: basic click/change/submit). */
export type UiInteraction =
  | {
      readonly on: 'click';
      readonly action: 'invokeAction';
      readonly actionId: string;
      readonly input?: Readonly<Record<string, UiExpression>>;
    }
  | {
      readonly on: 'click';
      readonly action: 'navigate';
      readonly routeId: string;
      readonly params?: Readonly<Record<string, UiExpression>>;
    }
  | {
      readonly on: 'change';
      readonly action: 'setState';
      readonly key: StateKey;
      readonly value: UiExpression;
    }
  | {
      readonly on: 'submit';
      readonly action: 'invokeAction';
      readonly actionId: string;
      readonly input?: Readonly<Record<string, UiExpression>>;
    };

/** One CSS declaration. Values are presentation data, never JavaScript. */
export type UiStyleValue =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'token'; readonly id: TokenId }
  | { readonly type: 'binding'; readonly expression: UiExpression };

export interface UiStyleDeclaration {
  readonly property: string;
  readonly value: UiStyleValue;
}

/** A reusable, attachable style source (cascade: attached reusable sources). */
export interface UiStyleSource {
  readonly id: StyleSourceId;
  readonly declarations: readonly UiStyleDeclaration[];
  /** Optional condition id (U1: media/viewport conditions) gating this rule. */
  readonly conditionId?: ConditionId;
}

/** A named token/custom-property declaration. */
export interface UiToken {
  readonly id: TokenId;
  readonly value: string;
}

/** Named, persisted, ordered condition records (no hard-coded breakpoints). */
export type UiCondition =
  | { readonly id: ConditionId; readonly kind: 'media'; readonly query: string }
  | { readonly id: ConditionId; readonly kind: 'localState'; readonly when: UiExpression }
  | {
      readonly id: ConditionId;
      readonly kind: 'container';
      readonly name: string;
      readonly query: string;
    }
  | { readonly id: ConditionId; readonly kind: 'environment'; readonly name: string }
  | {
      readonly id: ConditionId;
      readonly kind: 'variant';
      readonly variant: string;
      readonly value: string;
    };

/** Typed local state declaration with a serializable initial value. */
export interface UiLocalStateDecl {
  readonly key: StateKey;
  readonly type: UiPrimitiveType;
  readonly initial: string | number | boolean;
}

/** Asset reference: content digests or external hrefs; never embedded binaries. */
export type UiAssetRef =
  | { readonly id: AssetId; readonly kind: 'digest'; readonly digest: string }
  | { readonly id: AssetId; readonly kind: 'external'; readonly href: string };

/** Typed component prop declaration. */
export interface UiPropDecl {
  readonly name: string;
  readonly type: UiPrimitiveType;
  readonly default?: string | number | boolean;
}

/** Declared variant condition reference (pending beyond U1). */
export interface UiVariantConditionRef {
  readonly conditionId: ConditionId;
}

/**
 * A stored component definition: one source of truth, instantiated many
 * times; instances never acquire multiple source parents (API-SPEC §3).
 */
export interface UiComponentDefinition {
  readonly id: DefinitionId;
  readonly revision: string;
  readonly root: NodeId;
  readonly props: readonly UiPropDecl[];
  readonly slots: Readonly<
    Record<string, { readonly required?: boolean; readonly fallback?: readonly NodeId[] }>
  >;
  readonly variants?: Readonly<Record<string, UiVariantConditionRef>>;
  readonly baseStyle?: StyleSourceId;
}

/**
 * Slot filling authored at the INSTANCE site: children resolved in the
 * instance's document scope (never the definition's prop scope).
 */
export interface UiSlotFill {
  readonly name: string;
  readonly children: readonly NodeId[];
}

/** Common optional presentation/behavior fields shared by all node kinds. */
export interface UiNodeCommon {
  /** Attached reusable style sources, in authoring order (later wins). */
  readonly styleSources?: readonly StyleSourceId[];
  /** Instance-local style declarations (innermost cascade layer). */
  readonly localStyle?: readonly UiStyleDeclaration[];
  /** Declared interactions (U1: click/change/submit basics). */
  readonly interactions?: readonly UiInteraction[];
  /** Class names merged with the generated normalized class (presentation-only). */
  readonly classes?: readonly string[];
}

export type UiNode = UiNodeCommon &
  (
    | {
        readonly kind: 'element';
        readonly id: NodeId;
        readonly tag: string;
        readonly attributes?: Readonly<Record<string, UiAttributeValue>>;
        /** Ordered children (meaningful sequence semantics). */
        readonly children: readonly NodeId[];
      }
    | {
        readonly kind: 'text';
        readonly id: NodeId;
        readonly content: UiTextContent;
      }
    | {
        readonly kind: 'component';
        readonly id: NodeId;
        readonly definitionId: DefinitionId;
        /** Pin an exact definition revision; omitted = current document revision. */
        readonly revision?: string;
        /** Typed prop values (expressions resolved in the instance scope). */
        readonly props?: Readonly<Record<string, UiExpression>>;
        /** Instance slot fillings (resolved in the instance scope). */
        readonly slots?: Readonly<Record<string, UiSlotFill>>;
      }
    | {
        readonly kind: 'repeat';
        readonly id: NodeId;
        /** Collection expression resolving to an array in the current scope. */
        readonly collection: UiExpression;
        /** Stable key expression evaluated per record (unique per scope). */
        readonly key: UiExpression;
        readonly itemName: string;
        /** The repeated template subtree root. */
        readonly templateRoot: NodeId;
      }
    | {
        readonly kind: 'conditional';
        readonly id: NodeId;
        readonly branches: readonly {
          /** Named condition for this branch; omitted = final else branch. */
          readonly when?: ConditionId;
          readonly children: readonly NodeId[];
        }[];
      }
    | {
        readonly kind: 'slot';
        readonly id: NodeId;
        readonly name: string;
        readonly required?: boolean;
        readonly fallback?: readonly NodeId[];
      }
    | {
        readonly kind: 'portal';
        readonly id: NodeId;
        readonly target: { readonly overlayId: string };
        readonly children: readonly NodeId[];
      }
  );

/** The `vict.ui-document@1` document. */
export interface UiDocument {
  readonly schema: typeof UI_DOCUMENT_SCHEMA;
  /** Stable document id (`documentId`). */
  readonly id: string;
  /** Advances only at authoring save/session boundaries. */
  readonly revision: string;
  readonly root: NodeId;
  readonly nodes: Readonly<Record<NodeId, UiNode>>;
  readonly componentDefinitions: Readonly<Record<DefinitionId, UiComponentDefinition>>;
  readonly styleSources: Readonly<Record<StyleSourceId, UiStyleSource>>;
  readonly tokens: Readonly<Record<TokenId, UiToken>>;
  readonly conditions: Readonly<Record<ConditionId, UiCondition>>;
  readonly assets: Readonly<Record<AssetId, UiAssetRef>>;
  readonly localState: Readonly<Record<StateKey, UiLocalStateDecl>>;
}

/** Semantic element metadata: the registered web-element catalog. */
export interface SemanticElementDef {
  readonly tag: string;
  /** Attributes this element accepts (beyond the global set). */
  readonly attributes?: readonly string[];
  /** Elements whose content is author text (leaves). */
  readonly leaf?: boolean;
}

export interface SemanticElementCatalog {
  readonly elements: readonly SemanticElementDef[];
  /** Global attribute allow-list (aria-*, role, etc.). */
  readonly globalAttributes: readonly string[];
}

/** Per-field types for typed view/record references. */
export type UiFieldTypes = Readonly<Record<string, UiFieldType>>;

/** Catalogs handed to `validateUiDocument` (product references included). */
export interface UiCatalogs {
  readonly elements: SemanticElementCatalog;
  /** Declared application action ids (invokeAction resolution). */
  readonly actionIds?: readonly string[];
  /** Declared route ids (navigate resolution). */
  readonly routeIds?: readonly string[];
  /** Typed fields visible as `view.<field>` / `record.<field>`. */
  readonly viewFields?: UiFieldTypes;
  /** Registered pure operations usable by `{type:'op'}` expressions. */
  readonly opNames?: readonly string[];
}
