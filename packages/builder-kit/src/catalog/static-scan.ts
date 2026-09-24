import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * Static completeness scan for first-party capability declarations
 * (architecture §4.1).
 *
 * Parsing ONLY — the TypeScript compiler API reads source text and never
 * evaluates it. Every `defineCapabilityPack`/`defineCapability` call-site
 * and every `capabilities:` literal entry must resolve to explicit string
 * literals. Anything the scan cannot resolve — a computed capability
 * entry, a non-literal identifier, a spread, a parse error — is reported
 * as UNRESOLVED, which the gate fails as `catalog-unresolved`. Silent
 * omission does not exist.
 */

export interface StaticDeclaration {
  readonly file: string;
  readonly id: string;
  readonly revision: string;
}

export interface UnresolvedDeclaration {
  readonly file: string;
  readonly reason: string;
}

export interface StaticScanResult {
  declarations: StaticDeclaration[];
  unresolved: UnresolvedDeclaration[];
}

function isObjectLiteral(node: ts.Node): node is ts.ObjectLiteralExpression {
  return ts.isObjectLiteralExpression(node);
}

function literalStringProp(object: ts.ObjectLiteralExpression, name: string): string | null {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) {
      if (ts.isSpreadAssignment(property)) return null;
      continue;
    }
    const propName = property.name;
    if (ts.isIdentifier(propName) && propName.text === name) {
      const initializer = property.initializer;
      if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
        return initializer.text;
      }
      return null; // computed/dynamic value — unresolvable
    }
  }
  return null; // absent
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return ts.isIdentifier(name) ? name.text : name.text;
  }
  return null; // computed property name — unresolvable
}

/**
 * Extract id/revision pairs from a manifest argument's `capabilities`
 * array literal. Returns pairs plus an `unresolved` flag when any entry
 * cannot be resolved statically.
 */
function extractCapabilities(
  manifest: ts.ObjectLiteralExpression,
  file: string,
  declarations: StaticDeclaration[],
  unresolved: UnresolvedDeclaration[],
): void {
  for (const property of manifest.properties) {
    if (!ts.isPropertyAssignment(property)) {
      if (ts.isSpreadAssignment(property)) {
        unresolved.push({ file, reason: 'manifest spread — cannot prove completeness statically' });
      }
      continue;
    }
    const name = propertyNameText(property.name);
    if (name !== 'capabilities') continue;
    const initializer = property.initializer;
    if (!ts.isArrayLiteralExpression(initializer)) {
      unresolved.push({ file, reason: 'capabilities is not an array literal' });
      return;
    }
    for (const element of initializer.elements) {
      if (ts.isSpreadElement(element)) {
        unresolved.push({ file, reason: 'capabilities entry is a spread — cannot resolve' });
        continue;
      }
      if (!isObjectLiteral(element)) {
        unresolved.push({ file, reason: 'capabilities entry is not an object literal' });
        continue;
      }
      const id = literalStringProp(element, 'id');
      const revision = literalStringProp(element, 'revision');
      if (id === null || revision === null) {
        unresolved.push({ file, reason: 'capabilities entry id/revision is not a string literal' });
        continue;
      }
      declarations.push({ file, id, revision });
    }
  }
}

function scanFile(relativePath: string, sourceText: string, result: StaticScanResult): void {
  const source = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  // parseDiagnostics is part of the compiler's parse-only surface; accessed
  // through a structural view because it is not on the public SourceFile type.
  const syntaxDiagnostics = (source as unknown as { parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (syntaxDiagnostics.length > 0) {
    result.unresolved.push({
      file: relativePath,
      reason: `source does not parse (${String(syntaxDiagnostics.length)} parse diagnostic(s))`,
    });
    return;
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      let callee: string | null = null;
      if (ts.isIdentifier(expression)) callee = expression.text;
      if (callee === 'defineCapabilityPack') {
        const manifestArg = node.arguments[0];
        if (manifestArg === undefined || !isObjectLiteral(manifestArg)) {
          result.unresolved.push({
            file: relativePath,
            reason: 'defineCapabilityPack manifest argument is not an object literal',
          });
        } else {
          extractCapabilities(manifestArg, relativePath, result.declarations, result.unresolved);
        }
      } else if (callee === 'defineCapability') {
        const definitionArg = node.arguments[0];
        if (definitionArg === undefined || !isObjectLiteral(definitionArg)) {
          result.unresolved.push({
            file: relativePath,
            reason: 'defineCapability argument is not an object literal',
          });
        } else {
          const id = literalStringProp(definitionArg, 'id');
          const revision = literalStringProp(definitionArg, 'revision');
          if (id === null || revision === null) {
            result.unresolved.push({
              file: relativePath,
              reason: 'defineCapability id/revision is not a string literal',
            });
          } else {
            result.declarations.push({ file: relativePath, id, revision });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function listTsFiles(root: string, parent: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(join(root, parent), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const relative = parent.length === 0 ? entry.name : `${parent}/${entry.name}`;
    if (entry.isDirectory()) listTsFiles(root, relative, out);
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(relative);
  }
}

/**
 * Scan all first-party pack and package sources (every `src` directory
 * under `packs` and `packages`; the generator's trust envelope is
 * first-party workspace code only; third-party packs are out of scope,
 * Stage 10).
 */
export function scanFirstPartySources(repoRoot: string): StaticScanResult {
  const result: StaticScanResult = { declarations: [], unresolved: [] };
  const files: string[] = [];
  for (const group of ['packs', 'packages']) {
    let groups;
    try {
      groups = readdirSync(join(repoRoot, group), { withFileTypes: true }).filter((e) =>
        e.isDirectory(),
      );
    } catch {
      continue;
    }
    for (const dir of groups) {
      listTsFiles(repoRoot, `${group}/${dir.name}/src`, files);
    }
  }
  for (const file of [...files].sort()) {
    scanFile(file, readFileSync(join(repoRoot, file), 'utf8'), result);
  }
  result.declarations.sort((a: StaticDeclaration, b: StaticDeclaration) =>
    a.file < b.file
      ? -1
      : a.file > b.file
        ? 1
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : a.revision < b.revision
              ? -1
              : 1,
  );
  return result;
}
