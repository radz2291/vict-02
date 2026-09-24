import { execFileSync } from 'node:child_process';
import { generateStableLayer } from '../../src/generate/generate.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Deterministic miniature-repository fixture for gate/negative-control
 * tests: minimal recorded inputs, one fixture capability pack, kit data
 * files, and (optionally) git history for baseline-comparison controls.
 */

const KIT_PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let tempRootCounter = 0;

export const FIXTURE_REFERENCE = `# VICT System Reference (fixture)

> **Document version:** 9.9.9<br>

## 2. Design principles

1. **Fixtures are bounded.** Fixture principle one.
2. **Determinism matters.** Fixture principle two.

| ID       | Requirement | Maturity  | Delivery |
| -------- | ----------- | --------- | -------- |
| FX-001   | Fixture row. | Invariant | Planned  |

### 21.1 Security controls

- fixture control one;
- fixture control two.

### 21.2 Trust facts

- A fixture trust fact.

| ID      | Requirement | Maturity  | Delivery |
| ------- | ----------- | --------- | -------- |
| SEC-001 | Fixture security row. | Invariant | Verified |

### 24.1 Verified baseline

- Fixture baseline bullet one.
- Fixture baseline bullet two (final).
`;

export const FIXTURE_RELEASE = `# Fixture release compatibility

\`\`\`json
{
  "vict-release-set": {
    "identity": "vict-release-set@1/0.0.1",
    "version": "0.0.1"
  }
}
\`\`\`
`;

export const FIXTURE_PACK_STUB = `let invocationCount = 0;

export function markInvocation(): void {
  invocationCount += 1;
}

export function invocationCountValue(): number {
  return invocationCount;
}

export function defineCapabilityPack(
  manifest: unknown,
  bindings: unknown,
): { manifest: unknown; bindings: unknown } {
  return { manifest, bindings };
}
`;

export const FIXTURE_PACK_SOURCE = `import { defineCapabilityPack, markInvocation, invocationCountValue } from './stub.js';

export const fxPack = defineCapabilityPack(
  {
    schema: 'vict.capability-pack@1',
    id: 'vict.fixture.fx',
    version: '1.0.0',
    victCompatibility: '^0.1.0',
    capabilities: [
      {
        id: 'fx.read',
        revision: '1',
        effect: 'read',
        input: { contractId: 'fx.entry', revision: '1' },
        output: { contractId: 'fx.out', revision: '1' },
      },
    ],
    contracts: [
      { id: 'fx.entry', revision: '1' },
      { id: 'fx.out', revision: '1' },
    ],
    documentation: { summary: 'Fixture pack.' },
  },
  {
    capabilities: [
      {
        id: 'fx.read',
        revision: '1',
        invoke: (input: unknown) => {
          markInvocation();
          return input;
        },
      },
    ],
  },
);

export { invocationCountValue };
`;

/** Fixture pack source whose capability entry is computed (unresolvable statically). */
export const FIXTURE_PACK_SOURCE_DYNAMIC = FIXTURE_PACK_SOURCE.replace(
  "id: 'fx.read',",
  "id: `fx.${'read'}`,",
);

/** Fixture pack source with a SECOND capability (catalog lag negative). */
export const FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY = `import { defineCapabilityPack, markInvocation } from './stub.js';

export const fxPack = defineCapabilityPack(
  {
    schema: 'vict.capability-pack@1',
    id: 'vict.fixture.fx',
    version: '1.0.0',
    victCompatibility: '^0.1.0',
    capabilities: [
      {
        id: 'fx.read',
        revision: '1',
        effect: 'read',
        input: { contractId: 'fx.entry', revision: '1' },
        output: { contractId: 'fx.out', revision: '1' },
      },
      {
        id: 'fx.write',
        revision: '1',
        effect: 'write',
        input: { contractId: 'fx.entry', revision: '1' },
        output: { contractId: 'fx.out', revision: '1' },
      },
    ],
    contracts: [
      { id: 'fx.entry', revision: '1' },
      { id: 'fx.out', revision: '1' },
    ],
    documentation: { summary: 'Fixture pack.' },
  },
  {
    capabilities: [
      {
        id: 'fx.read',
        revision: '1',
        invoke: (input: unknown) => {
          markInvocation();
          return input;
        },
      },
    ],
  },
);
`;

function write(relPath: string, content: string, root: string): void {
  const absolute = join(root, relPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

export interface FixtureOptions {
  readonly packSource?: string;
  readonly git?: boolean;
}

/** Create the fixture repository; returns its root path. */
export function buildFixture(options: FixtureOptions = {}): string {
  const root = join(
    tmpdir(),
    `vict-fixture-${Date.now().toString(36)}-${(tempRootCounter += 1).toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
  );
  mkdirSync(root, { recursive: true });

  write(
    'package.json',
    JSON.stringify({ name: 'vict-fixture', version: '0.0.1', workspaces: ['packs/*'] }, null, 2) +
      '\n',
    root,
  );
  write('docs/VICT-SYSTEM-REFERENCE.md', FIXTURE_REFERENCE, root);
  write('docs/RELEASE-COMPATIBILITY.md', FIXTURE_RELEASE, root);
  write('docs/TASK.md', '# Fixture handoff\n\nTask authority for the fixture task pack.\n', root);
  write(
    'packs/fx-pack/package.json',
    JSON.stringify(
      { name: '@victframework/fx-pack', version: '1.0.0', type: 'module', main: './src/index.ts' },
      null,
      2,
    ) + '\n',
    root,
  );
  write('packs/fx-pack/src/stub.ts', FIXTURE_PACK_STUB, root);
  write('packs/fx-pack/src/index.ts', options.packSource ?? FIXTURE_PACK_SOURCE, root);
  write('README-fixture.md', '# fixture readme\n', root);

  // The base pack references the kit data files by path; copy the kit data
  // AND the kit manifest (the kit version participates in the bootstrap
  // rendering) into the fixture.
  write(
    'packages/builder-kit/package.json',
    readFileSync(join(KIT_PACKAGE_DIR, 'package.json'), 'utf8'),
    root,
  );
  for (const name of ['tools.json', 'profiles.json']) {
    write(
      `packages/builder-kit/data/${name}`,
      readFileSync(join(KIT_PACKAGE_DIR, 'data', name), 'utf8'),
      root,
    );
  }

  write('.gitignore', 'node_modules/\n.builder-kit/\n', root);
  generateStableLayer(root);

  if (options.git === true) {
    const run = (args: readonly string[]): void => {
      execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
    };
    run(['init']);
    run(['config', 'user.email', 'fixture@example.invalid']);
    run(['config', 'user.name', 'fixture']);
    run(['add', '-A']);
    run(['commit', '-m', 'fixture baseline']);
  }
  return root;
}

/** Read a file from the fixture as text. */
export function readFixture(root: string, relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

/** Extract the stable drift class from a failed gate check id prefix. */
export function failures(report: {
  readonly checks: readonly {
    readonly ok: boolean;
    readonly driftClass: string | null;
    readonly id: string;
  }[];
}): readonly { readonly id: string; readonly driftClass: string | null }[] {
  return report.checks
    .filter((check) => !check.ok)
    .map(({ id, driftClass }) => ({ id, driftClass }));
}
