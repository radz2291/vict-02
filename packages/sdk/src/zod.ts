/**
 * Optional Zod adapter subpath (`@victframework/sdk/zod`).
 *
 * Importing this subpath requires zod to be installed (optional peer
 * dependency of `@victframework/sdk` and `@victframework/contracts`). The base `@victframework/sdk`
 * API is schema-library neutral.
 */
export { defineZodContract } from '@victframework/contracts/zod';
export type { DefineZodContractOptions } from '@victframework/contracts/zod';
