import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from './canonical.js';

/**
 * Constitution excerpt and verified-baseline extraction from the reference
 * document (architecture §3.3/§3.4). Every excerpt carries
 * `{ sourcePath, anchor, contentSha256, excerpt }`; the freshness gate
 * re-extracts from the live reference and compares bytes and digest.
 */

const REFERENCE_PATH = 'docs/VICT-SYSTEM-REFERENCE.md';

export interface Excerpt {
  readonly sourcePath: string;
  readonly anchor: string;
  readonly contentSha256: string;
  readonly excerpt: string;
}

function readReference(repoRoot: string): string {
  return readFileSync(join(repoRoot, REFERENCE_PATH), 'utf8');
}

function referenceLines(reference: string): readonly string[] {
  return reference.split('\n').map((line) => line.replace(/\r$/, ''));
}

function excerptFromLines(anchor: string, lines: readonly string[]): Excerpt {
  const text = lines.join('\n');
  return {
    sourcePath: REFERENCE_PATH,
    anchor,
    contentSha256: sha256Hex(Buffer.from(text, 'utf8')),
    excerpt: text,
  };
}

/** The requirement-table row for one requirement ID (first match, verbatim). */
export function extractRequirementRow(reference: string, id: string): string | null {
  for (const rawLine of referenceLines(reference)) {
    const line = rawLine.trimEnd();
    if (line.startsWith(`| ${id} `) && line.endsWith('|')) {
      return line;
    }
  }
  return null;
}

/** Consecutive numbered-list lines directly after a heading. */
export function extractNumberedListAfterHeading(
  reference: string,
  heading: string,
): readonly string[] | null {
  const lines = referenceLines(reference);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() === heading) {
      start = index;
      break;
    }
  }
  if (start < 0) return null;
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (/^\d+\. /.test(line)) {
      collected.push(line.trimEnd());
      continue;
    }
    if (collected.length > 0) break;
    if (line.trim().length === 0) continue;
    break;
  }
  return collected.length > 0 ? collected : null;
}

/** Consecutive bullet lines directly after a heading. */
export function extractBulletsAfterHeading(
  reference: string,
  heading: string,
): readonly string[] | null {
  const lines = referenceLines(reference);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() === heading) {
      start = index;
      break;
    }
  }
  if (start < 0) return null;
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.startsWith('- ')) {
      collected.push(line.trimEnd());
      continue;
    }
    if (collected.length > 0) break;
    if (line.trim().length === 0) continue;
    break;
  }
  return collected.length > 0 ? collected : null;
}

/** The full text of a section: from its heading to the next same-or-higher-level heading. */
export function extractSection(reference: string, heading: string): readonly string[] | null {
  const lines = referenceLines(reference);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() === heading) {
      start = index;
      break;
    }
  }
  if (start < 0) return null;
  const headingMatch = /^#+/.exec(heading);
  const level = headingMatch === null ? 1 : headingMatch[0].length;
  const first = lines[start];
  if (first === undefined) return null;
  const collected: string[] = [first.trimEnd()];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const headingMatch = line.match(/^(#+) /);
    if (headingMatch !== null && (headingMatch[1] ?? '#').length <= level) break;
    collected.push(line.trimEnd());
  }
  while (collected.length > 0 && collected[collected.length - 1] === '') collected.pop();
  return collected;
}

/** Requirement IDs whose rows constitute the builder constitution (architecture §3.3 list). */
export const CONSTITUTION_REQUIREMENT_IDS: readonly string[] = [
  'GOV-002',
  'GOV-004',
  'GOV-005',
  'GOV-007',
  'AGNT-003',
  'AGNT-004',
  'AGNT-006',
  'AGNT-007',
  'AGNT-008',
  'SEC-002',
  'SEC-003',
  'TEST-001',
  'TEST-002',
  'TEST-004',
  'TEST-005',
  'TEST-007',
];

/** Build the constitution excerpt list from the live reference. */
export function buildConstitution(repoRoot: string): readonly Excerpt[] {
  const reference = readReference(repoRoot);
  const excerpts: Excerpt[] = [];

  const principles = extractNumberedListAfterHeading(reference, '## 2. Design principles');
  if (principles !== null) {
    excerpts.push(excerptFromLines('§2 Design principles (numbered list)', principles));
  }

  const controls = extractBulletsAfterHeading(reference, '### 21.1 Security controls');
  if (controls !== null) {
    excerpts.push(excerptFromLines('§21.1 Security controls (bullet list)', controls));
  }

  const trustFacts = extractBulletsAfterHeading(reference, '### 21.2 Trust facts');
  if (trustFacts !== null) {
    excerpts.push(excerptFromLines('§21.2 Trust facts (bullet list)', trustFacts));
  }

  for (const id of CONSTITUTION_REQUIREMENT_IDS) {
    const row = extractRequirementRow(reference, id);
    if (row !== null) excerpts.push(excerptFromLines(`Requirement row ${id}`, [row]));
  }
  return excerpts;
}

export interface VerifiedBaselinePointer {
  readonly sourcePath: string;
  readonly anchor: string;
  readonly contentSha256: string;
  readonly extract: string;
}

/**
 * Provenance pointer into reference §24.1: digest over the full section
 * bytes plus a one-paragraph current-truth extract (the section's final
 * bullet — the most recent stage closure line).
 */
export function buildVerifiedBaseline(repoRoot: string): VerifiedBaselinePointer | null {
  const reference = readReference(repoRoot);
  const section = extractSection(reference, '### 24.1 Verified baseline');
  if (section === null) return null;
  const text = section.join('\n');
  const bullets = section.filter((line) => line.startsWith('- '));
  const lastBullet = bullets[bullets.length - 1];
  if (lastBullet === undefined) return null;
  return {
    sourcePath: REFERENCE_PATH,
    anchor: '### 24.1 Verified baseline',
    contentSha256: sha256Hex(Buffer.from(text, 'utf8')),
    extract: lastBullet,
  };
}
