/**
 * `vict.application@3` — canonical UI attachment (API-SPEC §2).
 *
 * @3 keeps every @2 field and field-set rule unchanged and adds exactly one
 * presentation alternative per screen:
 *
 * - legacy mode: `layout` (+ optional `layoutMode`/`composition`), or
 * - document mode: `uiDocument: { documentId, revision }`.
 *
 * A @3 screen with both modes, or with neither, is invalid
 * (`UI_APP_PRESENTATION_MODE_INVALID`). When `uiDocument` is present,
 * `layout`/`layoutMode`/`composition` MUST be absent. UI documents are
 * referenced per screen, never inlined into the application manifest.
 *
 * The schema marker participates in `computeApplicationVersion` through the
 * `vict.application-identity@3` identity marker, so a @3 identity can never
 * alias a @1/@2 identity (same mechanism as the existing @1/@2 split).
 *
 * This module is additive: @1/@2 authoring types and behavior are untouched.
 */

import type {
  ApplicationCompatibility,
  ApplicationRoute,
  ActionDefinition,
  ComponentReference,
  ScreenStates,
} from './application.js';
import type { UiApplicationComposition, UiLayoutMode, UiPageComposition } from '@victframework/ui';

import { APPLICATION_DEFINITION_SCHEMA_V3, APPLICATION_IDENTITY_SCHEMA_V3 } from './application.js';
export { APPLICATION_DEFINITION_SCHEMA_V3, APPLICATION_IDENTITY_SCHEMA_V3 };

/** A screen's UI document reference (document mode). */
export interface UiDocumentScreenReference {
  /** The catalog document id. */
  readonly documentId: string;
  /** The pinned document revision. */
  readonly revision: string;
}

/** A @3 screen: exactly one presentation mode (legacy OR document). */
export interface ScreenDefinitionV3 {
  readonly id: string;
  readonly title: string;
  /** Document mode: reference into the explicit uiDocuments catalog. */
  readonly uiDocument?: UiDocumentScreenReference;
  /** Legacy mode fields (unchanged @2 semantics; absent in document mode). */
  readonly layout?: import('./application.js').ScreenDefinition['layout'];
  readonly layoutMode?: UiLayoutMode;
  readonly composition?: UiPageComposition;
  readonly states?: ScreenStates;
  readonly breadcrumbs?: import('./application.js').BreadcrumbItem[];
}

/** The `vict.application@3` application definition. */
export interface ApplicationDefinitionV3 {
  readonly schema: typeof APPLICATION_DEFINITION_SCHEMA_V3;
  readonly id: string;
  readonly revision: string;
  readonly name?: string;
  readonly composition?: UiApplicationComposition;
  readonly routes: readonly ApplicationRoute[];
  readonly screens: readonly ScreenDefinitionV3[];
  readonly views?: import('./application.js').ViewBinding[];
  readonly forms?: import('./application.js').FormBinding[];
  readonly actions: readonly ActionDefinition[];
  readonly resources: readonly { readonly resourceId: string; readonly revision: string }[];
  readonly components?: readonly ComponentReference[];
  readonly compatibility?: ApplicationCompatibility;
  readonly theme?: import('./application.js').ThemeDeclaration;
}

/** One entry of the explicit UI document catalog (no hidden registries). */
export interface UiDocumentCatalogEntry {
  readonly document: unknown; // a full vict.ui-document@1 document (typed at the application layer)
}

/** An explicit pin binding a (documentId, revision) to an exact digest. */
export interface UiDocumentPin {
  readonly documentId: string;
  readonly revision: string;
  readonly contentDigest: string;
}
