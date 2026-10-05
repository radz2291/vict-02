/**
 * The registered web-element metadata catalog (API-SPEC §3: "tag validated
 * against the registered web-element metadata catalog").
 *
 * U1 ships a bounded, purpose-sized catalog covering the declared slice:
 * structure, text, list, media-placeholder, form-essential and button
 * elements with flex/grid essentials expressed as plain style declarations.
 * The catalog is DATA — hosts may register their own catalog with the same
 * shape; nothing here is hard-coded into validation or rendering.
 */

import type { SemanticElementCatalog, SemanticElementDef } from './document.js';

/** Global attributes every element accepts (presentation ids live in styles). */
export const GLOBAL_ATTRIBUTES = [
  'id',
  'title',
  'hidden',
  'role',
  'tabindex',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-hidden',
  'aria-expanded',
  'aria-current',
  'aria-live',
  'aria-disabled',
  'data-test-id',
] as const;

const ELEMENTS: readonly SemanticElementDef[] = [
  // structure
  { tag: 'div' },
  { tag: 'section' },
  { tag: 'header' },
  { tag: 'footer' },
  { tag: 'main' },
  { tag: 'nav' },
  { tag: 'article' },
  { tag: 'aside' },
  // text
  { tag: 'h1' },
  { tag: 'h2' },
  { tag: 'h3' },
  { tag: 'h4' },
  { tag: 'p', leaf: true },
  { tag: 'span', leaf: true },
  { tag: 'strong', leaf: true },
  { tag: 'em', leaf: true },
  // lists
  { tag: 'ul' },
  { tag: 'ol' },
  { tag: 'li' },
  // media placeholder (declared U1 limit: labeled placeholder only)
  { tag: 'img', attributes: ['src', 'alt', 'width', 'height'], leaf: true },
  // form essentials
  { tag: 'form', attributes: ['name'] },
  { tag: 'label', attributes: ['for'], leaf: true },
  {
    tag: 'input',
    attributes: ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'checked', 'min', 'max', 'step'],
    leaf: true,
  },
  {
    tag: 'select',
    attributes: ['name', 'required', 'disabled'],
  },
  { tag: 'option', attributes: ['value', 'selected', 'disabled'], leaf: true },
  { tag: 'textarea', attributes: ['name', 'placeholder', 'rows', 'required', 'disabled'], leaf: true },
  { tag: 'fieldset' },
  { tag: 'legend', leaf: true },
  // interactive
  { tag: 'button', attributes: ['type', 'name', 'value', 'disabled'], leaf: true },
  { tag: 'a', attributes: ['href', 'target', 'rel'], leaf: true },
  // table (read-only display essentials)
  { tag: 'table' },
  { tag: 'thead' },
  { tag: 'tbody' },
  { tag: 'tr' },
  { tag: 'th', attributes: ['scope'] },
  { tag: 'td' },
];

/** The default U1 semantic element catalog. */
export function defaultSemanticElementCatalog(): SemanticElementCatalog {
  return { elements: ELEMENTS, globalAttributes: [...GLOBAL_ATTRIBUTES] };
}

/** Resolved attribute allow-list for one tag (element + global sets). */
export function allowedAttributes(
  catalog: SemanticElementCatalog,
  tag: string,
): ReadonlySet<string> {
  const def = catalog.elements.find((element) => element.tag === tag);
  return new Set([...catalog.globalAttributes, ...(def?.attributes ?? [])]);
}

export function isKnownElement(catalog: SemanticElementCatalog, tag: string): boolean {
  return catalog.elements.some((element) => element.tag === tag);
}

export function isLeafElement(catalog: SemanticElementCatalog, tag: string): boolean {
  return catalog.elements.find((element) => element.tag === tag)?.leaf === true;
}
