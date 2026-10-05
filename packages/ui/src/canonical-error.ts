/**
 * Structured rejection for values outside the canonical serializable
 * domain (mirrors `CanonicalIdentityError` in packages/application with a
 * UI-foundation identity, kept dependency-free for packages/ui).
 */
export class CanonicalUiError extends Error {
  readonly code: 'NON_CANONICAL_VALUE' | 'CYCLIC_STRUCTURE' | 'REVISION_COLLISION';
  readonly path: string;

  constructor(
    code: 'NON_CANONICAL_VALUE' | 'CYCLIC_STRUCTURE' | 'REVISION_COLLISION',
    message: string,
    path: string,
  ) {
    super(`Canonical UI identity error (${code}): ${message}`);
    this.name = 'CanonicalUiError';
    this.code = code;
    this.path = path;
  }
}
