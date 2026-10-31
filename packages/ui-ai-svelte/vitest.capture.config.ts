import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
/** Capture infrastructure has isolated DOM/library state; run its focused suites explicitly. */
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),resolve:{conditions:['browser']},test:{environment:'happy-dom',include:['test/capture*.test.ts'],testTimeout:30000}});
