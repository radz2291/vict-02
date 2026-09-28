#!/usr/bin/env node
/**
 * Fail-closed pre-publication CONTRACT AUTHORITY gate.
 *
 * Verifies that the frozen trusted-publishing contract
 * (`docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`), exactly as committed
 * at the current checkout, carries the owner-ratified 14-package state:
 *
 *   - the §16 amendment record (facade retirement) is IN the frozen file;
 *   - the §16.5 ratification sequence-deviation record is in the file AND
 *     carries EXACTLY ONE owner decision line — `Owner decision recorded:
 *     D-AUTHORIZE` or `Owner decision recorded: D-REVERT` — whose choice
 *     is consistent with the branch's REAL git history (D-AUTHORIZE:
 *     the named consuming commits ARE ancestors of this checkout;
 *     D-REVERT: they have actually been removed). A heading, a summary,
 *     or a self-authored marker anywhere else is not an owner decision;
 *   - the amendments-to-date header records §16;
 *   - §5 carries exactly the frozen 14-package inventory and order;
 *   - no current-tense 15-package norm survives in §§1–12 (historical
 *     amendment records §8.1/§13/§14/§16 are excluded).
 *
 * While the §16 amendment is an unratified DRAFT, this gate is RED BY
 * DESIGN and every registry-writing path refuses to run:
 *   - `node scripts/oidc-release.mjs validate|publish` (the workflow
 *     engine, including resume paths),
 *   - `node scripts/publish-release.mjs --publish` (operator engine),
 *   - `node scripts/trust-bootstrap.mjs --execute` (trust writes).
 *
 * Ordinary structural and packed-consumer checks (verify:release-set,
 * verify:release-consumer, verify:builder-kit, the test suites) are NOT
 * gated and remain usable while ratification is pending.
 *
 * Exit codes: 0 = the frozen contract authorizes the 14-package set;
 * 1 = refused (with the precise gap list); nothing is ever written.
 *
 * Usage: node scripts/verify-contract-authority.mjs [--repo-root R]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessContractAuthorityAtRoot, FROZEN_CONTRACT_PATH } from './lib/contract-authority.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
let repoRoot = resolve(scriptDir, '..');
const flagIndex = process.argv.indexOf('--repo-root');
if (flagIndex !== -1 && process.argv[flagIndex + 1] !== undefined) {
  repoRoot = resolve(process.argv[flagIndex + 1]);
}

const verdict = assessContractAuthorityAtRoot(repoRoot);
if (!verdict.authorized) {
  console.error(
    `verify-contract-authority: REFUSED — the frozen contract (${FROZEN_CONTRACT_PATH}) does not yet authorize the 14-package candidate set. The §16 amendment is not ratified into the frozen file; no registry write is authorized. Gaps:`,
  );
  for (const problem of verdict.problems) console.error(`  - ${problem}`);
  console.error(
    'Owner action: ratify §16 by committing the amendment record + Appendix A/B substitutions verbatim into the frozen contract (amendment commit), recording the §16.5 sequence-deviation decision. This gate turns green only on that exact state.',
  );
  process.exit(1);
}
console.log(
  `verify-contract-authority: AUTHORIZED — the frozen contract carries the ratified 14-package state (§16, ${FROZEN_CONTRACT_PATH}).`,
);
