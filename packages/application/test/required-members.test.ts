import { describe, expect, it } from 'vitest';
import { APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2 } from '@vict/sdk';
import {
  compileApplication,
  computeApplicationVersion,
  canonicalApplicationManifest,
  stableJson,
} from '../src/index.js';
import type { CompileApplicationInput } from '../src/index.js';

/**
 * Stage 05 final exit-gate correction (LOW-05-A closure): the runtime
 * compiler enforces every member that the public Application Definition
 * authoring model declares REQUIRED, for both `vict.application@1` and
 * `vict.application@2`.
 *
 * These tests run at the RUNTIME compiler boundary with plain JavaScript
 * objects (no `defineApplication` capture, no TypeScript checking): the
 * exact shape a `JSON.parse` result or a packed-JavaScript consumer
 * produces. Previously accepted malformed objects — an action without its
 * `revision`, a route without its `id`, a screen without its `title` — are
 * now rejected with stable, structured, non-echoing diagnostics and never
 * receive an `applicationVersion`.
 *
 * The identity vectors below were captured from the pre-correction
 * implementation (`d346bad`) and are asserted BYTE-IDENTICAL here, proving
 * this correction changes validation only — not canonicalization, identity,
 * or any valid definition's accepted shape.
 */

/* ------------------------------------------------------------------ */
/* Fixtures (plain JavaScript; complete valid applications)            */
/* ------------------------------------------------------------------ */

function vectorResources(): unknown[] {
  return [
    {
      schema: 'vict.resource@1',
      id: 'items',
      revision: '2',
      identity: { key: 'id' },
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'qty', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'note', type: 'string' },
      ],
      mutations: [
        { op: 'create', effect: 'write', inputContractId: 'c.item', idempotency: 'keyed' },
      ],
      authorization: { effect: 'read' },
    },
  ];
}

const contracts = [{ id: 'c.item', revision: '2' }];
const capabilities = [{ id: 'cap.ping', revision: '1' }];
const registryComponents = [{ componentId: 'cmp.badge', revision: '2' }];

/** Complete, valid vict.application@1 definition (foundation vocabulary). */
function validV1Application(): Record<string, unknown> {
  return {
    schema: APPLICATION_DEFINITION_SCHEMA,
    id: 'app.vectors',
    revision: '3',
    name: 'Vector Application',
    routes: [
      {
        id: 'home',
        path: '/',
        screenId: 's.dashboard',
        nav: { label: 'Dashboard', group: 'Main', order: 1 },
      },
      { id: 'items', path: '/items', screenId: 's.items', nav: { label: 'Items', order: 2 } },
      { id: 'item-detail', path: '/items/:id', screenId: 's.item-detail' },
    ],
    screens: [
      {
        id: 's.dashboard',
        title: 'Dashboard',
        layout: [
          {
            name: 'main',
            surfaces: [
              { role: 'text', id: 't.intro', content: 'Overview' },
              { role: 'view', id: 'v.rows', viewId: 'v.items' },
            ],
          },
        ],
        states: {
          empty: { role: 'text', id: 't.empty', content: 'No rows' },
          denied: { role: 'text', id: 't.denied', content: 'Denied' },
        },
      },
      {
        id: 's.items',
        title: 'Items',
        layout: [
          {
            name: 'main',
            surfaces: [
              { role: 'form', id: 'f.create', formId: 'f.item' },
              { role: 'action', id: 'a.refresh', actionId: 'act.list', label: 'Refresh' },
            ],
          },
        ],
      },
      {
        id: 's.item-detail',
        title: 'Item',
        layout: [
          {
            name: 'main',
            surfaces: [
              { role: 'component', id: 'c.badge', componentId: 'cmp.badge', revision: '2' },
            ],
          },
        ],
      },
    ],
    views: [
      { viewId: 'v.items', resourceId: 'items', resourceRevision: '2', fields: ['id', 'title'] },
    ],
    forms: [
      {
        formId: 'f.item',
        resourceId: 'items',
        resourceRevision: '2',
        inputContractId: 'c.item',
        fields: [{ name: 'title', label: 'Title', required: true }],
        submitActionId: 'act.create',
      },
    ],
    actions: [
      { kind: 'local', id: 'act.local', revision: '1' },
      { kind: 'navigation', id: 'act.nav', revision: '1', routeId: 'home' },
      { kind: 'query', id: 'act.list', revision: '1', resourceId: 'items', resourceRevision: '2' },
      {
        kind: 'mutation',
        id: 'act.create',
        revision: '1',
        resourceId: 'items',
        resourceRevision: '2',
        op: 'create',
        inputContractId: 'c.item',
      },
      {
        kind: 'capability',
        id: 'act.cap',
        revision: '1',
        capabilityId: 'cap.ping',
        capabilityRevision: '1',
        inputContractId: 'c.item',
      },
    ],
    resources: [{ resourceId: 'items', revision: '2' }],
    components: [{ componentId: 'cmp.badge', revision: '2' }],
    compatibility: { vict: '^0.1.0', applicationSchema: APPLICATION_DEFINITION_SCHEMA },
    theme: 'vict.default-theme',
  };
}

/** Complete, valid vict.application@2 definition (full delivery vocabulary). */
function validV2Application(): Record<string, unknown> {
  return {
    schema: APPLICATION_DEFINITION_SCHEMA_V2,
    id: 'app.vectors',
    revision: '7',
    name: 'Vector Application',
    routes: [
      {
        id: 'home',
        path: '/',
        screenId: 's.dashboard',
        nav: { label: 'Dashboard', group: 'Main', order: 1 },
      },
      { id: 'items', path: '/items', screenId: 's.items', nav: { label: 'Items', order: 2 } },
      { id: 'item-detail', path: '/items/:id', screenId: 's.item-detail' },
      { id: 'alias', path: '/dash', redirect: 'home' },
    ],
    screens: [
      {
        id: 's.dashboard',
        title: 'Dashboard',
        layout: [
          {
            name: 'main',
            surfaces: [
              { role: 'text', id: 't.intro', content: 'Overview', level: 2 },
              {
                role: 'view',
                id: 'v.rows',
                viewId: 'v.items',
                visibleWhen: { viewNonEmpty: 'v.items' },
              },
              {
                role: 'status',
                id: 'st.ok',
                value: 'operational',
                tones: { operational: 'success', down: 'danger' },
              },
              {
                role: 'chart',
                id: 'ch.qty',
                viewId: 'v.items',
                kind: 'bar',
                xField: 'status',
                yField: 'qty',
                summary: 'Quantity by status',
              },
            ],
          },
        ],
        states: {
          loading: { role: 'text', id: 't.loading', content: 'Loading' },
          empty: { role: 'text', id: 't.empty', content: 'No rows' },
          validation: { role: 'text', id: 't.validation', content: 'Invalid' },
          denied: { role: 'text', id: 't.denied', content: 'Denied' },
          failure: { role: 'text', id: 't.failure', content: 'Failed' },
          stale: { role: 'text', id: 't.stale', content: 'Stale' },
          partial: { role: 'text', id: 't.partial', content: 'Partial' },
        },
        breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Current' }],
      },
      {
        id: 's.items',
        title: 'Items',
        layout: [
          {
            name: 'main',
            surfaces: [
              {
                role: 'table',
                id: 'tb.items',
                viewId: 'v.items',
                columns: [{ field: 'title', label: 'Title', sortable: true }, { field: 'qty' }],
                queryActionId: 'act.list',
                searchFields: ['title'],
                filterFields: ['status'],
                pageSize: 10,
                emptyMessage: 'Nothing here',
              },
              {
                role: 'list',
                id: 'li.items',
                viewId: 'v.items',
                titleField: 'title',
                secondaryField: 'status',
                visibleWhen: { viewNonEmpty: 'v.items' },
              },
              {
                role: 'action',
                id: 'a.refresh',
                actionId: 'act.list',
                label: 'Refresh',
                disabledWhen: { paramMissing: 'id' },
              },
            ],
          },
        ],
      },
      {
        id: 's.item-detail',
        title: 'Item',
        layout: [
          {
            name: 'main',
            surfaces: [
              {
                role: 'detail',
                id: 'd.item',
                viewId: 'v.items',
                fields: ['title', 'qty'],
                emptyMessage: 'Gone',
              },
              {
                role: 'component',
                id: 'c.badge',
                componentId: 'cmp.badge',
                revision: '2',
                props: { tone: 'calm', level: 3 },
              },
              {
                role: 'tabs',
                id: 'tabs.extra',
                tabs: [
                  {
                    name: 'notes',
                    label: 'Notes',
                    surfaces: [{ role: 'text', id: 't.notes', content: 'Notes' }],
                  },
                ],
              },
            ],
          },
          {
            name: 'side',
            surfaces: [
              {
                role: 'dialog',
                id: 'dlg.help',
                title: 'Help',
                triggerLabel: 'Open help',
                content: [{ role: 'text', id: 't.help', content: 'Help text' }],
              },
              {
                role: 'drawer',
                id: 'dr.log',
                title: 'Log',
                triggerLabel: 'Open log',
                content: [{ role: 'text', id: 't.log', content: 'Log text' }],
              },
              {
                role: 'states',
                id: 'st.rows',
                viewId: 'v.items',
                visibleWhen: { paramEquals: { name: 'id', value: 'special' } },
              },
              {
                role: 'conversation',
                id: 'cv.chat',
                viewId: 'v.items',
                messageField: 'note',
                authorField: 'id',
                participantField: 'status',
                sendActionId: 'act.create',
                inputLabel: 'Send',
                inputPlaceholder: 'Type here',
                emptyMessage: 'Quiet',
              },
            ],
          },
        ],
        breadcrumbs: [{ label: 'Items', routeId: 'items' }, { label: 'Detail' }],
      },
    ],
    views: [
      {
        viewId: 'v.items',
        resourceId: 'items',
        resourceRevision: '2',
        fields: ['id', 'title', 'qty', 'status', 'note'],
      },
    ],
    forms: [
      {
        formId: 'f.item',
        resourceId: 'items',
        resourceRevision: '2',
        inputContractId: 'c.item',
        fields: [
          { name: 'title', label: 'Title', required: true, widget: 'text' },
          { name: 'qty', label: 'Qty', widget: 'number' },
        ],
        submitActionId: 'act.create',
      },
    ],
    actions: [
      { kind: 'local', id: 'act.local', revision: '1' },
      { kind: 'navigation', id: 'act.nav', revision: '1', routeId: 'home' },
      { kind: 'query', id: 'act.list', revision: '1', resourceId: 'items', resourceRevision: '2' },
      {
        kind: 'mutation',
        id: 'act.create',
        revision: '1',
        resourceId: 'items',
        resourceRevision: '2',
        op: 'create',
        inputContractId: 'c.item',
      },
      {
        kind: 'capability',
        id: 'act.cap',
        revision: '1',
        capabilityId: 'cap.ping',
        capabilityRevision: '1',
        inputContractId: 'c.item',
      },
    ],
    resources: [{ resourceId: 'items', revision: '2' }],
    components: [{ componentId: 'cmp.badge', revision: '2' }],
    compatibility: { vict: '^0.1.0', applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
    theme: {
      reference: 'vict.default-theme',
      tokens: [{ name: 'color.accent', value: '#204066' }],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Identity vectors — captured BYTE-EXACT at d346bad (pre-correction)  */
/* ------------------------------------------------------------------ */

const VECTOR_V1 = 'v1_377edb54188aa02f2562d771d7eee7b55b98cb78e0ceb16573c5e4fb1753b5a0';
const VECTOR_V2 = 'v1_145586e982dae2154371728f6331821ead7c72a5180b8797b315c179572228ec';

const MANIFEST_JSON_V1 =
  '{"actions":[{"capabilityId":"cap.ping","capabilityRevision":"1","id":"act.cap","inputContractId":"c.item","kind":"capability","revision":"1"},{"id":"act.create","inputContractId":"c.item","kind":"mutation","op":"create","resourceId":"items","resourceRevision":"2","revision":"1"},{"id":"act.list","kind":"query","resourceId":"items","resourceRevision":"2","revision":"1"},{"id":"act.local","kind":"local","revision":"1"},{"id":"act.nav","kind":"navigation","revision":"1","routeId":"home"}],"compatibility":{"applicationSchema":"vict.application@1","vict":"^0.1.0"},"components":[{"componentId":"cmp.badge","revision":"2"}],"forms":[{"fields":[{"label":"Title","name":"title","required":true}],"formId":"f.item","inputContractId":"c.item","resourceId":"items","resourceRevision":"2","submitActionId":"act.create"}],"id":"app.vectors","name":"Vector Application","resources":[{"resourceId":"items","revision":"2"}],"revision":"3","routes":[{"id":"home","nav":{"group":"Main","label":"Dashboard","order":1},"path":"/","screenId":"s.dashboard"},{"id":"items","nav":{"label":"Items","order":2},"path":"/items","screenId":"s.items"},{"id":"item-detail","path":"/items/:id","screenId":"s.item-detail"}],"schema":"vict.application@1","screens":[{"id":"s.dashboard","layout":[{"name":"main","surfaces":[{"content":"Overview","id":"t.intro","role":"text"},{"id":"v.rows","role":"view","viewId":"v.items"}]}],"states":{"denied":{"content":"Denied","id":"t.denied","role":"text"},"empty":{"content":"No rows","id":"t.empty","role":"text"}},"title":"Dashboard"},{"id":"s.item-detail","layout":[{"name":"main","surfaces":[{"componentId":"cmp.badge","id":"c.badge","revision":"2","role":"component"}]}],"title":"Item"},{"id":"s.items","layout":[{"name":"main","surfaces":[{"formId":"f.item","id":"f.create","role":"form"},{"actionId":"act.list","id":"a.refresh","label":"Refresh","role":"action"}]}],"title":"Items"}],"theme":"vict.default-theme","views":[{"fields":["id","title"],"resourceId":"items","resourceRevision":"2","viewId":"v.items"}]}';

const MANIFEST_JSON_V2 =
  '{"actions":[{"capabilityId":"cap.ping","capabilityRevision":"1","id":"act.cap","inputContractId":"c.item","kind":"capability","revision":"1"},{"id":"act.create","inputContractId":"c.item","kind":"mutation","op":"create","resourceId":"items","resourceRevision":"2","revision":"1"},{"id":"act.list","kind":"query","resourceId":"items","resourceRevision":"2","revision":"1"},{"id":"act.local","kind":"local","revision":"1"},{"id":"act.nav","kind":"navigation","revision":"1","routeId":"home"}],"compatibility":{"applicationSchema":"vict.application@2","vict":"^0.1.0"},"components":[{"componentId":"cmp.badge","revision":"2"}],"forms":[{"fields":[{"label":"Title","name":"title","required":true,"widget":"text"},{"label":"Qty","name":"qty","widget":"number"}],"formId":"f.item","inputContractId":"c.item","resourceId":"items","resourceRevision":"2","submitActionId":"act.create"}],"id":"app.vectors","name":"Vector Application","resources":[{"resourceId":"items","revision":"2"}],"revision":"7","routes":[{"id":"home","nav":{"group":"Main","label":"Dashboard","order":1},"path":"/","screenId":"s.dashboard"},{"id":"items","nav":{"label":"Items","order":2},"path":"/items","screenId":"s.items"},{"id":"item-detail","path":"/items/:id","screenId":"s.item-detail"},{"id":"alias","path":"/dash","redirect":"home"}],"schema":"vict.application@2","screens":[{"breadcrumbs":[{"label":"Home","routeId":"home"},{"label":"Current"}],"id":"s.dashboard","layout":[{"name":"main","surfaces":[{"content":"Overview","id":"t.intro","level":2,"role":"text"},{"id":"v.rows","role":"view","viewId":"v.items","visibleWhen":{"viewNonEmpty":"v.items"}},{"id":"st.ok","role":"status","tones":{"down":"danger","operational":"success"},"value":"operational"},{"id":"ch.qty","kind":"bar","role":"chart","summary":"Quantity by status","viewId":"v.items","xField":"status","yField":"qty"}]}],"states":{"denied":{"content":"Denied","id":"t.denied","role":"text"},"empty":{"content":"No rows","id":"t.empty","role":"text"},"failure":{"content":"Failed","id":"t.failure","role":"text"},"loading":{"content":"Loading","id":"t.loading","role":"text"},"partial":{"content":"Partial","id":"t.partial","role":"text"},"stale":{"content":"Stale","id":"t.stale","role":"text"},"validation":{"content":"Invalid","id":"t.validation","role":"text"}},"title":"Dashboard"},{"breadcrumbs":[{"label":"Items","routeId":"items"},{"label":"Detail"}],"id":"s.item-detail","layout":[{"name":"main","surfaces":[{"emptyMessage":"Gone","fields":["title","qty"],"id":"d.item","role":"detail","viewId":"v.items"},{"componentId":"cmp.badge","id":"c.badge","props":{"level":3,"tone":"calm"},"revision":"2","role":"component"},{"id":"tabs.extra","role":"tabs","tabs":[{"label":"Notes","name":"notes","surfaces":[{"content":"Notes","id":"t.notes","role":"text"}]}]}]},{"name":"side","surfaces":[{"content":[{"content":"Help text","id":"t.help","role":"text"}],"id":"dlg.help","role":"dialog","title":"Help","triggerLabel":"Open help"},{"content":[{"content":"Log text","id":"t.log","role":"text"}],"id":"dr.log","role":"drawer","title":"Log","triggerLabel":"Open log"},{"id":"st.rows","role":"states","viewId":"v.items","visibleWhen":{"paramEquals":{"name":"id","value":"special"}}},{"authorField":"id","emptyMessage":"Quiet","id":"cv.chat","inputLabel":"Send","inputPlaceholder":"Type here","messageField":"note","participantField":"status","role":"conversation","sendActionId":"act.create","viewId":"v.items"}]}],"title":"Item"},{"id":"s.items","layout":[{"name":"main","surfaces":[{"columns":[{"field":"title","label":"Title","sortable":true},{"field":"qty"}],"emptyMessage":"Nothing here","filterFields":["status"],"id":"tb.items","pageSize":10,"queryActionId":"act.list","role":"table","searchFields":["title"],"viewId":"v.items"},{"id":"li.items","role":"list","secondaryField":"status","titleField":"title","viewId":"v.items","visibleWhen":{"viewNonEmpty":"v.items"}},{"actionId":"act.list","disabledWhen":{"paramMissing":"id"},"id":"a.refresh","label":"Refresh","role":"action"}]}],"title":"Items"}],"theme":{"reference":"vict.default-theme","tokens":[{"name":"color.accent","value":"#204066"}]},"views":[{"fields":["id","title","qty","status","note"],"resourceId":"items","resourceRevision":"2","viewId":"v.items"}]}';

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

function freshInput(schema: string): CompileApplicationInput {
  const application = JSON.parse(
    JSON.stringify(
      schema === APPLICATION_DEFINITION_SCHEMA ? validV1Application() : validV2Application(),
    ),
  ) as Record<string, unknown>;
  return {
    application: application as never,
    resources: JSON.parse(JSON.stringify(vectorResources())) as never,
    contracts: JSON.parse(JSON.stringify(contracts)) as never,
    capabilities: JSON.parse(JSON.stringify(capabilities)) as never,
    components: JSON.parse(JSON.stringify(registryComponents)) as never,
  };
}

/** Deep member of the compile input addressed by a dotted base path. */
function memberAt(input: Record<string, unknown>, base: string): Record<string, unknown> {
  let node: unknown = input;
  for (const part of base.split('.')) {
    const container = node as Record<string, unknown>;
    if (/^\d+$/.test(part)) {
      node = (container as unknown as unknown[])[Number(part)];
    } else {
      node = container[part];
    }
  }
  return node as Record<string, unknown>;
}

/**
 * Mirror of the compiler's entry-key path label: valid string ids render
 * verbatim, everything else renders as a safe type description.
 */
function keyLabel(value: unknown): string {
  return typeof value === 'string' ? value : value === null ? 'null' : typeof value;
}

function expectRejected(input: CompileApplicationInput, code: string, path?: string): void {
  const result = compileApplication(input);
  expect(result.ok).toBe(false);
  expect('plan' in result).toBe(false); // never a partial compiled plan
  if (!result.ok) {
    const matching = result.issues.filter((issue) => issue.code === code);
    expect(
      matching.length,
      `expected code ${code} in ${JSON.stringify(result.issues)}`,
    ).toBeGreaterThan(0);
    if (path !== undefined) {
      expect(
        matching.some((issue) => issue.path === path),
        `expected ${code} at '${path}' in ${JSON.stringify(result.issues)}`,
      ).toBe(true);
    }
  }
}

/** Mutate a member of the compile input and expect rejection. */
function rejectCase(
  schema: string,
  label: string,
  base: string,
  key: string,
  value: unknown,
  code: string,
  path: string,
): void {
  it(`${label} (${value === undefined ? 'absent' : (JSON.stringify(value) ?? String(value))}) → ${code}`, () => {
    const input = freshInput(schema);
    const container = memberAt(input as unknown as Record<string, unknown>, base);
    if (value === undefined) {
      delete container[key];
    } else {
      container[key] = value;
    }
    expectRejected(input, code, path);
  });
}

/* ------------------------------------------------------------------ */
/* LOW-05-A: the three audited malformed objects                       */
/* ------------------------------------------------------------------ */

describe('LOW-05-A regressions: the audited malformed objects are rejected', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    it(`${v}: an action without its revision is rejected with a structured diagnostic`, () => {
      const withAction = freshInput(schema);
      (
        (withAction.application as unknown as Record<string, unknown>).actions as Record<
          string,
          unknown
        >[]
      )[0] = { kind: 'local', id: 'act.broken' };
      expectRejected(
        withAction,
        'APPLICATION_EMPTY_REVISION',
        'application.actions[act.broken].revision',
      );
    });

    it(`${v}: a route without its id is rejected with a structured diagnostic`, () => {
      const withRoute = freshInput(schema);
      (
        (withRoute.application as unknown as Record<string, unknown>).routes as Record<
          string,
          unknown
        >[]
      )[0] = { path: '/', screenId: 's.dashboard' };
      expectRejected(withRoute, 'APPLICATION_EMPTY_ID', 'application.routes[undefined].id');
    });

    it(`${v}: a screen without its title is rejected with a structured diagnostic`, () => {
      const withScreen = freshInput(schema);
      delete (
        (
          (withScreen.application as unknown as Record<string, unknown>).screens as Record<
            string,
            unknown
          >[]
        )[0] as Record<string, unknown>
      ).title;
      expectRejected(
        withScreen,
        'APPLICATION_REQUIRED_MEMBER',
        'application.screens[s.dashboard].title',
      );
    });
  }
});

/* ------------------------------------------------------------------ */
/* Required-member matrix: application root collections                */
/* ------------------------------------------------------------------ */

describe('required-member matrix: application root collections', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';
    for (const key of ['routes', 'screens', 'actions', 'resources']) {
      for (const value of [undefined, null, 'nope', 42, {}]) {
        rejectCase(
          schema,
          `${v} application.${key} required array`,
          'application',
          key,
          value,
          'APPLICATION_REQUIRED_MEMBER',
          `application.${key}`,
        );
      }
    }
    // Optional set-like collections must at least be arrays when declared.
    for (const key of ['views', 'forms', 'components']) {
      for (const value of ['nope', 42, {}]) {
        rejectCase(
          schema,
          `${v} application.${key} must be an array when declared`,
          'application',
          key,
          value,
          'APPLICATION_REQUIRED_MEMBER',
          `application.${key}`,
        );
      }
    }
    // compatibility.applicationSchema is required when compatibility is declared.
    for (const value of [undefined, null, 42, '']) {
      rejectCase(
        schema,
        `${v} compatibility.applicationSchema required`,
        'application.compatibility',
        'applicationSchema',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.compatibility.applicationSchema',
      );
    }
  }
});

/* ------------------------------------------------------------------ */
/* Required-member matrix: routes, navigation, screens, regions        */
/* ------------------------------------------------------------------ */

describe('required-member matrix: routes, navigation entries, screens, regions', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    // Route id (identifier-grade).
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} route id`,
        'application.routes.0',
        'id',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        `application.routes[${keyLabel(value)}].id`,
      );
    }
    // Route path: required string (grammar remains the @2 Stage 05 policy).
    for (const value of [undefined, null, 42, {}]) {
      rejectCase(
        schema,
        `${v} route path`,
        'application.routes.0',
        'path',
        value,
        'ROUTE_PATH_INVALID',
        'application.routes[home].path',
      );
    }
    // nav.label is required when nav is declared.
    for (const value of [undefined, null, 42, {}, '']) {
      rejectCase(
        schema,
        `${v} route nav label`,
        'application.routes.0.nav',
        'label',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.routes[home].nav.label',
      );
    }
    // nav itself must be an object when declared (previously silently
    // dropped from the canonical manifest for primitives).
    rejectCase(
      schema,
      `${v} route nav wrong container`,
      'application.routes.0',
      'nav',
      42,
      'APPLICATION_REQUIRED_MEMBER',
      'application.routes[home].nav',
    );

    // Screen id (identifier-grade) and title (required non-empty string).
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} screen id`,
        'application.screens.0',
        'id',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        `application.screens[${keyLabel(value)}].id`,
      );
    }
    for (const value of [undefined, null, 42, {}, '']) {
      rejectCase(
        schema,
        `${v} screen title`,
        'application.screens.0',
        'title',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.screens[s.dashboard].title',
      );
    }
    // Screen layout must be an array (previously a generic compile failure).
    for (const value of [undefined, null, 42, {}, 'main']) {
      rejectCase(
        schema,
        `${v} screen layout`,
        'application.screens.0',
        'layout',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.screens[s.dashboard].layout',
      );
    }
    // Region name and surfaces.
    for (const value of [undefined, null, 42, '', {}]) {
      rejectCase(
        schema,
        `${v} region name`,
        'application.screens.0.layout.0',
        'name',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        `application.screens[s.dashboard].layout[${keyLabel(value)}].name`,
      );
    }
    for (const value of [undefined, null, 42, {}]) {
      rejectCase(
        schema,
        `${v} region surfaces`,
        'application.screens.0.layout.0',
        'surfaces',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.screens[s.dashboard].layout[main].surfaces',
      );
    }
  }
});

/* ------------------------------------------------------------------ */
/* Required-member matrix: surfaces                                    */
/* ------------------------------------------------------------------ */

describe('required-member matrix: surfaces', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    // Surface id (identifier-grade), probed on a text surface.
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} surface id`,
        'application.screens.0.layout.0.surfaces.0',
        'id',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        `application.screens[s.dashboard] (surface '${keyLabel(value)}').id`,
      );
    }
    // text.content is required.
    for (const value of [undefined, null, 42, {}, '']) {
      rejectCase(
        schema,
        `${v} text content`,
        'application.screens.0.layout.0.surfaces.0',
        'content',
        value,
        'INVALID_SURFACE_DECLARATION',
        "application.screens[s.dashboard] (surface 't.intro').content",
      );
    }
  }

  // @2-only surface vocabulary.
  const v2 = APPLICATION_DEFINITION_SCHEMA_V2;

  // list.titleField (previously silently skipped).
  for (const value of [undefined, null, 42, {}, '']) {
    rejectCase(
      v2,
      '@2 list titleField',
      'application.screens.1.layout.0.surfaces.1',
      'titleField',
      value,
      'INVALID_SURFACE_DECLARATION',
      "application.screens[s.items] (surface 'li.items').titleField",
    );
  }
  // table column field (previously silently skipped).
  for (const value of [undefined, null, 42, {}, '']) {
    rejectCase(
      v2,
      '@2 table column field',
      'application.screens.1.layout.0.surfaces.0.columns.0',
      'field',
      value,
      'INVALID_TABLE_DECLARATION',
      "application.screens[s.items] (surface 'tb.items').columns[0].field",
    );
  }
  // action surface label (previously accepted when absent).
  for (const value of [undefined, null, 42, {}, '']) {
    rejectCase(
      v2,
      '@2 action surface label',
      'application.screens.1.layout.0.surfaces.2',
      'label',
      value,
      'INVALID_SURFACE_DECLARATION',
      "application.screens[s.items] (surface 'a.refresh').label",
    );
  }
  // chart xField/yField (previously silently skipped).
  for (const key of ['xField', 'yField']) {
    for (const value of [undefined, null, 42, {}, '']) {
      rejectCase(
        v2,
        `@2 chart ${key}`,
        'application.screens.0.layout.0.surfaces.3',
        key,
        value,
        'INVALID_CHART_DECLARATION',
        `application.screens[s.dashboard] (surface 'ch.qty').${key}`,
      );
    }
  }
  // conversation messageField/authorField/inputLabel (previously silent).
  for (const key of ['messageField', 'authorField', 'inputLabel']) {
    for (const value of [undefined, null, 42, {}, '']) {
      rejectCase(
        v2,
        `@2 conversation ${key}`,
        'application.screens.2.layout.1.surfaces.3',
        key,
        value,
        'INVALID_CONVERSATION_DECLARATION',
        `application.screens[s.item-detail] (surface 'cv.chat').${key}`,
      );
    }
  }
  // tab surfaces must be an array (previously silently ignored).
  rejectCase(
    v2,
    '@2 tab surfaces missing',
    'application.screens.2.layout.0.surfaces.2.tabs.0',
    'surfaces',
    undefined,
    'INVALID_TABS_DECLARATION',
    "application.screens[s.item-detail] (surface 'tabs.extra').tabs[0].surfaces",
  );
  rejectCase(
    v2,
    '@2 tab surfaces wrong container',
    'application.screens.2.layout.0.surfaces.2.tabs.0',
    'surfaces',
    'nope',
    'INVALID_TABS_DECLARATION',
    "application.screens[s.item-detail] (surface 'tabs.extra').tabs[0].surfaces",
  );

  // list/table/detail view references must resolve (previously unchecked).
  for (const [surfaceIndex, surfaceId] of [
    [1, 'li.items'],
    [0, 'tb.items'],
  ] as const) {
    it(`@2 ${surfaceId} surface referencing an unknown view is rejected`, () => {
      const input = freshInput(v2);
      const surfaces = memberAt(
        input as unknown as Record<string, unknown>,
        'application.screens.1.layout.0.surfaces',
      ) as unknown as Record<string, unknown>[];
      surfaces[surfaceIndex]!.viewId = 'v.ghost';
      expectRejected(
        input,
        'UNKNOWN_VIEW_REFERENCE',
        `application.screens[s.items] (surface '${surfaceId}').viewId`,
      );
    });
  }
  it('@2 detail surface referencing an unknown view is rejected', () => {
    const input = freshInput(v2);
    const surfaces = memberAt(
      input as unknown as Record<string, unknown>,
      'application.screens.2.layout.0.surfaces',
    ) as unknown as Record<string, unknown>[];
    surfaces[0]!.viewId = 'v.ghost';
    expectRejected(
      input,
      'UNKNOWN_VIEW_REFERENCE',
      "application.screens[s.item-detail] (surface 'd.item').viewId",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Required-member matrix: views, forms, actions, references           */
/* ------------------------------------------------------------------ */

describe('required-member matrix: views, forms, fields, actions, references', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    // View binding members.
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} view viewId`,
        'application.views.0',
        'viewId',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        `application.views[${keyLabel(value)}].viewId`,
      );
    }
    for (const key of ['resourceId', 'resourceRevision']) {
      for (const value of [undefined, null, 42, {}, '', '   ']) {
        rejectCase(
          schema,
          `${v} view ${key}`,
          'application.views.0',
          key,
          value,
          value === '   '
            ? 'APPLICATION_INVALID_IDENTIFIER'
            : key === 'resourceId'
              ? 'APPLICATION_EMPTY_ID'
              : 'APPLICATION_EMPTY_REVISION',
          `application.views[v.items].${key}`,
        );
      }
    }

    // Form binding members.
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} form formId`,
        'application.forms.0',
        'formId',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        `application.forms[${keyLabel(value)}].formId`,
      );
    }
    for (const key of ['resourceId', 'inputContractId', 'submitActionId']) {
      for (const value of [undefined, null, 42, {}, '', '   ']) {
        rejectCase(
          schema,
          `${v} form ${key}`,
          'application.forms.0',
          key,
          value,
          value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
          `application.forms[f.item].${key}`,
        );
      }
    }
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} form resourceRevision`,
        'application.forms.0',
        'resourceRevision',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_REVISION',
        `application.forms[f.item].resourceRevision`,
      );
    }
    // Form fields must be an array; each field requires name and label.
    for (const value of [undefined, null, 42, {}]) {
      rejectCase(
        schema,
        `${v} form fields`,
        'application.forms.0',
        'fields',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.forms[f.item].fields',
      );
    }
    for (const key of ['name', 'label']) {
      for (const value of [undefined, null, 42, {}, '']) {
        rejectCase(
          schema,
          `${v} form field ${key}`,
          'application.forms.0.fields.0',
          key,
          value,
          key === 'name' ? 'APPLICATION_EMPTY_ID' : 'APPLICATION_REQUIRED_MEMBER',
          key === 'name'
            ? `application.forms[f.item].fields[${keyLabel(value)}].name`
            : 'application.forms[f.item].fields[title].label',
        );
      }
    }

    // Actions: id and revision on every kind (the audited LOW-05-A gap).
    const actionIndexByKind: Record<string, number> = {
      local: 0,
      navigation: 1,
      query: 2,
      mutation: 3,
      capability: 4,
    };
    for (const [kind, index] of Object.entries(actionIndexByKind)) {
      const kindActionId = ['act.local', 'act.nav', 'act.list', 'act.create', 'act.cap'][
        index as number
      ];
      for (const value of [undefined, null, 42, {}, '', '   ']) {
        rejectCase(
          schema,
          `${v} ${kind} action id`,
          `application.actions.${index}`,
          'id',
          value,
          value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
          `application.actions[${keyLabel(value)}].id`,
        );
        rejectCase(
          schema,
          `${v} ${kind} action revision`,
          `application.actions.${index}`,
          'revision',
          value,
          value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_REVISION',
          `application.actions[${keyLabel(kindActionId)}].revision`,
        );
      }
    }
    // Kind-specific required members.
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} navigation action routeId`,
        'application.actions.1',
        'routeId',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        'application.actions[act.nav].routeId',
      );
      for (const key of ['resourceId', 'resourceRevision']) {
        rejectCase(
          schema,
          `${v} query action ${key}`,
          'application.actions.2',
          key,
          value,
          value === '   '
            ? 'APPLICATION_INVALID_IDENTIFIER'
            : key === 'resourceId'
              ? 'APPLICATION_EMPTY_ID'
              : 'APPLICATION_EMPTY_REVISION',
          `application.actions[act.list].${key}`,
        );
      }
      for (const key of ['capabilityId', 'capabilityRevision', 'inputContractId']) {
        rejectCase(
          schema,
          `${v} capability action ${key}`,
          'application.actions.4',
          key,
          value,
          value === '   '
            ? 'APPLICATION_INVALID_IDENTIFIER'
            : key === 'capabilityRevision'
              ? 'APPLICATION_EMPTY_REVISION'
              : 'APPLICATION_EMPTY_ID',
          `application.actions[act.cap].${key}`,
        );
      }
    }
    for (const value of [undefined, null, 42, {}, '']) {
      rejectCase(
        schema,
        `${v} mutation action op`,
        'application.actions.3',
        'op',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'application.actions[act.create].op',
      );
    }
    rejectCase(
      schema,
      `${v} mutation action op whitespace-only`,
      'application.actions.3',
      'op',
      '   ',
      'APPLICATION_INVALID_IDENTIFIER',
      'application.actions[act.create].op',
    );
    for (const value of [undefined, null, 42, {}, '', '   ']) {
      rejectCase(
        schema,
        `${v} mutation action inputContractId`,
        'application.actions.3',
        'inputContractId',
        value,
        value === '   ' ? 'APPLICATION_INVALID_IDENTIFIER' : 'APPLICATION_EMPTY_ID',
        'application.actions[act.create].inputContractId',
      );
    }

    // Resource references (application-level).
    for (const key of ['resourceId', 'revision']) {
      for (const value of [undefined, null, 42, {}, '', '   ']) {
        rejectCase(
          schema,
          `${v} resource reference ${key}`,
          'application.resources.0',
          key,
          value,
          value === '   '
            ? 'APPLICATION_INVALID_IDENTIFIER'
            : key === 'resourceId'
              ? 'APPLICATION_EMPTY_ID'
              : 'APPLICATION_EMPTY_REVISION',
          `application.resources[${key === 'resourceId' ? keyLabel(value) : 'items'}].${key}`,
        );
      }
    }
    // Component references (application-level).
    for (const key of ['componentId', 'revision']) {
      for (const value of [undefined, null, 42, {}, '', '   ']) {
        rejectCase(
          schema,
          `${v} component reference ${key}`,
          'application.components.0',
          key,
          value,
          value === '   '
            ? 'APPLICATION_INVALID_IDENTIFIER'
            : key === 'revision'
              ? 'APPLICATION_EMPTY_REVISION'
              : 'APPLICATION_EMPTY_ID',
          `application.components[${key === 'componentId' ? keyLabel(value) : 'cmp.badge'}].${key}`,
        );
      }
    }
  }

  // A form submitActionId must reference a DECLARED action (the previously
  // unused UNKNOWN_FORM_ACTION code).
  it('form submitActionId referencing an unknown action is rejected (UNKNOWN_FORM_ACTION)', () => {
    const input = freshInput(APPLICATION_DEFINITION_SCHEMA);
    (
      memberAt(input as unknown as Record<string, unknown>, 'application.forms.0') as Record<
        string,
        unknown
      >
    ).submitActionId = 'act.ghost';
    expectRejected(input, 'UNKNOWN_FORM_ACTION', 'application.forms[f.item].submitActionId');
  });
});

/* ------------------------------------------------------------------ */
/* Required-member matrix: provided bindings (resources + registries)  */
/* ------------------------------------------------------------------ */

describe('required-member matrix: provided resources and registries', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    for (const value of [undefined, null, 42, {}, 'vict.resource@2']) {
      it(`${v} provided resource schema marker required (${value === undefined ? 'absent' : JSON.stringify(value)})`, () => {
        const input = freshInput(schema);
        const resource = (input.resources as unknown as Record<string, unknown>[])[0]!;
        if (value === undefined) {
          delete resource.schema;
        } else {
          resource.schema = value as never;
        }
        expectRejected(input, 'APPLICATION_UNKNOWN_SCHEMA', 'resources[items].schema');
      });
    }
    for (const key of ['id', 'revision']) {
      for (const value of [undefined, null, 42, {}, '', '   ']) {
        rejectCase(
          schema,
          `${v} provided resource ${key}`,
          'resources.0',
          key,
          value,
          value === '   '
            ? 'APPLICATION_INVALID_IDENTIFIER'
            : key === 'id'
              ? 'APPLICATION_EMPTY_ID'
              : 'APPLICATION_EMPTY_REVISION',
          key === 'id' ? `resources[${keyLabel(value)}].id` : 'resources[items].revision',
        );
      }
    }
    for (const value of [undefined, null, 42, 'id', []]) {
      rejectCase(
        schema,
        `${v} provided resource identity`,
        'resources.0',
        'identity',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'resources[items].identity',
      );
    }
    for (const value of [undefined, null, 42, '', {}]) {
      rejectCase(
        schema,
        `${v} provided resource identity key`,
        'resources.0.identity',
        'key',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'resources[items].identity.key',
      );
    }
    for (const value of [undefined, null, 42, {}]) {
      rejectCase(
        schema,
        `${v} provided resource fields`,
        'resources.0',
        'fields',
        value,
        'APPLICATION_REQUIRED_MEMBER',
        'resources[items].fields',
      );
    }
    for (const key of ['name', 'type']) {
      for (const value of [undefined, null, 42, {}, '']) {
        rejectCase(
          schema,
          `${v} provided resource field ${key}`,
          'resources.0.fields.0',
          key,
          value,
          key === 'name' ? 'APPLICATION_EMPTY_ID' : 'APPLICATION_REQUIRED_MEMBER',
          key === 'name' ? 'resources[items].fields[0].name' : 'resources[items].fields[0].type',
        );
      }
    }

    // Registry entries.
    for (const key of ['id', 'revision']) {
      for (const value of [undefined, null, 42, {}, '']) {
        rejectCase(
          schema,
          `${v} contract registry ${key}`,
          'contracts.0',
          key,
          value,
          key === 'id' ? 'APPLICATION_EMPTY_ID' : 'APPLICATION_EMPTY_REVISION',
          `contracts[0].${key}`,
        );
        rejectCase(
          schema,
          `${v} capability registry ${key}`,
          'capabilities.0',
          key,
          value,
          key === 'id' ? 'APPLICATION_EMPTY_ID' : 'APPLICATION_EMPTY_REVISION',
          `capabilities[0].${key}`,
        );
      }
    }
    for (const key of ['componentId', 'revision']) {
      for (const value of [undefined, null, 42, {}, '']) {
        rejectCase(
          schema,
          `${v} component registry ${key}`,
          'components.0',
          key,
          value,
          key === 'componentId' ? 'APPLICATION_EMPTY_ID' : 'APPLICATION_EMPTY_REVISION',
          `components[0].${key}`,
        );
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* Raw JavaScript and JSON (no TypeScript protection)                  */
/* ------------------------------------------------------------------ */

describe('raw JavaScript and JSON inputs are validated at the runtime boundary', () => {
  it('a JSON.parse result missing a required member is rejected', () => {
    const application = JSON.parse(JSON.stringify(validV1Application()));
    delete application.actions; // whole collection absent
    const result = compileApplication({
      application,
      resources: vectorResources() as never,
      contracts: contracts as never,
      capabilities: capabilities as never,
      components: registryComponents as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('APPLICATION_REQUIRED_MEMBER');
      expect(
        result.issues.find((issue) => issue.code === 'APPLICATION_REQUIRED_MEMBER')?.path,
      ).toBe('application.actions');
    }
  });

  it('a JSON.parse result with an action missing its revision is rejected', () => {
    const application = JSON.parse(JSON.stringify(validV2Application()));
    application.actions = [{ kind: 'local', id: 'act.json' }];
    const result = compileApplication({
      application,
      resources: vectorResources() as never,
      contracts: contracts as never,
      capabilities: capabilities as never,
      components: registryComponents as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'APPLICATION_EMPTY_REVISION')).toBe(true);
    }
  });

  it('a throwing getter fails closed without a raw exception or an echo', () => {
    const application = validV1Application() as Record<string, unknown>;
    const screen = (application.screens as Record<string, unknown>[])[0];
    Object.defineProperty(screen, 'title', {
      enumerable: true,
      get() {
        throw new Error('SECRET-canary-getter');
      },
    });
    let result: ReturnType<typeof compileApplication>;
    expect(() => {
      result = compileApplication({
        application: application as never,
        resources: vectorResources() as never,
        contracts: contracts as never,
        capabilities: capabilities as never,
        components: registryComponents as never,
      });
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    if (!result!.ok) {
      expect(JSON.stringify(result!.issues)).not.toContain('SECRET-canary-getter');
    }
  });

  it('a revoked proxy fails closed without a raw exception', () => {
    const { proxy, revoke } = Proxy.revocable({ id: 'r', path: '/r', screenId: 's.items' }, {});
    const application = validV1Application() as Record<string, unknown>;
    (application.routes as unknown[]).push(proxy);
    revoke();
    let result: ReturnType<typeof compileApplication>;
    expect(() => {
      result = compileApplication({
        application: application as never,
        resources: vectorResources() as never,
        contracts: contracts as never,
        capabilities: capabilities as never,
        components: registryComponents as never,
      });
    }).not.toThrow();
    expect(result!.ok).toBe(false);
  });

  it('a hostile proxy route fails closed without echoing the handler message', () => {
    const application = validV1Application() as Record<string, unknown>;
    const hostile = new Proxy(
      { id: 'route.hostile' },
      {
        get(target, key) {
          if (key === 'revision' || key === 'path' || key === 'screenId') {
            throw new Error('SECRET-hostile-proxy');
          }
          return (target as Record<string, unknown>)[key as string];
        },
      },
    );
    (application.routes as unknown[]).push(hostile);
    const result = compileApplication({
      application: application as never,
      resources: vectorResources() as never,
      contracts: contracts as never,
      capabilities: capabilities as never,
      components: registryComponents as never,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.ok ? [] : result.issues)).not.toContain('SECRET-hostile-proxy');
  });

  it('an exotic-prototype value (class instance) is rejected as a non-canonical value', () => {
    class ExoticTheme {
      reference = 'vict.default-theme';
    }
    const application = validV1Application() as Record<string, unknown>;
    application.theme = new ExoticTheme();
    const result = compileApplication({
      application: application as never,
      resources: vectorResources() as never,
      contracts: contracts as never,
      capabilities: capabilities as never,
      components: registryComponents as never,
    });
    // The canonical serializable domain rejects the exotic prototype before
    // any ambiguous applicationVersion is produced.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('APPLICATION_NON_CANONICAL_VALUE');
    }
  });
});

/* ------------------------------------------------------------------ */
/* Determinism and diagnostic discipline                               */
/* ------------------------------------------------------------------ */

describe('diagnostics are deterministic, path-sorted and non-echoing', () => {
  it('multiple missing members produce stable path-sorted diagnostics', () => {
    const a = freshInput(APPLICATION_DEFINITION_SCHEMA);
    const appA = a.application as unknown as Record<string, unknown>;
    delete appA.screens;
    delete appA.routes;
    const b = freshInput(APPLICATION_DEFINITION_SCHEMA);
    const appB = b.application as unknown as Record<string, unknown>;
    delete appB.routes;
    delete appB.screens;
    const resultA = compileApplication(a);
    const resultB = compileApplication(b);
    expect(resultA.ok).toBe(false);
    expect(resultB.ok).toBe(false);
    if (!resultA.ok && !resultB.ok) {
      expect(resultA.issues).toEqual(resultB.issues);
      const paths = resultA.issues.map((issue) => issue.path ?? '');
      expect([...paths].sort()).toEqual(paths);
    }
  });

  it('object property insertion order does not affect diagnostics', () => {
    const build = (order: 'a' | 'b'): CompileApplicationInput => {
      const input = freshInput(APPLICATION_DEFINITION_SCHEMA);
      const application = input.application as unknown as Record<string, unknown>;
      // Same malformed route (nav declared without its required label),
      // built with two different property insertion orders.
      const route = (application.routes as unknown as Record<string, unknown>[])[0]!;
      (application.routes as unknown as Record<string, unknown>[])[0] =
        order === 'a'
          ? { id: route.id, path: route.path, screenId: route.screenId, nav: { order: 1 } }
          : {
              nav: { order: 1 },
              screenId: route.screenId,
              path: route.path,
              id: route.id,
            };
      return input;
    };
    const a = compileApplication(build('a'));
    const b = compileApplication(build('b'));
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok && !b.ok) {
      expect(a.issues).toEqual(b.issues);
    }
  });

  it('supplied secret canaries never appear in diagnostics of invalid definitions', () => {
    const input = freshInput(APPLICATION_DEFINITION_SCHEMA_V2);
    const screen = (input.application as unknown as Record<string, unknown>).screens as Record<
      string,
      unknown
    >[];
    (screen[0] as Record<string, unknown>).title = null;
    const view = (input.application as unknown as Record<string, unknown>).views as Record<string, unknown>[];
    (view[0] as Record<string, unknown>).resourceRevision = {
      toString: () => 'SECRET-canary-string',
      valueOf: () => 'SECRET-canary-string',
    };
    const action = (input.application as unknown as Record<string, unknown>).actions as Record<
      string,
      unknown
    >[];
    (action[0] as Record<string, unknown>).revision = Object.assign(
      /* hostile */ {},
      {
        toString: () => 'SECRET-canary-object',
      },
    );
    const result = compileApplication(input);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.ok ? [] : result.issues)).not.toContain('SECRET-canary');
  });

  it('invalid input never receives an applicationVersion (no partial plan)', () => {
    const input = freshInput(APPLICATION_DEFINITION_SCHEMA);
    ((input.application as unknown as Record<string, unknown>).actions as Record<string, unknown>[])[1] = {
      kind: 'navigation',
      id: 'act.nav2',
    };
    const result = compileApplication(input);
    expect(result.ok).toBe(false);
    expect('plan' in result).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Valid compatibility: @1 and @2 remain byte-identical                */
/* ------------------------------------------------------------------ */

describe('valid vict.application@1 and @2 definitions keep their exact identity', () => {
  it('the valid @1 fixture compiles unchanged with the pre-correction identity vector', () => {
    const input = freshInput(APPLICATION_DEFINITION_SCHEMA);
    const result = compileApplication(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.applicationVersion).toBe(VECTOR_V1);
    expect(
      computeApplicationVersion({
        application: input.application,
        resources: input.resources,
      }),
    ).toBe(VECTOR_V1);
  });

  it('the valid @2 fixture compiles unchanged with the pre-correction identity vector', () => {
    const input = freshInput(APPLICATION_DEFINITION_SCHEMA_V2);
    const result = compileApplication(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.applicationVersion).toBe(VECTOR_V2);
    expect(
      computeApplicationVersion({
        application: input.application,
        resources: input.resources,
      }),
    ).toBe(VECTOR_V2);
  });

  it('the @1 canonical manifest is byte-identical to the pre-correction bytes', () => {
    const application = freshInput(APPLICATION_DEFINITION_SCHEMA).application;
    expect(stableJson(canonicalApplicationManifest(application as never))).toBe(MANIFEST_JSON_V1);
  });

  it('the @2 canonical manifest is byte-identical to the pre-correction bytes', () => {
    const application = freshInput(APPLICATION_DEFINITION_SCHEMA_V2).application;
    expect(stableJson(canonicalApplicationManifest(application as never))).toBe(MANIFEST_JSON_V2);
  });

  it('set-like declaration order still never affects identity; ordered semantics still do', () => {
    const input = freshInput(APPLICATION_DEFINITION_SCHEMA_V2);
    const application = input.application as unknown as Record<string, unknown>;
    const reordered = JSON.parse(JSON.stringify(application)) as Record<string, unknown>;
    (reordered.screens as unknown[]).reverse();
    (reordered.actions as unknown[]).reverse();
    (reordered.forms as unknown[]).reverse();
    expect(
      computeApplicationVersion({
        application: reordered as never,
        resources: input.resources,
      }),
    ).toBe(VECTOR_V2);

    const reorderedRoutes = JSON.parse(JSON.stringify(application)) as Record<string, unknown>;
    (reorderedRoutes.routes as unknown[]).reverse();
    expect(
      computeApplicationVersion({
        application: reorderedRoutes as never,
        resources: input.resources,
      }),
    ).not.toBe(VECTOR_V2);
  });
});
