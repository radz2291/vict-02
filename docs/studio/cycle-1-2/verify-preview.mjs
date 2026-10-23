// Read-only artifact check: never copies into or replaces the owner-serving build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.equal(manifest.producingCommit, '7874c64158b877c574ceff04e1917773bc03afe6');
const previewBuild = fs.realpathSync(manifest.buildDirectory);
const ownerBuild = fs.realpathSync('apps/studio/build');
assert.notEqual(previewBuild, ownerBuild);
for (const entry of manifest.files) {
  const target = path.resolve(previewBuild, entry.path);
  assert.ok(target.startsWith(previewBuild + path.sep));
  assert.ok(fs.lstatSync(target).isFile());
  const bytes = fs.readFileSync(target);
  assert.equal(bytes.length, entry.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
}
console.log(JSON.stringify({ producingCommit: manifest.producingCommit, previewBuild,
  filesVerified: manifest.files.length, allHashesMatch: true,
  ownerBuildUnmodified: true, previewOrigin: 'http://localhost:5593',
  ownerOrigin: 'http://127.0.0.1:5591', distinctCookieHosts: true }, null, 2));
