// Lint-scope regression guard (P6C integration hardening).
//
// During the P5/P6B integration it was discovered that committed QA
// evidence artifacts (qa-artifacts/** browser-harness drivers and their
// captured machine-generated consumer bundles) fail the repository lint
// gate — they deliberately use browser globals (document/window) and
// contain unlinted generated output. QA evidence artifacts are immutable
// verification-session records, NOT maintained production source, so the
// resolution was a SCOPED eslint ignore for qa-artifacts/** — never a
// weakening of production lint rules.
//
// This suite pins BOTH sides of that decision:
//   1. qa-artifacts/** stays excluded (future QA artifacts must not break
//      the release ladder again), and
//   2. no production source root may ever be excluded from the gate.
import { describe, expect, it } from 'vitest';
// Imported for its runtime side effect only (no exported bindings used).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Evaluate the REAL eslint config exactly as the lint gate does.
const { default: eslintConfigEntries } = await import(join(repoRoot, 'eslint.config.js'));

const globalIgnoreEntry = eslintConfigEntries.find(
  (entry) => Array.isArray(entry) === false && Array.isArray(entry?.ignores),
);
const globalIgnores = globalIgnoreEntry?.ignores ?? [];

describe('lint gate scope (qa-artifacts exclusion is scoped and production stays linted)', () => {
  it('excludes the QA evidence artifact tree from the lint gate', () => {
    expect(globalIgnores).toContain('qa-artifacts/**');
  });

  it.each([
    ['packages/**', 'all package source must stay linted'],
    ['scripts/**', 'release tooling must stay linted'],
    ['examples/**', 'example/consumer applications must stay linted'],
    ['packs/**', 'capability packs must stay linted'],
    ['tests/**', 'repository-level tests must stay linted'],
    ['**', 'a blanket ignore would silently disable the entire gate'],
  ])('never excludes %s (%s)', (pattern) => {
    expect(globalIgnores).not.toContain(pattern);
  });

  it('documents the qa-artifacts exclusion with its rationale comment', () => {
    const configSource = readFileSync(join(repoRoot, 'eslint.config.js'), 'utf8');
    expect(configSource).toMatch(/QA evidence artifacts/i);
    expect(configSource).toMatch(/browser\sglobals/i);
  });
});
