/**
 * Release-authority tests: the fail-closed contract-authority gate and
 * the trust preflight (release-readiness corrections, 2026-09-27).
 *
 * RED/GREEN contract:
 *  - while §16 exists only as the unratified draft, the REAL frozen
 *    contract is REFUSED (red) — by every registry-writing path;
 *  - ONLY the exact owner-ratified contract state (the draft's
 *    Appendix A/B substitutions applied verbatim + the §16 amendment
 *    record with its §16.5 sequence-deviation authorization) is
 *    accepted (green). The `ratify()` fixture below applies exactly
 *    those mechanical edits; any tampering is refused again.
 *
 * No test in this file performs a registry write: the refusal paths are
 * proven to fail BEFORE any registry call.
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessContractAuthority,
  parseSection5Order,
  RATIFIED_AMENDMENTS_LINE_MARKER,
  RATIFIED_DEVIATION_HEADING,
  RATIFIED_SECTION16_HEADING,
} from '../lib/contract-authority.mjs';
import {
  assessTrustPreflight,
  BOOTSTRAP_PLACEHOLDER_VERSION,
  publicationBlockedReason,
  REGISTRY_ABSENT,
  REGISTRY_PRESENT,
  REGISTRY_UNREACHABLE,
  TRUST_CONFLICTING,
  TRUST_EXACT,
  TRUST_MISSING,
  TRUST_UNVERIFIABLE,
} from '../lib/trust-preflight.mjs';
import { FROZEN_PUBLISH_ORDER, validateVersionTagPair } from '../lib/release-set.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const FROZEN_CONTRACT = join(repoRoot, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md');
const realContractText = readFileSync(FROZEN_CONTRACT, 'utf8');

// ---------------------------------------------------------------------------
// The mechanical ratification fixture: EXACTLY the mechanical edits the
// §16 draft's Appendix A (§5 substitution) and Appendix B (§§1, 2, 6, 8,
// 10, 11 substitutions + appended §16 record) specify. Kept line-for-line
// faithful to the draft; tamper tests below prove the checker notices
// deviations.
// ---------------------------------------------------------------------------

function substituteCounts(text) {
  let out = text;
  const edits = [
    // §1 — manifests metadata proof
    [
      '* All 15 published manifests carry (AMENDED 2026-09-26: 13 → 15; see\n  §14)',
      '* All 14 published manifests carry (AMENDED 2026-09-26, §14: 13 → 15;\n  AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    // §2 — workflow-rename blast radius
    [
      'invalidates the trust relationships of all 15 packages (AMENDED\n  2026-09-26: 13 → 15; see §14)',
      'invalidates the trust relationships of all 14 packages (AMENDED\n  2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    // §6 — coherent version + unpublished checks
    [
      'the ONE coherent version of all 15 manifests (AMENDED 2026-09-26:\n    13 → 15; see §14)',
      'the ONE coherent version of all 14 manifests (AMENDED 2026-09-26,\n    §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    [
      'UNPUBLISHED for all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)',
      'UNPUBLISHED for all 14 packages (AMENDED 2026-09-26, §14: 13 → 15;\n  AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    // §8 — build/pack counts
    [
      '4. `npm run build` — all 15 packages (AMENDED 2026-09-26: 13 → 15; see\n   §14; AMENDED: moved ahead of the full suite; see §8.1);',
      '4. `npm run build` — all 14 packages (AMENDED 2026-09-26, §14: 13 → 15;\n   AMENDED 2026-09-27, §16: 15 → 14; AMENDED: moved ahead of the full\n   suite; see §8.1);',
    ],
    [
      '6. `npm pack` of all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)',
      '6. `npm pack` of all 14 packages (AMENDED 2026-09-26, §14: 13 → 15;\n   AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    // §10 — resume/unpublished rule
    [
      'Without the input, all 15 must be unpublished (AMENDED\n  2026-09-26: 13 → 15; see §14).',
      'Without the input, all 14 must be unpublished (AMENDED 2026-09-26,\n  §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14).',
    ],
    // §11 — bootstrap allowlist + ceremony counts
    [
      'derives the exact 15-package\n  (AMENDED 2026-09-26: 13 → 15; see §14) inventory',
      'derives the exact 14-package\n  (AMENDED 2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)\n  inventory',
    ],
    [
      'exact package allowlist (15 as of the 2026-09-26 amendment,\n  §14; anything else aborts)',
      'exact package allowlist (14 as of the 2026-09-27 amendment,\n  §16; anything else aborts)',
    ],
    [
      'all\n  15 relationships are verified inside the window (AMENDED 2026-09-26:\n  13 → 15; see §14 — the completed historical ceremony covered the\n  original 13 and is preserved as history)',
      'all\n  14 relationships are verified inside the window (AMENDED 2026-09-26,\n  §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14 — the completed\n  historical ceremonies are preserved as history)',
    ],
    [
      'The human never\n  performs 15 separate manual package configurations.',
      'The human never\n  performs 14 separate manual package configurations.',
    ],
  ];
  for (const [from, to] of edits) {
    if (!out.includes(from)) {
      throw new Error(`ratify fixture: expected frozen text not found:\n${from}`);
    }
    out = out.replace(from, to);
  }
  return out;
}

const SECTION5_SUBSTITUTION = `## 5. Release-set inventory (frozen; AMENDED 2026-09-26, §14; AMENDED
2026-09-27, §16 — facade retirement, 15 → 14)

The canonical inventory is derived from the publishable manifests under
\`packages/*/package.json\` and MUST remain exactly the recorded 14-package
\`@victframework/*\` set (\`npm run verify:release-set\` is the enforcing
gate; its rules — one coherent version, exact internal pins, recorded
content-derived identity, public access, Apache-2.0, Node engines — are
incorporated here by reference and unchanged). AMENDED 2026-09-27 (§16):
the \`@victframework/renderer-svelte\` compatibility facade is REMOVED
from the forward candidate set; its published versions remain registry-
immutable lineage installable by exact pin.

Dependency-topological publication order (frozen; derived from the
manifests' internal dependency graph):

\`\`\`text
 1. @victframework/contracts
 2. @victframework/ui                    (ADDED 2026-09-26, §14; moved ahead of sdk, §16)
 3. @victframework/sdk                   (was 2 in §14; shifted by the §16 ui move)
 4. @victframework/kernel
 5. @victframework/runtime
 6. @victframework/store-sqlite
 7. @victframework/application
 8. @victframework/ui-svelte             (ADDED 2026-09-26, §14)
 9. @victframework/appdata-sqlite        (was 10 in §14)
10. @victframework/scaffolder            (was 11 in §14)
11. @victframework/control               (was 12 in §14)
12. @victframework/mastra                (was 13 in §14)
13. @victframework/server                (was 14 in §14)
14. @victframework/cli                   (was 15 in §14)
\`\`\`
`;

const SECTION16_RECORD = `## 16. Amendment (2026-09-27): 14-package release set (facade retirement)

**Cause observed (owner-directed facade retirement; independently
verified):** the workspace removed the \`@victframework/renderer-svelte\`
compatibility facade — a pure re-export of the single permanent
implementation in \`@victframework/ui-svelte\` — and migrated every
current consumer to direct \`ui-svelte\` imports. The published facade
versions remain on npm untouched. Against the amended frozen rule (§14,
15 packages) every release-set action failed closed BY DESIGN — the
amendment trigger the amendment rule anticipates.

**Amendment (the semantic rules change as follows; nothing else in this
contract changes):**

1. **Inventory and order (§5):** replaced verbatim by the §16
   substitution (exactly 14 packages; \`renderer-svelte\` REMOVED; a sink
   deletion — one removal, no reordering; machine-validated topological).
2. **Derived counts (§§1, 2, 6, 8, 10, 11):** every current-tense count
   derived from the inventory is restated from 15 to 14, preserving the
   historical amendment markers: manifests metadata proof (§1),
   workflow-rename blast radius (§2), coherent-version check (§6),
   unpublished-set checks (§6, §10), build/pack counts (§8), and the
   bootstrap allowlist and ceremony counts (§11).
3. **Trust semantics and first-publication bootstrap exception (§11):**
   no existing relationship is mutated. \`@victframework/ui\` and
   \`@victframework/ui-svelte\` have no registry presence; npm's
   trusted-publisher configuration is a per-package setting on an
   EXISTING package. Their FIRST registry presence may be established
   ONLY through the separately owner-authorized bootstrap
   (\`scripts/first-publish-bootstrap.mjs\`): placeholder version
   \`0.0.0-bootstrap.1\` under the \`bootstrap\` dist-tag — a shape that
   can never satisfy the §6 coordinated version rule — published through
   the historical local interactive-2FA path (§13 precedent), never
   through the coordinated release engine, never consuming a coordinated
   set version. Placeholder versions are registry-immutable lineage.
   The coordinated set publishes only after ALL members' relationships
   are verified (\`scripts/verify-trust-preflight.mjs\` refuses any
   publication otherwise).

### 16.5 Ratification sequence deviation — explicit owner authorization

The frozen amendment rule requires the amendment commit BEFORE any
implementation consumes the amendment. THIS RATIFICATION RECORDS A
DEPARTURE: the consuming implementation for the 14-package set was
committed BEFORE ratification — \`pi/ui-facade-retirement-r1\` @
\`bac9c01640d1aa4e6d1ee040969fae3d63136853\`, its owner-review
preparation \`pi/ui-facade-retirement-r2\` @
\`d8c70df2d80169e38d951c4569e913ecfab49865\`, and the release-readiness
corrections on \`pi/release-readiness-r3\`. No consuming implementation
created registry drift: nothing was published, no trust was mutated,
and every frozen verifier failed closed in between. The unratified §15
draft is NOT authority and is not relied on.

By ratifying this §16 the owner EXPLICITLY AUTHORIZES retroactively the
consuming implementation commits above, or DIRECTS their reversion
before ratification; the chosen option is recorded in the ratification
commit message. Ratification without either choice recorded is
INCOMPLETE and the release path stays fail-closed.
`;

function ratify(text) {
  let out = text;
  // Header amendments-to-date line records §16.
  out = out.replace(
    '§14 (2026-09-26, 15-package release set).',
    '§14 (2026-09-26, 15-package release set); §16 (2026-09-27, 14-package\nfacade retirement).',
  );
  if (!out.includes(RATIFIED_AMENDMENTS_LINE_MARKER.replace(/\s+/g, ' ').slice(0, 24))) {
    // the whitespace-normalized marker check happens in the lib; keep the
    // fixture honest — the string above must contain the marker words.
  }
  // §5 wholesale substitution (Appendix A).
  const s5Start = out.indexOf('## 5. Release-set inventory');
  const s5End = out.indexOf('## 6.');
  if (s5Start === -1 || s5End === -1) throw new Error('ratify fixture: §5 bounds not found');
  out = out.slice(0, s5Start) + SECTION5_SUBSTITUTION + '\n' + out.slice(s5End);
  // §§1, 2, 6, 8, 10, 11 current-tense count substitutions (Appendix B).
  out = substituteCounts(out);
  // Append the §16 amendment record (Appendix B, part 2).
  out = `${out.trimEnd()}\n\n${SECTION16_RECORD}`;
  return out;
}

function writeFixtureRepo(contractText) {
  const dir = mkdtempSync(join(tmpdir(), 'vict-contract-authority-'));
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md'), contractText);
  return dir;
}

// ---------------------------------------------------------------------------
// 1. Contract authority — RED on the real frozen contract (unratified §16)
// ---------------------------------------------------------------------------

describe('contract authority — red state (frozen contract at §14, §16 unratified)', () => {
  const verdict = assessContractAuthority(realContractText);

  it('refuses the real frozen contract', () => {
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.length).toBeGreaterThan(0);
  });

  it('names every missing ratification element', () => {
    const joined = verdict.problems.join('\n');
    expect(joined).toContain('missing ratified amendment record');
    expect(joined).toContain('missing owner authorization');
    expect(joined).toContain('Amendments to date');
    expect(joined).toContain('§5');
  });

  it('reports the 15-entry §5 order mismatch', () => {
    const orderProblem = verdict.problems.find((problem) =>
      problem.includes('order is not the frozen'),
    );
    expect(orderProblem).toBeDefined();
    expect(orderProblem).toContain('found 15 entries');
    expect(orderProblem).toContain('@victframework/renderer-svelte');
  });

  it('reports surviving current-tense 15-norms in §§1–12', () => {
    const stale = verdict.problems.filter((problem) => problem.includes('stale current-tense'));
    expect(stale.length).toBeGreaterThanOrEqual(5);
    expect(stale.join('\n')).toContain('Appendix B');
  });
});

// ---------------------------------------------------------------------------
// 2. Contract authority — GREEN on the exact ratified state only
// ---------------------------------------------------------------------------

describe('contract authority — green state (exact ratified §16 state)', () => {
  const ratified = ratify(realContractText);
  const verdict = assessContractAuthority(ratified);

  it('authorizes the exactly-ratified contract text', () => {
    expect(verdict.problems).toEqual([]);
    expect(verdict.authorized).toBe(true);
  });

  it('the ratified §5 order parses to exactly the frozen 14-package order', () => {
    const order = parseSection5Order(
      ratified.slice(ratified.indexOf('## 5.'), ratified.indexOf('## 6.')),
    );
    expect(order).toEqual(FROZEN_PUBLISH_ORDER);
  });

  it('refuses a tampered §5 order (one swapped entry)', () => {
    const tampered = ratified.replace(
      '13. @victframework/server                (was 14 in §14)\n14. @victframework/cli                   (was 15 in §14)',
      '13. @victframework/cli                   (was 15 in §14)\n14. @victframework/server                (was 14 in §14)',
    );
    expect(tampered).not.toEqual(ratified);
    const result = assessContractAuthority(tampered);
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('order is not the frozen 14-package order');
  });

  it('refuses a reintroduced current-tense 15-norm', () => {
    const tampered = ratified.replace(
      'The human never\n  performs 14 separate manual package configurations.',
      'The human never\n  performs 15 separate manual package configurations.',
    );
    const result = assessContractAuthority(tampered);
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('stale current-tense');
  });

  it('refuses a missing sequence-deviation authorization', () => {
    const tampered = ratified.replace(`\n${RATIFIED_DEVIATION_HEADING}\n`, '\n');
    const result = assessContractAuthority(tampered);
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('missing owner authorization');
  });

  it('refuses a missing §16 record', () => {
    const tampered =
      ratified.slice(0, ratified.indexOf(RATIFIED_SECTION16_HEADING)).trimEnd() + '\n';
    const result = assessContractAuthority(tampered);
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('missing ratified amendment record');
  });

  it('tolerates 15-references inside historical records (§8.1/§13/§14/§16)', () => {
    // §8.1's historical narrative legitimately mentions earlier states.
    const withHistory = ratified.replace(
      'the first clean-runner execution exposed it.',
      'the first clean-runner execution exposed it. (Historical note: at the\n§14 state all 15 packages were built at step 4.)',
    );
    const result = assessContractAuthority(withHistory);
    expect(result.authorized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Engine wiring — every registry-writing path refuses BEFORE any
//    registry call while the contract is unratified
// ---------------------------------------------------------------------------

describe('engine wiring — authority gate precedes any registry call', () => {
  it('oidc-release validate refuses with the authority message (no lineage/registry activity)', () => {
    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'scripts', 'oidc-release.mjs'),
        'validate',
        '--source-sha',
        '0000000000000000000000000000000000000000',
        '--version',
        '0.4.0-rc.1',
        '--tag',
        'vict-0.4.0-rc',
      ],
      { encoding: 'utf8', cwd: repoRoot },
    );
    expect(result.status).toBe(1);
    const output = `${result.stderr}${result.stdout}`;
    expect(output).toContain('CONTRACT AUTHORITY REFUSED');
    expect(output).toContain('NO registry call or write was made');
    // The gate fired BEFORE lineage validation and the unpublished guard.
    expect(output).not.toContain('origin/main');
    expect(output).not.toContain('resume');
  });

  it('oidc-release publish refuses before even the local pack-dir check', () => {
    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'scripts', 'oidc-release.mjs'),
        'publish',
        '--pack-dir',
        join(tmpdir(), 'definitely-missing-pack-dir'),
      ],
      { encoding: 'utf8', cwd: repoRoot },
    );
    expect(result.status).toBe(1);
    expect(`${result.stderr}${result.stdout}`).toContain('CONTRACT AUTHORITY REFUSED');
    expect(`${result.stderr}${result.stdout}`).not.toContain('requires a valid --pack-dir');
  });

  it('the standalone authority CLI is red on the real repo and green only on a ratified fixture', () => {
    const red = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'verify-contract-authority.mjs')],
      {
        encoding: 'utf8',
        cwd: repoRoot,
      },
    );
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('does not yet authorize the 14-package candidate set');

    const fixtureRoot = writeFixtureRepo(ratify(realContractText));
    try {
      const green = spawnSync(
        process.execPath,
        [join(repoRoot, 'scripts', 'verify-contract-authority.mjs'), '--repo-root', fixtureRoot],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(green.status).toBe(0);
      expect(green.stdout).toContain('AUTHORIZED');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('trust-bootstrap --execute (a registry WRITE) refuses at the authority gate', () => {
    const result = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'trust-bootstrap.mjs'), '--execute'],
      {
        encoding: 'utf8',
        cwd: repoRoot,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CONTRACT AUTHORITY REFUSED');
  });

  it(
    'first-publish-bootstrap --execute refuses without authorization and before any write',
    { timeout: 300_000 },
    () => {
      const result = spawnSync(
        process.execPath,
        [
          join(repoRoot, 'scripts', 'first-publish-bootstrap.mjs'),
          '--execute',
          '--authorization',
          join(tmpdir(), 'missing-authorization.txt'),
        ],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(result.status).toBe(1);
      expect(`${result.stderr}${result.stdout}`).toContain('CONTRACT AUTHORITY REFUSED');
    },
  );
});

// ---------------------------------------------------------------------------
// 4. Trust preflight — the set-wide publication rule
// ---------------------------------------------------------------------------

function fullSet(overrides = {}) {
  return FROZEN_PUBLISH_ORDER.map((name) => ({
    name,
    registry: REGISTRY_PRESENT,
    trust: TRUST_EXACT,
    ...overrides[name],
  }));
}

describe('trust preflight — set-wide publication rule', () => {
  it('authorizes only when ALL 14 exist and are exact', () => {
    const verdict = assessTrustPreflight(fullSet());
    expect(verdict.authorized).toBe(true);
    expect(verdict.stage).toBe('authorized');
    expect(publicationBlockedReason(verdict)).toBeNull();
  });

  it('refuses ALL publication while any member is absent (the ui/ui-svelte state)', () => {
    const verdict = assessTrustPreflight(
      fullSet({
        '@victframework/ui': { registry: REGISTRY_ABSENT, trust: TRUST_UNVERIFIABLE },
        '@victframework/ui-svelte': { registry: REGISTRY_ABSENT, trust: TRUST_UNVERIFIABLE },
        '@victframework/contracts': { trust: TRUST_UNVERIFIABLE },
      }),
    );
    expect(verdict.authorized).toBe(false);
    expect(verdict.stage).toBe('first-publication-bootstrap');
    expect(verdict.absent).toEqual(['@victframework/ui', '@victframework/ui-svelte']);
    const reason = publicationBlockedReason(verdict);
    expect(reason).toContain('PUBLICATION REFUSED FOR THE WHOLE SET');
    expect(reason).toContain('0.0.0-bootstrap.1');
  });

  it('refuses when members exist but trust is missing', () => {
    const verdict = assessTrustPreflight(
      fullSet({ '@victframework/cli': { trust: TRUST_MISSING } }),
    );
    expect(verdict.authorized).toBe(false);
    expect(verdict.stage).toBe('trust-bootstrap');
    expect(verdict.untrusted).toEqual(['@victframework/cli']);
  });

  it('refuses on a conflicting relationship (never auto-replaced)', () => {
    const verdict = assessTrustPreflight(
      fullSet({ '@victframework/sdk': { trust: TRUST_CONFLICTING } }),
    );
    expect(verdict.authorized).toBe(false);
    expect(verdict.stage).toBe('blocked');
    expect(verdict.conflicting).toEqual(['@victframework/sdk']);
  });

  it('treats unverifiable trust as a blocker (absence of proof is never a pass)', () => {
    const verdict = assessTrustPreflight(
      fullSet({ '@victframework/kernel': { trust: TRUST_UNVERIFIABLE } }),
    );
    expect(verdict.authorized).toBe(false);
    expect(verdict.unverifiable).toEqual(['@victframework/kernel']);
  });

  it('an unreachable registry blocks the whole set', () => {
    const verdict = assessTrustPreflight(
      fullSet({ '@victframework/cli': { registry: REGISTRY_UNREACHABLE } }),
    );
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.join('\n')).toContain('reachability could not be proven');
  });

  it('refuses to decide on a partial or polluted member set', () => {
    expect(() => assessTrustPreflight(fullSet().slice(1))).toThrow(/missing release-set member/);
    expect(() =>
      assessTrustPreflight([
        ...fullSet(),
        { name: '@victframework/renderer-svelte', registry: REGISTRY_PRESENT, trust: TRUST_EXACT },
      ]),
    ).toThrow(/non-member/);
  });
});

// ---------------------------------------------------------------------------
// 5. The bootstrap placeholder can never consume the coordinated set
// ---------------------------------------------------------------------------

describe('first-publication bootstrap — placeholder isolation', () => {
  it('the placeholder version is never a valid coordinated release-set version', () => {
    expect(BOOTSTRAP_PLACEHOLDER_VERSION).toBe('0.0.0-bootstrap.1');
    expect(validateVersionTagPair(BOOTSTRAP_PLACEHOLDER_VERSION, 'latest').ok).toBe(false);
    expect(validateVersionTagPair(BOOTSTRAP_PLACEHOLDER_VERSION, 'bootstrap').ok).toBe(false);
  });

  it(
    'the bootstrap plan names exactly the absent members and stays dry without --execute',
    { timeout: 300_000 },
    () => {
      const result = spawnSync(
        process.execPath,
        [join(repoRoot, 'scripts', 'first-publish-bootstrap.mjs')],
        { encoding: 'utf8', cwd: repoRoot, timeout: 240_000 },
      );
      expect(result.status).toBe(0);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain('absent: @victframework/ui');
      expect(output).toContain('absent: @victframework/ui-svelte');
      expect(output).toContain('0.4.0-rc.1 remains the coordinated candidate version');
      expect(output).toContain('DRY plan only');
    },
  );
});

// ---------------------------------------------------------------------------
// 6. The workflow gates publication on contract authority
// ---------------------------------------------------------------------------

describe('release.yml — contract authority gate', () => {
  const raw = existsSync(join(repoRoot, '.github', 'workflows', 'release.yml'))
    ? readFileSync(join(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8')
    : '';

  it('runs the authority gate immediately before the publish step, publish-only', () => {
    expect(raw).toContain('node scripts/verify-contract-authority.mjs');
    const gateIndex = raw.indexOf('Contract authority gate');
    const publishIndex = raw.indexOf('Publish the exact tarballs');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(gateIndex);
    const gateBlock = raw.slice(gateIndex, publishIndex);
    expect(gateBlock).toContain('validate_only != true');
  });
});
