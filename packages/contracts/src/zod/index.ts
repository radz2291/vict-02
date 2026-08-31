/**
 * Optional Zod adapter subpath (`@vict/contracts/zod`).
 *
 * Importing this subpath requires zod to be installed (optional peer
 * dependency). The base `@vict/contracts` API never mentions zod.
 */
export { defineZodContract } from './define-zod-contract.js';
export type { DefineZodContractOptions } from './define-zod-contract.js';
