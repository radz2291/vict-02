#!/usr/bin/env node
/**
 * Minimal CLI entry for the Vict application-host scaffolder.
 *
 * Usage: vict-scaffold <targetDir> <appName> [packageName] [--release-set <file.json>]
 *
 * The release-set JSON maps platform package names to EXACT dependency
 * specs, e.g.:
 *   { "@victframework/sdk": "0.3.1", "@victframework/runtime": "0.3.1", ... }
 * The scaffolder never invents or defaults platform versions: an explicit
 * release-set selection covering the packages the generated host imports
 * (application, appdata-sqlite, renderer-svelte, runtime, sdk,
 * store-sqlite) is REQUIRED.
 */
import { readFileSync } from 'node:fs';
import { scaffoldVictApp } from './index.js';

const argv = process.argv.slice(2);
const positional: string[] = [];
let releaseSetPath: string | undefined;
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--release-set') {
    releaseSetPath = argv[index + 1];
    index += 1;
  } else {
    positional.push(argv[index] as string);
  }
}
const [targetDir, appName, packageName] = positional;
if (targetDir === undefined || appName === undefined) {
  console.error(
    'Usage: vict-scaffold <targetDir> <appName> [packageName] [--release-set <file.json>]',
  );
  process.exit(2);
}
if (releaseSetPath === undefined) {
  console.error(
    'An explicit release set is required: pass --release-set <file.json> mapping @victframework package names to exact specs.',
  );
  process.exit(2);
}
let platformDependencies: Record<string, string>;
try {
  platformDependencies = JSON.parse(readFileSync(releaseSetPath, 'utf8')) as Record<string, string>;
} catch {
  console.error(`Refused: the release-set file '${releaseSetPath}' is not readable JSON.`);
  process.exit(2);
}
const result = scaffoldVictApp({ targetDir, appName, packageName, platformDependencies });
if (result.status === 'created') {
  console.log(`Created ${result.files.length} files in ${targetDir}.`);
  process.exit(0);
}
if (result.status === 'unchanged') {
  console.log('Already up to date; nothing changed.');
  process.exit(0);
}
if (result.status === 'conflict') {
  console.error('Refusing to overwrite existing files:');
  for (const conflict of result.conflicts) {
    console.error(`  - ${conflict}`);
  }
  process.exit(1);
}
console.error(`Refused: ${result.reason}`);
process.exit(1);
