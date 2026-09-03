export {
  createSqliteApplicationData,
  migrationsFromResources,
  physicalTableName,
  applyApplicationDataMigrations,
  VictApplicationDataError,
  readDurabilityPragmas,
  openAppDatabase,
} from './adapter.js';
export type {
  ApplicationDataMigration,
  AppliedApplicationDataMigration,
  ApplicationDataSqliteErrorCode,
  SqliteApplicationDataAdapter,
  SqliteApplicationDataOptions,
} from './adapter.js';
