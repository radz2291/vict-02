import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_DEFINITION_SCHEMA_V2,
  defineApplication,
} from '@vict/sdk';
import { compileApplication, stableJson } from '../src/index.js';
import { CanonicalIdentityError } from '../src/compile.js';
import type { CompileApplicationInput } from '../src/index.js';

/**
 * Stage 05 closure-blocker remediation: ONE strict canonical-input boundary.
 *
 * These tests run at the RUNTIME compiler boundary with raw plain JavaScript
 * objects — the exact shape a `JSON.parse` result, a packed-JavaScript
 * consumer, or a hostile author can construct. They pin the corrections for
 * the closure-audit blockers:
 *
 * - Blocker A / AUDIT-LOW-2: semantics inherited through a prototype chain,
 *   hidden behind non-enumerable own properties, supplied through
 *   accessors, or keyed by symbols can never compile; two semantically
 *   different definitions can never share one identity through an empty
 *   canonical declaration.
 * - Blocker C / AUDIT-LOW-1: sparse arrays are structurally rejected (in the
 *   canonicalization implementation itself and at the compile boundary), so
 *   a sparse value and its explicit-null twin can never receive the same
 *   application identity.
 * - Blocker E: component-surface `props` enforce the declared bounded
 *   primitive domain (`Readonly<Record<string, string | number | boolean>>`).
 * - Blocker D: compilation never freezes, mutates, or retains caller-owned
 *   objects; plans are built from defensive VICT-owned captures, and later
 *   caller mutation cannot change a compiled plan, manifest, or identity.
 *
 * Valid plain data keeps its exact established canonical bytes: the identity
 * vectors below were captured from the PRE-REMEDIATION implementation and
 * are asserted BYTE-IDENTICAL here.
 */

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function vectorResource(): Record<string, unknown> {
  return {
    schema: 'vict.resource@1',
    id: 'tasks',
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
    ],
  };
}

function baseApplication(schema: string): Record<string, unknown> {
  return {
    schema,
    id: 'app.boundary',
    revision: '1',
    routes: [{ id: 'home', path: '/home', screenId: 's.home' }],
    screens: [
      {
        id: 's.home',
        title: 'Home',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.hello', content: 'Hello' }] }],
      },
    ],
    actions: [],
    resources: [{ resourceId: 'tasks', revision: '1' }],
  };
}

function compile(
  application: unknown,
  extra: Partial<CompileApplicationInput> = {},
): ReturnType<typeof compileApplication> {
  return compileApplication({
    application: application as never,
    resources: [vectorResource()] as never,
    ...extra,
  });
}

function expectStructuralRejection(
  result: ReturnType<typeof compileApplication>,
  code: string,
  path?: string,
): void {
  expect(result.ok).toBe(false);
  expect('plan' in result).toBe(false);
  expect(JSON.stringify(result)).not.toContain('applicationVersion');
  if (!result.ok) {
    const matching = result.issues.filter((issue) => issue.code === code);
    expect(matching.length, JSON.stringify(result.issues)).toBeGreaterThan(0);
    if (path !== undefined) {
      expect(
        matching.some((issue) => issue.path === path),
        `expected ${code} at '${path}' in ${JSON.stringify(result.issues)}`,
      ).toBe(true);
    }
  }
}

/** Minimal application carrying one custom-component surface with props. */
function propsApplication(
  props: unknown,
  schema: string = APPLICATION_DEFINITION_SCHEMA,
): Record<string, unknown> {
  return {
    schema,
    id: 'app',
    revision: '1',
    routes: [{ id: 'home', path: '/home', screenId: 'home' }],
    screens: [
      {
        id: 'home',
        title: 'Home',
        layout: [
          {
            name: 'main',
            surfaces: [
              {
                role: 'component',
                id: 'c1',
                componentId: 'widget',
                revision: '1',
                ...(props !== undefined ? { props } : {}),
              },
            ],
          },
        ],
      },
    ],
    actions: [],
    resources: [{ resourceId: 'tasks', revision: '1' }],
    components: [{ componentId: 'widget', revision: '1' }],
  };
}

const propsInput = (props: unknown): CompileApplicationInput => ({
  application: propsApplication(props) as never,
  resources: [vectorResource()] as never,
  components: [{ componentId: 'widget', revision: '1' }],
});

/** The exact application-version bytes for the props fixture above with
 * `{ label: 'x', count: 3, flag: true }`, captured from the
 * PRE-REMEDIATION implementation (valid primitive props keep their
 * established canonical bytes and behavior). */
const PROPS_PRIMITIVE_VECTOR =
  'v1_0c807fad39de28a278b73ae64e182a98ca382645f21316bd73294b0fc0a336d5';

const PROPS_SURFACE_PATH = "application.screens[home] (surface 'c1')";
const PROPS_WALK_PATH = 'application.screens[0].layout[0].surfaces[0].props';

/* ------------------------------------------------------------------ */
/* Blocker A / AUDIT-LOW-2: semantic identity and declaration visibility */
/* ------------------------------------------------------------------ */

describe('semantic identity: inherited and hidden declarations are rejected', () => {
  for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
    const v = schema === APPLICATION_DEFINITION_SCHEMA ? '@1' : '@2';

    it(`${v}: a local action whose required fields come from a prototype is rejected`, () => {
      const application = baseApplication(schema);
      (application.actions as unknown[]) = [
        Object.create({ kind: 'local', id: 'act.same', revision: '1' }),
      ];
      expectStructuralRejection(
        compile(application),
        'APPLICATION_NON_CANONICAL_VALUE',
        'application.actions[0]',
      );
    });

    it(`${v}: a navigation action whose required fields come from a prototype is rejected`, () => {
      const application = baseApplication(schema);
      (application.actions as unknown[]) = [
        Object.create({ kind: 'navigation', id: 'act.same', revision: '1', routeId: 'home' }),
      ];
      expectStructuralRejection(
        compile(application),
        'APPLICATION_NON_CANONICAL_VALUE',
        'application.actions[0]',
      );
    });

    it(`${v}: inherited and hidden semantics can no longer collide — the pre-remediation collision pair now rejects`, () => {
      // Pre-remediation, these two EMPTY canonical declarations both compiled
      // to the SAME applicationVersion (v1_46723273294218ba…): executable
      // semantics differed while identity was identical. Both are now
      // rejected, so neither can receive any applicationVersion at all.
      const local = Object.create({ kind: 'local', id: 'act.same', revision: '1' });
      const navigation = Object.create({
        kind: 'navigation',
        id: 'act.same',
        revision: '1',
        routeId: 'home',
      });
      const withLocal = baseApplication(schema);
      (withLocal.actions as unknown[]) = [local];
      const withNavigation = baseApplication(schema);
      (withNavigation.actions as unknown[]) = [navigation];
      const resultLocal = compile(withLocal);
      const resultNavigation = compile(withNavigation);
      expect(resultLocal.ok).toBe(false);
      expect(resultNavigation.ok).toBe(false);
      expect(JSON.stringify(resultLocal)).not.toContain('applicationVersion');
      expect(JSON.stringify(resultNavigation)).not.toContain('applicationVersion');
    });

    it(`${v}: non-enumerable required fields are rejected and produce no partial plan`, () => {
      const application = baseApplication(schema);
      const hidden = {};
      Object.defineProperty(hidden, 'kind', { value: 'local', enumerable: false });
      Object.defineProperty(hidden, 'id', { value: 'act.hidden', enumerable: false });
      Object.defineProperty(hidden, 'revision', { value: '1', enumerable: false });
      (application.actions as unknown[]) = [hidden];
      const result = compile(application);
      // Pre-remediation this compiled with plan.actions['act.hidden'] === {}
      // (a partial plan). Now rejected with deterministic, path-sorted
      // structural diagnostics.
      expectStructuralRejection(result, 'APPLICATION_NON_CANONICAL_VALUE');
      if (!result.ok) {
        expect(result.issues.map((issue) => issue.path)).toEqual([
          'application.actions[0].id',
          'application.actions[0].kind',
          'application.actions[0].revision',
        ]);
      }
    });

    it(`${v}: an inherited screen declaration cannot compile through its prototype`, () => {
      const application = baseApplication(schema);
      (application.screens as unknown[]) = [
        Object.create({
          id: 's.home',
          title: 'Home',
          layout: [{ name: 'main', surfaces: [] }],
        }),
      ];
      expectStructuralRejection(
        compile(application),
        'APPLICATION_NON_CANONICAL_VALUE',
        'application.screens[0]',
      );
    });
  }

  it('accessor-backed required fields are rejected without invoking the accessor or leaking its message', () => {
    let invocations = 0;
    const action = {};
    Object.defineProperty(action, 'kind', {
      enumerable: true,
      get() {
        invocations += 1;
        return 'local';
      },
    });
    Object.defineProperty(action, 'id', {
      enumerable: true,
      get() {
        invocations += 1;
        throw new Error('SECRET-accessor-canary');
      },
    });
    Object.defineProperty(action, 'revision', {
      enumerable: true,
      get() {
        invocations += 1;
        return '1';
      },
    });
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    (application.actions as unknown[]) = [action];
    let result: ReturnType<typeof compileApplication> | undefined;
    expect(() => {
      result = compile(application);
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    // The accessor was NEVER invoked merely to validate it: descriptor
    // inspection rejected it safely.
    expect(invocations).toBe(0);
    expect(JSON.stringify(result)).not.toContain('SECRET-accessor-canary');
    expect(JSON.stringify(result)).not.toContain('applicationVersion');
  });

  it('symbol-keyed declaration data is rejected', () => {
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    const marked = { kind: 'local', id: 'act.marked', revision: '1' };
    Object.defineProperty(marked, Symbol('hidden'), { value: 'x', enumerable: true });
    (application.actions as unknown[]) = [marked];
    expectStructuralRejection(
      compile(application),
      'APPLICATION_NON_CANONICAL_VALUE',
      'application.actions[0][(symbol)]',
    );
  });
});

/* ------------------------------------------------------------------ */
/* Blocker C / AUDIT-LOW-1: sparse arrays fail closed                   */
/* ------------------------------------------------------------------ */

describe('sparse arrays: structurally rejected, never equal to explicit null', () => {
  it('stableJson rejects a sparse array structurally', () => {
    const sparse: unknown[] = [];
    sparse[1] = 'x'; // [, "x"]
    let thrown: unknown;
    try {
      stableJson(sparse);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CanonicalIdentityError);
    expect((thrown as CanonicalIdentityError).code).toBe('NON_CANONICAL_VALUE');
  });

  it('stableJson keeps accepting a real explicit-null element with the established bytes', () => {
    expect(stableJson([null, 'x'])).toBe('[null,"x"]');
  });

  it('a sparse array and its explicit-null twin can never share one valid identity', () => {
    const sparse: unknown[] = [];
    sparse[1] = 'x';
    // Pre-remediation, a sparse array inside an accepted container
    // canonicalized to the SAME bytes as its explicit-null twin and both
    // received the same applicationVersion. Now: the sparse input is
    // rejected outright and never receives any identity at all, while the
    // explicit-null declaration remains valid canonical data.
    const sparseApplication = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    (sparseApplication.routes as unknown[]) = [
      { id: 'home', path: '/home', screenId: 's.home' },
      sparse,
    ];
    const sparseResult = compile(sparseApplication);
    expectStructuralRejection(
      sparseResult,
      'APPLICATION_NON_CANONICAL_VALUE',
      'application.routes[1][0]',
    );

    expect(stableJson([null, 'x'])).toBe('[null,"x"]');
    let sparseCanonical: string | undefined;
    try {
      sparseCanonical = stableJson(sparse);
    } catch {
      sparseCanonical = undefined; // structurally rejected — no canonical bytes exist
    }
    expect(sparseCanonical).toBeUndefined();
  });

  const sparseLocations: [string, (app: Record<string, unknown>, sparse: unknown[]) => void][] = [
    ['application.routes', (app, s) => ((app.routes as unknown[][]) = [[], s])],
    [
      'screen.layout',
      (app, s) => (((app.screens as Record<string, unknown>[])[0]!.layout as unknown[]) = [s]),
    ],
    [
      'region.surfaces',
      (app, s) =>
        ((((app.screens as Record<string, unknown>[])[0]!.layout as Record<string, unknown>[])[0]!
          .surfaces as unknown[]) = [s]),
    ],
  ];

  for (const [label, mutate] of sparseLocations) {
    it(`a sparse array nested at ${label} fails closed (@1 and @2)`, () => {
      const sparse: unknown[] = [];
      sparse[0] = null;
      sparse[2] = { hole: true };
      for (const schema of [APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]) {
        const application = baseApplication(schema);
        mutate(application, sparse);
        const input: CompileApplicationInput = {
          application: application as never,
          resources: [vectorResource()] as never,
        };
        const result = compileApplication(input);
        expect(result.ok).toBe(false);
        expect('plan' in result).toBe(false);
        expect(JSON.stringify(result)).not.toContain('applicationVersion');
        expect(JSON.stringify(result)).toContain('APPLICATION_NON_CANONICAL_VALUE');
      }
    });
  }

  it('a sparse array in @2-only canonical locations fails closed', () => {
    // Built with raw JavaScript (a JSON round-trip would destroy the hole —
    // exactly why these exotica require deliberate JS construction).
    const sparse: unknown[] = [];
    sparse[1] = 'label';
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA_V2);
    (application.screens as Record<string, unknown>[])[0]!.breadcrumbs = [
      { label: 'Home', routeId: 'home' },
      sparse,
    ];
    const result = compile(application);
    expectStructuralRejection(
      result,
      'APPLICATION_NON_CANONICAL_VALUE',
      'application.screens[0].breadcrumbs[1][0]',
    );
  });

  it('an undefined array element fails closed like a hole (positional data has no absent meaning)', () => {
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    const withUndefined: unknown[] = [{ label: 'Home', routeId: 'home' }, undefined];
    (application.screens as Record<string, unknown>[])[0]!.breadcrumbs = withUndefined as never;
    expectStructuralRejection(
      compile(application),
      'APPLICATION_NON_CANONICAL_VALUE',
      'application.screens[0].breadcrumbs[1]',
    );
  });

  it('a sparse array in a provided resource binding fails closed', () => {
    const sparse: unknown[] = [];
    sparse[1] = { name: 'title', type: 'string' };
    const resource = { ...vectorResource(), fields: sparse };
    const result = compileApplication({
      application: baseApplication(APPLICATION_DEFINITION_SCHEMA) as never,
      resources: [resource] as never,
    });
    expectStructuralRejection(result, 'APPLICATION_NON_CANONICAL_VALUE', 'resources[0].fields[0]');
  });
});

/* ------------------------------------------------------------------ */
/* Blocker E: the declared component-prop domain                        */
/* ------------------------------------------------------------------ */

describe('component props: the declared bounded primitive domain is enforced', () => {
  it('string, finite number, and boolean props compile with their established identity bytes', () => {
    const result = compileApplication(propsInput({ label: 'x', count: 3, flag: true }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.applicationVersion).toBe(PROPS_PRIMITIVE_VECTOR);
    }
  });

  it('absent props still compile', () => {
    const result = compileApplication(propsInput(undefined));
    expect(result.ok).toBe(true);
  });

  const declaredDomainRejections: [string, unknown, string, string][] = [
    ['null container', null, 'INVALID_SURFACE_DECLARATION', PROPS_SURFACE_PATH + '.props'],
    ['array container', ['a', 'b'], 'INVALID_SURFACE_DECLARATION', PROPS_SURFACE_PATH + '.props'],
    [
      'nested object value',
      { nested: { deep: 1 } },
      'INVALID_SURFACE_DECLARATION',
      PROPS_SURFACE_PATH + '.props.nested',
    ],
    [
      'array value',
      { list: ['a'] },
      'INVALID_SURFACE_DECLARATION',
      PROPS_SURFACE_PATH + '.props.list',
    ],
    [
      'undefined value',
      { missing: undefined },
      'INVALID_SURFACE_DECLARATION',
      PROPS_SURFACE_PATH + '.props.missing',
    ],
  ];

  for (const [label, props, code, path] of declaredDomainRejections) {
    it(`${label} is rejected with a stable structured diagnostic`, () => {
      expectStructuralRejection(compileApplication(propsInput(props)), code, path);
    });
  }

  const canonicalDomainRejections: [string, unknown, string][] = [
    ['function value', { fn: (): number => 1 }, PROPS_WALK_PATH + '.fn'],
    ['symbol value', { sym: Symbol('s') }, PROPS_WALK_PATH + '.sym'],
    ['BigInt value', { big: BigInt(1) }, PROPS_WALK_PATH + '.big'],
    ['NaN value', { nan: Number.NaN }, PROPS_WALK_PATH + '.nan'],
    ['positive Infinity value', { inf: Number.POSITIVE_INFINITY }, PROPS_WALK_PATH + '.inf'],
    ['negative Infinity value', { inf: Number.NEGATIVE_INFINITY }, PROPS_WALK_PATH + '.inf'],
    ['negative zero value', { nz: -0 }, PROPS_WALK_PATH + '.nz'],
    ['Date value', { d: new Date(0) }, PROPS_WALK_PATH + '.d'],
    ['sparse array container', Object.assign([], { 1: 'x' }), PROPS_WALK_PATH + '[0]'],
    ['inherited container', Object.create({ inherited: 'v' }), PROPS_WALK_PATH],
  ];

  for (const [label, props, path] of canonicalDomainRejections) {
    it(`${label} is rejected by the canonical input boundary`, () => {
      expectStructuralRejection(
        compileApplication(propsInput(props)),
        'APPLICATION_NON_CANONICAL_VALUE',
        path,
      );
    });
  }

  it('a non-enumerable prop is rejected', () => {
    const props = {};
    Object.defineProperty(props, 'hidden', { value: 'x', enumerable: false });
    expectStructuralRejection(
      compileApplication(propsInput(props)),
      'APPLICATION_NON_CANONICAL_VALUE',
      PROPS_WALK_PATH + '.hidden',
    );
  });

  it('an accessor prop is rejected without being invoked', () => {
    let invocations = 0;
    const props = {};
    Object.defineProperty(props, 'backed', {
      enumerable: true,
      get() {
        invocations += 1;
        return 'SECRET-prop-canary';
      },
    });
    const result = compileApplication(propsInput(props));
    expect(invocations).toBe(0);
    expectStructuralRejection(
      result,
      'APPLICATION_NON_CANONICAL_VALUE',
      PROPS_WALK_PATH + '.backed',
    );
    expect(JSON.stringify(result)).not.toContain('SECRET-prop-canary');
  });

  it('a hostile proxy props container fails closed without echoing handler messages', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('SECRET-proxy-keys-canary');
        },
        get() {
          throw new Error('SECRET-proxy-get-canary');
        },
      },
    );
    let result: ReturnType<typeof compileApplication> | undefined;
    expect(() => {
      result = compileApplication(propsInput(hostile));
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SECRET-proxy');
    expect(JSON.stringify(result)).not.toContain('applicationVersion');
  });

  it('props delivered on the plan are immutable VICT-owned copies', () => {
    const callerProps = { label: 'x', count: 3, flag: true };
    const result = compileApplication(propsInput(callerProps));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const planProps = (
      result.plan.screens['home']!.layout[0] as unknown as {
        surfaces: { props: unknown }[];
      }
    ).surfaces[0]!.props;
    expect(Object.isFrozen(planProps)).toBe(true);
    expect(planProps).not.toBe(callerProps);
  });

  it('mutating caller props after compilation cannot alter the compiled props', () => {
    const callerProps = { label: 'x', count: 3, flag: true };
    const result = compileApplication(propsInput(callerProps));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const before = JSON.stringify(result.plan.screens['home']);
    callerProps.label = 'MUTATED';
    delete (callerProps as Record<string, unknown>).flag;
    expect(JSON.stringify(result.plan.screens['home'])).toBe(before);
    expect(JSON.stringify(result.plan.manifest)).not.toContain('MUTATED');
    expect(result.plan.applicationVersion).toBe(PROPS_PRIMITIVE_VECTOR);
  });
});

/* ------------------------------------------------------------------ */
/* Blocker D: caller ownership and defensive captures                   */
/* ------------------------------------------------------------------ */

describe('caller ownership: never frozen, never retained, mutation-proof', () => {
  it('valid caller inputs remain unfrozen and unmutated after compilation', () => {
    const application = propsApplication({ label: 'x' });
    const resource = vectorResource();
    const snapshot = JSON.stringify({ application, resource });
    const result = compileApplication({
      application: application as never,
      resources: [resource] as never,
      components: [{ componentId: 'widget', revision: '1' }],
    });
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(application)).toBe(false);
    expect(Object.isFrozen(resource)).toBe(false);
    expect(Object.isFrozen((application.screens as Record<string, unknown>[])[0])).toBe(false);
    expect(
      Object.isFrozen(
        (
          (
            (application.screens as Record<string, unknown>[])[0]!.layout as Record<
              string,
              unknown
            >[]
          )[0]!.surfaces as Record<string, unknown>[]
        )[0],
      ),
    ).toBe(false);
    expect(JSON.stringify({ application, resource })).toBe(snapshot);
  });

  it('rejected exotic inputs remain unfrozen', () => {
    const exotic = Object.create({ kind: 'local', id: 'act.same', revision: '1' });
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    (application.actions as unknown[]) = [exotic];
    const result = compile(application);
    expect(result.ok).toBe(false);
    // Pre-remediation, an accepted exotic action came back FROZEN from the
    // compiler; rejection now leaves the caller's object completely alone.
    expect(Object.isFrozen(exotic)).toBe(false);
  });

  it('plans never retain caller object references', () => {
    const application = JSON.parse(
      JSON.stringify({
        ...propsApplication({ label: 'x' }),
        actions: [{ kind: 'local', id: 'act.local', revision: '1' }],
      }),
    ) as Record<string, unknown>;
    const callerAction = (application.actions as Record<string, unknown>[])[0];
    const callerScreen = (application.screens as Record<string, unknown>[])[0];
    const callerRoute = (application.routes as Record<string, unknown>[])[0];
    const callerResourceRef = (application.resources as Record<string, unknown>[])[0];
    const resource = vectorResource();
    const result = compileApplication({
      application: application as never,
      resources: [resource] as never,
      components: [{ componentId: 'widget', revision: '1' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.actions['act.local']).not.toBe(callerAction);
    expect(result.plan.screens['home']).not.toBe(callerScreen);
    expect(result.plan.routes[0]!.route).not.toBe(callerRoute);
    expect(result.plan.resources['tasks']).not.toBe(resource);
    expect(JSON.stringify(result.plan.manifest.resources)).toBe(
      JSON.stringify([callerResourceRef]),
    );
    expect(Object.isFrozen(result.plan.actions['act.local'])).toBe(true);
  });

  it('mutating a caller object after compilation cannot change the plan, manifest, or version', () => {
    const application = JSON.parse(
      JSON.stringify({
        ...propsApplication({ label: 'x' }),
        actions: [{ kind: 'local', id: 'act.local', revision: '1' }],
      }),
    ) as Record<string, unknown>;
    const resource = vectorResource();
    const result = compileApplication({
      application: application as never,
      resources: [resource] as never,
      components: [{ componentId: 'widget', revision: '1' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const before = {
      toJSON: JSON.stringify(result.plan.toJSON()),
      version: result.plan.applicationVersion,
      manifest: JSON.stringify(result.plan.manifest),
      screens: JSON.stringify(result.plan.screens),
      actions: JSON.stringify(result.plan.actions),
    };
    // Deep-mutate every caller-owned structure.
    (application.routes as Record<string, unknown>[])[0]!.path = '/MUTATED';
    (application.screens as Record<string, unknown>[])[0]!.title = 'MUTATED';
    (
      (
        (application.screens as Record<string, unknown>[])[0]!.layout as Record<string, unknown>[]
      )[0]!.surfaces as Record<string, unknown>[]
    )[0]!.content = 'MUTATED';
    (application.actions as Record<string, unknown>[])[0]!.revision = 'MUTATED';
    (application.resources as Record<string, unknown>[])[0]!.revision = 'MUTATED';
    ((resource.fields as Record<string, unknown>[])[0] as Record<string, unknown>).name = 'MUTATED';
    const callerSurface = (
      (application.screens as Record<string, unknown>[])[0]!.layout as Record<string, unknown>[]
    )[0] as Record<string, unknown>;
    ((callerSurface.surfaces as Record<string, unknown>[])[0] as Record<string, unknown>).content =
      'MUTATED';
    (
      ((callerSurface.surfaces as Record<string, unknown>[])[0] as Record<string, unknown>)
        .props as Record<string, unknown>
    ).label = 'MUTATED';
    expect(JSON.stringify(result.plan.toJSON())).toBe(before.toJSON);
    expect(result.plan.applicationVersion).toBe(before.version);
    expect(JSON.stringify(result.plan.manifest)).toBe(before.manifest);
    expect(JSON.stringify(result.plan.screens)).toBe(before.screens);
    expect(JSON.stringify(result.plan.actions)).toBe(before.actions);
  });

  it('frozen captured definitions (defineApplication) still compile — the boundary accepts frozen plain data', () => {
    const plain = propsApplication({ label: 'x' });
    const plainResult = compileApplication({
      application: plain as never,
      resources: [vectorResource()] as never,
      components: [{ componentId: 'widget', revision: '1' }],
    });
    expect(plainResult.ok).toBe(true);
    const captured = defineApplication(propsApplication({ label: 'x' }) as never);
    const result = compileApplication({
      application: captured as never,
      resources: [vectorResource()] as never,
      components: [{ componentId: 'widget', revision: '1' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok && plainResult.ok) {
      // Freezing/capture does not change identity: frozen plain data is
      // accepted canonical data.
      expect(result.plan.applicationVersion).toBe(plainResult.plan.applicationVersion);
      expect(Object.isFrozen(captured)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Diagnostic discipline at the structural boundary                     */
/* ------------------------------------------------------------------ */

describe('structural diagnostics are deterministic, sorted, and non-echoing', () => {
  it('the same malformed input produces identical diagnostics across compilations', () => {
    const build = (): CompileApplicationInput => {
      const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
      const action = {};
      Object.defineProperty(action, 'kind', { value: 'local', enumerable: false });
      Object.defineProperty(action, 'id', { value: 'act.hidden', enumerable: false });
      (application.actions as unknown[]) = [action];
      return { application: application as never, resources: [vectorResource()] as never };
    };
    const a = compileApplication(build());
    const b = compileApplication(build());
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok && !b.ok) {
      expect(JSON.stringify(a.issues)).toBe(JSON.stringify(b.issues));
    }
  });

  it('multiple structural issues are path-sorted regardless of property insertion order', () => {
    const build = (reverse: boolean): CompileApplicationInput => {
      const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
      const exotic = Object.create(null);
      const entries: [string, unknown][] = [
        ['keep', 'x'],
        ['hidden', 'y'],
      ];
      for (const [key, value] of reverse ? [...entries].reverse() : entries) {
        Object.defineProperty(exotic, key, { value, enumerable: false });
      }
      (application.actions as unknown[]) = [exotic];
      return { application: application as never, resources: [vectorResource()] as never };
    };
    const a = compileApplication(build(false));
    const b = compileApplication(build(true));
    expect(a.ok).toBe(false);
    if (!a.ok && !b.ok) {
      expect(JSON.stringify(a.issues)).toBe(JSON.stringify(b.issues));
      const paths = a.issues.map((issue) => issue.path ?? '');
      expect([...paths].sort()).toEqual(paths);
    }
  });

  it('hostile canaries never escape into serialized diagnostics', () => {
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    const hostile = new Proxy(
      { id: 'route.hostile', path: '/hostile', screenId: 's.home' },
      {
        get(target, key) {
          if (key === 'path') {
            throw new Error('SECRET-route-canary');
          }
          return (target as Record<string, unknown>)[key as string];
        },
      },
    );
    (application.routes as unknown[]) = [hostile];
    let result: ReturnType<typeof compileApplication> | undefined;
    expect(() => {
      result = compile(application);
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SECRET-route-canary');
    expect(JSON.stringify(result)).not.toContain('applicationVersion');
  });

  it('a revoked proxy fails closed with a structured diagnostic', () => {
    const { proxy, revoke } = Proxy.revocable({ id: 'r', path: '/r', screenId: 's.home' }, {});
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    (application.routes as unknown[]) = [proxy];
    revoke();
    let result: ReturnType<typeof compileApplication> | undefined;
    expect(() => {
      result = compile(application);
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    expect('plan' in result!).toBe(false);
  });

  it('a cyclic declaration fails closed with a structured diagnostic', () => {
    const application = baseApplication(APPLICATION_DEFINITION_SCHEMA);
    const cyclic: Record<string, unknown> = { id: 'home', path: '/home', screenId: 's.home' };
    cyclic['self'] = cyclic;
    (application.routes as unknown[]) = [cyclic];
    let result: ReturnType<typeof compileApplication> | undefined;
    expect(() => {
      result = compile(application);
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('APPLICATION_NON_CANONICAL_VALUE');
    expect(JSON.stringify(result)).not.toContain('applicationVersion');
  });
});

/* ------------------------------------------------------------------ */
/* Compatibility: valid plain data keeps its exact established identity */
/* ------------------------------------------------------------------ */

describe('compatibility: the boundary changes nothing for valid plain data', () => {
  it('a valid minimal @1 application still compiles', () => {
    const result = compile(baseApplication(APPLICATION_DEFINITION_SCHEMA));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    }
  });

  it('a valid minimal @2 application still compiles', () => {
    const result = compile(baseApplication(APPLICATION_DEFINITION_SCHEMA_V2));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    }
  });

  it('explicit null values remain valid canonical data', () => {
    // A real null element/object member canonicalizes to null (established
    // bytes) and is distinguishable from an absent slot, which is rejected.
    expect(stableJson([null, 'x'])).toBe('[null,"x"]');
    expect(stableJson({ a: null })).toBe('{"a":null}');
  });

  it('JSON.parse-shaped definitions (the packed-consumer boundary) still compile', () => {
    const serialized = JSON.stringify(propsApplication({ label: 'x', count: 3, flag: true }));
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    const result = compileApplication({
      application: parsed as never,
      resources: [vectorResource()] as never,
      components: [{ componentId: 'widget', revision: '1' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.applicationVersion).toBe(PROPS_PRIMITIVE_VECTOR);
    }
  });
});
