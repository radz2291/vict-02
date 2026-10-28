import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Ajv from 'ajv';
import { capturePresentationSchema } from '@victframework/mastra';
import { editPresentation } from '../../../../apps/studio/src/lib/designer/agent-edit-presentation.js';
import { agentReadPresentation } from '../../../../apps/studio/src/lib/designer/agent-reads.js';
import { screenRecipes } from '../../../../apps/studio/src/lib/designer/recipes.js';
import { it } from 'vitest';

it('independently validates the exact expanded recipe vocabulary with AJV and frozen capture', () => {
const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../../../..');
const candidateSHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
assert.equal(candidateSHA, '42e36ced00499009bfb3dd36a8295470304911ac');
const chunks = editPresentation.$defs.recipe.anyOf;
const vocabulary = chunks.flatMap(chunk => chunk.enum);
const expected = screenRecipes.map(recipe => recipe.id);
assert.deepEqual(vocabulary, expected);
assert.equal(new Set(vocabulary).size, vocabulary.length);
assert(chunks.every(chunk => chunk.type === 'string' && chunk.enum.length > 0 && chunk.enum.length <= 64));
assert.deepEqual((editPresentation.$defs.add.properties as Record<string, unknown>).recipe, { $ref: '#/$defs/recipe' });
assert.deepEqual(editPresentation.properties.operations.items.properties.recipe, { $ref: '#/$defs/recipe' });

const ajv = new Ajv({ allErrors: true, strictKeywords: false, logger: false });
// Validate both the referenced vocabulary itself and the actual full tool payload.
const validatesRecipe = ajv.compile({ $defs: editPresentation.$defs, $ref: '#/$defs/recipe' });
const validatesEdit = ajv.compile(editPresentation);
const payload = (recipe: unknown) => ({ expectedRevision: 'r1#0', reason: 'Independent vocabulary challenge', operations: [{ op: 'add', recipe, nodeId: 'new-node', parentId: 'screen' }] });
for (const name of expected) {
  assert.equal(validatesRecipe(name), true, `recipe rejected: ${name}`);
  assert.equal(validatesEdit(payload(name)), true, `full payload rejected: ${name}`);
}
const registered = new Set(expected);
const adversarial = expected.flatMap(name => [`prefix-${name}`, `${name}-suffix`, `${name} `, ` ${name}`, name.replaceAll('.', '/'), name.replaceAll('-', '_')]).filter(name => !registered.has(name));
const invalid: unknown[] = [...new Set(adversarial), '', 'unregistered', 'dropdown-menuXitem', null, undefined, 0, 1, false, true, [], {}, ['catalog']];
for (const value of invalid) {
  assert.equal(validatesRecipe(value), false, `invalid recipe accepted: ${JSON.stringify(value)}`);
  assert.equal(validatesEdit(payload(value)), false, `invalid full payload accepted: ${JSON.stringify(value)}`);
}

function dimensions(value: unknown) {
  const result = { maxDepth: 0, maxFieldsPerObject: 0, maxArrayLength: 0, maxStringLength: 0, totalBytes: Buffer.byteLength(JSON.stringify(value)) };
  const visit = (item: unknown, depth: number) => {
    result.maxDepth = Math.max(result.maxDepth, depth);
    if (typeof item === 'string') result.maxStringLength = Math.max(result.maxStringLength, item.length);
    else if (Array.isArray(item)) { result.maxArrayLength = Math.max(result.maxArrayLength, item.length); for (const entry of item) visit(entry, depth + 1); }
    else if (item && typeof item === 'object') { result.maxFieldsPerObject = Math.max(result.maxFieldsPerObject, Object.keys(item).length); for (const entry of Object.values(item)) visit(entry, depth + 1); }
  };
  visit(value, 0);
  assert(result.maxDepth <= 8 && result.maxFieldsPerObject <= 64 && result.maxArrayLength <= 64 && result.maxStringLength <= 2048 && result.totalBytes <= 32768);
  return result;
}
capturePresentationSchema(editPresentation, 'independent current Studio edit');
capturePresentationSchema(agentReadPresentation, 'independent current Studio read');
const unchanged = ['packages/mastra/src/presentation.ts', 'apps/studio/src/lib/designer/agent-edits.ts', 'apps/studio/src/lib/designer/agent-reads.ts'];
for (const path of unchanged) assert.equal(execFileSync('git', ['diff', 'd7aeecf8176d78f4e7864a386ac1ff207cb4b871..HEAD', '--', path], { cwd: repository, encoding: 'utf8' }), '');
const sourcePaths = ['apps/studio/src/lib/designer/agent-edit-presentation.ts', 'apps/studio/tests/designer-agent-mastra.test.ts', ...unchanged];
const sourceHashes = Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(resolve(repository, path))).digest('hex')]));
const report = { candidateSHA, verdict: 'PASS - scoped frozen presentation and exact vocabulary repair', actualRecipeCount: expected.length, enumChunkLengths: chunks.map(chunk => chunk.enum.length), positiveSchemaProbes: expected.length * 2, negativeSchemaProbes: invalid.length * 2, editDimensions: dimensions(editPresentation), readDimensions: dimensions(agentReadPresentation), frozenBoundsAndAdmissionUnchanged: unchanged, sourceHashes, graphEvidenceReview: 'Saved canonical source and Run DOM retain 3 nodes, 2 connections, uppercase mode and both prior manual input/output values. This review reads retained evidence only; no independent browser observation is claimed.', limits: ['No live provider or actual-agent retry', 'Running old production build not restarted or rebuilt', 'No browser, server or network action', 'Integrated foundation verdict remains HELD', 'No source repair authored by verifier'] };
writeFileSync(resolve(directory, 'independent-schema-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
});
