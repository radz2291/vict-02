import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const expected = '9ae689b487d610e3df0581885660fe096f645a88';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.equal(manifest.producingCommit, expected);
const source = fs.realpathSync(manifest.buildDirectory);
const destination = fs.realpathSync(path.resolve('apps/studio/build'));
assert.equal(destination, path.join(fs.realpathSync('.'), 'apps', 'studio', 'build'));
assert.notEqual(source, destination);
const activate = process.argv.includes('--activate');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function contained(root, relative) {
  const file = path.resolve(root, relative);
  assert.ok(file.startsWith(root + path.sep), 'Artifact path escaped its build directory');
  return file;
}
for (const entry of manifest.files) {
  const file = contained(source, entry.path);
  assert.ok(fs.lstatSync(file).isFile(), 'Artifact entries must be regular files');
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, entry.bytes);
  assert.equal(hash(bytes), entry.sha256);
  contained(destination, entry.path);
}
if (activate) {
  for (const entry of manifest.files) {
    const target = contained(destination, entry.path);
    // Only existing generated build directories may be used, never junctions.
    let ancestor = path.dirname(target);
    while (ancestor !== destination) {
      if (fs.existsSync(ancestor)) assert.ok(!fs.lstatSync(ancestor).isSymbolicLink());
      ancestor = path.dirname(ancestor);
    }
    if (fs.existsSync(target))
      assert.ok(fs.lstatSync(target).isFile() && !fs.lstatSync(target).isSymbolicLink());
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(contained(source, entry.path), target);
    assert.equal(hash(fs.readFileSync(target)), entry.sha256);
  }
}
console.log(
  JSON.stringify(
    {
      producingCommit: expected,
      source,
      destination,
      mode: activate ? 'activated' : 'source-verified',
      filesVerified: manifest.files.length,
      allHashesMatch: true,
      oldHashedAssetsPreserved: true,
      ownerBrowserReloaded: false,
    },
    null,
    2,
  ),
);

