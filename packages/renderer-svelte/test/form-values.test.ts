import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { compileApplication, type ApplicationPlan } from '@vict/application';
import { renderVictApplication, type MountedVictApplication } from '@vict/renderer-svelte';
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@vict/sdk';
import {
  prefillFormState,
  toSubmitPayload,
  widgetKind,
  FIELD_ERROR_NUMERIC,
} from '../src/form-values.js';
import { itemResource, testRegistry } from './fixtures.js';

/**
 * Permanent HIGH-05-A regression evidence: the centralized, type-aware
 * form-value model (renderer level, through the REAL compiler path).
 *
 * Every currently supported form value type is covered — numbers (including
 * 0 and invalid text), booleans, dates, text, and json — for BOTH the create
 * and the edit path. These tests reproduce the real user task ("open an
 * existing record, edit one text field, save") at the renderer boundary:
 * the submitted payload's TYPES are captured and asserted.
 */

const CANARY = 'HOSTILE-FORM-CANARY<script>';

const FORM_FIELDS: readonly Record<string, unknown>[] = [
  { name: 'title', label: 'Title', required: true, widget: 'text' },
  { name: 'status', label: 'Status', widget: 'text' },
  { name: 'qty', label: 'Qty', widget: 'number' },
  { name: 'id', label: 'Day', widget: 'date' },
];

function compileFormProbe(fields: readonly Record<string, unknown>[]): ApplicationPlan {
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: 'app.probe',
    revision: '1',
    routes: [
      { id: 'home', path: '/', screenId: 's.form' },
      { id: 'detail', path: '/items/:id', screenId: 's.form' },
    ],
    screens: [
      {
        id: 's.form',
        title: 'Form probe',
        layout: [{ name: 'main', surfaces: [{ role: 'form', id: 'x', formId: 'f.probe' }] }],
      },
    ],
    views: [
      {
        viewId: 'v.items',
        resourceId: 'items',
        resourceRevision: '1',
        fields: ['id', 'title', 'status', 'qty'],
      },
    ],
    forms: [
      {
        formId: 'f.probe',
        resourceId: 'items',
        resourceRevision: '1',
        inputContractId: 'test.item.input',
        fields: fields as never,
        submitActionId: 'act.create',
      },
    ] as never,
    actions: [
      { kind: 'local', id: 'act.local', revision: '1' },
      {
        kind: 'mutation',
        id: 'act.create',
        revision: '1',
        resourceId: 'items',
        resourceRevision: '1',
        op: 'create',
        inputContractId: 'test.item.input',
      },
    ],
    resources: [{ resourceId: 'items', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: [{ id: 'test.item.input', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`probe plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

interface CapturedDispatch {
  readonly actionId: string;
  readonly input: unknown;
}

function mountForm(
  plan: ApplicationPlan,
  options: { path?: string; record?: Record<string, unknown> | null } = {},
): { mounted: MountedVictApplication; captured: CapturedDispatch[] } {
  const captured: CapturedDispatch[] = [];
  const mounted = renderVictApplication({
    plan,
    registry: testRegistry(),
    dispatch: async (actionId: string, input?: unknown) => {
      captured.push({ actionId, input });
      return { ok: true, value: null };
    },
    path: options.path ?? '/',
    viewData: {},
    record: options.record ?? null,
  });
  return { mounted, captured };
}

function submitForm(mounted: MountedVictApplication): void {
  const form = mounted.output.querySelector('form');
  if (form === null) {
    throw new Error('form not rendered');
  }
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  flushSync();
}

function fieldInput(mounted: MountedVictApplication, name: string): HTMLInputElement {
  const input = mounted.output.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (input === null) {
    throw new Error(`input ${name} not rendered`);
  }
  return input;
}

function typeValue(mounted: MountedVictApplication, name: string, value: string): void {
  const input = fieldInput(mounted, name);
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  flushSync();
}

describe('form-value model: unit policy (declared widget boundary)', () => {
  it('widgetKind resolves only the closed declared vocabulary; unknown fails safe as text', () => {
    expect(widgetKind('number')).toBe('number');
    expect(widgetKind('boolean')).toBe('boolean');
    expect(widgetKind('date')).toBe('date');
    expect(widgetKind('json')).toBe('json');
    expect(widgetKind('text')).toBe('text');
    expect(widgetKind(undefined)).toBe('text');
    expect(widgetKind('dropdown')).toBe('text');
    expect(widgetKind({ hostile: true })).toBe('text');
  });

  it('prefill keeps numeric values numeric without user interaction; 0 stays 0', () => {
    const state = prefillFormState(
      [
        { name: 'qty', widget: 'number' },
        { name: 'title', widget: 'text' },
      ],
      { qty: 42, title: 'Alpha' },
    );
    expect(state.text.qty).toBe('42');
    expect(state.text.title).toBe('Alpha');
    const outcome = toSubmitPayload(
      [
        { name: 'qty', widget: 'number' },
        { name: 'title', widget: 'text' },
      ],
      prefillFormState([{ name: 'qty', widget: 'number' }], { qty: 0 }),
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.payload?.qty).toBe(0);
    expect(Object.is(outcome.payload?.qty, 0)).toBe(true);
  });

  it('submit converts raw widget text into the declared types; hostile input never becomes NaN', () => {
    const fields = [
      { name: 'title', required: true, widget: 'text' },
      { name: 'qty', widget: 'number' },
      { name: 'flag', widget: 'boolean' },
      { name: 'day', widget: 'date' },
      { name: 'blob', widget: 'json' },
    ];
    const outcome = toSubmitPayload(fields, {
      text: { title: 'Alpha', qty: '43', blob: '{"a":1}' },
      checked: { flag: false },
    });
    expect(outcome.ok).toBe(true);
    expect(typeof outcome.payload?.qty).toBe('number');
    expect(outcome.payload?.qty).toBe(43);
    expect(outcome.payload?.flag).toBe(false);
    expect(outcome.payload?.blob).toBe('{"a":1}');

    const invalid = toSubmitPayload(fields, {
      text: { title: 'Alpha', qty: '1e999' },
      checked: {},
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.fieldErrors?.qty).toBe(FIELD_ERROR_NUMERIC);
    expect(invalid.payload).toBeUndefined();

    const hostile = toSubmitPayload(fields, {
      text: { title: 'Alpha', qty: `12; ${CANARY}` },
      checked: {},
    });
    expect(hostile.ok).toBe(false);
    expect(JSON.stringify(hostile.fieldErrors)).not.toContain(CANARY);
  });

  it('optional empty numbers are omitted; empty optional strings follow the string domain; required empties fail locally', () => {
    const fields = [
      { name: 'title', required: true, widget: 'text' },
      { name: 'qty', widget: 'number' },
      { name: 'note', widget: 'text' },
    ];
    const outcome = toSubmitPayload(fields, { text: { title: 'Alpha', note: '' }, checked: {} });
    expect(outcome.ok).toBe(true);
    expect(outcome.payload).not.toHaveProperty('qty');
    expect(outcome.payload?.note).toBe('');

    const requiredEmpty = toSubmitPayload(fields, { text: { note: '' }, checked: {} });
    expect(requiredEmpty.ok).toBe(false);
    expect(requiredEmpty.fieldErrors?.title).toBeDefined();
    expect(requiredEmpty.payload).toBeUndefined();
  });
});

describe('form prefill and submit through the compiled plan (DOM level)', () => {
  const EDIT_RECORD: Record<string, unknown> = {
    id: 'i-1',
    title: 'Alpha',
    status: 'active',
    qty: 42,
  };

  it('prefilled numeric value stays numeric without any user interaction (edit path)', () => {
    const plan = compileFormProbe(FORM_FIELDS.slice(0, 3));
    const { mounted, captured } = mountForm(plan, { path: '/items/i-1', record: EDIT_RECORD });
    try {
      // The user changes ONLY the text field.
      typeValue(mounted, 'title', 'Alpha edited');
      expect(mounted.output.querySelector('[data-testid="form-field-error-qty"]')).toBeNull();
      submitForm(mounted);
      expect(captured.length).toBe(1);
      const input = captured[0]!.input as Record<string, unknown>;
      expect(input.title).toBe('Alpha edited');
      expect(typeof input.qty).toBe('number');
      expect(input.qty).toBe(42);
      expect(input.status).toBe('active');
      expect(input.__identity).toBe('i-1');
    } finally {
      mounted.unmount();
    }
  });

  it('numeric zero survives untouched (distinguishable from empty)', () => {
    const plan = compileFormProbe([
      { name: 'title', label: 'Title', required: true, widget: 'text' },
      { name: 'qty', label: 'Qty', required: true, widget: 'number' },
    ]);
    const { mounted, captured } = mountForm(plan, {
      path: '/items/i-1',
      record: { ...EDIT_RECORD, qty: 0 },
    });
    try {
      typeValue(mounted, 'title', 'Zero kept');
      submitForm(mounted);
      expect(captured.length).toBe(1);
      const input = captured[0]!.input as Record<string, unknown>;
      expect(Object.is(input.qty, 0)).toBe(true);
    } finally {
      mounted.unmount();
    }
  });

  it('a changed numeric value is dispatched as a number', () => {
    const plan = compileFormProbe([
      { name: 'title', label: 'Title', required: true, widget: 'text' },
      { name: 'qty', label: 'Qty', required: true, widget: 'number' },
    ]);
    const { mounted, captured } = mountForm(plan, { path: '/items/i-1', record: EDIT_RECORD });
    try {
      typeValue(mounted, 'qty', '43');
      submitForm(mounted);
      const input = captured[0]!.input as Record<string, unknown>;
      expect(typeof input.qty).toBe('number');
      expect(input.qty).toBe(43);
    } finally {
      mounted.unmount();
    }
  });

  it('invalid numeric text never dispatches and never becomes NaN, infinity, or an echo', () => {
    const plan = compileFormProbe([
      { name: 'title', label: 'Title', required: true, widget: 'text' },
      { name: 'qty', label: 'Qty', required: true, widget: 'number' },
    ]);
    for (const hostile of ['abc', '1e999', `12; ${CANARY}`]) {
      const { mounted, captured } = mountForm(plan, {
        path: '/items/i-1',
        record: EDIT_RECORD,
      });
      try {
        typeValue(mounted, 'qty', hostile);
        submitForm(mounted);
        expect(captured.length, hostile).toBe(0); // conversion failure never dispatches
        const error = mounted.output.querySelector('[data-testid="form-field-error-qty"]');
        expect(error).not.toBeNull();
        // Only renderer-generated local messages appear (invalid text OR the
        // browser/happy-dom sanitized the bad input to empty → required).
        expect(['Enter a valid number.', 'This field is required.']).toContain(error?.textContent);
        // The hostile input is never echoed into safe diagnostics.
        expect(mounted.output.textContent).not.toContain(CANARY);
        expect(mounted.output.textContent).not.toContain('NaN');
        expect(mounted.output.textContent).not.toContain('Infinity');
      } finally {
        mounted.unmount();
      }
    }
  });

  it('empty optional versus required values behave as declared', () => {
    const plan = compileFormProbe(FORM_FIELDS.slice(0, 3));
    const { mounted, captured } = mountForm(plan, { record: {} });
    try {
      typeValue(mounted, 'title', 'Only title');
      submitForm(mounted);
      // Optional empty number: omitted (declared absent semantics).
      // Optional empty text: dispatched as '' (declared string domain).
      expect(captured.length).toBe(1);
      const input = captured[0]!.input as Record<string, unknown>;
      expect(input).not.toHaveProperty('qty');
      expect(input.status).toBe('');
      expect(input.title).toBe('Only title');
    } finally {
      mounted.unmount();
    }

    // Required empty: local field-associated error, no dispatch.
    const second = mountForm(plan, { path: '/items/i-1', record: EDIT_RECORD });
    try {
      typeValue(second.mounted, 'title', '');
      submitForm(second.mounted);
      expect(second.captured.length).toBe(0);
      const error = second.mounted.output.querySelector('[data-testid="form-field-error-title"]');
      expect(error?.textContent).toBe('This field is required.');
      expect(
        second.mounted.output.querySelector('[name="title"]')?.getAttribute('aria-invalid'),
      ).toBe('true');
      expect(
        second.mounted.output.querySelector('[data-testid="form-local-validation"]'),
      ).not.toBeNull();
    } finally {
      second.mounted.unmount();
    }
  });

  it('text, boolean, date, and json values retain their declared types', () => {
    const plan = compileFormProbe([
      { name: 'title', label: 'Title', required: true, widget: 'text' },
      { name: 'status', label: 'Flag', widget: 'boolean' },
      { name: 'id', label: 'Day', widget: 'date' },
      { name: 'qty', label: 'Notes', widget: 'json' },
    ]);
    const { mounted, captured } = mountForm(plan, { record: {} });
    try {
      typeValue(mounted, 'title', 'Typed');
      typeValue(mounted, 'id', '2026-02-01');
      typeValue(mounted, 'qty', '{"tone":"x"}');
      const checkbox = mounted.output.querySelector<HTMLInputElement>('input[type="checkbox"]');
      checkbox!.checked = true;
      checkbox!.dispatchEvent(new window.Event('change', { bubbles: true }));
      flushSync();
      submitForm(mounted);
      expect(captured.length).toBe(1);
      const input = captured[0]!.input as Record<string, unknown>;
      expect(input.title).toBe('Typed');
      expect(input.status).toBe(true);
      expect(input.id).toBe('2026-02-01');
      expect(input.qty).toBe('{"tone":"x"}');
    } finally {
      mounted.unmount();
    }

    // Untouched boolean and date prefills stay in their declared domains.
    const prefilled = mountForm(plan, {
      record: { title: 'P', status: true, qty: '{"kept":1}', id: '2026-01-01' },
    });
    try {
      submitForm(prefilled.mounted);
      expect(prefilled.captured.length).toBe(1);
      const input = prefilled.captured[0]!.input as Record<string, unknown>;
      expect(input.status).toBe(true);
      expect(input.qty).toBe('{"kept":1}');
      expect(input.id).toBe('2026-01-01');
    } finally {
      prefilled.mounted.unmount();
    }
  });

  it('create and edit paths share the canonical normalization', () => {
    const plan = compileFormProbe([
      { name: 'title', label: 'Title', required: true, widget: 'text' },
      { name: 'qty', label: 'Qty', required: true, widget: 'number' },
    ]);
    // Create path: freshly typed values.
    const created = mountForm(plan, { path: '/' });
    try {
      typeValue(created.mounted, 'title', 'Fresh');
      typeValue(created.mounted, 'qty', '7');
      submitForm(created.mounted);
      expect(created.captured.length).toBe(1);
      const createInput = created.captured[0]!.input as Record<string, unknown>;
      expect(typeof createInput.qty).toBe('number');
      expect(createInput.qty).toBe(7);
      expect(createInput).not.toHaveProperty('__identity');
    } finally {
      created.mounted.unmount();
    }
    // Edit path: identical typing policy plus the identity marker.
    const edited = mountForm(plan, { path: '/items/i-1', record: EDIT_RECORD });
    try {
      typeValue(edited.mounted, 'title', 'Fresh 2');
      typeValue(edited.mounted, 'qty', '7');
      submitForm(edited.mounted);
      expect(edited.captured.length).toBe(1);
      const editInput = edited.captured[0]!.input as Record<string, unknown>;
      expect(typeof editInput.qty).toBe('number');
      expect(editInput.qty).toBe(7);
      expect(editInput.__identity).toBe('i-1');
    } finally {
      edited.mounted.unmount();
    }
  });

  it('hostile prefill values fail safely without echo', () => {
    const plan = compileFormProbe([
      { name: 'title', label: 'Title', required: true, widget: 'text' },
      { name: 'qty', label: 'Qty', required: true, widget: 'number' },
    ]);
    const { mounted, captured } = mountForm(plan, {
      path: '/items/i-1',
      record: { qty: { hostile: CANARY }, title: { nested: CANARY } },
    });
    try {
      // Hostile values render as the empty display state — never String(value).
      expect(fieldInput(mounted, 'qty').value).toBe('');
      expect(mounted.output.textContent).not.toContain(CANARY);
      expect(mounted.output.textContent).not.toContain('[object Object]');
      // Required fields that received no usable prefill fail locally.
      submitForm(mounted);
      expect(captured.length).toBe(0);
      expect(mounted.output.querySelector('[data-testid="form-field-error-qty"]')).not.toBeNull();
    } finally {
      mounted.unmount();
    }
  });
});
