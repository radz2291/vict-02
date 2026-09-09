/**
 * Optional Zod adapter subpath (`@victframework/contracts/zod`).
 *
 * Importing this subpath requires zod to be installed (optional peer
 * dependency). The base `@victframework/contracts` API never mentions zod.
 */
export { defineZodContract } from './define-zod-contract.js';
export type { DefineZodContractOptions } from './define-zod-contract.js';
