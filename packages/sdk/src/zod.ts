/**
 * Optional Zod adapter subpath (`@vict/sdk/zod`).
 *
 * Importing this subpath requires zod to be installed (optional peer
 * dependency of `@vict/sdk` and `@vict/contracts`). The base `@vict/sdk`
 * API is schema-library neutral.
 */
export { defineZodContract } from '@vict/contracts/zod';
export type { DefineZodContractOptions } from '@vict/contracts/zod';
