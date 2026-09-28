/**
 * Frozen-contract authority assessment (fail-closed pre-publication gate).
 *
 * Answers ONE question for the release path: does the FROZEN contract
 * file (`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`) — as committed at
 * the exact release source — currently AUTHORIZE the 14-package
 * candidate set?
 *
 * The frozen contract is authoritative ONLY through its committed text.
 * While the §16 facade-retirement amendment exists merely as an unratified
 * DRAFT (a separate file), the frozen text still records the §14
 * 15-package state, and every release-set action that derives 14 members
 * has NO contractual authority. This module encodes the EXACT owner-
 * ratified contract state that the §16 draft's Appendices A and B
 * specify, and refuses anything else — the draft itself confers no
 * authority.
 *
 * The ratified state is verified structurally, not by digest alone:
 *   1. the §16 amendment record section exists in the frozen file;
 *   2. the ratification sequence-deviation authorization (§16.5) exists;
 *   3. the amendments-to-date header line records §16;
 *   4. the §5 inventory block carries EXACTLY the frozen 14-name order;
 *   5. no current-tense 15-package norm survives in §§1–12 (historical
 *      amendment records §8.1/§13/§14/§16 are excluded — statements that
 *      were true on their historical dates remain true as history).
 *
 * Pure functions only; the CLI wrapper lives in
 * `scripts/verify-contract-authority.mjs` and the release engines
 * (`scripts/oidc-release.mjs`, `scripts/publish-release.mjs`,
 * `scripts/trust-bootstrap.mjs`) call the assertion BEFORE any registry
 * write, including resume paths.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { FROZEN_PUBLISH_ORDER } from './release-set.mjs';

/** The frozen contract file, relative to the repository root. */
export const FROZEN_CONTRACT_PATH = join('docs', 'RELEASE-TRUSTED-PUBLISHING-CONTRACT.md');

/** The §16 amendment record heading the ratified file must carry. */
export const RATIFIED_SECTION16_HEADING =
  '## 16. Amendment (2026-09-27): 14-package release set (facade retirement)';

/** The sequence-deviation authorization heading ratification must carry. */
export const RATIFIED_DEVIATION_HEADING =
  '### 16.5 Ratification sequence deviation — explicit owner authorization';

/** The amendments-to-date marker ratification must add to the header. */
export const RATIFIED_AMENDMENTS_LINE_MARKER = '§16 (2026-09-27, 14-package facade retirement)';

/** §5 body markers that must be present after the Appendix A substitution
 * (whitespace-tolerant). */
export const RATIFIED_SECTION5_MARKERS = {
  heading: 'AMENDED 2026-09-27, §16',
  count: 'exactly the recorded 14-package',
  removal: 'is REMOVED from the forward candidate set',
};

/** The exact decision-line prefix the owner's §16.5 record must use.
 * A heading, a summary, or a self-authored marker anywhere else in the
 * contract is NOT an owner decision — only this exact line, inside the
 * §16.5 section of the frozen file, counts. */
export const OWNER_DECISION_PREFIX = 'Owner decision recorded:';

/** The two — and only two — decision tokens the owner can record. */
export const OWNER_DECISION_AUTHORIZE = 'D-AUTHORIZE';
export const OWNER_DECISION_REVERT = 'D-REVERT';

/** Exact-form decision line (case-sensitive; the regex form used by the
 * checker tolerates whitespace after the colon only). */
export function ownerDecisionLine(token) {
  return `${OWNER_DECISION_PREFIX} ${token}`;
}

function hasMarker(haystack, needle) {
  return haystack.replace(/\s+/g, ' ').includes(needle);
}

/**
 * Current-tense 15-package norms that must NOT survive ratification in
 * §§1–12 (historical amendment records are excluded). The arrow
 * marker forms (`13 → 15`, `15 → 14`) are historical amendment markers,
 * never norms, and are intentionally NOT matched.
 */
export const STALE_COUNT_PATTERNS = [
  /\ball 15\b/,
  /\b15-package\b/,
  /\b15 packages\b/,
  /\b15 manifests\b/,
  /\b15 relationships\b/,
  /\b15 separate\b/,
  /\ballowlist \(15\b/,
  /\bthe recorded 15\b/,
  /\bexactly 15\b/,
];

function extractSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return null;
  const end = endMarker === undefined ? text.length : text.indexOf(endMarker, start);
  if (end === -1) return text.slice(start);
  return text.slice(start, end);
}

/**
 * Extract the §16.5 section body (from its heading to the next `## `
 * section heading, or end of file). Returns null when the heading is
 * absent.
 */
function extractSection165(text) {
  return extractSection(text, RATIFIED_DEVIATION_HEADING, '\n## ');
}

/**
 * Extract the owner's recorded decision from the §16.5 section ONLY.
 *
 * The exact decision line is `Owner decision recorded: D-AUTHORIZE` or
 * `Owner decision recorded: D-REVERT` (case-sensitive, exact token).
 * Returns one of:
 *   { kind: 'authorize' } | { kind: 'revert' }        — exactly one line
 *   { kind: 'missing' }                                — no line at all
 *   { kind: 'malformed' }                              — tokens mentioned,
 *                                                        no exact line
 *   { kind: 'ambiguous' }                              — more than one line
 * A decision marker OUTSIDE the §16.5 section is invisible here by
 * design: only the §16.5 record is the owner decision.
 */
export function extractOwnerDecision(contractText) {
  const section = extractSection165(contractText);
  if (section === null) return { kind: 'missing' };
  const matches = [
    ...section.matchAll(
      new RegExp(`${OWNER_DECISION_PREFIX}\\s*(D-AUTHORIZE|D-REVERT)(?![A-Za-z-])`, 'g'),
    ),
  ];
  if (matches.length === 0) {
    const mentionsTokens = /\bD-AUTHORIZE\b|\bD-REVERT\b/.test(section);
    return { kind: mentionsTokens ? 'malformed' : 'missing' };
  }
  if (matches.length > 1) return { kind: 'ambiguous' };
  return { kind: matches[0][1] === OWNER_DECISION_AUTHORIZE ? 'authorize' : 'revert' };
}

/** 40-hex commit SHAs named inside the §16.5 section (the consuming
 * implementation commits the decision is about). */
function namedDeviationCommits(contractText) {
  const section = extractSection165(contractText);
  if (section === null) return [];
  return [...new Set([...section.matchAll(/\b[0-9a-f]{40}\b/g)].map((match) => match[0]))];
}

/**
 * Parse the numbered publication-order entries out of a §5 body.
 * Returns the ordered `@victframework/*` names (or null when the block
 * is missing/unparseable).
 */
export function parseSection5Order(section5Text) {
  if (section5Text === null) return null;
  const fence = section5Text.indexOf('```text');
  if (fence === -1) return null;
  const closing = section5Text.indexOf('```', fence + 6);
  const body = closing === -1 ? section5Text.slice(fence) : section5Text.slice(fence, closing);
  const order = [];
  for (const match of body.matchAll(/^\s*\d+\.\s+(@victframework\/[a-z0-9-]+)\b/gm)) {
    order.push(match[1]);
  }
  return order.length > 0 ? order : null;
}

/**
 * Assess the frozen contract text against the exact ratified 14-package
 * state. Returns `{ authorized, problems }`; `problems` names every gap
 * (never a silent partial verdict).
 *
 * The §16.5 owner decision is ENFORCED, not assumed: the ratified record
 * must carry EXACTLY ONE exact decision line — `Owner decision recorded:
 * D-AUTHORIZE` or `Owner decision recorded: D-REVERT` — inside the §16.5
 * section, and the choice must be CONSISTENT with the branch's actual
 * history (verified through the optional `context.isAncestor(sha)`
 * callback, backed by real git in the CLI/engine path):
 *   - D-AUTHORIZE: every consuming commit named in §16.5 must BE an
 *     ancestor of the checked-out source (the record describes this
 *     branch);
 *   - D-REVERT: every named consuming commit must have been REMOVED from
 *     this branch's history (the reversion actually happened).
 * Without a verifier the check fails closed. Missing, ambiguous,
 * malformed, or contradictory decisions refuse authority.
 *
 * @param {string} contractText the FULL frozen-contract file text
 * @param {{isAncestor?: (sha: string) => boolean|undefined}} [context]
 * @returns {{authorized: boolean, problems: string[]}}
 */
export function assessContractAuthority(contractText, context = {}) {
  const problems = [];
  const text = String(contractText ?? '');

  // 1. The §16 amendment record must exist IN the frozen file.
  if (!text.includes(RATIFIED_SECTION16_HEADING)) {
    problems.push(
      `missing ratified amendment record: the frozen file has no "${RATIFIED_SECTION16_HEADING}" section — §16 still exists only as the unratified draft, which confers no authority.`,
    );
  }

  // 2. The ratification sequence-deviation authorization must be part of
  //    the ratified record (the consuming implementation was committed
  //    before ratification; the owner must explicitly authorize it).
  const hasDeviationHeading = text.includes(RATIFIED_DEVIATION_HEADING);
  if (!hasDeviationHeading) {
    problems.push(
      `missing owner authorization: the frozen file has no "${RATIFIED_DEVIATION_HEADING}" — the amendment-before-implementation sequence deviation is not yet explicitly authorized (or rejected-and-reverted) by the owner.`,
    );
  } else {
    // 2a. The owner decision itself — exact line, inside §16.5 only.
    const decision = extractOwnerDecision(text);
    if (decision.kind === 'missing') {
      problems.push(
        'owner decision missing: §16.5 exists but records NO exact decision line — the owner must record exactly one of `Owner decision recorded: D-AUTHORIZE` / `Owner decision recorded: D-REVERT` inside the §16.5 section. A heading, a summary, or a marker anywhere else is not an owner decision.',
      );
    } else if (decision.kind === 'malformed') {
      problems.push(
        'owner decision malformed: §16.5 mentions the decision tokens but records no exact `Owner decision recorded: D-AUTHORIZE` / `Owner decision recorded: D-REVERT` line (case-sensitive, exact form) — refusing.',
      );
    } else if (decision.kind === 'ambiguous') {
      problems.push(
        'owner decision ambiguous: §16.5 records MORE THAN ONE decision line — exactly one of D-AUTHORIZE / D-REVERT must be recorded, never both.',
      );
    } else {
      // 2b. The choice must be consistent with the branch's real history.
      const commits = namedDeviationCommits(text);
      const isAncestor = context.isAncestor;
      if (commits.length === 0) {
        problems.push(
          'owner decision unverifiable: the §16.5 record names no consuming implementation commit SHAs — the decision has nothing concrete to apply to.',
        );
      } else if (typeof isAncestor !== 'function') {
        problems.push(
          'owner decision cross-check unavailable (no git ancestry verifier was provided) — refusing fail-closed; run the gate from a git checkout of the release branch.',
        );
      } else {
        const ancestry = commits.map((sha) => ({ sha, isAncestor: isAncestor(sha) }));
        if (ancestry.some((entry) => entry.isAncestor === undefined)) {
          problems.push(
            `owner decision cross-check could not resolve ${ancestry
              .filter((entry) => entry.isAncestor === undefined)
              .map((entry) => entry.sha.slice(0, 10))
              .join(', ')} against this branch — refusing fail-closed.`,
          );
        } else if (decision.kind === 'authorize') {
          const missing = ancestry.filter((entry) => entry.isAncestor !== true);
          if (missing.length > 0) {
            problems.push(
              `owner decision CONTRADICTS the branch history: D-AUTHORIZE is recorded, but the authorized consuming commit(s) ${missing
                .map((entry) => entry.sha.slice(0, 10))
                .join(
                  ', ',
                )} are NOT ancestor(s) of the checked-out source — the record does not describe this branch.`,
            );
          }
        } else {
          const stillPresent = ancestry.filter((entry) => entry.isAncestor === true);
          if (stillPresent.length > 0) {
            problems.push(
              `owner decision CONTRADICTS the branch history: D-REVERT is recorded, but the consuming implementation commit(s) ${stillPresent
                .map((entry) => entry.sha.slice(0, 10))
                .join(
                  ', ',
                )} are STILL ancestor(s) of the checked-out source — revert the implementation before ratifying D-REVERT.`,
            );
          }
        }
      }
    }
  }

  // 3. The amendments-to-date header line must record §16.
  const header = extractSection(text, 'Amendment rule', '## 1.');
  if (header === null || !hasMarker(header, RATIFIED_AMENDMENTS_LINE_MARKER)) {
    problems.push(
      'the header "Amendments to date" line does not record "§16 (2026-09-27, 14-package facade retirement)".',
    );
  }

  // 4. The §5 inventory block must carry EXACTLY the frozen 14-name order.
  const section5 = extractSection(text, '## 5. Release-set inventory', '## 6.');
  if (section5 === null) {
    problems.push('the frozen file has no "## 5. Release-set inventory" section.');
  } else {
    if (!hasMarker(section5, RATIFIED_SECTION5_MARKERS.heading)) {
      problems.push('§5 heading/body does not carry the "AMENDED 2026-09-27, §16" marker.');
    }
    if (!hasMarker(section5, RATIFIED_SECTION5_MARKERS.count)) {
      problems.push('§5 body does not record "exactly the recorded 14-package" set.');
    }
    if (!hasMarker(section5, RATIFIED_SECTION5_MARKERS.removal)) {
      problems.push(
        '§5 body does not record the renderer-svelte removal ("is REMOVED from the forward candidate set").',
      );
    }
    const order = parseSection5Order(section5);
    if (order === null) {
      problems.push('§5 has no parseable dependency-topological order fence.');
    } else if (
      order.length !== FROZEN_PUBLISH_ORDER.length ||
      order.some((name, index) => name !== FROZEN_PUBLISH_ORDER[index])
    ) {
      problems.push(
        `§5 order is not the frozen 14-package order (found ${order.length} entries: ${order.join(', ')}).`,
      );
    }
  }

  // 5. No current-tense 15-package norm may survive in §§1–12.
  //    Historical amendment records are excluded: ONLY the §8.1
  //    subsection, then §13 (freeze-time baseline), §14 (15-package
  //    amendment record), and §16 (this amendment's own record) —
  //    statements that were true of earlier states on their historical
  //    dates remain true as history. §§9–12 stay inside the scanned
  //    region (their norms were restated by Appendix B).
  let normative = extractSection(text, '## 1.', '## 13.');
  if (normative !== null) {
    const h81Start = normative.indexOf('### 8.1 ');
    if (h81Start !== -1) {
      const h81End = normative.indexOf('\n## 9.', h81Start);
      normative =
        h81End === -1
          ? normative.slice(0, h81Start)
          : normative.slice(0, h81Start) + normative.slice(h81End + 1);
    }
    for (const pattern of STALE_COUNT_PATTERNS) {
      const match = pattern.exec(normative);
      if (match !== null) {
        const lineIndex = normative.slice(0, match.index).split('\n').length;
        problems.push(
          `stale current-tense count norm surviving in §§1–12 (line ~${lineIndex} of §1..§12): "...${normative
            .slice(Math.max(0, match.index - 40), match.index + 50)
            .replace(/\s+/g, ' ')
            .trim()}..." — the §16 substitution (Appendix B) was not applied here.`,
        );
      }
    }
  }

  return { authorized: problems.length === 0, problems };
}

/**
 * Git-backed ancestry verifier: is `sha` an ancestor of the current
 * HEAD at `repoRoot`? Returns true/false, or undefined when git cannot
 * decide (never guesses).
 */
export function createGitAncestryVerifier(repoRoot) {
  const cache = new Map();
  return function isAncestor(sha) {
    if (cache.has(sha)) return cache.get(sha);
    const result = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    let verdict;
    if (result.status === 0) verdict = true;
    else if (result.status === 1) verdict = false;
    else verdict = undefined; // git error (missing repo, bad object, ...) — never guessed
    cache.set(sha, verdict);
    return verdict;
  };
}

/**
 * Read and assess the frozen contract at a repository root. Throws when
 * the file is unreadable (a missing contract is never an authority).
 * The §16.5 owner-decision cross-check runs against REAL git ancestry at
 * the given root.
 *
 * @param {string} repoRoot repository root directory
 */
export function assessContractAuthorityAtRoot(repoRoot) {
  let text;
  try {
    text = readFileSync(join(repoRoot, FROZEN_CONTRACT_PATH), 'utf8');
  } catch (error) {
    return {
      authorized: false,
      problems: [
        `the frozen contract file (${FROZEN_CONTRACT_PATH}) is unreadable: ${error.message}.`,
      ],
    };
  }
  return assessContractAuthority(text, { isAncestor: createGitAncestryVerifier(repoRoot) });
}
