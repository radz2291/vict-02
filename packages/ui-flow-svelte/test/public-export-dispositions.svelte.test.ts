import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { aiAuthoringPackage } from '../../ui-ai-svelte/src/authoring/knowledge.js';
import { flowAuthoringPackage } from '../src/authoring/knowledge.js';

describe('specialist public export admission inventory', () => {
  for (const family of ['ai', 'flow'] as const)
    it(`requires an explicit disposition for every ${family} root/authoring/pattern public export`, () => {
      const base = `packages/ui-${family}-svelte/`;
      const entries =
        family === 'ai'
          ? ['src/index.ts', 'src/patterns/index.ts', 'src/authoring/index.ts']
          : ['src/index.ts', 'src/authoring/index.ts'];
      const program = ts.createProgram(
        entries.map((entry) => base + entry),
        {
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          target: ts.ScriptTarget.ES2022,
          skipLibCheck: true,
          allowJs: true,
        },
      );
      const checker = program.getTypeChecker();
      const expected = entries
        .flatMap((entry) => {
          const source = program.getSourceFile(base + entry)!;
          const prefix = entry.includes('/patterns/')
            ? './patterns:'
            : entry.includes('/authoring/')
              ? './authoring:'
              : '';
          return checker
            .getExportsOfModule(checker.getSymbolAtLocation(source)!)
            .map((symbol) => prefix + symbol.name);
        })
        .sort();
      const pkg = family === 'ai' ? aiAuthoringPackage : flowAuthoringPackage;
      const actual = pkg.exportDispositions
        .filter(
          (item) =>
            !['./authoring', './patterns', './components/*', './markdown'].includes(item.name),
        )
        .map((item) => item.name)
        .sort();
      expect(actual).toEqual(expected);
      expect(new Set(actual).size).toBe(actual.length);
      expect(pkg.registrations).toHaveLength(family === 'flow' ? 11 : 28);
      expect(pkg.exportDispositions.every((item) => item.disposition && item.reason)).toBe(true);
    }, 20000);
});
