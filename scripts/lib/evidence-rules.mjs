/**
 * VICT-M-1 candidate evidence-recovery rules (read-only evidence chain).
 *
 * Pure rule functions + the BOUND candidate identity for the owner-authorized
 * evidence recovery of Blocking finding B-1
 * (`docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`).
 *
 * The recovery is bounded to EXACTLY one immutable candidate set. Every rule
 * below fails closed: each returns a problems[] list; ANY entry fails the run.
 * Nothing here can authorize publication or any registry mutation — the
 * functions only EVALUATE observed state.
 */

import { createHash } from 'node:crypto';

/**
 * The BOUND identity of this recovery (amendment §4). The evidence engine
 * refuses any input that differs from these constants — the recovery cannot
 * be pointed at any other version, source, run, or registry.
 */
export const BOUND_CANDIDATE = Object.freeze({
  version: '0.3.0-rc.1',
  sourceSha: 'a98dd015a3cb6f8e210447dcc89f5cdefab02ec9',
  originalRunId: 35530894104,
  originalRunUrl: 'https://github.com/radz2291/vict-02/actions/runs/35530894104',
  originalWorkflowPath: '.github/workflows/release.yml',
  originalRunConclusion: 'failure',
  packageCount: 13,
  registry: 'https://registry.npmjs.org/',
  repository: 'radz2291/vict-02',
  repositoryUrl: 'https://github.com/radz2291/vict-02',
  releaseSetIdentity: 'vict-release-set@1/0.3.0-rc.1',
  expectedContentId: 'v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4',
  correctedEngineSha: '8844f54e0a6d59f1d81f241eb7ce32d3bad21e8c',
  candidateTag: 'vict-0.3.0-rc',
  expectedLatest: '0.2.0',
  forbiddenStableVersion: '0.3.0',
  provenanceRef: 'refs/heads/main',
  provenanceBuilderId: 'https://github.com/actions/runner/github-hosted',
  amendment: 'docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md',
  evidenceSchema: 'vict-m1-evidence-recovery@1',
});

/** The evidence workflow file this recovery is implemented by. */
export const EVIDENCE_WORKFLOW_PATH = '.github/workflows/release-evidence.yml';

/** The ONLY release-engine subcommands the evidence path may ever invoke. */
export const ALLOWED_ENGINE_SUBCOMMANDS = Object.freeze(['pack', 'verify-registry']);

/** npm invocations that must NEVER appear in the evidence workflow. */
const FORBIDDEN_NPM_COMMAND_PATTERNS = [
  /\bnpm\s+(?:--?[^\s]+\s+)*publish\b/,
  /\bnpm\s+(?:--?[^\s]+\s+)*dist-tag\b/,
  /\bnpm\s+(?:--?[^\s]+\s+)*deprecate\b/,
  /\bnpm\s+(?:--?[^\s]+\s+)*unpublish\b/,
  /\bnpm\s+(?:--?[^\s]+\s+)*trust\b/,
  /\bnpm\s+(?:--?[^\s]+\s+)*login\b/,
  /\bnpm\s+(?:--?[^\s]+\s+)*whoami\b/,
  /npm run (?:publish:release|release:trust-bootstrap|release:validate)\b/,
  /scripts[\\/](?:publish-release|trust-bootstrap)\.mjs/,
  /oidc-release\.mjs\s+(?:publish|validate|trust)\b/,
];

/** Material that must NEVER appear in the evidence workflow. */
const FORBIDDEN_WORKFLOW_MATERIAL = [
  { pattern: /id-token/i, why: 'OIDC write authority' },
  { pattern: /\$\{\{\s*secrets\./, why: 'secret reference' },
  { pattern: /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken/, why: 'npm credential material' },
  { pattern: /^(\s{2,})permissions:\s*$/m, why: 'job-level permissions override' },
  { pattern: /^\s*environment:\s*$/m, why: 'deployment environment' },
];

/** Trigger keys other than workflow_dispatch are refused. */
const FORBIDDEN_TRIGGER_PATTERN =
  /^ {2}(push|pull_request|pull_request_target|schedule|release|workflow_call|repository_dispatch):/m;

/**
 * Static security audit of the evidence workflow (amendment §3.2/§7).
 * The workflow is dependency-audited WITHOUT js-yaml so the in-workflow
 * guard runs before any install; the unit tests deep-parse the same file.
 * Dependency-free and fail-closed: any problem refuses the workflow.
 *
 * @param {string} raw workflow YAML text
 * @returns {{ok: boolean, problems: string[], checks: string[]}}
 */
export function auditEvidenceWorkflow(raw) {
  const problems = [];
  const checks = [];

  // 1. Forbidden npm commands and engine subcommands; the ONLY permitted
  //    release-engine subcommands are the non-mutating pack/verify-registry.
  for (const pattern of FORBIDDEN_NPM_COMMAND_PATTERNS) {
    const match = pattern.exec(raw);
    if (match !== null) {
      problems.push(
        `forbidden publishing/registry-mutating command present: /${pattern.source}/ (near '${raw.slice(Math.max(0, match.index - 20), match.index + 40).replace(/\n/g, ' ')}…')`,
      );
    }
  }
  for (const match of raw.matchAll(/oidc-release\.mjs\s+([\w-]+)/g)) {
    if (!ALLOWED_ENGINE_SUBCOMMANDS.includes(match[1])) {
      problems.push(
        `release-engine subcommand '${match[1]}' is not permitted on the evidence path (allowed: ${ALLOWED_ENGINE_SUBCOMMANDS.join(', ')})`,
      );
    }
  }
  checks.push('no forbidden npm command or engine subcommand (allow-list: pack, verify-registry)');

  // 2. No OIDC write authority, secrets, credentials, environments,
  //    or job-level permission overrides.
  for (const { pattern, why } of FORBIDDEN_WORKFLOW_MATERIAL) {
    if (pattern.test(raw)) {
      problems.push(`forbidden workflow material (${why}): /${pattern.source}/`);
    }
  }
  checks.push('no id-token write, secrets, npm credentials, environments, or permission overrides');

  // 3. EXACT top-level permissions block.
  const permissionsMatch = raw.match(/^permissions:\n((?: {2}[\w-]+: [^\n]+\n)+)/m);
  if (permissionsMatch === null) {
    problems.push("no top-level 'permissions:' block with two-space entries found");
  } else {
    const entries = permissionsMatch[1]
      .trim()
      .split('\n')
      .map((line) => line.trim());
    if (entries.length !== 1 || entries[0] !== 'contents: read') {
      problems.push(`permissions must be exactly [contents: read] (got [${entries.join(', ')}])`);
    }
  }
  checks.push('permissions are exactly contents: read');

  // 4. Manual dispatch trigger ONLY.
  if (!/^on:\n {2}workflow_dispatch:\n/m.test(raw)) {
    problems.push("no 'on: workflow_dispatch:' trigger block found");
  }
  const triggerMatch = FORBIDDEN_TRIGGER_PATTERN.exec(raw);
  if (triggerMatch !== null) {
    problems.push(`forbidden non-dispatch trigger '${triggerMatch[1]}'`);
  }
  checks.push('workflow_dispatch is the only trigger');

  // 5. No shell interpolation anywhere in run blocks (inputs pass as env).
  const lines = raw.split(/\r?\n/);
  let inRunBlock = false;
  let runIndent = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const runMatch = line.match(/^(\s*)run:\s*(.*)$/);
    if (runMatch !== null) {
      const inline = runMatch[2];
      if (inline.includes('${{')) {
        problems.push(`interpolation in inline run command (line ${index + 1})`);
      }
      if (/[|>][-+]?\s*$/.test(inline)) {
        inRunBlock = true;
        runIndent = runMatch[1].length;
      } else {
        inRunBlock = false;
      }
      continue;
    }
    if (inRunBlock) {
      const indent = line.match(/^(\s*)/)[1].length;
      if (line.trim().length > 0 && indent <= runIndent) {
        inRunBlock = false;
      } else if (line.includes('${{')) {
        problems.push(`interpolation in run block (line ${index + 1})`);
      }
    }
  }
  checks.push('no interpolation in any run block (inputs pass as environment variables)');

  // 6. Dispatch inputs default to the BOUND identity.
  const defaultFor = (inputName) => {
    const match = raw.match(
      new RegExp(`^      ${inputName}:\\n(?:.*\\n)*?        default: (.+)$`, 'm'),
    );
    return match === null ? undefined : match[1].trim();
  };
  const expectedDefaults = {
    source_sha: `'${BOUND_CANDIDATE.sourceSha}'`,
    version: `'${BOUND_CANDIDATE.version}'`,
    npm_tag: `'${BOUND_CANDIDATE.candidateTag}'`,
  };
  for (const [inputName, expected] of Object.entries(expectedDefaults)) {
    const actual = defaultFor(inputName);
    if (actual !== expected) {
      problems.push(
        `dispatch input '${inputName}' default must be ${expected} (got ${actual ?? 'missing'})`,
      );
    }
  }
  checks.push('dispatch inputs default to the exact bound candidate identity');

  return { ok: problems.length === 0, problems, checks };
}

/**
 * Evaluate the observed registry state of ONE member against the bound
 * candidate (amendment §5): exact version present, stable absent, candidate
 * tag exact, latest at the frozen pre-candidate version.
 *
 * @param {string} name package name
 * @param {{versions?: Record<string, unknown>, 'dist-tags'?: Record<string, string>}} packument
 * @returns {{ok: boolean, problems: string[], state: object}}
 */
export function evaluateRegistryMemberState(name, packument) {
  const bound = BOUND_CANDIDATE;
  const problems = [];
  const versions = packument.versions ?? {};
  const distTags = packument['dist-tags'] ?? {};
  const versionEntry = versions[bound.version];
  if (versionEntry === undefined) {
    problems.push(`${name}@${bound.version} is missing from the registry`);
  }
  if (versions[bound.forbiddenStableVersion] !== undefined) {
    problems.push(
      `${name}@${bound.forbiddenStableVersion} EXISTS — stable must remain unpublished`,
    );
  }
  if (distTags[bound.candidateTag] !== bound.version) {
    problems.push(
      `${name} dist-tag '${bound.candidateTag}' is '${distTags[bound.candidateTag] ?? 'missing'}', expected '${bound.version}'`,
    );
  }
  if (distTags.latest !== bound.expectedLatest) {
    problems.push(
      `${name} dist-tag 'latest' is '${distTags.latest ?? 'missing'}', expected '${bound.expectedLatest}'`,
    );
  }
  const integrity =
    versionEntry?.dist?.integrity !== undefined && typeof versionEntry.dist.integrity === 'string'
      ? versionEntry.dist.integrity
      : undefined;
  if (integrity === undefined) {
    problems.push(`${name}@${bound.version} has no dist.integrity`);
  }
  return {
    ok: problems.length === 0,
    problems,
    state: {
      name,
      version: bound.version,
      integrity,
      distTags,
      stableAbsent: versions[bound.forbiddenStableVersion] === undefined,
    },
  };
}

/**
 * The exact frozen member set must be the ONLY inventory (missing member,
 * extra member, or renamed member all fail).
 *
 * @param {string[]} observedNames registry/candidate member names
 * @param {string[]} frozenOrder the frozen 13-name order
 * @returns {string[]} problems
 */
export function evaluateMemberSet(observedNames, frozenOrder) {
  const problems = [];
  const observed = new Set(observedNames);
  const frozen = new Set(frozenOrder);
  for (const name of frozenOrder) {
    if (!observed.has(name)) problems.push(`member '${name}' is missing`);
  }
  for (const name of observedNames) {
    if (!frozen.has(name)) problems.push(`unexpected extra member '${name}'`);
  }
  if (observedNames.length !== frozenOrder.length) {
    problems.push(
      `member count is ${observedNames.length}, expected exactly ${frozenOrder.length}`,
    );
  }
  return problems;
}

const SLSA_PROVENANCE_TYPE = 'https://slsa.dev/provenance/v1';

/**
 * Decode the registry attestation payload bundle entry and evaluate the SLSA
 * v1 provenance against the bound candidate (amendment §3.4/§5).
 *
 * @param {string} name package name
 * @param {string} registryIntegrity registry dist.integrity (sha512-base64)
 * @param {{predicateType: string, bundle?: {dsseEnvelope?: {payloadType?: string, payload?: string}}}} attestation
 * @returns {{ok: boolean, problems: string[], identities?: object}}
 */
export function evaluateSlsaProvenance(name, registryIntegrity, attestation) {
  const bound = BOUND_CANDIDATE;
  const problems = [];
  if (attestation.predicateType !== SLSA_PROVENANCE_TYPE) {
    return {
      ok: false,
      problems: [
        `${name}: attestation predicateType is '${attestation.predicateType}', expected SLSA provenance`,
      ],
    };
  }
  let payload;
  try {
    const envelope = attestation.bundle?.dsseEnvelope;
    if (envelope === undefined || typeof envelope.payload !== 'string') {
      throw new Error('no DSSE envelope payload');
    }
    payload = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
  } catch (error) {
    return {
      ok: false,
      problems: [`${name}: provenance payload undecodable (${error.message})`],
    };
  }

  const buildDefinition = payload.predicate?.buildDefinition;
  const workflow = buildDefinition?.externalParameters?.workflow;
  const runDetails = payload.predicate?.runDetails;
  const subject = payload.subject ?? [];

  if (workflow?.repository !== bound.repositoryUrl) {
    problems.push(
      `${name}: provenance workflow.repository is '${workflow?.repository}', expected '${bound.repositoryUrl}'`,
    );
  }
  if (workflow?.path !== bound.originalWorkflowPath) {
    problems.push(
      `${name}: provenance workflow.path is '${workflow?.path}', expected '${bound.originalWorkflowPath}'`,
    );
  }
  if (workflow?.ref !== bound.provenanceRef) {
    problems.push(
      `${name}: provenance workflow.ref is '${workflow?.ref}', expected '${bound.provenanceRef}'`,
    );
  }
  const sourceDep = (buildDefinition?.resolvedDependencies ?? []).find(
    (dep) => typeof dep?.digest?.gitCommit === 'string',
  );
  if (sourceDep === undefined) {
    problems.push(`${name}: provenance has no gitCommit resolved dependency`);
  } else {
    if (sourceDep.uri !== `git+${bound.repositoryUrl}@${bound.provenanceRef}`) {
      problems.push(
        `${name}: provenance source uri is '${sourceDep.uri}', expected 'git+${bound.repositoryUrl}@${bound.provenanceRef}'`,
      );
    }
    if (sourceDep.digest.gitCommit !== bound.sourceSha) {
      problems.push(
        `${name}: provenance gitCommit is '${sourceDep.digest.gitCommit}', expected '${bound.sourceSha}'`,
      );
    }
  }
  if (runDetails?.builder?.id !== bound.provenanceBuilderId) {
    problems.push(
      `${name}: provenance builder is '${runDetails?.builder?.id}', expected '${bound.provenanceBuilderId}' (GitHub-hosted)`,
    );
  }
  const expectedInvocation = `${bound.originalRunUrl}/attempts/1`;
  if (runDetails?.metadata?.invocationId !== expectedInvocation) {
    problems.push(
      `${name}: provenance invocationId is '${runDetails?.metadata?.invocationId}', expected '${expectedInvocation}' (the original publication run)`,
    );
  }
  const subjectBinding = {
    expected: `pkg:npm/%40victframework/${name.replace('@victframework/', '')}@${bound.version}`,
  };
  if (subject.length !== 1) {
    problems.push(`${name}: provenance subject count is ${subject.length}, expected 1`);
  } else {
    subjectBinding.observed = subject[0].name;
    if (subject[0].name !== subjectBinding.expected) {
      problems.push(
        `${name}: provenance subject is '${subject[0].name}', expected '${subjectBinding.expected}'`,
      );
    }
    const sha512Hex = subject[0].digest?.sha512;
    subjectBinding.sha512Hex = sha512Hex;
    if (typeof sha512Hex !== 'string' || registryIntegrity === undefined) {
      problems.push(`${name}: provenance subject digest or registry integrity missing`);
    } else {
      // The integrity value IS the raw tarball sha512 digest in base64;
      // the provenance subject carries the same digest in hex.
      const integrityHex = Buffer.from(
        registryIntegrity.replace(/^sha512-/, ''),
        'base64',
      ).toString('hex');
      const integrityRoundTrip = `sha512-${Buffer.from(sha512Hex, 'hex').toString('base64')}`;
      if (integrityRoundTrip !== registryIntegrity) {
        problems.push(
          `${name}: provenance subject sha512 does not bind the registry dist.integrity`,
        );
      }
      if (integrityHex !== sha512Hex) {
        problems.push(`${name}: provenance subject digest is not self-consistent`);
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    identities: {
      name,
      predicateType: SLSA_PROVENANCE_TYPE,
      repository: workflow?.repository,
      workflowPath: workflow?.path,
      ref: workflow?.ref,
      sourceUri: sourceDep?.uri,
      gitCommit: sourceDep?.digest?.gitCommit,
      builderId: runDetails?.builder?.id,
      invocationId: runDetails?.metadata?.invocationId,
      subject: subjectBinding,
    },
  };
}

const FORBIDDEN_SPECIFIER = /^(?:workspace:|file:|link:|git(?:\+[^:]+:)?\/\/)/;

/**
 * Evaluate a registry-published manifest for the bound candidate set:
 * exact internal pins of the bound version, no forbidden specifiers, and
 * extract the dependency graph (amendment §5).
 *
 * @param {object} manifest the registry tarball's package/package.json
 * @param {string[]} frozenOrder the frozen member names
 * @returns {{ok: boolean, problems: string[], graph: object}}
 */
export function evaluateRegistryManifest(manifest, frozenOrder) {
  const bound = BOUND_CANDIDATE;
  const problems = [];
  const members = new Set(frozenOrder);
  const graph = { name: manifest.name, version: manifest.version, internal: {}, external: {} };

  if (manifest.name === undefined || manifest.version !== bound.version) {
    problems.push(
      `registry manifest identity is '${manifest.name}@${manifest.version}', expected a member at '${bound.version}'`,
    );
  }
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, spec] of Object.entries(manifest[section] ?? {})) {
      if (FORBIDDEN_SPECIFIER.test(spec)) {
        problems.push(`${manifest.name}: ${dep} uses forbidden specifier '${spec}'`);
      }
      if (members.has(dep)) {
        graph.internal[dep] = spec;
        if (spec !== bound.version) {
          problems.push(
            `${manifest.name}: internal dependency ${dep} pinned '${spec}', expected exact '${bound.version}'`,
          );
        }
      } else {
        graph.external[dep] = spec;
      }
    }
  }
  return { ok: problems.length === 0, problems, graph };
}

/**
 * Compare a rebuilt artifact against the registry artifact at BOTH levels:
 * byte-level (sha512 of the tarball files) and content-level (extracted
 * member paths, bytes, and modes). Amendment §5: BOTH must hold; the known
 * Windows executable-mode observation must surface here truthfully as a
 * byte-level mode difference on a Windows rebuild, never be hidden.
 *
 * @param {Buffer} registryTarball
 * @param {Buffer} rebuiltTarball
 * @param {{registryList: string[], rebuiltList: string[], contentIdentical: boolean, contentDifferences: string[], modeDifferences: {path: string, registryMode: string, rebuiltMode: string}[]}} contentComparison
 * @returns {{ok: boolean, problems: string[], result: object}}
 */
export function compareRebuildWithRegistry(registryTarball, rebuiltTarball, contentComparison) {
  const problems = [];
  const registrySha = createHash('sha512').update(registryTarball).digest('base64');
  const rebuiltSha = createHash('sha512').update(rebuiltTarball).digest('base64');
  const byteIdentical = registrySha === rebuiltSha;
  if (!byteIdentical) {
    problems.push(
      `rebuilt tarball sha512-${rebuiltSha.slice(0, 16)}… != registry sha512-${registrySha.slice(0, 16)}…`,
    );
  }
  if (!contentComparison.contentIdentical) {
    problems.push(
      `content differences: ${contentComparison.contentDifferences.slice(0, 10).join('; ')}`,
    );
  }
  return {
    ok: problems.length === 0,
    problems,
    result: {
      registrySha512: `sha512-${registrySha}`,
      rebuiltSha512: `sha512-${rebuiltSha}`,
      byteIdentical,
      contentIdentical: contentComparison.contentIdentical,
      contentDifferences: contentComparison.contentDifferences,
      modeDifferences: contentComparison.modeDifferences,
      memberCount: {
        registry: contentComparison.registryList.length,
        rebuilt: contentComparison.rebuiltList.length,
      },
    },
  };
}

/**
 * Seal check: the evidence record may conclude only when EVERY section
 * passed. A failed consumer proof therefore makes a successful conclusion
 * impossible (amendment §3.6/§3.7).
 *
 * @param {Array<{ok: boolean, name: string}>} sections
 * @returns {{ok: boolean, failed: string[]}}
 */
export function evaluateEvidenceSections(sections) {
  const failed = sections.filter((section) => !section.ok).map((section) => section.name);
  return { ok: failed.length === 0, failed };
}

/**
 * Self-scan of serialized evidence text with the repository's OWN release
 * tarball content rules (amendment §8: no credentials, no tokens, no
 * `.npmrc` content, no local absolute paths).
 *
 * @param {string} text serialized evidence JSON
 * @returns {string[]} findings (empty = clean)
 */
export function selfScanEvidenceText(text, checkText) {
  const findings = [];
  checkText(text, findings, 'm1-evidence-results.json', 'evidence');
  return findings;
}
