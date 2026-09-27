/**
 * Authoring-tools slice — the machine-readable vocabulary.
 *
 * Guards the stability contract of `describeApplicationVocabulary()` and
 * its agreement with the enforcement functions it is derived from: the
 * vocabulary must never drift from what the compiler and the composition
 * validators actually accept.
 */

import { describe, expect, it } from 'vitest';
import {
  validateActionFeedback,
  validateApplicationComposition,
  validateLayoutMode,
  validatePageComposition,
  validateRegionPresentation,
} from '@victframework/ui';
import {
  APPLICATION_ISSUE_CODES,
  APPLICATION_VOCABULARY,
  compileApplication,
  describeApplicationVocabulary,
} from '@victframework/application';

describe('machine-readable vocabulary', () => {
  it('is byte-stable across calls (no insertion order or environment leakage)', () => {
    const a = JSON.stringify(describeApplicationVocabulary());
    const b = JSON.stringify(describeApplicationVocabulary());
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(4000);
  });

  it('exposes the closed surface roles from the compiler enforcement maps', () => {
    const vocabulary = describeApplicationVocabulary();
    expect(vocabulary.closedValues.surfaceRoles.v1).toEqual(['action', 'component', 'form', 'states', 'text', 'view']);
    // @2 roles are a superset of the @1 roles and carry the delivery roles.
    for (const role of vocabulary.closedValues.surfaceRoles.v1) {
      expect(vocabulary.closedValues.surfaceRoles.v2).toContain(role);
    }
    for (const role of ['table', 'chart', 'conversation', 'dialog', 'drawer', 'detail', 'list']) {
      expect(vocabulary.closedValues.surfaceRoles.v2).toContain(role);
    }
    // The per-role field sets cover exactly the declared roles.
    expect(Object.keys(vocabulary.objects['surface']?.fieldsByKey ?? {}).sort()).toEqual(
      vocabulary.closedValues.surfaceRoles.v2,
    );
  });

  it('exposes the table role fields an author needs (view, sort columns, row action)', () => {
    const tableFields = describeApplicationVocabulary().objects['surface']?.fieldsByKey?.['table'] ?? [];
    for (const field of [
      'viewId',
      'queryActionId',
      'rowAction',
      'columns',
      'searchFields',
      'filterFields',
      'pageSize',
      'emptyMessage',
    ]) {
      expect(tableFields).toContain(field);
    }
  });

  it('agrees with the ui composition validators (every advertised choice is accepted, others rejected)', () => {
    const vocabulary = describeApplicationVocabulary();
    const probe = (
      validate: (value: unknown) => readonly { path: string; message: string }[],
      table: Record<string, readonly string[]>,
    ) => {
      for (const [field, values] of Object.entries(table)) {
        if (field.includes('.')) continue; // nested member: probed via its parent object
        for (const value of values) {
          const issues = validate({ [field]: value });
          expect(issues, `${field}: ${value} must be accepted`).toHaveLength(0);
        }
        const issues = validate({ [field]: '__not_a_choice__' });
        expect(issues.length).toBeGreaterThan(0);
      }
    };
    probe(validateApplicationComposition, vocabulary.closedValues.composition.application);
    probe(validatePageComposition, vocabulary.closedValues.composition.page);
    probe(validateRegionPresentation, vocabulary.closedValues.composition.regionPresentation);
    for (const mode of vocabulary.closedValues.screenLayoutModes) {
      expect(validateLayoutMode(mode)).toHaveLength(0);
    }
    expect(validateLayoutMode('__not_a_mode__').length).toBeGreaterThan(0);
    for (const outcome of vocabulary.closedValues.actionFeedbackOutcomes) {
      expect(validateActionFeedback({ [outcome]: 'text' })).toHaveLength(0);
    }
    expect(validateActionFeedback({ notAnOutcome: 'text' }).length).toBeGreaterThan(0);
  });

  it('exposes every diagnostic code the compiler can emit (spot-checked against real diagnostics)', () => {
    // Exhaustiveness against the union is enforced at compile time by the
    // `satisfies` guard in vocabulary.ts; here we pin a few members.
    for (const code of ['UNKNOWN_SURFACE_ROLE', 'UNKNOWN_FIELD', 'INVALID_VIEW_DECLARATION', 'DUPLICATE_SCREEN_ID']) {
      expect(APPLICATION_ISSUE_CODES).toContain(code);
    }
    // Every code emitted by a broken definition is a member of the exported list.
    const result = compileApplication({
      application: {
        schema: 'vict.application@2',
        id: 'app.probe',
        revision: '1',
        name: 'Probe',
        routes: [],
        screens: [{ id: 's.x', title: 'X', layout: [{ name: 'main', surfaces: [{ role: 'nope', id: 'a' }] }] }],
        views: [],
        forms: [],
        actions: [],
        resources: [],
      },
      resources: [],
    });
    expect(result.ok).toBe(false);
    for (const issue of result.issues) {
      expect(APPLICATION_ISSUE_CODES).toContain(issue.code);
    }
  });

  it('does not leak mutable sets: the raw vocabulary shares the compiler constants', () => {
    // The raw export IS the enforcement constant (same Set instances)…
    expect(APPLICATION_VOCABULARY.closedValues.statusTones.has('danger')).toBe(true);
    // …while the JSON descriptor serializes sorted copies.
    const statusTones = describeApplicationVocabulary().closedValues.statusTones;
    expect(statusTones).toEqual(['danger', 'info', 'neutral', 'success', 'warning']);
  });
});
