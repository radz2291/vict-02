import { describe, expect, it } from 'vitest';
import {
  validateAudit,
  validateCatalog,
  validateContextPack,
  validateDocument,
  validateHandoff,
  validateProfile,
  validateResult,
  validateTaskPack,
  validateTools,
} from '../src/validate/index.js';

/** Schema rejection tests (handoff Tests #3): closed vocabulary, non-echoing diagnostics. */

const sha = (seed: string): string => `${seed}`.padEnd(64, '0').slice(0, 64);

const validContextPack = {
  schemaMarker: 'vict.builder.context-pack@1',
  packId: sha('a'),
  generatedFrom: {
    referenceVersion: '9.9.9',
    releaseSetId: 'vict-release-set@1/0.0.1',
    workspaceIdentity: { name: 'vict-fixture', version: '0.0.1', workspaces: ['packs/*'] },
    inputs: [{ path: 'docs/VICT-SYSTEM-REFERENCE.md', contentSha256: sha('b') }],
  },
  constitution: [{ sourcePath: 'r.md', anchor: '§2', contentSha256: sha('c'), excerpt: 'text' }],
  repositoryMap: [
    {
      name: '@victframework/fx-pack',
      version: '1.0.0',
      main: './src/index.ts',
      types: './src/index.ts',
      private: true,
      internalDependencies: [],
      externalDependencies: [],
    },
  ],
  verifiedBaseline: {
    sourcePath: 'r.md',
    anchor: '### 24.1',
    contentSha256: sha('d'),
    extract: '- x',
  },
  toolManifestRef: {
    schemaMarker: 'vict.builder.tools@1',
    sourcePath: 't.json',
    contentSha256: sha('e'),
  },
  permissionProfilesRef: {
    schemaMarker: 'vict.builder.profile@1',
    sourcePath: 'p.json',
    contentSha256: sha('f'),
  },
  verificationCommands: ['npm test'],
  stopConditions: ['stop'],
};

const validCatalog = {
  schemaMarker: 'vict.builder.catalog@1',
  generatedFrom: {
    sourceModules: [
      {
        package: '@victframework/fx-pack',
        module: 'packs/fx-pack/src/index.ts',
        contentSha256: sha('1'),
      },
    ],
  },
  packs: [
    {
      id: 'vict.fixture.fx',
      version: '1.0.0',
      victCompatibility: '^0.1.0',
      documentation: { summary: 'Fixture pack.' },
      contracts: [{ id: 'fx.entry', revision: '1' }],
      permissions: [],
      configuration: [],
      secrets: [],
      doubles: [{ capabilityId: 'fx.write', revision: '1', modes: ['test'] }],
      evaluations: [{ id: 'eval.1', capabilityId: 'fx.write', description: 'd' }],
      provenance: { author: 'fixture', license: 'MIT' },
      capabilities: [
        {
          id: 'fx.read',
          revision: '1',
          effect: 'read',
          input: { contractId: 'fx.entry', revision: '1' },
          output: null,
          summary: null,
          module: 'packs/fx-pack/src/index.ts',
          contentSha256: sha('1'),
        },
        {
          id: 'fx.write',
          revision: '1',
          effect: 'write',
          input: { contractId: 'fx.entry', revision: '1' },
          output: { contractId: 'fx.out', revision: '1' },
          summary: null,
          idempotency: 'keyed',
          permissions: ['fx.write'],
          secrets: ['fx.apiKey'],
          ambiguity: 'keyedRetry',
          module: 'packs/fx-pack/src/index.ts',
          contentSha256: sha('1'),
        },
      ],
    },
  ],
};

const validTaskPack = {
  schemaMarker: 'vict.builder.task-pack@1',
  packId: sha('2'),
  basePackId: sha('3'),
  basePackPath: 'docs/builder-kit/context-pack.json',
  handoff: { path: 'docs/handoff.md', sha256: sha('4') },
  baseTree: '1234567890123456789012345678901234567890',
  inScopePaths: ['docs/builder-kit/**'],
  ignoreManifest: ['*.tmp'],
  ignoreManifestDigest: sha('5'),
  permissionProfile: 'builder.change',
};

describe('schema validators', () => {
  it('accept the shipped tool manifest and profiles', () => {
    const tools = JSON.parse(
      String(
        JSON.stringify({
          schemaMarker: 'vict.builder.tools@1',
          tools: [{ name: 'fs.read', summary: 's', input: ['path'], enforcement: 'read-only' }],
          absent: [{ name: 'git.push', reason: 'owner pushes' }],
        }),
      ),
    );
    expect(validateTools(tools).ok).toBe(true);
    const profile = {
      schemaMarker: 'vict.builder.profile@1',
      name: 'builder.change',
      read: ['repository'],
      write: ['in-scope paths'],
      scripts: ['test'],
      control: ['control.propose'],
      denials: ['publish'],
      stopOnDenial: ['publish'],
    };
    expect(validateProfile(profile).ok).toBe(true);
    expect(validateProfile({ ...profile, name: 'builder.superuser' }).ok).toBe(false);
  });

  it('accept valid documents for every schema family', () => {
    expect(validateContextPack(validContextPack).ok).toBe(true);
    expect(validateCatalog(validCatalog).ok).toBe(true);
    expect(validateTaskPack(validTaskPack).ok).toBe(true);
    expect(
      validateHandoff({
        schemaMarker: 'vict.builder.handoff@1',
        objective: 'Do the bounded thing.',
        requirementIds: ['BLD-001'],
        baseTree: '1234567890123456789012345678901234567890',
        inScopePaths: ['packs/**'],
        ignoreManifest: [],
        outOfScopeStopList: ['Quellight'],
        requiredCommands: ['npm test'],
        negativeControls: ['stale catalog'],
        profile: 'builder.change',
        stopConditions: ['conflict with reference'],
        deliverables: ['result document'],
        exitGate: 'G1',
      }).ok,
    ).toBe(true);
    expect(
      validateResult({
        schemaMarker: 'vict.builder.result@1',
        session: {
          host: 'fixture-host',
          startedAt: '2026-09-24T00:00:00Z',
          endedAt: '2026-09-24T01:00:00Z',
        },
        commits: [{ sha: '1234567890123456789012345678901234567890', message: 'work' }],
        commands: [{ command: 'npm test', exitCode: 0, observed: '52 passed' }],
        observedCounts: [{ name: 'tests', value: 52, source: 'npm test output' }],
        filesChanged: ['packs/fx-pack/src/index.ts'],
        requirementClaims: [
          { id: 'BLD-001', classification: 'implemented', evidence: ['npm test'] },
        ],
        deviations: [],
        knownDebt: [],
        stopPoint: 'G1',
      }).ok,
    ).toBe(true);
    expect(
      validateAudit({
        schemaMarker: 'vict.builder.audit@1',
        auditor: 'independent auditor',
        reDerived: ['full ladder'],
        findings: [{ id: 'F-1', classification: 'corrective', description: 'minor' }],
        disposition: 'PASS WITH ISSUES',
        evidenceCommits: ['1234567890123456789012345678901234567890'],
      }).ok,
    ).toBe(true);
  });

  it('reject unknown fields (closed vocabulary)', () => {
    for (const [validator, base] of [
      [validateContextPack, validContextPack],
      [validateCatalog, validCatalog],
      [validateTaskPack, validTaskPack],
    ] as const) {
      const tampered: Record<string, unknown> = {
        ...(base as Record<string, unknown>),
        inventedField: true,
      };
      const result = validator(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
      }
    }
  });

  it('reject invented capability summaries (no description exists in the manifest vocabulary)', () => {
    const tampered = structuredClone(validCatalog) as typeof validCatalog;
    (tampered.packs[0]?.capabilities?.[0] as Record<string, unknown>)['summary'] = 'made up';
    const result = validateCatalog(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVENTED_SUMMARY')).toBe(true);
    }
  });

  it('reject result documents without integer exit codes', () => {
    const result = validateResult({
      schemaMarker: 'vict.builder.result@1',
      session: { host: 'h', startedAt: '2026-09-24T00:00:00Z', endedAt: '2026-09-24T01:00:00Z' },
      commits: [],
      commands: [{ command: 'npm test', exitCode: 'green', observed: 'x' }],
      observedCounts: [],
      filesChanged: [],
      requirementClaims: [],
      deviations: [],
      knownDebt: [],
      stopPoint: 'G1',
    });
    expect(result.ok).toBe(false);
  });

  it('reject invalid audit dispositions', () => {
    const result = validateAudit({
      schemaMarker: 'vict.builder.audit@1',
      auditor: 'a',
      reDerived: [],
      findings: [],
      disposition: 'PROBABLY FINE',
      evidenceCommits: [],
    });
    expect(result.ok).toBe(false);
  });

  it('produce non-echoing diagnostics', () => {
    const tampered: Record<string, unknown> = {
      ...validContextPack,
      generatedFrom: {
        ...validContextPack.generatedFrom,
        inputs: [{ path: 'docs/SECRET_VALUE_hunter2.md', contentSha256: 'nothex' }],
      },
    };
    const result = validateContextPack(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues) {
        expect(issue.message).not.toContain('hunter2');
      }
    }
  });

  it('fail closed on unknown schema markers', () => {
    const result = validateDocument({ schemaMarker: 'vict.builder.unknown@9' });
    expect(result.ok).toBe(false);
  });
});
