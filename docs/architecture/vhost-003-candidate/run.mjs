import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIndexedHotPathForTests } from './indexed-hot-path.mjs';
import { loadOracle, digest } from './oracle.mjs';
import { checkPorts } from './checks.mjs';
import { checkReceipts, compareReceiptTraffic } from './receipt-checks.mjs';
import { compareBenchmarks } from './benchmark.mjs';
import { checkDispatcherClaims } from './dispatcher-claim-checks.mjs';
import { checkControlPorts } from './control-checks.mjs';
import { checkRuns } from './run-checks.mjs';
import { checkOrdering, orderingBaselineCommit } from './ordering-checks.mjs';

const [consumer, source, dataDir, portText, samplesText, output, phase] = process.argv.slice(2);
const port = Number(portText);
const samples = Number(samplesText);
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535);
assert(Number.isSafeInteger(samples) && samples >= 4 && samples <= 1000);
assert(['check', 'all'].includes(phase));
const evidence = { format: 'vict.vhost009-execution@1', when: new Date().toISOString(),
  node: process.version, cpu: cpus()[0]?.model, logicalCPUs: cpus().length, osRelease: release(),
  checks: [], cells: [], samples };
const save = () => writeFile(join(output, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
const here = dirname(fileURLToPath(import.meta.url));
try {
  const oracle = await loadOracle(consumer, source, dirname(dataDir), join(here, '../../..'));
  evidence.provenance = oracle.provenance;
  evidence.provenance.candidateSHA256 = {};
  for (const path of ['indexed-runs.mjs', 'run-checks.mjs', 'execution-schema.sql', 'ordering-checks.mjs', 'indexed-control.mjs', 'control-checks.mjs', 'control-schema.sql', 'dispatcher-claim-checks.mjs', 'schema.sql', 'receipts-schema.sql', 'indexed-receipts.mjs', 'receipt-checks.mjs', 'foundation.mjs', 'indexed-hot-path.mjs', 'values.mjs',
    'run.mjs', 'oracle.mjs', 'benchmark.mjs', 'checks.mjs', 'run-local.ps1']) {
    const bytes = await readFile(join(here, path));
    evidence.provenance.candidateSHA256[path] = digest(bytes.toString().replaceAll('\r\n', '\n'));
  }
  const connectionString = 'postgresql://vhostbench@127.0.0.1:' + port + '/postgres';
  const observer = new oracle.Client({ connectionString, application_name: 'vhost003_observer', ssl: false });
  await observer.connect();
  try {
    const { rows: [server] } = await observer.query(
      "SELECT current_setting('data_directory') AS data, current_setting('server_version') AS version, inet_server_addr()::text AS address, inet_server_port() AS port, current_setting('ssl') AS ssl, current_user AS role"
    );
    assert.equal(await realpath(server.data), await realpath(dataDir));
    assert.equal(server.address, '127.0.0.1/32');
    assert.equal(server.port, port);
    assert.equal(server.role, 'vhostbench');
    assert.equal(server.ssl, 'off');
    evidence.provenance.postgres = server.version;
    await observer.query(await readFile(join(here, 'schema.sql'), 'utf8'));
    await observer.query(await readFile(join(here, 'receipts-schema.sql'), 'utf8'));
    await observer.query(await readFile(join(here, 'control-schema.sql'), 'utf8'));
    await observer.query(await readFile(join(here, 'execution-schema.sql'), 'utf8'));
    const provision = async (namespace, epoch = 1) => {
      await observer.query('BEGIN');
      try {
        await observer.query('INSERT INTO vhost003_indexed.namespaces VALUES($1,$2)', [namespace, epoch]);
        await observer.query('INSERT INTO vhost003_indexed.callback_admission VALUES($1)', [namespace]);
        await observer.query('COMMIT');
      } catch (error) {
        await observer.query('ROLLBACK');
        throw error;
      }
    };
    const legacy = (namespace, options = {}) => oracle.createPostgresStores({
      connectionString, schema: 'vhost003_legacy', namespace, tls: 'disable-loopback-only', ...options
    });
    const candidate = (namespace, options = {}) => createIndexedHotPathForTests(oracle, {
      connectionString, namespace, writerEpoch: 1, ...options
    });
    const context = { oracle, observer, provision, legacy, candidate, evidence, samples, save };

    await checkRuns(context);
    await checkPorts(context);
    await checkReceipts(context);
    await checkDispatcherClaims(context);
    await checkControlPorts(context);
    const git = (...args) => execFileSync('git', ['-C', join(here, '../../..'), ...args], { windowsHide: true });
    assert.equal(git('merge-base', 'HEAD', orderingBaselineCommit).toString().trim(), orderingBaselineCommit);
    const scratch = await mkdtemp(join(dirname(dataDir), 'vhost007-baseline-'));
    const baselineHashes = {};
    for (const file of ['indexed-hot-path.mjs', 'indexed-receipts.mjs', 'indexed-control.mjs', 'foundation.mjs', 'values.mjs']) {
      const bytes = git('show', orderingBaselineCommit + ':docs/architecture/vhost-003-candidate/' + file);
      baselineHashes[file] = digest(bytes);
      await writeFile(join(scratch, file), bytes);
    }
    evidence.provenance.orderingBaselineSHA256 = baselineHashes;
    const baseline = (await import(pathToFileURL(join(scratch, 'indexed-hot-path.mjs')))).createIndexedHotPathForTests;
    await checkOrdering(context, (namespace, options) => baseline(oracle, {
      connectionString, namespace, writerEpoch: 1, ...options
    }), candidate);
    if (phase === 'all') {
      await compareBenchmarks(context);
      await compareReceiptTraffic(context);
    }
  } finally {
    await observer.end();
  }
} catch (error) {
  evidence.failure = { name: error.name, code: error.code, message: error.message, stack: error.stack };
  throw error;
} finally {
  await save();
}
