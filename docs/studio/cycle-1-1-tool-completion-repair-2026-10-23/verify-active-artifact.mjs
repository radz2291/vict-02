import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const manifest = JSON.parse(fs.readFileSync('docs/studio/verification-cycle-1-1-tool-completion/artifact-manifest.json', 'utf8'));
assert.equal(manifest.producingCommit, '3c54f5e525827b66abcee9ac03acc68642b9e8c3');
const base = fs.realpathSync('apps/studio/build');
for (const entry of manifest.files) {
  const file = path.resolve(base, entry.path);
  assert.ok(file.startsWith(base + path.sep));
  assert.ok(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink());
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, entry.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
}
console.log(JSON.stringify({producingCommit:manifest.producingCommit,destination:base,filesVerified:manifest.files.length,allHashesMatch:true},null,2));
