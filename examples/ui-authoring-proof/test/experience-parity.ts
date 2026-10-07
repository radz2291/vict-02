/** Repaired-source swap evidence through the real dispatcher and local SQLite adapter. */
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { canonicalUiDocument } from '@victframework/ui';
import { inspectionPlan } from '../src/lib/product/compile.js';
import { inspectionApplication } from '../src/lib/product/definitions.js';
import { inspectionDetailDocument, inspectionQueueDocument } from '../src/lib/product/documents.js';
import {
  InspectionDataAdapter,
  createInspectionServer,
  seedDomain,
} from '../src/lib/product/domain.js';
import { openDurableInspectionStore } from '../src/lib/server/inspection-durable.js';

const file = join(mkdtempSync(join(tmpdir(), 'u3-experience-parity-')), 'inspection.sqlite');
const actor = { role: 'supervisor', actorId: 's.hart' };
function identity() {
  const compiled = inspectionPlan();
  const bindings = Object.values(inspectionDetailDocument.nodes)
    .filter((n) => n.kind === 'element' && n.interactions?.length)
    .map((n) => ({ id: n.id, interactions: n.interactions }));
  return {
    queueDigest: canonicalUiDocument(inspectionQueueDocument).contentDigest,
    detailDigest: canonicalUiDocument(inspectionDetailDocument).contentDigest,
    bindingDigest: createHash('sha256').update(JSON.stringify(bindings)).digest('hex'),
    applicationVersion: compiled.plan.applicationVersion,
    approve: inspectionApplication.actions.find((a) => a.id === 'inspection.approve'),
  };
}
const before = identity();
const simulated = createInspectionServer(new InspectionDataAdapter(seedDomain()));
const opened = openDurableInspectionStore(file, 'normal');
const durable = createInspectionServer(opened.adapter);
const decisions = [];
for (const [mode, server] of [
  ['simulated', simulated],
  ['durable-local', durable],
] as const) {
  const read = await server.dispatch('inspection.get', { id: 'i-101' }, actor);
  assert.equal(read.ok, true);
  const revision = Number((read.value as Record<string, unknown>).domainRevision);
  const result = await server.dispatch(
    'inspection.approve',
    { id: 'i-101', expectedDomainRevision: revision },
    actor,
  );
  assert.equal(result.ok, true);
  const updated = await server.dispatch('inspection.get', { id: 'i-101' }, actor);
  assert.equal((updated.value as Record<string, unknown>).status, 'approved');
  decisions.push({
    mode,
    status: (updated.value as Record<string, unknown>).status,
    revision: (updated.value as Record<string, unknown>).domainRevision,
    trail: server.adapter.activityFor('i-101').map((a) => a.entry),
  });
}
opened.handle.close();
const reopened = openDurableInspectionStore(file, 'normal');
const reopenedRead = await createInspectionServer(reopened.adapter).dispatch(
  'inspection.get',
  { id: 'i-101' },
  actor,
);
assert.equal(reopenedRead.ok, true);
assert.equal((reopenedRead.value as Record<string, unknown>).status, 'approved');
const after = identity();
assert.deepEqual(before, after);
assert.deepEqual({ ...decisions[0], mode: '' }, { ...decisions[1], mode: '' });
reopened.handle.close();
console.log(
  JSON.stringify(
    { before, after, equal: true, decisions, sqliteCloseReopen: 'approved', file },
    null,
    2,
  ),
);
