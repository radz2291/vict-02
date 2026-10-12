/** Logical overlay depth travels with Svelte context, including across portals.
 * It is scoped to the component tree rather than a global open-layer counter. */
export const CATALOG_PORTAL_LAYER = Symbol('vict.catalog.portal-layer');
