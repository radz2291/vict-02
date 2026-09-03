import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  createSqliteApplicationData,
  migrationsFromResources,
  type SqliteApplicationDataAdapter,
} from '@vict/appdata-sqlite';
import { createReferenceServer, type ReferenceAppServer } from './application-server.js';
import { dataContracts, resources } from '$lib/application/definition.js';

/**
 * Production wiring of the reference application server: the SQLite
 * application-domain adapter (separate tables and migration history from
 * Vict operational stores) plus the explicit lifecycle surface. This module
 * is the only place that imports the native adapter; the server core stays
 * storage-neutral.
 */

const DB_PATH = process.env.VICT_APPDATA_PATH ?? join('.data', 'appdata.sqlite');

let singleton: ReferenceAppServer | undefined;

export function getReferenceServer(): ReferenceAppServer {
  if (singleton === undefined) {
    const absolutePath = resolve(DB_PATH);
    // Ensure the containing directory exists (never created implicitly by SQLite).
    mkdirSync(dirname(absolutePath), { recursive: true });
    const data: SqliteApplicationDataAdapter = createSqliteApplicationData({
      path: absolutePath,
      resources,
      contracts: dataContracts,
      migrations: [migrationsFromResources(resources, 1)],
    });
    singleton = createReferenceServer({ data });
  }
  return singleton;
}

/** Test/helper: dispose the singleton (closes the database handle). */
export function resetReferenceServer(): void {
  const data = singleton?.data as { close?: () => void } | undefined;
  data?.close?.();
  singleton = undefined;
}
