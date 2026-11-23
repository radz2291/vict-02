BEGIN;
SET LOCAL search_path = vhost003_indexed, pg_catalog;
CREATE TABLE migration_import (
    namespace text COLLATE "C" PRIMARY KEY REFERENCES namespaces,
    manifest_digest text COLLATE "C" NOT NULL,
    manifest_text text NOT NULL
);
CREATE TABLE legacy_nested_archive (
    namespace text COLLATE "C" PRIMARY KEY REFERENCES namespaces,
    envelope bytea NOT NULL
);
CREATE TABLE migration_hold (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    kind text COLLATE "C" NOT NULL,
    subject_key bytea NOT NULL,
    PRIMARY KEY (namespace,kind,subject_key)
);
COMMIT;
