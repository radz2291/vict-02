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

  const files = templates(targetDir, options.appName, packageName);

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
): readonly (readonly [string, string])[] {
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
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
        dependencies: {
          '@vict/application': '0.1.0',
          '@vict/appdata-sqlite': '0.1.0',
          '@vict/renderer-svelte': '0.1.0',
          '@vict/runtime': '0.1.0',
          '@vict/sdk': '0.1.0',
        },
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
} from '@vict/sdk';
import { compileApplication } from '@vict/application';
import type { ApplicationPlan } from '@vict/application';

/**
 * YOUR APPLICATION DEFINITION — author-owned.
 *
 * This neutral, framework-neutral definition is the source of truth for the
 * whole application surface. The generic host renders whatever it declares;
 * edit this file and the running application changes with it. No route or
 * page shells are ever generated.
 *
 * Custom Svelte components are code islands: create them under
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

export const bindings = {
  contracts: [],
  capabilities: [],
  components: [],
} as const;

/** Compile the neutral definition into the immutable plan. */
export function compileAppPlan(): ApplicationPlan {
  const result = compileApplication({
    application,
    resources: [itemResource],
    contracts: bindings.contracts,
    capabilities: bindings.capabilities,
    components: bindings.components,
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
      `import type { ComponentRegistry } from '@vict/application/renderer';

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
import { createSqliteApplicationData } from '@vict/appdata-sqlite';
import { createRuntime } from '@vict/runtime';
import type { ApplicationDataAdapter, ActionResult } from '@vict/application';
import { compileAppPlan, itemResource } from '$lib/application/definition';

/**
 * YOUR APPLICATION SERVER — author-owned.
 *
 * The in-process application server: every non-local action crosses the
 * explicit boundaries BELOW the UI (authorization, contract validation,
 * effect policy, durable storage). The UI cannot grant itself anything.
 */

const DB_PATH = process.env.VICT_APPDATA_PATH ?? join('.data', 'appdata.sqlite');

/** The authorization profile of this deployment (server-side only). */
const grants = ['items.write', 'items.read'];

export function createAppServer() {
  const plan = compileAppPlan();
  const runtime = createRuntime();
  const data: ApplicationDataAdapter = createSqliteApplicationData({
    path: DB_PATH,
    resources: [itemResource],
  });

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
    }
    try {
      if (action.kind === 'query') {
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
        return { ok: result.ok, code: result.ok ? undefined : result.code, message: result.ok ? undefined : result.message, value: result.ok ? result : undefined };
      }
      if (action.kind === 'mutation') {
        const payload = (input ?? {}) as { id?: string; [key: string]: unknown };
        const identity = typeof payload.id === 'string' ? payload.id : typeof payload.__identity === 'string' ? payload.__identity : undefined;
        const result = await data.mutate(
          {
            resourceId: action.resourceId,
            op: action.op,
            input: payload,
            ...(identity !== undefined ? { id: identity } : {}),
            idempotencyKey: action.op === 'create' && typeof payload.id === 'string' ? \`create:\${payload.id}\` : undefined,
          },
          { permissions: grants, effect: 'write' },
        );
        return { ok: result.ok, code: result.ok ? undefined : result.code, message: result.ok ? undefined : result.message, value: result.ok ? result.row : undefined };
      }
      // capability actions: wire to runtime.activate(...) / runtime.run(...)
      // following the @vict/runtime public API when your application adds
      // durable Vict-governed behavior.
      void runtime;
      return { ok: false, code: 'UNSUPPORTED_ACTION', message: 'This action kind is not wired in this starter.' };
    } catch {
      return {
        ok: false,
        code: 'ACTION_FAILED',
        message: 'The action could not be completed; this safe failure is server-generated.',
      };
    }
  }

  function loadRoute(path: string) {
    const route = plan.routes.find((entry) => entry.route.path === path);
    if (route === undefined) {
      return null;
    }
    return route;
  }

  return {
    plan,
    data,
    dispatch,
    loadRoute,
    async close(): Promise<void> {
      (data as { close?: () => void }).close?.();
    },
  };
}

let server: ReturnType<typeof createAppServer> | undefined;

export function getAppServer() {
  if (server === undefined) {
    server = createAppServer();
  }
  return server;
}
`,
    ],
    [
      'src/routes/[...vict]/+page.server.ts',
      `import { error } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { PageServerLoad } from './$types';

// The ONLY page server load of the application: resolves the route from the
// neutral plan and reads declared view data through the application-data
// port. Unknown paths produce a structured 404 — never a silent fallback.
export const load: PageServerLoad = async ({ url }) => {
  const app = getAppServer();
  const path = url.pathname === '' ? '/' : url.pathname;
  const route = app.loadRoute(path);
  if (route === undefined || route === null) {
    throw error(404, 'No application route is declared for this path.');
  }
  const viewData: Record<string, unknown> = {};
  const read = await app.data.query(
    { op: 'list', resourceId: 'items', sort: [{ field: 'title', direction: 'asc' }] },
    { permissions: ['items.read'], effect: 'read' },
  );
  if (read.ok) {
    viewData['v.items'] = { rows: read.rows ?? [], total: read.total ?? 0 };
  }
  return {
    plan: app.plan.toJSON(),
    viewData,
  };
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
  import { VitApp, type ActionResult } from '@vict/renderer-svelte';
  import '@vict/renderer-svelte/theme.css';
  import { createComponentRegistry } from '@vict/application/renderer';
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

// The ONLY action boundary of the application. Every non-local action
// crosses the server-side authorization/effect boundary here; local actions
// never reach this endpoint at all.
export const POST: RequestHandler = async ({ request }) => {
  const app = getAppServer();
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

## Ownership

- \`src/lib/application/definition.ts\` — YOUR application definition (author-owned).
- \`src/lib/components/\` — YOUR code islands (author-owned; never regenerated).
- \`src/lib/server/application-server.ts\` — YOUR application server (author-owned).
- Everything else is the generic Vict host: the scaffolder owns its initial
  form; Vict renders your definition dynamically and never regenerates code.

## Commands

- \`npm run dev\` — start the development server.
- \`npm run build\` && \`npm run preview\` — production build and preview.
`,
    ],
  ] as const;
  void targetDir;
  return L.map(([path, content]) => [path, content] as const);
}
