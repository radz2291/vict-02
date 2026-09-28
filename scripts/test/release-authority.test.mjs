/**
 * Release-authority tests (r4): the fail-closed contract-authority gate
 * WITH owner-decision enforcement, the MANDATORY trust preflight with
 * set-bound evidence, and the engine/workflow wiring.
 *
 * RED/GREEN contract:
 *  - while §16 exists only as the unratified draft, the REAL frozen
 *    contract is REFUSED (red) — by every registry-writing path;
 *  - only the EXACT owner-ratified state passes: Appendices A+B applied
 *    verbatim AND the owner's explicit §16.5 decision line
 *    (`Owner decision recorded: D-AUTHORIZE` / `D-REVERT`) consistent
 *    with the branch's REAL git history. A heading or a self-created
 *    marker is NOT a decision: missing, ambiguous, malformed, or
 *    contradictory choices refuse authority (r4);
 *  - publication additionally requires the set-wide trust preflight
 *    (all 14 present + exact verified trust) — live or through a
 *    VALIDATED set-bound evidence artifact (r4; r3 accepted arbitrary
 *    JSON, so these tests fail on r3).
 *
 * No test in this file performs a registry write.
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessContractAuthority,
  createGitAncestryVerifier,
  extractOwnerDecision,
  parseSection5Order,
} from '../lib/contract-authority.mjs';
import { assessPublicationPreflight, releaseSetIdentityAt } from '../lib/publication-preflight.mjs';
import {
  membersFromTrustEvidence,
  TRUST_EVIDENCE_SCHEMA,
  validateTrustEvidence,
} from '../lib/trust-evidence.mjs';
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
const ownerDecisionLine = (token) => `Owner decision recorded: ${token}`;

// ---------------------------------------------------------------------------
// The mechanical ratification fixture: EXACTLY the mechanical edits the
// §16 draft's Appendix A (§5 substitution) and Appendix B (§§1, 2, 6, 8,
// 10, 11 substitutions + appended §16 record) specify, plus the owner's
// §16.5 decision line when a decision is supplied. Tamper tests below
// prove the checker notices deviations.
// ---------------------------------------------------------------------------

function substituteCounts(text) {
  let out = text;
  const edits = [
    [
      '* All 15 published manifests carry (AMENDED 2026-09-26: 13 → 15; see\n  §14)',
      '* All 14 published manifests carry (AMENDED 2026-09-26, §14: 13 → 15;\n  AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    [
      'invalidates the trust relationships of all 15 packages (AMENDED\n  2026-09-26: 13 → 15; see §14)',
      'invalidates the trust relationships of all 14 packages (AMENDED\n  2026-09-26, §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    [
      'the ONE coherent version of all 15 manifests (AMENDED 2026-09-26:\n    13 → 15; see §14)',
      'the ONE coherent version of all 14 manifests (AMENDED 2026-09-26,\n    §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    [
      'UNPUBLISHED for all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)',
      'UNPUBLISHED for all 14 packages (AMENDED 2026-09-26, §14: 13 → 15;\n  AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    [
      '4. `npm run build` — all 15 packages (AMENDED 2026-09-26: 13 → 15; see\n   §14; AMENDED: moved ahead of the full suite; see §8.1);',
      '4. `npm run build` — all 14 packages (AMENDED 2026-09-26, §14: 13 → 15;\n   AMENDED 2026-09-27, §16: 15 → 14; AMENDED: moved ahead of the full\n   suite; see §8.1);',
    ],
    [
      '6. `npm pack` of all 15 packages (AMENDED 2026-09-26: 13 → 15; see §14)',
      '6. `npm pack` of all 14 packages (AMENDED 2026-09-26, §14: 13 → 15;\n   AMENDED 2026-09-27, §16: 15 → 14)',
    ],
    [
      'Without the input, all 15 must be unpublished (AMENDED\n  2026-09-26: 13 → 15; see §14).',
      'Without the input, all 14 must be unpublished (AMENDED 2026-09-26,\n  §14: 13 → 15; AMENDED 2026-09-27, §16: 15 → 14).',
    ],
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
   set version. Placeholder versions are registry-immutable lineage and
   registry-presence markers, NOT functional releases: they carry the
   real built package content with the real dependency pins, so members
   whose dependencies pin the coordinated version are NOT installable
   until the coordinated set publishes. The coordinated set publishes
   only after ALL members' relationships are verified
   (\`scripts/verify-trust-preflight.mjs\` refuses any publication
   otherwise).

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

Upon ratification the owner records EXACTLY ONE decision line in this
section, in the exact form \`Owner decision recorded: \` immediately
followed by the chosen token — D-AUTHORIZE (retroactively authorizing
the consuming implementation commits named above; the pre-publication
authority gate verifies they ARE ancestors of the release source) or
D-REVERT (directing the reversion of the consuming implementation
before ratification; the authority gate verifies the named commits have
actually been REMOVED from the release branch's history). The same
choice is repeated in the ratification commit message. A record with NO
decision line, with MORE THAN ONE, with a malformed line, or whose
choice contradicts the branch's actual history is INCOMPLETE, AMBIGUOUS,
or CONTRADICTORY, and the release path stays fail-closed. A heading, a
summary, or a self-authored marker anywhere else is not an owner
decision: only this exact decision line inside §16.5 of the frozen
contract counts.
`;

function ratify(text, decision) {
  let out = text;
  out = out.replace(
    '§14 (2026-09-26, 15-package release set).',
    '§14 (2026-09-26, 15-package release set); §16 (2026-09-27, 14-package\nfacade retirement).',
  );
  const s5Start = out.indexOf('## 5. Release-set inventory');
  const s5End = out.indexOf('## 6.');
  if (s5Start === -1 || s5End === -1) throw new Error('ratify fixture: §5 bounds not found');
  out = out.slice(0, s5Start) + SECTION5_SUBSTITUTION + '\n' + out.slice(s5End);
  out = substituteCounts(out);
  let record = SECTION16_RECORD;
  if (decision !== undefined) {
    // The owner appends EXACTLY ONE decision line inside §16.5.
    record = `${record.trimEnd()}\n\n${ownerDecisionLine(decision)}\n`;
  }
  out = `${out.trimEnd()}\n\n${record}`;
  return out;
}

// ---------------------------------------------------------------------------
// 1. Contract authority — RED on the real frozen contract (§14 state)
// ---------------------------------------------------------------------------

describe('contract authority — red state (frozen contract at §14, §16 unratified)', () => {
  const verdict = assessContractAuthority(realContractText, { isAncestor: () => true });

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
// 2. Contract authority — the owner decision is ENFORCED (r4)
// ---------------------------------------------------------------------------

describe('contract authority — §16.5 owner decision enforcement', () => {
  const ratifiedNoDecision = ratify(realContractText);
  const alwaysAncestor = () => true;
  const neverAncestor = () => false;

  it('extractOwnerDecision: exact line inside §16.5 is recognized; elsewhere it is not', () => {
    expect(extractOwnerDecision(ratify(realContractText, 'D-AUTHORIZE')).kind).toBe('authorize');
    expect(extractOwnerDecision(ratify(realContractText, 'D-REVERT')).kind).toBe('revert');
    // A decision marker dropped into §14's area (outside §16.5) is NOT
    // the owner decision: the section-scoped search never sees it.
    const misplaced = ratifiedNoDecision.replace(
      '§14 (2026-09-26, 15-package release set); §16 (2026-09-27, 14-package\nfacade retirement).',
      `§14 (2026-09-26, 15-package release set); §16 (2026-09-27, 14-package\nfacade retirement). ${ownerDecisionLine('D-AUTHORIZE')}`,
    );
    expect(extractOwnerDecision(misplaced).kind).toBe('malformed'); // §16.5 still mentions tokens without its own exact line
  });

  it('extractOwnerDecision: missing, ambiguous, and malformed are distinguished', () => {
    expect(extractOwnerDecision(ratifiedNoDecision).kind).toBe('malformed'); // tokens mentioned, no exact line
    const both = ratify(realContractText, 'D-AUTHORIZE').replace(
      `${ownerDecisionLine('D-AUTHORIZE')}`,
      `${ownerDecisionLine('D-AUTHORIZE')}\n${ownerDecisionLine('D-REVERT')}`,
    );
    expect(extractOwnerDecision(both).kind).toBe('ambiguous');
    const duplicate = ratify(realContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      `${ownerDecisionLine('D-AUTHORIZE')}\n${ownerDecisionLine('D-AUTHORIZE')}`,
    );
    expect(extractOwnerDecision(duplicate).kind).toBe('ambiguous');
    const malformed = ratify(realContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      'owner decision: D-AUTHORIZE (informal note)',
    );
    expect(extractOwnerDecision(malformed).kind).toBe('malformed');
  });

  it('refuses a ratified record with NO decision line (heading is not a decision)', () => {
    const verdict = assessContractAuthority(ratifiedNoDecision, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    // The record TEXT mentions the tokens (as instructions) without the
    // owner ever recording the exact line — refused.
    const problem = verdict.problems.find((p) => p.includes('owner decision malformed'));
    expect(problem).toBeDefined();
    expect(problem).toContain('records no exact `Owner decision recorded:');
  });

  it('refuses AMBIGUOUS decisions (both tokens, or the line twice)', () => {
    const both = ratify(realContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      `${ownerDecisionLine('D-AUTHORIZE')}\n${ownerDecisionLine('D-REVERT')}`,
    );
    const verdict = assessContractAuthority(both, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.join('\n')).toContain('owner decision ambiguous');
  });

  it('refuses MALFORMED decisions (tokens without the exact line form)', () => {
    const informal = ratify(realContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      'The owner informally nodded at D-AUTHORIZE.',
    );
    const verdict = assessContractAuthority(informal, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.join('\n')).toContain('owner decision malformed');
  });

  it('accepts D-AUTHORIZE only when the named consuming commits ARE ancestors', () => {
    const ok = assessContractAuthority(ratify(realContractText, 'D-AUTHORIZE'), {
      isAncestor: alwaysAncestor,
    });
    expect(ok.authorized).toBe(true);

    const contradictory = assessContractAuthority(ratify(realContractText, 'D-AUTHORIZE'), {
      isAncestor: neverAncestor,
    });
    expect(contradictory.authorized).toBe(false);
    expect(contradictory.problems.join('\n')).toContain('D-AUTHORIZE is recorded');

    const noVerifier = assessContractAuthority(ratify(realContractText, 'D-AUTHORIZE'), {});
    expect(noVerifier.authorized).toBe(false);
    expect(noVerifier.problems.join('\n')).toContain('cross-check unavailable');
  });

  it('accepts D-REVERT only when the named consuming commits are GONE from history', () => {
    const reverted = assessContractAuthority(ratify(realContractText, 'D-REVERT'), {
      isAncestor: neverAncestor,
    });
    expect(reverted.authorized).toBe(true);

    const stillPresent = assessContractAuthority(ratify(realContractText, 'D-REVERT'), {
      isAncestor: alwaysAncestor,
    });
    expect(stillPresent.authorized).toBe(false);
    expect(stillPresent.problems.join('\n')).toContain('D-REVERT is recorded');
    expect(stillPresent.problems.join('\n')).toContain('revert the implementation');
  });

  it('git ancestry verifier: resolvable → true/false; unresolvable → undefined, never a guess', () => {
    const isAncestor = createGitAncestryVerifier(repoRoot);
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      cwd: repoRoot,
    }).stdout.trim();
    expect(isAncestor(head)).toBe(true);
    // A well-formed but ABSENT sha cannot be resolved (git exit 128) —
    // the honest verdict is undefined, and the gate refuses on it.
    expect(isAncestor('0123456789abcdef0123456789abcdef01234567')).toBeUndefined();
    const missingRepo = createGitAncestryVerifier(join(tmpdir(), 'definitely-not-a-repo-r4'));
    expect(missingRepo(head)).toBeUndefined();
  });

  it('end-to-end D-REVERT on a truly reverted world (orphan commit named) AUTHORIZES', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vict-reverted-world-'));
    mkdirSync(join(dir, 'docs'), { recursive: true });
    const git = (args) => {
      const result = spawnSync('git', args, { encoding: 'utf8', cwd: dir });
      if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
      return (result.stdout ?? '').trim();
    };
    try {
      git(['init', '-q']);
      git(['config', 'user.email', 'fixture@example.invalid']);
      git(['config', 'user.name', 'fixture']);
      writeFileSync(join(dir, 'docs', 'SEED.md'), 'seed\n');
      git(['add', '-A']);
      git(['commit', '-q', '-m', 'seed']);
      // A commit on an ORPHAN branch: never an ancestor of main HEAD —
      // standing in for "the consuming commits were removed".
      git(['checkout', '-q', '--orphan', 'side']);
      git(['commit', '-q', '--allow-empty', '-m', 'orphan']);
      const orphanSha = git(['rev-parse', 'HEAD']);
      git(['checkout', '-q', 'master']);
      let text = ratify(realContractText, 'D-REVERT').replace(
        'bac9c01640d1aa4e6d1ee040969fae3d63136853',
        orphanSha,
      );
      text = text.replace('d8c70df2d80169e38d951c4569e913ecfab49865', orphanSha);
      writeFileSync(join(dir, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md'), text);
      git(['add', '-A']);
      git(['commit', '-q', '-m', 'ratify §16 D-REVERT (fixture)']);
      const green = spawnSync(
        process.execPath,
        [join(repoRoot, 'scripts', 'verify-contract-authority.mjs'), '--repo-root', dir],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(green.status).toBe(0);
      expect(green.stdout).toContain('AUTHORIZED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Contract authority — GREEN on the exact ratified + decided state
// ---------------------------------------------------------------------------

describe('contract authority — green state (ratified Appendices A+B + explicit owner decision)', () => {
  it('authorizes the exactly-ratified contract with D-AUTHORIZE (injected ancestry)', () => {
    const verdict = assessContractAuthority(ratify(realContractText, 'D-AUTHORIZE'), {
      isAncestor: () => true,
    });
    expect(verdict.problems).toEqual([]);
    expect(verdict.authorized).toBe(true);
  });

  it('the ratified §5 order parses to exactly the frozen 14-package order', () => {
    const ratified = ratify(realContractText, 'D-AUTHORIZE');
    const order = parseSection5Order(
      ratified.slice(ratified.indexOf('## 5.'), ratified.indexOf('## 6.')),
    );
    expect(order).toEqual(FROZEN_PUBLISH_ORDER);
  });

  it('refuses a tampered §5 order (one swapped entry)', () => {
    const ratified = ratify(realContractText, 'D-AUTHORIZE');
    const tampered = ratified.replace(
      '13. @victframework/server                (was 14 in §14)\n14. @victframework/cli                   (was 15 in §14)',
      '13. @victframework/cli                   (was 15 in §14)\n14. @victframework/server                (was 14 in §14)',
    );
    expect(tampered).not.toEqual(ratified);
    const result = assessContractAuthority(tampered, { isAncestor: () => true });
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('order is not the frozen 14-package order');
  });

  it('refuses a reintroduced current-tense 15-norm', () => {
    const ratified = ratify(realContractText, 'D-AUTHORIZE');
    const tampered = ratified.replace(
      'The human never\n  performs 14 separate manual package configurations.',
      'The human never\n  performs 15 separate manual package configurations.',
    );
    const result = assessContractAuthority(tampered, { isAncestor: () => true });
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('stale current-tense');
  });

  it('tolerates 15-references inside historical records (§8.1/§13/§14/§16)', () => {
    const ratified = ratify(realContractText, 'D-AUTHORIZE');
    const withHistory = ratified.replace(
      'the first clean-runner execution exposed it.',
      'the first clean-runner execution exposed it. (Historical note: at the\n§14 state all 15 packages were built at step 4.)',
    );
    const result = assessContractAuthority(withHistory, { isAncestor: () => true });
    expect(result.authorized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Contract authority — REAL git ancestry, end to end (CLI)
// ---------------------------------------------------------------------------

/** Build a real git fixture whose ratified contract names REAL commits. */
function writeGitFixture(decision, { nameCommits }) {
  const dir = mkdtempSync(join(tmpdir(), 'vict-contract-authority-git-'));
  mkdirSync(join(dir, 'docs'), { recursive: true });
  const git = (args) => {
    const result = spawnSync('git', args, { encoding: 'utf8', cwd: dir });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    return (result.stdout ?? '').trim();
  };
  git(['init', '-q']);
  git(['config', 'user.email', 'fixture@example.invalid']);
  git(['config', 'user.name', 'fixture']);
  writeFileSync(join(dir, 'docs', 'SEED.md'), 'seed\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'seed']);
  const parentSha = git(['rev-parse', 'HEAD']);
  let text = ratify(realContractText, decision);
  if (nameCommits) {
    // Point §16.5's named commits at REAL commits of this fixture repo:
    // parentSha (ancestor) and a second commit made below (HEAD).
    text = text
      .replace('bac9c01640d1aa4e6d1ee040969fae3d63136853', parentSha)
      .replace('d8c70df2d80169e38d951c4569e913ecfab49865', 'PENDING_SECOND_SHA');
  }
  writeFileSync(join(dir, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md'), text);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'ratify §16 (test fixture)']);
  if (nameCommits) {
    const headSha = git(['rev-parse', 'HEAD']);
    // Re-write the contract with the real HEAD sha in place of the
    // placeholder and commit again (HEAD sha changes; the LAST commit's
    // own sha cannot name itself — name the seed + first ratification
    // commit instead, both ancestors).
    const firstRatifySha = headSha;
    let final = readFileSync(join(dir, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md'), 'utf8')
      .toString()
      .replace('PENDING_SECOND_SHA', firstRatifySha);
    writeFileSync(join(dir, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md'), final);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'ratify §16 — record decision (test fixture)']);
  }
  return dir;
}

describe('contract authority — end-to-end with REAL git ancestry (CLI)', () => {
  it('the standalone CLI is RED on the real repo (§16 unratified, no decision)', () => {
    const result = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'verify-contract-authority.mjs')],
      {
        encoding: 'utf8',
        cwd: repoRoot,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not yet authorize the 14-package candidate set');
  });

  it('D-AUTHORIZE with real ancestor commits AUTHORIZES', () => {
    const fixtureRoot = writeGitFixture('D-AUTHORIZE', { nameCommits: true });
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

  it('D-REVERT while the consuming commits are still ancestors is REFUSED (real git)', () => {
    const fixtureRoot = writeGitFixture('D-REVERT', { nameCommits: true });
    try {
      const red = spawnSync(
        process.execPath,
        [join(repoRoot, 'scripts', 'verify-contract-authority.mjs'), '--repo-root', fixtureRoot],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(red.status).toBe(1);
      expect(red.stderr).toContain('D-REVERT is recorded');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Engine wiring — every registry-writing path refuses BEFORE any
//    registry call; the trust preflight is wired after authority (r4)
// ---------------------------------------------------------------------------

describe('engine wiring — authority + preflight gates precede any registry call', () => {
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

  it('the trust preflight is wired into BOTH oidc subcommands and publish-release (r4; fails on r3)', () => {
    const oidc = readFileSync(join(repoRoot, 'scripts', 'oidc-release.mjs'), 'utf8');
    // Definition + two call sites (validate, publish — publish covers the
    // resume path).
    expect(oidc.match(/assertTrustPreflight\(/g)?.length).toBe(3);
    // Both call sites precede any unpublished-guard/resume work.
    const firstCall = oidc.indexOf('assertTrustPreflight(repoRoot');
    const guardDef = oidc.indexOf('function validateUnpublishedGuard');
    expect(firstCall).toBeGreaterThan(-1);
    expect(firstCall).toBeLessThan(guardDef);
    const publish = readFileSync(join(repoRoot, 'scripts', 'publish-release.mjs'), 'utf8');
    expect(publish).toMatch(/assessPublicationPreflight\(\{\s*repoRoot/);
  });

  it('oidc-release with an ARBITRARY evidence file still refuses at the AUTHORITY gate first', () => {
    const arbitrary = join(tmpdir(), `arbitrary-evidence-${Date.now()}.json`);
    writeFileSync(arbitrary, '{"contracts": {"github": {"repository": "radz2291/vict-02"}}}');
    try {
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
          '--trust-evidence',
          arbitrary,
        ],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(result.status).toBe(1);
      const output = `${result.stderr}${result.stdout}`;
      expect(output).toContain('CONTRACT AUTHORITY REFUSED');
      expect(output).not.toContain('evidence artifact'); // preflight never even ran
    } finally {
      rmSync(arbitrary, { force: true });
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
// 6. Trust preflight — set-wide rule + CREDIBLE evidence (r4)
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
// 7. Trust evidence — arbitrary or stale JSON never authorizes (r4)
// ---------------------------------------------------------------------------

function validEvidence({ now = new Date('2026-09-27T12:00:00Z'), identity, version } = {}) {
  const members = {};
  for (const name of FROZEN_PUBLISH_ORDER) {
    members[name] = {
      registry: 'present',
      trust: 'exact',
      command: `npm trust list ${name} --json`,
      exitCode: 0,
      rawOutputSha256: 'a'.repeat(64),
    };
  }
  return JSON.stringify({
    schema: TRUST_EVIDENCE_SCHEMA,
    generatedAt: now.toISOString(),
    version,
    setIdentity: identity,
    members,
  });
}

describe('trust evidence — binding failures refuse authority', () => {
  const { identity, inventory } = releaseSetIdentityAt(repoRoot);
  const version = inventory.version;
  const now = new Date('2026-09-27T12:00:00Z');

  it('a well-formed, bound, fresh artifact validates and authorizes the set', () => {
    const result = validateTrustEvidence(validEvidence({ identity, version, now }), {
      expectedVersion: version,
      expectedIdentity: identity,
      now,
    });
    expect(result.ok).toBe(true);
    const assessment = assessTrustPreflight(membersFromTrustEvidence(result.evidence));
    expect(assessment.authorized).toBe(true);
  });

  it('an r3-style ARBITRARY evidence map (name → output) is refused', () => {
    const result = validateTrustEvidence(
      JSON.stringify({ '@victframework/contracts': { github: {} } }),
      {
        expectedVersion: version,
        expectedIdentity: identity,
        now,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('schema mismatch');
  });

  it('a STALE artifact (>24h) is refused', () => {
    const stale = new Date('2026-09-25T11:00:00Z');
    const result = validateTrustEvidence(validEvidence({ identity, version, now: stale }), {
      expectedVersion: version,
      expectedIdentity: identity,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('STALE');
  });

  it('an artifact bound to ANOTHER version or set identity is dead on arrival', () => {
    const wrongVersion = validateTrustEvidence(validEvidence({ identity, version: '0.3.1', now }), {
      expectedVersion: version,
      expectedIdentity: identity,
      now,
    });
    expect(wrongVersion.ok).toBe(false);
    expect(wrongVersion.problems.join('\n')).toContain('bound to version "0.3.1"');

    const wrongIdentity = validateTrustEvidence(
      validEvidence({ identity: `v1_${'b'.repeat(64)}`, version, now }),
      {
        expectedVersion: version,
        expectedIdentity: identity,
        now,
      },
    );
    expect(wrongIdentity.ok).toBe(false);
    expect(wrongIdentity.problems.join('\n')).toContain('foreign-set artifact');
  });

  it('partial evidence (a missing member) and non-member noise are refused', () => {
    const parsed = JSON.parse(validEvidence({ identity, version, now }));
    delete parsed.members['@victframework/cli'];
    const missing = validateTrustEvidence(JSON.stringify(parsed), {
      expectedVersion: version,
      expectedIdentity: identity,
      now,
    });
    expect(missing.ok).toBe(false);
    expect(missing.problems.join('\n')).toContain("missing member '@victframework/cli'");

    const noisy = JSON.parse(validEvidence({ identity, version, now }));
    noisy.members['@victframework/renderer-svelte'] = {
      registry: 'present',
      trust: 'exact',
      command: 'x',
      exitCode: 0,
      rawOutputSha256: 'a'.repeat(64),
    };
    const extra = validateTrustEvidence(JSON.stringify(noisy), {
      expectedVersion: version,
      expectedIdentity: identity,
      now,
    });
    expect(extra.ok).toBe(false);
    expect(extra.problems.join('\n')).toContain("non-member '@victframework/renderer-svelte'");
  });

  it('members without the official-command binding (command/sha) are refused', () => {
    const parsed = JSON.parse(validEvidence({ identity, version, now }));
    parsed.members['@victframework/contracts'].command = 'cat made-up.json';
    parsed.members['@victframework/sdk'].rawOutputSha256 = 'not-a-sha';
    const result = validateTrustEvidence(JSON.stringify(parsed), {
      expectedVersion: version,
      expectedIdentity: identity,
      now,
    });
    expect(result.ok).toBe(false);
    const joined = result.problems.join('\n');
    expect(joined).toContain("'@victframework/contracts' does not record the official");
    expect(joined).toContain("'@victframework/sdk' is missing the sha256");
  });

  it('assessPublicationPreflight in evidence mode: credible artifact → authorized; arbitrary → blocked', () => {
    const credible = join(tmpdir(), 'credible-trust-evidence.json');
    writeFileSync(credible, validEvidence({ identity, version, now: new Date() }));
    try {
      const verdict = assessPublicationPreflight({ repoRoot, evidencePath: credible });
      expect(verdict.authorized).toBe(true);
      expect(verdict.mode).toBe('evidence');
    } finally {
      rmSync(credible, { force: true });
    }

    const arbitrary = join(tmpdir(), 'arbitrary-trust-evidence.json');
    writeFileSync(arbitrary, JSON.stringify({ hello: 'world' }));
    try {
      const verdict = assessPublicationPreflight({ repoRoot, evidencePath: arbitrary });
      expect(verdict.authorized).toBe(false);
      expect(verdict.stage).toBe('blocked');
      expect(verdict.blockedReason).toContain('NOT CREDIBLE');
    } finally {
      rmSync(arbitrary, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 8. The bootstrap placeholder can never consume the coordinated set
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
        {
          encoding: 'utf8',
          cwd: repoRoot,
          timeout: 240_000,
        },
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
// 9. The workflow gates publication on BOTH authority and preflight (r4)
// ---------------------------------------------------------------------------

describe('release.yml — authority + trust preflight gates', () => {
  const raw = readFileSync(join(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8');

  it('runs the authority gate immediately before the preflight, then publish', () => {
    expect(raw).toContain('node scripts/verify-contract-authority.mjs');
    const gateIndex = raw.indexOf('Contract authority gate');
    const preflightIndex = raw.indexOf('Trust preflight gate');
    const publishIndex = raw.indexOf('Publish the exact tarballs');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(preflightIndex).toBeGreaterThan(gateIndex);
    expect(publishIndex).toBeGreaterThan(preflightIndex);
    const gateBlock = raw.slice(gateIndex, preflightIndex);
    expect(gateBlock).toContain('validate_only != true');
  });

  it('the preflight step requires the AUTHORIZED verdict (fails on r3)', () => {
    const preflightIndex = raw.indexOf('Trust preflight gate');
    const block = raw.slice(preflightIndex, raw.indexOf('Publish the exact tarballs'));
    expect(block).toContain('--require-authorized');
    expect(block).toContain('verify-trust-preflight.mjs');
    // Evidence can be supplied through a workflow input; without it the
    // live mode applies and CI stays blocked (no npm session).
    expect(raw).toContain('trust_evidence_path');
  });

  it('the publish engine receives the evidence path (env, never shell interpolation)', () => {
    const publishIndex = raw.indexOf('Publish the exact tarballs');
    const block = raw.slice(publishIndex, raw.indexOf('Verify registry state'));
    expect(block).toContain('RELEASE_TRUST_EVIDENCE');
  });
});
