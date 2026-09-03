#!/usr/bin/env node
/**
 * Minimal CLI entry for the Vict application-host scaffolder.
 *
 * Usage: vict-scaffold <targetDir> <appName> [packageName]
 */
import { scaffoldVictApp } from './index.js';

const [targetDir, appName, packageName] = process.argv.slice(2);
if (targetDir === undefined || appName === undefined) {
  console.error('Usage: vict-scaffold <targetDir> <appName> [packageName]');
  process.exit(2);
}
const result = scaffoldVictApp({ targetDir, appName, packageName });
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
