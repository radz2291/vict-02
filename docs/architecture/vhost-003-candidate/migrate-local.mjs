import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOracle } from './oracle.mjs';
import { captureLegacy, prepareImport, stageImport, verifyStaged } from './operator-migration.mjs';
import { canonical } from './migration-map.mjs';

const [action, configPath] = process.argv.slice(2);
assert(['capture', 'plan', 'stage', 'verify'].includes(action));
const config = JSON.parse(await readFile(configPath, 'utf8'));
const { connectionPort: port, dataDirectory, namespace, identity, paths } = config;
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535);
const here = dirname(fileURLToPath(import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'vhost011-offline-'));
const oracle = await loadOracle(paths.consumer, paths.sourceRepo, scratch, join(here, '../../..'));
const out = async (file, content) => writeFile(file, content + '\n', { flag: 'wx' });

async function useDatabase(database, role, work) {
  const connectionString = 'postgresql://' + role + '@127.0.0.1:' + port + '/' + database;
  const client = new oracle.Client({ connectionString, ssl: false });
  await client.connect();
  try {
    const statement = role === 'vhostbench' ?
      "SELECT current_setting('data_directory') AS directory,inet_server_port() AS port" :
      'SELECT inet_server_port() AS port';
    const { rows: [connection] } = await client.query(statement);
    assert.equal(connection.port, port);
    if (role === 'vhostbench') assert.equal(await realpath(connection.directory), await realpath(dataDirectory));
    return await work(client);
  } finally {
    await client.end();
  }
}

if (action === 'capture') {
  const capture = await useDatabase('vhost011_source', 'vhost011_reader',
    (client) => captureLegacy(client, identity, namespace));
  await out(paths.capture, canonical(capture));
} else {
  const capture = JSON.parse(await readFile(paths.capture, 'utf8'));
  const prepared = await prepareImport(oracle, capture, identity, namespace);
  if (action === 'plan') {
    await out(paths.manifest, prepared.manifestText);
    process.stdout.write(prepared.manifestDigest + '\n');
  } else {
    assert.equal(prepared.manifestDigest, config.approvedManifestSHA256);
    assert.equal((await readFile(paths.manifest, 'utf8')).trimEnd(), prepared.manifestText);
    const targetDatabase = config.targetDatabase ?? 'postgres';
    assert(action === 'verify' ? ['postgres', 'vhost011_restore'].includes(targetDatabase) : targetDatabase === 'postgres');
    const result = await useDatabase(targetDatabase, 'vhostbench', (client) => action === 'verify' ?
      verifyStaged(client, prepared) : stageImport(client, prepared, config.approvedManifestSHA256));
    process.stdout.write(canonical(result) + '\n');
  }
}
