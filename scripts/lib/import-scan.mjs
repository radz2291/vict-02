/**
 * Module-specifier scanning for verifier path gates.
 *
 * Extracted from scripts/verify-stage6a.mjs (Phase F4 release-gate repair,
 * F3 finding MD-2) so the matching semantics carry permanent regression
 * coverage. The historical gate scanned for the raw substring `ee/`
 * anywhere in the source text and false-positived on ordinary words such
 * as `free/` or `thenable-free/` in a comment. A forbidden path is now
 * matched as an actual path segment of a REAL module reference (static
 * import / export-from, side-effect import, dynamic `import()`,
 * `require()`) after comment stripping — prose and unrelated words can
 * never fail the gate, while a real forbidden import still does.
 */

/**
 * Strip block comments and whole-line `//` comments (the same gate
 * precedent as the declaration gates in scripts/verify-stage4.mjs and
 * scripts/verify-stage6a.mjs). These gates inspect real module references,
 * not documentation prose.
 *
 * @param {string} source raw source text
 * @returns {string} source with comments replaced by harmless whitespace
 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

const SPECIFIER_PATTERN = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])([^'"\r\n]+)\1/g;

/**
 * Extract the module specifiers of real module references from
 * comment-stripped source text: static `import … from '…'`,
 * `export … from '…'`, bare side-effect `import '…'`, dynamic
 * `import('…')`, and `require('…')`.
 *
 * @param {string} commentedStrippedSource source text with comments
 *        already stripped (pass it through {@link stripComments} first)
 * @returns {Array<{specifier: string}>} the extracted specifiers in
 *          source order
 */
export function importSpecifiers(commentedStrippedSource) {
  /** @type {Array<{specifier: string}>} */
  const specifiers = [];
  for (const match of commentedStrippedSource.matchAll(SPECIFIER_PATTERN)) {
    specifiers.push({ specifier: /** @type {RegExpExecArray} */ (match)[2] });
  }
  return specifiers;
}

/**
 * The governed subpath segments of a module specifier — the path portions
 * that can carry a forbidden path segment according to the gate's purpose:
 * everything AFTER the package root for package specifiers (the scope plus
 * name for scoped packages, the first segment otherwise), and the whole
 * path for relative and absolute specifiers.
 *
 * `@mastra/core/ee` -> `['ee']`; `./free/x` -> `['.', 'free', 'x']`;
 * `../ee/y` -> `['..', 'ee', 'y']`; `@mastra/core` -> `[]`.
 *
 * @param {string} specifier the module specifier
 * @returns {string[]} the governed path segments
 */
export function specifierPathSegments(specifier) {
  const segments = specifier.split('/');
  if (specifier.startsWith('.')) {
    return segments;
  }
  if (specifier.startsWith('@')) {
    return segments.slice(2);
  }
  return segments.slice(1);
}

/**
 * Find forbidden path segments in the real module references of a source
 * file. Comments are stripped first, so a comment (even one quoting a
 * forbidden import) can never fail the gate; every extracted specifier is
 * then checked for a forbidden path SEGMENT — ordinary words that merely
 * contain the characters (such as `free/` or `thenable-free/`) are not
 * path segments and cannot fail.
 *
 * @param {string} source raw source text
 * @param {string[]} forbiddenSegments path segments that must never appear
 *        as a governed segment of a module reference (e.g. `['ee']`)
 * @returns {Array<{specifier: string, segment: string}>} stable findings,
 *          empty when the source is clean
 */
export function findForbiddenSpecifierSegments(source, forbiddenSegments) {
  const stripped = stripComments(source);
  /** @type {Array<{specifier: string, segment: string}>} */
  const findings = [];
  for (const { specifier } of importSpecifiers(stripped)) {
    for (const segment of specifierPathSegments(specifier)) {
      if (forbiddenSegments.includes(segment)) {
        findings.push({ specifier, segment });
      }
    }
  }
  return findings;
}
