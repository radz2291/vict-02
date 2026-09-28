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
 * @param {string} contractText the FULL frozen-contract file text
 * @returns {{authorized: boolean, problems: string[]}}
 */
export function assessContractAuthority(contractText) {
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
  if (!text.includes(RATIFIED_DEVIATION_HEADING)) {
    problems.push(
      `missing owner authorization: the frozen file has no "${RATIFIED_DEVIATION_HEADING}" — the amendment-before-implementation sequence deviation is not yet explicitly authorized (or rejected-and-reverted) by the owner.`,
    );
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
 * Read and assess the frozen contract at a repository root. Throws when
 * the file is unreadable (a missing contract is never an authority).
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
  return assessContractAuthority(text);
}
