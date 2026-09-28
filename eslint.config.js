import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      '**/.svelte-kit/**',
      '**/build/**',
      // Owner-local tooling (never delivered code, never committed).
      '.pi/**',
      // Temporary probe scratch space (removed before finalization).
      'tmp-probes/**',
      // QA evidence artifacts (P1–P5 QA session drivers, browser harnesses,
      // and their captured machine-generated consumer bundles). These are
      // immutable evidence records of verification sessions, NOT maintained
      // production source; they deliberately use browser globals
      // (document/window) and unlinted generated output. Excluding them
      // here keeps the repository lint gate scoped to real source without
      // weakening any production lint rule.
      'qa-artifacts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
