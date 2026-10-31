import {mergeConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import studio from './vitest.config.js';
// Isolated source-unit proof for this worktree's shared class-validator change.
// Installed dependencies remain the existing toolchain; no package build is claimed.
export default mergeConfig(studio,{resolve:{alias:[{find:/^@victframework\/ui$/,replacement:fileURLToPath(new URL('../../packages/ui/src/index.ts',import.meta.url))}]}});
