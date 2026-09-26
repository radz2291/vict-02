/**
 * One-time SvelteKit application-host scaffolder (Stage 05).
 *
 * Ownership model (OPEN-012 / APP-015):
 * - the SCAFFOLDER owns the initial generic VICT host structure;
 * - the APPLICATION AUTHOR owns their definitions, bindings, and custom
 *   code islands (`src/lib/components/`, `src/lib/application/`);
 * - subsequent definition changes are rendered dynamically by the host —
 *   VICT never regenerates or overwrites ordinary application code, and no
 *   bidirectional generated-code round trip is promised.
 *
 * Guarantees (all directly tested):
 * - DETERMINISTIC: identical options produce byte-identical files, sorted
 *   listings, LF newlines, no timestamps, no machine-specific content;
 * - NON-DESTRUCTIVE: `conflict` (with an explicit file list) instead of any
 *   overwrite; existing application-owned files are never touched;
 * - PATH-SAFE: traversal (`..`) and symlink-escape attempts are refused
 *   with a structured refusal before anything is written;
 * - IDEMPOTENT: rerunning without changes reports `unchanged`.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface ScaffoldVictAppOptions {
  /** The directory to scaffold into (created when missing). */
  readonly targetDir: string;
  /** Human application name (used in package.json and titles). */
  readonly appName: string;
  /** npm package name; derived from appName when omitted. */
  readonly packageName?: string;
  /**
   * EXPLICIT platform release-set selection: the exact @victframework
   * dependency specs the generated host consumes (package name → version
   * spec, e.g. `0.3.1` registry pins or `file:` tarball paths for a
   * candidate/unreleased set). The scaffolder NEVER invents or defaults
   * platform versions — placeholder version pins are a release-integrity
   * defect (Stage 8 F6 §6.1). The generated host requires at least:
   * `@victframework/application`, `@victframework/appdata-sqlite`,
   * `@victframework/renderer-svelte`, `@victframework/runtime`,
   * `@victframework/sdk`, `@victframework/store-sqlite`.
   */
  readonly platformDependencies: Readonly<Record<string, string>>;
}

export type ScaffoldVictAppResult =
  | { readonly status: 'created'; readonly files: readonly string[] }
  | { readonly status: 'unchanged'; readonly files: readonly string[] }
  | { readonly status: 'conflict'; readonly conflicts: readonly string[] }
  | { readonly status: 'refused'; readonly reason: string };

/** The generated file set: deterministic sorted order, LF newlines everywhere. */
export const GENERATED_FILES: readonly string[] = Object.freeze(
  [
    '.gitignore',
    'README.md',
    'package.json',
    'svelte.config.js',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'src/app.d.ts',
    'src/app.html',
    'src/lib/application/definition.ts',
    'src/lib/components/README.md',
    'src/lib/components/registry.ts',
    'src/lib/server/application-server.ts',
    'src/routes/[...vict]/+page.server.ts',
    'src/routes/[...vict]/+page.svelte',
    'src/routes/api/act/+server.ts',
  ].sort(),
);

/** The platform packages the generated generic host imports directly. */
export const REQUIRED_PLATFORM_PACKAGES: readonly string[] = Object.freeze([
  '@victframework/application',
  '@victframework/appdata-sqlite',
  '@victframework/renderer-svelte',
  '@victframework/runtime',
  '@victframework/sdk',
  '@victframework/store-sqlite',
]);

/** Validate the application/package names up front (closed, safe values). */
function validateNames(options: ScaffoldVictAppOptions): string | undefined {
  if (typeof options.appName !== 'string' || options.appName.trim().length === 0) {
    return 'appName must be a non-empty string.';
  }
  if (options.appName.length > 80) {
    return 'appName must be at most 80 characters.';
  }
  if (options.packageName !== undefined) {
    if (!/^(@[a-z0-9-]+\/)?[a-z][a-z0-9._-]*$/.test(options.packageName)) {
      return 'packageName must be a valid npm name (lowercase).';
    }
  }
  return undefined;
}

/** Validate the explicit release-set selection up front. */
function validatePlatformDependencies(
  platformDependencies: Readonly<Record<string, string>>,
): string | undefined {
  if (typeof platformDependencies !== 'object' || platformDependencies === null) {
    return 'platformDependencies must be an object mapping @victframework package names to exact specs.';
  }
  for (const required of REQUIRED_PLATFORM_PACKAGES) {
    const spec = platformDependencies[required];
    if (typeof spec !== 'string' || spec.trim().length === 0) {
      return `platformDependencies must declare an explicit spec for '${required}' (the generated host imports it); placeholder or default versions are never invented.`;
    }
  }
  for (const [name, spec] of Object.entries(platformDependencies)) {
    if (!name.startsWith('@victframework/')) {
      return `platformDependencies keys must be @victframework packages (received '${name}').`;
    }
    if (typeof spec !== 'string' || spec.trim().length === 0) {
      return `platformDependencies['${name}'] must be a non-empty version spec.`;
    }
  }
  return undefined;
}

/** Derive a safe npm package name from a human application name. */
export function derivePackageName(appName: string): string {
  const slug = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[0-9]+/, '');
  const safe = slug.length > 0 ? slug : 'vict-app';
  return `vict-${safe}`;
}

/**
 * Ensure the resolved target is a real directory (or can be created) inside
 * an existing, non-symlinked parent chain. Returns a refusal reason or
 * undefined.
 */
function checkPathSafety(targetDir: string): string | undefined {
  if (!isAbsolute(targetDir)) {
    return 'targetDir must be an absolute path.';
  }
  // Walk from the root to the target: every EXISTING component must be a
  // real directory (never a symlink), and the realpath of the deepest
  // existing ancestor must be a prefix of the resolved target.
  const segments = targetDir.split(sep).filter((segment) => segment.length > 0);
  let current = sep === '\\' ? `${segments[0]}${sep}` : sep;
  if (sep === '\\') {
    segments.shift();
  }
  for (const segment of segments) {
    current = join(current, segment);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) {
        return `The target path crosses a symbolic link at '${segment}'; refusing to scaffold.`;
      }
      if (!stat.isDirectory()) {
        return `The target path component '${segment}' exists and is not a directory.`;
      }
    }
  }
  // realpath prefix check: resolve the deepest existing ancestor and ensure
  // the target is genuinely beneath it (no .., no case tricks).
  let ancestor = targetDir;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) {
      return 'The target path has no existing ancestor directory.';
    }
    ancestor = parent;
  }
  const real = realpathSync(ancestor);
  const rel = relative(real, targetDir);
  // `rel === ''` is legitimate: scaffolding INTO an existing directory.
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return 'The resolved target escapes its real ancestor directory; refusing to scaffold.';
  }
  return undefined;
}

/**
 * Scaffold a Vict SvelteKit application host. Never throws for refusal or
 * conflict outcomes; returns a structured result instead.
 */
export function scaffoldVictApp(options: ScaffoldVictAppOptions): ScaffoldVictAppResult {
  const nameProblem = validateNames(options);
  if (nameProblem !== undefined) {
    return { status: 'refused', reason: nameProblem };
  }
  const releaseProblem = validatePlatformDependencies(options.platformDependencies);
  if (releaseProblem !== undefined) {
    return { status: 'refused', reason: releaseProblem };
  }
  const packageName = options.packageName ?? derivePackageName(options.appName);
  // Refuse relative targets BEFORE resolution: the caller must say exactly
  // where the application host goes.
  if (!isAbsolute(options.targetDir)) {
    return { status: 'refused', reason: 'targetDir must be an absolute path.' };
  }
  const targetDir = resolve(options.targetDir);
  const safety = checkPathSafety(targetDir);
  if (safety !== undefined) {
    return { status: 'refused', reason: safety };
  }

  const files = templates(targetDir, options.appName, packageName, options.platformDependencies);

  // NON-DESTRUCTIVE: check every existing file first; write only when the
  // complete set is either absent or byte-identical.
  const conflicts: string[] = [];
  let anyMissing = false;
  for (const [relativePath, content] of files) {
    const fullPath = join(targetDir, relativePath);
    if (existsSync(fullPath)) {
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        conflicts.push(relativePath);
        continue;
      }
      let existing: string;
      try {
        existing = readFileSync(fullPath, 'utf8');
      } catch {
        conflicts.push(relativePath);
        continue;
      }
      if (existing !== content) {
        conflicts.push(relativePath);
      }
    } else {
      anyMissing = true;
    }
  }
  if (conflicts.length > 0) {
    return { status: 'conflict', conflicts };
  }
  if (!anyMissing) {
    return { status: 'unchanged', files: GENERATED_FILES };
  }

  for (const [relativePath, content] of files) {
    const fullPath = join(targetDir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, { encoding: 'utf8' });
  }
  return { status: 'created', files: GENERATED_FILES };
}

/* ------------------------------------------------------------------ */
/* Deterministic templates                                             */
/* ------------------------------------------------------------------ */

function templates(
  targetDir: string,
  appName: string,
  packageName: string,
  platformDependencies: Readonly<Record<string, string>>,
): readonly (readonly [string, string])[] {
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
  // Deterministic release-set serialization: sorted keys, exact specs.
  const platformDependenciesJson = Object.fromEntries(
    Object.entries(platformDependencies).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const L = [
    [
      'package.json',
      json({
        name: packageName,
        version: '0.1.0',
        private: true,
        type: 'module',
        description: `${appName} — a Vict application rendered from a neutral Application Definition.`,
        scripts: {
          dev: 'vite dev',
          build: 'svelte-kit sync && vite build',
          preview: 'vite preview',
          test: 'vitest run',
        },
        dependencies: platformDependenciesJson,
        devDependencies: {
          '@sveltejs/adapter-node': '^5.2.12',
          '@sveltejs/kit': '^2.20.0',
          '@sveltejs/vite-plugin-svelte': '^5.0.3',
          'happy-dom': '^15.11.7',
          svelte: '^5.28.0',
          vite: '^6.3.5',
          vitest: '^4.1.11',
        },
        engines: { node: '>=22.13.0' },
      }),
    ],
    [
      'svelte.config.js',
      `import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
`,
    ],
    [
      'vite.config.ts',
      `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
});
`,
    ],
    [
      'vitest.config.ts',
      `import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte(), sveltekit()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
`,
    ],
    [
      'tsconfig.json',
      json({
        extends: './.svelte-kit/tsconfig.json',
        compilerOptions: {
          allowJs: true,
          checkJs: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          sourceMap: true,
          strict: true,
          moduleResolution: 'bundler',
        },
      }),
    ],
    [
      'src/app.html',
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`,
    ],
    [
      'src/app.d.ts',
      `// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {}
}

export {};
`,
    ],
    [
      'src/lib/application/definition.ts',
      `import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
  type CapabilityDefinition,
  type Contract,
} from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import type { ApplicationPlan } from '@victframework/application';

/**
 * YOUR APPLICATION DEFINITION — author-owned.
 *
 * This file (and src/lib/components/) is the ONLY application code you need
 * to write. Everything else generated by the scaffolder is the generic Vict
 * host: it renders whatever you declare here, resolves any route (including
 * parameters), loads every declared view, validates every declared action
 * input contract at the boundary, and dispatches capability actions through
 * the governed runtime. You never edit host files to change your domain.
 *
 * The starter 'items' domain below is a MINIMAL WORKING EXAMPLE: replace it
 * with your own resources, contracts, capabilities, views, forms, screens,
 * and actions. Custom Svelte components are code islands: create them under
 * src/lib/components/ and register them in src/lib/components/registry.ts.
 */

export const itemResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'items',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'status', type: 'string', label: 'Status' },
  ],
  queries: { list: { sort: ['title'], pagination: true } },
  mutations: [
    { op: 'create', effect: 'write', idempotency: 'keyed', permissions: ['items.write'] },
    { op: 'update', effect: 'write', permissions: ['items.write'] },
  ],
  authorization: { effect: 'read' },
});

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.starter',
  revision: '1',
  name: '${appName}',
  routes: [
    { id: 'home', path: '/', screenId: 's.dashboard', nav: { label: 'Dashboard', order: 1 } },
    { id: 'items', path: '/items', screenId: 's.items', nav: { label: 'Items', order: 2 } },
  ],
  screens: [
    {
      id: 's.dashboard',
      title: '${appName}',
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'text', id: 't.welcome', content: 'Welcome to your Vict application.', level: 2 },
            {
              role: 'chart',
              id: 'c.status',
              viewId: 'v.items',
              kind: 'bar',
              xField: 'status',
              yField: 'qty',
              summary: 'Records per status',
              title: 'Records per status',
            },
          ],
        },
      ],
    },
    {
      id: 's.items',
      title: 'Items',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Items' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'table',
              id: 'tb.items',
              viewId: 'v.items',
              queryActionId: 'act.queryItems',
              searchFields: ['title'],
              pageSize: 10,
            },
          ],
        },
      ],
      states: {
        empty: { role: 'text', id: 't.empty', content: 'No items yet.' },
        denied: { role: 'text', id: 't.denied', content: 'Denied by the authorization boundary.' },
        failure: { role: 'text', id: 't.failure', content: 'Something failed safely.' },
      },
    },
  ],
  views: [
    {
      viewId: 'v.items',
      resourceId: 'items',
      resourceRevision: '1',
      fields: ['id', 'title', 'status'],
    },
  ],
  actions: [
    {
      kind: 'query',
      id: 'act.queryItems',
      revision: '1',
      resourceId: 'items',
      resourceRevision: '1',
    },
  ],
  resources: [{ resourceId: 'items', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});

/**
 * YOUR BINDINGS — author-owned.
 *
 * The generic application server consumes exactly these exports:
 * - resources:  resource definitions for the data adapter and its migrations;
 * - contracts:  Vict contracts referenced by actions/forms/mutations
 *               (boundary pre-validation + data-layer enforcement);
 * - capabilities: capability implementations invoked through the governed
 *               runtime for declared capability actions;
 * - capabilityEffects: per-action effect hooks persisting a governed run's
 *               validated output through the data adapter (fail-closed);
 * - grants:     the SERVER-SIDE authorization profile of this deployment
 *               (never sent to the UI; the UI cannot grant itself anything).
 */
export const resources = [itemResource];
export const contracts: readonly Contract<unknown>[] = [];
export const capabilities: readonly CapabilityDefinition<unknown, unknown>[] = [];
export const grants = ['items.read', 'items.write'];

/**
 * The author-owned capability-effect hook (the one declared extension seam
 * of the generic application server): after a capability action's governed
 * run completes with a validated output, this hook persists the effect
 * through the application-data adapter under the deployment's grants. A
 * failing hook is fail-closed: the action reports ACTION_FAILED and no
 * caller ever sees a success that was not persisted.
 */
export interface CapabilityEffect {
  readonly actionId: string;
  run(value: unknown, data: import('@victframework/application').ApplicationDataAdapter): Promise<void>;
}
export const capabilityEffects: readonly CapabilityEffect[] = [];

/** Compile the neutral definition into the immutable plan. */
export function compileAppPlan(): ApplicationPlan {
  const result = compileApplication({
    application,
    resources,
    contracts,
    capabilities,
    components: [],
  });
  if (!result.ok) {
    throw new Error('The application definition is invalid; see compile diagnostics.');
  }
  return result.plan;
}
`,
    ],
    [
      'src/lib/components/README.md',
      'src/lib/components/registry.ts',
      `# Code islands (author-owned)

Everything in this directory is YOURS. The Vict scaffolder created it once
and will never write here again.

Register custom Svelte components with explicit ids and revisions in
\`registry.ts\`, reference them from your Application Definition with the
same id/revision pair, and the generic host will render them inside the
neutral surface model.

Custom components receive ONLY their declared props — never the runtime,
the database, the component registry, or secrets.
`,
    ],
    [
      'src/lib/components/registry.ts',
      `import type { ComponentRegistry } from '@victframework/application/renderer';

/**
 * YOUR COMPONENT REGISTRY — author-owned code island.
 *
 * Register custom Svelte components here with stable ids and explicit
 * revisions, reference them from your Application Definition with the same
 * id/revision pair, and the generic host renders them. Registered
 * components receive ONLY their declared props.
 *
 * Example:
 *
 * import MyWidget from './MyWidget.svelte';
 * export function registerComponents(registry: ComponentRegistry): void {
 *   registry.register({ componentId: 'app.my-widget', revision: '1', implementation: MyWidget });
 * }
 */

export function registerComponents(_registry: ComponentRegistry): void {
  // Register your custom components here.
}
`,
    ],
    [
      'src/lib/server/application-server.ts',
      `import { join } from 'node:path';
import { createSqliteApplicationData } from '@victframework/appdata-sqlite';
import { createRuntime } from '@victframework/runtime';
import { createSqliteStores } from '@victframework/store-sqlite';
import type { ApplicationDataAdapter, ApplicationPlan, ActionResult } from '@victframework/application';
import type { Contract } from '@victframework/sdk';
import {
  collectSurfaces,
  resolveRoute,
  type ViewDatum,
  type VictPlanView,
} from '@victframework/renderer-svelte';
import {
  compileAppPlan,
  resources,
  contracts,
  capabilities,
  capabilityEffects,
  grants,
} from '$lib/application/definition';

/**
 * GENERIC APPLICATION SERVER — scaffolder-owned host file, DOMAIN-FREE.
 *
 * This file contains NO application domain: every domain fact lives in the
 * author-owned src/lib/application/definition.ts (resources, contracts,
 * capabilities, grants). You never edit this file to change your domain.
 * Editing it anyway means leaving the scaffolder's no-edit host contract.
 *
 * Every non-local action crosses the explicit boundaries BELOW the UI:
 * - DECLARED input contracts are pre-validated HERE, before any governed
 *   run or durable mutation is attempted (an undeclared or malformed input,
 *   including unknown fields under a closed contract, is refused with a
 *   structured CONTRACT_REJECTED and NO run, NO events, NO state change);
 * - queries and mutations cross the application-data adapter with the
 *   server-side authorization profile and explicit effect;
 * - capability actions execute as REAL governed runs (pinned activation,
 *   declared contracts, effect policy, durable run/event records);
 * - local and navigation actions never reach this dispatcher at all.
 */

const DB_PATH = process.env.VICT_APPDATA_PATH ?? join('.data', 'appdata.sqlite');
const RUNS_PATH = process.env.VICT_RUNS_PATH ?? join('.data', 'vict-runs.sqlite');

export interface AppServer {
  readonly plan: ApplicationPlan;
  readonly data: ApplicationDataAdapter;
  dispatch(actionId: string, input?: unknown): Promise<ActionResult>;
  loadRoute(path: string): Promise<{
    readonly plan: Record<string, unknown>;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
  close(): void;
}

/** The async application factory: the generated host routes await it. */
export async function createAppServer(): Promise<AppServer> {
  const plan = compileAppPlan();
  // Durable governed runs: activation catalog + run/event records persist
  // across restarts in their own Vict-operational store.
  const runtime = createRuntime({ stores: createSqliteStores({ path: RUNS_PATH }) });
  for (const contract of contracts) {
    runtime.registerContract(contract);
  }
  for (const capability of capabilities) {
    runtime.registerCapability(capability);
  }
  const data = createSqliteApplicationData({
    path: DB_PATH,
    resources,
    contracts: contracts as readonly Contract<unknown>[],
  });

  const contractsById = new Map<string, Contract<unknown>>(contracts.map((c) => [c.id, c]));
  const activationVersions = new Map<string, string>();

  /**
   * Boundary pre-validation: the action's declared input contract runs
   * BEFORE the adapter or runtime is touched. Failures are structured and
   * safe: contract id, field NAMES only, never raw input values.
   */
  function preValidate(
    action: { readonly id: string; readonly inputContractId?: string },
    input: unknown,
  ):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly failure: ActionResult } {
    const contractId = action.inputContractId;
    if (typeof contractId !== 'string' || contractId.length === 0) {
      return { ok: true, value: input };
    }
    const contract = contractsById.get(contractId);
    if (contract === undefined) {
      return {
        ok: false,
        failure: {
          ok: false,
          code: 'CONTRACT_UNAVAILABLE',
          message: \`The contract '\${contractId}' required by action '\${action.id}' is not bound in this deployment.\`,
        },
      };
    }
    const parsed = contract.parse(input ?? {});
    if (parsed.ok) {
      return { ok: true, value: parsed.value };
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.issues.slice(0, 8)) {
      const field = String(issue.path ?? '(root)').split(/[.[]/)[0] ?? '';
      if (field.length > 0 && field !== '(root)' && fieldErrors[field] === undefined) {
        fieldErrors[field] = 'This field was rejected by the declared contract.';
      }
    }
    return {
      ok: false,
      failure: {
        ok: false,
        code: 'CONTRACT_REJECTED',
        message: \`The action input was rejected by contract '\${contract.id}@\${contract.revision}'; no run or mutation was performed.\`,
        fieldErrors,
      },
    };
  }

  async function dispatchQuery(
    action: { readonly resourceId: string },
    input: unknown,
  ): Promise<ActionResult> {
    const payload = (input ?? {}) as {
      filters?: Record<string, string>;
      search?: { text: string; fields: string[] };
      sort?: { field: string; direction: 'asc' | 'desc' }[];
      limit?: number;
      offset?: number;
    };
    const result = await data.query(
      {
        op: 'list',
        resourceId: action.resourceId,
        ...(payload.filters !== undefined ? { filters: payload.filters } : {}),
        ...(payload.search !== undefined ? { search: payload.search } : {}),
        ...(payload.sort !== undefined ? { sort: payload.sort } : {}),
        ...(payload.limit !== undefined ? { limit: payload.limit } : {}),
        ...(payload.offset !== undefined ? { offset: payload.offset } : {}),
      },
      { permissions: grants, effect: 'read' },
    );
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return { ok: true, value: { rows: result.rows ?? [], total: result.total } };
  }

  async function dispatchMutation(
    action: { readonly resourceId: string; readonly op: string },
    input: unknown,
  ): Promise<ActionResult> {
    const raw = (input ?? {}) as Record<string, unknown>;
    // __identity is renderer-internal transport metadata (the edit form's
    // update target); it never reaches a domain contract. Domain 'id' stays.
    const identity =
      typeof raw.__identity === 'string' && raw.__identity.length > 0
        ? raw.__identity
        : typeof raw.id === 'string' && raw.id.length > 0
          ? raw.id
          : undefined;
    const domainInput: Record<string, unknown> = { ...raw };
    delete domainInput.__identity;
    const pre = preValidate(action, domainInput);
    if (!pre.ok) {
      return pre.failure;
    }
    const parsedInput = (pre.value ?? {}) as Record<string, unknown>;
    const mutation = resources
      .find((resource) => resource.id === action.resourceId)
      ?.mutations?.find((candidate) => candidate.op === action.op);
    const idempotencyKey =
      mutation?.idempotency === 'keyed' &&
      action.op === 'create' &&
      typeof parsedInput.id === 'string'
        ? \`create:\${parsedInput.id}\`
        : undefined;
    const result = await data.mutate(
      {
        resourceId: action.resourceId,
        op: action.op,
        input: pre.value,
        ...(identity !== undefined ? { id: identity } : {}),
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      },
      { permissions: grants, effect: 'write' },
    );
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return { ok: true, value: result.row };
  }

  async function ensureActivation(capabilityId: string, inputContractId: string): Promise<string> {
    const graphId = \`g.\${capabilityId}\`;
    const cached = activationVersions.get(graphId);
    if (cached !== undefined) {
      return cached;
    }
    const activation = await runtime.activate({
      id: graphId,
      entry: 'only',
      nodes: [{ id: 'only', capability: capabilityId, input: inputContractId }],
      edges: [],
    });
    if (!activation.ok) {
      throw new Error('capability activation failed');
    }
    activationVersions.set(graphId, activation.activationVersion);
    return activation.activationVersion;
  }

  async function dispatchCapability(
    action: {
      readonly id: string;
      readonly capabilityId: string;
      readonly inputContractId?: string;
      readonly outputContractId?: string;
    },
    input: unknown,
  ): Promise<ActionResult> {
    const pre = preValidate(action, input ?? {});
    if (!pre.ok) {
      return pre.failure;
    }
    await ensureActivation(action.capabilityId, String(action.inputContractId ?? ''));
    const runResult = await runtime.run(pre.value, { mode: 'normal' });
    if (runResult.status !== 'completed' || runResult.output === undefined) {
      return {
        ok: false,
        code: 'ACTION_FAILED',
        message: 'The governed action did not complete; this safe failure is server-generated.',
      };
    }
    let output: unknown = runResult.output;
    const outputContractId = action.outputContractId;
    if (typeof outputContractId === 'string' && outputContractId.length > 0) {
      const outputContract = contractsById.get(outputContractId);
      const checked = outputContract?.parse(output);
      if (checked === undefined || !checked.ok) {
        return {
          ok: false,
          code: 'CONTRACT_REJECTED',
          message: \`The action output was rejected by contract '\${outputContractId}'.\`,
        };
      }
      output = checked.value;
    }
    // AUTHOR-OWNED EFFECT HOOK (the one declared extension seam): persist
    // the governed run's validated output through the data adapter. A
    // failing effect is fail-closed (the action reports ACTION_FAILED).
    const effect = capabilityEffects.find((candidate) => candidate.actionId === action.id);
    if (effect !== undefined) {
      await effect.run(output, data);
    }
    return { ok: true, value: output };
  }

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
    }
    try {
      if (action.kind === 'query') {
        return await dispatchQuery(action, input);
      }
      if (action.kind === 'mutation') {
        return await dispatchMutation(action, input);
      }
      if (action.kind === 'capability') {
        return await dispatchCapability(action, input);
      }
      // navigation / local: renderer-side; neither reaches this boundary.
      return {
        ok: false,
        code: 'UNSUPPORTED_ACTION',
        message: \`Actions of kind '\${action.kind}' do not cross the server boundary.\`,
      };
    } catch {
      return {
        ok: false,
        code: 'ACTION_FAILED',
        message: 'The action could not be completed; this safe failure is server-generated.',
      };
    }
  }

  /**
   * Plan-driven view loading for ANY route: every declared view of the
   * resolved screen is read with its declared filters/sort/projection;
   * parameterized routes get their declared record through the same port.
   */
  async function loadRoute(path: string): Promise<{
    readonly plan: Record<string, unknown>;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null> {
    const planView = plan.toJSON() as unknown as VictPlanView;
    const resolved = resolveRoute(planView, path);
    if (resolved === null || resolved.screen === null) {
      return null;
    }
    const viewIds = new Set<string>();
    for (const { surface } of collectSurfaces(resolved.screen)) {
      const viewId = (surface as { viewId?: unknown }).viewId;
      if (typeof viewId === 'string') {
        viewIds.add(viewId);
      }
    }
    interface LoadedView {
      readonly resourceId: string;
      readonly fields?: readonly string[];
      readonly filters?: Readonly<Record<string, string | number | boolean>>;
      readonly sort?: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[];
    }
    const views = plan.toJSON().views as Record<string, LoadedView | undefined>;
    const viewData: Record<string, ViewDatum> = {};
    let record: Record<string, unknown> | null = null;
    for (const viewId of viewIds) {
      const view = views[viewId];
      if (view === undefined) {
        continue;
      }
      const result = await data.query(
        {
          op: 'list',
          resourceId: view.resourceId,
          ...(view.filters !== undefined ? { filters: view.filters } : {}),
          ...(view.sort !== undefined && view.sort.length > 0 ? { sort: view.sort } : {}),
          ...(Array.isArray(view.fields) && view.fields.length > 0
            ? { projection: view.fields }
            : {}),
        },
        { permissions: grants, effect: 'read' },
      );
      if (!result.ok) {
        continue;
      }
      viewData[viewId] = {
        rows: (result.rows ?? []) as Record<string, unknown>[],
        total: result.total ?? (result.rows?.length ?? 0),
      };
      const identity = resolved.params.id;
      if (identity !== undefined && record === null) {
        const got = await data.query(
          { op: 'get', resourceId: view.resourceId, id: identity },
          { permissions: grants, effect: 'read' },
        );
        if (got.ok && got.row !== undefined) {
          record = got.row as Record<string, unknown>;
          viewData[viewId] = { ...viewData[viewId], record };
        }
      }
    }
    return { plan: planView, viewData, record };
  }

  return {
    plan,
    data,
    dispatch,
    loadRoute,
    close(): void {
      (data as { close?: () => void }).close?.();
    },
  };
}

let serverPromise: Promise<AppServer> | undefined;

/** Awaitable app singleton: generated host routes await this promise. */
export function getAppServer(): Promise<AppServer> {
  if (serverPromise === undefined) {
    serverPromise = createAppServer();
  }
  return serverPromise;
}
`,
    ],
    [
      'src/routes/[...vict]/+page.server.ts',
      `import { error } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { PageServerLoad } from './$types';

// GENERIC HOST LOAD — scaffolder-owned, domain-free.
//
// The ONLY page server load of the application: awaits the (asynchronous)
// application factory and delegates to the plan-driven loadRoute, which
// resolves ANY declared route (including :name parameters), loads EVERY
// declared view of the resolved screen with its declared filters/sort/
// projection, and fetches declared records for parameterized routes.
// Unknown paths produce a structured 404 — never a silent fallback. This
// file contains no domain facts and never needs editing per application.
export const load: PageServerLoad = async ({ url }) => {
  const app = await getAppServer();
  const loaded = await app.loadRoute(url.pathname === '' ? '/' : url.pathname);
  if (loaded === null) {
    throw error(404, 'No application route is declared for this path.');
  }
  return loaded;
};
`,
    ],
    [
      'src/routes/[...vict]/+page.svelte',
      `<script lang="ts">
  // The GENERIC application host page: the only page shell this application
  // will ever need. Everything visible is rendered from the neutral plan.
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { VitApp, type ActionResult } from '@victframework/renderer-svelte';
  import '@victframework/renderer-svelte/theme.css';
  import { createComponentRegistry } from '@victframework/application/renderer';
  import { registerComponents } from '$lib/components/registry';

  let { data }: { data: { plan: Record<string, unknown>; viewData: Record<string, unknown> } } =
    $props();

  const registry = createComponentRegistry('registry.app', '1');
  registerComponents(registry);

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const response = await fetch('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, input }),
    });
    return (await response.json()) as ActionResult;
  }
</script>

<svelte:head><title>${appName}</title></svelte:head>

<VitApp
  plan={data.plan as never}
  {registry}
  {dispatch}
  path={page.url.pathname}
  viewData={data.viewData}
  onInvalidate={() => void invalidateAll()}
/>
`,
    ],
    [
      'src/routes/api/act/+server.ts',
      `import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { RequestHandler } from './$types';

// GENERIC ACTION BOUNDARY — scaffolder-owned, domain-free.
//
// The ONLY action boundary of the application. Every non-local action
// crosses the server-side authorization/contract/effect boundary here;
// local and navigation actions never reach this endpoint at all. The
// (asynchronous) application is awaited; declared input contracts are
// pre-validated inside the dispatcher BEFORE any governed run or durable
// mutation. This file contains no domain facts and never needs editing.
export const POST: RequestHandler = async ({ request }) => {
  const app = await getAppServer();
  let body: { actionId?: unknown; input?: unknown };
  try {
    body = (await request.json()) as { actionId?: unknown; input?: unknown };
  } catch {
    return json({ ok: false, code: 'INVALID_REQUEST', message: 'The request body must be JSON.' }, { status: 400 });
  }
  if (typeof body.actionId !== 'string' || body.actionId.length === 0) {
    return json({ ok: false, code: 'INVALID_REQUEST', message: 'actionId is required.' }, { status: 400 });
  }
  const result = await app.dispatch(body.actionId, body.input);
  return json(result);
};
`,
    ],
    [
      '.gitignore',
      `node_modules/
build/
.svelte-kit/
.data/
*.db
*.db-wal
*.db-shm
`,
    ],
    [
      'README.md',
      `# ${appName}

A Vict application: one neutral Application Definition plus explicit
runtime, data, renderer, and component bindings, rendered by the generic
Vict host.

## File ownership (exact)

### IMMUTABLE HOST FILES — scaffolder-owned; never edited by app authors

Editing any of these leaves the scaffolder's one-time, no-edit host
contract; every domain change should be possible without touching them.

| File | Role |
| --- | --- |
| \`package.json\` | Generated from the EXPLICIT release set selected at scaffold time (\`platformDependencies\`); never contains placeholder versions. |
| \`.gitignore\` | Build/data-artifact ignores. |
| \`svelte.config.js\`, \`tsconfig.json\`, \`vite.config.ts\`, \`vitest.config.ts\` | Toolchain configuration. |
| \`src/app.html\`, \`src/app.d.ts\` | App shell + ambient types. |
| \`src/routes/[...vict]/+page.svelte\` | The generic host page (plan + registry + dispatch). |
| \`src/routes/[...vict]/+page.server.ts\` | Generic plan-driven load: awaits the async app, resolves any route/parameters, loads declared views. |
| \`src/routes/api/act/+server.ts\` | The one governed action boundary: awaits the async app, validates the request shape, dispatches. |
| \`src/lib/server/application-server.ts\` | Generic domain-free application server: contract pre-validation, query/mutation dispatch, governed capability runs, plan-driven view loading. |
| \`README.md\`, \`src/lib/components/README.md\` | This ownership documentation. |

### AUTHOR-OWNED — your application code (never regenerated)

| File | Role |
| --- | --- |
| \`src/lib/application/definition.ts\` | YOUR domain: application definition, resources, contracts, capabilities, grants, and the plan compiler. |
| \`src/lib/components/registry.ts\` | Versioned registration of your custom Svelte components. |
| \`src/lib/components/*\` | Your code islands (presentational; declared props only). |

The host renders whatever the definition declares — changing the domain
means changing \`definition.ts\` (and adding islands), never editing host
files. The scaffolder is one-time and non-destructive: it never rewrites
any file it created, and it refuses conflicts instead of overwriting.

## Platform dependencies

\`package.json\` pins the EXACT platform release set passed to the
scaffolder (\`platformDependencies\`). The generated host imports at least:
\`@victframework/application\`, \`@victframework/appdata-sqlite\`,
\`@victframework/renderer-svelte\`, \`@victframework/runtime\`,
\`@victframework/sdk\`, \`@victframework/store-sqlite\`.

## Commands

- \`npm run dev\` — start the development server.
- \`npm run build\` && \`npm run preview\` — production build and preview.
`,
    ],
  ] as const;
  void targetDir;
  return L.map(([path, content]) => [path, content] as const);
}
