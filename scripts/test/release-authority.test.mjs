/**
 * Release-authority tests (r4/r5): the fail-closed contract-authority gate
 * WITH owner-decision enforcement (r5: the decision must be an EXACT
 * FULL LINE inside §16.5 — prose quoting the phrase no longer
 * authorizes), the MANDATORY trust preflight with set-bound evidence
 * (r5: the evidence must RETAIN its captured official output — hash
 * recomputed, trust reclassified — and registry presence is re-proven
 * live at release time), and the engine/workflow wiring (r5: the
 * evidence path reaches the FIRST validate step and travels by env var
 * only, never shell-built arguments).
 *
 * RED/GREEN contract:
 *  - the historical §14 contract fixture is REFUSED (red), while the
 *    real frozen §16 contract is AUTHORIZED with D-AUTHORIZE;
 *  - only the EXACT owner-ratified state passes: Appendices A+B applied
 *    verbatim AND the owner's explicit §16.5 decision line
 *    (`Owner decision recorded: D-AUTHORIZE` / `D-REVERT`) consistent
 *    with the branch's REAL git history. A heading or a self-created
 *    marker is NOT a decision: missing, ambiguous, malformed, or
 *    contradictory choices refuse authority (r4); prose quoting the
 *    phrase, or the line with a trailing annotation, is refused too
 *    (r5 — these ACCEPTED on r4);
 *  - publication additionally requires the set-wide trust preflight
 *    (all 14 present + exact verified trust) — live or through a
 *    VALIDATED set-bound evidence artifact (r4; r3 accepted arbitrary
 *    JSON, so these tests fail on r3). r5 negatives (failed exit code,
 *    invented hash, altered output, forged status, wrong member,
 *    duplicate, stale) also fail on r4, whose checker verified the
 *    hash's FORMAT only;
 *  - release.yml must pass the operator evidence to EVERY preflight
 *    consumer — the first `validate` step included (r4 defect: CI died
 *    on the E401 live check before any evidence-aware step) — and the
 *    preflight step must not build shell argument strings from it.
 *
 * REGISTRY-STATE DETERMINISM (release-exec): the §16 first-publication
 * bootstrap will flip `ui`/`ui-svelte` from ABSENT to PRESENT (the
 * `0.0.0-bootstrap.1` placeholder under the `bootstrap` tag), and the
 * §11 trust bootstrap will later make their trust EXACT. The suite runs
 * in the release workflow's `npm test` — before AND after those one-time
 * owner-authorized steps — so every test whose subject touches the live
 * registry DERIVES its expectations from a read-only live presence
 * probe (the same packument probe the production preflight performs)
 * instead of hard-coding the pre-bootstrap world. The production gate
 * itself is untouched: evidence still cannot forge (or deny) registry
 * presence, presence is still re-proven LIVE at release time, and an
 * absent member still refuses the whole set.
 *
 * No test in this file performs a registry write.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { fetchPackument } from '../lib/registry-probe.mjs';
import yaml from 'js-yaml';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const FROZEN_CONTRACT = join(repoRoot, 'docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md');
const realContractText = readFileSync(FROZEN_CONTRACT, 'utf8');
const legacyContractText = readFileSync(
  join(scriptDir, 'fixtures', 'release-contract-section14.md'),
  'utf8',
);
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
// 1. Contract authority — historical §14 red, real §16 green
// ---------------------------------------------------------------------------

describe('contract authority — historical §14 red state', () => {
  const verdict = assessContractAuthority(legacyContractText, { isAncestor: () => true });

  it('refuses the historical §14 contract', () => {
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

  it('authorizes the real §16 contract against the actual git ancestry', () => {
    const real = assessContractAuthority(realContractText, {
      isAncestor: createGitAncestryVerifier(repoRoot),
    });
    expect(real).toEqual({ authorized: true, problems: [] });
  });
});

// ---------------------------------------------------------------------------
// 2. Contract authority — the owner decision is ENFORCED (r4)
// ---------------------------------------------------------------------------

describe('contract authority — §16.5 owner decision enforcement', () => {
  const ratifiedNoDecision = ratify(legacyContractText);
  const alwaysAncestor = () => true;
  const neverAncestor = () => false;

  it('extractOwnerDecision: exact line inside §16.5 is recognized; elsewhere it is not', () => {
    expect(extractOwnerDecision(ratify(legacyContractText, 'D-AUTHORIZE')).kind).toBe('authorize');
    expect(extractOwnerDecision(ratify(legacyContractText, 'D-REVERT')).kind).toBe('revert');
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
    const both = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      `${ownerDecisionLine('D-AUTHORIZE')}`,
      `${ownerDecisionLine('D-AUTHORIZE')}\n${ownerDecisionLine('D-REVERT')}`,
    );
    expect(extractOwnerDecision(both).kind).toBe('ambiguous');
    const duplicate = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      `${ownerDecisionLine('D-AUTHORIZE')}\n${ownerDecisionLine('D-AUTHORIZE')}`,
    );
    expect(extractOwnerDecision(duplicate).kind).toBe('ambiguous');
    const malformed = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      'owner decision: D-AUTHORIZE (informal note)',
    );
    expect(extractOwnerDecision(malformed).kind).toBe('malformed');
  });

  it('r5: the decision must be a FULL LINE — prose quoting the phrase never authorizes (accepted on r4)', () => {
    // The entire r4 defect: this phrase, buried in prose, matched the
    // r4 search and AUTHORIZED the release. It is a full line, but not
    // an exact decision line.
    const prose = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      'The meeting minutes quote: "Owner decision recorded: D-AUTHORIZE" as the form to use.',
    );
    expect(extractOwnerDecision(prose).kind).toBe('malformed');
    const verdict = assessContractAuthority(prose, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.join('\n')).toContain('owner decision malformed');
  });

  it('r5: a trailing annotation on the decision line is refused (authorized on r4)', () => {
    const annotated = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      `${ownerDecisionLine('D-AUTHORIZE')} (ratified at the 2026-09-27 review)`,
    );
    expect(extractOwnerDecision(annotated).kind).toBe('malformed');
    expect(assessContractAuthority(annotated, { isAncestor: alwaysAncestor }).authorized).toBe(
      false,
    );
    // Lowercase or differently-spelled tokens are not the exact line either.
    const lowercased = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      'Owner decision recorded: d-authorize',
    );
    expect(extractOwnerDecision(lowercased).kind).toBe('malformed');
  });

  it('r5: the exact line still authorizes regardless of surrounding indentation', () => {
    const indented = ratify(legacyContractText, 'D-REVERT').replace(
      ownerDecisionLine('D-REVERT'),
      `    ${ownerDecisionLine('D-REVERT')}   `,
    );
    expect(extractOwnerDecision(indented).kind).toBe('revert');
  });

  it('refuses a ratified record with NO decision line (heading is not a decision)', () => {
    const verdict = assessContractAuthority(ratifiedNoDecision, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    // The record TEXT mentions the tokens (as instructions) without the
    // owner ever recording the exact line — refused.
    const problem = verdict.problems.find((p) => p.includes('owner decision malformed'));
    expect(problem).toBeDefined();
    expect(problem).toContain('records no exact full line `Owner decision recorded:');
  });

  it('refuses AMBIGUOUS decisions (both tokens, or the line twice)', () => {
    const both = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      `${ownerDecisionLine('D-AUTHORIZE')}\n${ownerDecisionLine('D-REVERT')}`,
    );
    const verdict = assessContractAuthority(both, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.join('\n')).toContain('owner decision ambiguous');
  });

  it('refuses MALFORMED decisions (tokens without the exact line form)', () => {
    const informal = ratify(legacyContractText, 'D-AUTHORIZE').replace(
      ownerDecisionLine('D-AUTHORIZE'),
      'The owner informally nodded at D-AUTHORIZE.',
    );
    const verdict = assessContractAuthority(informal, { isAncestor: alwaysAncestor });
    expect(verdict.authorized).toBe(false);
    expect(verdict.problems.join('\n')).toContain('owner decision malformed');
  });

  it('accepts D-AUTHORIZE only when the named consuming commits ARE ancestors', () => {
    const ok = assessContractAuthority(ratify(legacyContractText, 'D-AUTHORIZE'), {
      isAncestor: alwaysAncestor,
    });
    expect(ok.authorized).toBe(true);

    const contradictory = assessContractAuthority(ratify(legacyContractText, 'D-AUTHORIZE'), {
      isAncestor: neverAncestor,
    });
    expect(contradictory.authorized).toBe(false);
    expect(contradictory.problems.join('\n')).toContain('D-AUTHORIZE is recorded');

    const noVerifier = assessContractAuthority(ratify(legacyContractText, 'D-AUTHORIZE'), {});
    expect(noVerifier.authorized).toBe(false);
    expect(noVerifier.problems.join('\n')).toContain('cross-check unavailable');
  });

  it('accepts D-REVERT only when the named consuming commits are GONE from history', () => {
    const reverted = assessContractAuthority(ratify(legacyContractText, 'D-REVERT'), {
      isAncestor: neverAncestor,
    });
    expect(reverted.authorized).toBe(true);

    const stillPresent = assessContractAuthority(ratify(legacyContractText, 'D-REVERT'), {
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
      let text = ratify(legacyContractText, 'D-REVERT').replace(
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
    const verdict = assessContractAuthority(ratify(legacyContractText, 'D-AUTHORIZE'), {
      isAncestor: () => true,
    });
    expect(verdict.problems).toEqual([]);
    expect(verdict.authorized).toBe(true);
  });

  it('the ratified §5 order parses to exactly the frozen 14-package order', () => {
    const ratified = ratify(legacyContractText, 'D-AUTHORIZE');
    const order = parseSection5Order(
      ratified.slice(ratified.indexOf('## 5.'), ratified.indexOf('## 6.')),
    );
    expect(order).toEqual(FROZEN_PUBLISH_ORDER);
  });

  it('refuses a tampered §5 order (one swapped entry)', () => {
    const ratified = ratify(legacyContractText, 'D-AUTHORIZE');
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
    const ratified = ratify(legacyContractText, 'D-AUTHORIZE');
    const tampered = ratified.replace(
      'The human never\n  performs 14 separate manual package configurations.',
      'The human never\n  performs 15 separate manual package configurations.',
    );
    const result = assessContractAuthority(tampered, { isAncestor: () => true });
    expect(result.authorized).toBe(false);
    expect(result.problems.join('\n')).toContain('stale current-tense');
  });

  it('tolerates 15-references inside historical records (§8.1/§13/§14/§16)', () => {
    const ratified = ratify(legacyContractText, 'D-AUTHORIZE');
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
  let text = ratify(legacyContractText, decision);
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
  it('the standalone CLI is GREEN on the real repo (§16 ratified, D-AUTHORIZE)', () => {
    const result = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'verify-contract-authority.mjs')],
      {
        encoding: 'utf8',
        cwd: repoRoot,
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('AUTHORIZED');
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
  it('oidc-release validate refuses an unauthorized source before lineage/registry activity', () => {
    const fixtureRoot = writeGitFixture('D-REVERT', { nameCommits: true });
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
          '--repo-root',
          fixtureRoot,
        ],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(result.status).toBe(1);
      const output = `${result.stderr}${result.stdout}`;
      expect(output).toContain('CONTRACT AUTHORITY REFUSED');
      expect(output).toContain('NO registry call or write was made');
      expect(output).not.toContain('origin/main');
      expect(output).not.toContain('resume');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('oidc-release publish refuses an unauthorized source before the pack-dir check', () => {
    const fixtureRoot = writeGitFixture('D-REVERT', { nameCommits: true });
    try {
      const result = spawnSync(
        process.execPath,
        [
          join(repoRoot, 'scripts', 'oidc-release.mjs'),
          'publish',
          '--pack-dir',
          join(tmpdir(), 'definitely-missing-pack-dir'),
          '--repo-root',
          fixtureRoot,
        ],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(result.status).toBe(1);
      expect(`${result.stderr}${result.stdout}`).toContain('CONTRACT AUTHORITY REFUSED');
      expect(`${result.stderr}${result.stdout}`).not.toContain('requires a valid --pack-dir');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
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

  it('an unauthorized source with ARBITRARY evidence still refuses at the AUTHORITY gate first', () => {
    const fixtureRoot = writeGitFixture('D-REVERT', { nameCommits: true });
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
          '--repo-root',
          fixtureRoot,
        ],
        { encoding: 'utf8', cwd: repoRoot },
      );
      expect(result.status).toBe(1);
      const output = `${result.stderr}${result.stdout}`;
      expect(output).toContain('CONTRACT AUTHORITY REFUSED');
      expect(output).not.toContain('evidence artifact'); // preflight never even ran
    } finally {
      rmSync(arbitrary, { force: true });
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('trust-bootstrap --execute checks authority before inventory and registry work', () => {
    const source = readFileSync(join(repoRoot, 'scripts', 'trust-bootstrap.mjs'), 'utf8');
    expect(source.indexOf('assessContractAuthorityAtRoot(repoRoot)')).toBeLessThan(
      source.indexOf('deriveReleaseInventory(repoRoot)'),
    );
  });

  it('first-publish-bootstrap requires explicit owner authorization before publish', () => {
    const source = readFileSync(join(repoRoot, 'scripts', 'first-publish-bootstrap.mjs'), 'utf8');
    expect(source.indexOf('readFileSync(resolve(authorizationPath)')).toBeLessThan(
      source.indexOf('const publish = spawnSync('),
    );
  });
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
// LIVE registry state — derived, never assumed (release-exec)
// ---------------------------------------------------------------------------

/** The two members whose presence the §16 first-publication bootstrap
 * establishes (the only registry state the release path transitions). */
const BOOTSTRAP_MEMBERS = ['@victframework/ui', '@victframework/ui-svelte'];

/**
 * LIVE read-only registry presence probe (the same packument probe the
 * production preflight performs). Returns { present, absent } so every
 * registry-state expectation below is DERIVED from the actual state —
 * the suite holds identically before the bootstrap (both members
 * absent), after it (placeholders present), and at the release-ready
 * state. Throws when the registry is unreachable: a live-registry test
 * requires a reachable registry, and the production gate refuses on
 * exactly that condition.
 */
function livePresence(names = BOOTSTRAP_MEMBERS) {
  const present = [];
  const absent = [];
  for (const name of names) {
    const packument = fetchPackument(name);
    (Object.keys(packument.versions ?? {}).length > 0 ? present : absent).push(name);
  }
  return { present, absent };
}

// ---------------------------------------------------------------------------
// 7. Trust evidence — arbitrary, stale, or SELF-ASSERTING JSON never
//    authorizes (r4); the artifact must RETAIN its captured official
//    output and survive hash recompute + reclassification (r5)
// ---------------------------------------------------------------------------

/** The EXACT shape npm 11.19.1 `npm trust list <pkg> --json` emits for
 * the frozen relationship (verified against the npm 11.19.1 source:
 * github bodyToOptions + raw `createPackage` permission key). */
function frozenTrustListOutput() {
  return JSON.stringify(
    {
      id: 12345,
      type: 'github',
      file: 'release.yml',
      repository: 'radz2291/vict-02',
      permissions: ['createPackage'],
    },
    null,
    2,
  );
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function validEvidence({ now = new Date('2026-09-27T12:00:00Z'), identity, version } = {}) {
  const results = FROZEN_PUBLISH_ORDER.map((name) => {
    const rawOutput = frozenTrustListOutput();
    return {
      name,
      registry: 'present',
      versionCount: 1,
      command: `npm trust list ${name} --json`,
      exitCode: 0,
      rawOutput,
      rawOutputSha256: sha256(rawOutput),
      trust: 'exact',
    };
  });
  return JSON.stringify({
    schema: TRUST_EVIDENCE_SCHEMA,
    generatedAt: now.toISOString(),
    version,
    setIdentity: identity,
    results,
  });
}

function evidenceWith(identity, version, mutate, now) {
  const parsed = JSON.parse(validEvidence({ identity, version, now }));
  mutate(parsed);
  return JSON.stringify(parsed);
}

const evidenceBinding = (identity, version, now) => ({
  expectedVersion: version,
  expectedIdentity: identity,
  now,
});

describe('trust evidence — binding failures refuse authority', () => {
  const { identity, inventory } = releaseSetIdentityAt(repoRoot);
  const version = inventory.version;
  const now = new Date('2026-09-27T12:00:00Z');

  it('a well-formed, bound, fresh artifact validates; trust is DERIVED from the retained output', () => {
    const result = validateTrustEvidence(
      validEvidence({ identity, version, now }),
      evidenceBinding(identity, version, now),
    );
    expect(result.ok).toBe(true);
    const assessment = assessTrustPreflight(membersFromTrustEvidence(result.evidence));
    expect(assessment.authorized).toBe(true);
    // The claimed statuses were never consulted: even if every claim
    // were flipped to 'missing', the derived (output-classified) trust
    // stays exact.
    const lying = JSON.parse(validEvidence({ identity, version, now }));
    for (const result of lying.results) result.trust = 'missing';
    const lyingMembers = membersFromTrustEvidence({ results: lying.results });
    expect(lyingMembers.every((member) => member.trust === TRUST_EXACT)).toBe(true);
  });

  it('an r3-style ARBITRARY evidence map (name → output) is refused', () => {
    const result = validateTrustEvidence(
      JSON.stringify({ '@victframework/contracts': { github: {} } }),
      evidenceBinding(identity, version, now),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('schema mismatch');
  });

  it('a superseded v1 artifact (hash without retained output) is refused by name', () => {
    const v1 = validEvidence({ identity, version, now }).replace(
      TRUST_EVIDENCE_SCHEMA,
      'vict-trust-preflight-evidence/1',
    );
    const result = validateTrustEvidence(v1, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('superseded and REFUSED');
    expect(result.problems.join('\n')).toContain('without retaining the captured output');
  });

  it('a STALE artifact (>24h) is refused', () => {
    const stale = new Date('2026-09-25T11:00:00Z');
    const result = validateTrustEvidence(
      validEvidence({ identity, version, now: stale }),
      evidenceBinding(identity, version, now),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('STALE');
  });

  it('an artifact bound to ANOTHER version or set identity is dead on arrival', () => {
    const wrongVersion = validateTrustEvidence(
      validEvidence({ identity, version: '0.3.1', now }),
      evidenceBinding(identity, version, now),
    );
    expect(wrongVersion.ok).toBe(false);
    expect(wrongVersion.problems.join('\n')).toContain('bound to version "0.3.1"');

    const wrongIdentity = validateTrustEvidence(
      validEvidence({ identity: `v1_${'b'.repeat(64)}`, version, now }),
      evidenceBinding(identity, version, now),
    );
    expect(wrongIdentity.ok).toBe(false);
    expect(wrongIdentity.problems.join('\n')).toContain('foreign-set artifact');
  });

  it('partial evidence (a missing member result) and non-member noise are refused', () => {
    const missing = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results = parsed.results.filter((result) => result.name !== '@victframework/cli');
      },
      now,
    );
    const missingResult = validateTrustEvidence(missing, evidenceBinding(identity, version, now));
    expect(missingResult.ok).toBe(false);
    expect(missingResult.problems.join('\n')).toContain(
      "no result for release-set member '@victframework/cli'",
    );

    const noisy = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results.push({
          name: '@victframework/renderer-svelte',
          registry: 'present',
          versionCount: 1,
          command: 'npm trust list @victframework/renderer-svelte --json',
          exitCode: 0,
          rawOutput: frozenTrustListOutput(),
          rawOutputSha256: sha256(frozenTrustListOutput()),
          trust: 'exact',
        });
      },
      now,
    );
    const extra = validateTrustEvidence(noisy, evidenceBinding(identity, version, now));
    expect(extra.ok).toBe(false);
    expect(extra.problems.join('\n')).toContain('not a frozen release-set member');
  });

  it('r5: a FAILED official command (exitCode 1) is refused, never interpreted', () => {
    const failed = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results[0].exitCode = 1;
      },
      now,
    );
    const result = validateTrustEvidence(failed, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('FAILED official command (exitCode 1)');
  });

  it('r5: an INVENTED hash is refused — the retained output is re-hashed and compared', () => {
    const invented = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results[0].rawOutputSha256 = sha256('output that was never captured');
      },
      now,
    );
    const result = validateTrustEvidence(invented, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain(
      'rawOutputSha256 does NOT match the retained captured output',
    );
  });

  it('r5: ALTERED captured output is refused (hash no longer matches)', () => {
    const altered = evidenceWith(
      identity,
      version,
      (parsed) => {
        // Flip the repository inside the retained output but keep the
        // original hash — exactly what a careless or malicious editor of
        // a captured artifact would produce.
        parsed.results[1].rawOutput = parsed.results[1].rawOutput.replace(
          'radz2291/vict-02',
          'attacker/elsewhere',
        );
      },
      now,
    );
    const result = validateTrustEvidence(altered, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('does NOT match the retained captured output');
  });

  it('r5: a FORGED trust status is refused — the claim must match the output classification', () => {
    // Self-consistent hash over EMPTY output (a real "no trust configs"
    // capture) — but the status was forged to 'exact'.
    const forged = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results[2].rawOutput = '';
        parsed.results[2].rawOutputSha256 = sha256('');
        parsed.results[2].trust = 'exact';
      },
      now,
    );
    const result = validateTrustEvidence(forged, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain(
      "CLAIMS trust 'exact', but its own captured output CLASSIFIES as 'missing'",
    );
  });

  it('r5: a result for the WRONG member binding (mismatched command) is refused', () => {
    const wrongCommand = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results[3].command = 'npm trust list @victframework/contracts --json';
      },
      now,
    );
    const result = validateTrustEvidence(wrongCommand, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('does not record the EXACT official command');
  });

  it('r5: DUPLICATE results for one member are refused', () => {
    const duplicated = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results.push({ ...parsed.results[4] });
      },
      now,
    );
    const result = validateTrustEvidence(duplicated, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('DUPLICATE results');
  });

  it('r5: unparseable captured output is refused even when the hash matches', () => {
    const garbage = evidenceWith(
      identity,
      version,
      (parsed) => {
        parsed.results[5].rawOutput = 'npm error This command requires you to be logged in.';
        parsed.results[5].rawOutputSha256 = sha256(
          'npm error This command requires you to be logged in.',
        );
      },
      now,
    );
    const result = validateTrustEvidence(garbage, evidenceBinding(identity, version, now));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain(
      "not parseable official 'npm trust list --json' output",
    );
  });

  it(
    'evidence-mode preflight (r5): evidence proves TRUST; registry presence is re-proven LIVE at release time (deterministic across the pre-/post-bootstrap registry states)',
    { timeout: 300_000 },
    () => {
      const credible = join(tmpdir(), 'credible-trust-evidence-r5.json');
      // The fixture claims `registry: 'present'` for ALL 14 members —
      // including ui and ui-svelte whenever they still lack registry
      // presence. The live recheck must override those claims.
      writeFileSync(credible, validEvidence({ identity, version, now: new Date() }));
      try {
        const live = livePresence();
        const log = [];
        const verdict = assessPublicationPreflight({
          repoRoot,
          evidencePath: credible,
          log: (line) => log.push(line),
        });
        expect(verdict.mode).toBe('evidence');
        // The evidence WAS accepted (validated, bound, fresh, classified
        // exact) — every member's trust is now EXACT, derived from the
        // retained output, in EVERY registry state:
        expect(verdict.assessment.unverifiable).toEqual([]);
        expect(verdict.assessment.untrusted).toEqual([]);
        expect(verdict.assessment.conflicting).toEqual([]);
        // …but the LIVE registry recheck governs presence: the verdict's
        // absent set equals the live probe exactly (the artifact's
        // presence claims are never trusted):
        expect(verdict.assessment.absent).toEqual(live.absent);
        // and every claim/live disagreement is surfaced, never swallowed:
        expect(log.filter((line) => line.includes('the LIVE result governs')).length).toBe(
          live.absent.length,
        );
        if (live.absent.length > 0) {
          // Pre-bootstrap world: publication stays refused on the
          // bootstrap stage even though the evidence claims presence —
          // registry presence cannot be forged by evidence.
          expect(verdict.authorized).toBe(false);
          expect(verdict.stage).toBe('first-publication-bootstrap');
        } else {
          // Post-bootstrap world: live presence proven for all 14, and
          // the validated evidence carries trust — the release-time CI
          // state the workflow's evidence input exists for.
          expect(verdict.authorized).toBe(true);
          expect(verdict.stage).toBe('authorized');
        }
      } finally {
        rmSync(credible, { force: true });
      }
    },
  );

  it(
    'release-exec: evidence can neither FORGE nor DENY registry presence — inverting every presence claim leaves the LIVE verdict unchanged',
    { timeout: 300_000 },
    () => {
      const live = livePresence();
      const build = (claim) => {
        const parsed = JSON.parse(validEvidence({ identity, version, now: new Date() }));
        for (const result of parsed.results) result.registry = claim;
        return JSON.stringify(parsed);
      };
      const paths = {
        present: join(tmpdir(), 'presence-claim-present.json'),
        absent: join(tmpdir(), 'presence-claim-absent.json'),
      };
      writeFileSync(paths.present, build(REGISTRY_PRESENT));
      writeFileSync(paths.absent, build(REGISTRY_ABSENT));
      try {
        const verdicts = {
          present: assessPublicationPreflight({ repoRoot, evidencePath: paths.present }),
          absent: assessPublicationPreflight({ repoRoot, evidencePath: paths.absent }),
        };
        for (const [claim, verdict] of Object.entries(verdicts)) {
          expect(verdict.mode).toBe('evidence');
          // Whatever the artifact claims, presence comes ONLY from the
          // live recheck — identical verdicts under opposite claims:
          expect(verdict.assessment.absent, claim).toEqual(live.absent);
          expect(verdict.authorized, claim).toBe(live.absent.length === 0);
          expect(verdict.stage, claim).toBe(
            live.absent.length > 0 ? 'first-publication-bootstrap' : 'authorized',
          );
        }
      } finally {
        rmSync(paths.present, { force: true });
        rmSync(paths.absent, { force: true });
      }
    },
  );

  it('r5 negatives refuse publication before the first package (evidence-mode preflight)', () => {
    const negatives = [
      [
        'failed exit code',
        (parsed) => {
          parsed.results[0].exitCode = 1;
        },
      ],
      [
        'invented hash',
        (parsed) => {
          parsed.results[0].rawOutputSha256 = sha256('never captured');
        },
      ],
      [
        'altered captured output',
        (parsed) => {
          parsed.results[0].rawOutput = parsed.results[0].rawOutput.replace(
            'release.yml',
            'other.yml',
          );
        },
      ],
      [
        'forged exact trust',
        (parsed) => {
          parsed.results[0].rawOutput = '';
          parsed.results[0].rawOutputSha256 = sha256('');
          parsed.results[0].trust = 'exact';
        },
      ],
      [
        'wrong member binding',
        (parsed) => {
          parsed.results[0].command = 'npm trust list @other/pkg --json';
        },
      ],
      ['stale time', 'STALE'],
    ];
    for (const [label, mutate] of negatives) {
      const stale = new Date('2026-09-01T00:00:00Z');
      const raw =
        mutate === 'STALE'
          ? validEvidence({ identity, version, now: stale })
          : evidenceWith(identity, version, mutate, new Date());
      const artifact = join(tmpdir(), `negative-evidence-${label.replace(/\W+/g, '-')}.json`);
      writeFileSync(artifact, raw);
      try {
        const verdict = assessPublicationPreflight({ repoRoot, evidencePath: artifact });
        expect(verdict.mode, label).toBe('evidence');
        expect(verdict.authorized, label).toBe(false);
        expect(verdict.stage, label).toBe('blocked');
        expect(verdict.blockedReason, label).toContain('NOT CREDIBLE');
      } finally {
        rmSync(artifact, { force: true });
      }
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
    'the bootstrap plan matches the LIVE registry state and stays dry without --execute (pre- and post-bootstrap deterministic)',
    { timeout: 300_000 },
    () => {
      const live = livePresence();
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
      if (live.absent.length > 0) {
        // The plan names EXACTLY the live-absent members — never a
        // package that already has registry presence (idempotence), and
        // never a placeholder version that could consume the set:
        for (const name of live.absent) expect(output).toContain(`absent: ${name}`);
        for (const name of live.present) expect(output).not.toContain(`absent: ${name}`);
        expect(output).toContain('DRY plan only');
        expect(output).toContain('0.4.0-rc.1 remains the coordinated candidate version');
      } else {
        // Post-bootstrap world: nothing left to bootstrap — the script
        // refuses to place a second placeholder on an existing package.
        expect(output).toContain('nothing to bootstrap');
        expect(output).not.toContain('absent: ');
      }
      // In EITHER state the dry run makes no registry write and never
      // publishes:
      expect(output).not.toContain('published:');
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

  // --- r5: the evidence input reaches EVERY preflight consumer, by env only ---

  it('r5: the FIRST validate step receives RELEASE_TRUST_EVIDENCE (defect on r4)', () => {
    const doc = yaml.load(raw);
    const steps = doc.jobs['publish-release-set'].steps;
    const validate = steps.find((step) =>
      String(step.run ?? '').includes('node scripts/oidc-release.mjs validate'),
    );
    expect(validate).toBeDefined();
    // On r4 this step ran the trust preflight WITHOUT the evidence, so
    // CI died on the authentication-gated live check before any later
    // evidence-aware step could run.
    expect(validate.env.RELEASE_TRUST_EVIDENCE).toBe('${{ inputs.trust_evidence_path }}');
  });

  it('r5: the preflight gate passes the evidence path by ENV ONLY — no shell word-splitting is possible', () => {
    const doc = yaml.load(raw);
    const steps = doc.jobs['publish-release-set'].steps;
    const preflight = steps.find((step) =>
      String(step.name ?? '').startsWith('Trust preflight gate'),
    );
    expect(preflight).toBeDefined();
    expect(preflight.env.RELEASE_TRUST_EVIDENCE).toBe('${{ inputs.trust_evidence_path }}');
    // The run block is a single fixed command: no ARGS assembly, no
    // variable expansion, no --evidence shell interpolation.
    expect(preflight.run.trim()).toBe(
      'node scripts/verify-trust-preflight.mjs --require-authorized',
    );
    expect(preflight.run).not.toContain('$');
    expect(preflight.run).not.toContain('--evidence');
    // The consumer actually reads the env var.
    const verifyScript = readFileSync(
      join(repoRoot, 'scripts', 'verify-trust-preflight.mjs'),
      'utf8',
    );
    expect(verifyScript).toContain('process.env.RELEASE_TRUST_EVIDENCE');
  });

  it('r5: the evidence artifact format is consumed by the shared preflight, not re-parsed by the workflow', () => {
    // The workflow never inspects the artifact; only the engine does.
    expect(raw).not.toMatch(/rawOutput|validateTrustEvidence|trust list/);
  });
});

// ---------------------------------------------------------------------------
// 10. Faithful integration: the evidence env drives the REAL gate (r5)
// ---------------------------------------------------------------------------

describe('verify-trust-preflight — the evidence env reaches the real gate (r5)', () => {
  const { identity, inventory } = releaseSetIdentityAt(repoRoot);
  const version = inventory.version;

  function runPreflight(envOverrides) {
    return spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'verify-trust-preflight.mjs'), '--require-authorized'],
      {
        encoding: 'utf8',
        cwd: repoRoot,
        timeout: 240_000,
        env: { ...process.env, ...envOverrides },
      },
    );
  }

  it(
    'a valid evidence fixture (env only) carries the run PAST the trust check to the live registry recheck (deterministic across registry states)',
    { timeout: 300_000 },
    () => {
      const live = livePresence();
      const artifact = join(tmpdir(), 'r5-integration-evidence.json');
      const parsed = JSON.parse(validEvidence({ identity, version, now: new Date() }));
      writeFileSync(artifact, JSON.stringify(parsed));
      try {
        const result = runPreflight({ RELEASE_TRUST_EVIDENCE: artifact });
        const output = `${result.stdout}${result.stderr}`;
        // The evidence was accepted and USED (mode: evidence) — in every
        // registry state:
        expect(output).toContain('validated operator evidence bound to');
        expect(output).toContain('classified from the RETAINED captured output');
        // …so the gate reached the LIVE registry recheck — the exact
        // stage the r4 E401 dead-end never allowed CI to reach:
        expect(output).toContain('LIVE registry recheck');
        if (live.absent.length > 0) {
          // The recheck governs: the live-absent members refuse the run
          // (bootstrap stage — a registry WRITE remains impossible, G3
          // HELD), even though the evidence claims their presence:
          expect(result.status).toBe(1);
          expect(output).toContain('ABSENT (no presence at any version)');
          expect(output).toContain('first-publication-bootstrap');
          for (const name of live.absent) expect(output).toContain(name);
        } else {
          // Post-bootstrap: live presence proven for all 14 + validated
          // trust evidence → the gate AUTHORIZES (the release-ready
          // state the coordinated publication runs in).
          expect(result.status).toBe(0);
          expect(output).toContain('AUTHORIZED');
        }
      } finally {
        rmSync(artifact, { force: true });
      }
    },
  );

  it(
    'WITHOUT the evidence env the gate stays in LIVE mode and its verdict tracks the live trust state (CI: the r4 authentication-gated refusal)',
    { timeout: 300_000 },
    () => {
      const env = { ...process.env };
      delete env.RELEASE_TRUST_EVIDENCE;
      const result = spawnSync(
        process.execPath,
        [join(repoRoot, 'scripts', 'verify-trust-preflight.mjs'), '--require-authorized'],
        { encoding: 'utf8', cwd: repoRoot, timeout: 240_000, env },
      );
      const output = `${result.stdout}${result.stderr}`;
      // Live mode only — the evidence path is never consulted:
      expect(output).not.toContain('validated operator evidence');
      // The CLI verdict must equal the live-mode verdict of the SAME
      // registry + trust state (derived, so the test holds in the
      // pre-bootstrap world, the post-bootstrap world, on a session-less
      // CI runner, and on an authenticated operator machine alike):
      const live = assessPublicationPreflight({ repoRoot });
      expect(result.status === 0).toBe(live.authorized);
      if (live.authorized) {
        expect(output).toContain('AUTHORIZED');
      } else {
        expect(output).toContain(`(stage: ${live.stage})`);
        if (live.assessment.unverifiable.length > 0) {
          // The session-less CI failure mode (r4): trust verification is
          // authentication-gated and every unverifiable member refuses
          // the run — absence of proof is never a pass.
          expect(output).toContain('UNVERIFIABLE');
        }
      }
    },
  );

  it(
    'an INVALID evidence fixture via env is refused as NOT CREDIBLE before any registry write',
    { timeout: 300_000 },
    () => {
      const artifact = join(tmpdir(), 'r5-integration-evidence-invalid.json');
      writeFileSync(
        artifact,
        evidenceWith(
          identity,
          version,
          (parsed) => {
            parsed.results[0].exitCode = 1;
          },
          new Date(),
        ),
      );
      try {
        const result = runPreflight({ RELEASE_TRUST_EVIDENCE: artifact });
        const output = `${result.stdout}${result.stderr}`;
        expect(result.status).toBe(1);
        expect(output).toContain('NOT CREDIBLE');
        expect(output).toContain('FAILED official command (exitCode 1)');
        expect(output).not.toContain('LIVE registry recheck');
      } finally {
        rmSync(artifact, { force: true });
      }
    },
  );
});
