// Runs the built consumer bundle under happy-dom (outside any browser).
// Global DOM must be registered BEFORE the bundle is imported: the bundle's
// entry module mounts applications at import time.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readdirSync } from 'node:fs';

GlobalRegistrator.register();

const assetsDir = new URL('./dist/assets/', import.meta.url);
const entry = readdirSync(assetsDir).find(
  (name) => name.startsWith('index') && name.endsWith('.js'),
);
if (entry === undefined) {
  console.error('P5 proof: no built index-*.js entry found');
  process.exit(1);
}
await import(new URL(`./dist/assets/${entry}`, import.meta.url).href);
