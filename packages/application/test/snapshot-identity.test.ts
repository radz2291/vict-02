import { describe, expect, it } from 'vitest';
import { APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2 } from '@vict/sdk';
import { compileApplication, type ApplicationPlan } from '../src/index.js';

/**
 * Stage 05 final snapshot correction — permanent regression.
 *
 * The compiled plan and its toJSON() serializer must serve ONLY values
 * captured at successful compilation. The closure re-audit proved that
 * nested caller mutation cannot leak, but the root scalar identity fields
 * (applicationId / applicationRevision) were still live-read by toJSON(),
 * so one serialized plan could contradict itself: top-level identity from
 * live caller state, manifest and version from the captured original.
 *
 * These tests compile at the raw JavaScript compiler boundary (plain
 * caller-owned objects, no SDK builder), then mutate EVERY caller root
 * field and representative nested structures, and require the plan, its
 * manifest, and every serialization to remain pinned, internally
 * consistent, and byte-identical — for both vict.application@1 and
 * vict.application@2. Each test FAILS against the pre-correction
 * implementation (c4cb79b), where toJSON() live-read the caller.
 */

/* ------------------------------------------------------------------ */
/* Raw, valid, plain-JavaScript fixtures (caller-owned)                 */
/* ------------------------------------------------------------------ */

const RESOURCE_SCHEMA = 'vict.resource@1';

function snapshotResource(): Record<string, unknown> {
  return {
    schema: RESOURCE_SCHEMA,
    id: 'notes',
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'title', type: 'string' },
    ],
    queries: { list: { filters: ['title'], sort: ['title'], pagination: true } },
    mutations: [{ op: 'create', effect: 'write', inputContractId: 'c.note', idempotency: 'keyed' }],
    authorization: { effect: 'read' },
  };
}

function snapshotApplication(schema: string): Record<string, unknown> {
  return {
    schema,
    id: 'app.snap',
    revision: '1',
    name: 'Snapshot',
    theme: { tokens: [{ name: 'color.bg', value: '#ffffff' }] },
    compatibility: { applicationSchema: schema },
    routes: [
      { id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } },
      { id: 'about', path: '/about', screenId: 's.about', nav: { label: 'About', order: 2 } },
    ],
    screens: [
      {
        id: 's.home',
        title: 'Home',
        layout: [
          {
            name: 'main',
            surfaces: [
              { role: 'text', id: 't.hello', content: 'hello' },
              { role: 'view', id: 'v.notes', viewId: 'v.notes' },
              { role: 'form', id: 'f.note', formId: 'f.note' },
              { role: 'action', id: 'a.ping', actionId: 'act.ping', label: 'Ping' },
            ],
          },
        ],
        states: { empty: { role: 'text', id: 't.empty', content: 'empty' } },
      },
      {
        id: 's.about',
        title: 'About',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.about', content: 'about' }] }],
      },
    ],
    views: [{ viewId: 'v.notes', resourceId: 'notes', resourceRevision: '1', fields: ['title'] }],
    forms: [
      {
        formId: 'f.note',
        resourceId: 'notes',
        resourceRevision: '1',
        inputContractId: 'c.note',
        inputContractRevision: '2',
        fields: [{ name: 'title', label: 'Title', required: true, widget: 'text' }],
        submitActionId: 'act.save',
      },
    ],
    actions: [
      { kind: 'local', id: 'act.ping', revision: '1' },
      { kind: 'query', id: 'act.list', revision: '1', resourceId: 'notes', resourceRevision: '1' },
      {
        kind: 'mutation',
        id: 'act.save',
        revision: '1',
        resourceId: 'notes',
        resourceRevision: '1',
        op: 'create',
        inputContractId: 'c.note',
        inputContractRevision: '2',
        outputContractId: 'c.note',
        outputContractRevision: '2',
      },
    ],
    resources: [{ resourceId: 'notes', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  };
}

const contracts = [{ id: 'c.note', revision: '2' }];
const capabilities = [{ id: 'cap.summarize', revision: '1' }];
const registryComponents = [{ componentId: 'cmp.badge', revision: '1' }];

/** Exact canonical identity vectors captured at the final snapshot
 * correction. These pin the valid @1 / @2 fixtures above; any semantic
 * change to canonical identity must update them deliberately. */
const PINNED = {
  '@1': 'v1_0cb67085db7cff5793eb34b48430eda648fa1140fa1ad1ad04df924628b49452',
  '@2': 'v1_e8f7dd4756f51a8d7722360805513f15b433d2b2e25aff40096fb6321ea4b4f9',
} as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Every object reachable from `value` (depth-first, cycle-safe). */
function collectObjects(value: unknown, seen: Set<object> = new Set()): Set<object> {
  if (value === null || typeof value !== 'object') {
    return seen;
  }
  if (seen.has(value as object)) {
    return seen;
  }
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectObjects(entry, seen);
    }
  } else {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectObjects(entry, seen);
    }
  }
  return seen;
}

function compileSnapshot(schema: string): {
  application: Record<string, unknown>;
  callerObjects: Set<object>;
  plan: ApplicationPlan;
  baselineSerialized: string;
  baselineManifest: string;
  applicationVersion: string;
} {
  const application = snapshotApplication(schema);
  const resource = snapshotResource();
  const result = compileApplication({
    application: application as never,
    resources: [resource as never],
    contracts,
    capabilities,
    components: registryComponents,
  });
  if (!result.ok) {
    throw new Error(`expected valid ${schema}: ${JSON.stringify(result.issues)}`);
  }
  // Every object the caller owns, before any mutation: the application tree,
  // the resource tree, and every registry entry object.
  const callerObjects = collectObjects([
    application,
    resource,
    contracts,
    capabilities,
    registryComponents,
  ]);
  return {
    application,
    callerObjects,
    plan: result.plan,
    baselineSerialized: JSON.stringify(result.plan.toJSON()),
    baselineManifest: JSON.stringify(result.plan.manifest),
    applicationVersion: result.plan.applicationVersion,
  };
}

/** The complete pinned-plan invariant set, assertable after any mutation. */
function expectSnapshotPinned(
  ctx: ReturnType<typeof compileSnapshot>,
  extra: { label: string },
): void {
  const { plan, baselineSerialized, baselineManifest, applicationVersion, callerObjects } = ctx;
  const serialized = plan.toJSON();

  // 1. Plan scalar identity fields remain the captured values.
  expect(plan.applicationId, `${extra.label}: applicationId`).toBe('app.snap');
  expect(plan.applicationRevision, `${extra.label}: applicationRevision`).toBe('1');
  expect(plan.applicationVersion, `${extra.label}: applicationVersion`).toBe(applicationVersion);

  // 2. Manifest remains the captured canonical bytes.
  expect(JSON.stringify(plan.manifest), `${extra.label}: manifest bytes`).toBe(baselineManifest);

  // 3. Serialization remains byte-identical (and repeated calls agree).
  expect(JSON.stringify(serialized), `${extra.label}: toJSON bytes`).toBe(baselineSerialized);
  expect(JSON.stringify(plan.toJSON()), `${extra.label}: toJSON repeat`).toBe(baselineSerialized);

  // 4. Plan fields, serialized fields, and manifest identity ALL agree.
  expect(serialized['applicationId']).toBe(plan.applicationId);
  expect(serialized['applicationRevision']).toBe(plan.applicationRevision);
  expect(serialized['applicationVersion']).toBe(plan.applicationVersion);
  const manifest = serialized['manifest'] as Record<string, unknown>;
  expect(manifest['id']).toBe(plan.applicationId);
  expect(manifest['revision']).toBe(plan.applicationRevision);
  expect((plan.manifest as Record<string, unknown>)['id']).toBe(plan.applicationId);
  expect((plan.manifest as Record<string, unknown>)['revision']).toBe(plan.applicationRevision);

  // 5. No object anywhere in the plan or the serialization aliases the
  // caller, and no caller object was frozen.
  const planObjects = collectObjects([serialized]);
  for (const object of planObjects) {
    expect(callerObjects.has(object), 'plan/serialization aliases a caller object').toBe(false);
  }
  for (const object of callerObjects) {
    expect(Object.isFrozen(object), 'a caller-owned object became frozen').toBe(false);
  }
}

/* ------------------------------------------------------------------ */
/* The regression                                                       */
/* ------------------------------------------------------------------ */

describe('snapshot identity: the plan never reads caller state after compilation', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const version = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    it(`${version}: root and nested caller mutation after compilation changes nothing`, () => {
      const ctx = compileSnapshot(schema);

      // The valid identity vector is pinned before any mutation.
      expect(ctx.plan.applicationVersion).toBe(PINNED[version as '@1' | '@2']);
      expectSnapshotPinned(ctx, { label: 'baseline' });

      // ---- Phase 1: representative NESTED mutations, in place. ----
      (ctx.application['routes'] as Record<string, unknown>[])[0]!['path'] = '/MUTATED';
      (ctx.application['screens'] as Record<string, unknown>[])[0]!['title'] = 'MUTATED';
      (
        (ctx.application['screens'] as Record<string, unknown>[])[0]!['layout'] as Record<
          string,
          unknown
        >[]
      )[0]!['name'] = 'MUTATED';
      (
        (
          (ctx.application['screens'] as Record<string, unknown>[])[0]!['layout'] as Record<
            string,
            unknown
          >[]
        )[0]!['surfaces'] as Record<string, unknown>[]
      )[0]!['content'] = 'MUTATED';
      (ctx.application['views'] as Record<string, unknown>[])[0]!['fields'] = ['MUTATED'];
      (
        (ctx.application['forms'] as Record<string, unknown>[])[0]!['fields'] as Record<
          string,
          unknown
        >[]
      )[0]!['label'] = 'MUTATED';
      (ctx.application['actions'] as Record<string, unknown>[])[0]!['revision'] = 'MUTATED';
      (ctx.application['resources'] as Record<string, unknown>[])[0]!['revision'] = 'MUTATED';
      (ctx.application['components'] as Record<string, unknown>[])[0]!['revision'] = 'MUTATED';
      (ctx.application['theme'] as Record<string, unknown>)['tokens'] = [];
      expectSnapshotPinned(ctx, { label: 'after nested mutation' });

      // ---- Phase 2: EVERY caller root field, including whole-collection
      // replacement (new array identities) and the scalar identity itself. ----
      ctx.application['schema'] = 'vict.application@MUTATED';
      ctx.application['id'] = 'app.after';
      ctx.application['revision'] = '2';
      ctx.application['name'] = 'After';
      ctx.application['theme'] = {};
      ctx.application['compatibility'] = {};
      ctx.application['routes'] = [];
      ctx.application['screens'] = [];
      ctx.application['views'] = [];
      ctx.application['forms'] = [];
      ctx.application['actions'] = [];
      ctx.application['resources'] = [];
      ctx.application['components'] = [];
      expectSnapshotPinned(ctx, { label: 'after root mutation' });
    });

    it(`${version}: a returned serialization cannot alter the plan or later serializations`, () => {
      const ctx = compileSnapshot(schema);
      const first = ctx.plan.toJSON();

      // Top-level: toJSON returns a fresh object each call — mutating it
      // must not touch the plan.
      first['applicationId'] = 'MUTATED';
      first['applicationRevision'] = 'MUTATED';
      first['applicationVersion'] = 'MUTATED';

      // Nested: every captured structure is deep-frozen; mutation attempts
      // fail without corrupting anything.
      expect(() => {
        (first['manifest'] as { id: string }).id = 'MUTATED';
      }).toThrow();
      expect(() => {
        (first['routes'] as unknown[]).push('MUTATED');
      }).toThrow();

      expectSnapshotPinned(ctx, { label: 'after serialization tampering' });
      expect(first['applicationId']).toBe('MUTATED'); // the tampered copy keeps its own state
    });

    it(`${version}: five consecutive serializations are byte-identical`, () => {
      const ctx = compileSnapshot(schema);
      const seen = new Set<string>();
      for (let round = 0; round < 5; round++) {
        seen.add(JSON.stringify(ctx.plan.toJSON()));
      }
      expect(seen.size).toBe(1);
      expectSnapshotPinned(ctx, { label: 'after repeated serialization' });
    });
  }
});
